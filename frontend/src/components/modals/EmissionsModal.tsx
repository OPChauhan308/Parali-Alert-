import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CloudFog, DollarSign, X, Leaf, Car, ShieldAlert, Sparkles, Flame } from 'lucide-react';
import { useStore, GridCell } from '../../store/useStore';
import { fetchEmissionsSummary, fetchUnitEmissions, EmissionsSummary } from '../../api/client';
import { translations } from '../../data/translations';

export default function EmissionsModal({ unit }: { unit: GridCell | undefined }) {
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];

  const [regionalSummary, setRegionalSummary] = useState<EmissionsSummary | null>(null);
  const [unitEmissions, setUnitEmissions] = useState<any | null>(null);
  const [viewScope, setViewScope] = useState<'regional' | 'unit'>('regional');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchEmissionsSummary().then((res) => setRegionalSummary(res)).catch(() => {}),
      unit ? fetchUnitEmissions(unit.id).then((res) => setUnitEmissions(res)).catch(() => {}) : Promise.resolve(null),
    ]).finally(() => setLoading(false));
  }, [unit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0b0d14] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-orange-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
              <CloudFog className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">
                ICAR / IPCC Crop Residue Carbon & Emission Calculator
              </h2>
              <p className="text-white/40 text-[11px]">
                Tier-2 Stubble Burning Emission Modeling & Social Cost of Carbon (SCC)
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('none')}
            className="text-white/40 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-white/5 bg-black/30">
          <button
            onClick={() => setViewScope('regional')}
            className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
              viewScope === 'regional'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            Regional Punjab Pilot Scope
          </button>
          {unit && (
            <button
              onClick={() => setViewScope('unit')}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors ${
                viewScope === 'unit'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-white/40 hover:text-white'
              }`}
            >
              Selected Unit ({unit.id}) Scope
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-20 text-center text-white/50 animate-pulse">
              Calculating Atmospheric Emissions & Social Cost of Carbon...
            </div>
          ) : viewScope === 'regional' && regionalSummary ? (
            <>
              {/* Regional Big Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-center">
                  <div className="text-red-400 font-bold font-mono text-2xl">
                    {regionalSummary.potential_co2_tonnes.toLocaleString()} t
                  </div>
                  <div className="text-white/80 font-medium text-[11px] mt-1">Potential CO₂</div>
                  <div className="text-white/40 text-[10px]">Unburned Residue Burning</div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3.5 text-center">
                  <div className="text-orange-400 font-bold font-mono text-2xl">
                    {(regionalSummary.potential_pm25_kg / 1000).toFixed(1)} t
                  </div>
                  <div className="text-white/80 font-medium text-[11px] mt-1">Fine PM2.5 Soot</div>
                  <div className="text-white/40 text-[10px]">Direct Respiratory Hazard</div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-center">
                  <div className="text-amber-400 font-bold font-mono text-2xl">
                    {(regionalSummary.potential_black_carbon_kg / 1000).toFixed(2)} t
                  </div>
                  <div className="text-white/80 font-medium text-[11px] mt-1">Black Carbon</div>
                  <div className="text-white/40 text-[10px]">Short-Lived Climate Forcer</div>
                </div>
              </div>

              {/* Avoided Climate & Health Impact Card */}
              <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-emerald-300 font-semibold text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Projected Pre-Fire Intervention Dividend
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
                    80% Targeted Mitigation
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Avoided CO₂</div>
                    <div className="text-emerald-400 font-bold font-mono text-lg">
                      {regionalSummary.projected_intervention_impact.avoided_co2_tonnes.toLocaleString()} t
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Avoided PM2.5</div>
                    <div className="text-teal-300 font-bold font-mono text-lg">
                      {(regionalSummary.projected_intervention_impact.avoided_pm25_kg / 1000).toFixed(1)} t
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Avoided Social Cost</div>
                    <div className="text-amber-400 font-bold font-mono text-base">
                      ₹{(regionalSummary.projected_intervention_impact.avoided_social_cost_inr / 10000000).toFixed(2)} Cr
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-white/70 text-[11px] bg-black/30 p-2 rounded-lg">
                  <Car className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Equivalent to removing{' '}
                    <strong className="text-white font-mono">
                      {regionalSummary.projected_intervention_impact.equivalent_cars_off_road_annual.toLocaleString()}
                    </strong>{' '}
                    gasoline passenger cars from the road for an entire year.
                  </span>
                </div>
              </div>
            </>
          ) : unitEmissions ? (
            <>
              {/* Unit Specific Breakdown */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white font-semibold">
                    {unit?.name} ({unit?.id})
                  </div>
                  <span className="text-white/40 font-mono">
                    {unitEmissions.residue_hectares} ha residue ({unitEmissions.estimated_straw_tonnes} t straw)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-black/40 p-2 rounded border border-white/5 flex justify-between">
                    <span className="text-white/50">Carbon Dioxide (CO₂)</span>
                    <span className="font-mono text-white font-bold">{unitEmissions.potential_emissions_kg.co2.toLocaleString()} kg</span>
                  </div>
                  <div className="bg-black/40 p-2 rounded border border-white/5 flex justify-between">
                    <span className="text-white/50">Carbon Monoxide (CO)</span>
                    <span className="font-mono text-white font-bold">{unitEmissions.potential_emissions_kg.co.toLocaleString()} kg</span>
                  </div>
                  <div className="bg-black/40 p-2 rounded border border-white/5 flex justify-between">
                    <span className="text-white/50">Particulate PM2.5</span>
                    <span className="font-mono text-red-400 font-bold">{unitEmissions.potential_emissions_kg.pm25} kg</span>
                  </div>
                  <div className="bg-black/40 p-2 rounded border border-white/5 flex justify-between">
                    <span className="text-white/50">Black Carbon Soot</span>
                    <span className="font-mono text-amber-400 font-bold">{unitEmissions.potential_emissions_kg.black_carbon} kg</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-emerald-400 font-semibold text-xs">Preventable Damage on Intervention</div>
                    <div className="text-white/50 text-[10px]">Avoided Social Cost of Carbon: ₹{unitEmissions.intervention_benefits.avoided_scc_inr.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-300 font-bold text-sm">
                      -{unitEmissions.intervention_benefits.avoided_co2_tonnes} t CO₂
                    </div>
                    <div className="font-mono text-teal-300 text-[10px]">
                      -{unitEmissions.intervention_benefits.avoided_pm25_kg} kg PM2.5
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
