'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { SimState } from '@/simulation/engine';
import type { HeatmapPoint } from '@/components/DensityHeatmap';
import {
  Flame,
  Layers,
  Sliders,
  Eye,
  MapPin,
  Compass,
  AlertTriangle,
  Droplets,
  Activity,
  Gauge,
  Satellite,
  ChevronRight,
} from 'lucide-react';

const DensityHeatmap = dynamic(
  () => import('@/components/DensityHeatmap').then((mod) => mod.DensityHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-cyan-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>RENDERING GAUSSIAN DENSITY HEATMAP...</span>
        </div>
      </div>
    ),
  }
);

interface Props {
  state: SimState;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

type HeatmapMetric = 'risk' | 'rainfall' | 'river_stage' | 'sar_extent';
type BasemapType = 'shaded' | 'topo' | 'dark' | 'satellite';

export function RegionalHeatmap({ state, selectedZoneId, onSelectZone }: Props) {
  const [metric, setMetric] = useState<HeatmapMetric>('risk');
  const [basemap, setBasemap] = useState<BasemapType>('shaded');
  const [radius, setRadius] = useState<number>(54);
  const [opacity, setOpacity] = useState<number>(0.90);
  const [blur, setBlur] = useState<number>(0.84);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Map of zones by ID for quick state lookup
  const zoneMap = useMemo(() => {
    const map = new Map<string, (typeof state.zones)[0]>();
    for (const z of state.zones) {
      map.set(z.id, z);
    }
    return map;
  }, [state.zones]);

  /**
   * Builds the comprehensive hotspot points array matching all the geographic clusters
   * shown in the reference image:
   * - Pasighat / Upper Catchment
   * - Dibrugarh
   * - North Lakhimpur
   * - Sibsagar (merges with Jorhat)
   * - Jorhat (merges with Sibsagar)
   * - Golaghat
   * - Tezpur North (merges with Nagaon & Biswanath Chariali)
   * - Nagaon South (merges with Tezpur)
   * - Biswanath Chariali (merges with Tezpur)
   * - Morigaon
   * - Guwahati Capital Basin
   * - Goalpara Outflow
   */
  const heatmapPoints = useMemo<HeatmapPoint[]>(() => {
    const z1 = zoneMap.get('z1');
    const z2 = zoneMap.get('z2');
    const z3 = zoneMap.get('z3');
    const z4 = zoneMap.get('z4');
    const z5 = zoneMap.get('z5');
    const z6 = zoneMap.get('z6');
    const z7 = zoneMap.get('z7');

    const getMetrics = (zone: typeof z1, modifier = 1.0) => {
      if (!zone) return { intensity: 0.35, label: '35%', value: '35' };
      const s = zone.state;

      if (metric === 'rainfall') {
        const val = Math.round(s.rainfall24h * modifier * 10) / 10;
        const norm = Math.min(1.0, Math.max(0.15, val / 110.0));
        return { intensity: norm, label: '24h Rain', value: `${val} mm` };
      }
      if (metric === 'river_stage') {
        const val = Math.round(s.riverLevel * modifier * 10) / 10;
        const norm = Math.min(1.0, Math.max(0.18, val / 5.6));
        return { intensity: norm, label: 'River Stage', value: `${val} m` };
      }
      if (metric === 'sar_extent') {
        const val = Math.round(s.sarFloodExtent * modifier);
        const norm = Math.min(1.0, Math.max(0.15, val / 50.0));
        return { intensity: norm, label: 'SAR Extent', value: `${val}%` };
      }
      // Default: Compound Risk
      const val = Math.min(100, Math.round(s.riskScore * modifier));
      const norm = Math.min(1.0, Math.max(0.18, val / 100.0));
      return { intensity: norm, label: 'Risk Score', value: `${val}/100` };
    };

    const m1 = getMetrics(z1, 1.0);
    const m2 = getMetrics(z2, 1.0);
    const m2_nl = getMetrics(z2, 0.92); // North Lakhimpur sub-catchment
    const m3_sib = getMetrics(z3, 0.95); // Sibsagar sub-basin
    const m3 = getMetrics(z3, 1.0);     // Jorhat confluence
    const m3_gola = getMetrics(z3, 0.88); // Golaghat reach
    const m4 = getMetrics(z4, 1.05);    // Tezpur bend
    const m5 = getMetrics(z5, 1.0);     // Nagaon floodplain
    const m4_bis = getMetrics(z4, 0.94); // Biswanath Chariali
    const m5_mori = getMetrics(z5, 0.90); // Morigaon reach
    const m6 = getMetrics(z6, 1.0);     // Guwahati capital basin
    const m7 = getMetrics(z7, 1.0);     // Goalpara outflow

    return [
      // 1. Upper Catchment / Arunachal Border
      {
        lat: 28.06,
        lng: 95.31,
        intensity: m1.intensity,
        label: 'Pasighat',
        zoneId: 'z1',
        metricLabel: m1.label,
        metricValue: m1.value,
        elevation: 155,
      },
      // 2. Upper Valley
      {
        lat: 27.48,
        lng: 94.92,
        intensity: m2.intensity,
        label: 'Dibrugarh',
        zoneId: 'z2',
        metricLabel: m2.label,
        metricValue: m2.value,
        elevation: 116,
      },
      // 3. North Bank
      {
        lat: 27.24,
        lng: 94.11,
        intensity: m2_nl.intensity,
        label: 'North Lakhimpur',
        zoneId: 'z2',
        metricLabel: m2_nl.label,
        metricValue: m2_nl.value,
        elevation: 101,
      },
      // 4. Sibsagar (merges with Jorhat into figure-8 lobe)
      {
        lat: 26.98,
        lng: 94.63,
        intensity: m3_sib.intensity,
        label: 'Sibsagar',
        zoneId: 'z3',
        metricLabel: m3_sib.label,
        metricValue: m3_sib.value,
        elevation: 95,
      },
      // 5. Jorhat Central Confluence
      {
        lat: 26.75,
        lng: 94.21,
        intensity: m3.intensity,
        label: 'Jorhat',
        zoneId: 'z3',
        metricLabel: m3.label,
        metricValue: m3.value,
        elevation: 98,
      },
      // 6. Golaghat / Dhansiri reach
      {
        lat: 26.51,
        lng: 93.97,
        intensity: m3_gola.intensity,
        label: 'Golaghat',
        zoneId: 'z3',
        metricLabel: m3_gola.label,
        metricValue: m3_gola.value,
        elevation: 95,
      },
      // 7. Tezpur North (merges with Nagaon & Biswanath Chariali into large 3-lobe cluster)
      {
        lat: 26.65,
        lng: 92.80,
        intensity: m4.intensity,
        label: 'Tezpur',
        zoneId: 'z4',
        metricLabel: m4.label,
        metricValue: m4.value,
        elevation: 72,
      },
      // 8. Nagaon South Floodplain
      {
        lat: 26.42,
        lng: 92.68,
        intensity: m5.intensity,
        label: 'Nagaon',
        zoneId: 'z5',
        metricLabel: m5.label,
        metricValue: m5.value,
        elevation: 58,
      },
      // 9. Biswanath Chariali
      {
        lat: 26.70,
        lng: 93.18,
        intensity: m4_bis.intensity,
        label: 'Biswanath',
        zoneId: 'z4',
        metricLabel: m4_bis.label,
        metricValue: m4_bis.value,
        elevation: 78,
      },
      // 10. Morigaon / Beel lowlands
      {
        lat: 26.25,
        lng: 92.34,
        intensity: m5_mori.intensity,
        label: 'Morigaon',
        zoneId: 'z5',
        metricLabel: m5_mori.label,
        metricValue: m5_mori.value,
        elevation: 55,
      },
      // 11. Guwahati Urban Constriction
      {
        lat: 26.18,
        lng: 91.75,
        intensity: m6.intensity,
        label: 'Guwahati',
        zoneId: 'z6',
        metricLabel: m6.label,
        metricValue: m6.value,
        elevation: 49,
      },
      // 12. Goalpara Lower Basin Outflow
      {
        lat: 26.16,
        lng: 90.62,
        intensity: m7.intensity,
        label: 'Goalpara',
        zoneId: 'z7',
        metricLabel: m7.label,
        metricValue: m7.value,
        elevation: 35,
      },
    ];
  }, [zoneMap, metric]);

  // Ranked hotspots by intensity
  const sortedHotspots = useMemo(() => {
    return [...heatmapPoints].sort((a, b) => b.intensity - a.intensity);
  }, [heatmapPoints]);

  const handleSelectHotspot = (pt: HeatmapPoint) => {
    setFocusPoint({ lat: pt.lat, lng: pt.lng });
    onSelectZone(pt.zoneId);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      {/* Main Map Workstation */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Control Header Toolbar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md z-10 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-600/30">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Regional Thermal Flood Heatmap</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  Gaussian Density Raster
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Multi-point thermal density estimation across the Brahmaputra valley shaded relief terrain.
              </p>
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-1 text-xs gap-1">
            <button
              onClick={() => setMetric('risk')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                metric === 'risk'
                  ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔥</span>
              <span>Flood Risk</span>
            </button>
            <button
              onClick={() => setMetric('rainfall')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                metric === 'rainfall'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌧️</span>
              <span>24h Rainfall</span>
            </button>
            <button
              onClick={() => setMetric('river_stage')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                metric === 'river_stage'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🌊</span>
              <span>River Stage</span>
            </button>
            <button
              onClick={() => setMetric('sar_extent')}
              className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                metric === 'sar_extent'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🛰️</span>
              <span>SAR Extent</span>
            </button>
          </div>
        </div>

        {/* Leaflet + Canvas Density Heatmap Container */}
        <div className="flex-1 relative min-h-0 w-full overflow-hidden">
          <DensityHeatmap
            points={heatmapPoints}
            basemap={basemap}
            radius={radius}
            opacity={opacity}
            blur={blur}
            showLabels={showLabels}
            onSelectPoint={onSelectZone}
            focusPoint={focusPoint}
          />

          {/* Floating Top-Left Basemap Switcher Toolbar (Matches Reference Image) */}
          <div className="absolute top-4 left-14 z-[1000] flex items-center bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-700 p-1 shadow-xl text-xs gap-1">
            <button
              onClick={() => setBasemap('shaded')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                basemap === 'shaded'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Esri Shaded Relief Terrain (Matches reference image)"
            >
              <span>🏔️</span>
              <span>Shaded Relief</span>
            </button>
            <button
              onClick={() => setBasemap('topo')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                basemap === 'topo'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Esri World Topographic Map"
            >
              <span>🗺️</span>
              <span>World Topo</span>
            </button>
            <button
              onClick={() => setBasemap('dark')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                basemap === 'dark'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Esri Dark Gray Base"
            >
              <span>🌑</span>
              <span>Dark Canvas</span>
            </button>
            <button
              onClick={() => setBasemap('satellite')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                basemap === 'satellite'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Esri World Imagery"
            >
              <span>🛰️</span>
              <span>Satellite</span>
            </button>
          </div>

          {/* Floating Top-Right Parameter Controls Slider Card */}
          <div className="absolute top-4 right-4 z-[1000] bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 p-3 shadow-2xl text-xs w-64 space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Heatmap Parameters</span>
              </div>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`p-1 rounded text-[10px] flex items-center gap-1 transition-colors ${
                  showLabels ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle Station Labels"
              >
                <Eye className="w-3 h-3" />
                <span>Labels</span>
              </button>
            </div>

            {/* Radius Slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Plume Radius</span>
                <span className="font-mono text-cyan-400 font-bold">{radius}px</span>
              </div>
              <input
                type="range"
                min="30"
                max="80"
                step="2"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Opacity Slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Thermal Opacity</span>
                <span className="font-mono text-amber-400 font-bold">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Falloff Blur Slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-400">Gaussian Falloff</span>
                <span className="font-mono text-red-400 font-bold">{Math.round(blur * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.02"
                value={blur}
                onChange={(e) => setBlur(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-400"
              />
            </div>
          </div>

          {/* Floating Bottom Thermal Color Ramp Legend Bar (Exactly mirrors the reference image) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 px-4 py-2.5 shadow-2xl flex flex-col items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center justify-between w-72 text-[10px] font-bold text-slate-300">
              <span className="text-sky-400">Ambient Rim (Cyan)</span>
              <span className="text-yellow-400">Moderate</span>
              <span className="text-orange-400">Elevated</span>
              <span className="text-red-500">Core (Crimson)</span>
            </div>
            {/* The continuous color gradient bar */}
            <div
              className="w-72 h-3 rounded-full border border-slate-700 shadow-inner"
              style={{
                background:
                  'linear-gradient(to right, rgba(56,189,248,0.7) 0%, rgba(14,165,233,0.9) 25%, rgba(234,179,8,0.95) 50%, rgba(249,115,22,1) 70%, rgba(220,38,38,1) 85%, rgba(185,28,28,1) 100%)',
              }}
            />
            <div className="text-[9px] text-slate-400 font-mono">
              Thermal Density Scale &mdash; Overlapping clusters fuse into high-intensity cores
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Hotspot Breakdown & Active Cluster Telemetry */}
      <div className="w-80 xl:w-88 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Active Thermal Hotspots
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {heatmapPoints.length} Centroids
          </span>
        </div>

        {/* Hotspots List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedHotspots.map((pt, idx) => {
            const isSelected = selectedZoneId === pt.zoneId;
            const pct = Math.round(pt.intensity * 100);
            const isDanger = pct >= 75;
            const isWarning = pct >= 50;

            return (
              <div
                key={`${pt.label}-${idx}`}
                onClick={() => handleSelectHotspot(pt)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-500 shadow-md shadow-cyan-600/20'
                    : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{pt.label}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{pt.elevation}m</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isDanger
                        ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                        : isWarning
                        ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                        : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                    }`}
                  >
                    {pt.metricValue}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>Thermal Intensity: {pct}%</span>
                  <span className="font-mono text-slate-400">
                    {pt.lat.toFixed(2)}°N, {pt.lng.toFixed(2)}°E
                  </span>
                </div>

                {/* Micro Progress Bar */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isDanger ? '#dc2626' : isWarning ? '#ea580c' : '#0ea5e9',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Basin Cluster Analysis Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/90 text-xs space-y-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Organic Multi-Node Fusion</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            As modeled, adjacent high-risk centers (such as the <b>Tezpur-Nagaon-Biswanath</b> confluence and the <b>Jorhat-Sibsagar</b> reach) additively overlap into continuous multi-lobed thermal flood hazard cores.
          </p>
        </div>
      </div>
    </div>
  );
}
