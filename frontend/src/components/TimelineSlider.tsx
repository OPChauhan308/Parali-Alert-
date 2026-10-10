import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronLeft, ChevronRight, Rewind, FastForward } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TimelineSlider() {
  const timelineHour = useStore((s) => s.timelineHour);
  const setTimelineHour = useStore((s) => s.setTimelineHour);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const hourToLabel = (h: number) => {
    if (h === 0) return 'NOW';
    const abs = Math.abs(h);
    const sign = h < 0 ? '-' : '+';
    return `${sign}${abs}h`;
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const hour = Math.round(pct * 96 - 48);
      setTimelineHour(hour);
    },
    [setTimelineHour]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  const pct = ((timelineHour + 48) / 96) * 100;

  // Tick marks
  const ticks = [];
  for (let h = -48; h <= 48; h += 6) {
    const tickPct = ((h + 48) / 96) * 100;
    ticks.push({ h, pct: tickPct });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
    >
      <div className="bg-black/75 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 w-[600px] max-w-[90vw]">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-white/40 tracking-[0.15em] uppercase">
              Temporal Replay
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTimelineHour(Math.max(-48, timelineHour - 6))}
              className="text-white/30 hover:text-white/80 transition-colors"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTimelineHour(Math.max(-48, timelineHour - 1))}
              className="text-white/30 hover:text-white/80 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <motion.span
              key={timelineHour}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-white font-mono text-sm font-bold min-w-[48px] text-center"
            >
              {hourToLabel(timelineHour)}
            </motion.span>
            <button
              onClick={() => setTimelineHour(Math.min(48, timelineHour + 1))}
              className="text-white/30 hover:text-white/80 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTimelineHour(Math.min(48, timelineHour + 6))}
              className="text-white/30 hover:text-white/80 transition-colors"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/20">-48h</span>
            <span className="text-[9px] text-white/20">to</span>
            <span className="text-[9px] text-white/20">+48h</span>
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-8 cursor-pointer select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDragging(false)}
        >
          {/* Background track */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/5 rounded-full">
            {/* Past (blue tint) */}
            <div
              className="absolute top-0 left-0 h-full rounded-l-full bg-gradient-to-r from-cyan-500/30 to-transparent"
              style={{ width: '50%' }}
            />
            {/* Future (red tint) */}
            <div
              className="absolute top-0 right-0 h-full rounded-r-full bg-gradient-to-l from-red-500/30 to-transparent"
              style={{ width: '50%' }}
            />
            {/* Active position fill */}
            <div
              className="absolute top-0 h-full rounded-full transition-all duration-75"
              style={{
                left: pct > 50 ? '50%' : `${pct}%`,
                width: `${Math.abs(pct - 50)}%`,
                background: timelineHour >= 0
                  ? 'linear-gradient(to right, rgba(6,182,212,0.5), rgba(239,68,68,0.5))'
                  : 'linear-gradient(to right, rgba(6,182,212,0.5), rgba(6,182,212,0.3))',
              }}
            />
          </div>

          {/* Tick marks */}
          {ticks.map((tick) => (
            <div
              key={tick.h}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${tick.pct}%` }}
            >
              <div
                className={`w-px ${tick.h === 0 ? 'h-4 bg-white/40' : 'h-2 bg-white/10'}`}
                style={{ transform: 'translateX(-50%)' }}
              />
              {(tick.h % 12 === 0 || tick.h === 0) && (
                <span
                  className={`absolute top-5 text-[8px] ${tick.h === 0 ? 'text-cyan-400 font-bold' : 'text-white/20'}`}
                  style={{ transform: 'translateX(-50%)' }}
                >
                  {tick.h === 0 ? 'NOW' : `${tick.h > 0 ? '+' : ''}${tick.h}h`}
                </span>
              )}
            </div>
          ))}

          {/* Draggable thumb */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${pct}%` }}
            animate={{ left: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 shadow-lg transition-colors ${
                isDragging
                  ? 'bg-white border-cyan-400 shadow-cyan-400/40'
                  : 'bg-white/90 border-white/60 shadow-white/20'
              }`}
            />
            {/* Glow */}
            <div
              className="absolute inset-0 w-4 h-4 rounded-full animate-ping opacity-20"
              style={{
                backgroundColor: timelineHour >= 0 ? '#ef4444' : '#06b6d4',
              }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
