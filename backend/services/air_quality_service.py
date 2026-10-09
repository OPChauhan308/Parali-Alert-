"""
Air-Quality-Aware Downwind Dispersion Proxy Service.
Modular operational proxy estimating relative consequence of potential fires based on:
- Source location
- Prevailing forecast wind direction and wind speed (from Open-Meteo)
- Alignment with major downwind population centers (Ludhiana, Patiala-Chandigarh, Delhi-NCR)
Transparent directional transport proxy without making unvalidated PM2.5 dispersion claims.
"""

import math
from typing import Dict, Any, List
from config.settings import settings


class AirQualityService:
    def __init__(self):
        self.enabled = settings.ENABLE_AIR_QUALITY_CONSEQUENCE
        self.receptors = settings.AIR_QUALITY_RECEPTORS

    def calculate_consequence_factor(
        self,
        source_lat: float,
        source_lon: float,
        wind_from_deg: float,
        wind_speed_kmh: float
    ) -> Dict[str, Any]:
        """
        Calculates downwind consequence multiplier (1.0 to 1.40).
        Meteorological wind direction is the direction the wind blows FROM.
        Smoke plume transport direction = (wind_from_deg + 180) % 360.
        """
        if not self.enabled:
            return {
                "consequence_factor": 1.0,
                "is_enabled": False,
                "plume_bearing_deg": round((wind_from_deg + 180) % 360, 1),
                "affected_receptors": [],
                "explanation": "Air quality consequence weighting disabled."
            }

        plume_direction_deg = (wind_from_deg + 180.0) % 360.0

        max_alignment_weight = 0.0
        affected_receptors = []

        for rec in self.receptors:
            rec_name = rec.get("name", "Unknown Receptor")

            # Check if receptor is specified by coordinates or fixed azimuth corridor
            if "lat" in rec and "lon" in rec:
                rec_lat, rec_lon = rec["lat"], rec["lon"]
                # Calculate bearing from source to receptor
                d_lat = math.radians(rec_lat - source_lat)
                d_lon = math.radians(rec_lon - source_lon)
                y = math.sin(d_lon) * math.cos(math.radians(rec_lat))
                x = math.cos(math.radians(source_lat)) * math.sin(math.radians(rec_lat)) - \
                    math.sin(math.radians(source_lat)) * math.cos(math.radians(rec_lat)) * math.cos(d_lon)
                bearing = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

                # Angular discrepancy between plume bearing and receptor bearing
                angle_diff = abs(plume_direction_deg - bearing)
                angle_diff = min(angle_diff, 360.0 - angle_diff)

                # Distance in km
                dist_km = math.hypot(rec_lat - source_lat, rec_lon - source_lon) * 111.0

                # Plume cone within 45 degrees and within 120km
                if angle_diff <= 45.0 and dist_km <= 120.0:
                    proximity_factor = max(0.2, 1.0 - (dist_km / 120.0))
                    alignment_factor = math.cos(math.radians(angle_diff))
                    impact = proximity_factor * alignment_factor * (rec.get("population_weight", 1.2) - 1.0)
                    if impact > max_alignment_weight:
                        max_alignment_weight = impact
                    affected_receptors.append({
                        "name": rec_name,
                        "distance_km": round(dist_km, 1),
                        "bearing_deg": round(bearing, 1),
                        "offset_deg": round(angle_diff, 1)
                    })
            elif "azimuth_deg" in rec:
                # Fixed regional corridor (e.g. Delhi-NCR downwind corridor at 135 deg SE)
                corridor_azimuth = rec["azimuth_deg"]
                tol = rec.get("angular_tolerance_deg", 35.0)
                angle_diff = abs(plume_direction_deg - corridor_azimuth)
                angle_diff = min(angle_diff, 360.0 - angle_diff)
                if angle_diff <= tol:
                    alignment_factor = math.cos(math.radians(angle_diff))
                    impact = alignment_factor * (rec.get("weight", 1.4) - 1.0)
                    if impact > max_alignment_weight:
                        max_alignment_weight = impact
                    affected_receptors.append({
                        "name": rec_name,
                        "bearing_deg": corridor_azimuth,
                        "offset_deg": round(angle_diff, 1)
                    })

        # Wind speed influence: calm winds linger locally (< 6 km/h), moderate winds (10-25 km/h) transport plumes far
        speed_factor = min(1.0, max(0.4, wind_speed_kmh / 20.0))

        # Final consequence multiplier bounded between 1.0 and 1.40
        consequence_factor = 1.0 + (max_alignment_weight * speed_factor)
        consequence_factor = round(min(1.40, max(1.0, consequence_factor)), 3)

        if affected_receptors:
            rec_names = ", ".join([r["name"] for r in affected_receptors])
            explanation = f"Downwind transport vector ({round(plume_direction_deg)}°) carries smoke towards {rec_names} at {round(wind_speed_kmh, 1)} km/h."
        else:
            explanation = f"Prevailing plume vector ({round(plume_direction_deg)}°) disperses away from high-density receptors."

        return {
            "consequence_factor": consequence_factor,
            "is_enabled": True,
            "plume_bearing_deg": round(plume_direction_deg, 1),
            "wind_speed_kmh": round(wind_speed_kmh, 1),
            "affected_receptors": affected_receptors,
            "explanation": explanation
        }


air_quality_service = AirQualityService()
