import { useEffect, useState } from 'react';
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
  Terminal,
} from 'lucide-react';
import { useStore } from '../store/useStore';

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
  const max = sparkline ? Math.max(...sparkline) : 0;
  const min = sparkline ? Math.min(...sparkline) : 0;
  const range = max - min || 1;

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
        {sparkline && (
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
                .map(
                  (v, i) =>
                    `${(i / (sparkline.length - 1)) * 60},${20 - ((v - min) / range) * 20}`
                )
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
  const summary = useStore((s) => s.summary);

  const selectedGrid = grids.find((g) => g.id === selectedGridId);

  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [lineIdx, setLineIdx] = useState(0);

  // Simulate live terminal feed
  useEffect(() => {
    const msgs = telemetry.map(
      (t) => `[${t.source}] ${t.msg}`
    );

    const interval = setInterval(() => {
      setLineIdx((prev) => {
        const next = (prev + 1) % msgs.length;
        setTerminalLines((lines) => {
          const newLines = [...lines, msgs[next]];
          return newLines.slice(-12);
        });
        return next;
      });
    }, 2800);

    // Seed initial lines
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
        className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
            {selectedGrid ? 'Grid Telemetry' : 'Region Overview'}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            <span className="text-green-400/60 text-[9px] font-mono">STREAMING</span>
          </div>
        </div>

        {selectedGrid ? (
          <div className="space-y-2">
            <div className="bg-white/5 rounded-lg p-2 mb-3">
              <h3 className="text-white font-semibold text-sm">{selectedGrid.name}</h3>
              <p className="text-white/40 text-[10px]">{selectedGrid.district} District</p>
            </div>

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
                label="Temperature"
                value={selectedGrid.temperature_c}
                unit="°C"
                icon={ThermometerSun}
                color="#ef4444"
              />
              <MetricCard
                label="Humidity"
                value={selectedGrid.humidity_pct}
                unit="%"
                icon={Droplets}
                color="#3b82f6"
              />
              <MetricCard
                label="Wind"
                value={selectedGrid.wind_speed_kmh}
                unit="km/h"
                icon={Wind}
                color="#a78bfa"
              />
              <MetricCard
                label="Soil Moisture"
                value={selectedGrid.soil_moisture.toFixed(2)}
                icon={CloudRain}
                color="#06b6d4"
              />
            </div>

            {/* AQI Forecast */}
            <div className="bg-white/[0.04] rounded-xl p-3 border border-white/5 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/40 tracking-wider uppercase">AQI Forecast</span>
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
              {/* Sparkline */}
              <div className="mt-2">
                <svg width="100%" height="24" viewBox="0 0 280 24" className="opacity-70">
                  <defs>
                    <linearGradient id="aqi-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={(() => {
                      const data = selectedGrid.sparkline_aqi_7d;
                      const max = Math.max(...data);
                      const min = Math.min(...data);
                      const range = max - min || 1;
                      let path = `M 0,${24 - ((data[0] - min) / range) * 24}`;
                      data.forEach((v, i) => {
                        path += ` L ${(i / (data.length - 1)) * 280},${24 - ((v - min) / range) * 24}`;
                      });
                      path += ` L 280,24 L 0,24 Z`;
                      return path;
                    })()}
                    fill="url(#aqi-grad)"
                  />
                  <polyline
                    points={selectedGrid.sparkline_aqi_7d
                      .map((v, i) => {
                        const max = Math.max(...selectedGrid.sparkline_aqi_7d);
                        const min = Math.min(...selectedGrid.sparkline_aqi_7d);
                        const range = max - min || 1;
                        return `${(i / (selectedGrid.sparkline_aqi_7d.length - 1)) * 280},${24 - ((v - min) / range) * 24}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          /* No selection — show overview metrics */
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Grids Monitored"
              value={summary.total_grids_monitored}
              icon={Satellite}
              color="#06b6d4"
            />
            <MetricCard
              label="Avg Risk"
              value={(summary.avg_risk_score * 100).toFixed(0)}
              unit="%"
              icon={Activity}
              color="#f97316"
            />
            <MetricCard
              label="Critical Zones"
              value={summary.critical_count}
              icon={Activity}
              color="#ef4444"
            />
            <MetricCard
              label="Pop. at Risk"
              value={`${(summary.total_population_at_risk / 1000).toFixed(0)}K`}
              icon={Activity}
              color="#a78bfa"
            />
          </div>
        )}
      </motion.div>

      {/* Live Terminal Feed */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl flex-1 overflow-hidden flex flex-col"
      >
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-green-400" />
          <h2 className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase">
            Live Telemetry
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed custom-scrollbar">
          {terminalLines.map((line, i) => {
            const isNew = i === terminalLines.length - 1;
            const sourceMatch = line.match(/\[([A-Z0-9\-]+)\]/);
            const source = sourceMatch ? sourceMatch[1] : '';

            let sourceColor = 'text-cyan-400/60';
            if (source.includes('AWS')) sourceColor = 'text-orange-400/70';
            if (source.includes('SENTINEL') || source.includes('LANDSAT') || source.includes('MODIS')) sourceColor = 'text-blue-400/70';
            if (source.includes('NASA') || source.includes('FIRMS')) sourceColor = 'text-red-400/70';
            if (source.includes('ECMWF')) sourceColor = 'text-purple-400/70';
            if (source.includes('CPCB')) sourceColor = 'text-amber-400/70';

            return (
              <motion.div
                key={`${i}-${line.slice(0, 20)}`}
                initial={isNew ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: isNew ? 1 : 0.5, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-1 ${isNew ? 'text-white/80' : 'text-white/30'}`}
              >
                <span className="text-white/20 mr-1">›</span>
                <span className={sourceColor}>
                  {sourceMatch ? sourceMatch[0] : ''}
                </span>
                <span className="text-white/50">
                  {line.replace(sourceMatch ? sourceMatch[0] : '', '')}
                </span>
              </motion.div>
            );
          })}
          <div className="flex items-center gap-1 text-green-400/40 mt-1">
            <span className="animate-pulse">▌</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
