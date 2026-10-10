import { useEffect, lazy, Suspense } from 'react';
import MapView from './components/MapView';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import TimelineSlider from './components/TimelineSlider';
import { useStore } from './store/useStore';
import pkg from '../package.json';

// Bundle Splitting & Lazy-Loaded Modals (Optimization B8)
const WhatsAppModal = lazy(() => import('./components/modals/WhatsAppModal'));
const FarmerReportModal = lazy(() => import('./components/modals/FarmerReportModal'));
const SatelliteCompareModal = lazy(() => import('./components/modals/SatelliteCompareModal'));
const EvaluationModal = lazy(() => import('./components/modals/EvaluationModal'));
const EmissionsModal = lazy(() => import('./components/modals/EmissionsModal'));

function App() {
  const activeModal = useStore((s) => s.activeModal);
  const selectedGridId = useStore((s) => s.selectedGridId);
  const grids = useStore((s) => s.grids);
  const loadLiveData = useStore((s) => s.loadLiveData);
  const isBackendLive = useStore((s) => s.isBackendLive);

  const selectedGrid = grids.find((g) => g.id === selectedGridId);

  // Sync live data on mount
  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Full-screen map base layer */}
      <MapView />

      {/* Floating UI panels */}
      <LeftPanel />
      <RightPanel />
      <TimelineSlider />

      {/* Top status bar with dynamic version from package.json (H35) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-2xl">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isBackendLive ? 'bg-green-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="text-[9px] text-white/50 font-mono tracking-wider">
              {isBackendLive ? 'FASTAPI LIVE SYNC' : 'SENTINEL-2 SYNC'}
            </span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[9px] text-white/40 font-mono">
            {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
          </span>
          <div className="w-px h-3 bg-white/10" />
          <span className="text-[9px] text-cyan-400/80 font-mono tracking-wider">
            PARALI v{pkg.version || '1.0.0'}
          </span>
        </div>
      </div>

      {/* Novelty Interactive Modals (Lazy Loaded with Suspense) */}
      <Suspense fallback={null}>
        {activeModal === 'whatsapp' && <WhatsAppModal unit={selectedGrid || grids[0]} />}
        {activeModal === 'farmer_report' && <FarmerReportModal />}
        {activeModal === 'satellite_compare' && <SatelliteCompareModal unit={selectedGrid || grids[0]} />}
        {activeModal === 'evaluation' && <EvaluationModal />}
        {activeModal === 'emissions' && <EmissionsModal unit={selectedGrid} />}
      </Suspense>

      {/* Vignette overlay for cinematic feel */}
      <div
        className="fixed inset-0 z-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </div>
  );
}

export default App;
