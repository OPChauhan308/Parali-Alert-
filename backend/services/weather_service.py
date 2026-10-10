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
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from config.settings import settings, STORAGE_DIR

logger = logging.getLogger("weather_service")


class WeatherService:
    def __init__(self):
        self.base_url = settings.OPEN_METEO_BASE_URL
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl_seconds = settings.WEATHER_CACHE_MINUTES * 60
        self.disk_cache_path = STORAGE_DIR / "weather_cache.json"
        self._load_disk_cache()

    def _load_disk_cache(self):
        """Loads cached forecast data from persistent disk storage."""
        if self.disk_cache_path.exists():
            try:
                with open(self.disk_cache_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    now = time.time()
                    # Filter out expired entries
                    self.cache = {
                        k: v for k, v in data.items()
                        if (now - v.get("timestamp", 0)) < self.cache_ttl_seconds
                    }
            except Exception as e:
                logger.warning(f"Could not load weather disk cache: {e}")

    def _save_disk_cache(self):
        """Persists memory cache to disk storage atomically using tempfile + os.replace."""
        import os
        import tempfile
        try:
            temp_fd, temp_path = tempfile.mkstemp(dir=STORAGE_DIR, prefix="weather_cache_", suffix=".tmp")
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(self.cache, f)
            os.replace(temp_path, self.disk_cache_path)
        except Exception as e:
            logger.warning(f"Could not save weather disk cache atomically: {e}")

    def _cache_key(self, lat: float, lon: float) -> str:
        # Snap to 0.1 degree grid (~10km) for sensible caching across adjacent blocks
        return f"{round(lat, 1)}:{round(lon, 1)}"

    async def fetch_forecasts_batch(self, coords: List[Tuple[float, float]]) -> Dict[Tuple[float, float], Dict[str, Any]]:
        """
        Batch queries Open-Meteo for multiple coordinates in a single HTTP network request.
        Collapses multiple roundtrips into 1, dramatically accelerating operational evaluation.
        """
        now = time.time()
        results: Dict[Tuple[float, float], Dict[str, Any]] = {}
        uncached: List[Tuple[float, float]] = []

        # 1. Check in-memory/disk cache first
        for lat, lon in coords:
            key = self._cache_key(lat, lon)
            if key in self.cache and (now - self.cache[key]["timestamp"]) < self.cache_ttl_seconds:
                results[(lat, lon)] = self.cache[key]["data"]
            else:
                uncached.append((lat, lon))

        if not uncached:
            return results

        # Deduplicate uncached coordinates by snap grid
        unique_uncached: List[Tuple[float, float]] = []
        seen_keys = set()
        for c in uncached:
            k = self._cache_key(c[0], c[1])
            if k not in seen_keys:
                seen_keys.add(k)
                unique_uncached.append(c)

        # 2. Query Open-Meteo in a single multi-coordinate batch call
        params = {
            "latitude": ",".join(str(round(c[0], 3)) for c in unique_uncached),
            "longitude": ",".join(str(round(c[1], 3)) for c in unique_uncached),
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability",
            "forecast_days": 3,
            "timezone": "Asia/Kolkata"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(self.base_url, params=params)
                if resp.status_code == 200:
                    raw_data = resp.json()
                    # Open-Meteo returns a list if >1 coordinate was queried, or a dict if 1
                    raw_list = raw_data if isinstance(raw_data, list) else [raw_data]
                    for idx, c in enumerate(unique_uncached):
                        c_raw = raw_list[idx] if idx < len(raw_list) else raw_list[0]
                        processed = self._process_open_meteo(c_raw, c[0], c[1])
                        key = self._cache_key(c[0], c[1])
                        self.cache[key] = {
                            "timestamp": now,
                            "data": processed
                        }
                    self._save_disk_cache()
                else:
                    logger.warning(f"Open-Meteo batch returned HTTP {resp.status_code}, using climatology fallbacks")
                    for c in unique_uncached:
                        key = self._cache_key(c[0], c[1])
                        self.cache[key] = {
                            "timestamp": now,
                            "data": self._fallback_forecast(c[0], c[1], f"Open-Meteo HTTP {resp.status_code}")
                        }
        except Exception as e:
            logger.warning(f"Weather batch API error: {e}, using climatology fallbacks")
            for c in unique_uncached:
                key = self._cache_key(c[0], c[1])
                self.cache[key] = {
                    "timestamp": now,
                    "data": self._fallback_forecast(c[0], c[1], f"Network error: {str(e)}")
                }

        # Populate all requested coords from cache
        for lat, lon in coords:
            key = self._cache_key(lat, lon)
            if key in self.cache:
                results[(lat, lon)] = self.cache[key]["data"]
            else:
                results[(lat, lon)] = self._fallback_forecast(lat, lon, "Cache lookup failed")

        return results

    async def fetch_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Retrieves 48h hourly forecast from Open-Meteo with local memory and disk caching.
        Falls back to seasonal climatology forecast if network fails.
        """
        batch = await self.fetch_forecasts_batch([(lat, lon)])
        return batch.get((lat, lon), self._fallback_forecast(lat, lon, "Fallback"))

    def _process_open_meteo(self, raw: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
        hourly = raw.get("hourly", {})
        times = hourly.get("time", [])[:48]
        temps = hourly.get("temperature_2m", [])[:48]
        humidities = hourly.get("relative_humidity_2m", [])[:48]
        wind_speeds = hourly.get("wind_speed_10m", [])[:48]
        wind_dirs = hourly.get("wind_direction_10m", [])[:48]
        precips = hourly.get("precipitation", [])[:48]

        # 24h & 48h aggregates with configurable climatology fallbacks
        def_temp = settings.CLIMATOLOGY_DEFAULT_TEMP_C
        def_rh = settings.CLIMATOLOGY_DEFAULT_RH_PCT
        def_wind = settings.CLIMATOLOGY_DEFAULT_WIND_KMH
        def_dir = settings.CLIMATOLOGY_DEFAULT_WIND_DEG

        h24_temps = temps[:24] if temps else [def_temp]
        h24_rh = humidities[:24] if humidities else [def_rh]
        h24_wind = wind_speeds[:24] if wind_speeds else [def_wind]
        h24_dirs = wind_dirs[:24] if wind_dirs else [def_dir]
        h24_precip = sum(precips[:24]) if precips else 0.0

        h48_temps = temps[:48] if temps else [def_temp]
        h48_rh = humidities[:48] if humidities else [def_rh]
        h48_wind = wind_speeds[:48] if wind_speeds else [def_wind]
        h48_dirs = wind_dirs[:48] if wind_dirs else [def_dir]
        h48_precip = sum(precips[:48]) if precips else 0.0

        # Mean wind direction calculation (vector average)
        def vector_mean_wind(angles, speeds):
            if not angles:
                return def_dir
            u = sum(s * math.sin(math.radians(a)) for a, s in zip(angles, speeds))
            v = sum(s * math.cos(math.radians(a)) for a, s in zip(angles, speeds))
            avg_rad = math.atan2(u, v)
            avg_deg = (math.degrees(avg_rad) + 360) % 360
            return round(avg_deg, 1)

        mean_dir_24 = vector_mean_wind(h24_dirs, h24_wind)
        mean_dir_48 = vector_mean_wind(h48_dirs, h48_wind)

        mean_temp_24 = float(sum(h24_temps) / len(h24_temps)) if h24_temps else def_temp
        min_rh_24 = float(min(h24_rh)) if h24_rh else def_rh
        mean_wind_24 = float(sum(h24_wind) / len(h24_wind)) if h24_wind else def_wind

        mean_temp_48 = float(sum(h48_temps) / len(h48_temps)) if h48_temps else def_temp
        min_rh_48 = float(min(h48_rh)) if h48_rh else def_rh
        mean_wind_48 = float(sum(h48_wind) / len(h48_wind)) if h48_wind else def_wind

        # Calculate Fire Weather Index (FWI proxy 0.0 - 1.0)
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
        Computes normalized fire weather index (0.0 to 1.0) using configured weights.
        """
        if precip >= 2.0:
            return 0.05
        elif precip > 0.2:
            precip_dampener = 0.4
        else:
            precip_dampener = 1.0

        rh_factor = max(0.0, min(1.0, (75.0 - min_rh) / 50.0))
        temp_factor = max(0.0, min(1.0, (temp - 18.0) / 18.0))
        wind_factor = max(0.0, min(1.0, wind_speed / 25.0))

        raw_fwi = (
            settings.FWI_WEIGHT_RH * rh_factor +
            settings.FWI_WEIGHT_WIND * wind_factor +
            settings.FWI_WEIGHT_TEMP * temp_factor
        ) * precip_dampener
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
        Punjab autumn post-monsoon climatology fallback using configured physical baselines.
        """
        retrieval_iso = datetime.now(timezone.utc).isoformat()
        temp_24 = settings.CLIMATOLOGY_DEFAULT_TEMP_C
        rh_24 = settings.CLIMATOLOGY_DEFAULT_RH_PCT
        wind_24 = settings.CLIMATOLOGY_DEFAULT_WIND_KMH
        dir_24 = settings.CLIMATOLOGY_DEFAULT_WIND_DEG
        fwi_24 = self._calculate_fire_weather_index(temp_24, rh_24, wind_24, 0.0)

        temp_48 = temp_24 + 0.5
        rh_48 = max(20.0, rh_24 - 2.0)
        wind_48 = wind_24 + 1.7
        dir_48 = (dir_24 + 5.0) % 360
        fwi_48 = self._calculate_fire_weather_index(temp_48, rh_48, wind_48, 0.0)

        return {
            "source": "Punjab Post-Monsoon Climatology (Offline Fallback)",
            "retrieval_timestamp": retrieval_iso,
            "is_live": False,
            "fallback_reason": reason,
            "latitude": lat,
            "longitude": lon,
            "horizon_24h": {
                "avg_temperature_c": round(temp_24, 1),
                "min_relative_humidity_pct": round(rh_24, 1),
                "avg_wind_speed_kmh": round(wind_24, 1),
                "prevailing_wind_direction_deg": round(dir_24, 1),
                "wind_compass": self._deg_to_compass(dir_24),
                "total_precipitation_mm": 0.0,
                "fire_weather_index": round(fwi_24, 2),
                "fwi_category": self._fwi_category(fwi_24)
            },
            "horizon_48h": {
                "avg_temperature_c": round(temp_48, 1),
                "min_relative_humidity_pct": round(rh_48, 1),
                "avg_wind_speed_kmh": round(wind_48, 1),
                "prevailing_wind_direction_deg": round(dir_48, 1),
                "wind_compass": self._deg_to_compass(dir_48),
                "total_precipitation_mm": 0.0,
                "fire_weather_index": round(fwi_48, 2),
                "fwi_category": self._fwi_category(fwi_48)
            },
            "hourly_samples": []
        }


weather_service = WeatherService()
