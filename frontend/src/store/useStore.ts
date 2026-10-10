import { create } from 'zustand';
import mockData from '../data/mock_state.json';

export interface GridCell {
  id: string;
  name: string;
  district: string;
  centroid: [number, number];
  polygon: number[][];
  risk_score: number;
  risk_level: string;
  burn_window: string;
  harvest_progress: number;
  ndvi: number;
  ndti: number;
  residue_density_tons_ha: number;
  soil_moisture: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  temperature_c: number;
  humidity_pct: number;
  aqi_current: number;
  aqi_predicted_48h: number;
  population_downwind: number;
  nearest_city_downwind: string;
  intervention_status: string;
  sparkline_ndvi_7d: number[];
  sparkline_ndti_7d: number[];
  sparkline_risk_7d: number[];
  sparkline_aqi_7d: number[];
}

export interface WindDrift {
  id: string;
  source_grid: string;
  target_city: string;
  waypoints: { coordinates: [number, number]; timestamp: number }[];
}

export interface TelemetryEntry {
  ts: string;
  source: string;
  msg: string;
}

interface AppState {
  grids: GridCell[];
  windDrifts: WindDrift[];
  telemetry: TelemetryEntry[];
  summary: typeof mockData.summary;
  selectedGridId: string | null;
  hoveredGridId: string | null;
  timelineHour: number;
  animationTime: number;
  setSelectedGrid: (id: string | null) => void;
  setHoveredGrid: (id: string | null) => void;
  setTimelineHour: (hour: number) => void;
  setAnimationTime: (time: number) => void;
  dispatchIntervention: (gridId: string) => void;
}

export const useStore = create<AppState>((set) => ({
  grids: mockData.grids as GridCell[],
  windDrifts: mockData.wind_drift_paths as WindDrift[],
  telemetry: mockData.telemetry_feed as TelemetryEntry[],
  summary: mockData.summary,
  selectedGridId: null,
  hoveredGridId: null,
  timelineHour: 0,
  animationTime: 0,

  setSelectedGrid: (id) => set({ selectedGridId: id }),
  setHoveredGrid: (id) => set({ hoveredGridId: id }),
  setTimelineHour: (hour) => set({ timelineHour: hour }),
  setAnimationTime: (time) => set({ animationTime: time }),

  dispatchIntervention: (gridId) =>
    set((state) => ({
      grids: state.grids.map((g) =>
        g.id === gridId
          ? { ...g, intervention_status: 'dispatched', risk_score: 0.0, risk_level: 'MITIGATED' }
          : g
      ),
    })),
}));
