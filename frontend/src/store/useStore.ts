import { create } from 'zustand';
import mockData from '../data/mock_state.json';
import {
  fetchUnitsGeoJSON,
  fetchCPCBStations,
  fetchEmissionsSummary,
  fetchActiveFires,
  fetchReplay,
  CPCBStation,
  EmissionsSummary
} from '../api/client';

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
  // Rich backend metadata
  cropland_hectares?: number;
  unburned_residue_ha?: number;
  recommended_action?: string;
  recommended_urgency?: string;
  operational_guidance?: string;
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

export interface RegionSummary {
  total_grids_monitored: number;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  low_count: number;
  total_population_at_risk: number;
  avg_risk_score: number;
  last_satellite_pass: string;
  next_satellite_pass: string;
}

export type ActiveModal = 'none' | 'whatsapp' | 'farmer_report' | 'satellite_compare' | 'evaluation' | 'emissions';

interface AppState {
  grids: GridCell[];
  gridsById: Record<string, GridCell>;
  allGridIds: string[];
  windDrifts: WindDrift[];
  telemetry: TelemetryEntry[];
  summary: RegionSummary;
  selectedGridId: string | null;
  hoveredGridId: string | null;
  timelineHour: number;
  animationTime: number;

  // Novelty & Production UI State
  lang: 'en' | 'pa';
  activeModal: ActiveModal;
  isBackendLive: boolean;
  filterDistrict: string;
  filterCategory: string;
  searchQuery: string;
  cpcbStations: CPCBStation[];
  emissionsSummary: EmissionsSummary | null;
  activeFiresCount: number;
  showWindParticles: boolean;
  showCpcbLayer: boolean;

  // Actions
  setSelectedGrid: (id: string | null) => void;
  setHoveredGrid: (id: string | null) => void;
  setTimelineHour: (hour: number) => Promise<void>;
  setAnimationTime: (time: number) => void;
  setLanguage: (lang: 'en' | 'pa') => void;
  setActiveModal: (modal: ActiveModal) => void;
  setFilterDistrict: (district: string) => void;
  setFilterCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  toggleWindParticles: () => void;
  toggleCpcbLayer: () => void;
  dispatchIntervention: (gridId: string) => void;
  loadLiveData: () => Promise<void>;
}

function mapPriorityToLevel(category: string, score: number): string {
  if (category.includes('CRITICAL') || score >= 80) return 'CRITICAL';
  if (category.includes('HIGH') || score >= 60) return 'HIGH';
  if (category.includes('MODERATE') || score >= 40) return 'MODERATE';
  if (category.includes('DISPATCH')) return 'OBSERVED_FIRE';
  return 'LOW';
}

const initialGrids = mockData.grids as GridCell[];
const initialGridsById = Object.fromEntries(initialGrids.map((g) => [g.id, g]));

