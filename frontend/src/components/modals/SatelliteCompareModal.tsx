import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, Layers, X, ArrowRight, ShieldCheck, Activity, Calendar, Satellite, Sliders, Split } from 'lucide-react';
import { useStore, GridCell } from '../../store/useStore';
import { fetchSatelliteComparison, SatelliteComparisonData } from '../../api/client';
import { translations } from '../../data/translations';

type CompositeMode = 'true_color' | 'false_color_cir' | 'swir_stubble';

export default function SatelliteCompareModal({ unit }: { unit: GridCell | undefined }) {
  const setActiveModal = useStore((s) => s.setActiveModal);
  const lang = useStore((s) => s.lang);
  const t = translations[lang];

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SatelliteComparisonData | null>(null);
  const [composite, setComposite] = useState<CompositeMode>('true_color');
  const [viewMode, setViewMode] = useState<'side_by_side' | 'split'>('side_by_side');
  const [splitPos, setSplitPos] = useState(50);

  useEffect(() => {
    if (!unit) return;
    setLoading(true);
    fetchSatelliteComparison(unit.id)
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load comparison:', err))
      .finally(() => setLoading(false));
  }, [unit]);

  if (!unit) return null;

  const compositeLabels: Record<CompositeMode, { title: string; desc: string }> = {
    true_color: {
      title: 'True Color (RGB: B04, B03, B02)',
      desc: 'Natural visible light spectrum showing field surface reflectance'
    },
    false_color_cir: {
      title: 'Color Infrared (CIR: B08, B04, B03)',
      desc: 'Healthy green chlorophyll glows red; exposed soil/stubble appears cyan-grey'
    },
    swir_stubble: {
      title: 'SWIR Stubble Index (B12, B08, B04)',
      desc: 'Dry cellulose & lignin absorb SWIR; harvested parali straw highlighted in amber'
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0b0d14] border border-white/15 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-cyan-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">
                Sentinel-2 Multi-Spectral Pre/Post Harvest Comparison
              </h2>
              <p className="text-white/40 text-[11px] font-mono">
                {unit.name} ({unit.id}) • Tile {data?.tile_id || 'T43RD'} • 10m Ground Sampling Distance (GSD)
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {loading || !data ? (
            <div className="py-20 text-center text-white/50 animate-pulse space-y-2">
              <Satellite className="w-8 h-8 mx-auto text-cyan-400 animate-spin" />
              <div>Fetching Multi-Spectral Sentinel-2 L2A Bands & Generating Raster Chips...</div>
            </div>
          ) : (
            <>
              {/* Controls bar: Composite Selector & View Mode */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/[0.02] border border-white/10 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[11px] mr-1 font-mono">Band Composite:</span>
                  {(['true_color', 'false_color_cir', 'swir_stubble'] as CompositeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setComposite(mode)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        composite === mode
                          ? 'bg-cyan-500/25 border border-cyan-400/40 text-cyan-300'
                          : 'bg-white/5 border border-transparent text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {mode === 'true_color' ? 'True Color (RGB)' : mode === 'false_color_cir' ? 'CIR Infrared' : 'SWIR Stubble'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
                  <button
                    onClick={() => setViewMode('side_by_side')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      viewMode === 'side_by_side' ? 'bg-cyan-500 text-black font-semibold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      viewMode === 'split' ? 'bg-cyan-500 text-black font-semibold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Interactive Wipe
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-white/50 italic px-1 font-mono">
                {compositeLabels[composite].desc}
              </div>

              {/* Visual Display */}
              {viewMode === 'side_by_side' ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Pre-Harvest */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Pre-Harvest Baseline
                      </span>
                      <span className="text-white/40 font-mono text-[10px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {data.pre_harvest.acquisition_date}
                      </span>
                    </div>

                    {/* Raster Imagery Chip */}
                    <div className="h-44 rounded-lg relative overflow-hidden flex items-center justify-center border border-emerald-500/30 bg-black">
                      {data.pre_harvest.raster_chips?.[composite] ? (
                        <img
                          src={data.pre_harvest.raster_chips[composite]}
                          alt="Pre-Harvest Sentinel-2 Chip"
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/60 via-green-800/40 to-emerald-950/80" />
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                        NDVI {data.pre_harvest.ndvi} • NDTI {data.pre_harvest.ndti}
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 font-mono text-[9px] text-white/60">
                        10m GSD • 320m²
                      </div>
                    </div>

                    {/* Band Reflectance bars */}
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between text-white/50 font-mono">
                        <span>B08 (NIR 842nm): <strong className="text-white">{data.pre_harvest.reflectance_profile.B08_NIR}</strong></span>
                        <span>B04 (Red 665nm): <strong className="text-white">{data.pre_harvest.reflectance_profile.B04_Red}</strong></span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, data.pre_harvest.reflectance_profile.B08_NIR * 130)}%` }} />
                      </div>
                      <div className="flex justify-between text-white/50 font-mono pt-0.5">
                        <span>B11 (SWIR1 1610nm): <strong className="text-white">{data.pre_harvest.reflectance_profile.B11_SWIR1}</strong></span>
                        <span>{data.pre_harvest.classification}</span>
                      </div>
                    </div>
                  </div>

                  {/* Post-Harvest */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Post-Harvest Desiccation
                      </span>
                      <span className="text-white/40 font-mono text-[10px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {data.post_harvest.acquisition_date}
                      </span>
                    </div>

                    {/* Raster Imagery Chip */}
                    <div className="h-44 rounded-lg relative overflow-hidden flex items-center justify-center border border-amber-500/30 bg-black">
                      {data.post_harvest.raster_chips?.[composite] ? (
                        <img
                          src={data.post_harvest.raster_chips[composite]}
                          alt="Post-Harvest Sentinel-2 Chip"
                          className="w-full h-full object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/70 via-yellow-900/40 to-orange-950/80" />
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-amber-500/30 font-mono text-[10px] text-amber-300">
                        NDVI {data.post_harvest.ndvi} • NDTI {data.post_harvest.ndti}
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 font-mono text-[9px] text-white/60">
                        10m GSD • 320m²
                      </div>
                    </div>

                    {/* Band Reflectance bars */}
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between text-white/50 font-mono">
                        <span>B08 (NIR 842nm): <strong className="text-white">{data.post_harvest.reflectance_profile.B08_NIR}</strong></span>
                        <span>B04 (Red 665nm): <strong className="text-white">{data.post_harvest.reflectance_profile.B04_Red}</strong></span>
                      </div>
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, data.post_harvest.reflectance_profile.B11_SWIR1 * 130)}%` }} />
                      </div>
                      <div className="flex justify-between text-white/50 font-mono pt-0.5">
                        <span>B11 (SWIR1 1610nm): <strong className="text-white">{data.post_harvest.reflectance_profile.B11_SWIR1}</strong></span>
                        <span>{data.post_harvest.classification}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Interactive Split Swipe Mode */
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-emerald-400">◄ Pre-Harvest Baseline ({data.pre_harvest.acquisition_date})</span>
                    <span className="text-white/40">Drag slider to wipe comparison</span>
                    <span className="text-amber-400">Post-Harvest Stubble ({data.post_harvest.acquisition_date}) ►</span>
                  </div>

                  <div className="h-64 rounded-lg relative overflow-hidden border border-cyan-500/30 select-none bg-black">
                    {/* Post-harvest background */}
                    {data.post_harvest.raster_chips?.[composite] && (
                      <img
                        src={data.post_harvest.raster_chips[composite]}
                        alt="Post Harvest"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                    {/* Pre-harvest clipped foreground */}
                    {data.pre_harvest.raster_chips?.[composite] && (
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: `${splitPos}%`, borderRight: '2px solid #06b6d4' }}
                      >
                        <img
                          src={data.pre_harvest.raster_chips[composite]}
                          alt="Pre Harvest"
                          className="w-full h-full object-cover"
                          style={{
                            imageRendering: 'pixelated',
                            width: `${100 / (splitPos / 100)}%`,
                            maxWidth: 'none'
                          }}
                        />
                      </div>
                    )}

                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm border border-emerald-500/40 rounded px-2 py-1 font-mono text-[10px] text-emerald-300">
                      Pre: NDVI {data.pre_harvest.ndvi}
                    </div>
                    <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm border border-amber-500/40 rounded px-2 py-1 font-mono text-[10px] text-amber-300">
                      Post: NDVI {data.post_harvest.ndvi}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-white/40 text-[10px] font-mono">Wipe Position:</span>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={splitPos}
                      onChange={(e) => setSplitPos(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <span className="text-white/60 font-mono text-[11px] w-10 text-right">{splitPos}%</span>
                  </div>
                </div>
              )}

              {/* Change Detection Intelligence Box */}
              <div className="bg-gradient-to-r from-cyan-950/40 to-blue-950/30 border border-cyan-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold flex items-center gap-1.5 text-xs">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Spectral Change Detection Assessment
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-[10px]">Stubble Confidence:</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[11px]">
                      {(data.change_detection.stubble_presence_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Δ NDVI Collapse</div>
                    <div className="text-red-400 font-bold font-mono text-base">{data.change_detection.delta_ndvi}</div>
                    <div className="text-white/30 text-[9px]">-{data.change_detection.drop_magnitude_pct}% greenness</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Δ NDTI Cellulose Spike</div>
                    <div className="text-amber-400 font-bold font-mono text-base">+{data.change_detection.delta_ndti}</div>
                    <div className="text-white/30 text-[9px]">Lignin/Straw response</div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                    <div className="text-white/40 text-[10px]">Harvest Window</div>
                    <div className="text-cyan-300 font-bold font-mono text-xs mt-1">Last 48–72h</div>
                    <div className="text-emerald-400 text-[9px]">Optimal intervention</div>
                  </div>
                </div>

                <p className="text-white/70 text-[11px] leading-relaxed bg-black/30 p-2.5 rounded-lg border border-white/5">
                  {data.change_detection.operational_summary}
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

