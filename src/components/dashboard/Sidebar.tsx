'use client';

import React from 'react';
import { Basin, BasinEvent, Zone } from '@/types/flood';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Layers,
  MapPin,
  Calendar,
  Gauge,
  Network,
  Zap,
  AlertTriangle,
  CloudRain,
  CloudLightning,
  SunMedium,
} from 'lucide-react';

interface SidebarProps {
  basins: Basin[];
  selectedBasin: Basin;
  onSelectBasin: (basinId: string) => void;
  selectedEvent: BasinEvent;
  onSelectEvent: (eventId: string) => void;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onResetSimulation: () => void;
  simulationSpeed: number;
  onSetSimulationSpeed: (speed: number) => void;
  currentTimeLabel: string;
  rainfallScenario?: 'normal' | 'heavy' | 'extreme';
  onSelectRainfallScenario?: (scenario: 'normal' | 'heavy' | 'extreme') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  basins,
  selectedBasin,
  onSelectBasin,
  selectedEvent,
  onSelectEvent,
  selectedZoneId,
  onSelectZone,
  isPlaying,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onResetSimulation,
  simulationSpeed,
  onSetSimulationSpeed,
  currentTimeLabel,
  rainfallScenario = 'heavy',
  onSelectRainfallScenario,
}) => {
  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'warning':
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'watch':
      case 'moderate':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'safe':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <aside className="w-80 h-full border-r border-slate-800/80 bg-slate-950/90 flex flex-col z-20 shrink-0 select-none overflow-y-auto">
      {/* Sidebar Header / Brand */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span className="font-bold tracking-tight text-white text-sm">
              FloodGraph — Assam
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300 font-mono">
            DEMO
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Distributed predictive flood intelligence across Assam's Brahmaputra drainage network.
        </p>

        <div className="mt-3 p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10.5px] text-amber-300/90 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-tight">
            <span className="font-semibold text-amber-200">Scaffold Notice:</span> Values are synthetic development placeholders. Real Assam data (CWC gauges, IMD, Sentinel-1) will plug in during subsequent phases.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* 1. Basin Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            River Basin Selection
          </label>
          <div className="relative">
            <select
              value={selectedBasin.id}
              onChange={(e) => onSelectBasin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            >
              {basins.map((basin) => (
                <option key={basin.id} value={basin.id} className="bg-slate-900 text-white">
                  {basin.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px]">
              <span className="text-slate-500 block">Catchment Area</span>
              <span className="font-semibold text-slate-200">
                {selectedBasin.totalAreaKm2.toLocaleString()} km²
              </span>
            </div>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px]">
              <span className="text-slate-500 block">Active Zones</span>
              <span className="font-semibold text-cyan-400">
                {selectedBasin.zones.length} Zones
              </span>
            </div>
          </div>
        </div>

        {/* 2. Current Event Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            Event / Scenario Scenario
          </label>
          <select
            value={selectedEvent.id}
            onChange={(e) => onSelectEvent(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          >
            {selectedBasin.availableEvents.map((evt) => (
              <option key={evt.id} value={evt.id} className="bg-slate-900 text-white">
                [{evt.type.toUpperCase()}] {evt.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2 rounded border border-slate-800/60">
            {selectedEvent.description}
          </p>
        </div>

        {/* 2.5. Rainfall Forecast Scenario Selector */}
        {onSelectRainfallScenario && (
          <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                Rainfall Scenario
              </label>
              <span className="text-[10px] font-mono uppercase text-cyan-400">
                {rainfallScenario}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onSelectRainfallScenario('normal')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex flex-col items-center justify-center transition-all ${
                  rainfallScenario === 'normal'
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <SunMedium className="w-3 h-3 text-emerald-400 mb-0.5" />
                <span>Normal</span>
              </button>

              <button
                onClick={() => onSelectRainfallScenario('heavy')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex flex-col items-center justify-center transition-all ${
                  rainfallScenario === 'heavy'
                    ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CloudRain className="w-3 h-3 text-amber-400 mb-0.5" />
                <span>Heavy</span>
              </button>

              <button
                onClick={() => onSelectRainfallScenario('extreme')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border flex flex-col items-center justify-center transition-all ${
                  rainfallScenario === 'extreme'
                    ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CloudLightning className="w-3 h-3 text-rose-400 mb-0.5" />
                <span>Extreme</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Simulation Controls */}
        <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Simulation Controls
            </label>
            <span className="text-[11px] font-mono text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/50">
              {currentTimeLabel}
            </span>
          </div>

          {/* Playback action buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={onStepBack}
              title="Step Backward"
              className="p-2 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause Simulation' : 'Run Simulation'}
              className={`p-2 flex items-center justify-center rounded-lg transition-colors col-span-2 font-medium text-xs gap-1.5 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Simulate</span>
                </>
              )}
            </button>

            <button
              onClick={onStepForward}
              title="Step Forward"
              className="p-2 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed selector & Reset */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 mr-1">Speed:</span>
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSetSimulationSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    simulationSpeed === spd
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={onResetSimulation}
              title="Reset to Live State"
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* 4. Hydrological Zones Quick-List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              Catchment Zones ({selectedBasin.zones.length})
            </label>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {selectedBasin.zones.map((zone: Zone) => {
              const isSelected = selectedZoneId === zone.id;
              const risk = zone.riskLevel || zone.currentState.floodRisk || 'safe';
              return (
                <button
                  key={zone.id}
                  onClick={() => onSelectZone(zone.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm shadow-cyan-950/50'
                      : 'bg-slate-900/40 hover:bg-slate-800/60 border-slate-800/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-slate-400">{zone.code}</span>
                      <span
                        className={`text-xs font-medium truncate ${
                          isSelected ? 'text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        {zone.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>{zone.elevationMeters}m elev.</span>
                      <span>•</span>
                      <span>Lvl: {zone.currentWaterLevelMeters.toFixed(2)}m</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ml-2 ${getRiskBadgeColor(
                      risk
                    )}`}
                  >
                    {risk}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer system status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-[10.5px]">Scaffold: Brahmaputra Corridor</span>
        </div>
        <span className="font-mono text-slate-400 text-[10.5px]">{selectedBasin.edges.length} Flow Edges</span>
      </div>
    </aside>
  );
};