export const useStore = create<AppState>((set, get) => ({
  grids: initialGrids,
  gridsById: initialGridsById,
  allGridIds: initialGrids.map((g) => g.id),
  windDrifts: mockData.wind_drift_paths as WindDrift[],
  telemetry: mockData.telemetry_feed as TelemetryEntry[],
  summary: mockData.summary,
  selectedGridId: null,
  hoveredGridId: null,
  timelineHour: 0,
  animationTime: 0,

  lang: 'en',
  activeModal: 'none',
  isBackendLive: false,
  filterDistrict: 'All',
  filterCategory: 'All',
  searchQuery: '',
  cpcbStations: [],
  emissionsSummary: null,
  activeFiresCount: 14,
  showWindParticles: true,
  showCpcbLayer: true,

  setSelectedGrid: (id) => set({ selectedGridId: id }),
  setHoveredGrid: (id) => set({ hoveredGridId: id }),

  setTimelineHour: async (hour) => {
    set({ timelineHour: hour });
    if (hour === 0) {
      await get().loadLiveData();
      return;
    }

    // Historical Replay Wiring (Improvement 1)
    if (hour < 0) {
      try {
        // Approximate Punjab Kharif peak burning reference date (Oct 28) shifted by hours
        const refTimestamp = new Date('2024-10-28T12:00:00Z').getTime();
        const replayDate = new Date(refTimestamp + hour * 3600 * 1000).toISOString().split('T')[0];
        const replay = await fetchReplay(replayDate, 48);

        if (replay && replay.rankings) {
          const replayMap = new Map<string, any>(replay.rankings.map((r: any) => [r.unit_id, r]));
          const currentGrids = get().grids;

          const updatedGrids: GridCell[] = currentGrids.map((g) => {
            const r = replayMap.get(g.id);
            if (!r) return g;
            const score = r.priority_score ?? 50.0;
            const normScore = Math.min(1.0, Math.max(0.0, score / 100.0));
            const level = mapPriorityToLevel(r.priority_category || '', score);

            return {
              ...g,
              risk_score: normScore,
              risk_level: level,
              burn_window: `Historical Replay: ${replayDate}`,
              harvest_progress: r.days_since_harvest ? Math.min(1.0, r.days_since_harvest / 5.0) : g.harvest_progress,
              unburned_residue_ha: r.estimated_unburned_residue_hectares ?? g.unburned_residue_ha,
              recommended_action: r.recommended_intervention?.action_type || g.recommended_action,
              recommended_urgency: r.recommended_intervention?.urgency || g.recommended_urgency,
              operational_guidance: r.recommended_intervention?.operational_guidance || g.operational_guidance,
            };
          });

          const byId = Object.fromEntries(updatedGrids.map((g) => [g.id, g]));
          set({ grids: updatedGrids, gridsById: byId });
        }
      } catch (err) {
        console.warn('Replay query failed, keeping current map state:', err);
      }
    } else {
      // Future Forecast Horizon (+1h to +48h)
      const currentGrids = get().grids;
      const updatedGrids: GridCell[] = currentGrids.map((g) => {
        const factor = 1.0 + (hour / 96.0); // Slight progression towards peak afternoon risk
        const projected = Math.min(1.0, g.risk_score * factor);
        return {
          ...g,
          risk_score: Number(projected.toFixed(2)),
          burn_window: `Forecast +${hour}h Window`,
        };
      });
      const byId = Object.fromEntries(updatedGrids.map((g) => [g.id, g]));
      set({ grids: updatedGrids, gridsById: byId });
    }
  },

  setAnimationTime: (time) => set({ animationTime: time }),
  setLanguage: (lang) => set({ lang }),
  setActiveModal: (activeModal) => set({ activeModal }),
  setFilterDistrict: (filterDistrict) => set({ filterDistrict }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleWindParticles: () => set((s) => ({ showWindParticles: !s.showWindParticles })),
  toggleCpcbLayer: () => set((s) => ({ showCpcbLayer: !s.showCpcbLayer })),

  dispatchIntervention: (gridId) =>
    set((state) => {
      const updated = state.grids.map((g) =>
        g.id === gridId
          ? { ...g, intervention_status: 'dispatched', risk_score: 0.05, risk_level: 'MITIGATED' }
          : g
      );
      return {
        grids: updated,
        gridsById: Object.fromEntries(updated.map((g) => [g.id, g])),
      };
    }),

  loadLiveData: async () => {
    try {
      // Deduplicated initial startup API calls (Optimization A9)
      // fetchUnitsGeoJSON already embeds evaluated unit scores, avoid separate fetchRiskRankings duplicate call
      const [unitsGeo, cpcbData, emissionsData, firesData] = await Promise.all([
        fetchUnitsGeoJSON(48).catch(() => null),
        fetchCPCBStations().catch(() => null),
        fetchEmissionsSummary(48).catch(() => null),
        fetchActiveFires().catch(() => null),
      ]);

      if (unitsGeo && unitsGeo.features && unitsGeo.features.length > 0) {
        const liveGrids: GridCell[] = unitsGeo.features.map((feat: any) => {
          const props = feat.properties;
          const uid = props.unit_id;

          // Extract polygon ring
          let polygon: number[][] = [];
          if (feat.geometry && feat.geometry.type === 'Polygon') {
            polygon = feat.geometry.coordinates[0];
          } else if (feat.geometry && feat.geometry.type === 'MultiPolygon') {
            polygon = feat.geometry.coordinates[0][0];
          }

          const score = props.priority_score ?? 50.0;
          const normScore = Math.min(1.0, Math.max(0.0, score / 100.0));
          const level = mapPriorityToLevel(props.priority_category || '', score);

          // Synthesize 7d risk sparkline from current score
          const sparklineRisk = [
            Math.max(0.1, normScore - 0.35),
            Math.max(0.1, normScore - 0.28),
            Math.max(0.15, normScore - 0.20),
            Math.max(0.2, normScore - 0.12),
            Math.max(0.25, normScore - 0.05),
            Math.max(0.3, normScore),
            normScore,
          ].map((v) => Number(v.toFixed(2)));

          const baseAqi = 150 + Math.round(normScore * 180);
          const sparklineAqi = [
            baseAqi - 55,
            baseAqi - 40,
            baseAqi - 30,
            baseAqi - 20,
            baseAqi - 10,
            baseAqi,
            baseAqi + Math.round(normScore * 40),
          ];

          return {
            id: uid,
            name: props.name || uid,
            district: props.district || 'Sangrur',
            centroid: [props.lon, props.lat],
            polygon: polygon.length > 0 ? polygon : [
              [props.lon - 0.04, props.lat - 0.04],
              [props.lon + 0.04, props.lat - 0.04],
              [props.lon + 0.04, props.lat + 0.04],
              [props.lon - 0.04, props.lat + 0.04],
              [props.lon - 0.04, props.lat - 0.04],
            ],
            risk_score: normScore,
            risk_level: level,
            burn_window: `Optimal Window: ${props.urgency || 'Next 24-48h'}`,
            harvest_progress: props.days_since_harvest ? Math.min(1.0, props.days_since_harvest / 5.0) : 0.8,
            // Use live telemetry provided by backend (Fixing Issue B2)
            ndvi: props.ndvi ?? (props.agricultural_state === 'STANDING_CROP' ? 0.65 : 0.24),
            ndti: props.ndti ?? (props.agricultural_state === 'HARVESTED_UNBURNED' ? 0.26 : 0.12),
            residue_density_tons_ha: props.residue_density_tons_ha ?? 4.8,
            soil_moisture: props.soil_moisture ?? 0.22,
            wind_speed_kmh: props.wind_speed_kmh ?? 14,
            wind_direction_deg: props.wind_direction_deg ?? 315,
            temperature_c: props.temperature_c ?? 27,
            humidity_pct: props.humidity_pct ?? 46,
            aqi_current: baseAqi,
            aqi_predicted_48h: baseAqi + Math.round(normScore * 65),
            population_downwind: props.population_downwind ?? 110000,
            nearest_city_downwind: props.nearest_city_downwind ?? `${props.district} Urban`,
            intervention_status: 'pending',
            sparkline_ndvi_7d: props.sparkline_ndvi_7d && props.sparkline_ndvi_7d.length > 0 ? props.sparkline_ndvi_7d : [0.65, 0.60, 0.52, 0.45, 0.38, 0.28, 0.24],
            sparkline_ndti_7d: props.sparkline_ndti_7d && props.sparkline_ndti_7d.length > 0 ? props.sparkline_ndti_7d : [0.08, 0.11, 0.14, 0.18, 0.22, 0.25, 0.26],
            sparkline_risk_7d: sparklineRisk,
            sparkline_aqi_7d: sparklineAqi,
            cropland_hectares: props.cropland_hectares || 12500,
            unburned_residue_ha: props.estimated_unburned_residue_hectares || 340,
            recommended_action: props.action_type || 'Deploy Super Seeder',
            recommended_urgency: props.urgency || 'HIGH',
            operational_guidance: props.operational_guidance || 'Deploy field CRM machinery.',
          };
        });

        // Compute updated summary stats
        const critCount = liveGrids.filter((g) => g.risk_level === 'CRITICAL').length;
        const highCount = liveGrids.filter((g) => g.risk_level === 'HIGH').length;

        // Normalized store (byId, allIds) for fine-grained subscriptions (Optimization A7)
        const gridsById = Object.fromEntries(liveGrids.map((g) => [g.id, g]));
        const allGridIds = liveGrids.map((g) => g.id);

        set({
          grids: liveGrids,
          gridsById,
          allGridIds,
          isBackendLive: true,
          cpcbStations: cpcbData?.stations || [],
          emissionsSummary: emissionsData || null,
          activeFiresCount: firesData?.total_active_clusters ?? 18,
          summary: {
            total_grids_monitored: liveGrids.length,
            critical_count: critCount,
            high_count: highCount,
            moderate_count: liveGrids.filter((g) => g.risk_level === 'MODERATE').length,
            low_count: liveGrids.filter((g) => g.risk_level === 'LOW').length,
            total_population_at_risk: liveGrids.reduce((acc, g) => acc + g.population_downwind, 0),
            avg_risk_score: Number(
              (liveGrids.reduce((acc, g) => acc + g.risk_score, 0) / liveGrids.length).toFixed(3)
            ),
            last_satellite_pass: new Date().toISOString(),
            next_satellite_pass: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          },
        });
      }
    } catch (err) {
      console.warn('Backend live sync skipped, continuing with local dataset:', err);
    }
  },
}));
