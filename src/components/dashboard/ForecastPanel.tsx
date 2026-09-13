'use client';

import React from 'react';
import {
  BasinRainfallForecast,
  RainfallScenario,
  RainfallIntensity,
  Zone,
  ZoneRainfallForecast,
} from '@/types/flood';
import {
  CloudRain,
  CloudLightning,
  SunMedium,
  TrendingUp,
  AlertTriangle,
  Flame,
  Gauge,
  Info,
  Layers,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface ForecastPanelProps {
  scenario: RainfallScenario;
  onSelectScenario: (scenario: RainfallScenario) => void;
  basinForecast: BasinRainfallForecast;
  selectedZone: Zone | null;
  onClearZoneSelection?: () => void;
  onSelectZone?: (zoneId: string) => void;
}

export const ForecastPanel: React.FC<ForecastPanelProps> = ({
  scenario,
  onSelectScenario,
  basinForecast,
  selectedZone,
  onClearZoneSelection,
  onSelectZone,
}) => {
  // Determine if viewing a specific zone's forecast or basin aggregate
  const zoneForecast: ZoneRainfallForecast | undefined = selectedZone
    ? basinForecast.zones[selectedZone.id]
    : undefined;

  // Aggregate metrics if no single zone is selected
  const displayAccumulated = zoneForecast
    ? zoneForecast.accumulatedRainfall
    : basinForecast.basinAverageAccumulated24h;

  const displayNext1h = zoneForecast
    ? zoneForecast.next1h
    : parseFloat(
        (
          Object.values(basinForecast.zones).reduce((acc, z) => acc + z.next1h, 0) /
          Math.max(1, Object.keys(basinForecast.zones).length)
        ).toFixed(1)
      );

  const displayNext3h = zoneForecast
    ? zoneForecast.next3h
    : parseFloat(
        (
          Object.values(basinForecast.zones).reduce((acc, z) => acc + z.next3h, 0) /
          Math.max(1, Object.keys(basinForecast.zones).length)
        ).toFixed(1)
      );

  const displayNext6h = zoneForecast
    ? zoneForecast.next6h
    : parseFloat(
        (
          Object.values(basinForecast.zones).reduce((acc, z) => acc + z.next6h, 0) /
          Math.max(1, Object.keys(basinForecast.zones).length)
        ).toFixed(1)
      );

  const displayNext24h = zoneForecast
    ? zoneForecast.next24h
    : basinForecast.basinAverageAccumulated24h;

  const displayIntensity: RainfallIntensity = zoneForecast
    ? zoneForecast.rainfallIntensity
    : scenario === 'extreme'
    ? 'extreme'
    : scenario === 'heavy'
    ? 'heavy'
    : 'moderate';

  const displayPeak = zoneForecast
    ? zoneForecast.peakIntensityMmPerHour
    : Math.max(
        ...Object.values(basinForecast.zones).map((z) => z.peakIntensityMmPerHour)
      );

  const displayBaseline = zoneForecast
    ? zoneForecast.baselineRainfall24h
    : 24;

  const displayAnomalyMm = zoneForecast
    ? zoneForecast.rainfallAnomalyMm
    : parseFloat((displayAccumulated - displayBaseline).toFixed(1));

  const displayAnomalyPercent = zoneForecast
    ? zoneForecast.rainfallAnomalyPercentage
    : basinForecast.basinAverageAnomalyPercentage;

  const hourlyProfile = zoneForecast
    ? zoneForecast.hourlyRainfallMm
    : Array.from({ length: 24 }, (_, i) => {
        const sum = Object.values(basinForecast.zones).reduce(
          (acc, z) => acc + (z.hourlyRainfallMm[i] || 0),
          0
        );
        return parseFloat((sum / Object.keys(basinForecast.zones).length).toFixed(1));
      });

  const getIntensityBadge = (intensity: RainfallIntensity) => {
    switch (intensity) {
      case 'extreme':
        return {
          label: 'EXTREME DELUGE',
          color: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
          indicator: 'bg-rose-500 animate-ping',
        };
      case 'very_heavy':
        return {
          label: 'VERY HEAVY',
          color: 'bg-rose-900/50 text-rose-300 border-rose-600/40',
          indicator: 'bg-rose-400',
        };
      case 'heavy':
        return {
          label: 'HEAVY RAINFALL',
          color: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
          indicator: 'bg-amber-400',
        };
      case 'moderate':
        return {
          label: 'MODERATE',
          color: 'bg-sky-950/70 text-sky-300 border-sky-500/40',
          indicator: 'bg-sky-400',
        };
      case 'light':
      default:
        return {
          label: 'LIGHT SHOWERS',
          color: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
          indicator: 'bg-emerald-400',
        };
    }
  };

  const intensityStyle = getIntensityBadge(displayIntensity);

  return (
    <div className="space-y-4 text-slate-200">
      {/* 1. Scenario Selector Bar */}
      <div className="space-y-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            Rainfall Forecast Scenario
          </label>
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
            {scenario.toUpperCase()} SCENARIO
          </span>
        </div>

        {/* 3 Scenario Options */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onSelectScenario('normal')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-left ${
              scenario === 'normal'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-950'
                : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <SunMedium className="w-3.5 h-3.5 text-emerald-400 mb-1" />
            <span className="text-[11px] font-bold leading-tight">Normal</span>
            <span className="text-[9.5px] opacity-75 font-mono">~25 mm</span>
          </button>

          <button
            onClick={() => onSelectScenario('heavy')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-left ${
              scenario === 'heavy'
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-200 shadow-sm shadow-amber-950'
                : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-amber-400 mb-1" />
            <span className="text-[11px] font-bold leading-tight">Heavy Rain</span>
            <span className="text-[9.5px] opacity-75 font-mono">+115% Anom</span>
          </button>

          <button
            onClick={() => onSelectScenario('extreme')}
            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-left ${
              scenario === 'extreme'
                ? 'bg-rose-950/70 border-rose-500/70 text-rose-200 shadow-sm shadow-rose-950'
                : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudLightning className="w-3.5 h-3.5 text-rose-400 mb-1" />
            <span className="text-[11px] font-bold leading-tight">Extreme</span>
            <span className="text-[9.5px] opacity-75 font-mono">+260% Anom</span>
          </button>
        </div>

        <p className="text-[10.5px] text-slate-400 italic bg-slate-950/60 p-2 rounded border border-slate-800/80 leading-relaxed">
          {basinForecast.scenarioDescription}
        </p>
      </div>

      {/* 2. Zone / Basin Context Indicator */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 text-[10px] block uppercase tracking-wider font-semibold">
            Forecast Target
          </span>
          <span className="font-bold text-white">
            {selectedZone ? selectedZone.name : 'Basin-Wide Aggregate (20 Reaches)'}
          </span>
        </div>
        {selectedZone && onClearZoneSelection && (
          <button
            onClick={onClearZoneSelection}
            className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
          >
            View Basin Avg
          </button>
        )}
      </div>

      {/* 3. Forecast Horizons Grid (Next 1h, Next 3h, Next 6h, Next 24h) */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          Precipitation Forecast Horizons
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Next 1h */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
              <span>Next 1h</span>
              <span className="text-cyan-400">Immediate</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                {displayNext1h.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-medium">mm</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Hourly precipitation rate
            </span>
          </div>

          {/* Next 3h */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
              <span>Next 3h</span>
              <span className="text-cyan-400">Short-Range</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                {displayNext3h.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-medium">mm</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Cumulative 3h total
            </span>
          </div>

          {/* Next 6h */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
              <span>Next 6h</span>
              <span className="text-amber-400">Transit Horizon</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                {displayNext6h.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-medium">mm</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Mid-range storm total
            </span>
          </div>

          {/* Next 24h */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-500/50 transition-colors relative overflow-hidden">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
              <span>Next 24h</span>
              <span className="text-cyan-300">24-Hour Horizon</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
                {displayNext24h.toFixed(1)}
              </span>
              <span className="text-xs text-cyan-400 font-medium">mm</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Full diurnal volume
            </span>
          </div>
        </div>
      </div>

      {/* 4. Calculated Hydrological Metrics */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          Precipitation Analytics & Risk Drivers
        </span>

        {/* Metric 1: Accumulated Rainfall */}
        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Accumulated Rainfall (24h):</span>
            <span className="font-mono font-bold text-white text-sm">
              {displayAccumulated.toFixed(1)} mm
            </span>
          </div>
          {/* Progress bar relative to 300mm extreme cap */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                displayAccumulated > 180
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : displayAccumulated > 70
                  ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
              }`}
              style={{ width: `${Math.min(100, (displayAccumulated / 250) * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Rainfall Intensity */}
        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">Rainfall Intensity:</span>
            <span className="text-[10.5px] text-slate-500 font-mono">
              Peak: {displayPeak.toFixed(1)} mm/h
            </span>
          </div>
          <span
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${intensityStyle.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${intensityStyle.indicator}`} />
            {intensityStyle.label}
          </span>
        </div>

        {/* Metric 3: Rainfall Anomaly Relative to Baseline */}
        <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Anomaly vs Baseline:</span>
            <span
              className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                displayAnomalyPercent > 150
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                  : displayAnomalyPercent > 50
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              }`}
            >
              {displayAnomalyPercent >= 0 ? `+${displayAnomalyPercent}%` : `${displayAnomalyPercent}%`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono pt-0.5">
            <span>Baseline Normal: {displayBaseline} mm</span>
            <span>Delta: {displayAnomalyMm > 0 ? `+${displayAnomalyMm}` : displayAnomalyMm} mm</span>
          </div>
        </div>
      </div>

      {/* 5. 24-Hour Hyetograph (Hourly Precipitation Bar Chart) */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            24h Hyetograph (Hourly Rain mm/h)
          </span>
          <span className="font-mono text-[10px] text-slate-500">T+1h → T+24h</span>
        </div>

        {/* SVG Bar Chart */}
        <div className="h-28 w-full bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 flex items-end justify-between gap-1">
          {hourlyProfile.map((rate, idx) => {
            const maxRate = Math.max(30, ...hourlyProfile);
            const heightPercent = Math.max(8, Math.min(100, (rate / maxRate) * 100));

            const isSevere = rate >= 35;
            const isHeavy = rate >= 15;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                  <div className="bg-slate-900 border border-slate-700 text-slate-100 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
                    H+{idx + 1}: {rate} mm/h
                  </div>
                </div>

                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isSevere
                      ? 'bg-rose-500 group-hover:bg-rose-400'
                      : isHeavy
                      ? 'bg-amber-500 group-hover:bg-amber-400'
                      : 'bg-cyan-500 group-hover:bg-cyan-400'
                  }`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 pt-0.5">
          <span>H+1 (Start)</span>
          <span>H+6</span>
          <span>H+12</span>
          <span>H+18</span>
          <span>H+24 (End)</span>
        </div>
      </div>

      {/* 6. Downstream Flood Wave Notice */}
      <div
        className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2.5 ${
          scenario === 'extreme'
            ? 'bg-rose-950/40 border-rose-600/50 text-rose-200'
            : scenario === 'heavy'
            ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
            : 'bg-slate-900/60 border-slate-800 text-slate-400'
        }`}
      >
        <AlertTriangle
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            scenario === 'extreme'
              ? 'text-rose-400 animate-pulse'
              : scenario === 'heavy'
              ? 'text-amber-400'
              : 'text-slate-500'
          }`}
        />
        <div>
          <span className="font-bold block text-white">
            {scenario === 'extreme'
              ? 'CRITICAL DOWNSTREAM FLOOD SURGE IN PROGRESS'
              : scenario === 'heavy'
              ? 'DOWNSTREAM FLOOD SWELL DETECTED'
              : 'NORMAL MONSOON REGIME'}
          </span>
          <span className="text-[10.5px]">
            {scenario === 'extreme'
              ? 'Upper headwaters (Sadiya, Dibrugarh) have reached critical discharge. The surge wave travels downstream, cresting at Tezpur (+6h), Guwahati (+12h), and Dhubri border reach (+18h).'
              : scenario === 'heavy'
              ? 'Elevated rainfall will trigger Warning-tier surcharge in central reaches over the next 12 hours. Scrub the timeline to monitor arrival.'
              : 'Precipitation is well within natural channel capacity. Infiltration rates remain stable across all 20 zones.'}
          </span>
        </div>
      </div>
    </div>
  );
};
