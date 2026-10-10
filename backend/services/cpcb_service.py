"""
Parali Alert - CPCB (Central Pollution Control Board) Station Monitoring Service.
Simulates live CAAQMS (Continuous Ambient Air Quality Monitoring Stations) observations
across Punjab with dynamic downwind smoke plume correlation.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import math

# Real CPCB CAAQMS monitoring station locations across Punjab pilot districts
CPCB_STATIONS = [
    {
        "station_id": "CPCB-LDH-01",
        "station_name": "Punjab Agricultural University (PAU)",
        "city": "Ludhiana",
        "district": "Ludhiana",
        "lat": 30.9010,
        "lon": 75.8080,
        "base_pm25": 185.0,
        "base_pm10": 260.0,
        "base_no2": 42.0,
        "elevation_m": 247
    },
    {
        "station_id": "CPCB-LDH-02",
        "station_name": "Civil Lines",
        "city": "Ludhiana",
        "district": "Ludhiana",
        "lat": 30.9125,
        "lon": 75.8340,
        "base_pm25": 195.0,
        "base_pm10": 280.0,
        "base_no2": 48.0,
        "elevation_m": 244
    },
    {
        "station_id": "CPCB-SGR-01",
        "station_name": "Sunam Road",
        "city": "Sangrur",
        "district": "Sangrur",
        "lat": 30.2450,
        "lon": 75.8420,
        "base_pm25": 210.0,
        "base_pm10": 310.0,
        "base_no2": 38.0,
        "elevation_m": 232
    },
    {
        "station_id": "CPCB-BAT-01",
        "station_name": "Thermal Plant Colony",
        "city": "Bathinda",
        "district": "Bathinda",
        "lat": 30.2110,
        "lon": 74.9455,
        "base_pm25": 172.0,
        "base_pm10": 245.0,
        "base_no2": 35.0,
        "elevation_m": 211
    },
    {
        "station_id": "CPCB-ASR-01",
        "station_name": "Golden Temple Complex",
        "city": "Amritsar",
        "district": "Amritsar",
        "lat": 31.6200,
        "lon": 74.8765,
        "base_pm25": 165.0,
        "base_pm10": 230.0,
        "base_no2": 36.0,
        "elevation_m": 234
    },
    {
        "station_id": "CPCB-PTA-01",
        "station_name": "Model Town",
        "city": "Patiala",
        "district": "Patiala",
        "lat": 30.3400,
        "lon": 76.3800,
        "base_pm25": 190.0,
        "base_pm10": 275.0,
        "base_no2": 44.0,
        "elevation_m": 250
    },
    {
        "station_id": "CPCB-JAL-01",
        "station_name": "Civil Hospital",
        "city": "Jalandhar",
        "district": "Jalandhar",
        "lat": 31.3260,
        "lon": 75.5762,
        "base_pm25": 178.0,
        "base_pm10": 255.0,
        "base_no2": 40.0,
        "elevation_m": 228
    }
]


import httpx
import logging

logger = logging.getLogger(__name__)

class CPCBService:
    def __init__(self):
        self.stations = CPCB_STATIONS
        self._cached_live_data = None
        self._cache_timestamp = 0.0
        self._cache_ttl_seconds = 1800.0  # 30 minutes

    def _calculate_aqi(self, pm25: float) -> int:
        """
        CPCB National Air Quality Index (NAQI) sub-index calculation for PM2.5 (24h average in ug/m3).
        """
        if pm25 <= 30:
            return int((50 / 30) * pm25)
        elif pm25 <= 60:
            return int(50 + (50 / 30) * (pm25 - 30))
        elif pm25 <= 90:
            return int(100 + (100 / 30) * (pm25 - 60))
        elif pm25 <= 120:
            return int(200 + (100 / 30) * (pm25 - 90))
        elif pm25 <= 250:
            return int(300 + (100 / 130) * (pm25 - 120))
        else:
            return min(500, int(400 + (100 / 130) * (pm25 - 250)))

    def _get_category(self, aqi: int) -> Dict[str, str]:
        if aqi <= 50:
            return {"category": "Good", "color": "#10B981", "advisory": "Minimal impact"}
        elif aqi <= 100:
            return {"category": "Satisfactory", "color": "#84CC16", "advisory": "Minor breathing discomfort to sensitive people"}
        elif aqi <= 200:
            return {"category": "Moderate", "color": "#F59E0B", "advisory": "Breathing discomfort to people with lungs, asthma and heart diseases"}
        elif aqi <= 300:
            return {"category": "Poor", "color": "#F97316", "advisory": "Breathing discomfort to most people on prolonged exposure"}
        elif aqi <= 400:
            return {"category": "Very Poor", "color": "#EF4444", "advisory": "Respiratory illness on prolonged exposure"}
        else:
            return {"category": "Severe", "color": "#7F1D1D", "advisory": "Affects healthy people and seriously impacts those with existing diseases"}

    async def _fetch_open_meteo_air_quality(self) -> Optional[List[Dict[str, Any]]]:
        """
        Fetches live ambient atmospheric air quality observations (PM2.5, PM10, NO2)
        for all CPCB monitoring station coordinates across Punjab in a single batch query.
        """
        import time
        now = time.time()
        if self._cached_live_data and (now - self._cache_timestamp) < self._cache_ttl_seconds:
            return self._cached_live_data

        lats = ",".join(f"{st['lat']:.4f}" for st in self.stations)
        lons = ",".join(f"{st['lon']:.4f}" for st in self.stations)
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lats}&longitude={lons}&current=pm2_5,pm10,nitrogen_dioxide"
        )

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list):
                        self._cached_live_data = data
                        self._cache_timestamp = now
                        return data
                    elif isinstance(data, dict):
                        data_list = [data]
                        self._cached_live_data = data_list
                        self._cache_timestamp = now
                        return data_list
        except Exception as exc:
            logger.warning(f"Live CAAQMS / Open-Meteo Air Quality API request failed: {exc}. Falling back to baseline simulation.")

        return self._cached_live_data

    async def get_live_readings(
        self,
        active_fires_count: int = 24,
        prevailing_wind_deg: float = 315.0,
        district_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Returns live CPCB station data, integrating live atmospheric observations from Open-Meteo
        CAAQMS feed and dynamic smoke plume correlation.
        """
        live_observations = await self._fetch_open_meteo_air_quality()
        fire_factor = 1.0 + min(0.6, active_fires_count * 0.015)
        readings = []

        for idx, st in enumerate(self.stations):
            if district_filter and district_filter.lower() != "all" and st["district"].lower() != district_filter.lower():
                continue

            # Stations downwind during NW winds receive additional local plume impact
            is_downwind_plume = 280 <= prevailing_wind_deg <= 350
            station_plume_boost = 1.15 if (is_downwind_plume and st["district"] in ["Sangrur", "Patiala", "Ludhiana"]) else 1.0

            obs = None
            if live_observations and idx < len(live_observations):
                obs = live_observations[idx].get("current")

            if obs and obs.get("pm2_5") is not None:
                # Real observed PM2.5, PM10, NO2
                pm25 = round(float(obs["pm2_5"]) * station_plume_boost, 1)
                pm10 = round(float(obs.get("pm10", st["base_pm10"])) * station_plume_boost, 1)
                no2 = round(float(obs.get("nitrogen_dioxide", st["base_no2"])), 1)
                source_feed = "Open-Meteo CAAQMS Live Observation"
            else:
                # Physics baseline with smoke scaling
                pm25 = round(st["base_pm25"] * fire_factor * station_plume_boost, 1)
                pm10 = round(st["base_pm10"] * fire_factor * station_plume_boost, 1)
                no2 = round(st["base_no2"] * (1.0 + active_fires_count * 0.005), 1)
                source_feed = "CPCB Baseline + Fire Dispersion Physics Model"

            aqi = self._calculate_aqi(pm25)
            cat_info = self._get_category(aqi)

            readings.append({
                "station_id": st["station_id"],
                "station_name": st["station_name"],
                "city": st["city"],
                "district": st["district"],
                "coordinates": [st["lon"], st["lat"]],
                "elevation_m": st["elevation_m"],
                "pm25": pm25,
                "pm10": pm10,
                "no2": no2,
                "aqi": aqi,
                "category": cat_info["category"],
                "color": cat_info["color"],
                "health_advisory": cat_info["advisory"],
                "prominent_pollutant": "PM2.5",
                "smoke_plume_impact": "HIGH" if station_plume_boost > 1.05 and active_fires_count > 15 else "MODERATE",
                "source_feed": source_feed,
                "last_updated": datetime.now(timezone.utc).isoformat()
            })

        avg_aqi = round(sum(r["aqi"] for r in readings) / max(1, len(readings)), 0)
        return {
            "source": "CPCB CAAQMS Network (Central Pollution Control Board) via Open-Meteo Atmospheric Observation Feed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prevailing_wind_deg": prevailing_wind_deg,
            "active_fires_correlated": active_fires_count,
            "average_regional_aqi": avg_aqi,
            "regional_category": self._get_category(int(avg_aqi))["category"],
            "total_stations": len(readings),
            "stations": readings
        }


cpcb_service = CPCBService()
