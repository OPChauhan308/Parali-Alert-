"""
Unit Tests for Preventability Window Logic and Operational Recommendations.
"""

from backend.services.risk_engine import risk_engine, PriorityCategory
from backend.services.state_engine import AgriculturalState


def test_active_fire_triggers_dispatch_not_prevention():
    unit = {
        "properties": {
            "unit_id": "TEST-FIRE",
            "name": "Active Fire Sector",
            "district": "Sangrur",
            "cropland_pct": 92.0,
            "area_sq_km": 60.0,
            "lat": 30.1,
            "lon": 75.8
        },
        "geometry": {}
    }
    spectral_obs = {
        "observation_age_days": 1.0,
        "spectral_indices": {"current_ndti": 0.05},
        "quality_indicators": {"cloud_fraction": 0.05}
    }
    state_result = {
        "state": AgriculturalState.RECENTLY_HARVESTED,
        "days_since_harvest": 3.0
    }
    # 2 active fires detected in last 24h
    fire_summary = {"active_fires_24h": 2, "active_fires_48h": 2, "active_fires_7d": 2}
    weather_data = {"is_live": True, "horizon_48h": {"fire_weather_index": 0.7}}
    consequence_data = {"consequence_factor": 1.1}

    res = risk_engine.evaluate_unit(
        unit=unit,
        spectral_obs=spectral_obs,
        state_result=state_result,
        fire_summary=fire_summary,
        weather_data=weather_data,
        consequence_data=consequence_data,
        horizon_hours=48
    )

    # Must be categorized as OBSERVED_FIRE_DISPATCH
    assert res["priority_category"] == PriorityCategory.OBSERVED_FIRE_DISPATCH
    assert res["recommended_intervention"]["action_type"] == "FIRE_RESPONSE_DISPATCH"
    assert "thermal anomaly active" in res["recommended_intervention"]["operational_guidance"].lower()


def test_heavy_cloud_cover_triggers_ground_verification():
    unit = {
        "properties": {
            "unit_id": "TEST-CLOUD",
            "name": "Cloudy Sector",
            "district": "Ludhiana",
            "cropland_pct": 88.0,
            "area_sq_km": 50.0,
            "lat": 30.8,
            "lon": 75.9
        },
        "geometry": {}
    }
    spectral_obs = {
        "observation_age_days": 2.0,
        "spectral_indices": {"current_ndti": 0.05},
        "quality_indicators": {"cloud_fraction": 0.65}  # 65% cloud cover
    }
    state_result = {
        "state": AgriculturalState.UNCERTAIN_UNOBSERVABLE,
        "days_since_harvest": None
    }
    fire_summary = {"active_fires_24h": 0, "active_fires_48h": 0, "active_fires_7d": 0}
    weather_data = {"is_live": True, "horizon_48h": {"fire_weather_index": 0.6}}
    consequence_data = {"consequence_factor": 1.0}

    res = risk_engine.evaluate_unit(
        unit=unit,
        spectral_obs=spectral_obs,
        state_result=state_result,
        fire_summary=fire_summary,
        weather_data=weather_data,
        consequence_data=consequence_data,
        horizon_hours=48
    )

    assert res["priority_category"] == PriorityCategory.UNCERTAIN_VERIFICATION
    assert res["recommended_intervention"]["action_type"] == "GROUND_VERIFICATION_SCOUTING"
