import React from 'react';
import { Satellite, CloudSun, Database, BarChart3, RefreshCw, Download, Radio } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  horizon: number;
  setHorizon: (h: number) => void;
  dataMode: string;
  onToggleDataMode: () => void;
  onOpenEvaluation: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  horizon,
  setHorizon,
  dataMode,
  onToggleDataMode,
  onOpenEvaluation,
  onRefresh,
  isRefreshing
}) => {
  return (
    <header className="border-b border-[#DCD7CC] bg-[#EFECE4] sticky top-0 z-40 px-4 py-2.5 font-mono text-xs">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Administrative Jurisdiction */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 bg-[#181816] text-[#F6F5F0] flex flex-col items-center justify-center font-bold font-serif border border-[#181816] shadow-sm">
            <span className="text-[13px] leading-none tracking-tight">PB</span>
            <span className="text-[7px] tracking-widest uppercase font-mono mt-0.5 text-[#DCD7CC]">GOV</span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold tracking-tight text-[#181816] font-serif uppercase">
                PARALI ALERT // PUNJAB CIVIL INTERVENTION
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC] font-mono font-bold tracking-wide">
                FEED ACTIVE
              </span>
            </div>
            <div className="text-[10px] text-[#5E5B52] font-mono tracking-tight mt-0.5">
              DEPT OF AGRICULTURE & FARMERS WELFARE • PPCB DISPATCH INTELLIGENCE STATION
            </div>
          </div>
        </div>

        {/* Telemetry Sensor Verification Strip */}
        <div className="hidden xl:flex items-center gap-2.5 text-[10px] text-[#4A473F] font-mono">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FFFFFF] border border-[#DCD7CC]">
            <Satellite className="w-3 h-3 text-[#181816]" />
            <span>SENTINEL-2 L2A (AWS OPEN DATA)</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FFFFFF] border border-[#DCD7CC]">
            <Radio className="w-3 h-3 text-[#B91C1C]" />
            <span>NASA FIRMS VIIRS 375M</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#FFFFFF] border border-[#DCD7CC]">
            <CloudSun className="w-3 h-3 text-[#B45309]" />
            <span>MET: OPEN-METEO ECMWF</span>
          </div>
        </div>

        {/* Operational Controls Toolbar */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {/* Horizon Toggle */}
          <div className="flex items-center bg-[#FFFFFF] border border-[#DCD7CC] p-0.5">
            <button
              onClick={() => setHorizon(24)}
              className={`px-3 py-1 transition font-bold text-[10px] ${
                horizon === 24
                  ? 'bg-[#181816] text-[#F6F5F0]'
                  : 'text-[#5E5B52] hover:text-[#181816]'
              }`}
            >
              24H HORIZON
            </button>
            <button
              onClick={() => setHorizon(48)}
              className={`px-3 py-1 transition font-bold text-[10px] ${
                horizon === 48
                  ? 'bg-[#181816] text-[#F6F5F0]'
                  : 'text-[#5E5B52] hover:text-[#181816]'
              }`}
            >
              48H HORIZON
            </button>
          </div>

          {/* Mode Selector */}
          <button
            onClick={onToggleDataMode}
            className={`px-2.5 py-1 border transition flex items-center gap-1.5 text-[10px] font-bold ${
              dataMode === 'live'
                ? 'bg-[#FFFFFF] border-[#166534] text-[#166534] hover:bg-[#F0FDF4]'
                : 'bg-[#FFFFFF] border-[#B45309] text-[#B45309] hover:bg-[#FFFBEB]'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>{dataMode === 'live' ? 'LIVE TELEMETRY' : 'PILOT ARCHIVE'}</span>
          </button>

          {/* Backtest Benchmarks */}
          <button
            onClick={onOpenEvaluation}
            className="px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#F6F5F0] border border-[#DCD7CC] text-[#181816] font-bold flex items-center gap-1.5 transition text-[10px]"
          >
            <BarChart3 className="w-3 h-3 text-[#181816]" />
            <span className="hidden sm:inline">BENCHMARK MATRIX</span>
          </button>

          {/* Export CSV Manifest */}
          <a
            href={api.getExportUrl(horizon)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 bg-[#181816] hover:bg-[#33302A] text-[#F6F5F0] border border-[#181816] font-bold flex items-center gap-1.5 transition text-[10px]"
            title="Download field dispatch manifest CSV"
          >
            <Download className="w-3 h-3" />
            <span className="hidden md:inline">EXPORT MANIFEST</span>
          </a>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 bg-[#FFFFFF] hover:bg-[#F6F5F0] border border-[#DCD7CC] text-[#181816] transition disabled:opacity-50"
            title="Refresh active telemetry feeds"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#B45309]' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
