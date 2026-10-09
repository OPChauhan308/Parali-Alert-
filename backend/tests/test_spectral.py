"""
Unit Tests for Spectral Index & Cloud Masking Calculations.
"""

import numpy as np
import pytest
from backend.services.spectral import (
    calculate_ndvi,
    calculate_ndti,
    calculate_sti,
    create_cloud_mask_from_scl,
    summarize_spectral_patch
)


def test_ndvi_values():
    # NIR high, Red low -> dense green canopy
    nir = np.array([0.8, 0.7, 0.6])
    red = np.array([0.1, 0.1, 0.2])
    ndvi = calculate_ndvi(nir, red)
    assert np.all(ndvi > 0.5)
    assert np.all(ndvi <= 1.0)

    # Post-harvest / bare soil: NIR and Red closer
    nir_harvested = np.array([0.22, 0.25])
    red_harvested = np.array([0.18, 0.20])
    ndvi_harvested = calculate_ndvi(nir_harvested, red_harvested)
    assert np.all(ndvi_harvested < 0.20)


def test_ndti_residue_sensitivity():
    # Dry crop residue has higher SWIR1 (B11) than SWIR2 (B12) due to lignin/cellulose
    swir1_straw = np.array([0.35, 0.40])
    swir2_straw = np.array([0.25, 0.28])
    ndti_straw = calculate_ndti(swir1_straw, swir2_straw)
    assert np.all(ndti_straw > 0.10)

    # Bare wet soil or ash: SWIR1 and SWIR2 equal or reversed
    swir1_ash = np.array([0.15, 0.12])
    swir2_ash = np.array([0.18, 0.16])
    ndti_ash = calculate_ndti(swir1_ash, swir2_ash)
    assert np.all(ndti_ash < 0.0)


def test_scl_cloud_mask():
    # SCL classes: 4 (vegetation), 8 (cloud med), 9 (cloud high), 3 (shadow)
    scl = np.array([4, 5, 8, 9, 3, 4])
    mask = create_cloud_mask_from_scl(scl)
    # Mask should be True for 8, 9, 3 and False for 4, 5
    assert np.array_equal(mask, np.array([False, False, True, True, True, False]))


def test_summarize_spectral_patch():
    red = np.ones((10, 10)) * 0.15
    nir = np.ones((10, 10)) * 0.30
    swir1 = np.ones((10, 10)) * 0.35
    swir2 = np.ones((10, 10)) * 0.25
    scl = np.ones((10, 10)) * 4  # Valid vegetation

    summary = summarize_spectral_patch(red, nir, swir1, swir2, scl)
    assert summary["mean_ndvi"] > 0.3
    assert summary["mean_ndti"] > 0.1
    assert summary["cloud_fraction"] == 0.0
    assert not summary["is_cloud_contaminated"]
