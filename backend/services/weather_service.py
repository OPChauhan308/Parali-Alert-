"""
Open-Meteo Weather Forecast Ingestion & Fire Weather Index Service.
Fetches real 48-hour hourly forecasts:
- Temperature (2m)
- Relative humidity (2m)
- Wind speed (10m) & direction (10m)
- Precipitation
Computes Weather Fire Index and caches responses per geographic region.
"""

from typing import Dict, Any, List, Optional
import httpx
import time
import math
from datetime import datetime, timezone
from config.settings import settings


class WeatherService:
    def __init__(self):
        self.base_url = settings.OPEN_METEO_BASE_URL
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl_seconds = settings.WEATHER_CACHE_MINUTES * 60

    def _cache_key(self, lat: float, lon: float) -> str:
        # Snap to 0.1 degree grid (~10km) for sensible caching across adjacent blocks
        return f"{round(lat, 1)}:{round(lon, 1)}"

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Retrieves 48h hourly forecast from Open-Meteo with local memory caching.
        Falls back to seasonal synthetic/offline forecast if network fails.
        """
        key = self._cache_key(lat, lon)
        now = time.time()

        if key in self.cache and (now - self.cache[key]["timestamp"]) < self.cache_ttl_seconds:
            return self.cache[key]["data"]

        params = {
            "latitude": round(lat, 3),
            "longitude": round(lon, 3),
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability",
            "forecast_days": 3,
            "timezone": "Asia/Kolkata"
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(self.base_url, params=params)
                if resp.status_code == 200:
                    raw_data = resp.json()
                    processed = self._process_open_meteo(raw_data, lat, lon)
                    self.cache[key] = {
                        "timestamp": now,
                        "data": processed
                    }
                    return processed
                else:
                    return self._fallback_forecast(lat, lon, f"Open-Meteo HTTP {resp.status_code}")
        except Exception as e:
            return self._fallback_forecast(lat, lon, f"Network/API error: {str(e)}")

    def _process_open_meteo(self, raw: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
        hourly = raw.get("hourly", {})
        times = hourly.get("time", [])[:48]
        temps = hourly.get("temperature_2m", [])[:48]
        humidities = hourly.get("relative_humidity_2m", [])[:48]
        wind_speeds = hourly.get("wind_speed_10m", [])[:48]
        wind_dirs = hourly.get("wind_direction_10m", [])[:48]
        precips = hourly.get("precipitation", [])[:48]

        # 24h & 48h aggregates
        h24_temps = temps[:24] if temps else [30.0]
        h24_rh = humidities[:24] if humidities else [45.0]
        h24_wind = wind_speeds[:24] if wind_speeds else [12.0]
        h24_dirs = wind_dirs[:24] if wind_dirs else [315.0]
        h24_precip = sum(precips[:24]) if precips else 0.0

        h48_temps = temps[:48] if temps else [30.0]
        h48_rh = humidities[:48] if humidities else [45.0]
        h48_wind = wind_speeds[:48] if wind_speeds else [12.0]
        h48_dirs = wind_dirs[:48] if wind_dirs else [315.0]
        h48_precip = sum(precips[:48]) if precips else 0.0

        # Mean wind direction calculation (vector average)
        def vector_mean_wind(angles, speeds):
            if not angles:
                return 315.0
            u = sum(s * math.sin(math.radians(a)) for a, s in zip(angles, speeds))
            v = sum(s * math.cos(math.radians(a)) for a, s in zip(angles, speeds))
            avg_rad = math.atan2(u, v)
            avg_deg = (math.degrees(avg_rad) + 360) % 360
            return round(avg_deg, 1)

        mean_dir_24 = vector_mean_wind(h24_dirs, h24_wind)
        mean_dir_48 = vector_mean_wind(h48_dirs, h48_wind)

        mean_temp_24 = float(sum(h24_temps) / len(h24_temps)) if h24_temps else 28.0
        min_rh_24 = float(min(h24_rh)) if h24_rh else 35.0
        mean_wind_24 = float(sum(h24_wind) / len(h24_wind)) if h24_wind else 10.0

        mean_temp_48 = float(sum(h48_temps) / len(h48_temps)) if h48_temps else 28.0
        min_rh_48 = float(min(h48_rh)) if h48_rh else 35.0
        mean_wind_48 = float(sum(h48_wind) / len(h48_wind)) if h48_wind else 10.0

        # Calculate Fire Weather Index (FWI proxy 0.0 - 1.0)
        # FWI increases with: low min RH, higher temp, moderate/high wind, 0 rain
        fwi_24 = self._calculate_fire_weather_index(mean_temp_24, min_rh_24, mean_wind_24, h24_precip)
        fwi_48 = self._calculate_fire_weather_index(mean_temp_48, min_rh_48, mean_wind_48, h48_precip)

        retrieval_iso = datetime.now(timezone.utc).isoformat()

        return {
            "source": "Open-Meteo ECMWF/GFS Forecast API",
            "retrieval_timestamp": retrieval_iso,
            "is_live": True,
            "latitude": lat,
            "longitude": lon,
            "horizon_24h": {
                "avg_temperature_c": round(mean_temp_24, 1),
                "min_relative_humidity_pct": round(min_rh_24, 1),
                "avg_wind_speed_kmh": round(mean_wind_24, 1),
                "prevailing_wind_direction_deg": mean_dir_24,
                "wind_compass": self._deg_to_compass(mean_dir_24),
                "total_precipitation_mm": round(h24_precip, 2),
                "fire_weather_index": round(fwi_24, 2),
                "fwi_category": self._fwi_category(fwi_24)
            },
            "horizon_48h": {
                "avg_temperature_c": round(mean_temp_48, 1),
                "min_relative_humidity_pct": round(min_rh_48, 1),
                "avg_wind_speed_kmh": round(mean_wind_48, 1),
                "prevailing_wind_direction_deg": mean_dir_48,
                "wind_compass": self._deg_to_compass(mean_dir_48),
                "total_precipitation_mm": round(h48_precip, 2),
                "fire_weather_index": round(fwi_48, 2),
                "fwi_category": self._fwi_category(fwi_48)
            },
            "hourly_samples": [
                {
                    "time": times[i],
                    "temperature": temps[i],
                    "humidity": humidities[i],
                    "wind_speed": wind_speeds[i],
                    "wind_direction": wind_dirs[i],
                    "precipitation": precips[i]
                }
                for i in range(min(12, len(times)))
            ]
        }

    def _calculate_fire_weather_index(self, temp: float, min_rh: float, wind_speed: float, precip: float) -> float:
        """
        Computes normalized fire weather index (0.0 to 1.0).
        """
        # If significant precipitation occurred, fire risk drops to near zero
        if precip >= 2.0:
            return 0.05
        elif precip > 0.2:
            precip_dampener = 0.4
        else:
            precip_dampener = 1.0

        # Dryness factor (lower RH -> higher risk)
        # Punjab autumn RH ranges from 25% (very dry) to 80% (humid)
        rh_factor = max(0.0, min(1.0, (75.0 - min_rh) / 50.0))

        # Temperature factor (higher daytime heat -> faster stubble desiccation)
        temp_factor = max(0.0, min(1.0, (temp - 18.0) / 18.0))

        # Wind factor (10-30 km/h accelerates burning & draft)
        wind_factor = max(0.0, min(1.0, wind_speed / 25.0))

        raw_fwi = (0.45 * rh_factor + 0.30 * wind_factor + 0.25 * temp_factor) * precip_dampener
        return float(max(0.05, min(1.0, raw_fwi)))

    def _fwi_category(self, fwi: float) -> str:
        if fwi >= 0.75:
            return "Extreme Fire Spread Conditions"
        elif fwi >= 0.55:
            return "Elevated Burning Risk"
        elif fwi >= 0.35:
            return "Moderate Conditions"
        else:
            return "Low Fire Weather Risk"

    def _deg_to_compass(self, deg: float) -> str:
        val = int((deg / 22.5) + 0.5)
        arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
               "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        return arr[val % 16]

    def _fallback_forecast(self, lat: float, lon: float, reason: str) -> Dict[str, Any]:
        """
        Typical historical Punjab autumn post-monsoon climatology fallback.
        Clear skies, northwest winds (315°), dry afternoon (RH ~38%), temp ~29°C.
        """
        retrieval_iso = datetime.now(timezone.utc).isoformat()
        return {
            "source": "Punjab Post-Monsoon Climatology (Offline Fallback)",
            "retrieval_timestamp": retrieval_iso,
            "is_live": False,
            "fallback_reason": reason,
            "latitude": lat,
            "longitude": lon,
            "horizon_24h": {
                "avg_temperature_c": 28.5,
                "min_relative_humidity_pct": 36.0,
                "avg_wind_speed_kmh": 12.4,
                "prevailing_wind_direction_deg": 315.0,
                "wind_compass": "NW",
                "total_precipitation_mm": 0.0,
                "fire_weather_index": 0.68,
                "fwi_category": "Elevated Burning Risk"
            },
            "horizon_48h": {
                "avg_temperature_c": 29.0,
                "min_relative_humidity_pct": 34.0,
                "avg_wind_speed_kmh": 14.1,
                "prevailing_wind_direction_deg": 320.0,
                "wind_compass": "NW",
                "total_precipitation_mm": 0.0,
                "fire_weather_index": 0.72,
                "fwi_category": "Elevated Burning Risk"
            },
            "hourly_samples": []
        }


weather_service = WeatherService()
