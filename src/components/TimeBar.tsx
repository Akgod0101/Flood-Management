'use client';

import { Clock, Waves, TrendingUp } from 'lucide-react';
import type { SimState } from '@/simulation/engine';
import { riskColor, formatTimeShort } from '@/lib/utils';

interface Props {
  state: SimState;
  onSeek: (tick: number) => void;
}

export function TimeBar({ state, onSeek }: Props) {
  const history = state.history;

  const ticks = history.length > 0
    ? history
    : [{ tick: 0, timestamp: new Date().toISOString(), zoneStates: {}, edgeStates: {}, sarPass: null, alerts: [] }];

  const maxRiver = state.zones.length > 0 ? Math.max(...state.zones.map((z) => z.state.riverLevel)) : 0;
  const maxRain = state.zones.length > 0 ? Math.max(...state.zones.map((z) => z.state.rainfallIntensity)) : 0;
  const maxFlow = state.zones.length > 0 ? Math.max(...state.zones.map((z) => z.state.predictedOutgoingFlow)) : 0;

  return (
    <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 flex-shrink-0">
      <div className="flex items-center gap-6">
        {/* Tick indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Clock className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-xs text-slate-400">Simulation Time</p>
            <p className="text-sm font-mono text-white">
              T+{String(state.tick).padStart(3, '0')} · {formatTimeShort(new Date().toISOString())}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 h-12 overflow-x-auto">
            {ticks.map((snap, i) => {
              const maxRisk = snap.zoneStates
                ? Math.max(0, ...Object.values(snap.zoneStates).map((zs) => zs.riskScore))
                : 0;
              const heightPct = Math.max(4, (maxRisk / 100) * 100);
              return (
                <button
                  key={i}
                  onClick={() => onSeek(snap.tick)}
                  className="flex-shrink-0 w-8 h-full flex flex-col items-center justify-end gap-1 group relative cursor-pointer"
                  title={`T+${snap.tick} · Max risk: ${maxRisk}`}
                >
                  <span className="text-[9px] text-slate-500 group-hover:text-slate-300 font-mono">
                    {snap.tick}
                  </span>
                  <div
                    className="w-5 rounded-t transition-all group-hover:w-6"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: riskColor(maxRisk),
                      opacity: snap.tick === state.tick ? 1 : 0.5,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-500">Tick history (click to seek past snapshot)</span>
            <span className="text-[10px] text-slate-500 font-mono">{history.length} snapshots stored</span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Max River Level</p>
              <p className="text-sm font-bold text-blue-300 font-mono">
                {maxRiver.toFixed(1)} m
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <div>
              <p className="text-xs text-slate-400">Max Rainfall</p>
              <p className="text-sm font-bold text-orange-300 font-mono">
                {maxRain.toFixed(1)} mm/h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="text-xs text-slate-400">Max Flow</p>
              <p className="text-sm font-bold text-cyan-300 font-mono">
                {maxFlow} m³/s
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
