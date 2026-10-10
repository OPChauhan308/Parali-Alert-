import { useState, useMemo } from 'react';
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
  Search,
  Filter,
  Tractor,
  Award,
  Globe,
} from 'lucide-react';
import { useStore, GridCell } from '../store/useStore';
import { translations } from '../data/translations';

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
  const { min, max, range } = useMemo(() => {
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    return { min: minVal, max: maxVal, range: maxVal - minVal || 1 };
  }, [data]);

  const w = 70;
  const h = 20;
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
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2"
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
  const isBackendLive = useStore((s) => s.isBackendLive);
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const setLanguage = useStore((s) => s.setLanguage);
  const t = translations[lang];

  // Filtering & Search (N17)
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');

  const filteredGrids = useMemo(() => {
    let list = [...grids];
    if (districtFilter !== 'All') {
      list = list.filter((g) => g.district.toLowerCase() === districtFilter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.risk_score - a.risk_score);
  }, [grids, districtFilter, search]);

  const selectedGrid = grids.find((g) => g.id === selectedGridId);

  return (
    <div className="fixed left-4 top-4 bottom-20 w-[380px] z-30 flex flex-col gap-3 pointer-events-auto">
      {/* Header Panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shrink-0 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Crosshair className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight leading-none">{t.app_title}</h1>
            <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase mt-0.5">{t.mission_control}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(lang === 'en' ? 'pa' : 'en')}
              className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-medium flex items-center gap-1 transition-colors"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>{t.switch_lang}</span>
            </button>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isBackendLive ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className={`text-[10px] font-mono ${isBackendLive ? 'text-green-400' : 'text-amber-400'}`}>
                {isBackendLive ? t.live : t.offline}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/5">
            <div className="text-red-400 font-bold font-mono text-base">{summary.critical_count}</div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{t.critical_units}</div>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/5">
            <div className="text-orange-400 font-bold font-mono text-base">{summary.high_count}</div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{t.high_risk}</div>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/5">
            <div className="text-amber-400 font-bold font-mono text-base">
              {(summary.avg_risk_score * 100).toFixed(0)}%
            </div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{t.avg_risk}</div>
          </div>
          <div className="bg-white/[0.04] rounded-xl p-2.5 text-center border border-white/5">
            <div className="text-cyan-400 font-bold font-mono text-base">
              {(summary.total_population_at_risk / 1000).toFixed(0)}k
            </div>
            <div className="text-[9px] text-white/40 uppercase tracking-wider mt-0.5">{t.at_risk_pop}</div>
          </div>
        </div>

        {/* Action Tool Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveModal('farmer_report')}
            className="bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 font-medium text-[11px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Tractor className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.farmer_portal}</span>
          </button>
          <button
            onClick={() => setActiveModal('evaluation')}
            className="bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 text-purple-300 font-medium text-[11px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.eval_benchmarks}</span>
          </button>
        </div>
      </motion.div>

      {/* Intervention Queue Panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1 flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between mb-2.5 shrink-0">
          <h2 className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
            {t.intervention_queue} ({filteredGrids.length})
          </h2>
          <span className="text-cyan-400 text-[10px] font-mono">PRIORITIZED</span>
        </div>

        {/* Search and District Filter Controls (N17) */}
        <div className="grid grid-cols-5 gap-2 mb-3 shrink-0">
          <div className="col-span-3 relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="col-span-2">
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full bg-[#141720] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="All">{t.all_districts}</option>
              <option value="Sangrur">Sangrur</option>
              <option value="Ludhiana">Ludhiana</option>
              <option value="Bathinda">Bathinda</option>
              <option value="Tarn Taran">Tarn Taran</option>
            </select>
          </div>
        </div>

        {/* Scrollable Ranked Unit Cards */}
        <div className="overflow-y-auto space-y-2 pr-1 flex-1">
          {filteredGrids.map((grid) => {
            const badge = getRiskBadge(grid.risk_level);
            const BadgeIcon = badge.icon;
            const isSelected = grid.id === selectedGridId;

            return (
              <div
                key={grid.id}
                onClick={() => setSelectedGrid(grid.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white/10 border-cyan-400/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-xs">{grid.name}</span>
                    <span className="text-white/30 text-[10px] font-mono">{grid.district}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${badge.bg} ${badge.text}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5" />
                      {grid.risk_level}
                    </span>
                    <span className="text-white font-mono font-bold text-xs">
                      {(grid.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                  <span className="text-amber-400/90 font-medium truncate max-w-[200px]">
                    {grid.burn_window}
                  </span>
                  <MiniSparkline
                    data={grid.sparkline_risk_7d}
                    color={grid.risk_score >= 0.7 ? '#ef4444' : '#f97316'}
                  />
                </div>

                {/* Intervention Action Button */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-[10px] text-white/40 truncate max-w-[190px]">
                    {grid.recommended_action || 'CRM Dispatch'}
                  </span>
                  {grid.intervention_status === 'dispatched' ? (
                    <span className="text-[10px] text-green-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {t.dispatched_status}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatchIntervention(grid.id);
                      }}
                      className="px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-300 text-[10px] font-medium transition-colors"
                    >
                      {t.dispatch_super_seeder}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
