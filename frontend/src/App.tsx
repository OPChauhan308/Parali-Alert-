import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { MapView } from './components/MapView';
import { PriorityQueue } from './components/PriorityQueue';
import { UnitDetailModal } from './components/UnitDetailModal';
import { HistoricalReplayBar } from './components/HistoricalReplayBar';
import { EvaluationModal } from './components/EvaluationModal';
import { api } from './services/api';
import { UnitRecord, ActiveFireItem, EvaluationData, SummaryStats } from './types';
import { Map as MapIcon, FileSpreadsheet } from 'lucide-react';

export const App: React.FC = () => {
  // Primary State
  const [horizon, setHorizon] = useState<number>(48);
  const [dataMode, setDataMode] = useState<string>('sample');
  const [rankings, setRankings] = useState<UnitRecord[]>([]);
  const [stats, setStats] = useState<SummaryStats>({
    critical_prevention_units: 0,
    high_prevention_units: 0,
    active_fire_dispatch_units: 0,
    total_unburned_residue_hectares: 0,
    average_priority_score: 0
  });
  const [activeFires, setActiveFires] = useState<ActiveFireItem[]>([]);
  const [districtsGeoJson, setDistrictsGeoJson] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Unit Inspection Dossier
  const [selectedUnit, setSelectedUnit] = useState<UnitRecord | null>(null);
  const [unitDetailData, setUnitDetailData] = useState<any>(null);

  // Historical Replay State
  const [isReplayActive, setIsReplayActive] = useState<boolean>(false);
  const [replayDate, setReplayDate] = useState<string>('2024-10-28');

  // Evaluation Modal
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);
  const [evaluationData, setEvaluationData] = useState<EvaluationData | null>(null);

  // Loading & Refreshing
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Workbench Mode: 'dual' | 'map' | 'ledger'
  const [workbenchView, setWorkbenchView] = useState<'dual' | 'map' | 'ledger'>('dual');

  // Initial Data Fetch
  const loadData = async () => {
    try {
      setIsRefreshing(true);
      const [rankingsRes, firesRes, districtsRes, weatherRes] = await Promise.all([
        api.getRiskRankings({ horizon, district: selectedDistrict, category: selectedCategory, search: searchQuery }),
        api.getActiveFires(),
        api.getDistrictsGeoJson(),
        api.getWeather('Sangrur')
      ]);

      setRankings(rankingsRes.rankings);
      setStats(rankingsRes.summary_stats);
      setDataMode(rankingsRes.data_mode);
      setActiveFires(firesRes.fires);
      setDistrictsGeoJson(districtsRes);
      setWeatherData(weatherRes.forecast);
    } catch (err) {
      console.error('Error fetching dashboard telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isReplayActive) {
      loadData();
    }
  }, [horizon, selectedDistrict, selectedCategory, searchQuery, isReplayActive]);

  // Load Unit Dossier on Selection
  const handleSelectUnit = async (unit: UnitRecord) => {
    setSelectedUnit(unit);
    try {
      const detail = await api.getUnitDetail(unit.unit_id, horizon);
      setUnitDetailData(detail);
    } catch (err) {
      console.error('Error fetching unit dossier:', err);
    }
  };

  // Toggle Live vs Sample Data Mode
  const handleToggleDataMode = async () => {
    const nextMode = dataMode === 'live' ? 'sample' : 'live';
    try {
      setIsRefreshing(true);
      await api.toggleDataMode(nextMode);
      setDataMode(nextMode);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle data mode:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Run Historical Replay
  const handleExecuteReplay = async () => {
    try {
      setIsLoading(true);
      const replayRes = await api.historicalReplay(replayDate, horizon);
      setIsReplayActive(true);
      setRankings(replayRes.rankings);
      const cutoff = `${replayDate}T23:59:59Z`;
      const filteredFires = activeFires.filter(f => f.acq_datetime <= cutoff);
      setActiveFires(filteredFires);
    } catch (err) {
      console.error('Replay failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Replay
  const handleResetReplay = () => {
    setIsReplayActive(false);
    loadData();
  };

  // Open Evaluation Modal
  const handleOpenEvaluation = async () => {
    try {
      if (!evaluationData) {
        const evalRes = await api.getEvaluationBenchmarks();
        setEvaluationData(evalRes);
      }
      setIsEvaluationOpen(true);
    } catch (err) {
      console.error('Failed to load evaluation benchmarks:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#181816] flex flex-col font-mono selection:bg-[#B45309]/20 selection:text-[#78350F]">
      {/* Top Telemetry Header */}
      <Navbar
        horizon={horizon}
        setHorizon={setHorizon}
        dataMode={dataMode}
        onToggleDataMode={handleToggleDataMode}
        onOpenEvaluation={handleOpenEvaluation}
        onRefresh={loadData}
        isRefreshing={isRefreshing}
      />

      {/* Main Situation Room Workbench */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3.5 sm:p-5 flex flex-col gap-3.5">
        {/* Temporal Replay Ribbon */}
        <HistoricalReplayBar
          isReplayActive={isReplayActive}
          replayDate={replayDate}
          onSelectDate={setReplayDate}
          onExecuteReplay={handleExecuteReplay}
          onResetReplay={handleResetReplay}
          isLoading={isLoading}
        />

        {/* Operational Telemetry Barometer */}
        <MetricsOverview stats={stats} weatherData={weatherData} />

        {/* Workbench View Tabs */}
        <div className="flex items-center justify-between border-b border-[#DCD7CC] pb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#767267] uppercase tracking-wider font-bold">
              WORKBENCH VIEW:
            </span>
            <div className="flex items-center bg-[#FFFFFF] border border-[#DCD7CC] p-0.5 shadow-xs">
              <button
                onClick={() => setWorkbenchView('dual')}
                className={`px-3 py-1 transition font-bold text-[10px] ${
                  workbenchView === 'dual'
                    ? 'bg-[#181816] text-[#F6F5F0]'
                    : 'text-[#5E5B52] hover:text-[#181816]'
                }`}
              >
                DUAL CONSOLE
              </button>
              <button
                onClick={() => setWorkbenchView('map')}
                className={`px-3 py-1 transition font-bold text-[10px] ${
                  workbenchView === 'map'
                    ? 'bg-[#181816] text-[#F6F5F0]'
                    : 'text-[#5E5B52] hover:text-[#181816]'
                }`}
              >
                MAP VIEW
              </button>
              <button
                onClick={() => setWorkbenchView('ledger')}
                className={`px-3 py-1 transition font-bold text-[10px] ${
                  workbenchView === 'ledger'
                    ? 'bg-[#181816] text-[#F6F5F0]'
                    : 'text-[#5E5B52] hover:text-[#181816]'
                }`}
              >
                DISPATCH LEDGER
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#5E5B52] hidden sm:block">
            ACTIVE MONITORED GRID: <strong className="text-[#181816]">{rankings.length} SECTORS</strong> ACROSS 4 PILOT DISTRICTS
          </div>
        </div>

        {/* Dual Workbench Layout */}
        {workbenchView === 'dual' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left 7 Cols: Tactical Situation Map */}
            <div className="xl:col-span-7 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#5E5B52] border-b border-[#DCD7CC] pb-1">
                <span className="font-bold text-[#181816] uppercase tracking-wider flex items-center gap-1.5 font-serif">
                  <MapIcon className="w-3.5 h-3.5 text-[#181816]" />
                  CIVIL SITUATION MAP // PUNJAB MONITORING GRID
                </span>
                <span className="text-[10px]">CLICK SECTOR POLYGON TO OPEN DOSSIER</span>
              </div>
              <MapView
                units={rankings}
                activeFires={activeFires}
                selectedUnit={selectedUnit}
                onSelectUnit={handleSelectUnit}
                districtsGeoJson={districtsGeoJson}
              />
            </div>

            {/* Right 5 Cols: Resource Dispatch Ledger */}
            <div className="xl:col-span-5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#5E5B52] border-b border-[#DCD7CC] pb-1">
                <span className="font-bold text-[#181816] uppercase tracking-wider flex items-center gap-1.5 font-serif">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#181816]" />
                  RESOURCE DISPATCH ALLOCATION LEDGER
                </span>
                <span className="text-[10px]">SORTED BY RISK &times; PREVENTABILITY</span>
              </div>
              <PriorityQueue
                rankings={rankings}
                selectedUnit={selectedUnit}
                onSelectUnit={handleSelectUnit}
                selectedDistrict={selectedDistrict}
                setSelectedDistrict={setSelectedDistrict}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                horizon={horizon}
              />
            </div>
          </div>
        )}

        {/* Standalone Map View */}
        {workbenchView === 'map' && (
          <div className="flex flex-col gap-1.5">
            <MapView
              units={rankings}
              activeFires={activeFires}
              selectedUnit={selectedUnit}
              onSelectUnit={handleSelectUnit}
              districtsGeoJson={districtsGeoJson}
            />
          </div>
        )}

        {/* Standalone Ledger View */}
        {workbenchView === 'ledger' && (
          <div className="flex flex-col gap-1.5">
            <PriorityQueue
              rankings={rankings}
              selectedUnit={selectedUnit}
              onSelectUnit={handleSelectUnit}
              selectedDistrict={selectedDistrict}
              setSelectedDistrict={setSelectedDistrict}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              horizon={horizon}
            />
          </div>
        )}
      </main>

      {/* Sector Operational Dossier Modal */}
      <UnitDetailModal
        unit={selectedUnit}
        unitDetailData={unitDetailData}
        onClose={() => setSelectedUnit(null)}
      />

      {/* Model Evaluation & Backtest Benchmarks Modal */}
      <EvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
        evaluationData={evaluationData}
      />

      {/* Institutional Gazette Footer */}
      <footer className="border-t border-[#DCD7CC] bg-[#EFECE4] py-3.5 px-5 text-[10px] text-[#5E5B52] font-mono mt-8">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-[#181816]">PARALI ALERT v1.0</strong> — STATE OF PUNJAB PRE-FIRE INTERVENTION INTELLIGENCE PLATFORM
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[#767267]">
            <span>SENTINEL-2 L2A (AWS OPEN DATA)</span>
            <span>NASA FIRMS VIIRS 375M</span>
            <span>OPEN-METEO ECMWF</span>
            <span>AWS SERVERLESS ARCHITECTURE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
