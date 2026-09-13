'use client';

import type { SimState } from '@/simulation/engine';
import { alertLevelBg, riskColor, formatTime } from '@/lib/utils';
import { Bell, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

interface Props {
  state: SimState;
  onSelectZone: (id: string) => void;
}

export function Alerts({ state, onSelectZone }: Props) {
  const sortedAlerts = [...state.alerts].sort((a, b) => {
    const order = { DANGER: 0, WARNING: 1, WATCH: 2, NORMAL: 3 };
    return order[a.level] - order[b.level];
  });

  const dangerCount = state.alerts.filter((a) => a.level === 'DANGER').length;
  const warningCount = state.alerts.filter((a) => a.level === 'WARNING').length;
  const watchCount = state.alerts.filter((a) => a.level === 'WATCH').length;

  return (
    <div className="overflow-y-auto h-full p-6 w-full">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Alert System</h2>
            <p className="text-sm text-slate-400">Threshold-based flood warnings across all zones</p>
          </div>
        </div>

        {/* Alert summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AlertStat label="DANGER" count={dangerCount} color="bg-red-600" />
          <AlertStat label="WARNING" count={warningCount} color="bg-orange-600" />
          <AlertStat label="WATCH" count={watchCount} color="bg-yellow-500" />
          <AlertStat label="Total" count={state.alerts.length} color="bg-slate-700" />
        </div>

        {/* Threshold info */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Alert Thresholds (Configurable)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ThresholdCard label="NORMAL" range="0-40" color="#22c55e" />
            <ThresholdCard label="WATCH" range="40-60" color="#eab308" />
            <ThresholdCard label="WARNING" range="60-80" color="#ea580c" />
            <ThresholdCard label="DANGER" range="80-100" color="#dc2626" />
          </div>
          <p className="mt-3 text-xs text-slate-400 leading-relaxed">
            Alerts trigger when: risk crosses threshold, predicted water level crosses local threshold,
            time-to-danger becomes short, or upstream severe event is expected to propagate downstream.
          </p>
        </div>

        {/* Active alerts */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Current Warnings</h3>
          {sortedAlerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800">
              <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <p className="text-sm text-slate-400">No active alerts. All zones operating normally. System monitoring.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-slate-800 border border-slate-700 animate-fade-in shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-bold font-mono ${alertLevelBg(alert.level)}`}>
                      {alert.level}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{alert.zoneName}</span>
                        <button
                          onClick={() => onSelectZone(alert.zoneId)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          View zone <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTime(alert.timestamp)}
                        </span>
                        {alert.timeToDanger < 99 && (
                          <span className="flex items-center gap-1 text-red-400 font-mono font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            TTD: {alert.timeToDanger}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per-zone alert status */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Per-Zone Alert Status</h3>
          <div className="space-y-2">
            {state.zones
              .sort((a, b) => b.state.riskScore - a.state.riskScore)
              .map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => onSelectZone(zone.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <div className={`px-2 py-1 rounded text-[10px] font-bold font-mono ${alertLevelBg(zone.state.alertLevel)}`}>
                    {zone.state.alertLevel}
                  </div>
                  <span className="text-xs font-medium text-white flex-1">{zone.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${zone.state.riskScore}%`, backgroundColor: riskColor(zone.state.riskScore) }}
                      />
                    </div>
                    <span className="text-xs font-bold font-mono w-8 text-right" style={{ color: riskColor(zone.state.riskScore) }}>
                      {zone.state.riskScore}
                    </span>
                    {zone.state.timeToDanger < 99 && (
                      <span className="text-[10px] text-red-400 font-mono w-12 text-right">{zone.state.timeToDanger}h</span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-xs text-slate-400 italic">
            Alerts are model predictions, not guaranteed outcomes. BasinFlow AI is not an official government
            warning authority. Always follow official evacuation orders from local disaster management authorities.
          </p>
        </div>
      </div>
    </div>
  );
}

function AlertStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 text-center shadow">
      <div className={`w-8 h-8 rounded-full ${color} mx-auto mb-2 flex items-center justify-center shadow-md`}>
        <span className="text-white text-sm font-bold font-mono">{count}</span>
      </div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

function ThresholdCard({ label, range, color }: { label: string; range: string; color: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-800 text-center">
      <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: color }} />
      <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      <p className="text-[10px] text-slate-400 font-mono">{range}</p>
    </div>
  );
}
