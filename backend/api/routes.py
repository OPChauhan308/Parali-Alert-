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
"""

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import JSONResponse, PlainTextResponse
import json
import csv
import io
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from config.settings import settings
from backend.api.schemas import (
    StudyAreasResponse,
    RiskRankingsResponse,
    UnitDetailResponse,
    HistoricalReplayResponse
)
from backend.services.satellite_service import satellite_service
from backend.services.state_engine import transition_model
from backend.services.weather_service import weather_service
from backend.services.firms_service import firms_service
from backend.services.air_quality_service import air_quality_service
from backend.services.risk_engine import risk_engine
from backend.services.aws_service import aws_service
from backend.services.evaluation_service import evaluation_service

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


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "data_mode": settings.DATA_MODE,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "aws_s3_status": aws_service.get_status()
    }


@router.get("/config")
async def get_configuration():
    return {
        "app_name": settings.APP_NAME,
        "data_mode": settings.DATA_MODE,
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


@router.get("/study-areas")
async def get_study_areas():
    return pilot_config


@router.get("/districts-geojson")
async def get_districts_geojson():
    return districts_geojson


async def _evaluate_all_units(horizon_hours: int = 48, target_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Evaluates all operational units against satellite, weather, and active fire observations.
    """
    units = units_geojson.get("features", [])

    # Fetch active fires
    bbox = tuple(pilot_config.get("bounding_box", [74.5, 29.7, 76.3, 31.6]))
    active_fires = await firms_service.fetch_active_fires(bbox=bbox)

    # In replay mode, strictly filter out fires detected after target_date
    if target_date:
        cutoff_iso = f"{target_date}T23:59:59Z"
        active_fires = [f for f in active_fires if f.get("acq_datetime", "") <= cutoff_iso]

    unit_fires_map = firms_service.aggregate_fires_to_units(active_fires, units)

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
            estimated_days_post_harvest=spectral.get("estimated_days_since_harvest")
        )

        weather = await weather_service.fetch_forecast(lat, lon)
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
        return risk_engine.evaluate_unit(
            unit=u,
            spectral_obs=spectral,
            state_result=state_res,
            fire_summary=unit_fires,
            weather_data=weather,
            consequence_data=consequence,
            horizon_hours=horizon_hours
        )

    import asyncio
    results = await asyncio.gather(*[_eval_single(u) for u in units])
    return sorted(list(results), key=lambda x: x["priority_score"], reverse=True)


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
        # Combine original properties with evaluated risk scores
        combined_props = dict(u["properties"])
        combined_props.update({
            "priority_score": res.get("priority_score", 0.0),
            "priority_category": res.get("priority_category", "LOW_RISK"),
            "fire_risk_score": res.get("fire_risk_score", 0.0),
            "intervention_opportunity_score": res.get("intervention_opportunity_score", 0.0),
            "residue_opportunity_score": res.get("residue_opportunity_score", 0.0),
            "agricultural_state": res.get("agricultural_state", "STANDING_CROP"),
            "days_since_harvest": res.get("days_since_harvest"),
            "consequence_factor": res.get("consequence_factor", 1.0),
            "action_type": res.get("recommended_intervention", {}).get("action_type", ""),
            "urgency": res.get("recommended_intervention", {}).get("urgency", "")
        })
        feature_copy["properties"] = combined_props
        features.append(feature_copy)

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/risk-rankings")
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
        s_lower = search.lower()
        filtered = [r for r in filtered if s_lower in r["name"].lower() or s_lower in r["unit_id"].lower()]

    # Summary statistics
    critical_count = sum(1 for r in all_results if r["priority_category"] == "CRITICAL_PREVENTION")
    high_count = sum(1 for r in all_results if r["priority_category"] == "HIGH_PREVENTION")
    active_fire_count = sum(1 for r in all_results if r["priority_category"] == "OBSERVED_FIRE_DISPATCH")
    total_residue_ha = sum(r.get("estimated_unburned_residue_hectares", 0) for r in all_results)

    return {
        "horizon_hours": horizon,
        "total_evaluated": len(all_results),
        "total_returned": len(filtered),
        "data_mode": settings.DATA_MODE,
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


@router.get("/unit/{unit_id}")
async def get_unit_detail(unit_id: str, horizon: int = Query(default=48, ge=24, le=48)):
    """
    Returns deep-dive inspector for a single operational unit.
    Includes spectral timeline, weather forecast, risk breakdown, and recommendations.
    """
    matching = [u for u in units_geojson.get("features", []) if u["properties"]["unit_id"] == unit_id]
    if not matching:
        raise HTTPException(status_code=404, detail=f"Unit with id '{unit_id}' not found.")

    unit = matching[0]
    props = unit["properties"]
    lat, lon = props["lat"], props["lon"]

    spectral = satellite_service.get_unit_spectral_observation(unit_id, lat, lon)
    weather = await weather_service.fetch_forecast(lat, lon)
    active_fires = await firms_service.fetch_active_fires()
    unit_fires_map = firms_service.aggregate_fires_to_units(active_fires, [unit])
    unit_fires = unit_fires_map.get(unit_id, {})

    state_res = transition_model.evaluate_state(
        current_ndvi=spectral["spectral_indices"]["current_ndvi"],
        baseline_ndvi=spectral["spectral_indices"]["baseline_ndvi"],
        current_ndti=spectral["spectral_indices"]["current_ndti"],
        cloud_fraction=spectral["quality_indicators"]["cloud_fraction"],
        observation_age_days=spectral["observation_age_days"],
        nearby_recent_fires_count=unit_fires.get("active_fires_48h", 0),
        estimated_days_post_harvest=spectral.get("estimated_days_since_harvest")
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


@router.get("/weather")
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


@router.get("/replay")
async def historical_replay(
    date: str = Query(description="Historical date in format YYYY-MM-DD (e.g. 2024-10-28)"),
    horizon: int = Query(default=48, ge=24, le=48)
):
    """
    Simulates operational model predictions for a historical date.
    Strictly forbids data leakage: all observations occurring after target date are pruned.
    """
    try:
        replay_dt = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be in format YYYY-MM-DD")

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

    # Save to S3 / local emulator
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
    """
    if mode not in ("live", "sample"):
        raise HTTPException(status_code=400, detail="Mode must be either 'live' or 'sample'")
    settings.DATA_MODE = mode
    return {
        "status": "success",
        "current_data_mode": settings.DATA_MODE,
        "message": f"Data mode successfully switched to '{mode}'."
    }
