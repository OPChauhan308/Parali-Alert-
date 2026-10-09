"""
Tests for Novelty A (COG Range Ingestion) and Novelty B (Sentinel-1 SAR Radar Cloud Piercing).
"""

import pytest
import numpy as np
from backend.services.cog_service import cog_service
from backend.services.sar_service import sar_service
from backend.services.state_engine import transition_model, AgriculturalState


def test_sar_polarimetric_metrics():
    """Verify SAR calculations: cross-ratio, volume scattering, and SHTI index."""
    # Test standing crop signature
    standing_obs = sar_service.get_sar_observation("SAN-01", 30.24, 75.84, simulated_state="STANDING_CROP")
    b_coeffs = standing_obs["backscatter_coefficients_db"]
    assert b_coeffs["sigma0_vh_db"] > -18.0, "Standing crop should exhibit strong cross-pol volume scattering"
    assert b_coeffs["cross_ratio_db"] > -10.0, "Standing crop Cross-Ratio should exceed -10 dB"
    assert standing_obs["sar_inferred_state"] == "STANDING_CROP"

    # Test harvested stubble signature (volume scattering collapse)
    harvest_obs = sar_service.get_sar_observation("SAN-02", 30.37, 75.86, simulated_state="RECENTLY_HARVESTED")
    b_harvest = harvest_obs["backscatter_coefficients_db"]
    assert b_harvest["sigma0_vh_db"] <= -20.0, "Harvested stubble should show sharp drop in cross-pol VH backscatter"
    assert b_harvest["cross_ratio_db"] <= -11.0, "Harvested stubble Cross-Ratio should plunge below -11 dB"
    assert harvest_obs["polarimetric_metrics"]["canopy_depletion_pct"] > 70.0


def test_sar_cloud_piercing_resolves_uncertainty():
    """Verify that Sentinel-1 C-band SAR pierces dense optical cloud cover."""
    optical_cloudy = {
        "agricultural_state": "UNCERTAIN_UNOBSERVABLE",
        "quality_indicators": {
            "cloud_cover_pct": 68.0,  # Heavily clouded optical scene
            "is_cloud_contaminated": True
        },
        "spectral_indices": {
            "current_ndvi": 0.38,
            "baseline_ndvi": 0.72,
            "current_ndti": 0.05
        }
    }

    # Evaluate through SAR service
    piercing_result = sar_service.evaluate_cloud_piercing_and_fusion(
        optical_spectral=optical_cloudy,
        unit_id="SAN-03",
        lat=30.13,
        lon=75.80
    )

    assert piercing_result["mode"] == "SAR_CLOUD_PIERCING_ACTIVE"
    assert piercing_result["cloud_penetrated"] is True
    assert piercing_result["resolution_status"] == "SAR_RADAR_VERIFIED"
    assert piercing_result["confidence_score"] > 80.0

    # Verify through state engine
    state_res = transition_model.evaluate_state(
        current_ndvi=0.38,
        baseline_ndvi=0.72,
        current_ndti=0.05,
        cloud_fraction=0.68,
        observation_age_days=2.0,
        sar_data=piercing_result
    )

    # Must NOT be UNCERTAIN_UNOBSERVABLE anymore!
    assert state_res["state"] != AgriculturalState.UNCERTAIN_UNOBSERVABLE
    assert "sar_penetration" in state_res
    assert state_res["sar_penetration"]["is_pierced"] is True


def test_sar_dual_sensor_fusion_on_clear_days():
    """Verify optical NDTI + SAR volume scattering fusion under clear skies."""
    optical_clear = {
        "agricultural_state": "RECENTLY_HARVESTED",
        "quality_indicators": {
            "cloud_cover_pct": 8.0,
            "is_cloud_contaminated": False
        },
        "spectral_indices": {
            "current_ndvi": 0.22,
            "baseline_ndvi": 0.70,
            "current_ndti": 0.14  # High chemical cellulose absorption
        }
    }

    fusion_result = sar_service.evaluate_cloud_piercing_and_fusion(
        optical_spectral=optical_clear,
        unit_id="SAN-04",
        lat=30.27,
        lon=76.04
    )

    assert fusion_result["mode"] == "DUAL_SENSOR_OPTICAL_SAR_FUSION"
    assert fusion_result["confidence_score"] >= 90.0


def test_cog_service_configuration():
    """Verify COG Range Request service settings and bounding calculations."""
    assert cog_service.enabled is True
    assert cog_service.buffer_deg == 0.015
    assert cog_service.scale_factor == 10000.0
