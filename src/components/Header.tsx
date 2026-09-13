'use client';

import { Activity, Radio, AlertTriangle, Satellite, Brain } from 'lucide-react';
import type { SimState } from '@/simulation/engine';
import { riskColor } from '@/lib/utils';

interface Props {
  state: SimState;
  activeAlerts: number;
  mlOnline?: boolean;
  mlAlgorithm?: string;
}

export function Header({ state, activeAlerts, mlOnline = false, mlAlgorithm = 'XGBoost' }: Props) {
  const maxRisk = state.zones.length > 0 ? Math.max(...state.zones.map((z) => z.state.riskScore)) : 0;
  const avgRisk = state.zones.length > 0
    ? Math.round(state.zones.reduce((s, z) => s + z.state.riskScore, 0) / state.zones.length)
    : 0;

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
          <Radio className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">BasinFlow AI</h1>
          <p className="text-xs text-slate-400">Distributed Flood Intelligence Network</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* ML Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
          <Brain className={`w-4 h-4 ${mlOnline ? 'text-purple-400' : 'text-slate-500'}`} />
          <div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${mlOnline ? 'bg-purple-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-[10px] text-slate-400 uppercase font-semibold">ML Engine</span>
            </div>
            <p className={`text-xs font-bold font-mono ${mlOnline ? 'text-purple-300' : 'text-slate-500'}`}>
              {mlOnline ? `${mlAlgorithm} Active` : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-xs text-slate-400">Avg Risk</p>
            <p className="text-sm font-bold font-mono" style={{ color: riskColor(avgRisk) }}>{avgRisk}/100</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <div>
            <p className="text-xs text-slate-400">Max Risk</p>
            <p className="text-sm font-bold font-mono" style={{ color: riskColor(maxRisk) }}>{maxRisk}/100</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <div>
            <p className="text-xs text-slate-400">Active Alerts</p>
            <p className="text-sm font-bold font-mono text-white">{activeAlerts}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-xs text-slate-400">SAR Lag</p>
            <p className="text-sm font-bold font-mono text-cyan-300">
              {state.sarPass ? `${state.sarPass.lagHours}h` : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
          <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-500 pulse-dot' : 'bg-slate-500'}`} />
          <span className="text-xs text-slate-300">{state.eventLabel}</span>
        </div>
      </div>
    </header>
  );
}
