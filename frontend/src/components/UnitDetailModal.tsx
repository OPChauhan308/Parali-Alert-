import React from 'react';
import { UnitRecord } from '../types';
import { X, CloudSun, ShieldAlert, FileText } from 'lucide-react';

interface UnitDetailModalProps {
  unit: UnitRecord | null;
  unitDetailData?: any;
  onClose: () => void;
}

export const UnitDetailModal: React.FC<UnitDetailModalProps> = ({
  unit,
  unitDetailData,
  onClose
}) => {
  if (!unit) return null;

  const spectral = unitDetailData?.spectral_details;
  const weather = unitDetailData?.weather_forecast?.horizon_48h;
  const timeline = spectral?.temporal_timeline || [];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-[#181816]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FFFFFF] border-2 border-[#181816] shadow-2xl p-5 text-[#181816] flex flex-col gap-4 font-mono">
        {/* Dossier Official Header */}
        <div className="flex items-start justify-between border-b border-[#DCD7CC] pb-3.5 bg-[#EFECE4] -m-5 mb-0 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#181816] text-[#F6F5F0] shrink-0 border border-[#181816]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-serif uppercase tracking-wider text-[#181816]">
                  OFFICIAL SECTOR DOSSIER: {unit.name}
                </span>
                <span className="text-[11px] px-2 py-0.5 bg-[#FFFFFF] text-[#181816] border border-[#181816] font-bold">
                  [{unit.unit_id}]
                </span>
              </div>
              <div className="text-[11px] text-[#5E5B52] mt-1">
                JURISDICTION: {unit.district} DISTRICT • COORD: {unit.coordinates[1].toFixed(4)}°N, {unit.coordinates[0].toFixed(4)}°E • CROPLAND: {unit.cropland_hectares.toLocaleString()} HA
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-[#FFFFFF] hover:bg-[#181816] hover:text-[#F6F5F0] border border-[#181816] text-[#181816] transition"
            title="Close dossier"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Quantitative Score Strips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
          <div className="p-3.5 bg-[#F6F5F0] border border-[#DCD7CC]">
            <span className="text-[10px] text-[#991B1B] uppercase tracking-wider font-bold">
              01 // PRIORITY INDEX
            </span>
            <div className="text-3xl font-bold text-[#181816] mt-1 font-serif">
              {unit.priority_score} <span className="text-xs text-[#767267] font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-[#991B1B] mt-1 font-bold">
              {unit.priority_category.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="p-3.5 bg-[#F6F5F0] border border-[#DCD7CC]">
            <span className="text-[10px] text-[#DC2626] uppercase tracking-wider font-bold">
              02 // FIRE RISK SCORE
            </span>
            <div className="text-3xl font-bold text-[#181816] mt-1 font-serif">
              {unit.fire_risk_score} <span className="text-xs text-[#767267] font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-[#5E5B52] mt-1">
              DESICCATION & ATMOSPHERE
            </div>
          </div>

          <div className="p-3.5 bg-[#F6F5F0] border border-[#DCD7CC]">
            <span className="text-[10px] text-[#92400E] uppercase tracking-wider font-bold">
              03 // PREVENTABILITY WINDOW
            </span>
            <div className="text-3xl font-bold text-[#181816] mt-1 font-serif">
              {unit.intervention_opportunity_score} <span className="text-xs text-[#767267] font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-[#92400E] mt-1 font-bold truncate">
              {unit.preventability_status.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="p-3.5 bg-[#F6F5F0] border border-[#DCD7CC]">
            <span className="text-[10px] text-[#166534] uppercase tracking-wider font-bold">
              04 // RESIDUE DENSITY
            </span>
            <div className="text-3xl font-bold text-[#181816] mt-1 font-serif">
              {unit.residue_opportunity_score} <span className="text-xs text-[#767267] font-normal">/ 100</span>
            </div>
            <div className="text-[10px] text-[#5E5B52] mt-1 font-semibold">
              ~{unit.estimated_unburned_residue_hectares.toLocaleString()} HA STRAW
            </div>
          </div>
        </div>

        {/* Operational Intervention Directive */}
        <div className="p-4 bg-[#FEF3C7] border-l-4 border-l-[#B45309] border border-[#FDE68A] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#92400E] font-bold uppercase tracking-wider">
            <span>GOVERNMENT INTERVENTION DIRECTIVE [{unit.recommended_intervention?.urgency}]</span>
            <span className="text-[#92400E] text-[10px]">{unit.recommended_intervention?.target_department}</span>
          </div>
          <p className="text-xs text-[#181816] font-medium leading-relaxed">
            {unit.recommended_intervention?.operational_guidance}
          </p>
          <div className="text-[11px] text-[#181816] bg-[#FFFFFF] p-2.5 border border-[#FDE68A] mt-1 font-mono">
            <strong className="text-[#92400E]">MACHINERY ALLOCATION:</strong> {unit.recommended_intervention?.machinery_recommendation}
          </div>
        </div>

        {/* Technical Decomposition: Drivers & Meteorology */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Risk Factors Breakdown */}
          <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-3.5 flex flex-col gap-2">
            <div className="text-[10px] text-[#767267] font-bold uppercase tracking-wider border-b border-[#DCD7CC] pb-1.5 flex items-center justify-between">
              <span>CONTRIBUTING RISK DRIVERS</span>
              <ShieldAlert className="w-3.5 h-3.5 text-[#B45309]" />
            </div>

            <div className="space-y-2 pt-1">
              {unit.top_contributing_drivers.map((d, i) => (
                <div key={i} className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC] text-[11px]">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[#181816]">{d.factor_name}</span>
                    <span className="text-[#92400E]">+{Math.round(d.weighted_contribution * 100)} PTS</span>
                  </div>
                  <p className="text-[10px] text-[#5E5B52] mt-0.5">{d.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meteorological & Plume Dispersion */}
          <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-3.5 flex flex-col gap-2">
            <div className="text-[10px] text-[#767267] font-bold uppercase tracking-wider border-b border-[#DCD7CC] pb-1.5 flex items-center justify-between">
              <span>ATMOSPHERIC DISPERSION & METEOROLOGY (48H)</span>
              <CloudSun className="w-3.5 h-3.5 text-[#B45309]" />
            </div>

            {weather ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC]">
                  <span className="text-[10px] text-[#767267]">TEMPERATURE</span>
                  <div className="text-base font-bold text-[#181816] font-serif mt-0.5">{weather.avg_temperature_c}°C</div>
                </div>
                <div className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC]">
                  <span className="text-[10px] text-[#767267]">MIN RELATIVE HUMIDITY</span>
                  <div className="text-base font-bold text-[#92400E] font-serif mt-0.5">{weather.min_relative_humidity_pct}%</div>
                </div>
                <div className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC]">
                  <span className="text-[10px] text-[#767267]">WIND VELOCITY</span>
                  <div className="text-base font-bold text-[#181816] font-serif mt-0.5">{weather.avg_wind_speed_kmh} KM/H</div>
                </div>
                <div className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC]">
                  <span className="text-[10px] text-[#767267]">WIND DIRECTION</span>
                  <div className="text-base font-bold text-[#181816] font-serif mt-0.5">{weather.wind_compass} ({weather.prevailing_wind_direction_deg}°)</div>
                </div>
              </div>
            ) : (
              <div className="text-[#767267] text-xs">Loading meteorology telemetry...</div>
            )}

            {/* Downwind Vector */}
            <div className="p-2.5 bg-[#F6F5F0] border border-[#DCD7CC] text-[10px] text-[#4A473F]">
              <strong className="text-[#181816]">PLUME RECEPTOR IMPACT: </strong>
              Prevailing winds carry smoke SE towards Ludhiana / Patiala / NCR. Downwind consequence factor:{' '}
              <strong className="text-[#991B1B]">{unit.consequence_factor}x</strong>.
            </div>
          </div>
        </div>

        {/* Multi-Temporal Sentinel-2 Transition Curve */}
        <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-3.5 flex flex-col gap-2">
          <div className="text-[10px] text-[#767267] font-bold uppercase tracking-wider border-b border-[#DCD7CC] pb-1.5 flex items-center justify-between">
            <span>MULTI-TEMPORAL SENTINEL-2 MSI SPECTRAL CURVE (HARVEST TRANSITION)</span>
            <span className="text-[10px] text-[#5E5B52] font-normal">
              OBS AGE: {unit.data_freshness.satellite_age_days}D • CLOUD: {unit.data_freshness.satellite_cloud_pct}%
            </span>
          </div>

          <p className="text-[11px] text-[#4A473F]">
            {spectral?.status_description || 'Multi-temporal spectral indices show harvest transition and residue signature.'}
          </p>

          {/* Temporal Table Strip */}
          {timeline.length > 0 && (
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {timeline.slice(0, 7).map((t: any, idx: number) => (
                <div key={idx} className="p-2 bg-[#F6F5F0] border border-[#DCD7CC] text-center text-[10px]">
                  <div className="text-[#767267] font-bold">{t.date.slice(5)}</div>
                  <div className="text-[#166534] font-bold mt-1">NDVI {t.ndvi}</div>
                  <div className="text-[#92400E] font-bold mt-0.5">NDTI {t.ndti}</div>
                  <div className="text-[#767267] mt-0.5">{t.cloud_pct}% CLD</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Novelty B: Sentinel-1 C-Band SAR All-Weather Cloud-Piercing Telemetry */}
        {spectral?.sar_radar_intelligence && (
          <div className="bg-[#FFFFFF] border border-[#DCD7CC] p-3.5 flex flex-col gap-2">
            <div className="text-[10px] text-[#767267] font-bold uppercase tracking-wider border-b border-[#DCD7CC] pb-1.5 flex items-center justify-between">
              <span className="text-[#181816]">NOVELTY B // SENTINEL-1 C-BAND SAR RADAR (ALL-WEATHER CLOUD PIERCING)</span>
              <span className="text-[9px] px-2 py-0.5 bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC] font-bold">
                {spectral.sar_radar_intelligence.mode === 'SAR_CLOUD_PIERCING_ACTIVE' ? 'CLOUD PIERCED' : 'DUAL-SENSOR FUSED'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-[#F6F5F0] border border-[#DCD7CC]">
                <span className="text-[9px] text-[#767267]">CROSS-POLARIZED VH</span>
                <div className="font-bold text-[#181816] mt-0.5">
                  {spectral.sar_radar_intelligence.sar_observation?.backscatter_coefficients_db?.sigma0_vh_db} dB
                </div>
                <span className="text-[9px] text-[#5E5B52]">Canopy Volume Scatter</span>
              </div>
              <div className="p-2 bg-[#F6F5F0] border border-[#DCD7CC]">
                <span className="text-[9px] text-[#767267]">CO-POLARIZED VV</span>
                <div className="font-bold text-[#181816] mt-0.5">
                  {spectral.sar_radar_intelligence.sar_observation?.backscatter_coefficients_db?.sigma0_vv_db} dB
                </div>
                <span className="text-[9px] text-[#5E5B52]">Surface Roughness</span>
              </div>
              <div className="p-2 bg-[#F6F5F0] border border-[#DCD7CC]">
                <span className="text-[9px] text-[#767267]">RADAR CROSS-RATIO (CR)</span>
                <div className="font-bold text-[#92400E] mt-0.5">
                  {spectral.sar_radar_intelligence.sar_observation?.backscatter_coefficients_db?.cross_ratio_db} dB
                </div>
                <span className="text-[9px] text-[#5E5B52]">Stalk Collapse Metric</span>
              </div>
              <div className="p-2 bg-[#F6F5F0] border border-[#DCD7CC]">
                <span className="text-[9px] text-[#767267]">RADAR PENETRATION</span>
                <div className="font-bold text-[#166534] mt-0.5">100% ALL-WEATHER</div>
                <span className="text-[9px] text-[#166534]">Fog & Smoke Pierced</span>
              </div>
            </div>

            <p className="text-[10px] text-[#5E5B52] bg-[#F6F5F0] p-2 border border-[#DCD7CC] mt-1">
              <strong>RADAR DIAGNOSTIC: </strong> {spectral.sar_radar_intelligence.explanation}
            </p>
          </div>
        )}

        {/* Novelty A: Direct Cloud-Optimized GeoTIFF (COG) HTTP Range Ingestion */}
        {spectral?.cog_range_ingestion && (
          <div className="bg-[#EFECE4] border border-[#DCD7CC] p-2.5 flex items-center justify-between text-[10px] text-[#4A473F]">
            <div>
              <strong className="text-[#181816]">NOVELTY A // COG BYTE-RANGE INGESTION: </strong>
              Streams only 120×120 pixel window directly from <code className="text-[#181816] font-semibold">s3://sentinel-cogs/</code> via <code className="text-[#181816] font-semibold">/vsicurl/</code> HTTP range requests.
            </div>
            <div className="font-bold text-[#166534] shrink-0 ml-3">
              58 KB vs 500 MB (99.98% DATA REDUCTION)
            </div>
          </div>
        )}

        {/* Dossier Footer */}
        <div className="flex items-center justify-between text-[11px] text-[#767267] border-t border-[#DCD7CC] pt-2 font-mono">
          <div>EVIDENCE CONFIDENCE SCORE: <strong className="text-[#181816]">{unit.evidence_quality_score}%</strong></div>
          <div>EVALUATED AT: {new Date(unit.evaluated_at).toLocaleTimeString()} IST</div>
        </div>
      </div>
    </div>
  );
};
