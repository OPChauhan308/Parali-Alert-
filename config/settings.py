"""
Parali Alert Configuration Module.
Provides centralized, strongly typed, environment-driven configuration
for data pipelines, risk engines, weather modeling, and AWS integration.
"""

from typing import Dict, Any, List, Optional, Tuple
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
    APP_VERSION: str = "2.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "*"
    ]

    # Operating Mode: "live" or "sample"
    DATA_MODE: str = Field(default="sample", description="live for real APIs, sample for bundled verified dataset")

    # AWS Cloud Services & Automated Dispatch
    SNS_DISPATCH_TOPIC_ARN: str = Field(default="", description="SNS topic ARN for automated officer SMS dispatch")
    AWS_REGION: str = Field(default="ap-south-1", description="AWS Region")
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_DEFAULT_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "parali-alert-data-lake"
    USE_LOCAL_S3_EMULATOR: bool = True
    LOCAL_STORAGE_PATH: str = str(STORAGE_DIR)

    # Operational Dispatch & Officer Contacts
    DEFAULT_OFFICER_PHONE: str = Field(default="+919876543210", description="Fallback officer dispatch mobile number")
    CRITICAL_DISPATCH_THRESHOLD: float = 75.0
    PRIORITY_THRESHOLD_CRITICAL: float = 75.0
    PRIORITY_THRESHOLD_HIGH: float = 55.0
    PRIORITY_THRESHOLD_MEDIUM: float = 35.0

    # Administrative Unit Physical Climatology Baselines (Punjab Agricultural Statistics)
    DEFAULT_CROPLAND_PCT: float = 88.0
    DEFAULT_UNIT_AREA_SQ_KM: float = 64.0
    DEFAULT_DISTRICT_CENTER: List[float] = [75.84, 30.24]
    DISTRICT_FIRE_DENSITY_BASELINES: Dict[str, float] = {
        "Sangrur": 0.88,
        "Bathinda": 0.75,
        "Tarn Taran": 0.72,
        "Ludhiana": 0.65
    }
    DEFAULT_FIRE_DENSITY_BASELINE: float = 0.60

    # Harvest Recency Timing Weights (Days post-harvest drying curve)
    RECENCY_SCORE_CRITICAL_DRYING: float = 0.90  # Straw dried: days 3-7
    RECENCY_SCORE_EARLY_MOIST: float = 0.60      # Straw freshly harvested: days 1-3
    RECENCY_SCORE_URGENT_PRE_SOW: float = 0.75   # Urgent pre-sowing window: days 7-11
    RECENCY_SCORE_EXPIRED: float = 0.30          # Beyond 11 days
    RECENCY_SCORE_DEFAULT: float = 0.45

    # Observation Uncertainty Thresholds
    UNCERTAINTY_CLOUD_FRACTION_THRESHOLD: float = 0.50
    UNCERTAINTY_OBS_AGE_DAYS_THRESHOLD: float = 12.0

    # Active Fire Scoring Parameters
    ACTIVE_FIRE_BASE_PRIORITY: float = 80.0
    ACTIVE_FIRE_MULTIPLIER: float = 5.0

    # NASA FIRMS Active Fire Ingestion
    FIRMS_MAP_KEY: Optional[str] = Field(default=None, description="Optional NASA FIRMS API key")
    FIRMS_VIIRS_SOURCE: str = "VIIRS_SNPP_NRT"
    FIRMS_HISTORICAL_DAYS: int = 7
    FIRMS_CLUSTER_RADIUS_KM: float = 1.0
    FIRMS_CLUSTER_HOURS: float = 6.0
    FIRMS_CACHE_MINUTES: int = 30
    PUNJAB_BBOX: Tuple[float, float, float, float] = (74.0, 29.5, 76.8, 32.5)
    UNIT_FIRE_MATCH_DISTANCE_DEG: float = 0.045  # ~5km radius

    # Open-Meteo Weather Forecast & Fire Weather Index (FWI)
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
    WEATHER_FORECAST_HOURS: int = 48
    WEATHER_CACHE_MINUTES: int = 60
    FWI_WEIGHT_RH: float = 0.45
    FWI_WEIGHT_WIND: float = 0.30
    FWI_WEIGHT_TEMP: float = 0.25

    # Punjab Climatology Fallback Parameters
    CLIMATOLOGY_DEFAULT_TEMP_C: float = 28.5
    CLIMATOLOGY_DEFAULT_RH_PCT: float = 36.0
    CLIMATOLOGY_DEFAULT_WIND_KMH: float = 12.4
    CLIMATOLOGY_DEFAULT_WIND_DEG: float = 315.0

    # Sentinel-2 L2A via AWS Open Data STAC
    SENTINEL_STAC_URL: str = "https://earth-search.aws.element84.com/v1"
    SENTINEL_AWS_BUCKET: str = "sentinel-cogs"
    SENTINEL_AWS_REGION: str = "us-west-2"
    SENTINEL_MAX_CLOUD_COVER: float = 40.0
    SENTINEL_FRESHNESS_LIMIT_DAYS: int = 10
    
    # Cloud-Optimized GeoTIFF (COG) HTTP Range Requests
    COG_RANGE_REQUESTS_ENABLED: bool = True
    COG_WINDOW_BUFFER_DEG: float = 0.015
    COG_PIXEL_SCALE_FACTOR: float = 10000.0
    COG_TIMEOUT_SECONDS: float = 8.0

    # Sentinel-1 C-Band SAR Cloud-Piercing
    SAR_RADAR_ENABLED: bool = True
    SAR_STAC_COLLECTION: str = "sentinel-1-grd"
    SAR_VH_STANDING_BASELINE_DB: float = -15.5
    SAR_VH_HARVESTED_THRESHOLD_DB: float = -21.0
    SAR_CROSS_RATIO_THRESHOLD_DB: float = -11.0
    SAR_BURNED_VH_DB: float = -24.5
    SAR_BURNED_VV_DB: float = -13.8
    SAR_CLOUD_PIERCING_CONFIDENCE_MIN: float = 0.75

    # SAR Dual-Sensor Fusion Confidence Levels
    FUSION_CONF_DUAL_RESIDUE: float = 96.0
    FUSION_CONF_OPTICAL_ONLY: float = 72.0
    FUSION_CONF_SAR_ONLY: float = 78.0
    FUSION_CONF_DUAL_STANDING: float = 94.0

    # Punjab Crop Calendar
    CROP_CALENDAR_HARVEST_START: str = "09-25"
    CROP_CALENDAR_HARVEST_PEAK: str = "10-25"
    CROP_CALENDAR_HARVEST_END: str = "11-20"
    WHEAT_SOWING_DEADLINE: str = "11-15"

    # Preventability Window Parameters
    OPTIMAL_PREVENTION_WINDOW_MIN_DAYS: int = 1
    OPTIMAL_PREVENTION_WINDOW_MAX_DAYS: int = 6
    MAX_PREVENTION_WINDOW_DAYS: int = 10

    # Air Quality & Downwind Consequence Proxy
    ENABLE_AIR_QUALITY_CONSEQUENCE: bool = True
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
    PRIORITY_ALPHA: float = 1.0
    PRIORITY_BETA: float = 1.0
    PRIORITY_GAMMA: float = 0.5

    # Evaluation Pipeline Cache TTL (Seconds)
    EVALUATION_CACHE_TTL_SECONDS: int = 300


settings = Settings()

# Ensure local storage paths exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
GEO_DATA_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)
HISTORICAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
