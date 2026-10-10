/**
 * API Client for Parali Alert Backend
 *
 * Currently unused — the app runs on mock_state.json.
 * Swap in these calls to connect to the FastAPI backend served by api/routes.py.
 *
 * Base URL should be set via VITE_API_BASE_URL environment variable.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchRiskGrids() {
  const res = await fetch(`${BASE_URL}/api/v1/risk/grids`);
  if (!res.ok) throw new Error(`Failed to fetch grids: ${res.statusText}`);
  return res.json();
}

export async function fetchWindDrifts() {
  const res = await fetch(`${BASE_URL}/api/v1/weather/wind-drift`);
  if (!res.ok) throw new Error(`Failed to fetch wind drifts: ${res.statusText}`);
  return res.json();
}

export async function fetchAirQuality(gridId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/air-quality/${gridId}`);
  if (!res.ok) throw new Error(`Failed to fetch AQI: ${res.statusText}`);
  return res.json();
}

export async function dispatchIntervention(gridId: string) {
  const res = await fetch(`${BASE_URL}/api/v1/interventions/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grid_id: gridId, type: 'bio_decomposer' }),
  });
  if (!res.ok) throw new Error(`Failed to dispatch: ${res.statusText}`);
  return res.json();
}

export async function fetchTelemetry() {
  const res = await fetch(`${BASE_URL}/api/v1/telemetry/feed`);
  if (!res.ok) throw new Error(`Failed to fetch telemetry: ${res.statusText}`);
  return res.json();
}
