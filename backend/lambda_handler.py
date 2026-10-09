"""
AWS Lambda Serverless Handler for Parali Alert.
Triggered on a schedule by Amazon EventBridge (e.g., daily at 05:30 IST / 00:00 UTC)
to run the pre-fire intervention intelligence pipeline and persist results to Amazon S3.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from backend.services.satellite_service import satellite_service
from backend.services.state_engine import transition_model
from backend.services.weather_service import weather_service
from backend.services.firms_service import firms_service
from backend.services.air_quality_service import air_quality_service
from backend.services.risk_engine import risk_engine
from backend.services.aws_service import aws_service


def handler(event, context):
    """
    AWS Lambda entrypoint.
    """
    start_time = datetime.now(timezone.utc)
    print(f"[Parali Alert Lambda] Executing scheduled pre-fire assessment at {start_time.isoformat()}...")

    # Load pilot units GeoJSON
    units_path = Path(__file__).resolve().parent.parent / "data" / "geo" / "punjab_pilot_units.geojson"
    with open(units_path) as f:
        units_geojson = json.load(f)

    units = units_geojson.get("features", [])

    # Ingest fires
    # (In Lambda, async loop can be run or sync wrapper used)
    import asyncio
    loop = asyncio.get_event_loop()

    active_fires = loop.run_until_complete(firms_service.fetch_active_fires())
    unit_fires_map = firms_service.aggregate_fires_to_units(active_fires, units)

    results = []
    for u in units:
        props = u["properties"]
        uid = props["unit_id"]
        lat = props["lat"]
        lon = props["lon"]

        spectral = satellite_service.get_unit_spectral_observation(uid, lat, lon)
        state_res = transition_model.evaluate_state(
            current_ndvi=spectral["spectral_indices"]["current_ndvi"],
            baseline_ndvi=spectral["spectral_indices"]["baseline_ndvi"],
            current_ndti=spectral["spectral_indices"]["current_ndti"],
            cloud_fraction=spectral["quality_indicators"]["cloud_fraction"],
            observation_age_days=spectral["observation_age_days"]
        )

        weather = loop.run_until_complete(weather_service.fetch_forecast(lat, lon))
        wind_dir = weather.get("horizon_48h", {}).get("prevailing_wind_direction_deg", 315.0)
        wind_spd = weather.get("horizon_48h", {}).get("avg_wind_speed_kmh", 12.0)

        consequence = air_quality_service.calculate_consequence_factor(
            source_lat=lat,
            source_lon=lon,
            wind_from_deg=wind_dir,
            wind_speed_kmh=wind_spd
        )

        unit_fires = unit_fires_map.get(uid, {})
        eval_result = risk_engine.evaluate_unit(
            unit=u,
            spectral_obs=spectral,
            state_result=state_res,
            fire_summary=unit_fires,
            weather_data=weather,
            consequence_data=consequence,
            horizon_hours=48
        )
        results.append(eval_result)

    # Sort priority queue
    results_sorted = sorted(results, key=lambda x: x["priority_score"], reverse=True)

    today_str = start_time.strftime("%Y-%m-%d")
    s3_key = f"snapshots/{today_str}_daily_priority_assessment.json"

    payload = {
        "assessment_date": today_str,
        "generated_at": start_time.isoformat(),
        "total_units_evaluated": len(results_sorted),
        "critical_prevention_count": sum(1 for r in results_sorted if r["priority_category"] == "CRITICAL_PREVENTION"),
        "high_prevention_count": sum(1 for r in results_sorted if r["priority_category"] == "HIGH_PREVENTION"),
        "active_fire_dispatch_count": sum(1 for r in results_sorted if r["priority_category"] == "OBSERVED_FIRE_DISPATCH"),
        "top_units": results_sorted[:10],
        "all_units": results_sorted
    }

    s3_resp = aws_service.save_json_snapshot(s3_key, payload)
    print(f"[Parali Alert Lambda] Saved snapshot to: {s3_resp.get('uri')}")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Parali Alert scheduled assessment complete",
            "evaluated_units": len(results_sorted),
            "s3_uri": s3_resp.get("uri"),
            "critical_units": payload["critical_prevention_count"]
        })
    }
