'use client';

import React from 'react';
import { Sensor, TimeSeriesPoint } from '@/types/flood';
import {
  Waves,
  CloudRain,
  Layers,
  Activity,
  X,
  MapPin,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface SensorPopupProps {
  sensor: Sensor;
  zoneName?: string;
  zoneCode?: string;
  onClose: () => void;
  onSelectParentZone?: (zoneId: string) => void;
}

export const SensorPopup: React.FC<SensorPopupProps> = ({
  sensor,
  zoneName,
  zoneCode,
  onClose,
  onSelectParentZone,
}) => {
  const getTypeMeta = () => {
    switch (sensor.type) {
      case 'water_level':
        return {
          title: 'River Stage Radar',
          icon: <Waves className="w-4 h-4 text-cyan-400" />,
          color: '#38bdf8',
          accent: 'text-cyan-300',
          bg: 'bg-cyan-950/70 border-cyan-500/40',
          desc: 'High-frequency ultrasonic/radar stage measurement on active channel.',
        };
      case 'rainfall':
        return {
          title: 'Precipitation AWS',
          icon: <CloudRain className="w-4 h-4 text-sky-400" />,
          color: '#0284c7',
          accent: 'text-sky-300',
          bg: 'bg-sky-950/70 border-sky-500/40',
          desc: 'Tipping-bucket automated gauge monitoring precipitation intensity.',
        };
      case 'soil_moisture':
      default:
        return {
          title: 'Soil Moisture TDR',
          icon: <Layers className="w-4 h-4 text-emerald-400" />,
          color: '#10b981',
          accent: 'text-emerald-300',
          bg: 'bg-emerald-950/70 border-emerald-500/40',
          desc: 'Time-domain reflectometry probe measuring pore water saturation.',
        };
    }
  };

  const meta = getTypeMeta();

  // Render mini history sparkline
  const renderSparkline = (history: TimeSeriesPoint[]) => {
    if (!history || history.length < 2) return null;

    const width = 240;
    const height = 45;
    const padding = { top: 6, right: 6, bottom: 6, left: 6 };

    const values = history.map((h) => h.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = maxVal - minVal || 1;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = history.map((pt, idx) => {
      const x = padding.left + (idx / (history.length - 1)) * chartW;
      const y = padding.top + chartH - ((pt.value - minVal) / range) * chartH;
      return { x, y };
    });

    const pathD = points.reduce(
      (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    );

    const latestPt = points[points.length - 1];

    return (
      <div className="mt-2 pt-2 border-t border-slate-800">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Live Telemetry Trend</span>
          <span className="font-mono text-slate-300">
            Min: {minVal} · Max: {maxVal}
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 overflow-visible">
          <path
            d={pathD}
            fill="none"
            stroke={meta.color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx={latestPt.x}
            cy={latestPt.y}
            r="3"
            fill={meta.color}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    );
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="absolute top-16 right-4 z-30 w-80 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 p-4 shadow-2xl text-slate-200 select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl border ${meta.bg}`}>{meta.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                {sensor.sensorId}
              </span>
              <span
                className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                  sensor.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {sensor.status}
              </span>
            </div>
            <h3 className="text-xs font-bold text-white truncate mt-0.5">{sensor.name}</h3>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Reading Display */}
      <div className="py-3 flex items-baseline justify-between">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
            Instantaneous Reading
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono text-2xl font-black text-white tracking-tight">
              {sensor.value.toFixed(sensor.type === 'rainfall' ? 1 : 2)}
            </span>
            <span className="font-mono text-sm font-semibold text-slate-400">{sensor.unit}</span>
          </div>
        </div>

        {/* Pulsing LIVE tag */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-[10px] font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>LIVE STREAM</span>
        </div>
      </div>

      {/* Details & Location */}
      <div className="space-y-2 text-[11px] pt-1 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            Last Update:
          </span>
          <span className="font-mono text-slate-300">{formatTimestamp(sensor.timestamp)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" />
            Catchment Zone:
          </span>
          {onSelectParentZone ? (
            <button
              onClick={() => onSelectParentZone(sensor.zoneId)}
              className="font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group"
              title="Inspect zone details"
            >
              <span className="truncate max-w-[130px]">{zoneName || zoneCode || sensor.zoneId}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
            </button>
          ) : (
            <span className="text-slate-300 font-medium truncate max-w-[140px]">
              {zoneName || zoneCode || sensor.zoneId}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-500" />
            Coordinates:
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            [{sensor.coordinates[0].toFixed(3)}°E, {sensor.coordinates[1].toFixed(3)}°N]
          </span>
        </div>
      </div>

      {/* Mini Trend Sparkline */}
      {renderSparkline(sensor.history)}

      {/* Description tag */}
      <p className="mt-2 text-[10px] text-slate-400/90 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
        {meta.desc}
      </p>
    </div>
  );
};
