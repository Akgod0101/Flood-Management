'use client';

import React, { useState } from 'react';
import {
  Basin,
  Zone,
  TimeSeriesPoint,
  BasinRainfallForecast,
  RainfallScenario,
} from '@/types/flood';
import { ForecastPanel } from './ForecastPanel';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CloudRain,
  Gauge,
  Layers,
  Radio,
  Mountain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Waves,
  ShieldAlert,
  Compass,
} from 'lucide-react';

interface ZoneDetailsPanelProps {
  basin: Basin;
  selectedZone: Zone | null;
  onSelectZone: (zoneId: string) => void;
  onClearSelection: () => void;
  basinForecast?: BasinRainfallForecast | null;
  rainfallScenario?: RainfallScenario;
  onSelectScenario?: (scenario: RainfallScenario) => void;
}

export const ZoneDetailsPanel: React.FC<ZoneDetailsPanelProps> = ({
  basin,
  selectedZone,
  onSelectZone,
  onClearSelection,
  basinForecast,
  rainfallScenario = 'heavy',
  onSelectScenario,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'forecast'>('details');
  const getRiskStyles = (risk: string) => {
    switch (risk) {
      case 'critical':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          text: 'text-rose-400',
          border: 'border-rose-500/40',
          accent: '#f43f5e',
        };
      case 'warning':
      case 'high':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          text: 'text-amber-400',
          border: 'border-amber-500/40',
          accent: '#f59e0b',
        };
      case 'watch':
      case 'moderate':
        return {
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          text: 'text-sky-400',
          border: 'border-sky-500/40',
          accent: '#0284c7',
        };
      case 'safe':
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          text: 'text-emerald-400',
          border: 'border-emerald-500/40',
          accent: '#10b981',
        };
    }
  };

  // Render SVG Sparkline for Water Level over time with Danger Threshold Line
  const renderWaterLevelChart = (
    history: TimeSeriesPoint[],
    currentLvl: number,
    dangerThreshold: number
  ) => {
    if (!history || history.length === 0) return null;

    const width = 310;
    const height = 90;
    const padding = { top: 12, right: 10, bottom: 20, left: 28 };

    const maxVal = Math.max(dangerThreshold * 1.08, ...history.map((h) => h.value));
    const minVal = Math.max(0, Math.min(...history.map((h) => h.value)) * 0.85);
    const valRange = maxVal - minVal || 1;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = history.map((pt, idx) => {
      const x = padding.left + (idx / (history.length - 1)) * chartW;
      const y = padding.top + chartH - ((pt.value - minVal) / valRange) * chartH;
      return { x, y, value: pt.value, time: pt.time };
    });

    const linePathD = points.reduce(
      (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );

    const areaPathD = `${linePathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

    const dangerY = padding.top + chartH - ((dangerThreshold - minVal) / valRange) * chartH;

    return (
      <div className="rounded-xl bg-slate-950/80 p-2 border border-slate-800/80">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 px-1">
          <span className="font-semibold text-slate-300">12h Stage Progression</span>
          <span className="font-mono text-rose-400 flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-rose-500 inline-block border-t border-dashed" />
            Threshold: {dangerThreshold.toFixed(2)}m
          </span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
          <defs>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={width - padding.right}
            y2={padding.top + chartH}
            stroke="#1e293b"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#1e293b"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Danger Threshold Line */}
          {dangerY >= padding.top && dangerY <= padding.top + chartH && (
            <line
              x1={padding.left}
              y1={dangerY}
              x2={width - padding.right}
              y2={dangerY}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Area Fill */}
          <path d={areaPathD} fill="url(#waterGrad)" />

          {/* Water level curve */}
          <path d={linePathD} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />

          {/* Latest value point */}
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3.5"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="1.5"
          />

          {/* Axis labels */}
          <text x={padding.left - 4} y={padding.top + 4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">
            {maxVal.toFixed(1)}m
          </text>
          <text x={padding.left - 4} y={padding.top + chartH} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">
            {minVal.toFixed(1)}m
          </text>
          <text x={padding.left} y={height - 4} fill="#64748b" fontSize="8" fontFamily="monospace">
            -12h
          </text>
          <text x={width - padding.right} y={height - 4} fill="#38bdf8" fontSize="8" textAnchor="end" fontFamily="monospace">
            Now ({currentLvl.toFixed(2)}m)
          </text>
        </svg>
      </div>
    );
  };

  // Render SVG Bar Chart for Rainfall over time
  const renderRainfallChart = (history: TimeSeriesPoint[], currentRain: number) => {
    if (!history || history.length === 0) return null;

    const width = 310;
    const height = 75;
    const padding = { top: 8, right: 8, bottom: 18, left: 26 };

    const maxRain = Math.max(10, ...history.map((h) => h.value)) * 1.15;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barWidth = Math.max(8, chartW / history.length - 4);

    return (
      <div className="rounded-xl bg-slate-950/80 p-2 border border-slate-800/80">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 px-1">
          <span className="font-semibold text-slate-300">12h Hyetograph (Precipitation)</span>
          <span className="font-mono text-cyan-300">Peak: {Math.max(...history.map((h) => h.value))} mm/h</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
          {/* Baseline */}
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={width - padding.right}
            y2={padding.top + chartH}
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Bars */}
          {history.map((pt, idx) => {
            const barH = (pt.value / maxRain) * chartH;
            const x = padding.left + idx * (chartW / history.length) + 2;
            const y = padding.top + chartH - barH;
            const isLatest = idx === history.length - 1;

            return (
              <g key={idx} className="group">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, barH)}
                  rx="1.5"
                  fill={isLatest ? '#38bdf8' : '#0284c7'}
                  fillOpacity={isLatest ? 0.95 : 0.65}
                  className="transition-all hover:fill-cyan-300"
                />
              </g>
            );
          })}

          {/* Labels */}
          <text x={padding.left - 4} y={padding.top + 5} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">
            {maxRain.toFixed(0)}
          </text>
          <text x={padding.left - 4} y={padding.top + chartH} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">
            0
          </text>
          <text x={padding.left} y={height - 3} fill="#64748b" fontSize="8" fontFamily="monospace">
            -11h
          </text>
          <text x={width - padding.right} y={height - 3} fill="#38bdf8" fontSize="8" textAnchor="end" fontFamily="monospace">
            Now ({currentRain.toFixed(1)}mm)
          </text>
        </svg>
      </div>
    );
  };

  // If no zone selected, show Basin overview
  if (!selectedZone) {
    const criticalZones = basin.zones.filter((z) => z.riskLevel === 'critical');
    const warningZones = basin.zones.filter((z) => z.riskLevel === 'warning');
    const watchZones = basin.zones.filter((z) => z.riskLevel === 'watch');
    const safeZones = basin.zones.filter((z) => z.riskLevel === 'safe');

    return (
      <aside className="w-96 h-full border-l border-slate-800/80 bg-slate-950/95 flex flex-col z-20 shrink-0 select-none overflow-y-auto">
        <div className="p-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Basin Overview
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              Aggregate
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {basin.name} ({basin.region})
          </p>
          <span className="text-[10px] font-mono text-amber-300/80 mt-1 block">
            DEMO SCAFFOLD · REAL CWC/IMD/SENTINEL PIPELINE IN PROGRESS
          </span>
        </div>

        {/* Tab switcher: Overview vs Rainfall Forecast */}
        <div className="flex border-b border-slate-800/80 bg-slate-900/50 sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'details'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Basin Overview
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'forecast'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            Rainfall Forecast
          </button>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {activeTab === 'forecast' && basinForecast ? (
            <ForecastPanel
              scenario={rainfallScenario}
              onSelectScenario={onSelectScenario || (() => {})}
              basinForecast={basinForecast}
              selectedZone={null}
              onSelectZone={onSelectZone}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Total Zones</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">{basin.zones.length} Zones</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Catchment Area</span>
                  <span className="text-lg font-bold text-cyan-400 mt-0.5 block">{basin.totalAreaKm2} km²</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Flow Channels</span>
                  <span className="text-lg font-bold text-indigo-400 mt-0.5 block">{basin.edges.length} Edges</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[11px] block">Critical Corridors</span>
                  <span className="text-lg font-bold text-rose-400 mt-0.5 block">{criticalZones.length} Zones</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                    Risk Tier Distribution
                  </span>
                  <span className="text-rose-400 text-[11px] font-mono">{criticalZones.length} Critical</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {basin.zones.map((zone) => {
                    const styles = getRiskStyles(zone.riskLevel);
                    return (
                      <button
                        key={zone.id}
                        onClick={() => onSelectZone(zone.id)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 text-xs transition-colors"
                      >
                        <div className="text-left">
                          <span className="text-slate-200 font-medium block">{zone.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {zone.elevationMeters}m elev. · {zone.currentWaterLevelMeters.toFixed(2)}m stage
                          </span>
                        </div>
                        <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${styles.badge}`}>
                          {zone.riskLevel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-300 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  Click any zone polygon on the map or select from the list to open its local live digital twin state.
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }

  const state = selectedZone.currentState;
  const riskStyles = getRiskStyles(selectedZone.riskLevel);

  // Direct upstream sources and downstream receivers
  const upstreamZones = basin.zones.filter((z) => selectedZone.upstreamZoneIds.includes(z.id));
  const downstreamZones = basin.zones.filter((z) => selectedZone.downstreamZoneIds.includes(z.id));

  // Threshold ratio for current condition
  const thresholdRatio = Math.min(100, Math.round((state.currentWaterLevel / state.dangerThreshold) * 100));
  const netFlow = state.incomingFlow - state.outgoingFlow;

  return (
    <aside className="w-96 h-full border-l border-slate-800/80 bg-slate-950/95 flex flex-col z-20 shrink-0 select-none overflow-y-auto">
      {/* Top sticky Zone Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur-md z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
              {selectedZone.code}
            </span>
            <h2 className="text-sm font-bold text-white truncate max-w-[190px]">
              {selectedZone.name}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300">
              DEMO / SYNTHETIC VALUES
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Brahmaputra Reach
            </span>
          </div>
        </div>

        <button
          onClick={onClearSelection}
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800 transition-colors"
        >
          Overview
        </button>
      </div>

      {/* Tab switcher: Digital State vs Rainfall Forecast */}
      <div className="flex border-b border-slate-800/80 bg-slate-900/50 sticky top-[73px] z-10">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'details'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Digital State
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'forecast'
              ? 'border-cyan-400 text-cyan-300 bg-slate-900/80'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
          Zone Forecast
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 text-xs">
        {activeTab === 'forecast' && basinForecast ? (
          <ForecastPanel
            scenario={rainfallScenario}
            onSelectScenario={onSelectScenario || (() => {})}
            basinForecast={basinForecast}
            selectedZone={selectedZone}
            onClearZoneSelection={onClearSelection}
            onSelectZone={onSelectZone}
          />
        ) : (
          <>
            {/* ======================================================== */}
            {/* SECTION 1: CURRENT CONDITION */}
            {/* ======================================================== */}
        <div className={`p-3.5 rounded-xl bg-slate-900/80 border ${riskStyles.border} space-y-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              1. Current Condition
            </span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${riskStyles.badge}`}>
              {selectedZone.riskLevel}
            </span>
          </div>

          {/* Stage vs Threshold Progress Gauge */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Current Stage / Danger Limit:</span>
              <span className="font-mono font-bold text-white">
                {state.currentWaterLevel.toFixed(2)}m / {state.dangerThreshold.toFixed(2)}m
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${thresholdRatio}%`,
                  backgroundColor:
                    thresholdRatio >= 90
                      ? '#f43f5e'
                      : thresholdRatio >= 75
                      ? '#f59e0b'
                      : thresholdRatio >= 50
                      ? '#0284c7'
                      : '#10b981',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{thresholdRatio}% of capacity</span>
              <span>Margin: {(state.dangerThreshold - state.currentWaterLevel).toFixed(2)}m</span>
            </div>
          </div>

          {/* Trend and Danger Time Pills */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Rise Rate</span>
              <span className={`font-mono font-bold mt-0.5 block ${state.waterLevelRiseRate > 0.3 ? 'text-rose-400' : 'text-slate-200'}`}>
                +{state.waterLevelRiseRate.toFixed(2)} m/h
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Danger Proximity</span>
              <span className="font-mono font-bold text-cyan-300 mt-0.5 block truncate">
                {state.predictedDangerTime}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: RAINFALL */}
        {/* ======================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              2. Rainfall & Precipitation
            </span>
            <span className="font-mono text-cyan-300 text-[11px] font-bold">
              {state.rainfallCurrent.toFixed(1)} mm/h
            </span>
          </div>

          {/* 4-Item Precipitation Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Current Intensity</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                {state.rainfallCurrent.toFixed(1)} mm/h
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">1-Hour Acc.</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                {state.rainfallAccumulated1h.toFixed(1)} mm
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">6-Hour Acc.</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                {state.rainfallAccumulated6h.toFixed(1)} mm
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">24-Hour Total</span>
              <span className="font-mono font-bold text-cyan-300 mt-0.5 block">
                {state.rainfallAccumulated24h.toFixed(1)} mm
              </span>
            </div>
          </div>

          {/* Small SVG Bar Chart: Rainfall Over Time */}
          {renderRainfallChart(state.rainfallHistory, state.rainfallCurrent)}

          {/* Quick link to Forecast Horizons */}
          <button
            onClick={() => setActiveTab('forecast')}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/40 text-cyan-300 text-[11px] transition-colors group mt-2"
          >
            <div className="flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulated Forecast (1h / 3h / 6h / 24h)</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono group-hover:translate-x-0.5 transition-transform">
              Open Forecast →
            </span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* SECTION 3: SOIL */}
        {/* ======================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              3. Soil Conditions
            </span>
            <span className="font-mono text-emerald-400 text-[11px]">
              {state.soilSaturation}% Saturated
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Volumetric Moisture</span>
              <span className="font-mono font-bold text-white mt-0.5 block">
                {state.soilMoisture}%
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Pore Saturation</span>
              <span className={`font-mono font-bold mt-0.5 block ${state.soilSaturation > 85 ? 'text-amber-400' : 'text-slate-200'}`}>
                {state.soilSaturation}%
              </span>
            </div>
          </div>

          {/* Saturation bar indicator */}
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${state.soilSaturation}%`,
                  backgroundColor:
                    state.soilSaturation >= 90
                      ? '#f43f5e'
                      : state.soilSaturation >= 75
                      ? '#f59e0b'
                      : '#10b981',
                }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block italic">
              {state.soilSaturation > 85
                ? 'Soil saturated: Zero retention, accelerating direct surface runoff'
                : 'Pores unsaturated: Normal sub-surface infiltration active'}
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 4: WATER */}
        {/* ======================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              4. Water & Flow Balance
            </span>
            <span className="font-mono text-cyan-300 font-bold">
              {state.currentWaterLevel.toFixed(2)}m Stage
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Incoming Inflow</span>
              <span className="font-mono font-bold text-cyan-300 mt-0.5 block">
                {state.incomingFlow.toLocaleString()} m³/s
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Outgoing Discharge</span>
              <span className="font-mono font-bold text-indigo-300 mt-0.5 block">
                {state.outgoingFlow.toLocaleString()} m³/s
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Net Balance Rate:</span>
            <span className={`font-mono font-bold ${netFlow > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {netFlow > 0 ? `+${netFlow}` : netFlow} m³/s ({netFlow > 0 ? 'Accumulating' : 'Discharging'})
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Sentinel-1 SAR Inundation:</span>
            <span className="font-mono font-bold text-cyan-300">
              {((state.satelliteWaterFraction ?? 0.25) * 100).toFixed(1)}% Extent <span className="text-amber-400 text-[9px] font-normal">[Demo]</span>
            </span>
          </div>

          {/* Small SVG Line Chart: Water Level Over Time with Danger Threshold */}
          {renderWaterLevelChart(state.waterLevelHistory, state.currentWaterLevel, state.dangerThreshold)}
        </div>

        {/* ======================================================== */}
        {/* SECTION 5: TERRAIN */}
        {/* ======================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5 text-cyan-400" />
              5. Terrain & Catchment Profile
            </span>
            <span className="font-mono text-slate-400 text-[11px]">{state.elevation}m ASL</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Elevation</span>
              <span className="font-mono font-bold text-white mt-0.5 block">{state.elevation} m</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Slope</span>
              <span className="font-mono font-bold text-white mt-0.5 block">{state.slope}%</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Flow Accum.</span>
              <span className="font-mono font-bold text-cyan-300 mt-0.5 block truncate">
                {state.flowAccumulation.toLocaleString()} km²
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10.5px]">
            <span className="text-slate-500 block text-[10px]">Geomorphic Soil Stratum</span>
            <span className="text-slate-300 font-medium mt-0.5 block">
              {state.terrain?.soilType || 'Alluvial gravel and fractured bedrock'}
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 6: PREDICTION */}
        {/* ======================================================== */}
        <div className={`p-3.5 rounded-xl bg-slate-900/80 border ${riskStyles.border} space-y-2.5`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              6. Flood Risk Prediction
            </span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${riskStyles.badge}`}>
              {state.floodRisk}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-slate-400">Confidence Rating:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${state.confidence * 100}%` }}
                />
              </div>
              <span className="font-mono text-cyan-300 text-[11px]">
                {(state.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px] block">Predicted Danger Timepoint:</span>
            <span className={`font-mono text-xs font-bold block ${state.floodRisk === 'critical' ? 'text-rose-400' : 'text-slate-200'}`}>
              {state.predictedDangerTime}
            </span>
          </div>

          {selectedZone.latestPrediction?.keyDrivers && (
            <div className="space-y-1 text-[11px]">
              <span className="text-slate-500 font-semibold block text-[10px]">Key Risk Drivers:</span>
              <ul className="space-y-1 text-slate-300">
                {selectedZone.latestPrediction.keyDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* SECTION 7: UPSTREAM INFLUENCE */}
        {/* ======================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              7. Hydrological Upstream Influence
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {upstreamZones.length} Feeding / {downstreamZones.length} Receiving
            </span>
          </div>

          {/* Upstream feeding zones */}
          <div className="space-y-1.5">
            <span className="text-slate-400 text-[10.5px] flex items-center gap-1 font-semibold">
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              Upstream Source Zones (Inflowing):
            </span>

            {upstreamZones.length > 0 ? (
              <div className="space-y-1">
                {upstreamZones.map((uz) => (
                  <button
                    key={uz.id}
                    onClick={() => onSelectZone(uz.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors group"
                  >
                    <div className="text-left">
                      <span className="font-medium text-cyan-300 group-hover:underline block">{uz.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {uz.elevationMeters}m elev. · Stage: {uz.currentWaterLevelMeters.toFixed(2)}m
                      </span>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRiskStyles(uz.riskLevel).badge}`}>
                      {uz.riskLevel}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80 text-slate-500 text-[10.5px] italic">
                Alpine headwater catchment (No upstream drainage sources).
              </div>
            )}
          </div>

          {/* Downstream receiving zones */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 text-[10.5px] flex items-center gap-1 font-semibold">
              <ArrowDownRight className="w-3 h-3 text-cyan-400" />
              Downstream Outflow Destinations:
            </span>

            {downstreamZones.length > 0 ? (
              <div className="space-y-1">
                {downstreamZones.map((dz) => (
                  <button
                    key={dz.id}
                    onClick={() => onSelectZone(dz.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors group"
                  >
                    <div className="text-left">
                      <span className="font-medium text-cyan-300 group-hover:underline block">{dz.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {dz.elevationMeters}m elev. · Stage: {dz.currentWaterLevelMeters.toFixed(2)}m
                      </span>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getRiskStyles(dz.riskLevel).badge}`}>
                      {dz.riskLevel}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80 text-slate-500 text-[10.5px] italic">
                Terminal catchment outlet / Ocean estuary.
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </div>
</aside>
  );
};
