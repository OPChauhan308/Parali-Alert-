import React from 'react';
import { EvaluationData } from '../types';
import { X, Award, Clock } from 'lucide-react';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  evaluationData: EvaluationData | null;
}

export const EvaluationModal: React.FC<EvaluationModalProps> = ({
  isOpen,
  onClose,
  evaluationData
}) => {
  if (!isOpen || !evaluationData) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-[#181816]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FFFFFF] border-2 border-[#181816] shadow-2xl p-5 text-[#181816] flex flex-col gap-4 font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DCD7CC] pb-3 bg-[#EFECE4] -m-5 mb-0 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#181816] text-[#F6F5F0] shrink-0 border border-[#181816]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-serif uppercase tracking-wider text-[#181816]">
                {evaluationData.evaluation_title}
              </h2>
              <div className="text-[11px] text-[#5E5B52] mt-1">
                RIGID TEMPORAL SPLIT (ZERO DATA LEAKAGE) • SAMPLE: {evaluationData.sample_size} UNIT-DAYS (GROUND TRUTH INCIDENCE: {evaluationData.positive_fire_rate_pct}%)
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-[#FFFFFF] hover:bg-[#181816] hover:text-[#F6F5F0] border border-[#181816] text-[#181816] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Empirical Finding Banner */}
        <div className="p-3.5 bg-[#DCFCE7] border-l-4 border-l-[#166534] border border-[#86EFAC]">
          <div className="text-[10px] text-[#14532D] font-bold uppercase tracking-wider mb-1">
            KEY BACKTEST FINDING // ADVANCE OPERATIONAL LEAD TIME
          </div>
          <p className="text-xs text-[#14532D] font-medium leading-relaxed">
            {evaluationData.conclusion}
          </p>
        </div>

        {/* Benchmark Matrix Table */}
        <div className="overflow-x-auto border border-[#DCD7CC]">
          <table className="w-full text-left text-[11px] border-collapse font-mono">
            <thead className="bg-[#EFECE4] text-[#4A473F] uppercase text-[10px] border-b border-[#DCD7CC] font-bold">
              <tr>
                <th className="py-2.5 px-3">MODEL / APPROACH</th>
                <th className="py-2.5 px-2">PARADIGM</th>
                <th className="py-2.5 px-2 text-right">PRECISION @ TOP 10%</th>
                <th className="py-2.5 px-2 text-right">RECALL @ TOP 10%</th>
                <th className="py-2.5 px-2 text-right">PR-AUC</th>
                <th className="py-2.5 px-3 text-right">PRE-FIRE LEAD TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE6DC] bg-[#FFFFFF]">
              {evaluationData.benchmarks.map((b, idx) => {
                const isParali = b.system_name.includes('Parali Alert');
                return (
                  <tr
                    key={idx}
                    className={isParali ? 'bg-[#FEF3C7]/60 font-bold' : 'hover:bg-[#F6F5F0]'}
                  >
                    <td className="py-2.5 px-3">
                      <div className={isParali ? 'text-[#92400E] font-bold' : 'text-[#181816]'}>
                        {b.system_name.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-[#767267] font-normal">
                        {b.advantage || b.limitation}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-[#4A473F] text-[10px]">
                      {b.type}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-[#181816]">
                      {b.precision_top_10pct}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-[#166534]">
                      {b.recall_top_10pct}%
                    </td>
                    <td className="py-2.5 px-2 text-right text-[#4A473F]">
                      {b.pr_auc}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#92400E]">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {b.lead_time_hours} HRS
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* District Performance Breakdown */}
        <div>
          <div className="text-[10px] text-[#767267] uppercase tracking-wider font-bold mb-2">
            DISTRICT-LEVEL HELD-OUT PERFORMANCE (RIGID TEMPORAL SPLIT):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(evaluationData.district_performance).map(([dist, stats]) => (
              <div key={dist} className="bg-[#F6F5F0] border border-[#DCD7CC] p-3">
                <div className="font-bold text-[#181816] uppercase text-[11px] font-serif">{dist}</div>
                <div className="text-[10px] text-[#767267] mt-0.5">{stats.n_events} GROUND TRUTH EVENTS</div>
                <div className="mt-2 text-[10px] flex justify-between">
                  <span className="text-[#5E5B52]">TOP-10% RECALL:</span>
                  <span className="font-bold text-[#166534]">{Math.round(stats.recall_top_10pct * 100)}%</span>
                </div>
                <div className="text-[10px] flex justify-between mt-0.5">
                  <span className="text-[#5E5B52]">PRECISION:</span>
                  <span className="font-bold text-[#92400E]">{Math.round(stats.precision_top_10pct * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#DCD7CC] pt-2 text-[10px] text-[#767267]">
          <span>RIGID TEMPORAL SPLIT ENFORCEMENT • SCIENTIFIC INTEGRITY BENCHMARK</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#181816] text-[#F6F5F0] hover:bg-[#33302A] text-[11px] font-bold transition"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
