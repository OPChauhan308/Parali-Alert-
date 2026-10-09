"""
Unit Tests for Risk Engine Calculations, Weights, and Score Normalization.
"""

import pytest
from backend.services.risk_engine import risk_engine, PriorityCategory
from backend.services.state_engine import AgriculturalState


def test_weights_sum_to_one():
    total_weight = sum(risk_engine.weights.values())
    assert abs(total_weight - 1.0) < 1e-4


def test_score_bounded_between_zero_and_hundred():
    unit = {
        "properties": {
            "unit_id": "TEST-01",
            "name": "Test Block",
            "district": "Sangrur",
            "cropland_pct": 90.0,
            "area_sq_km": 50.0,
            "lat": 30.2,
            "lon": 75.8
        },
        "geometry": {}
    }
    spectral_obs = {
        "observation_age_days": 2.0,
        "spectral_indices": {"current_ndti": 0.15},
        "quality_indicators": {"cloud_fraction": 0.05}
    }
    state_result = {
        "state": AgriculturalState.RECENTLY_HARVESTED,
        "days_since_harvest": 4.0
    }
    fire_summary = {"active_fires_24h": 0, "active_fires_48h": 0, "active_fires_7d": 1}
    weather_data = {
        "is_live": True,
        "horizon_48h": {"fire_weather_index": 0.8}
    }
    consequence_data = {"consequence_factor": 1.2}

    res = risk_engine.evaluate_unit(
        unit=unit,
        spectral_obs=spectral_obs,
        state_result=state_result,
        fire_summary=fire_summary,
        weather_data=weather_data,
        consequence_data=consequence_data,
        horizon_hours=48
    )

    assert 0.0 <= res["priority_score"] <= 100.0
    assert 0.0 <= res["fire_risk_score"] <= 100.0
    assert 0.0 <= res["intervention_opportunity_score"] <= 100.0
    assert 0.0 <= res["residue_opportunity_score"] <= 100.0
    assert len(res["top_contributing_drivers"]) == 3
    assert res["recommended_intervention"]["action_type"] in [
        "PRIORITY_CRM_MACHINERY_DEPLOYMENT",
        "RESIDUE_MANAGEMENT_OUTREACH",
        "MONITOR_AND_SOWING_AWARENESS"
    ]
