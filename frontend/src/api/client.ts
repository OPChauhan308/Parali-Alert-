/**
 * Parali Alert - Full Geospatial & ML API Client
 * Connects frontend directly to the FastAPI backend service.
 * Supports all operational endpoints and novelty additions (WhatsApp, Farmer reports, CPCB, Emissions, Imagery).
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface BackendUnitRecord {
  unit_id: string;
  name: string;
  district: string;
  coordinates: [number, number];
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  cropland_hectares: number;
  priority_score: number;
  priority_category: string;
  fire_risk_score: number;
  intervention_opportunity_score: number;
  residue_opportunity_score: number;
  estimated_unburned_residue_hectares: number;
  consequence_factor: number;
  agricultural_state: string;
  preventability_status: string;
  days_since_harvest?: number;
  preventability_window_explanation: string;
  top_contributing_drivers: Array<{
    factor_name: string;
    raw_value: number;
    weight: number;
    weighted_contribution: number;
    description: string;
  }>;
  recommended_intervention: {
    action_type: string;
    urgency: string;
    target_department: string;
    operational_guidance: string;
    machinery_recommendation: string;
  };
}

export interface RiskRankingsApiResponse {
  horizon_hours: number;
  total_evaluated: number;
  total_returned: number;
  data_mode: string;
  refreshed_at: string;
  summary_stats: {
    critical_prevention_units: number;
    high_prevention_units: number;
    active_fire_dispatch_units: number;
    total_unburned_residue_hectares: number;
    average_priority_score: number;
  };
  rankings: BackendUnitRecord[];
}

export interface CPCBStation {
  station_id: string;
  station_name: string;
  city: string;
  district: string;
  coordinates: [number, number];
  elevation_m: number;
  pm25: number;
  pm10: number;
  no2: number;
  aqi: number;
  category: string;
  color: string;
  health_advisory: string;
  prominent_pollutant: string;
  smoke_plume_impact: string;
  last_updated: string;
}

export interface EmissionsSummary {
  summary_scope: string;
  total_at_risk_residue_hectares: number;
  potential_co2_tonnes: number;
  potential_pm25_kg: number;
  potential_black_carbon_kg: number;
  projected_intervention_impact: {
    avoided_co2_tonnes: number;
    avoided_pm25_kg: number;
    avoided_social_cost_inr: number;
    equivalent_cars_off_road_annual: number;
  };
}

export interface SatelliteComparisonData {
  unit_id: string;
  coordinates: [number, number];
  tile_id: string;
  sensor: string;
  ground_resolution_m: number;
  pre_harvest: {
    acquisition_date: string;
    scene_cloud_cover_pct: number;
    classification: string;
    ndvi: number;
    ndti: number;
    reflectance_profile: Record<string, number>;
    composite_palette: string[];
    raster_chips?: {
      true_color: string;
      false_color_cir: string;
      swir_stubble: string;
    };
  };
  post_harvest: {
    acquisition_date: string;
    scene_cloud_cover_pct: number;
    classification: string;
    ndvi: number;
    ndti: number;
    reflectance_profile: Record<string, number>;
    composite_palette: string[];
    raster_chips?: {
      true_color: string;
      false_color_cir: string;
      swir_stubble: string;
    };
  };
  change_detection: {
    delta_ndvi: number;
    delta_ndti: number;
    drop_magnitude_pct: number;
    stubble_presence_confidence: number;
    harvest_window_detected: string;
    operational_summary: string;
  };
}

// ==========================================
// API FETCH HELPERS
// ==========================================

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchUnitsGeoJSON(horizon = 48) {
  const res = await fetch(`${BASE_URL}/api/units-geojson?horizon=${horizon}`);
  if (!res.ok) throw new Error(`Failed to fetch units GeoJSON: ${res.statusText}`);
  return res.json();
}

export async function fetchRiskRankings(horizon = 48, district?: string, category?: string, search?: string) {
  const params = new URLSearchParams({ horizon: horizon.toString() });
  if (district && district !== 'All') params.append('district', district);
  if (category && category !== 'All') params.append('category', category);
  if (search) params.append('search', search);

  const res = await fetch(`${BASE_URL}/api/risk-rankings?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch risk rankings: ${res.statusText}`);
  return res.json() as Promise<RiskRankingsApiResponse>;
}

export async function fetchUnitDetail(unitId: string, horizon = 48) {
  const res = await fetch(`${BASE_URL}/api/unit/${unitId}?horizon=${horizon}`);
  if (!res.ok) throw new Error(`Failed to fetch unit detail for ${unitId}: ${res.statusText}`);
  return res.json();
}

export async function fetchActiveFires() {
  const res = await fetch(`${BASE_URL}/api/fires`);
  if (!res.ok) throw new Error(`Failed to fetch active fires: ${res.statusText}`);
  return res.json();
}

export async function fetchWeather(district = 'Sangrur') {
  const res = await fetch(`${BASE_URL}/api/weather?district=${encodeURIComponent(district)}`);
  if (!res.ok) throw new Error(`Failed to fetch weather: ${res.statusText}`);
  return res.json();
}

export async function fetchReplay(date: string, horizon = 48) {
  const res = await fetch(`${BASE_URL}/api/replay?date=${encodeURIComponent(date)}&horizon=${horizon}`);
  if (!res.ok) throw new Error(`Failed to fetch historical replay: ${res.statusText}`);
  return res.json();
}

export async function fetchEvaluationBenchmarks() {
  const res = await fetch(`${BASE_URL}/api/evaluate`);
  if (!res.ok) throw new Error(`Failed to fetch evaluation benchmarks: ${res.statusText}`);
  return res.json();
}

// ==========================================
// NOVEL FEATURE ENDPOINTS
// ==========================================

export async function dispatchWhatsAppAlert(payload: {
  unit_id: string;
  recipient_phone?: string;
  recipient_name?: string;
  language?: 'en' | 'pa';
}) {
  const res = await fetch(`${BASE_URL}/api/alerts/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to dispatch WhatsApp alert: ${res.statusText}`);
  return res.json();
}

export async function submitFarmerReport(payload: {
  farmer_name: string;
  phone: string;
  district: string;
  unit_id: string;
  village: string;
  land_area_acres?: number;
  crop_type?: string;
  harvest_status?: string;
  harvest_date?: string;
  residue_action?: string;
  machinery_requested?: boolean;
  notes?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/farmer-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to submit farmer report: ${res.statusText}`);
  return res.json();
}

export async function fetchFarmerReports(district?: string, unitId?: string) {
  const params = new URLSearchParams();
  if (district && district !== 'All') params.append('district', district);
  if (unitId) params.append('unit_id', unitId);

  const res = await fetch(`${BASE_URL}/api/farmer-reports?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch farmer reports: ${res.statusText}`);
  return res.json();
}

export async function fetchCPCBStations(district?: string) {
  const params = district && district !== 'All' ? `?district=${encodeURIComponent(district)}` : '';
  const res = await fetch(`${BASE_URL}/api/air-quality/cpcb-stations${params}`);
  if (!res.ok) throw new Error(`Failed to fetch CPCB stations: ${res.statusText}`);
  return res.json() as Promise<{
    source: string;
    timestamp: string;
    average_regional_aqi: number;
    regional_category: string;
    total_stations: number;
    stations: CPCBStation[];
  }>;
}

export async function fetchEmissionsSummary(horizon = 48) {
  const res = await fetch(`${BASE_URL}/api/emissions/summary?horizon=${horizon}`);
  if (!res.ok) throw new Error(`Failed to fetch emissions summary: ${res.statusText}`);
  return res.json() as Promise<EmissionsSummary>;
}

export async function fetchUnitEmissions(unitId: string) {
  const res = await fetch(`${BASE_URL}/api/emissions/unit/${unitId}`);
  if (!res.ok) throw new Error(`Failed to fetch unit emissions: ${res.statusText}`);
  return res.json();
}

export async function fetchSatelliteComparison(unitId: string, date?: string) {
  const params = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BASE_URL}/api/satellite/comparison/${unitId}${params}`);
  if (!res.ok) throw new Error(`Failed to fetch satellite comparison: ${res.statusText}`);
  return res.json() as Promise<SatelliteComparisonData>;
}
