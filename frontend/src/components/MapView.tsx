import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { Satellite, Moon, Wind, ShieldAlert } from 'lucide-react';
import { useStore, GridCell } from '../store/useStore';
import { translations } from '../data/translations';

const INITIAL_VIEW = {
  longitude: 75.5,
  latitude: 30.7,
  zoom: 7.5,
  pitch: 35,
  bearing: -8,
};

// Safe API key retrieval without hardcoding in source (H30)
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || '';

// High performance fallback styles (CARTO Dark Matter is free & requires no key)
const MAP_STYLES = {
  hybrid: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/hybrid-v4/style.json?key=${MAPTILER_KEY}`
    : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  dark: MAPTILER_KEY
    ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
    : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
};

function getRiskColor(score: number, status: string): [number, number, number, number] {
  if (status === 'dispatched') return [0, 220, 80, 160];
  if (score >= 0.8) return [255, 50, 20, 210];
  if (score >= 0.6) return [255, 140, 0, 180];
  if (score >= 0.4) return [255, 200, 40, 150];
  return [60, 180, 90, 120];
}

function getLineColor(score: number, status: string): [number, number, number, number] {
  if (status === 'dispatched') return [0, 255, 120, 240];
  if (score >= 0.8) return [255, 80, 40, 255];
  if (score >= 0.6) return [255, 160, 30, 240];
  if (score >= 0.4) return [255, 210, 60, 220];
  return [80, 200, 110, 200];
}

function getElevation(score: number, status: string): number {
  if (status === 'dispatched') return 200;
  return score * 8000;
}

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const animFrameRef = useRef<number>(0);
  const animTimeRef = useRef<number>(0);

  const [mapStyleMode, setMapStyleMode] = useState<'hybrid' | 'dark'>('hybrid');
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    grid: GridCell;
  } | null>(null);

  const grids = useStore((s) => s.grids);
  const windDrifts = useStore((s) => s.windDrifts);
  const cpcbStations = useStore((s) => s.cpcbStations);
  const showWindParticles = useStore((s) => s.showWindParticles);
  const showCpcbLayer = useStore((s) => s.showCpcbLayer);
  const toggleWindParticles = useStore((s) => s.toggleWindParticles);
  const toggleCpcbLayer = useStore((s) => s.toggleCpcbLayer);
  const setSelectedGrid = useStore((s) => s.setSelectedGrid);
  const setHoveredGrid = useStore((s) => s.setHoveredGrid);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];

  // Memoize trips data structure (O11)
  const tripsData = useMemo(() => {
    return windDrifts.map((drift) => ({
      path: drift.waypoints.map((wp) => wp.coordinates),
      timestamps: drift.waypoints.map((wp) => wp.timestamp),
      sourceGrid: drift.source_grid,
    }));
  }, [windDrifts]);

  // Memoize update triggers once per grids array change, NOT on every frame (O11)
  const gridUpdateTrigger = useMemo(() => {
    return grids.map((g) => `${g.id}:${g.risk_score}:${g.intervention_status}`).join('|');
  }, [grids]);

  // Static layers memoized independently of animation frames (Optimization B6)
  const staticLayers = useMemo(() => {
    const list: any[] = [
      // 1. Glowing Fire Risk Polygon Layer
      new PolygonLayer<GridCell>({
        id: 'risk-polygons-glow',
        data: grids,
        getPolygon: (d) => d.polygon,
        getFillColor: (d) => getRiskColor(d.risk_score, d.intervention_status),
        getLineColor: (d) => getLineColor(d.risk_score, d.intervention_status),
        getLineWidth: 2,
        lineWidthMinPixels: 1,
        getElevation: (d) => getElevation(d.risk_score, d.intervention_status),
        extruded: true,
        pickable: true,
        stroked: true,
        filled: true,
        wireframe: true,
        elevationScale: 1,
        parameters: {
          blend: true,
          blendColorOperation: 'add',
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          depthCompare: 'always',
        },
        onClick: ({ object }: { object?: GridCell }) => {
          if (object) setSelectedGrid(object.id);
        },
        onHover: ({ object, x, y }: { object?: GridCell; x: number; y: number }) => {
          if (object) {
            setHoverInfo({ x, y, grid: object });
            setHoveredGrid(object.id);
          } else {
            setHoverInfo(null);
            setHoveredGrid(null);
          }
        },
        updateTriggers: {
          getFillColor: [gridUpdateTrigger],
          getElevation: [gridUpdateTrigger],
          getLineColor: [gridUpdateTrigger],
        },
        transitions: {
          getFillColor: 600,
          getElevation: 600,
        },
      }),

      // 2. Secondary heat halo polygon for extreme hotspots
      new PolygonLayer<GridCell>({
        id: 'risk-polygons-halo',
        data: grids.filter((g) => g.risk_score >= 0.7 && g.intervention_status !== 'dispatched'),
        getPolygon: (d) => {
          const cx = d.centroid[0];
          const cy = d.centroid[1];
          const r = 0.065;
          const pts: number[][] = [];
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
          }
          pts.push(pts[0]);
          return pts;
        },
        getFillColor: (d) => {
          const intensity = Math.floor(d.risk_score * 120);
          return [255, 40 + intensity, 0, Math.floor(d.risk_score * 65)];
        },
        stroked: false,
        filled: true,
        parameters: {
          blend: true,
          blendColorOperation: 'add',
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          depthCompare: 'always',
        },
      }),
    ];

    // Live CPCB Station Layer
    if (showCpcbLayer && cpcbStations.length > 0) {
      list.push(
        new ScatterplotLayer({
          id: 'cpcb-stations-dot',
          data: cpcbStations,
          getPosition: (d: any) => d.coordinates,
          getRadius: 3800,
          radiusMinPixels: 6,
          radiusMaxPixels: 18,
          getFillColor: (d: any) => (d.aqi > 250 ? [239, 68, 68, 220] : [245, 158, 11, 200]),
          getLineColor: [255, 255, 255, 200],
          lineWidthMinPixels: 1.5,
          stroked: true,
          pickable: true,
        }),
        new TextLayer({
          id: 'cpcb-stations-label',
          data: cpcbStations,
          getPosition: (d: any) => d.coordinates,
          getText: (d: any) => `AQI ${d.aqi}`,
          getSize: 10,
          getColor: [255, 255, 255, 255],
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          pixelOffset: [12, -2],
        })
      );
    }

    return list;
  }, [grids, gridUpdateTrigger, showCpcbLayer, cpcbStations, setSelectedGrid, setHoveredGrid]);

  const staticLayersRef = useRef<any[]>(staticLayers);
  staticLayersRef.current = staticLayers;

  const buildAnimatedTripsLayer = useCallback(
    (currentTime: number) => {
      if (!showWindParticles) return null;
      return new TripsLayer({
        id: 'wind-drift-trips',
        data: tripsData,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: [255, 130, 45, 230],
        getWidth: 4,
        widthMinPixels: 3,
        widthMaxPixels: 9,
        trailLength: 600,
        currentTime,
        shadowEnabled: false,
        parameters: {
          blend: true,
          blendColorOperation: 'add',
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          depthCompare: 'always',
        },
      });
    },
    [showWindParticles, tripsData]
  );

  // Initialize MapLibre & Deck.gl MapboxOverlay
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyleMode],
      center: [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
      interactive: true,
    });

    const initialTrips = buildAnimatedTripsLayer(0);
    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: initialTrips ? [...staticLayersRef.current, initialTrips] : staticLayersRef.current,
    });

    map.addControl(overlay as unknown as maplibregl.IControl);

    mapRef.current = map;
    overlayRef.current = overlay;

    // Decoupled Animation Loop: Updates ONLY the dynamic TripsLayer without re-creating static layers! (Optimization B6)
    let start: number | null = null;
    const loop = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const curTime = elapsed % 3000;
      animTimeRef.current = curTime;

      if (overlayRef.current) {
        const trips = buildAnimatedTripsLayer(curTime);
        overlayRef.current.setProps({
          layers: trips ? [...staticLayersRef.current, trips] : staticLayersRef.current,
        });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [buildAnimatedTripsLayer, mapStyleMode]);

  // Update overlay immediately when static layers or active selection changes
  useEffect(() => {
    if (overlayRef.current) {
      const trips = buildAnimatedTripsLayer(animTimeRef.current);
      overlayRef.current.setProps({
        layers: trips ? [...staticLayers, trips] : staticLayers,
      });
    }
  }, [staticLayers, buildAnimatedTripsLayer]);

  // Switch basemap style
  const toggleMapStyle = (mode: 'hybrid' | 'dark') => {
    setMapStyleMode(mode);
    if (mapRef.current) {
      mapRef.current.setStyle(MAP_STYLES[mode]);
    }
  };

  return (
    <>
      {/* MapLibre Container */}
      <div ref={mapContainer} className="absolute inset-0 w-screen h-screen z-0" />

      {/* Floating Basemap & Layer Controls (Top Right) */}
      <div className="fixed top-4 right-[360px] z-30 pointer-events-auto flex items-center gap-2">
        {/* Basemap Switcher */}
        <div className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl">
          <button
            onClick={() => toggleMapStyle('hybrid')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${
              mapStyleMode === 'hybrid'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Satellite</span>
          </button>
          <button
            onClick={() => toggleMapStyle('dark')}
            className={`px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${
              mapStyleMode === 'dark'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
        </div>

        {/* Feature Overlays Toggle */}
        <div className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl">
          <button
            onClick={toggleWindParticles}
            title="Toggle Wind Particle Drift"
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all ${
              showWindParticles ? 'bg-orange-500/20 text-orange-400' : 'text-white/40 hover:text-white'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Wind</span>
          </button>
          <button
            onClick={toggleCpcbLayer}
            title="Toggle CPCB Air Quality Stations"
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all ${
              showCpcbLayer ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>CPCB</span>
          </button>
        </div>
      </div>

      {/* Hover HUD - Custom Trailing Dark-Mode Tooltip */}
      {hoverInfo && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-y-full mb-3 transition-transform duration-75"
          style={{
            left: hoverInfo.x + 16,
            top: hoverInfo.y - 12,
          }}
        >
          <div className="bg-black/90 backdrop-blur-xl border border-white/15 rounded-xl px-4 py-3 shadow-2xl min-w-[270px]">
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
              <div
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  backgroundColor:
                    hoverInfo.grid.risk_level === 'CRITICAL'
                      ? '#ff3320'
                      : hoverInfo.grid.risk_level === 'HIGH'
                        ? '#ff8c00'
                        : hoverInfo.grid.risk_level === 'MITIGATED'
                          ? '#00dc50'
                          : '#ffb800',
                }}
              />
              <span className="text-white font-semibold text-sm tracking-wide">
                {hoverInfo.grid.name}
              </span>
              <span
                className="ml-auto text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    hoverInfo.grid.risk_level === 'CRITICAL'
                      ? '#ff332030'
                      : hoverInfo.grid.risk_level === 'HIGH'
                        ? '#ff8c0030'
                        : hoverInfo.grid.risk_level === 'MITIGATED'
                          ? '#00dc5030'
                          : '#ffb80030',
                  color:
                    hoverInfo.grid.risk_level === 'CRITICAL'
                      ? '#ff5540'
                      : hoverInfo.grid.risk_level === 'HIGH'
                        ? '#ffa030'
                        : hoverInfo.grid.risk_level === 'MITIGATED'
                          ? '#40ff80'
                          : '#ffc840',
                }}
              >
                {hoverInfo.grid.risk_level}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-white/70">
              <span>📍 <span className="font-mono">{hoverInfo.grid.centroid[1].toFixed(3)}°N, {hoverInfo.grid.centroid[0].toFixed(3)}°E</span></span>
              <span>🔥 Risk: <span className="text-white font-mono font-bold">{(hoverInfo.grid.risk_score * 100).toFixed(0)}%</span></span>
              <span className="col-span-2">🚜 Action: <span className="text-amber-400 font-mono font-medium">{hoverInfo.grid.recommended_action || 'CRM Dispatch'}</span></span>
              <span>💨 Wind: <span className="text-white font-mono">{hoverInfo.grid.wind_speed_kmh} km/h</span></span>
              <span>🌡️ Temp: <span className="text-white font-mono">{hoverInfo.grid.temperature_c}°C</span></span>
              <span>🫁 AQI Now: <span className="text-white font-mono">{hoverInfo.grid.aqi_current}</span></span>
              <span>⚠️ AQI +48h: <span className="text-red-400 font-mono font-bold">{hoverInfo.grid.aqi_predicted_48h}</span></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
