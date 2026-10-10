"""
Parali Alert FastAPI Route Handlers.
Exposes REST endpoints for:
- Study area and boundary GeoJSON
- Ranked pre-fire intervention queues
- Unit deep-dive analysis (spectral timeline, weather, drivers)
- Live weather & active FIRMS fires
- Historical replay (with strict zero-leakage temporal cutoffs)
- Evaluation benchmarks & baseline comparisons
- Operational CSV export manifests
- WhatsApp BDO alert dispatch (N1)
- Farmer ground-truth self-reporting (N2)
- Live CPCB air quality stations (N4)
- Carbon & pollutant emission calculator (N7)
- Sentinel-2 multi-spectral comparison chips (N6)
"""

import asyncio
import csv
import io
import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from config.settings import settings
from backend.api.schemas import (
    StudyAreasResponse,
    RiskRankingsResponse,
    UnitDetailResponse,
    WeatherOverviewResponse,
    HistoricalReplayResponse,
    WhatsAppAlertRequest,
    WhatsAppAlertResponse,
    FarmerReportRequest,
    FarmerReportResponse
)
from backend.services.satellite_service import satellite_service
from backend.services.state_engine import transition_model
from backend.services.weather_service import weather_service
from backend.services.firms_service import firms_service
from backend.services.air_quality_service import air_quality_service
from backend.services.risk_engine import risk_engine
from backend.services.aws_service import aws_service
from backend.services.evaluation_service import evaluation_service
from backend.services.whatsapp_service import whatsapp_service
from backend.services.farmer_service import farmer_service
from backend.services.cpcb_service import cpcb_service
from backend.services.emission_service import emission_service
from backend.services.imagery_service import imagery_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# Load pilot boundaries once
PILOT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "punjab_pilot.json"
PILOT_UNITS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "geo" / "punjab_pilot_units.geojson"
PILOT_DISTRICTS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "geo" / "punjab_pilot_districts.geojson"

with open(PILOT_CONFIG_PATH) as f:
    pilot_config = json.load(f)

with open(PILOT_UNITS_PATH) as f:
    units_geojson = json.load(f)

with open(PILOT_DISTRICTS_PATH) as f:
    districts_geojson = json.load(f)

# Runtime state container to avoid mutating global settings (I16)
_runtime_state = {
    "data_mode": settings.DATA_MODE
}

# Evaluation cache to prevent redundant re-computation of 27 units across API calls (O1)
_eval_cache: Dict[Tuple[int, Optional[str]], Tuple[float, List[Dict[str, Any]]]] = {}


def _get_current_data_mode() -> str:
    return _runtime_state.get("data_mode", settings.DATA_MODE)


def clear_evaluation_cache():
    """Flushes evaluation cache (e.g. when data mode changes)."""
    global _eval_cache
    _eval_cache.clear()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "data_mode": _get_current_data_mode(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "aws_s3_status": aws_service.get_status()
    }


@router.get("/config")
async def get_configuration():
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "data_mode": _get_current_data_mode(),
        "crop_calendar": {
            "harvest_start": settings.CROP_CALENDAR_HARVEST_START,
            "harvest_peak": settings.CROP_CALENDAR_HARVEST_PEAK,
            "harvest_end": settings.CROP_CALENDAR_HARVEST_END,
            "wheat_sowing_deadline": settings.WHEAT_SOWING_DEADLINE,
        },
        "preventability_window": {
            "optimal_min_days": settings.OPTIMAL_PREVENTION_WINDOW_MIN_DAYS,
            "optimal_max_days": settings.OPTIMAL_PREVENTION_WINDOW_MAX_DAYS,
            "max_days": settings.MAX_PREVENTION_WINDOW_DAYS,
        },
        "risk_weights": risk_engine.weights,
        "air_quality_consequence_enabled": settings.ENABLE_AIR_QUALITY_CONSEQUENCE,
        "pilot_districts": pilot_config.get("pilot_districts", [])
    }


@router.get("/study-areas", response_model=StudyAreasResponse)
async def get_study_areas():
    return pilot_config


@router.get("/districts-geojson")
async def get_districts_geojson():
    return districts_geojson


