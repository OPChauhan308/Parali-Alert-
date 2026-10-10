"""
Parali Alert Core Risk Engine.
Executes the 4-step intelligence framework:
Step 1: Estimate residue_opportunity (unburned post-harvest cropland area proxy)
Step 2: Estimate fire_risk (explainable weighted score from fire history, weather, crop calendar, recency)
Step 3: Estimate intervention_opportunity (preventability window before wheat sowing)
Step 4: Calculate final priority_score (fire_risk * intervention_opportunity * consequence_factor)

Produces:
- Priority category
- Top 3 contributing risk drivers
- Evidence confidence & data quality status
- Rule-based operational recommendations (CRM machinery dispatch, baler clusters, ground verification)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import math
from config.settings import settings
from backend.services.state_engine import AgriculturalState
from backend.services.aws_service import aws_service

class PriorityCategory:
    CRITICAL_PREVENTION = "CRITICAL_PREVENTION"      # Score >= 75
    HIGH_PREVENTION = "HIGH_PREVENTION"              # Score >= 55
    MEDIUM_MONITORING = "MEDIUM_MONITORING"          # Score >= 35
    LOW_RISK = "LOW_RISK"                            # Score < 35
    OBSERVED_FIRE_DISPATCH = "OBSERVED_FIRE_DISPATCH"# Active fire detected in unit
    UNCERTAIN_VERIFICATION = "UNCERTAIN_VERIFICATION"# Stale or cloud obstructed


class RiskEngine:

    @staticmethod
    def process_daily_risk_scores(revenue_blocks: list) -> list:
        """ 
        Main loop executed daily by the EventBridge trigger.
        """
        processed_blocks = []
        CRITICAL_DISPATCH_THRESHOLD = 75.0
        for block in revenue_blocks:
            # 1. Logic to extract or calculate priority score
            score = block.get('priority_score', 0.0)
            block['priority_score'] = score
        
            # 2. NEW: The SNS Dispatch Injection
            if score >= CRITICAL_DISPATCH_THRESHOLD:
                # In a real scenario, this phone number comes from your DynamoDB block metadata
                bdo_phone_number = block.get('officer_phone', '+919876543210') 
            
                # Trigger the SMS synchronously (or pass to a background task)
                aws_service.trigger_dispatch_sms(
                    unit_name=block.get('name', 'Unknown Block'),
                    score=score,
                    days_since_harvest=block.get('days_since_harvest', 2),
                    wind_dir=block.get('wind_direction', 'NW'),
                    phone_number=bdo_phone_number
                )
            
            processed_blocks.append(block)

        return processed_blocks
    def __init__(self):
        self.weights = {
            "historical": settings.RISK_WEIGHT_HISTORICAL,
            "recent_fires": settings.RISK_WEIGHT_RECENT_FIRES,
            "harvest_recency": settings.RISK_WEIGHT_HARVEST_RECENCY,
            "residue_index": settings.RISK_WEIGHT_RESIDUE_INDEX,
            "weather": settings.RISK_WEIGHT_WEATHER,
            "crop_calendar": settings.RISK_WEIGHT_CROP_CALENDAR,
        }

    def evaluate_unit(
        self,
        unit: Dict[str, Any],
        spectral_obs: Dict[str, Any],
        state_result: Dict[str, Any],
        fire_summary: Dict[str, Any],
        weather_data: Dict[str, Any],
        consequence_data: Dict[str, Any],
        horizon_hours: int = 48
    ) -> Dict[str, Any]:
        """
        Evaluates a single administrative unit across 24h or 48h horizon.
        """
        props = unit["properties"]
        unit_id = props["unit_id"]
        unit_name = props["name"]
        district = props["district"]
        cropland_pct = props.get("cropland_pct", 88.0)
        area_sq_km = props.get("area_sq_km", 64.0)

        # Weather horizon choice
        weather_horizon = weather_data.get(f"horizon_{horizon_hours}h", weather_data.get("horizon_48h", {}))
        fire_weather_index = weather_horizon.get("fire_weather_index", 0.5)

        # Active fires in this unit
        fires_24h = fire_summary.get("active_fires_24h", 0)
        fires_48h = fire_summary.get("active_fires_48h", 0)
        fires_7d = fire_summary.get("active_fires_7d", 0)

        state = state_result["state"]
        cloud_fraction = spectral_obs["quality_indicators"]["cloud_fraction"]
        obs_age_days = spectral_obs["observation_age_days"]
        current_ndti = spectral_obs["spectral_indices"]["current_ndti"]
        days_since_harvest = state_result.get("days_since_harvest")

        # -------------------------------------------------------------
        # STEP 1: Estimate residue_opportunity (0.0 to 1.0)
        # Represents post-harvest, unburned agricultural land proxy
        # -------------------------------------------------------------
        residue_opp, residue_est_hectares, residue_flags = self._calculate_residue_opportunity(
            cropland_pct=cropland_pct,
            area_sq_km=area_sq_km,
            state=state,
            current_ndti=current_ndti,
            cloud_fraction=cloud_fraction,
            obs_age_days=obs_age_days,
            fires_count_48h=fires_48h
        )

        # -------------------------------------------------------------
        # STEP 2: Estimate fire_risk (0.0 to 1.0)
        # Explainable weighted risk score
        # -------------------------------------------------------------
        fire_risk, risk_factors = self._calculate_fire_risk(
            district=district,
            fires_24h=fires_24h,
            fires_48h=fires_48h,
            fires_7d=fires_7d,
            days_since_harvest=days_since_harvest,
            current_ndti=current_ndti,
            fire_weather_index=fire_weather_index,
            state=state
        )

        # -------------------------------------------------------------
        # STEP 3: Estimate intervention_opportunity (0.0 to 1.0)
        # Preventability Window: Timeliness of pre-fire machinery dispatch
        # -------------------------------------------------------------
        intervention_opp, preventability_status, window_reasons = self._calculate_intervention_opportunity(
            state=state,
            days_since_harvest=days_since_harvest,
            residue_opp=residue_opp,
            fires_24h=fires_24h,
            fires_48h=fires_48h,
            cloud_fraction=cloud_fraction,
            obs_age_days=obs_age_days
        )

        # -------------------------------------------------------------
        # STEP 4: Calculate intervention priority
        # priority_score = fire_risk * intervention_opportunity * consequence_factor
        # -------------------------------------------------------------
        consequence_factor = consequence_data.get("consequence_factor", 1.0)

        # Active Fire Override: If fires are actively detected right now in the unit,
        # it is NOT a pre-fire prevention opportunity; it's an operational fire response.
        is_active_fire = (fires_24h > 0 or fires_48h > 0)
        is_severely_uncertain = (cloud_fraction > 0.50 or obs_age_days > 12)

        if is_active_fire:
            priority_cat = PriorityCategory.OBSERVED_FIRE_DISPATCH
            priority_score = round(min(100.0, 80.0 + (fires_24h * 5.0)), 1)
        elif is_severely_uncertain:
            priority_cat = PriorityCategory.UNCERTAIN_VERIFICATION
            priority_score = round(fire_risk * 45.0, 1)
        else:
            raw_priority = (
                (fire_risk ** settings.PRIORITY_ALPHA) *
                (intervention_opp ** settings.PRIORITY_BETA) *
                (consequence_factor ** settings.PRIORITY_GAMMA)
            ) * 100.0
            priority_score = round(min(100.0, max(0.0, raw_priority)), 1)

            if priority_score >= 75.0:
                priority_cat = PriorityCategory.CRITICAL_PREVENTION
            elif priority_score >= 55.0:
                priority_cat = PriorityCategory.HIGH_PREVENTION
            elif priority_score >= 35.0:
                priority_cat = PriorityCategory.MEDIUM_MONITORING
            else:
                priority_cat = PriorityCategory.LOW_RISK

        # Data Freshness & Quality
        evidence_quality, missing_warnings = self._evaluate_evidence_quality(
            cloud_fraction=cloud_fraction,
            obs_age_days=obs_age_days,
            is_weather_live=weather_data.get("is_live", False)
        )

        # Rule-Based Operational Recommendations
        recommendation = self._generate_recommendation(
            priority_cat=priority_cat,
            state=state,
            days_since_harvest=days_since_harvest,
            residue_opp=residue_opp,
            fire_risk=fire_risk,
            intervention_opp=intervention_opp,
            is_active_fire=is_active_fire,
            cloud_fraction=cloud_fraction,
            unit_name=unit_name,
            district=district
        )

        # Top 3 Contributing Risk Drivers
        top_drivers = sorted(risk_factors, key=lambda x: x["weighted_contribution"], reverse=True)[:3]

        return {
            "unit_id": unit_id,
            "name": unit_name,
            "district": district,
            "coordinates": [props["lon"], props["lat"]],
            "geometry": unit["geometry"],
            "cropland_hectares": round((area_sq_km * (cropland_pct / 100.0)) * 100.0, 0),
            "forecast_horizon_hours": horizon_hours,

            # Core Metrics
            "priority_score": priority_score,
            "priority_category": priority_cat,
            "fire_risk_score": round(fire_risk * 100.0, 1),
            "intervention_opportunity_score": round(intervention_opp * 100.0, 1),
            "residue_opportunity_score": round(residue_opp * 100.0, 1),
            "estimated_unburned_residue_hectares": residue_est_hectares,
            "consequence_factor": consequence_factor,

            # State & Preventability
            "agricultural_state": state.value if hasattr(state, "value") else str(state),
            "preventability_status": preventability_status,
            "days_since_harvest": days_since_harvest,
            "preventability_window_explanation": window_reasons,

            # Drivers & Details
            "top_contributing_drivers": top_drivers,
            "all_risk_factors": risk_factors,
            "recommended_intervention": recommendation,

            # Quality & Freshness
            "evidence_quality_score": round(evidence_quality * 100.0, 1),
            "data_freshness": {
                "satellite_age_days": obs_age_days,
                "satellite_cloud_pct": round(cloud_fraction * 100.0, 1),
                "active_fires_source": fire_summary.get("fire_points", [{}])[0].get("source", "FIRMS VIIRS") if fire_summary.get("fire_points") else "FIRMS VIIRS NRT",
                "weather_is_live": weather_data.get("is_live", False)
            },
            "missing_data_warnings": missing_warnings,
            "evaluated_at": datetime.now(timezone.utc).isoformat()
        }

    def _calculate_residue_opportunity(
        self,
        cropland_pct: float,
        area_sq_km: float,
        state: AgriculturalState,
        current_ndti: float,
        cloud_fraction: float,
        obs_age_days: float,
        fires_count_48h: int
    ) -> (float, float, List[str]):
        """
        Step 1: Estimate recently harvested, potentially unburned agricultural land proxy.
        """
        flags = []
        cropland_sq_km = area_sq_km * (cropland_pct / 100.0)
        cropland_ha = cropland_sq_km * 100.0

        if state == AgriculturalState.RECENTLY_HARVESTED:
            # Strong residue opportunity: stubble on ground, unburned
            base_ratio = 0.70 + min(0.20, max(0.0, current_ndti * 1.5))
        elif state == AgriculturalState.STANDING_CROP:
            # Crop not yet harvested, stubble not yet accessible
            base_ratio = 0.10
        elif state == AgriculturalState.POSSIBLY_BURNED:
            # Likely already burned or tilled, residue opportunity diminished
            base_ratio = 0.15
        else:
            # Uncertain / cloudy
            base_ratio = 0.40
            flags.append("Residue estimate attenuated due to high cloud fraction.")

        # Subtract penalty if active fires were already detected in the area
        if fires_count_48h > 0:
            fire_loss_pct = min(0.60, fires_count_48h * 0.15)
            base_ratio *= (1.0 - fire_loss_pct)
            flags.append(f"Reduced by {int(fire_loss_pct * 100)}% due to {fires_count_48h} recent active burn pixels.")

        # Quality discount
        quality_factor = max(0.4, 1.0 - (cloud_fraction * 0.5) - (min(obs_age_days, 10) / 30.0))
        residue_opp = float(max(0.05, min(0.95, base_ratio * quality_factor)))
        estimated_hectares = round(cropland_ha * residue_opp, 0)

        return residue_opp, estimated_hectares, flags

    def _calculate_fire_risk(
        self,
        district: str,
        fires_24h: int,
        fires_48h: int,
        fires_7d: int,
        days_since_harvest: Optional[float],
        current_ndti: float,
        fire_weather_index: float,
        state: AgriculturalState
    ) -> (float, List[Dict[str, Any]]):
        """
        Step 2: Explainable weighted fire risk score.
        """
        factors = []

        # 1. Historical District Fire Density Baseline
        # Sangrur is the historic highest-density burning district in Punjab
        district_baseline = {
            "Sangrur": 0.88,
            "Bathinda": 0.75,
            "Tarn Taran": 0.72,
            "Ludhiana": 0.65
        }.get(district, 0.60)
        hist_score = district_baseline
        factors.append({
            "factor_name": "Historical Seasonal Fire Density",
            "raw_value": round(hist_score, 2),
            "weight": self.weights["historical"],
            "weighted_contribution": round(hist_score * self.weights["historical"], 3),
            "description": f"{district} historic autumn seasonal burning concentration baseline ({int(district_baseline*100)}%)."
        })

        # 2. Recent Local Fire Activity (Spatial/Temporal Clustering)
        cluster_val = min(1.0, (fires_24h * 0.4) + (fires_48h * 0.25) + (fires_7d * 0.08))
        factors.append({
            "factor_name": "Recent Local Thermal Activity",
            "raw_value": round(cluster_val, 2),
            "weight": self.weights["recent_fires"],
            "weighted_contribution": round(cluster_val * self.weights["recent_fires"], 3),
            "description": f"{fires_48h} thermal detection(s) in sector over past 48h ({fires_7d} over 7 days)."
        })

        # 3. Estimated Harvest Recency / Drying Curve
        # Straw dries out and fire risk peaks 3-7 days post-harvest
        if days_since_harvest is not None:
            if 3.0 <= days_since_harvest <= 7.0:
                recency_score = 0.90  # Critical drying window
            elif 1.0 <= days_since_harvest < 3.0:
                recency_score = 0.60  # Straw still slightly moist
            elif 7.0 < days_since_harvest <= 11.0:
                recency_score = 0.75  # Urgent pre-sowing window
            else:
                recency_score = 0.30
        else:
            recency_score = 0.45 if state == AgriculturalState.RECENTLY_HARVESTED else 0.20

        factors.append({
            "factor_name": "Crop Residue Desiccation Timing",
            "raw_value": round(recency_score, 2),
            "weight": self.weights["harvest_recency"],
            "weighted_contribution": round(recency_score * self.weights["harvest_recency"], 3),
            "description": f"Estimated {days_since_harvest or 'unknown'} days post-harvest (stubble drying phase)."
        })

        # 4. Residue Spectral Index (NDTI)
        residue_score = max(0.1, min(1.0, (current_ndti + 0.05) / 0.25))
        factors.append({
            "factor_name": "Residue Spectral Signal (NDTI)",
            "raw_value": round(residue_score, 2),
            "weight": self.weights["residue_index"],
            "weighted_contribution": round(residue_score * self.weights["residue_index"], 3),
            "description": f"SWIR cellulose/lignin absorption signature (NDTI: {current_ndti:.2f})."
        })

        # 5. Weather Fire Index (Dryness, Wind, Temp)
        factors.append({
            "factor_name": "Atmospheric Fire Spread Weather",
            "raw_value": round(fire_weather_index, 2),
            "weight": self.weights["weather"],
            "weighted_contribution": round(fire_weather_index * self.weights["weather"], 3),
            "description": f"Forecast dryness, wind, and thermal conditions (FWI: {fire_weather_index:.2f})."
        })

        # 6. Crop Calendar Urgency
        # Peak Punjab burning happens late October to mid-November before wheat sowing
        calendar_urgency = 0.85
        factors.append({
            "factor_name": "Wheat Sowing Crop Calendar Pressure",
            "raw_value": round(calendar_urgency, 2),
            "weight": self.weights["crop_calendar"],
            "weighted_contribution": round(calendar_urgency * self.weights["crop_calendar"], 3),
            "description": "Critical Kharif harvest to Rabi wheat sowing transition window."
        })

        # Calculate final weighted risk score
        total_risk = sum(f["weighted_contribution"] for f in factors)
        normalized_risk = float(max(0.05, min(0.98, total_risk)))

        return normalized_risk, factors

    def _calculate_intervention_opportunity(
        self,
        state: AgriculturalState,
        days_since_harvest: Optional[float],
        residue_opp: float,
        fires_24h: int,
        fires_48h: int,
        cloud_fraction: float,
        obs_age_days: float
    ) -> (float, str, str):
        """
        Step 3: Estimate preventability window.
        Distinguishes actionable pre-fire windows from lost opportunities or already burned fields.
        """
        if fires_24h > 0 or fires_48h > 0:
            return 0.10, "FIRE_OBSERVED_NON_PREVENTATIVE", "Active thermal detections recorded. Transitioned from preventive window to fire response."

        if state == AgriculturalState.STANDING_CROP:
            return 0.25, "PRE_HARVEST_STANDING", "Crop is still standing. Preventive machinery not yet deployable until harvest occurs."

        if state == AgriculturalState.POSSIBLY_BURNED:
            return 0.15, "ALREADY_BURNED_OR_TILLED", "Spectral signature indicates fields already burned or tilled; low remaining prevention opportunity."

        if cloud_fraction > 0.50 or obs_age_days > 10:
            return 0.40, "UNCERTAIN_WINDOW", "Observation quality insufficient to establish exact post-harvest window without field scouting."

        # Recently harvested state: Evaluate days post-harvest
        if days_since_harvest is not None:
            if 1.0 <= days_since_harvest <= 5.0:
                opp = 0.95
                status = "PRIME_INTERVENTION_WINDOW"
                msg = f"{days_since_harvest} days post-harvest. Optimal window for Happy Seeder / Super Seeder / Baler machinery outreach."
            elif 5.0 < days_since_harvest <= 8.0:
                opp = 0.75
                status = "URGENT_CLOSING_WINDOW"
                msg = f"{days_since_harvest} days post-harvest. High risk of imminent burning before wheat seedbed preparation."
            elif days_since_harvest > 8.0:
                opp = 0.35
                status = "EXPIRING_WINDOW"
                msg = f"{days_since_harvest} days post-harvest. Farmer likely preparing for wheat sowing; intervention window closing."
            else:
                opp = 0.60
                status = "IMMEDIATE_POST_HARVEST"
                msg = "Freshly harvested within 24 hours. High moisture residue."
        else:
            opp = 0.65
            status = "ACTIONABLE_POST_HARVEST"
            msg = "Confirmed post-harvest state with unburned residue detected."

        return opp, status, msg

    def _evaluate_evidence_quality(
        self,
        cloud_fraction: float,
        obs_age_days: float,
        is_weather_live: bool
    ) -> (float, List[str]):
        warnings = []
        quality = 1.0

        if cloud_fraction > 0.30:
            quality -= 0.25
            warnings.append(f"Satellite scene has {int(cloud_fraction * 100)}% cloud/shadow pixels.")
        if obs_age_days > 7.0:
            quality -= 0.20
            warnings.append(f"Satellite observation is {round(obs_age_days, 1)} days old.")
        if not is_weather_live:
            quality -= 0.10
            warnings.append("Using seasonal climatology weather fallback.")

        return max(0.20, quality), warnings

    def _generate_recommendation(
        self,
        priority_cat: str,
        state: AgriculturalState,
        days_since_harvest: Optional[float],
        residue_opp: float,
        fire_risk: float,
        intervention_opp: float,
        is_active_fire: bool,
        cloud_fraction: float,
        unit_name: str,
        district: str
    ) -> Dict[str, Any]:
        """
        Generates concrete, evidence-linked operational recommendations.
        """
        if is_active_fire:
            return {
                "action_type": "FIRE_RESPONSE_DISPATCH",
                "urgency": "IMMEDIATE",
                "target_department": "District Fire Control & Revenue / Sub-Divisional Magistrate",
                "operational_guidance": f"Thermal anomaly active in {unit_name}. Transition from pre-fire prevention to rapid containment & ground verification.",
                "machinery_recommendation": "Fire suppression tenders & patrolling vehicle deployment."
            }

        if cloud_fraction > 0.50:
            return {
                "action_type": "GROUND_VERIFICATION_SCOUTING",
                "urgency": "MEDIUM",
                "target_department": "Agricultural Extension Team (Block Development Officer)",
                "operational_guidance": f"Persistent cloud cover over {unit_name} obscures optical satellite sensors. Dispatch ground scouts to verify harvest status.",
                "machinery_recommendation": "Do not pre-commit heavy machinery until physical field verification is logged."
            }

        if priority_cat == PriorityCategory.CRITICAL_PREVENTION:
            return {
                "action_type": "PRIORITY_CRM_MACHINERY_DEPLOYMENT",
                "urgency": "CRITICAL_24H",
                "target_department": "Cooperative Society / CRM Custom Hiring Center (CHC)",
                "operational_guidance": f"High burn risk and prime intervention window in {unit_name}. Immediate farmer outreach and machinery dispatch required.",
                "machinery_recommendation": f"Route nearest available Super Seeder or Straw Baler clusters to {unit_name} ({int(residue_opp * 100)}% residue opportunity)."
            }

        if priority_cat == PriorityCategory.HIGH_PREVENTION:
            return {
                "action_type": "RESIDUE_MANAGEMENT_OUTREACH",
                "urgency": "HIGH_48H",
                "target_department": "Agricultural Extension / Krishi Vigyan Kendra (KVK)",
                "operational_guidance": f"Elevated pre-burn risk in {unit_name}. Coordinate with village Sarpanch and farmer groups for in-situ residue incorporation.",
                "machinery_recommendation": "Pre-book Happy Seeders or arrange ex-situ straw baling collection with local biomass aggregation centers."
            }

        if priority_cat == PriorityCategory.MEDIUM_MONITORING:
            return {
                "action_type": "MONITOR_AND_SOWING_AWARENESS",
                "urgency": "ROUTINE",
                "target_department": "Block Agricultural Staff",
                "operational_guidance": f"Maintain daily satellite tracking for {unit_name}. Distribute bio-decomposer awareness pamphlets.",
                "machinery_recommendation": "List local Custom Hiring Center contacts in village WhatsApp groups."
            }

        return {
            "action_type": "PASSIVE_MONITORING",
            "urgency": "LOW",
            "target_department": "District Control Room",
            "operational_guidance": f"Low current risk in {unit_name}. Continue scheduled multi-temporal satellite checks.",
            "machinery_recommendation": "No urgent machinery deployment needed."
        }


risk_engine = RiskEngine()
