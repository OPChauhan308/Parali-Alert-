import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Satellite,
  ThermometerSun,
  Droplets,
  Wind,
  Eye,
  Radio,
  CloudRain,
  BarChart3,
  MessageSquare,
  Sparkles,
  CloudFog,
  Tractor,
} from 'lucide-react';
import { useStore, GridCell } from '../store/useStore';
import { translations } from '../data/translations';

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  sparkline,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: string;
  sparkline?: number[];
}) {
  // Optimization O12: Compute min, max, range ONCE outside the iteration
  const { min, max, range } = useMemo(() => {
    if (!sparkline || sparkline.length === 0) return { min: 0, max: 0, range: 1 };
    const maxVal = Math.max(...sparkline);
    const minVal = Math.min(...sparkline);
    return { min: minVal, max: maxVal, range: maxVal - minVal || 1 };
  }, [sparkline]);

  return (
    <div className="bg-white/[0.04] rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] text-white/40 tracking-wider uppercase">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-bold font-mono text-white">{value}</span>
          {unit && <span className="text-white/30 text-xs ml-1">{unit}</span>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <svg width="60" height="20" className="opacity-60">
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={
                `M 0,${20 - ((sparkline[0] - min) / range) * 20} ` +
                sparkline
                  .map((v, i) => `L ${(i / (sparkline.length - 1)) * 60},${20 - ((v - min) / range) * 20}`)
                  .join(' ') +
                ` L 60,20 L 0,20 Z`
              }
              fill={`url(#grad-${label})`}
            />
            <polyline
              points={sparkline
                .map((v, i) => `${(i / (sparkline.length - 1)) * 60},${20 - ((v - min) / range) * 20}`)
                .join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function RightPanel() {
  const grids = useStore((s) => s.grids);
  const telemetry = useStore((s) => s.telemetry);
  const selectedGridId = useStore((s) => s.selectedGridId);
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];

  const selectedGrid = grids.find((g) => g.id === selectedGridId);

  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [lineIdx, setLineIdx] = useState(0);

  // Sparkline points memoized for AQI (O12)
  const aqiSparklineData = useMemo(() => {
    if (!selectedGrid || !selectedGrid.sparkline_aqi_7d || selectedGrid.sparkline_aqi_7d.length === 0) return null;
    const data = selectedGrid.sparkline_aqi_7d;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const len = data.length;

    let path = `M 0,${24 - ((data[0] - min) / range) * 24}`;
    const points = data
      .map((v, i) => {
        const x = (i / (len - 1)) * 280;
        const y = 24 - ((v - min) / range) * 24;
        if (i > 0) path += ` L ${x},${y}`;
        return `${x},${y}`;
      })
      .join(' ');
    path += ` L 280,24 L 0,24 Z`;

    return { path, points };
  }, [selectedGrid]);

  // Terminal streaming effect
  useEffect(() => {
    const msgs = telemetry.map((item) => `[${item.source}] ${item.msg}`);
    if (msgs.length === 0) return;

    const interval = setInterval(() => {
      setLineIdx((prev) => {
        const next = (prev + 1) % msgs.length;
        setTerminalLines((lines) => [...lines.slice(-10), msgs[next]]);
        return next;
      });
    }, 3200);

    setTerminalLines(msgs.slice(0, 4));
    setLineIdx(3);

    return () => clearInterval(interval);
  }, [telemetry]);

  return (
    <div className="fixed right-4 top-4 bottom-20 w-[340px] z-30 flex flex-col gap-3 pointer-events-auto">
      {/* Selected Grid Telemetry */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex-1 flex flex-col overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
            {selectedGrid ? t.grid_telemetry : t.region_overview}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            <span className="text-green-400/60 text-[9px] font-mono">STREAMING</span>
          </div>
        </div>

        {selectedGrid ? (
          <div className="space-y-2.5">
            {/* Grid Header Card */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedGrid.name}</h3>
                <p className="text-white/40 text-[11px] font-mono">{selectedGrid.district} • {selectedGrid.id}</p>
              </div>
              <span
                className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    selectedGrid.risk_level === 'CRITICAL'
                      ? '#ef444430'
                      : selectedGrid.risk_level === 'HIGH'
                        ? '#f9731630'
                        : selectedGrid.risk_level === 'MITIGATED'
                          ? '#10b98130'
                          : '#eab30830',
                  color:
                    selectedGrid.risk_level === 'CRITICAL'
                      ? '#f87171'
                      : selectedGrid.risk_level === 'HIGH'
                        ? '#fb923c'
                        : selectedGrid.risk_level === 'MITIGATED'
                          ? '#34d399'
                          : '#fde047',
                }}
              >
                {selectedGrid.risk_level}
              </span>
            </div>

            {/* Quick Novelty Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveModal('whatsapp')}
                className="bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 font-medium text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.send_whatsapp}</span>
              </button>
              <button
                onClick={() => setActiveModal('satellite_compare')}
                className="bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-300 font-medium text-[11px] py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.satellite_compare}</span>
              </button>
            </div>

            {/* 6 Key Telemetry Metric Cards */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="NDVI"
                value={selectedGrid.ndvi.toFixed(2)}
                icon={Eye}
                color="#22c55e"
                sparkline={selectedGrid.sparkline_ndvi_7d}
              />
              <MetricCard
                label="NDTI"
                value={selectedGrid.ndti.toFixed(2)}
                icon={BarChart3}
                color="#f97316"
                sparkline={selectedGrid.sparkline_ndti_7d}
              />
              <MetricCard
                label={t.temperature}
                value={selectedGrid.temperature_c}
                unit="°C"
                icon={ThermometerSun}
                color="#ef4444"
              />
              <MetricCard
                label={t.humidity}
                value={selectedGrid.humidity_pct}
                unit="%"
                icon={Droplets}
                color="#3b82f6"
              />
              <MetricCard
                label={t.wind_speed}
                value={selectedGrid.wind_speed_kmh}
                unit="km/h"
                icon={Wind}
                color="#a78bfa"
              />
              <MetricCard
                label={t.soil_moisture}
                value={selectedGrid.soil_moisture.toFixed(2)}
                icon={CloudRain}
                color="#06b6d4"
              />
            </div>

            {/* AQI Forecast with Optimized Sparkline (O12) */}
            <div className="bg-white/[0.04] rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/40 tracking-wider uppercase">{t.air_quality_forecast}</span>
                <span className="text-[10px] text-red-400 font-mono">
                  +{selectedGrid.aqi_predicted_48h - selectedGrid.aqi_current} in 48h
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-amber-400">
                    {selectedGrid.aqi_current}
                  </div>
                  <div className="text-[9px] text-white/30">NOW</div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-400 to-red-500" />
                <div className="text-center">
                  <div className="text-2xl font-bold font-mono text-red-400">
                    {selectedGrid.aqi_predicted_48h}
                  </div>
                  <div className="text-[9px] text-white/30">+48H</div>
                </div>
              </div>
              {aqiSparklineData && (
                <div className="mt-2">
                  <svg width="100%" height="24" viewBox="0 0 280 24" className="opacity-70">
                    <defs>
                      <linearGradient id="aqi-grad-opt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={aqiSparklineData.path} fill="url(#aqi-grad-opt)" />
                    <polyline
                      points={aqiSparklineData.points}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Carbon Impact Button */}
            <button
              onClick={() => setActiveModal('emissions')}
              className="w-full bg-orange-500/10 border border-orange-500/25 hover:bg-orange-500/20 text-orange-300 font-medium text-[11px] py-2 px-3 rounded-xl flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-1.5">
                <CloudFog className="w-4 h-4 text-orange-400" />
                <span>{t.carbon_calculator}</span>
              </div>
              <span className="font-mono text-[10px] text-orange-200/70">
                {selectedGrid.unburned_residue_ha || 320} ha unburned
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-white/50 text-xs text-center py-6">
              Click any block or unit on the map or left list to inspect live spectral intelligence and dispatch alerts.
            </div>

            {/* Quick Regional Carbon Snapshot */}
            <div className="bg-white/[0.04] p-3 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="flex items-center gap-1.5">
                  <CloudFog className="w-3.5 h-3.5 text-orange-400" />
                  Regional Emissions
                </span>
                <button
                  onClick={() => setActiveModal('emissions')}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  View Details →
                </button>
              </div>
              <div className="text-[11px] text-white/50">
                ICAR Tier-2 modeling calculates proactive CRM deployment avoids up to 80% of fine PM2.5 smoke.
              </div>
            </div>
          </div>
        )}

        {/* Live Terminal Streaming Log */}
        <div className="mt-auto pt-3 border-t border-white/10 shrink-0">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>NRT Satellite Feed</span>
            <span className="text-cyan-400">9600 BAUD</span>
          </div>
          <div className="bg-black/60 rounded-lg p-2 font-mono text-[10px] text-white/50 h-24 overflow-y-auto space-y-0.5 border border-white/5">
            {terminalLines.map((line, i) => (
              <div key={i} className="truncate">
                {line}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