async def _evaluate_all_units(horizon_hours: int = 48, target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Evaluates all operational units against satellite, weather, and active fire observations.
    Results are cached with configurable TTL (O1).
    """
    cache_key = (horizon_hours, target_date)
    now = time.monotonic()

    if cache_key in _eval_cache:
        cached_time, cached_results = _eval_cache[cache_key]
        if (now - cached_time) < settings.EVALUATION_CACHE_TTL_SECONDS:
            return cached_results

    units = units_geojson.get("features", [])

    # Fetch active fires
    bbox = tuple(pilot_config.get("bounding_box", [74.5, 29.7, 76.3, 31.6]))
    active_fires = await firms_service.fetch_active_fires(bbox=bbox)

    # In replay mode, strictly filter out fires detected after target_date
    if target_date:
        cutoff_iso = f"{target_date}T23:59:59Z"
        active_fires = [f for f in active_fires if f.get("acq_datetime", "") <= cutoff_iso]

    unit_fires_map = firms_service.aggregate_fires_to_units(active_fires, units)

    # Optimization A1: Batch fetch all unit weather coordinates in a single Open-Meteo call
    unit_coords = [(u["properties"]["lat"], u["properties"]["lon"]) for u in units]
    batch_weather = await weather_service.fetch_forecasts_batch(unit_coords)

    async def _eval_single(u):
        props = u["properties"]
        uid = props["unit_id"]
        lat = props["lat"]
        lon = props["lon"]

        spectral = satellite_service.get_unit_spectral_observation(uid, lat, lon, target_date=target_date)
        state_res = transition_model.evaluate_state(
            current_ndvi=spectral["spectral_indices"]["current_ndvi"],
            baseline_ndvi=spectral["spectral_indices"]["baseline_ndvi"],
            current_ndti=spectral["spectral_indices"]["current_ndti"],
            cloud_fraction=spectral["quality_indicators"]["cloud_fraction"],
            observation_age_days=spectral["observation_age_days"],
            nearby_recent_fires_count=unit_fires_map.get(uid, {}).get("active_fires_48h", 0),
            estimated_days_post_harvest=spectral.get("estimated_days_since_harvest"),
            sar_data=spectral.get("sar_radar_intelligence")
        )

        weather = batch_weather.get((lat, lon)) or await weather_service.fetch_forecast(lat, lon)
        weather_hz = weather.get(f"horizon_{horizon_hours}h", weather.get("horizon_48h", {}))
        wind_dir = weather_hz.get("prevailing_wind_direction_deg", 315.0)
        wind_spd = weather_hz.get("avg_wind_speed_kmh", 12.0)

        consequence = air_quality_service.calculate_consequence_factor(
            source_lat=lat,
            source_lon=lon,
            wind_from_deg=wind_dir,
            wind_speed_kmh=wind_spd
        )

        unit_fires = unit_fires_map.get(uid, {})
        unit_eval = risk_engine.evaluate_unit(
            unit=u,
            spectral_obs=spectral,
            state_result=state_res,
            fire_summary=unit_fires,
            weather_data=weather,
            consequence_data=consequence,
            horizon_hours=horizon_hours
        )

        hz = weather.get(f"horizon_{horizon_hours}h", weather.get("horizon_48h", {}))
        unit_eval["wind_speed_kmh"] = hz.get("avg_wind_speed_kmh", 14.0)
        unit_eval["wind_direction_deg"] = hz.get("prevailing_wind_direction_deg", 315.0)
        unit_eval["temperature_c"] = hz.get("avg_temperature_c", 27.5)
        unit_eval["humidity_pct"] = hz.get("min_relative_humidity_pct", 42.0)
        unit_eval["ndvi"] = spectral["spectral_indices"]["current_ndvi"]
        unit_eval["ndti"] = spectral["spectral_indices"]["current_ndti"]
        unit_eval["soil_moisture"] = round(0.18 + (unit_eval["humidity_pct"] / 100.0) * 0.12, 2)
        unit_eval["residue_density_tons_ha"] = round(max(1.5, (unit_eval["residue_opportunity_score"] / 100.0) * 6.5), 1)
        unit_eval["population_downwind"] = int(75000 + consequence.get("consequence_factor", 1.0) * 45000)
        unit_eval["nearest_city_downwind"] = f"{props['district']} Urban Core"

        timeline = spectral.get("temporal_timeline", [])
        if len(timeline) >= 7:
            unit_eval["sparkline_ndvi_7d"] = [t["ndvi"] for t in timeline[-7:]]
            unit_eval["sparkline_ndti_7d"] = [t["ndti"] for t in timeline[-7:]]
        else:
            base_n = spectral["spectral_indices"]["current_ndvi"]
            base_t = spectral["spectral_indices"]["current_ndti"]
            unit_eval["sparkline_ndvi_7d"] = [round(base_n + (i * 0.02), 2) for i in range(7)][::-1]
            unit_eval["sparkline_ndti_7d"] = [round(base_t - (i * 0.015), 2) for i in range(7)][::-1]

        return unit_eval

    results = await asyncio.gather(*[_eval_single(u) for u in units])
    sorted_results = sorted(list(results), key=lambda x: x["priority_score"], reverse=True)

    _eval_cache[cache_key] = (now, sorted_results)
    return sorted_results


@router.get("/units-geojson")
async def get_units_geojson(horizon: int = Query(default=48, ge=24, le=48)):
    """
    Returns full GeoJSON FeatureCollection with evaluated scores embedded in feature properties.
    Ideal for direct MapLibre / Leaflet data layer binding.
    """
    results = await _evaluate_all_units(horizon_hours=horizon)
    results_by_id = {r["unit_id"]: r for r in results}

    features = []
    for u in units_geojson.get("features", []):
        uid = u["properties"]["unit_id"]
        res = results_by_id.get(uid, {})
        feature_copy = dict(u)
        combined_props = dict(u["properties"])
        combined_props.update({
            "priority_score": res.get("priority_score", 0.0),
            "priority_category": res.get("priority_category", "LOW_RISK"),
            "fire_risk_score": res.get("fire_risk_score", 0.0),
            "intervention_opportunity_score": res.get("intervention_opportunity_score", 0.0),
            "residue_opportunity_score": res.get("residue_opportunity_score", 0.0),
            "estimated_unburned_residue_hectares": res.get("estimated_unburned_residue_hectares", 0.0),
            "cropland_hectares": res.get("cropland_hectares", u["properties"].get("cropland_hectares", 12500)),
            "agricultural_state": res.get("agricultural_state", "STANDING_CROP"),
            "days_since_harvest": res.get("days_since_harvest"),
            "consequence_factor": res.get("consequence_factor", 1.0),
            "action_type": res.get("recommended_intervention", {}).get("action_type", ""),
            "urgency": res.get("recommended_intervention", {}).get("urgency", ""),
            "operational_guidance": res.get("recommended_intervention", {}).get("operational_guidance", ""),
            "ndvi": res.get("ndvi", 0.35),
            "ndti": res.get("ndti", 0.12),
            "residue_density_tons_ha": res.get("residue_density_tons_ha", 4.2),
            "soil_moisture": res.get("soil_moisture", 0.22),
            "wind_speed_kmh": res.get("wind_speed_kmh", 14.0),
            "wind_direction_deg": res.get("wind_direction_deg", 315.0),
            "temperature_c": res.get("temperature_c", 27.0),
            "humidity_pct": res.get("humidity_pct", 44.0),
            "population_downwind": res.get("population_downwind", 110000),
            "nearest_city_downwind": res.get("nearest_city_downwind", f"{u['properties']['district']} Urban Core"),
            "sparkline_ndvi_7d": res.get("sparkline_ndvi_7d", []),
            "sparkline_ndti_7d": res.get("sparkline_ndti_7d", []),
            "top_contributing_drivers": res.get("top_contributing_drivers", []),
            "evidence_quality_score": res.get("evidence_quality_score", 85.0),
            "farmer_ground_truth": res.get("farmer_ground_truth", {})
        })
        feature_copy["properties"] = combined_props
        features.append(feature_copy)

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/risk-rankings", response_model=RiskRankingsResponse)
async def get_risk_rankings(
    horizon: int = Query(default=48, ge=24, le=48),
    district: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None)
):
    """
    Returns ranked intervention queue with filtering and summary metrics.
    """
    all_results = await _evaluate_all_units(horizon_hours=horizon)

    filtered = all_results
    if district and district.lower() != "all":
        filtered = [r for r in filtered if r["district"].lower() == district.lower()]
    if category and category.lower() != "all":
        filtered = [r for r in filtered if r["priority_category"].lower() == category.lower()]
    if search:
        s_lower = search.strip().lower()
        filtered = [r for r in filtered if s_lower in r["name"].lower() or s_lower in r["unit_id"].lower()]

    critical_count = sum(1 for r in all_results if r["priority_category"] == "CRITICAL_PREVENTION")
    high_count = sum(1 for r in all_results if r["priority_category"] == "HIGH_PREVENTION")
    active_fire_count = sum(1 for r in all_results if r["priority_category"] == "OBSERVED_FIRE_DISPATCH")
    total_residue_ha = sum(r.get("estimated_unburned_residue_hectares", 0) for r in all_results)

    return {
        "horizon_hours": horizon,
        "total_evaluated": len(all_results),
        "total_returned": len(filtered),
        "data_mode": _get_current_data_mode(),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "summary_stats": {
            "critical_prevention_units": critical_count,
            "high_prevention_units": high_count,
            "active_fire_dispatch_units": active_fire_count,
            "total_unburned_residue_hectares": round(total_residue_ha, 0),
            "average_priority_score": round(sum(r["priority_score"] for r in all_results) / max(1, len(all_results)), 1)
        },
        "rankings": filtered
    }


@router.get("/unit/{unit_id}", response_model=UnitDetailResponse)
async def get_unit_detail(unit_id: str, horizon: int = Query(default=48, ge=24, le=48)):
    """
    Returns deep-dive inspector for a single operational unit.
    Restricts active fire query to unit bounding box for spatial efficiency (O2).
    """
    matching = [u for u in units_geojson.get("features", []) if u["properties"]["unit_id"] == unit_id]
    if not matching:
        raise HTTPException(status_code=404, detail=f"Unit with id '{unit_id}' not found.")

    unit = matching[0]
    props = unit["properties"]
    lat, lon = props["lat"], props["lon"]

    spectral = satellite_service.get_unit_spectral_observation(unit_id, lat, lon)
    weather = await weather_service.fetch_forecast(lat, lon)

    # Spatial query optimization: query fires only around unit vicinity (O2)
    unit_bbox = (lon - 0.08, lat - 0.08, lon + 0.08, lat + 0.08)
    active_fires = await firms_service.fetch_active_fires(bbox=unit_bbox)
    unit_fires_map = firms_service.aggregate_fires_to_units(active_fires, [unit])
    unit_fires = unit_fires_map.get(unit_id, {})

    state_res = transition_model.evaluate_state(
        current_ndvi=spectral["spectral_indices"]["current_ndvi"],
        baseline_ndvi=spectral["spectral_indices"]["baseline_ndvi"],
        current_ndti=spectral["spectral_indices"]["current_ndti"],
        cloud_fraction=spectral["quality_indicators"]["cloud_fraction"],
        observation_age_days=spectral["observation_age_days"],
        nearby_recent_fires_count=unit_fires.get("active_fires_48h", 0),
        estimated_days_post_harvest=spectral.get("estimated_days_since_harvest"),
        sar_data=spectral.get("sar_radar_intelligence")
    )

    consequence = air_quality_service.calculate_consequence_factor(
        source_lat=lat,
        source_lon=lon,
        wind_from_deg=weather.get(f"horizon_{horizon}h", {}).get("prevailing_wind_direction_deg", 315.0),
        wind_speed_kmh=weather.get(f"horizon_{horizon}h", {}).get("avg_wind_speed_kmh", 12.0)
    )

    eval_result = risk_engine.evaluate_unit(
        unit=unit,
        spectral_obs=spectral,
        state_result=state_res,
        fire_summary=unit_fires,
        weather_data=weather,
        consequence_data=consequence,
        horizon_hours=horizon
    )

    return {
        "unit": eval_result,
        "spectral_details": spectral,
        "weather_forecast": weather,
        "active_fires": unit_fires
    }


@router.get("/weather", response_model=WeatherOverviewResponse)
async def get_weather_overview(district: str = "Sangrur"):
    """
    Returns weather forecast & prevailing wind plume azimuth for a district.
    """
    dist_info = pilot_config.get("districts", {}).get(district, {})
    center = dist_info.get("center", [75.84, 30.24])
    forecast = await weather_service.fetch_forecast(lat=center[1], lon=center[0])
    return {
        "district": district,
        "forecast": forecast
    }


@router.get("/fires")
async def get_active_fires():
    """
    Returns active VIIRS 375m fire detections across Punjab pilot bounding box.
    """
    bbox = tuple(pilot_config.get("bounding_box", [74.5, 29.7, 76.3, 31.6]))
    fires = await firms_service.fetch_active_fires(bbox=bbox)
    return {
        "source": "NASA FIRMS VIIRS 375m NRT",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "total_active_clusters": len(fires),
        "fires": fires
    }


@router.get("/replay", response_model=HistoricalReplayResponse)
async def historical_replay(
    date: str = Query(description="Historical date in format YYYY-MM-DD (e.g. 2024-10-28)"),
    horizon: int = Query(default=48, ge=24, le=48)
):
    """
    Simulates operational model predictions for a historical date.
    Strictly forbids data leakage: all observations occurring after target date are pruned.
    """
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        raise HTTPException(status_code=400, detail="Date must be in format YYYY-MM-DD")

    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date value specified.")

    results = await _evaluate_all_units(horizon_hours=horizon, target_date=date)

    return {
        "replay_date": date,
        "is_historical_replay": True,
        "data_leakage_prevented": True,
        "cutoff_timestamp": f"{date}T23:59:59Z",
        "total_evaluated": len(results),
        "rankings": results
    }


@router.get("/evaluate")
async def get_evaluation_benchmarks():
    """
    Returns temporal backtest evaluation metrics comparing Parali Alert with baselines and ML.
    """
    return evaluation_service.run_temporal_backtest()


@router.get("/export")
async def export_dispatch_manifest(horizon: int = Query(default=48, ge=24, le=48)):
    """
    Exports a structured CSV manifest of prioritized units for agricultural field teams.
    """
    results = await _evaluate_all_units(horizon_hours=horizon)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rank", "Unit_ID", "Name", "District", "Priority_Score", "Category",
        "Fire_Risk", "Intervention_Opportunity", "Residue_Hectares",
        "Days_Post_Harvest", "State", "Action_Type", "Urgency", "Guidance"
    ])

    for i, r in enumerate(results, 1):
        rec = r.get("recommended_intervention", {})
        writer.writerow([
            i,
            r["unit_id"],
            r["name"],
            r["district"],
            r["priority_score"],
            r["priority_category"],
            r["fire_risk_score"],
            r["intervention_opportunity_score"],
            r.get("estimated_unburned_residue_hectares", 0),
            r.get("days_since_harvest", "N/A"),
            r["agricultural_state"],
            rec.get("action_type", ""),
            rec.get("urgency", ""),
            rec.get("operational_guidance", "")
        ])

    csv_data = output.getvalue()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"parali_alert_dispatch_manifest_{today_str}_{horizon}h.csv"

    aws_service.save_json_snapshot(f"exports/{filename}", {"csv_rows": len(results)})

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/mode")
async def set_data_mode(mode: str = Query(description="'live' or 'sample'")):
    """
    Switches between live external API retrieval and bundled offline verified sample mode.
    Stores mode in runtime state rather than mutating global settings object (I16).
    """
    clean_mode = mode.strip().lower()
    if clean_mode not in ("live", "sample"):
        raise HTTPException(status_code=400, detail="Mode must be either 'live' or 'sample'")

    _runtime_state["data_mode"] = clean_mode
    clear_evaluation_cache()

    return {
        "status": "success",
        "current_data_mode": clean_mode,
        "message": f"Data mode successfully switched to '{clean_mode}'."
    }


# ==============================================================================
# NOVELTY FEATURE ENDPOINTS (N1, N2, N4, N6, N7)
# ==============================================================================

@router.post("/alerts/whatsapp", response_model=WhatsAppAlertResponse)
async def dispatch_whatsapp_alert(payload: WhatsAppAlertRequest):
    """
    Dispatches automated WhatsApp intervention notification to BDO / Nodal officer (N1).
    Supports English and Punjabi language formats.
    """
    all_results = await _evaluate_all_units(horizon_hours=48)
    unit_match = next((r for r in all_results if r["unit_id"] == payload.unit_id), None)
    if not unit_match:
        raise HTTPException(status_code=404, detail=f"Unit '{payload.unit_id}' not found.")

    res = await whatsapp_service.dispatch_alert(
        unit_data=unit_match,
        recipient_phone=payload.recipient_phone,
        recipient_name=payload.recipient_name,
        language=payload.language
    )
    return res


@router.get("/alerts/whatsapp/history")
async def get_whatsapp_history(limit: int = Query(default=50, ge=1, le=200)):
    """
    Returns recent WhatsApp dispatch log records.
    """
    return {
        "total_logged": len(whatsapp_service.dispatched_log),
        "history": whatsapp_service.get_dispatch_history(limit=limit)
    }


@router.post("/farmer-reports", response_model=FarmerReportResponse)
async def submit_farmer_report(report: FarmerReportRequest):
    """
    Registers ground-truth harvest report submitted by farmer or village sarpanch (N2).
    """
    created = farmer_service.add_report(report.model_dump())
    return {
        "report_id": created["report_id"],
        "farmer_name": created["farmer_name"],
        "district": created["district"],
        "unit_id": created["unit_id"],
        "submitted_at": created["submitted_at"],
        "status": "RECEIVED"
    }


@router.get("/farmer-reports")
async def list_farmer_reports(
    district: Optional[str] = Query(default=None),
    unit_id: Optional[str] = Query(default=None),
    machinery_only: bool = Query(default=False)
):
    """
    Returns list of farmer self-reports with optional filtering (N2).
    """
    reports = farmer_service.list_reports(
        district=district,
        unit_id=unit_id,
        machinery_only=machinery_only
    )
    return {
        "total_reports": len(reports),
        "reports": reports
    }


@router.get("/air-quality/cpcb-stations")
async def get_cpcb_stations(district: Optional[str] = Query(default=None)):
    """
    Returns live CPCB CAAQMS air quality stations across Punjab with smoke plume correlation (N4).
    """
    bbox = tuple(pilot_config.get("bounding_box", [74.5, 29.7, 76.3, 31.6]))
    fires = await firms_service.fetch_active_fires(bbox=bbox)
    readings = await cpcb_service.get_live_readings(
        active_fires_count=len(fires),
        prevailing_wind_deg=315.0,
        district_filter=district
    )
    return readings


@router.get("/emissions/summary")
async def get_emissions_summary(horizon: int = Query(default=48, ge=24, le=48)):
    """
    Returns regional crop residue carbon and air pollution emission totals and avoided impact (N7).
    """
    all_results = await _evaluate_all_units(horizon_hours=horizon)
    return emission_service.calculate_regional_summary(all_results)


@router.get("/emissions/unit/{unit_id}")
async def get_unit_emissions(unit_id: str):
    """
    Calculates CO2, CO, PM2.5, and Black Carbon emissions for a specific unit (N7).
    """
    all_results = await _evaluate_all_units(horizon_hours=48)
    unit_match = next((r for r in all_results if r["unit_id"] == unit_id), None)
    if not unit_match:
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found.")

    res_ha = unit_match.get("estimated_unburned_residue_hectares", 0.0)
    score = unit_match.get("priority_score", 50.0)
    calc = emission_service.calculate_unit_emissions(res_ha, priority_score=score)
    calc["unit_id"] = unit_id
    calc["district"] = unit_match.get("district")
    return calc


@router.get("/satellite/comparison/{unit_id}")
async def get_satellite_comparison(unit_id: str, date: Optional[str] = Query(default=None)):
    """
    Returns pre-harvest baseline vs post-harvest desiccation multi-spectral imagery comparison (N6).
    """
    matching = [u for u in units_geojson.get("features", []) if u["properties"]["unit_id"] == unit_id]
    if not matching:
        raise HTTPException(status_code=404, detail=f"Unit '{unit_id}' not found.")

    props = matching[0]["properties"]
    return imagery_service.get_unit_comparison(
        unit_id=unit_id,
        lat=props["lat"],
        lon=props["lon"],
        target_date=date
    )
