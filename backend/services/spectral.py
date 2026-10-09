"""
Spectral Index Calculation & Cloud Masking Module for Sentinel-2 MSI L2A.
Supports:
- NDVI (Normalized Difference Vegetation Index)
- NDTI (Normalized Difference Tillage Index - SWIR residue detection)
- STI (Soil Tillage Index)
- NBR2 (Normalized Burn Ratio 2)
- SCL (Scene Classification Layer) cloud/shadow masking
"""

import numpy as np
from typing import Tuple, Dict, Any, Optional


def calculate_ndvi(b08_nir: np.ndarray, b04_red: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Normalized Difference Vegetation Index (NDVI).
    NDVI = (NIR - Red) / (NIR + Red)
    Scale: -1.0 to +1.0. Healthy standing crops typically > 0.5; harvested/stubble fields < 0.25.
    """
    nir = b08_nir.astype(np.float32)
    red = b04_red.astype(np.float32)
    denom = nir + red
    denom = np.where(denom == 0, eps, denom)
    ndvi = (nir - red) / denom
    return np.clip(ndvi, -1.0, 1.0)


def calculate_ndti(b11_swir1: np.ndarray, b12_swir2: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Normalized Difference Tillage Index (NDTI).
    NDTI = (SWIR1 - SWIR2) / (SWIR1 + SWIR2)
    Sentinel-2 Band 11 (~1610nm) and Band 12 (~2190nm).
    Sensitive to cellulose and lignin absorption in dry crop residue (paddy straw).
    Positive values (0.05 to 0.30) indicate elevated crop residue presence on soil.
    """
    swir1 = b11_swir1.astype(np.float32)
    swir2 = b12_swir2.astype(np.float32)
    denom = swir1 + swir2
    denom = np.where(denom == 0, eps, denom)
    ndti = (swir1 - swir2) / denom
    return np.clip(ndti, -1.0, 1.0)


def calculate_sti(b11_swir1: np.ndarray, b12_swir2: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Soil Tillage Index (STI).
    STI = SWIR1 / SWIR2
    Values > 1.15 correlate with dry residue cover.
    """
    swir1 = b11_swir1.astype(np.float32)
    swir2 = np.where(b12_swir2 == 0, eps, b12_swir2.astype(np.float32))
    return np.clip(swir1 / swir2, 0.0, 5.0)


def calculate_nbr2(b11_swir1: np.ndarray, b12_swir2: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Normalized Burn Ratio 2 (NBR2).
    NBR2 = (SWIR1 - SWIR2) / (SWIR1 + SWIR2)
    Useful for distinguishing post-fire ash/char from dry straw residue.
    """
    return calculate_ndti(b11_swir1, b12_swir2, eps=eps)


def create_cloud_mask_from_scl(scl: np.ndarray) -> np.ndarray:
    """
    Generates a boolean mask from Sentinel-2 Scene Classification Layer (SCL).
    True indicates INVALID pixel (cloud, cloud shadow, thin cirrus, saturated, or no data).
    SCL Class definitions:
      0: NO_DATA (Invalid)
      1: SATURATED_OR_DEFECTIVE (Invalid)
      2: DARK_AREA_PIXELS (Valid / Caution)
      3: CLOUD_SHADOWS (Invalid)
      4: VEGETATION (Valid)
      5: NOT_VEGETATED / SOIL (Valid)
      6: WATER (Valid)
      7: UNCLASSIFIED (Valid / Caution)
      8: CLOUD_MEDIUM_PROBABILITY (Invalid)
      9: CLOUD_HIGH_PROBABILITY (Invalid)
      10: THIN_CIRRUS (Invalid)
      11: SNOW_OR_ICE (Valid)
    """
    invalid_classes = {0, 1, 3, 8, 9, 10}
    mask = np.isin(scl, list(invalid_classes))
    return mask


def summarize_spectral_patch(
    b04_red: np.ndarray,
    b08_nir: np.ndarray,
    b11_swir1: np.ndarray,
    b12_swir2: np.ndarray,
    scl: Optional[np.ndarray] = None
) -> Dict[str, float]:
    """
    Calculates aggregated spectral features and cloud statistics over a spatial patch.
    Applies cloud mask if SCL is provided.
    """
    total_pixels = b04_red.size
    if scl is not None:
        cloud_mask = create_cloud_mask_from_scl(scl)
        cloud_pixels = int(np.sum(cloud_mask))
        cloud_fraction = float(cloud_pixels / total_pixels) if total_pixels > 0 else 1.0
        valid_mask = ~cloud_mask
    else:
        valid_mask = np.ones_like(b04_red, dtype=bool)
        cloud_fraction = 0.0

    valid_count = int(np.sum(valid_mask))
    if valid_count == 0 or cloud_fraction > 0.85:
        return {
            "mean_ndvi": 0.0,
            "mean_ndti": 0.0,
            "mean_sti": 1.0,
            "cloud_fraction": round(cloud_fraction, 3),
            "valid_pixel_pct": 0.0,
            "is_cloud_contaminated": True
        }

    ndvi = calculate_ndvi(b08_nir[valid_mask], b04_red[valid_mask])
    ndti = calculate_ndti(b11_swir1[valid_mask], b12_swir2[valid_mask])
    sti = calculate_sti(b11_swir1[valid_mask], b12_swir2[valid_mask])

    return {
        "mean_ndvi": round(float(np.nanmean(ndvi)), 4),
        "mean_ndti": round(float(np.nanmean(ndti)), 4),
        "mean_sti": round(float(np.nanmean(sti)), 4),
        "cloud_fraction": round(cloud_fraction, 3),
        "valid_pixel_pct": round(float(valid_count / total_pixels) * 100.0, 1),
        "is_cloud_contaminated": bool(cloud_fraction > 0.40)
    }
