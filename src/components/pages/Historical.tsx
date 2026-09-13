'use client';

import { useState, useEffect } from 'react';
import { historicalEvents } from '@/data/historical';
import { riskColor } from '@/lib/utils';
import { History, Calendar, MapPin, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend,
} from 'recharts';

export function Historical() {
  const [selectedId, setSelectedId] = useState(historicalEvents[0].id);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const event = historicalEvents.find((e) => e.id === selectedId) || historicalEvents[0];

  return (
    <div className="flex h-full w-full">
      {/* Event selector */}
      <div className="w-64 bg-slate-900 border-r border-slate-700 overflow-y-auto p-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3 px-1">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 uppercase">Historical Events</h3>
        </div>
        <div className="space-y-2">
          {historicalEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                selectedId === e.id ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <p className="text-sm font-semibold">{e.name}</p>
              <p className="text-xs opacity-80 mt-1 font-mono">{e.date}</p>
              <p className="text-[10px] opacity-70">{e.region}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Event detail */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Event header */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-1">{event.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-3">
              <div className="flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                {event.date}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                {event.region}
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                Peak: {event.peakDischarge}
              </div>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>
            <p className="text-xs text-slate-400 mt-2">Affected: <span className="text-slate-200 font-semibold">{event.affectedPeople}</span></p>
          </div>

          {/* Risk comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <RiskCard label="Risk Before Event" score={event.riskBefore} />
            <RiskCard label="Risk During Event" score={event.riskDuring} />
            <RiskCard label="Risk After Event" score={event.riskAfter} />
          </div>

          {/* Risk increase */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Risk Trajectory Progression</h3>
              <span className="text-2xl font-bold font-mono" style={{ color: riskColor(event.riskDuring) }}>
                +{event.riskDuring - event.riskBefore}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The model&apos;s risk score rose from <span className="text-white font-bold">{event.riskBefore}</span> to{' '}
              <span className="text-white font-bold">{event.riskDuring}</span> — an increase of{' '}
              <span style={{ color: riskColor(event.riskDuring) }} className="font-bold">
                {Math.round(((event.riskDuring - event.riskBefore) / event.riskBefore) * 100)}%
              </span>
              . The risk rose BEFORE the peak event, demonstrating early-warning value from repeated satellite passes
              combined with continuous local observations.
            </p>
          </div>

          {/* Risk timeline chart */}
          {mounted && (
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
              <h3 className="text-sm font-semibold text-white mb-3">
                Risk Score vs. Observed Flood Extent Over Time
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={event.riskTimeline}>
                    <defs>
                      <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="obsArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="risk" name="Model Risk Score" stroke="#0ea5e9" fill="url(#riskArea)" strokeWidth={2} />
                    <Area type="monotone" dataKey="observed" name="Observed Flood Extent" stroke="#ea580c" fill="url(#obsArea)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Blue line: model predicted risk score. Orange line: observed flood extent from SAR/satellite imagery.
                The model risk score rises before the observed peak, confirming early-warning capability.
              </p>
            </div>
          )}

          {/* Validation metrics */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white">Validation Metrics — Model vs. SAR Observation</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricCard label="SAR Observed Extent" value={`${event.sarObservedExtent}%`} />
              <MetricCard label="Model Predicted Extent" value={`${event.modelPredictedExtent}%`} />
              <MetricCard label="IoU" value={event.iou.toFixed(2)} />
              <MetricCard label="Precision" value={event.precision.toFixed(2)} />
              <MetricCard label="Recall" value={event.recall.toFixed(2)} />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricCard label="F1 Score" value={event.f1.toFixed(2)} />
              <MetricCard label="Spatial Overlap" value={`${Math.round(event.iou * 100)}%`} />
            </div>
          </div>

          {/* Validation note */}
          <div className="p-4 rounded-xl bg-amber-600/10 border border-amber-600/30 flex items-start gap-3 shadow-md">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-200 mb-1">Validation Methodology</p>
              <p className="text-xs text-amber-200/80 leading-relaxed">{event.validationNote}</p>
            </div>
          </div>

          {/* Before / During / After comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">Before Event</h4>
              <div className="h-24 rounded-lg flex items-end p-2" style={{ background: riskColor(event.riskBefore) + '15' }}>
                <div className="w-full">
                  <div className="text-2xl font-bold font-mono" style={{ color: riskColor(event.riskBefore) }}>{event.riskBefore}</div>
                  <div className="text-[10px] text-slate-500">Risk score</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">During Event</h4>
              <div className="h-24 rounded-lg flex items-end p-2" style={{ background: riskColor(event.riskDuring) + '15' }}>
                <div className="w-full">
                  <div className="text-2xl font-bold font-mono" style={{ color: riskColor(event.riskDuring) }}>{event.riskDuring}</div>
                  <div className="text-[10px] text-slate-500">Risk score</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
              <h4 className="text-xs font-semibold text-slate-400 mb-2">After Event</h4>
              <div className="h-24 rounded-lg flex items-end p-2" style={{ background: riskColor(event.riskAfter) + '15' }}>
                <div className="w-full">
                  <div className="text-2xl font-bold font-mono" style={{ color: riskColor(event.riskAfter) }}>{event.riskAfter}</div>
                  <div className="text-[10px] text-slate-500">Risk score</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 text-center shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold font-mono" style={{ color: riskColor(score) }}>{score}</p>
      <p className="text-[10px] text-slate-500 mt-1 font-mono">/ 100</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-center">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
    </div>
  );
}
