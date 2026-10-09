export interface RiskFactor {
  factor_name: string;
  raw_value: number;
  weight: number;
  weighted_contribution: number;
  description: string;
}

export interface Recommendation {
  action_type: string;
  urgency: string;
  target_department: string;
  operational_guidance: string;
  machinery_recommendation: string;
}

export interface UnitRecord {
  unit_id: string;
  name: string;
  district: string;
  coordinates: [number, number];
  geometry: any;
  cropland_hectares: number;
  forecast_horizon_hours: number;
  priority_score: number;
  priority_category: string;
  fire_risk_score: number;
  intervention_opportunity_score: number;
  residue_opportunity_score: number;
  estimated_unburned_residue_hectares: number;
  consequence_factor: number;
  agricultural_state: string;
  preventability_status: string;
  days_since_harvest?: number | null;
  preventability_window_explanation: string;
  top_contributing_drivers: RiskFactor[];
  all_risk_factors: RiskFactor[];
  recommended_intervention: Recommendation;
  evidence_quality_score: number;
  data_freshness: {
    satellite_age_days: number;
    satellite_cloud_pct: number;
    active_fires_source: string;
    weather_is_live: boolean;
  };
  missing_data_warnings: string[];
  evaluated_at: string;
}

export interface SummaryStats {
  critical_prevention_units: number;
  high_prevention_units: number;
  active_fire_dispatch_units: number;
  total_unburned_residue_hectares: number;
  average_priority_score: number;
}

export interface RiskRankingsData {
  horizon_hours: number;
  total_evaluated: number;
  total_returned: number;
  data_mode: string;
  refreshed_at: string;
  summary_stats: SummaryStats;
  rankings: UnitRecord[];
}

export interface ActiveFireItem {
  latitude: number;
  longitude: number;
  frp_mw: number;
  confidence: string;
  acq_datetime: string;
  satellite: string;
  instrument: string;
  cluster_detections?: number;
  location_hint?: string;
  source: string;
}

export interface BenchmarkItem {
  system_name: string;
  type: string;
  precision_top_10pct: number;
  recall_top_10pct: number;
  pr_auc: number;
  lead_time_hours: number;
  limitation?: string;
  advantage?: string;
}

export interface EvaluationData {
  evaluation_title: string;
  evaluation_type: string;
  sample_size: number;
  positive_fire_rate_pct: number;
  benchmarks: BenchmarkItem[];
  district_performance: Record<string, { recall_top_10pct: number; precision_top_10pct: number; n_events: number }>;
  conclusion: string;
}
