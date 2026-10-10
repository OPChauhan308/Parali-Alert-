"""
Pydantic Schemas for Parali Alert API.
Defines strongly typed responses and request models.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class StudyAreaInfo(BaseModel):
    name: str
    district_id: str
    state: str
    center: List[float]
    bounds: List[float]
    total_blocks: int


class StudyAreasResponse(BaseModel):
    pilot_districts: List[str]
    total_units: int
    primary_focus: List[str]
    bounding_box: List[float]
    districts: Dict[str, Any]


class RiskFactorItem(BaseModel):
    factor_name: str
    raw_value: float
    weight: float
    weighted_contribution: float
    description: str


class RecommendationItem(BaseModel):
    action_type: str
    urgency: str
    target_department: str
    operational_guidance: str
    machinery_recommendation: str


class UnitEvaluationRecord(BaseModel):
    unit_id: str
    name: str
    district: str
    coordinates: List[float]
    geometry: Dict[str, Any]
    cropland_hectares: float
    forecast_horizon_hours: int

    # Core scores
    priority_score: float
    priority_category: str
    fire_risk_score: float
    intervention_opportunity_score: float
    residue_opportunity_score: float
    estimated_unburned_residue_hectares: float
    consequence_factor: float

    # State & Preventability
    agricultural_state: str
    preventability_status: str
    days_since_harvest: Optional[float] = None
    preventability_window_explanation: str

    # Drivers & Guidance
    top_contributing_drivers: List[RiskFactorItem]
    all_risk_factors: List[RiskFactorItem]
    recommended_intervention: RecommendationItem

    # Evidence & Quality
    evidence_quality_score: float
    data_freshness: Dict[str, Any]
    missing_data_warnings: List[str]
    evaluated_at: str


class RiskRankingsResponse(BaseModel):
    horizon_hours: int
    total_evaluated: int
    total_returned: int = 0
    data_mode: str
    refreshed_at: str
    summary_stats: Dict[str, Any]
    rankings: List[UnitEvaluationRecord]


class UnitDetailResponse(BaseModel):
    unit: UnitEvaluationRecord
    spectral_details: Dict[str, Any]
    weather_forecast: Dict[str, Any]
    active_fires: Dict[str, Any]


class WeatherOverviewResponse(BaseModel):
    district: str
    forecast: Dict[str, Any]


class HistoricalReplayRequest(BaseModel):
    target_date: str = Field(description="Historical date in format YYYY-MM-DD")
    horizon_hours: int = 48


class HistoricalReplayResponse(BaseModel):
    replay_date: str
    is_historical_replay: bool
    data_leakage_prevented: bool
    cutoff_timestamp: str
    total_evaluated: int
    rankings: List[UnitEvaluationRecord]


class WhatsAppAlertRequest(BaseModel):
    unit_id: str
    recipient_phone: Optional[str] = None
    recipient_name: Optional[str] = "Block Development Officer"
    language: str = "en"  # "en" or "pa"


class WhatsAppAlertResponse(BaseModel):
    success: bool
    dispatch: Dict[str, Any]
    formatted_message: Dict[str, Any]


class FarmerReportRequest(BaseModel):
    farmer_name: str
    phone: str
    district: str
    unit_id: str
    village: str
    land_area_acres: float = 5.0
    crop_type: str = "Paddy (PR-126)"
    harvest_status: str = "HARVESTED_YESTERDAY"
    harvest_date: Optional[str] = None
    residue_action: str = "SUPER_SEEDER_NEEDED"
    machinery_requested: bool = True
    notes: Optional[str] = ""


class FarmerReportResponse(BaseModel):
    report_id: str
    farmer_name: str
    district: str
    unit_id: str
    submitted_at: str
    status: str = "RECEIVED"

