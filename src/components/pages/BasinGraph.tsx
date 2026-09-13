'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { SimState } from '@/simulation/engine';
import type { Zone, GraphEdge } from '@/types';
import { riskColor, riskBgColor, alertLevelColor } from '@/lib/utils';
import {
  Cpu,
  Radio,
  ArrowRight,
  ArrowDown,
  Layers,
  Activity,
  Droplets,
  Clock,
  Compass,
  ShieldAlert,
  CheckCircle2,
  Network,
  ChevronRight,
  Zap,
  Play,
  RotateCcw,
  Gauge,
  ExternalLink,
  TrendingUp,
  Info,
} from 'lucide-react';

interface Props {
  state: SimState;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

type ViewMode = 'risk' | 'flow' | 'transit' | 'sensors';

interface NodeLayout {
  x: number;
  y: number;
  reachKm: number;
  elevation: number;
  category: string;
  icon: string;
}

export function BasinGraph({ state, selectedZoneId, onSelectZone }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('risk');
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const [wavePacketStep, setWavePacketStep] = useState<number>(-1);
  const [isSimulatingWave, setIsSimulatingWave] = useState(false);

  // Topological coordinates: pasighat (upstream) to goalpara (downstream)
  // Perfectly symmetric bifurcation at z3 (Jorhat) into z4 (Tezpur, North Bank) & z5 (Nagaon, South Bank)
  // Reconverging at z6 (Guwahati Pandu Constriction) and discharging to z7 (Goalpara)
  const nodeLayouts = useMemo<Record<string, NodeLayout>>(() => {
    return {
      z1: { x: 390, y: 75, reachKm: 0, elevation: 155, category: 'Headwater Gorge', icon: '🏔️' },
      z2: { x: 390, y: 180, reachKm: 120, elevation: 116, category: 'Braided Valley', icon: '🏞️' },
      z3: { x: 390, y: 285, reachKm: 250, elevation: 98, category: 'River Bifurcation', icon: '🔀' },
      z4: { x: 230, y: 405, reachKm: 370, elevation: 72, category: 'North Bank Corridor', icon: '🌊' },
      z5: { x: 550, y: 405, reachKm: 370, elevation: 58, category: 'South Bank Kopili Basin', icon: '🌾' },
      z6: { x: 390, y: 525, reachKm: 490, elevation: 49, category: 'Pandu Constriction', icon: '🏙️' },
      z7: { x: 390, y: 645, reachKm: 620, elevation: 35, category: 'Basin Outflow', icon: '⚓' },
    };
  }, []);

  const svgWidth = 780;
  const svgHeight = 720;

  // Wave propagation simulation across the network
  useEffect(() => {
    if (!isSimulatingWave) return;
    const interval = setInterval(() => {
      setWavePacketStep((prev) => {
        if (prev >= 6) {
          setIsSimulatingWave(false);
          return -1;
        }
        return prev + 1;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [isSimulatingWave]);

  const handleTriggerWave = () => {
    setWavePacketStep(0);
    setIsSimulatingWave(true);
  };

  // Connected edges for the selected node
  const connectedEdgeKeys = useMemo(() => {
    if (!selectedZoneId) return new Set<string>();
    const keys = new Set<string>();
    for (const e of state.edges) {
      if (e.from === selectedZoneId || e.to === selectedZoneId) {
        keys.add(`${e.from}->${e.to}`);
      }
    }
    return keys;
  }, [selectedZoneId, state.edges]);

  // Total basin discharge & metrics
  const totalBasinDischarge = useMemo(() => {
    const outflowEdge = state.edges.find((e) => e.to === 'z7');
    return outflowEdge ? outflowEdge.predictedFlow : 12000;
  }, [state.edges]);

  const totalBasinTransitTime = useMemo(() => {
    // z1->z2 + z2->z3 + avg(z3->z4->z6, z3->z5->z6) + z6->z7
    return 14.5;
  }, []);

  const selectedZone = useMemo(() => {
    return selectedZoneId ? state.zones.find((z) => z.id === selectedZoneId) || null : null;
  }, [selectedZoneId, state.zones]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      {/* Left / Center: Interactive SVG Topological Graph */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Graph Header & Mode Switcher Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Distributed Hydrological Graph</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                Brahmaputra Valley (620 km Reach)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Decentralized mesh topology. Each village computing node processes local sensor arrays, ingests upstream predicted waves, recalibrates, and propagates predictions downstream.
            </p>
          </div>

          {/* Mode Switcher & Wave Simulation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-1 text-xs">
              <button
                onClick={() => setViewMode('risk')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'risk'
                    ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Color-code by Flood Risk Score"
              >
                <span>🔥</span>
                <span>Risk</span>
              </button>
              <button
                onClick={() => setViewMode('flow')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'flow'
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Scale conduits by Hydraulic Discharge (m³/s)"
              >
                <span>💧</span>
                <span>Discharge</span>
              </button>
              <button
                onClick={() => setViewMode('transit')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'transit'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Show Wave Propagation Time (hours)"
              >
                <span>⏱️</span>
                <span>Transit</span>
              </button>
              <button
                onClick={() => setViewMode('sensors')}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'sensors'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Highlight IoT Sensor Telemetry & Edge Status"
              >
                <span>📡</span>
                <span>Sensors</span>
              </button>
            </div>

            {/* Wave Tracer Button */}
            <button
              onClick={handleTriggerWave}
              disabled={isSimulatingWave}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSimulatingWave
                  ? 'bg-cyan-900/60 border border-cyan-500/50 text-cyan-300 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200'
              }`}
              title="Animate a hydrological wave propagating from Pasighat to Goalpara"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isSimulatingWave ? `Propagating Wave (T+${wavePacketStep * 2.5}h)` : 'Trace Flood Wave'}</span>
            </button>

            {selectedZoneId && (
              <button
                onClick={() => onSelectZone('')}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Deselect node"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* SVG Visualization Canvas */}
        <div className="p-4 flex justify-center">
          <div className="relative w-full max-w-4xl bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-4 overflow-hidden">
            {/* Background Cyber Grid & Altitude Indicators */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none overflow-visible"
            >
              <defs>
                {/* Flow gradient definitions */}
                <linearGradient id="flow-gradient-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
                </linearGradient>

                <linearGradient id="flow-gradient-high" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.85" />
                </linearGradient>

                <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="glow-danger" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Left Axis: Physical Elevation Profile (155m ASL -> 35m ASL) */}
              <g className="text-slate-500 font-mono text-[9px]">
                <line x1="60" y1="50" x2="60" y2="670" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                <text x="60" y="40" textAnchor="middle" fill="#0ea5e9" fontWeight="bold" fontSize="10">ELEVATION</text>
                {[
                  { y: 75, alt: '155m', label: 'Arunachal Foothills' },
                  { y: 180, alt: '116m', label: 'Upper Valley' },
                  { y: 285, alt: '98m', label: 'Mid Confluence' },
                  { y: 405, alt: '72m / 58m', label: 'Braided Floodplain' },
                  { y: 525, alt: '49m', label: 'Pandu Constriction' },
                  { y: 645, alt: '35m', label: 'Lower Outflow' },
                ].map((mark, i) => (
                  <g key={i}>
                    <line x1="52" y1={mark.y} x2="68" y2={mark.y} stroke="#475569" strokeWidth="1.5" />
                    <text x="46" y={mark.y + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontWeight="bold">
                      {mark.alt}
                    </text>
                    <line x1="72" y1={mark.y} x2="720" y2={mark.y} stroke="#1e293b" strokeDasharray="2 4" strokeWidth="0.8" opacity="0.6" />
                  </g>
                ))}
              </g>

              {/* Right Axis: River Reach Longitudinal Distance (0 km -> 620 km) */}
              <g className="text-slate-500 font-mono text-[9px]">
                <line x1="720" y1="50" x2="720" y2="670" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                <text x="720" y="40" textAnchor="middle" fill="#0ea5e9" fontWeight="bold" fontSize="10">RIVER REACH</text>
                {[
                  { y: 75, dist: '0 km', lag: 'T+0.0h' },
                  { y: 180, dist: '120 km', lag: 'T+2.0h' },
                  { y: 285, dist: '250 km', lag: 'T+4.5h' },
                  { y: 405, dist: '370 km', lag: 'T+7.5h' },
                  { y: 525, dist: '490 km', lag: 'T+10.5h' },
                  { y: 645, dist: '620 km', lag: 'T+14.5h' },
                ].map((mark, i) => (
                  <g key={i}>
                    <line x1="712" y1={mark.y} x2="728" y2={mark.y} stroke="#475569" strokeWidth="1.5" />
                    <text x="734" y={mark.y + 1} textAnchor="start" fill="#94a3b8" fontSize="9" fontWeight="bold">
                      {mark.dist}
                    </text>
                    <text x="734" y={mark.y + 11} textAnchor="start" fill="#64748b" fontSize="8">
                      {mark.lag}
                    </text>
                  </g>
                ))}
              </g>

              {/* Curved Hydro Conduits (Bezier Splines) */}
              {state.edges.map((edge, index) => {
                const from = nodeLayouts[edge.from];
                const to = nodeLayouts[edge.to];
                if (!from || !to) return null;

                const edgeKey = `${edge.from}->${edge.to}`;
                const isSelectedEdge = connectedEdgeKeys.has(edgeKey);
                const isDimmed = selectedZoneId && !isSelectedEdge;

                // Color calculation based on viewMode
                let conduitColor = '#0284c7';
                if (viewMode === 'risk') {
                  const fromZone = state.zones.find((z) => z.id === edge.from);
                  const toZone = state.zones.find((z) => z.id === edge.to);
                  const avgRisk = ((fromZone?.state.riskScore || 30) + (toZone?.state.riskScore || 30)) / 2;
                  conduitColor = riskColor(avgRisk);
                } else if (viewMode === 'flow') {
                  conduitColor = edge.predictedFlow > 8500 ? '#dc2626' : edge.predictedFlow > 5500 ? '#ea580c' : '#0ea5e9';
                } else if (viewMode === 'transit') {
                  conduitColor = edge.travelTime >= 3.5 ? '#818cf8' : edge.travelTime >= 2.5 ? '#38bdf8' : '#34d399';
                } else {
                  conduitColor = '#06b6d4';
                }

                // Width scaling according to discharge
                const baseWidth = viewMode === 'flow'
                  ? Math.max(3, Math.min(10, edge.predictedFlow / 1400))
                  : 3.5;

                // Calculate smooth Bezier path geometry
                let pathD = '';
                const startY = from.y + 32;
                const endY = to.y - 32;

                if (from.x === to.x) {
                  // Direct vertical flow (e.g. z1->z2, z2->z3, z6->z7)
                  pathD = `M ${from.x} ${startY} L ${to.x} ${endY}`;
                } else {
                  // Curved bifurcation or convergence (z3->z4, z3->z5, z4->z6, z5->z6)
                  const deltaY = endY - startY;
                  const cp1Y = startY + deltaY * 0.55;
                  const cp2Y = startY + deltaY * 0.45;
                  pathD = `M ${from.x} ${startY} C ${from.x} ${cp1Y}, ${to.x} ${cp2Y}, ${to.x} ${endY}`;
                }

                // Midpoint for interactive telemetry pill
                const midX = (from.x + to.x) / 2;
                const midY = (startY + endY) / 2;

                // Check if simulated wave packet is passing this edge
                const isWaveActive = (
                  (wavePacketStep === 0 && edge.from === 'z1') ||
                  (wavePacketStep === 1 && edge.from === 'z2') ||
                  (wavePacketStep === 2 && edge.from === 'z3') ||
                  (wavePacketStep === 3 && (edge.from === 'z4' || edge.from === 'z5')) ||
                  (wavePacketStep === 4 && edge.from === 'z6')
                );

                return (
                  <g
                    key={edgeKey}
                    opacity={isDimmed ? 0.25 : 1}
                    className="transition-opacity duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredEdgeKey(edgeKey)}
                    onMouseLeave={() => setHoveredEdgeKey(null)}
                  >
                    {/* Background ambient water ribbon halo */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={conduitColor}
                      strokeWidth={baseWidth + 8}
                      opacity={isSelectedEdge ? 0.35 : 0.12}
                    />

                    {/* Main fluid conduit */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={conduitColor}
                      strokeWidth={baseWidth}
                      opacity={isSelectedEdge ? 1 : 0.85}
                    />

                    {/* Animated directional dashed fluid stream */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={Math.max(1.5, baseWidth * 0.4)}
                      opacity={0.7}
                      className="conduit-flow-animated"
                    />

                    {/* Wave Packet Traveling Ripple */}
                    {isWaveActive && (
                      <circle cx={midX} cy={midY} r="9" fill="#38bdf8" filter="url(#glow-cyan)">
                        <animate attributeName="r" values="6;14;6" dur="0.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.4;1" dur="0.8s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Downstream arrowhead */}
                    <polygon
                      points={`${to.x - 5},${endY - 6} ${to.x + 5},${endY - 6} ${to.x},${endY + 2}`}
                      fill={conduitColor}
                    />

                    {/* Conduit Telemetry Pill */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-48"
                        y="-12"
                        width="96"
                        height="24"
                        rx="12"
                        fill="#0f172a"
                        stroke={isSelectedEdge ? '#38bdf8' : conduitColor}
                        strokeWidth={isSelectedEdge ? 2 : 1}
                        className="transition-all"
                      />
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {viewMode === 'transit'
                          ? `⏱ ${edge.travelTime}h`
                          : `${edge.predictedFlow.toLocaleString()} m³/s`}
                      </text>
                      <text
                        x="0"
                        y="9"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="7"
                        fontFamily="monospace"
                      >
                        {viewMode === 'transit'
                          ? `${edge.confidence}% conf`
                          : `lag: ${edge.travelTime}h`}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Station Nodes (7 Decentralized Computational Centers) */}
              {state.zones.map((zone) => {
                const layout = nodeLayouts[zone.id];
                if (!layout) return null;

                const risk = zone.state.riskScore;
                const color = riskColor(risk);
                const isSelected = selectedZoneId === zone.id;
                const isHovered = hoveredZoneId === zone.id;
                const isAlert = zone.state.alertLevel !== 'NORMAL';
                const isDimmed = selectedZoneId && !isSelected && !state.edges.some((e) =>
                  (e.from === selectedZoneId && e.to === zone.id) ||
                  (e.to === selectedZoneId && e.from === zone.id)
                );

                // River Level gauge ratio vs estimated danger mark (~5.5m)
                const stageRatio = Math.min(1, zone.state.riverLevel / 5.5);

                return (
                  <g
                    key={zone.id}
                    transform={`translate(${layout.x}, ${layout.y})`}
                    onClick={() => onSelectZone(zone.id)}
                    onMouseEnter={() => setHoveredZoneId(zone.id)}
                    onMouseLeave={() => setHoveredZoneId(null)}
                    style={{ cursor: 'pointer' }}
                    opacity={isDimmed ? 0.35 : 1}
                    className="transition-all duration-300"
                  >
                    {/* Pulsing hazard warning ring for elevated risk */}
                    {isAlert && (
                      <circle cx="0" cy="0" r="38" fill="none" stroke={color} strokeWidth="2" opacity="0.6">
                        <animate attributeName="r" values="32;44;32" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Selected Node Glow Aura */}
                    {isSelected && (
                      <circle cx="0" cy="0" r="36" fill="none" stroke="#38bdf8" strokeWidth="2.5" className="node-selected-glow" />
                    )}

                    {/* Station Background Card Disc */}
                    <circle
                      cx="0"
                      cy="0"
                      r="30"
                      fill="#0f172a"
                      stroke={isSelected ? '#38bdf8' : isHovered ? '#67e8f9' : color}
                      strokeWidth={isSelected ? 3 : 2}
                      filter={isAlert ? 'url(#glow-danger)' : undefined}
                    />

                    {/* Inner color tint */}
                    <circle cx="0" cy="0" r="26" fill={color} opacity={isSelected ? 0.3 : 0.18} />

                    {/* Node Metric display based on viewMode */}
                    {viewMode === 'sensors' ? (
                      <>
                        <text x="0" y="-5" textAnchor="middle" fill="#34d399" fontSize="13" fontWeight="bold" fontFamily="monospace">
                          {zone.sensors.length}
                        </text>
                        <text x="0" y="8" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                          SENSORS
                        </text>
                      </>
                    ) : viewMode === 'transit' ? (
                      <>
                        <text x="0" y="-5" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace">
                          {zone.state.confidence}%
                        </text>
                        <text x="0" y="8" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                          CALIB
                        </text>
                      </>
                    ) : viewMode === 'flow' ? (
                      <>
                        <text x="0" y="-5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace">
                          {zone.state.riverLevel.toFixed(1)}m
                        </text>
                        <text x="0" y="8" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                          STAGE
                        </text>
                      </>
                    ) : (
                      <>
                        <text x="0" y="-4" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold" fontFamily="monospace">
                          {risk}
                        </text>
                        <text x="0" y="9" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                          {zone.state.alertLevel}
                        </text>
                      </>
                    )}

                    {/* Mini River Stage Meter Bar at bottom of disc */}
                    <rect x="-18" y="16" width="36" height="3.5" rx="1.5" fill="#1e293b" />
                    <rect
                      x="-18"
                      y="16"
                      width={36 * stageRatio}
                      height="3.5"
                      rx="1.5"
                      fill={stageRatio > 0.8 ? '#dc2626' : stageRatio > 0.6 ? '#f59e0b' : '#38bdf8'}
                    />

                    {/* Station Name & Category Label */}
                    <g transform="translate(0, 42)">
                      <rect
                        x="-70"
                        y="-4"
                        width="140"
                        height="26"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.92)"
                        stroke={isSelected ? '#38bdf8' : '#334155'}
                        strokeWidth="1"
                      />
                      <text x="0" y="7" textAnchor="middle" fill="#f1f5f9" fontSize="10" fontWeight="bold">
                        {layout.icon} {zone.name}
                      </text>
                      <text x="0" y="17" textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600" fontFamily="monospace">
                        {layout.category} · {layout.elevation}m ASL
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Zone Bottom Summary Bar */}
        {selectedZone && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{nodeLayouts[selectedZone.id]?.icon || '📍'}</span>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{selectedZone.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-bold" style={{ backgroundColor: riskBgColor(selectedZone.state.riskScore, 0.2), color: riskColor(selectedZone.state.riskScore) }}>
                        RISK {selectedZone.state.riskScore}/100
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        selectedZone.state.alertLevel === 'DANGER' ? 'bg-red-600 text-white' :
                        selectedZone.state.alertLevel === 'WARNING' ? 'bg-orange-600 text-white' :
                        selectedZone.state.alertLevel === 'WATCH' ? 'bg-yellow-500 text-black' :
                        'bg-emerald-600 text-white'
                      }`}>
                        {selectedZone.state.alertLevel}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {nodeLayouts[selectedZone.id]?.category} · {nodeLayouts[selectedZone.id]?.elevation}m ASL · Basin Reach {nodeLayouts[selectedZone.id]?.reachKm} km
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectZone('')}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Close Inspection
                </button>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">River Stage</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">{selectedZone.state.riverLevel.toFixed(2)} m</div>
                  <div className="text-[9px] text-slate-500">Rise: {selectedZone.state.riverLevelRiseRate >= 0 ? '+' : ''}{selectedZone.state.riverLevelRiseRate.toFixed(3)} m/t</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">24h Rainfall</div>
                  <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">{selectedZone.state.rainfall24h.toFixed(1)} mm</div>
                  <div className="text-[9px] text-slate-500">Rate: {selectedZone.state.rainfallIntensity.toFixed(1)} mm/h</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Soil Saturation</div>
                  <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">{selectedZone.state.soilMoisture.toFixed(0)}%</div>
                  <div className="text-[9px] text-slate-500">SAR Extent: {selectedZone.state.sarFloodExtent.toFixed(0)}%</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Upstream Inflow</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">{selectedZone.state.upstreamInflow.toLocaleString()} m³/s</div>
                  <div className="text-[9px] text-slate-500">Arrival: ~{selectedZone.state.estimatedArrivalTime}h</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Downstream Outflow</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">{selectedZone.state.predictedOutgoingFlow.toLocaleString()} m³/s</div>
                  <div className="text-[9px] text-slate-500">Muskingum Routed</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Time to Danger</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${selectedZone.state.timeToDanger < 99 ? 'text-red-400' : 'text-slate-400'}`}>
                    {selectedZone.state.timeToDanger < 99 ? `${selectedZone.state.timeToDanger}h` : 'Safe'}
                  </div>
                  <div className="text-[9px] text-slate-500">Confidence: {selectedZone.state.confidence}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar: Decentralized Computational Center & Basin Intelligence */}
      <div className="w-84 xl:w-96 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 h-full overflow-hidden">
        {selectedZone ? (
          <SelectedZoneInspector
            zone={selectedZone}
            edges={state.edges}
            zones={state.zones}
            onSelectZone={onSelectZone}
          />
        ) : (
          <BasinNetworkOverview
            state={state}
            totalDischarge={totalBasinDischarge}
            totalTransitTime={totalBasinTransitTime}
            onSelectZone={onSelectZone}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Subcomponent: Selected Zone Computational Center & Edge AI Inspector
// ---------------------------------------------------------------------------------
function SelectedZoneInspector({
  zone,
  edges,
  zones,
  onSelectZone,
}: {
  zone: Zone;
  edges: GraphEdge[];
  zones: Zone[];
  onSelectZone: (id: string) => void;
}) {
  const incomingEdges = edges.filter((e) => e.to === zone.id);
  const outgoingEdges = edges.filter((e) => e.from === zone.id);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Station Header */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
              Local Computational Center
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Node Online
          </span>
        </div>
        <h3 className="text-base font-bold text-white mt-1">{zone.name}</h3>
        <p className="text-xs text-slate-400">
          Decentralized processing node ID: <span className="font-mono text-cyan-300">{zone.id}</span> ({zone.type.toUpperCase()})
        </p>
      </div>

      {/* Upstream / Downstream Traversal Navigator */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hydrological Graph Adjacency</div>

        {/* Incoming Feeders */}
        <div>
          <span className="text-[10px] text-slate-400">Upstream Feeders:</span>
          {incomingEdges.length === 0 ? (
            <div className="text-xs text-slate-400 italic">Primary Headwater (No upstream feeders)</div>
          ) : (
            <div className="space-y-1 mt-1">
              {incomingEdges.map((e) => {
                const parent = zones.find((z) => z.id === e.from);
                return (
                  <button
                    key={e.from}
                    onClick={() => onSelectZone(e.from)}
                    className="w-full flex items-center justify-between p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-200">
                      <span className="text-cyan-400">↑</span>
                      <span className="font-semibold">{parent?.name || e.from}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {e.predictedFlow.toLocaleString()} m³/s (⏱ {e.travelTime}h)
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Outgoing Paths */}
        <div className="pt-1">
          <span className="text-[10px] text-slate-400">Downstream Discharge:</span>
          {outgoingEdges.length === 0 ? (
            <div className="text-xs text-slate-400 italic">Basin Terminal Sink (Outflow to Bay of Bengal)</div>
          ) : (
            <div className="space-y-1 mt-1">
              {outgoingEdges.map((e) => {
                const child = zones.find((z) => z.id === e.to);
                return (
                  <button
                    key={e.to}
                    onClick={() => onSelectZone(e.to)}
                    className="w-full flex items-center justify-between p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-200">
                      <span className="text-emerald-400">↓</span>
                      <span className="font-semibold">{child?.name || e.to}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {e.predictedFlow.toLocaleString()} m³/s (⏱ {e.travelTime}h)
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 9-Stage Local Processing Pipeline Tracker */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>9-Stage Decentralized Pipeline</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">100% Active</span>
        </div>

        <div className="space-y-1.5">
          {[
            { step: '1. Sensor Ingestion', desc: `${zone.sensors.length} real-time IoT channels polling at 1Hz` },
            { step: '2. Kalman Anomaly Filter', desc: 'Outlier rejection & measurement noise variance reduction' },
            { step: '3. Hydraulic State Estimation', desc: `Cross-section stage (${zone.state.riverLevel.toFixed(1)}m) & rise velocity` },
            { step: '4. Feature Vector Assembly', desc: '16 hydro-geospatial dimensions compiled for ML engine' },
            { step: '5. XGBoost Inference Engine', desc: `Risk score: ${zone.state.riskScore}/100 · Alert: ${zone.state.alertLevel}` },
            { step: '6. Upstream Inflow Recalibration', desc: `Ingested ${zone.state.upstreamInflow.toLocaleString()} m³/s upstream wave` },
            { step: '7. Muskingum-Cunge Wave Routing', desc: `Predicted downstream outflow: ${zone.state.predictedOutgoingFlow.toLocaleString()} m³/s` },
            { step: '8. Telemetry Broadcast Envelope', desc: 'Signed JSON hydro-packet propagated to mesh peers' },
            { step: '9. CAP Warning Protocol', desc: zone.state.alertLevel !== 'NORMAL' ? 'CAP alert broadcast to NDMA & civil defense' : 'Standby monitoring — no active sirens' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-1.5 rounded-md bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-200 leading-none">{item.step}</div>
                <div className="text-[9px] text-slate-400 mt-0.5 truncate">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hydraulic Mass Balance Budget */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Hydraulic Mass Conservation
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Upstream Inflow (Q_in):</span>
            <span className="font-mono font-bold text-white">{zone.state.upstreamInflow.toLocaleString()} m³/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Local Catchment Runoff:</span>
            <span className="font-mono font-bold text-cyan-400">+{(zone.state.rainfallIntensity * 32).toFixed(0)} m³/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Downstream Outflow (Q_out):</span>
            <span className="font-mono font-bold text-emerald-400">-{zone.state.predictedOutgoingFlow.toLocaleString()} m³/s</span>
          </div>
          <div className="pt-1.5 border-t border-slate-700 flex justify-between font-bold">
            <span className="text-slate-300">Net Basin Storage Delta:</span>
            <span className="font-mono text-amber-400">
              {(zone.state.upstreamInflow + zone.state.rainfallIntensity * 32 - zone.state.predictedOutgoingFlow).toFixed(0)} m³/s
            </span>
          </div>
        </div>
      </div>

      {/* Simulated IoT Sensor Array */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Telemetry Sensors ({zone.sensors.length})</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">100% Healthy</span>
        </div>

        <div className="space-y-1.5">
          {zone.sensors.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs"
            >
              <div>
                <div className="text-slate-300 font-semibold">{s.label}</div>
                <div className="text-[9px] text-slate-500 font-mono">ID: {s.id}</div>
              </div>
              <div className="text-right">
                <span className={`font-mono font-bold ${
                  s.status === 'critical' ? 'text-red-400' :
                  s.status === 'warning' ? 'text-amber-400' :
                  'text-white'
                }`}>
                  {s.value} {s.unit}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">
                  {s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Subcomponent: Basin-Wide Overview (When no node is selected)
// ---------------------------------------------------------------------------------
function BasinNetworkOverview({
  state,
  totalDischarge,
  totalTransitTime,
  onSelectZone,
}: {
  state: SimState;
  totalDischarge: number;
  totalTransitTime: number;
  onSelectZone: (id: string) => void;
}) {
  const highRiskZones = state.zones.filter((z) => z.state.riskScore >= 50);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Basin Network Title */}
      <div className="pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
            Topological Intelligence
          </span>
        </div>
        <h3 className="text-base font-bold text-white mt-1">Brahmaputra Hydro-Mesh</h3>
        <p className="text-xs text-slate-400">
          Decentralized hydrological graph spanning 7 administrative centers from Pasighat (Arunachal) to Goalpara (Assam).
        </p>
      </div>

      {/* Network Key Performance Indicators */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Cumulative Outflow</div>
          <div className="text-base font-bold font-mono text-cyan-400 mt-1">
            {totalDischarge.toLocaleString()} m³/s
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">Discharge at Goalpara</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Total River Reach</div>
          <div className="text-base font-bold font-mono text-white mt-1">620 km</div>
          <div className="text-[9px] text-slate-500 mt-0.5">Pasighat → Goalpara</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Wave Travel Lag</div>
          <div className="text-base font-bold font-mono text-amber-400 mt-1">
            ~{totalTransitTime} hours
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">End-to-end wave speed</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="text-[10px] text-slate-400 font-semibold uppercase">Sensor Network</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1">49 Telemetry IoT</div>
          <div className="text-[9px] text-slate-500 mt-0.5">7 per station node</div>
        </div>
      </div>

      {/* Critical Constriction Alert */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-white">Hydraulic Bottleneck: Guwahati (Pandu Gorge)</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The Brahmaputra narrows from a 10 km braided floodplain down to 1.2 km at the Saraighat rock constriction. Both North Bank (Tezpur) and South Bank (Nagaon) tributaries converge here, producing rapid surge amplification.
        </p>
      </div>

      {/* Interactive Zone Directory */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Station Directory (Click to Inspect)</span>
          <span className="text-[10px] font-mono text-cyan-400">{state.zones.length} Nodes</span>
        </div>

        <div className="space-y-1.5">
          {state.zones.map((zone) => {
            const risk = zone.state.riskScore;
            return (
              <button
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-800 hover:border-slate-600 transition-all text-left cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {zone.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Stage: {zone.state.riverLevel.toFixed(1)}m · Flow: {zone.state.predictedOutgoingFlow.toLocaleString()} m³/s
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{ backgroundColor: riskBgColor(risk, 0.25), color: riskColor(risk) }}
                  >
                    {risk}/100
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Decentralized Routing Principle */}
      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Decentralized Hydro Routing</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Instead of running a monolithic model from a single central server, each village node runs an independent computational agent. Upstream water arrival times are calculated using the Muskingum-Cunge equation:
        </p>
        <div className="p-2 rounded bg-slate-950 font-mono text-[10px] text-cyan-300 border border-slate-800 text-center">
          O(t+Δt) = C₁·I(t+Δt) + C₂·I(t) + C₃·O(t)
        </div>
      </div>
    </div>
  );
}
