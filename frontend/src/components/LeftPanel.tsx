import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Flame,
  Shield,
  ChevronRight,
  Leaf,
  Wind,
  Users,
  Crosshair,
  CheckCircle2,
} from 'lucide-react';
import { useStore } from '../store/useStore';

function getRiskBadge(level: string) {
  switch (level) {
    case 'CRITICAL':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: Flame };
    case 'HIGH':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: AlertTriangle };
    case 'MODERATE':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: AlertTriangle };
    case 'LOW':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: Shield };
    case 'MITIGATED':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle2 };
    default:
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: Shield };
  }
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

export default function LeftPanel() {
  const grids = useStore((s) => s.grids);
  const selectedGridId = useStore((s) => s.selectedGridId);
  const setSelectedGrid = useStore((s) => s.setSelectedGrid);
  const dispatchIntervention = useStore((s) => s.dispatchIntervention);
  const summary = useStore((s) => s.summary);

  const sorted = [...grids].sort((a, b) => b.risk_score - a.risk_score);
  const selectedGrid = grids.find((g) => g.id === selectedGridId);

  return (
    <div className="fixed left-4 top-4 bottom-20 w-[380px] z-30 flex flex-col gap-3 pointer-events-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Crosshair className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight leading-none">PARALI ALERT</h1>
            <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase mt-0.5">Mission Control • Punjab</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-mono">LIVE</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'CRITICAL', value: summary.critical_count, color: 'text-red-400' },
            { label: 'HIGH', value: summary.high_count, color: 'text-orange-400' },
            { label: 'MODERATE', value: summary.moderate_count, color: 'text-amber-400' },
            { label: 'AT RISK', value: `${(summary.total_population_at_risk / 1000).toFixed(0)}K`, color: 'text-cyan-400' },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
              <div className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-white/40 tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Intervention Queue */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl flex-1 overflow-hidden flex flex-col"
      >
        <div className="p-3 border-b border-white/5">
          <h2 className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
            Intervention Queue
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
          {sorted.map((grid, idx) => {
            const badge = getRiskBadge(grid.risk_level);
            const BadgeIcon = badge.icon;
            const isSelected = grid.id === selectedGridId;

            return (
              <motion.div
                key={grid.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelectedGrid(isSelected ? null : grid.id)}
                className={`
                  group cursor-pointer rounded-xl p-3 transition-all duration-200
                  ${isSelected
                    ? 'bg-white/10 border border-white/20 shadow-lg'
                    : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.07] hover:border-white/10'}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Priority number */}
                  <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                    <span className="text-white/30 text-[10px] font-mono font-bold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">
                        {grid.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        <BadgeIcon className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                        {grid.risk_level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                      <span>{grid.district}</span>
                      <span className="flex items-center gap-0.5">
                        <Wind className="w-3 h-3" />
                        {grid.wind_speed_kmh} km/h
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {(grid.population_downwind / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <motion.span
                      className="text-lg font-bold font-mono"
                      style={{
                        color:
                          grid.risk_level === 'CRITICAL'
                            ? '#ff4433'
                            : grid.risk_level === 'HIGH'
                              ? '#ff8c00'
                              : grid.risk_level === 'MITIGATED'
                                ? '#40ff80'
                                : '#ffb800',
                      }}
                      key={grid.risk_score}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {(grid.risk_score * 100).toFixed(0)}
                    </motion.span>
                    <MiniSparkline data={grid.sparkline_risk_7d} color="#ff6644" />
                  </div>
                </div>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-white/5">
                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: 'NDVI', value: grid.ndvi.toFixed(2), spark: grid.sparkline_ndvi_7d, color: '#22c55e' },
                            { label: 'NDTI', value: grid.ndti.toFixed(2), spark: grid.sparkline_ndti_7d, color: '#f97316' },
                            { label: 'AQI', value: grid.aqi_current, spark: grid.sparkline_aqi_7d, color: '#ef4444' },
                          ].map((m) => (
                            <div key={m.label} className="bg-white/5 rounded-lg p-2">
                              <div className="text-[9px] text-white/40 tracking-wider mb-1">{m.label}</div>
                              <div className="text-white font-mono text-sm font-bold">{m.value}</div>
                              <MiniSparkline data={m.spark} color={m.color} />
                            </div>
                          ))}
                        </div>

                        {/* Progress bars */}
                        <div className="space-y-2 mb-3">
                          <div>
                            <div className="flex justify-between text-[10px] text-white/40 mb-1">
                              <span>Harvest Progress</span>
                              <span className="text-white/60 font-mono">{(grid.harvest_progress * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
                                style={{ width: `${grid.harvest_progress * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] text-white/40 mb-1">
                              <span>Residue Density</span>
                              <span className="text-white/60 font-mono">{grid.residue_density_tons_ha} t/ha</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-600 transition-all duration-500"
                                style={{ width: `${(grid.residue_density_tons_ha / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Burn window */}
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3">
                          <div className="flex items-center gap-2">
                            <Flame className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[10px] text-red-300/80 tracking-wider">PREDICTED BURN WINDOW</span>
                          </div>
                          <p className="text-white font-mono text-sm mt-1">{grid.burn_window}</p>
                          <p className="text-white/40 text-[10px] mt-0.5">
                            <ChevronRight className="w-3 h-3 inline" />
                            Downwind: {grid.nearest_city_downwind} ({(grid.population_downwind / 1000).toFixed(0)}K pop.)
                          </p>
                        </div>

                        {/* Dispatch button */}
                        {grid.intervention_status === 'pending' ? (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              dispatchIntervention(grid.id);
                            }}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-shadow"
                          >
                            <Leaf className="w-4 h-4" />
                            Dispatch Bio-Decomposer
                          </motion.button>
                        ) : (
                          <div className="w-full py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-semibold text-sm flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Intervention Dispatched
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
