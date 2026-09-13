import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { SimState } from '@/simulation/engine';
import type { SatelliteObservation } from '@/types';
import { riskColor, alertLevelBg } from '@/lib/utils';
import { satelliteProvider } from '@/services/satelliteProvider';
import { AlertTriangle, ArrowDown, Activity, Gauge, Satellite, Radio } from 'lucide-react';

const FloodMap = dynamic(
  () => import('@/components/FloodMap').then((mod) => mod.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-cyan-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>INITIALIZING SPATIAL HYDRO-MAP...</span>
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

export function Overview({ state, selectedZoneId, onSelectZone }: Props) {
  const [mounted, setMounted] = useState(false);
  const [showSatelliteLayer, setShowSatelliteLayer] = useState(true);
  const [satelliteObservations, setSatelliteObservations] = useState<Record<string, SatelliteObservation>>({});
  const [satelliteLoading, setSatelliteLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Consume SatelliteProvider abstraction - frontend is agnostic to mock vs real API
  useEffect(() => {
    let cancelled = false;
    async function fetchSatelliteData() {
      if (!state.zones || state.zones.length === 0) return;
      setSatelliteLoading(true);
      try {
        const zoneIds = state.zones.map((z) => z.id);
        const observations = await satelliteProvider.getSatelliteObservations(zoneIds, state.timestamp);
        if (!cancelled) {
          const obsMap: Record<string, SatelliteObservation> = {};
          for (const obs of observations) {
            obsMap[obs.zoneId] = obs;
          }
          setSatelliteObservations(obsMap);
        }
      } catch (err) {
        console.error('Failed to fetch satellite observations:', err);
      } finally {
        if (!cancelled) {
          setSatelliteLoading(false);
        }
      }
    }

    fetchSatelliteData();
    return () => {
      cancelled = true;
    };
  }, [state.zones, state.timestamp]);

  const sortedZones = [...state.zones].sort((a, b) => b.state.riskScore - a.state.riskScore);
  const activeAlerts = state.alerts;

  // Satellite layer telemetry aggregates
  const obsList = Object.values(satelliteObservations);
  const avgWaterExtent = obsList.length > 0
    ? (obsList.reduce((acc, o) => acc + o.floodedFraction, 0) / obsList.length * 100).toFixed(1)
    : '0.0';
  const netSurfaceChange = obsList.length > 0
    ? (obsList.reduce((acc, o) => acc + o.surfaceWaterChange, 0) / obsList.length * 100).toFixed(1)
    : '0.0';
  const totalInundatedAreaKm2 = obsList.length > 0
    ? Math.round(obsList.reduce((acc, o) => acc + (137 * (1 + o.floodedFraction * 2.6)), 0))
    : 0;
  const latestObsTimestamp = obsList.length > 0 && obsList[0]?.timestamp
    ? (obsList[0].timestamp.length > 19 ? obsList[0].timestamp.replace('T', ' ').slice(0, 19) + ' UTC' : obsList[0].timestamp)
    : state.timestamp;


  return (
    <div className="flex h-full w-full">
      {/* Map */}
      <div className="flex-1 relative h-full">
        <FloodMap
          zones={state.zones}
          edges={state.edges}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          fitToBasin
          showSatelliteLayer={showSatelliteLayer}
          satelliteObservations={satelliteObservations}
        />

        {/* Floating Satellite Layer Toggle & Telemetry Widget */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 p-2.5 shadow-2xl flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                showSatelliteLayer ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                <Satellite className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">Satellite SAR Layer</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    showSatelliteLayer ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {showSatelliteLayer ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Sentinel-1 C-band Synthetic Aperture Radar</p>
              </div>
            </div>

            <button
              onClick={() => setShowSatelliteLayer(!showSatelliteLayer)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                showSatelliteLayer ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
              title="Toggle Satellite SAR Layer"
              aria-label="Toggle Satellite SAR Layer"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showSatelliteLayer ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* When enabled, show live satellite observation details */}
          {showSatelliteLayer && (
            <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 p-3 shadow-xl w-72 text-xs space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-300 border-b border-slate-800 pb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  SAR Observation Telemetry
                </span>
                <span className="font-mono text-[9px] text-slate-400">
                  {satelliteLoading ? 'Syncing...' : 'Live Synced'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
                <div>
                  <span className="text-slate-400">Water Extent:</span>
                  <p className="font-mono font-bold text-white text-xs">{avgWaterExtent}% avg</p>
                </div>
                <div>
                  <span className="text-slate-400">Inundated Area:</span>
                  <p className="font-mono font-bold text-cyan-300 text-xs">{totalInundatedAreaKm2.toLocaleString()} km²</p>
                </div>
                <div>
                  <span className="text-slate-400">Surface Change:</span>
                  <p className={`font-mono font-bold text-xs ${Number(netSurfaceChange) >= 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {Number(netSurfaceChange) >= 0 ? '+' : ''}{netSurfaceChange}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Radar Inundation:</span>
                  <p className="font-mono text-[10px] text-emerald-400 font-bold">Dynamic Masks On</p>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                  <span>Observation Time:</span>
                  <span className="font-mono text-cyan-200">{mounted ? latestObsTimestamp : 'Syncing...'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700 p-3 z-[1000] shadow-xl">
          <p className="text-xs font-semibold text-slate-300 mb-2">Flood Risk Heatmap</p>
          <div
            className="w-44 h-3 rounded-full overflow-hidden mb-1"
            style={{
              background: 'linear-gradient(to right, #22c55e, #84cc16, #eab308, #ea580c, #dc2626)',
            }}
          />
          <div className="flex items-center justify-between w-44">
            <span className="text-[10px] text-green-400 font-medium">Low</span>
            <span className="text-[10px] text-yellow-400 font-medium">Moderate</span>
            <span className="text-[10px] text-red-400 font-medium">High</span>
          </div>
          <div className="flex items-center justify-between w-44 mt-0.5">
            <span className="text-[10px] text-slate-500">0</span>
            <span className="text-[10px] text-slate-500">50</span>
            <span className="text-[10px] text-slate-500">100</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500" />
              <span className="text-xs text-slate-400">Sensor (normal)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-slate-400">Sensor (warning)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-xs text-slate-400">Sensor (critical)</span>
            </div>
          </div>

          {/* Dynamic SAR Water Mask Legend (visible when Satellite layer active) */}
          {showSatelliteLayer && (
            <div className="mt-2 pt-2 border-t border-cyan-500/30 space-y-1 animate-fade-in">
              <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1">SAR Inundation Masks</p>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-sky-700 border border-sky-500" />
                <span className="text-[11px] text-slate-300">Permanent Channel</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-cyan-600/80 border border-cyan-400 border-dashed animate-pulse" />
                <span className="text-[11px] text-cyan-200">SAR Flood Extent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 rounded bg-teal-600/60 border border-teal-400 border-dotted" />
                <span className="text-[11px] text-slate-300">Saturated Lowlands</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-80 bg-slate-900 border-l border-slate-700 overflow-y-auto flex-shrink-0">
        {/* Active alerts */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Active Alerts</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {activeAlerts.length}
            </span>
          </div>
          {activeAlerts.length === 0 ? (
            <p className="text-xs text-slate-500">No active alerts. System monitoring.</p>
          ) : (
            <div className="space-y-2">
              {activeAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`px-3 py-2 rounded-lg text-xs ${alertLevelBg(alert.level)} animate-fade-in`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{alert.level}</span>
                    <span className="text-[10px] opacity-80 font-mono">
                      {alert.timeToDanger < 99 ? `TTD: ${alert.timeToDanger}h` : ''}
                    </span>
                  </div>
                  <p className="opacity-90 leading-tight">{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Satellite Observations (when layer active) */}
        {showSatelliteLayer && (
          <div className="p-4 border-b border-slate-700 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <Satellite className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">SAR Water Extent</h3>
              <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded font-mono">
                Sentinel-1
              </span>
            </div>
            <div className="space-y-2">
              {state.zones.map((zone) => {
                const obs = satelliteObservations[zone.id];
                const extentPct = obs ? (obs.floodedFraction * 100).toFixed(1) : '—';
                const changePct = obs ? (obs.surfaceWaterChange * 100).toFixed(1) : '—';
                const isPositive = obs ? obs.surfaceWaterChange >= 0 : true;

                return (
                  <button
                    key={zone.id}
                    onClick={() => onSelectZone(zone.id)}
                    className={`w-full p-2 rounded-lg transition-colors text-left cursor-pointer border ${
                      selectedZoneId === zone.id
                        ? 'bg-slate-800/90 border-cyan-500'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white truncate">{zone.name}</span>
                      <span className="text-xs font-mono font-bold text-cyan-400">{extentPct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Surface Change:</span>
                      <span className={`font-mono font-semibold ${isPositive ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {isPositive ? '+' : ''}{changePct}%
                      </span>
                    </div>
                    {obs && (
                      <div className="text-[9px] text-slate-500 mt-1 font-mono">
                        Obs: {obs.timestamp.length > 19 ? obs.timestamp.slice(11, 19) + ' UTC' : obs.timestamp}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Highest risk zones */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Highest Risk Zones</h3>
          </div>
          <div className="space-y-2">
            {sortedZones.slice(0, 5).map((zone, i) => (
              <button
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left cursor-pointer ${
                  selectedZoneId === zone.id ? 'bg-slate-800 border border-slate-600' : 'hover:bg-slate-800'
                }`}
              >
                <span className="text-xs text-slate-500 w-4 font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{zone.name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{zone.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${zone.state.riskScore}%`, backgroundColor: riskColor(zone.state.riskScore) }}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono" style={{ color: riskColor(zone.state.riskScore) }}>
                    {zone.state.riskScore}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Basin status */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Basin Status</h3>
          </div>
          <div className="space-y-2">
            <StatRow label="Zones" value={`${state.zones.length}`} />
            <StatRow label="Graph Edges" value={`${state.edges.length}`} />
            <StatRow
              label="Simulated Sensors"
              value={`${state.zones.reduce((s, z) => s + z.sensors.length, 0)}`}
            />
            <StatRow
              label="Avg Confidence"
              value={`${state.zones.length > 0 ? Math.round(state.zones.reduce((s, z) => s + z.state.confidence, 0) / state.zones.length) : 0}%`}
            />
            <StatRow
              label="Max River Level"
              value={`${(state.zones.length > 0 ? Math.max(...state.zones.map((z) => z.state.riverLevel)) : 0).toFixed(1)} m`}
            />
            <StatRow
              label="Total Flow"
              value={`${state.zones.reduce((s, z) => s + z.state.predictedOutgoingFlow, 0)} m³/s`}
            />
            <StatRow
              label="SAR Flood Extent"
              value={`${avgWaterExtent}%`}
            />
            <StatRow label="SAR Lag" value={state.sarPass ? `${state.sarPass.lagHours}h` : '—'} />
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDown className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-400">FLOW PROPAGATION</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Water flows: Pasighat → Dibrugarh → Jorhat → (Tezpur / Nagaon) → Guwahati → Goalpara
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}
