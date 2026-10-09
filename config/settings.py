"""
Parali Alert Configuration Module.
Provides centralized, strongly typed, environment-driven configuration
for data pipelines, risk engines, weather modeling, and AWS integration.
"""

from typing import Dict, Any, List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
GEO_DATA_DIR = DATA_DIR / "geo"
SAMPLE_DATA_DIR = DATA_DIR / "sample"
HISTORICAL_DATA_DIR = DATA_DIR / "historical"
STORAGE_DIR = DATA_DIR / "storage"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Core Application
    APP_NAME: str = "Parali Alert"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Operating Mode: "live" or "sample"
    DATA_MODE: str = Field(default="sample", description="live for real APIs, sample for bundled verified dataset")

    # NASA FIRMS Active Fire Ingestion
    FIRMS_MAP_KEY: Optional[str] = Field(default=None, description="Optional NASA FIRMS API key. If empty, uses open public NRT CSV feeds")
    FIRMS_VIIRS_SOURCE: str = "VIIRS_SNPP_NRT"  # VIIRS 375m NRT dataset
    FIRMS_HISTORICAL_DAYS: int = 7
    FIRMS_CLUSTER_RADIUS_KM: float = 1.0  # Deduplication spatial window
    FIRMS_CLUSTER_HOURS: float = 6.0      # Deduplication temporal window

    # Open-Meteo Weather Forecast
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
    WEATHER_FORECAST_HOURS: int = 48
    WEATHER_CACHE_MINUTES: int = 60

    # Sentinel-2 L2A via AWS Open Data STAC
    SENTINEL_STAC_URL: str = "https://earth-search.aws.element84.com/v1"
    SENTINEL_AWS_BUCKET: str = "sentinel-cogs"
    SENTINEL_AWS_REGION: str = "us-west-2"
    SENTINEL_MAX_CLOUD_COVER: float = 40.0
    SENTINEL_FRESHNESS_LIMIT_DAYS: int = 10
    
    # Novelty A: Direct Cloud-Optimized GeoTIFF (COG) HTTP Range Requests
    COG_RANGE_REQUESTS_ENABLED: bool = True
    COG_WINDOW_BUFFER_DEG: float = 0.015  # ~1.6km spatial bounding window around unit centroid
    COG_PIXEL_SCALE_FACTOR: float = 10000.0  # Sentinel-2 L2A DN scaling
    COG_TIMEOUT_SECONDS: float = 8.0

    # Novelty B: Sentinel-1 C-Band SAR (Synthetic Aperture Radar) Cloud-Piercing
    SAR_RADAR_ENABLED: bool = True
    SAR_STAC_COLLECTION: str = "sentinel-1-grd"
    SAR_VH_STANDING_BASELINE_DB: float = -15.5  # Typical volume scattering in vegetative paddy canopy
    SAR_VH_HARVESTED_THRESHOLD_DB: float = -21.0  # Volume scattering collapse upon harvest
    SAR_CROSS_RATIO_THRESHOLD_DB: float = -11.0  # Cross-ratio (VH_dB - VV_dB) indicating surface scattering
    SAR_CLOUD_PIERCING_CONFIDENCE_MIN: float = 0.75

    # AWS Cloud Services
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_DEFAULT_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "parali-alert-data-lake"
    USE_LOCAL_S3_EMULATOR: bool = True
    LOCAL_STORAGE_PATH: str = str(STORAGE_DIR)

    # Punjab Crop Calendar (Documented Kharif paddy -> Rabi wheat transition)
    CROP_CALENDAR_HARVEST_START: str = "09-25"
    CROP_CALENDAR_HARVEST_PEAK: str = "10-25"
    CROP_CALENDAR_HARVEST_END: str = "11-20"
    WHEAT_SOWING_DEADLINE: str = "11-15"

    # Preventability Window Parameters (Operational time window in days)
    OPTIMAL_PREVENTION_WINDOW_MIN_DAYS: int = 1
    OPTIMAL_PREVENTION_WINDOW_MAX_DAYS: int = 6
    MAX_PREVENTION_WINDOW_DAYS: int = 10

    # Air Quality & Downwind Consequence Proxy
    ENABLE_AIR_QUALITY_CONSEQUENCE: bool = True
    # Major receptors (lat, lon, weight) downwind in post-monsoon NW wind regime
    AIR_QUALITY_RECEPTORS: List[Dict[str, Any]] = [
        {"name": "Ludhiana Metropolitan", "lat": 30.9010, "lon": 75.8573, "population_weight": 1.4},
        {"name": "Patiala-Chandigarh Corridor", "lat": 30.5500, "lon": 76.6000, "population_weight": 1.3},
        {"name": "Delhi-NCR Downwind Direction", "azimuth_deg": 135, "angular_tolerance_deg": 35, "weight": 1.5}
    ]

    # Explainable Risk Engine Weights (Must sum to 1.0)
    RISK_WEIGHT_HISTORICAL: float = 0.20
    RISK_WEIGHT_RECENT_FIRES: float = 0.25
    RISK_WEIGHT_HARVEST_RECENCY: float = 0.20
    RISK_WEIGHT_RESIDUE_INDEX: float = 0.15
    RISK_WEIGHT_WEATHER: float = 0.10
    RISK_WEIGHT_CROP_CALENDAR: float = 0.10

    # Intervention Priority Formula Parameters
    # priority_score = (fire_risk^alpha) * (intervention_opportunity^beta) * (consequence_factor^gamma)
    PRIORITY_ALPHA: float = 1.0
    PRIORITY_BETA: float = 1.0
    PRIORITY_GAMMA: float = 0.5


settings = Settings()

# Ensure local storage paths exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
GEO_DATA_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)
HISTORICAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
