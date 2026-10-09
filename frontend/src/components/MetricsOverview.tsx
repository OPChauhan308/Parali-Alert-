import React from 'react';
import { SummaryStats } from '../types';
import { Wheat, Wind, Activity } from 'lucide-react';

interface MetricsOverviewProps {
  stats: SummaryStats;
  weatherData?: any;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ stats, weatherData }) => {
  const windDir = weatherData?.horizon_48h?.prevailing_wind_direction_deg ?? 315;
  const windSpeed = weatherData?.horizon_48h?.avg_wind_speed_kmh ?? 13.5;
  const windCompass = weatherData?.horizon_48h?.wind_compass ?? 'NW';

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#DCD7CC] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-[#DCD7CC] font-mono shadow-sm">
      {/* 01: Critical Priority Pre-Fire */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>01 // CRITICAL INTERVENTION</span>
          <span className="w-2 h-2 bg-[#B91C1C]"></span>
        </div>
        <div className="my-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#991B1B] tracking-tight font-serif">
            {stats.critical_prevention_units}
          </span>
          <span className="text-[10px] text-[#767267] font-semibold">SECTORS</span>
        </div>
        <div className="text-[10px] text-[#991B1B] font-semibold tracking-tight">
          SCORE &ge; 75 (IMMEDIATE CRM)
        </div>
      </div>

      {/* 02: High Outreach */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>02 // HIGH PREVENTABILITY</span>
          <span className="w-2 h-2 bg-[#B45309]"></span>
        </div>
        <div className="my-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#92400E] tracking-tight font-serif">
            {stats.high_prevention_units}
          </span>
          <span className="text-[10px] text-[#767267] font-semibold">SECTORS</span>
        </div>
        <div className="text-[10px] text-[#92400E] font-semibold tracking-tight">
          1–5 DAYS POST-HARVEST
        </div>
      </div>

      {/* 03: Active Fires */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>03 // ACTIVE THERMAL ANOMALIES</span>
          <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse"></span>
        </div>
        <div className="my-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#DC2626] tracking-tight font-serif">
            {stats.active_fire_dispatch_units}
          </span>
          <span className="text-[10px] text-[#B91C1C] font-bold">DETECTED</span>
        </div>
        <div className="text-[10px] text-[#767267] font-mono tracking-tight">
          VIIRS 375m THERMAL PIXELS
        </div>
      </div>

      {/* 04: Residue Area */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>04 // UNBURNED STRAW AREA</span>
          <Wheat className="w-3.5 h-3.5 text-[#166534]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-[#181816] tracking-tight font-serif">
            {stats.total_unburned_residue_hectares.toLocaleString()}
          </span>
          <span className="text-[10px] text-[#166534] font-bold">HA</span>
        </div>
        <div className="text-[10px] text-[#767267] font-mono tracking-tight">
          POST-HARVEST RESIDUE PROXY
        </div>
      </div>

      {/* 05: Mean Regional Score */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>05 // REGIONAL RISK INDEX</span>
          <Activity className="w-3.5 h-3.5 text-[#181816]" />
        </div>
        <div className="my-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-[#181816] tracking-tight font-serif">
            {stats.average_priority_score}
          </span>
          <span className="text-[10px] text-[#767267]">/ 100</span>
        </div>
        <div className="text-[10px] text-[#767267] font-mono tracking-tight">
          WEIGHTED COMPOSITE VELOCITY
        </div>
      </div>

      {/* 06: Plume Vector */}
      <div className="p-3.5 flex flex-col justify-between bg-[#FFFFFF]">
        <div className="text-[10px] text-[#767267] uppercase tracking-wider flex items-center justify-between font-bold">
          <span>06 // DOWNWIND DISPERSION</span>
          <Wind className="w-3.5 h-3.5 text-[#181816]" />
        </div>
        <div className="my-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#181816] font-serif">
            {windCompass} {Math.round(windDir)}°
          </span>
          <span className="text-[10px] text-[#767267]">@{Math.round(windSpeed)} km/h</span>
        </div>
        <div className="text-[10px] text-[#4A473F] font-semibold tracking-tight">
          SE CORRIDOR &rarr; NCR RECEPTOR
        </div>
      </div>
    </div>
  );
};
