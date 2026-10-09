import React from 'react';
import { History, RotateCcw, Play, Calendar } from 'lucide-react';

interface HistoricalReplayBarProps {
  isReplayActive: boolean;
  replayDate: string;
  onSelectDate: (date: string) => void;
  onExecuteReplay: () => void;
  onResetReplay: () => void;
  isLoading: boolean;
}

export const HistoricalReplayBar: React.FC<HistoricalReplayBarProps> = ({
  isReplayActive,
  replayDate,
  onSelectDate,
  onExecuteReplay,
  onResetReplay,
  isLoading
}) => {
  const sampleDates = [
    { label: '20 OCT // EARLY HARVEST', date: '2024-10-20' },
    { label: '28 OCT // PEAK STUBBLE FIRES', date: '2024-10-28' },
    { label: '04 NOV // SOWING DEADLINE RUSH', date: '2024-11-04' },
    { label: '12 NOV // LATE CLEARANCE', date: '2024-11-12' },
  ];

  return (
    <div
      className={`p-3 border font-mono text-xs transition-colors shadow-sm ${
        isReplayActive
          ? 'bg-[#FEF3C7] border-[#B45309]'
          : 'bg-[#FFFFFF] border-[#DCD7CC]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Archival Notice */}
        <div className="flex items-center gap-2.5">
          <History className={`w-4 h-4 ${isReplayActive ? 'text-[#92400E]' : 'text-[#181816]'}`} />
          <span className="font-bold uppercase tracking-wider text-[#181816] text-[11px] font-serif">
            TEMPORAL REPLAY SIMULATOR:
          </span>
          {isReplayActive ? (
            <span className="px-2 py-0.5 bg-[#FFFFFF] text-[#92400E] border border-[#B45309] text-[10px] font-bold">
              HISTORICAL CUTOFF: {replayDate} (ZERO FUTURE LEAKAGE ENFORCED)
            </span>
          ) : (
            <span className="text-[10px] text-[#5E5B52]">
              Enforce point-in-time observation boundary (evaluates pre-fire lead time)
            </span>
          )}
        </div>

        {/* Milestone Fast-Select Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {sampleDates.map((d) => (
            <button
              key={d.date}
              onClick={() => onSelectDate(d.date)}
              className={`px-2.5 py-1 border transition font-bold ${
                replayDate === d.date
                  ? 'bg-[#181816] border-[#181816] text-[#F6F5F0]'
                  : 'bg-[#F6F5F0] border-[#DCD7CC] text-[#4A473F] hover:bg-[#EFECE4] hover:text-[#181816]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Date Selector & Simulation Action */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#DCD7CC] px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-[#5E5B52]" />
            <input
              type="date"
              value={replayDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="bg-transparent text-[11px] text-[#181816] font-mono focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={onExecuteReplay}
            disabled={isLoading}
            className="px-3 py-1 bg-[#181816] hover:bg-[#33302A] text-[#F6F5F0] border border-[#181816] text-[11px] font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>RUN SIMULATION</span>
          </button>

          {isReplayActive && (
            <button
              onClick={onResetReplay}
              className="px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#F6F5F0] border border-[#DCD7CC] text-[#181816] text-[11px] font-bold flex items-center gap-1 transition"
              title="Return to live operational feed"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RETURN TO LIVE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
