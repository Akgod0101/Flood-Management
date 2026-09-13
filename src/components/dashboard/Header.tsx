'use client';

import React from 'react';
import { Basin, BasinEvent } from '@/types/flood';
import { Activity, ShieldAlert, Waves, Satellite, Clock } from 'lucide-react';

interface HeaderProps {
  currentBasin: Basin;
  currentEvent: BasinEvent;
  currentTimeLabel: string;
  isLiveIoT?: boolean;
  rainfallScenario?: 'normal' | 'heavy' | 'extreme';
}

export const Header: React.FC<HeaderProps> = ({
  currentBasin,
  currentEvent,
  currentTimeLabel,
  isLiveIoT = true,
  rainfallScenario = 'heavy',
}) => {
  const criticalCount = currentBasin.zones.filter(
    (z) => z.currentState.predictedFloodRisk === 'critical'
  ).length;

  const highCount = currentBasin.zones.filter(
    (z) => z.currentState.predictedFloodRisk === 'high'
  ).length;

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Hydro-Network Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400">
            <Waves className="w-4 h-4 text-cyan-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Flood<span className="text-cyan-400">Graph</span>
              </h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 font-mono">
                DEMO / SYNTHETIC SCAFFOLD
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
          <span className="text-slate-500">Target Geography:</span>
          <span className="text-slate-200 font-medium">{currentBasin.name}</span>
        </div>
      </div>

      {/* Center status indicators */}
      <div className="hidden lg:flex items-center gap-3 text-xs">
        {/* Live IoT In-Situ Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-slate-400">IoT Telemetry:</span>
          <span className="text-emerald-400 font-medium font-mono text-[11px]">LIVE STREAM</span>
        </div>

        {/* Rainfall Forecast Scenario Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${
            rainfallScenario === 'extreme'
              ? 'bg-rose-950/70 border-rose-600/50 text-rose-300'
              : rainfallScenario === 'heavy'
              ? 'bg-amber-950/70 border-amber-600/50 text-amber-300'
              : 'bg-slate-900/90 border-slate-800 text-slate-300'
          }`}
        >
          <span className="text-slate-400">Rain Forecast:</span>
          <span className="font-bold font-mono text-[11px] uppercase">
            {rainfallScenario === 'extreme'
              ? '⛈ EXTREME DELUGE'
              : rainfallScenario === 'heavy'
              ? '🌧 HEAVY MONSOON'
              : '🌤 NORMAL MONSOON'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">Data Stream:</span>
          <span className="text-amber-400 font-medium font-mono text-[11px]">DEMO / SYNTHETIC</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300">
          <Satellite className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Event Mode:</span>
          <span className="text-cyan-300 font-medium truncate max-w-[160px]">
            {currentEvent.name}
          </span>
        </div>

        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/50 border border-rose-800/60 text-rose-300 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {criticalCount > 0 ? `${criticalCount} Critical Zone` : ''}
              {criticalCount > 0 && highCount > 0 ? ' · ' : ''}
              {highCount > 0 ? `${highCount} High Alert` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Right controls & Time point indicator */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/20 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Step:</span>
          <span className="font-mono font-medium text-cyan-300">{currentTimeLabel}</span>
        </div>
      </div>
    </header>
  );
};
