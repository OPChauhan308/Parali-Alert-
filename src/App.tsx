import MapView from './components/MapView';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import TimelineSlider from './components/TimelineSlider';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Full-screen map base layer */}
      <MapView />

      {/* Floating UI panels */}
      <LeftPanel />
      <RightPanel />
      <TimelineSlider />

      {/* Top-right satellite status bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[9px] text-white/40 font-mono tracking-wider">SENTINEL-2 SYNC</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[9px] text-white/30 font-mono">
            {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
          </span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[9px] text-cyan-400/60 font-mono tracking-wider">PARALI v2.1</span>
        </div>
      </div>

      {/* Vignette overlay for cinematic feel */}
      <div
        className="fixed inset-0 z-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}

export default App;
