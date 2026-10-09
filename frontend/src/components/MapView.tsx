import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { UnitRecord, ActiveFireItem } from '../types';
import { SlidersHorizontal } from 'lucide-react';

interface MapViewProps {
  units: UnitRecord[];
  activeFires: ActiveFireItem[];
  selectedUnit: UnitRecord | null;
  onSelectUnit: (unit: UnitRecord) => void;
  districtsGeoJson?: any;
}

export const MapView: React.FC<MapViewProps> = ({
  units,
  activeFires,
  selectedUnit,
  onSelectUnit,
  districtsGeoJson
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const firesLayerRef = useRef<L.LayerGroup | null>(null);
  const districtsLayerRef = useRef<L.GeoJSON | null>(null);

  // Layer Visibility State
  const [showChoropleth, setShowChoropleth] = useState(true);
  const [showFires, setShowFires] = useState(true);
  const [showDistricts, setShowDistricts] = useState(true);
  const [colorMode, setColorMode] = useState<'priority' | 'residue' | 'state'>('priority');

  // District Presets
  const districtPresets = [
    { name: 'PUNJAB REGION', center: [30.45, 75.60], zoom: 8 },
    { name: 'SANGRUR EPICENTER', center: [30.24, 75.84], zoom: 10 },
    { name: 'LUDHIANA AGRO-BELT', center: [30.85, 75.80], zoom: 10 },
    { name: 'BATHINDA SECTOR', center: [30.20, 75.05], zoom: 10 },
    { name: 'TARN TARAN (MAJHA)', center: [31.40, 74.90], zoom: 10 },
  ];

  // Initialize Map with Crisp Light Institutional Cartography
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [30.45, 75.60],
      zoom: 8,
      zoomControl: false,
      attributionControl: false
    });

    // Clean unwatermarked Esri World Light Gray Base tiles
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{x}/{y}', {
      maxZoom: 16,
      attribution: 'Esri, HERE, Garmin, FAO, USGS, NGA'
    }).addTo(map);

    firesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update District Outlines
  useEffect(() => {
    if (!mapRef.current || !districtsGeoJson) return;

    if (districtsLayerRef.current) {
      districtsLayerRef.current.remove();
    }

    if (showDistricts) {
      districtsLayerRef.current = L.geoJSON(districtsGeoJson, {
        style: {
          color: '#181816',
          weight: 1.5,
          dashArray: '3, 4',
          fillColor: 'transparent',
          fillOpacity: 0
        }
      }).addTo(mapRef.current);
    }
  }, [districtsGeoJson, showDistricts]);

  // Determine Polygon Color
  const getFeatureColor = (unit: UnitRecord) => {
    if (colorMode === 'priority') {
      if (unit.priority_category === 'OBSERVED_FIRE_DISPATCH') return '#DC2626';
      if (unit.priority_category === 'UNCERTAIN_VERIFICATION') return '#78716C';
      if (unit.priority_score >= 75) return '#B91C1C';
      if (unit.priority_score >= 55) return '#D97706';
      if (unit.priority_score >= 35) return '#78716C';
      return '#15803D';
    } else if (colorMode === 'residue') {
      const opp = unit.residue_opportunity_score;
      if (opp >= 70) return '#15803D';
      if (opp >= 45) return '#D97706';
      return '#78716C';
    } else {
      switch (unit.agricultural_state) {
        case 'STANDING_CROP': return '#15803D';
        case 'RECENTLY_HARVESTED': return '#D97706';
        case 'POSSIBLY_BURNED': return '#DC2626';
        default: return '#78716C';
      }
    }
  };

  // Render Units GeoJSON
  useEffect(() => {
    if (!mapRef.current || !units.length) return;

    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.remove();
    }

    if (!showChoropleth) return;

    const geoData: any = {
      type: 'FeatureCollection',
      features: units.map(u => ({
        type: 'Feature',
        id: u.unit_id,
        geometry: u.geometry,
        properties: u
      }))
    };

    geojsonLayerRef.current = L.geoJSON(geoData, {
      style: (feature) => {
        const u = feature?.properties as UnitRecord;
        const isSelected = selectedUnit?.unit_id === u.unit_id;
        return {
          fillColor: getFeatureColor(u),
          weight: isSelected ? 2.5 : 1.0,
          opacity: 1,
          color: isSelected ? '#181816' : '#FFFFFF',
          fillOpacity: isSelected ? 0.75 : 0.45
        };
      },
      onEachFeature: (feature, layer) => {
        const u = feature.properties as UnitRecord;

        const popupContent = `
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px; min-width: 230px; color: #181816;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #181816; padding-bottom: 4px; margin-bottom: 6px;">
              <span style="font-weight: 700; font-family: 'Newsreader', serif; font-size: 13px;">${u.name.toUpperCase()}</span>
              <span style="color: #B45309; font-weight: 700;">[${u.unit_id}]</span>
            </div>
            <div style="color: #5E5B52; font-size: 10px; margin-bottom: 6px;">
              DISTRICT: ${u.district} | CROPLAND: ${u.cropland_hectares.toLocaleString()} HA
            </div>
            <div style="background: #F6F5F0; padding: 6px; border: 1px solid #DCD7CC; margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #767267;">PRIORITY SCORE:</span>
                <span style="font-weight: 700; color: #991B1B;">${u.priority_score} / 100</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span style="color: #767267;">CROP STATE:</span>
                <span style="color: #181816; font-weight: 600;">${u.agricultural_state.replace('_', ' ')}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #767267;">PREVENTABILITY:</span>
                <span style="color: #92400E; font-weight: 600;">${u.preventability_status.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div style="font-size: 10px; color: #181816; margin-bottom: 4px;">
              <strong>DISPATCH DIRECTIVE:</strong> ${u.recommended_intervention?.action_type?.replace(/_/g, ' ') || 'MONITOR'}
            </div>
            <div style="font-size: 9px; color: #181816; text-align: right; text-transform: uppercase; font-weight: 700;">
              [CLICK TO OPEN SECTOR DOSSIER]
            </div>
          </div>
        `;

        layer.bindPopup(popupContent);

        layer.on({
          click: () => {
            onSelectUnit(u);
          },
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              fillOpacity: 0.85,
              weight: 2.0
            });
          },
          mouseout: (e) => {
            if (geojsonLayerRef.current) {
              geojsonLayerRef.current.resetStyle(e.target);
            }
          }
        });
      }
    }).addTo(mapRef.current);
  }, [units, selectedUnit, showChoropleth, colorMode]);

  // Render NASA FIRMS Active Fire Points
  useEffect(() => {
    if (!mapRef.current || !firesLayerRef.current) return;

    firesLayerRef.current.clearLayers();

    if (!showFires) return;

    activeFires.forEach(fire => {
      const circle = L.circleMarker([fire.latitude, fire.longitude], {
        radius: 6,
        fillColor: '#DC2626',
        color: '#FFFFFF',
        weight: 1.5,
        opacity: 1.0,
        fillOpacity: 0.95,
        className: 'thermal-anomaly-marker'
      });

      const popup = `
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px; color: #181816;">
          <div style="font-weight: 700; color: #B91C1C; margin-bottom: 4px; border-bottom: 1px solid #B91C1C; padding-bottom: 2px;">
            [ACTIVE THERMAL ANOMALY // FIRMS VIIRS]
          </div>
          <div>FRP: ${fire.frp_mw} MW</div>
          <div>CONFIDENCE: ${fire.confidence.toUpperCase()}</div>
          <div>TIMESTAMP: ${fire.acq_datetime.replace('T', ' ').replace('Z', ' UTC')}</div>
          <div>INSTRUMENT: ${fire.satellite} (${fire.instrument})</div>
          <div style="margin-top: 4px; font-size: 9px; color: #991B1B; background: #FEE2E2; border: 1px solid #FCA5A5; padding: 4px; font-weight: 600;">
            FIELD ALERT: Active stubble fire requires immediate fire-suppression response.
          </div>
        </div>
      `;
      circle.bindPopup(popup);
      firesLayerRef.current?.addLayer(circle);
    });
  }, [activeFires, showFires]);

  const handleJumpToDistrict = (center: [number, number], zoom: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo(center, zoom, { duration: 0.8 });
    }
  };

  return (
    <div className="relative w-full h-[620px] bg-[#EAE6DC] border border-[#DCD7CC] overflow-hidden shadow-sm">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Left: District Switcher Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1 bg-[#FFFFFF] border border-[#DCD7CC] p-1 font-mono text-[10px] shadow-sm">
        {districtPresets.map((p) => (
          <button
            key={p.name}
            onClick={() => handleJumpToDistrict(p.center as [number, number], p.zoom)}
            className="px-2.5 py-1 text-[#4A473F] hover:text-[#181816] hover:bg-[#F6F5F0] transition font-bold"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Top Right: Layer & Metric Selectors */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 font-mono text-[11px]">
        {/* Layer Checkboxes */}
        <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-3 flex flex-col gap-2 min-w-[190px] shadow-sm">
          <div className="text-[10px] text-[#767267] uppercase tracking-wider font-bold border-b border-[#DCD7CC] pb-1 flex items-center justify-between">
            <span>MAP LAYERS</span>
            <SlidersHorizontal className="w-3 h-3 text-[#181816]" />
          </div>

          <label className="flex items-center justify-between text-[#181816] cursor-pointer hover:text-[#000000] font-semibold text-[11px]">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#D97706]"></span>
              Risk Polygons
            </span>
            <input
              type="checkbox"
              checked={showChoropleth}
              onChange={(e) => setShowChoropleth(e.target.checked)}
              className="accent-[#181816]"
            />
          </label>

          <label className="flex items-center justify-between text-[#181816] cursor-pointer hover:text-[#000000] font-semibold text-[11px]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
              FIRMS Active ({activeFires.length})
            </span>
            <input
              type="checkbox"
              checked={showFires}
              onChange={(e) => setShowFires(e.target.checked)}
              className="accent-[#B91C1C]"
            />
          </label>

          <label className="flex items-center justify-between text-[#5E5B52] cursor-pointer hover:text-[#181816] text-[11px]">
            <span>District Borders</span>
            <input
              type="checkbox"
              checked={showDistricts}
              onChange={(e) => setShowDistricts(e.target.checked)}
              className="accent-[#181816]"
            />
          </label>
        </div>

        {/* Metric Mode Switcher */}
        <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-1 flex items-center gap-1 text-[10px] shadow-sm">
          <button
            onClick={() => setColorMode('priority')}
            className={`px-2.5 py-1 font-bold transition ${
              colorMode === 'priority' ? 'bg-[#181816] text-[#F6F5F0]' : 'text-[#5E5B52] hover:text-[#181816]'
            }`}
          >
            PRIORITY
          </button>
          <button
            onClick={() => setColorMode('residue')}
            className={`px-2.5 py-1 font-bold transition ${
              colorMode === 'residue' ? 'bg-[#181816] text-[#F6F5F0]' : 'text-[#5E5B52] hover:text-[#181816]'
            }`}
          >
            RESIDUE
          </button>
          <button
            onClick={() => setColorMode('state')}
            className={`px-2.5 py-1 font-bold transition ${
              colorMode === 'state' ? 'bg-[#181816] text-[#F6F5F0]' : 'text-[#5E5B52] hover:text-[#181816]'
            }`}
          >
            STATE
          </button>
        </div>
      </div>

      {/* Bottom Left: Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-[#FFFFFF] border border-[#DCD7CC] p-3 font-mono text-[10px] shadow-sm">
        <div className="text-[#767267] uppercase font-bold mb-2 tracking-wider border-b border-[#DCD7CC] pb-1">
          {colorMode === 'priority' ? 'PRIORITY SCALE' : colorMode === 'residue' ? 'RESIDUE DENSITY' : 'FIELD STATE'}
        </div>
        {colorMode === 'priority' && (
          <div className="flex flex-col gap-1.5 font-semibold text-[#181816]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#B91C1C]"></span>
              <span>&ge; 75 CRITICAL PRE-FIRE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#D97706]"></span>
              <span>55–74 HIGH OUTREACH</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#78716C]"></span>
              <span>35–54 MEDIUM MONITORING</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#15803D]"></span>
              <span>&lt; 35 LOW RISK</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse"></span>
              <span>ACTIVE THERMAL ANOMALY (FIRMS)</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Right: Coordinate / Institutional Attribution */}
      <div className="absolute bottom-3 right-3 z-20 hidden md:flex items-center gap-2 bg-[#FFFFFF]/90 border border-[#DCD7CC] px-3 py-1 text-[10px] text-[#5E5B52] font-mono shadow-sm">
        <span>EPSG:4326</span>
        <span>•</span>
        <span>PUNJAB CARTOGRAPHIC DISPATCH GRID</span>
      </div>
    </div>
  );
};
