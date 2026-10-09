"""
Harvest-to-Fire Transition Modeling Engine.
Classifies agricultural units into 4 states:
- STANDING_CROP
- RECENTLY_HARVESTED
- POSSIBLY_BURNED
- UNCERTAIN_UNOBSERVABLE
Computes state probabilities, transition evidence, and uncertainty flags.
"""

from enum import Enum
from typing import Dict, Any, List, Optional
import math


class AgriculturalState(str, Enum):
    STANDING_CROP = "STANDING_CROP"
    RECENTLY_HARVESTED = "RECENTLY_HARVESTED"
    POSSIBLY_BURNED = "POSSIBLY_BURNED"
    UNCERTAIN_UNOBSERVABLE = "UNCERTAIN_UNOBSERVABLE"


class TransitionModel:
    """
    State transition classifier and transition probability estimator.
    Treats NDVI decline and NDTI as noisy evidence signals rather than deterministic truths.
    """

    def __init__(
        self,
        ndvi_harvest_threshold: float = 0.32,
        ndvi_drop_significant: float = -0.22,
        ndti_residue_threshold: float = 0.08,
        cloud_max_acceptable: float = 0.40,
        observation_freshness_limit_days: int = 10
    ):
        self.ndvi_harvest_threshold = ndvi_harvest_threshold
        self.ndvi_drop_significant = ndvi_drop_significant
        self.ndti_residue_threshold = ndti_residue_threshold
        self.cloud_max_acceptable = cloud_max_acceptable
        self.observation_freshness_limit_days = observation_freshness_limit_days

    def evaluate_state(
        self,
        current_ndvi: float,
        baseline_ndvi: float,
        current_ndti: float,
        cloud_fraction: float,
        observation_age_days: float,
        nearby_recent_fires_count: int = 0,
        estimated_days_post_harvest: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Evaluates agricultural unit state with explicit uncertainty handling.
        """
        uncertainty_flags: List[str] = []
        evidence: List[str] = []

        # 1. Check Observation Quality & Cloud Contamination
        if cloud_fraction > self.cloud_max_acceptable:
            uncertainty_flags.append(f"HIGH_CLOUD_COVER_{int(cloud_fraction * 100)}PCT")
        if observation_age_days > self.observation_freshness_limit_days:
            uncertainty_flags.append(f"STALE_SATELLITE_OBSERVATION_{int(observation_age_days)}D")

        # If observation is severely obstructed or too stale, do not invent a crisp state
        if cloud_fraction > 0.65 or observation_age_days > 14:
            return {
                "state": AgriculturalState.UNCERTAIN_UNOBSERVABLE,
                "state_label": "Uncertain / Unobservable",
                "confidence": round(max(0.1, 1.0 - cloud_fraction - (observation_age_days / 30.0)), 2),
                "probabilities": {
                    "STANDING_CROP": 0.25,
                    "RECENTLY_HARVESTED": 0.25,
                    "POSSIBLY_BURNED": 0.25,
                    "UNCERTAIN_UNOBSERVABLE": 0.25
                },
                "days_since_harvest": estimated_days_post_harvest,
                "uncertainty_flags": uncertainty_flags,
                "evidence": [
                    f"Observation quality compromised (cloud cover: {int(cloud_fraction * 100)}%, age: {round(observation_age_days, 1)}d). Ground verification required."
                ]
            }

        delta_ndvi = current_ndvi - baseline_ndvi

        # Raw scores for states based on noisy signals
        score_standing = 0.0
        score_harvested = 0.0
        score_burned = 0.0
        score_uncertain = 0.0

        # Standing crop signal: high current NDVI and modest delta
        if current_ndvi >= 0.45:
            score_standing += 3.0
            evidence.append(f"Elevated green canopy (NDVI: {current_ndvi:.2f}) indicates standing paddy crop.")
        elif current_ndvi >= 0.35:
            score_standing += 1.5

        # Harvest transition signal: drop in NDVI and presence of residue (positive NDTI)
        if delta_ndvi <= self.ndvi_drop_significant:
            score_harvested += 3.0
            evidence.append(f"Substantial post-harvest NDVI decline (ΔNDVI: {delta_ndvi:.2f}) observed.")
        elif current_ndvi < self.ndvi_harvest_threshold:
            score_harvested += 1.5

        if current_ndti >= self.ndti_residue_threshold:
            score_harvested += 2.0
            evidence.append(f"Elevated SWIR residue spectral signal (NDTI: {current_ndti:.2f}) matches straw presence.")
        elif current_ndti > 0.02:
            score_harvested += 0.8

        # Burned signal: active FIRMS fires or very low NDVI without residue signal
        if nearby_recent_fires_count > 0:
            score_burned += min(4.0, 1.5 * nearby_recent_fires_count)
            evidence.append(f"{nearby_recent_fires_count} active thermal anomaly detection(s) co-located within 48h.")

        if current_ndvi < 0.20 and current_ndti < 0.0:
            score_burned += 1.8
            evidence.append("Low vegetation reflectance combined with negative residue index indicates char or bare plowed ground.")

        # Uncertainty penalties
        if cloud_fraction > self.cloud_max_acceptable:
            score_uncertain += 2.0 * (cloud_fraction / self.cloud_max_acceptable)
            evidence.append(f"Partial cloud contamination ({int(cloud_fraction * 100)}%) dampens spectral confidence.")
        if observation_age_days > 5:
            score_uncertain += 0.4 * (observation_age_days - 5)

        # Softmax normalization to derive probabilistic distribution
        scores = [score_standing, score_harvested, score_burned, score_uncertain]
        exp_scores = [math.exp(min(10.0, s)) for s in scores]
        sum_exp = sum(exp_scores)
        probs = [s / sum_exp for s in exp_scores]

        prob_dict = {
            AgriculturalState.STANDING_CROP.value: round(probs[0], 3),
            AgriculturalState.RECENTLY_HARVESTED.value: round(probs[1], 3),
            AgriculturalState.POSSIBLY_BURNED.value: round(probs[2], 3),
            AgriculturalState.UNCERTAIN_UNOBSERVABLE.value: round(probs[3], 3),
        }

        # Determine dominant state
        state_candidates = [
            (AgriculturalState.STANDING_CROP, probs[0]),
            (AgriculturalState.RECENTLY_HARVESTED, probs[1]),
            (AgriculturalState.POSSIBLY_BURNED, probs[2]),
            (AgriculturalState.UNCERTAIN_UNOBSERVABLE, probs[3]),
        ]
        dominant_state, dominant_prob = max(state_candidates, key=lambda x: x[1])

        # If harvest state, calculate or preserve days since harvest
        days_since_harvest = estimated_days_post_harvest
        if dominant_state == AgriculturalState.RECENTLY_HARVESTED and days_since_harvest is None:
            # Approximate from spectral delta magnitude and observation age
            days_since_harvest = min(12.0, max(1.0, observation_age_days + (abs(delta_ndvi) * 5.0)))

        return {
            "state": dominant_state,
            "state_label": dominant_state.value.replace("_", " ").title(),
            "confidence": round(dominant_prob, 2),
            "probabilities": prob_dict,
            "days_since_harvest": round(days_since_harvest, 1) if days_since_harvest is not None else None,
            "uncertainty_flags": uncertainty_flags,
            "evidence": evidence
        }


transition_model = TransitionModel()
