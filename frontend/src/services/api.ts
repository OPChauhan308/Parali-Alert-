import { RiskRankingsData, UnitRecord, ActiveFireItem, EvaluationData } from '../types';

const BASE_URL = '/api';

export const api = {
  async getStudyAreas(): Promise<any> {
    const res = await fetch(`${BASE_URL}/study-areas`);
    if (!res.ok) throw new Error('Failed to fetch study areas');
    return res.json();
  },

  async getDistrictsGeoJson(): Promise<any> {
    const res = await fetch(`${BASE_URL}/districts-geojson`);
    if (!res.ok) throw new Error('Failed to fetch districts geojson');
    return res.json();
  },

  async getUnitsGeoJson(horizon: number = 48): Promise<any> {
    const res = await fetch(`${BASE_URL}/units-geojson?horizon=${horizon}`);
    if (!res.ok) throw new Error('Failed to fetch units geojson');
    return res.json();
  },

  async getRiskRankings(params: {
    horizon?: number;
    district?: string;
    category?: string;
    search?: string;
  } = {}): Promise<RiskRankingsData> {
    const query = new URLSearchParams();
    if (params.horizon) query.set('horizon', params.horizon.toString());
    if (params.district && params.district !== 'all') query.set('district', params.district);
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`${BASE_URL}/risk-rankings?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch risk rankings');
    return res.json();
  },

  async getUnitDetail(unitId: string, horizon: number = 48): Promise<{
    unit: UnitRecord;
    spectral_details: any;
    weather_forecast: any;
    active_fires: any;
  }> {
    const res = await fetch(`${BASE_URL}/unit/${encodeURIComponent(unitId)}?horizon=${horizon}`);
    if (!res.ok) throw new Error(`Failed to fetch unit ${unitId}`);
    return res.json();
  },

  async getActiveFires(): Promise<{
    source: string;
    retrieved_at: string;
    total_active_clusters: number;
    fires: ActiveFireItem[];
  }> {
    const res = await fetch(`${BASE_URL}/fires`);
    if (!res.ok) throw new Error('Failed to fetch active fires');
    return res.json();
  },

  async getWeather(district: string = 'Sangrur'): Promise<any> {
    const res = await fetch(`${BASE_URL}/weather?district=${encodeURIComponent(district)}`);
    if (!res.ok) throw new Error('Failed to fetch weather');
    return res.json();
  },

  async historicalReplay(date: string, horizon: number = 48): Promise<{
    replay_date: string;
    is_historical_replay: boolean;
    data_leakage_prevented: boolean;
    total_evaluated: number;
    rankings: UnitRecord[];
  }> {
    const res = await fetch(`${BASE_URL}/replay?date=${encodeURIComponent(date)}&horizon=${horizon}`);
    if (!res.ok) throw new Error('Failed to run historical replay');
    return res.json();
  },

  async getEvaluationBenchmarks(): Promise<EvaluationData> {
    const res = await fetch(`${BASE_URL}/evaluate`);
    if (!res.ok) throw new Error('Failed to fetch evaluation benchmarks');
    return res.json();
  },

  async toggleDataMode(mode: 'live' | 'sample'): Promise<any> {
    const res = await fetch(`${BASE_URL}/mode?mode=${mode}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle data mode');
    return res.json();
  },

  getExportUrl(horizon: number = 48): string {
    return `${BASE_URL}/export?horizon=${horizon}`;
  }
};
