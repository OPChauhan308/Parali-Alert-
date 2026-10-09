import React from 'react';
import { UnitRecord } from '../types';
import { Download, Search, Filter, Flame, HelpCircle } from 'lucide-react';
import { api } from '../services/api';

interface PriorityQueueProps {
  rankings: UnitRecord[];
  selectedUnit: UnitRecord | null;
  onSelectUnit: (unit: UnitRecord) => void;
  selectedDistrict: string;
  setSelectedDistrict: (d: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  horizon: number;
}

export const PriorityQueue: React.FC<PriorityQueueProps> = ({
  rankings,
  selectedUnit,
  onSelectUnit,
  selectedDistrict,
  setSelectedDistrict,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  horizon
}) => {
  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'CRITICAL_PREVENTION':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
            CRITICAL
          </span>
        );
      case 'HIGH_PREVENTION':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
            HIGH WINDOW
          </span>
        );
      case 'MEDIUM_MONITORING':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-[#F5F5F4] text-[#44403C] border border-[#D6D3D1]">
            MONITOR
          </span>
        );
      case 'OBSERVED_FIRE_DISPATCH':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#DC2626] text-white border border-[#991B1B] flex items-center gap-1">
            <Flame className="w-2.5 h-2.5 text-white" />
            FIRE DETECTED
          </span>
        );
      case 'UNCERTAIN_VERIFICATION':
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-[#F5F5F4] text-[#78716C] border border-[#D6D3D1] flex items-center gap-1">
            <HelpCircle className="w-2.5 h-2.5 text-[#78716C]" />
            UNCERTAIN
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-medium bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC]">
            LOW RISK
          </span>
        );
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#DCD7CC] flex flex-col font-mono text-xs shadow-sm">
      {/* Ledger Header & Export Strip */}
      <div className="p-3 border-b border-[#DCD7CC] flex flex-wrap items-center justify-between gap-3 bg-[#EFECE4]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold font-serif uppercase tracking-wider text-[#181816]">
              Resource Dispatch Allocation Ledger
            </h2>
            <span className="text-[10px] px-2 py-0.5 bg-[#FFFFFF] text-[#181816] border border-[#DCD7CC] font-bold">
              {rankings.length} SECTORS
            </span>
          </div>
          <div className="text-[11px] text-[#5E5B52] mt-0.5">
            Priority formula: <code className="text-[#181816] font-semibold">fire_risk × intervention_opportunity × consequence_factor</code>
          </div>
        </div>

        {/* Export CSV Button */}
        <a
          href={api.getExportUrl(horizon)}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 bg-[#181816] text-[#F6F5F0] hover:bg-[#33302A] text-[10px] font-bold flex items-center gap-1.5 transition"
        >
          <Download className="w-3 h-3 text-[#F6F5F0]" />
          <span>EXPORT CSV</span>
        </a>
      </div>

      {/* Filter Toolbar */}
      <div className="p-2.5 border-b border-[#DCD7CC] grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#F6F5F0]">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#767267] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter sector name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1 bg-[#FFFFFF] border border-[#DCD7CC] text-[11px] text-[#181816] placeholder-[#A49F93] focus:outline-none focus:border-[#181816]"
          />
        </div>

        {/* District Filter */}
        <div className="flex items-center gap-1 bg-[#FFFFFF] border border-[#DCD7CC] px-2 py-0.5">
          <Filter className="w-3 h-3 text-[#767267] shrink-0" />
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="bg-transparent text-[#181816] focus:outline-none w-full text-[11px] cursor-pointer font-semibold"
          >
            <option value="all">ALL PILOT DISTRICTS</option>
            <option value="Sangrur">SANGRUR (EPICENTER)</option>
            <option value="Ludhiana">LUDHIANA (AGRO-BELT)</option>
            <option value="Bathinda">BATHINDA (SW MALWA)</option>
            <option value="Tarn Taran">TARN TARAN (MAJHA)</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 bg-[#FFFFFF] border border-[#DCD7CC] px-2 py-0.5">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-[#181816] focus:outline-none w-full text-[11px] cursor-pointer font-semibold"
          >
            <option value="all">ALL PRIORITY LEVELS</option>
            <option value="CRITICAL_PREVENTION">CRITICAL PRE-FIRE (75+)</option>
            <option value="HIGH_PREVENTION">HIGH OUTREACH (55–74)</option>
            <option value="MEDIUM_MONITORING">MEDIUM MONITORING</option>
            <option value="OBSERVED_FIRE_DISPATCH">ACTIVE FIRES DETECTED</option>
            <option value="UNCERTAIN_VERIFICATION">UNCERTAIN / CLOUD</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto max-h-[500px] divide-y divide-[#DCD7CC]">
        <table className="w-full text-left text-[11px] border-collapse font-mono">
          <thead className="bg-[#EFECE4] text-[#4A473F] uppercase text-[10px] sticky top-0 z-10 border-b border-[#DCD7CC] font-bold">
            <tr>
              <th className="py-2.5 px-2.5">#</th>
              <th className="py-2.5 px-2.5">SECTOR / TEHSIL</th>
              <th className="py-2.5 px-2 text-center">INDEX</th>
              <th className="py-2.5 px-2">CATEGORY</th>
              <th className="py-2.5 px-2">PREVENTABILITY</th>
              <th className="py-2.5 px-2.5 text-right">STRAW (HA)</th>
              <th className="py-2.5 px-2.5">OPERATIONAL DIRECTIVE</th>
              <th className="py-2.5 px-2 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6DC] bg-[#FFFFFF]">
            {rankings.map((unit, index) => {
              const isSelected = selectedUnit?.unit_id === unit.unit_id;
              return (
                <tr
                  key={unit.unit_id}
                  onClick={() => onSelectUnit(unit)}
                  className={`cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#FEF3C7]/50 border-l-4 border-l-[#B45309]'
                      : 'hover:bg-[#F6F5F0]'
                  }`}
                >
                  {/* Rank */}
                  <td className="py-2.5 px-2.5 text-[#767267] font-bold">
                    {String(index + 1).padStart(2, '0')}
                  </td>

                  {/* Name */}
                  <td className="py-2.5 px-2.5">
                    <div className="font-bold text-[#181816] uppercase">{unit.name}</div>
                    <div className="text-[10px] text-[#767267]">
                      {unit.district} • [{unit.unit_id}]
                    </div>
                  </td>

                  {/* Index */}
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`font-bold font-serif text-sm ${
                        unit.priority_score >= 75
                          ? 'text-[#991B1B]'
                          : unit.priority_score >= 55
                          ? 'text-[#92400E]'
                          : unit.priority_score >= 35
                          ? 'text-[#4A473F]'
                          : 'text-[#166534]'
                      }`}
                    >
                      {unit.priority_score}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-2">
                    {getCategoryBadge(unit.priority_category)}
                  </td>

                  {/* Preventability */}
                  <td className="py-2.5 px-2 text-[10px] text-[#181816]">
                    <div className="font-bold">{unit.preventability_status.replace(/_/g, ' ')}</div>
                    <div className="text-[#767267]">
                      {unit.days_since_harvest ? `~${unit.days_since_harvest}d post-harvest` : 'Canopy standing'}
                    </div>
                  </td>

                  {/* Residue HA */}
                  <td className="py-2.5 px-2.5 text-right font-bold text-[#181816]">
                    {unit.estimated_unburned_residue_hectares.toLocaleString()}
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-2.5 text-[10px]">
                    <div className="text-[#92400E] font-bold truncate max-w-[210px]">
                      {unit.recommended_intervention?.action_type?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[#5E5B52] truncate max-w-[210px]">
                      {unit.recommended_intervention?.machinery_recommendation}
                    </div>
                  </td>

                  {/* Dossier trigger */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUnit(unit);
                      }}
                      className="px-2 py-0.5 bg-[#FFFFFF] hover:bg-[#181816] hover:text-[#F6F5F0] border border-[#181816] text-[#181816] font-bold text-[10px] transition"
                      title="Inspect technical evidence dossier"
                    >
                      DOSSIER
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
