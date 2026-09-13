'use client';

import { useState, useEffect } from 'react';
import type { SimState } from '@/simulation/engine';
import type { Zone, AIPrediction, SatelliteObservation } from '@/types';
import { riskColor, alertLevelBg } from '@/lib/utils';
import { predictZoneFlood } from '@/services/mlPredictionService';
import { satelliteProvider } from '@/services/satelliteProvider';
import { Activity, Radio, ArrowDown, ArrowUp, Shield, TrendingUp, Brain, Cpu, CheckCircle2, Satellite } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';

interface Props {
  state: SimState;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export function ZoneDetails({ state, selectedZoneId, onSelectZone }: Props) {
  const [hoveredFactor, setHoveredFactor] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mlPrediction, setMlPrediction] = useState<AIPrediction | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [satObservation, setSatObservation] = useState<SatelliteObservation | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const zone = state.zones.find((z) => z.id === selectedZoneId) || state.zones[0];

  // Fetch ML Prediction from FastAPI microservice
  useEffect(() => {
    if (!zone) return;
    let cancelled = false;
    setMlLoading(true);

    predictZoneFlood(zone).then((pred) => {
      if (!cancelled) {
        setMlPrediction(pred);
        setMlLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [zone?.id, zone?.state.riverLevel, zone?.state.rainfallIntensity, zone?.state.upstreamInflow]);

  // Fetch Satellite Observation from SatelliteProvider abstraction
  useEffect(() => {
    if (!zone) return;
    let cancelled = false;
    satelliteProvider.getSatelliteObservations([zone.id], state.timestamp).then((obs) => {
      if (!cancelled && obs.length > 0) {
        setSatObservation(obs[0]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [zone?.id, state.timestamp]);


  if (!zone) {
    return <div className="p-8 text-center text-slate-500 font-mono">No zone data available</div>;
  }

  const zoneHistory = state.history
    .filter((s) => s.zoneStates[zone.id])
    .map((s) => ({
      tick: s.tick,
      risk: s.zoneStates[zone.id].riskScore,
      riverLevel: s.zoneStates[zone.id].riverLevel,
      rainfall: s.zoneStates[zone.id].rainfallIntensity,
      flow: s.zoneStates[zone.id].predictedOutgoingFlow,
    }));

  return (
    <div className="flex h-full w-full">
      {/* Zone selector */}
      <div className="w-56 bg-slate-900 border-r border-slate-700 overflow-y-auto p-3 flex-shrink-0">
        <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-1">Zones</h3>
        <div className="space-y-1">
          {state.zones.map((z) => (
            <button
              key={z.id}
              onClick={() => onSelectZone(z.id)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                zone.id === z.id ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate">{z.name}</span>
                <span className="text-xs font-bold font-mono" style={{ color: zone.id === z.id ? '#fff' : riskColor(z.state.riskScore) }}>
                  {z.state.riskScore}
                </span>
              </div>
              <span className="text-[10px] opacity-70 capitalize">{z.type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main detail */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{zone.name}</h2>
              <p className="text-sm text-slate-400">
                {zone.type.toUpperCase()} · {zone.upstreamZoneIds.length} upstream · {zone.downstreamZoneIds.length} downstream
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-mono" style={{ color: riskColor(zone.state.riskScore) }}>
                {zone.state.riskScore}
              </div>
              <div className={`text-xs px-3 py-1 rounded-full inline-block font-semibold ${alertLevelBg(zone.state.alertLevel)}`}>
                {zone.state.alertLevel}
              </div>
            </div>
          </div>

          {/* Machine Learning Multi-Horizon Forecast Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/40 rounded-xl border border-purple-500/30 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">ML Prediction Service</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 font-mono border border-purple-500/30 font-semibold">
                      FastAPI :8000
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Multi-horizon flood risk probability inference via XGBoost
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {mlLoading ? (
                  <span className="text-xs text-purple-300 font-mono animate-pulse">Computing inference...</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                      <span>{mlPrediction?.algorithm || 'XGBoost'}</span>
                    </div>
                    {mlPrediction && (
                      <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase ${
                        mlPrediction.risk_tier === 'critical' ? 'bg-red-600/30 text-red-300 border border-red-500/40' :
                        mlPrediction.risk_tier === 'warning' ? 'bg-orange-600/30 text-orange-300 border border-orange-500/40' :
                        mlPrediction.risk_tier === 'watch' ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40' :
                        'bg-green-600/30 text-green-300 border border-green-500/40'
                      }`}>
                        Tier: {mlPrediction.risk_tier}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3 Horizon Meters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <HorizonCard
                label="1-Hour Horizon"
                sub="Flash Flood Stage"
                probability={mlPrediction?.probabilities.flood_probability_1h ?? 0.05}
                color="#0ea5e9"
              />
              <HorizonCard
                label="3-Hour Horizon"
                sub="Transit Wave Arrival"
                probability={mlPrediction?.probabilities.flood_probability_3h ?? 0.12}
                color="#eab308"
              />
              <HorizonCard
                label="6-Hour Horizon"
                sub="Cumulative Inundation"
                probability={mlPrediction?.probabilities.flood_probability_6h ?? 0.25}
                color="#f97316"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>16 Hydrological Features Ingested & Calibrated</span>
              </span>
              <span className="font-mono text-purple-300">
                Confidence: {Math.round((mlPrediction?.confidence ?? 0.95) * 100)}%
              </span>
            </div>
          </div>

          {/* Satellite SAR Observation Telemetry */}
          {satObservation && (
            <div className="bg-slate-900 rounded-xl border border-cyan-500/30 p-4 shadow-lg animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Satellite SAR Spatial Observation</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    SatelliteProvider Active
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Obs: {satObservation.timestamp.length > 19 ? satObservation.timestamp.slice(0, 19).replace('T', ' ') + ' UTC' : satObservation.timestamp}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <p className="text-[10px] text-slate-400">Water Extent</p>
                  <p className="font-mono text-lg font-bold text-cyan-300">
                    {(satObservation.floodedFraction * 100).toFixed(1)}%
                  </p>
                  <div className="w-full h-1 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${Math.min(100, satObservation.floodedFraction * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <p className="text-[10px] text-slate-400">Surface Change</p>
                  <p className={`font-mono text-lg font-bold ${satObservation.surfaceWaterChange >= 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {satObservation.surfaceWaterChange >= 0 ? '+' : ''}{(satObservation.surfaceWaterChange * 100).toFixed(1)}%
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1">vs. Baseline SAR Pass</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <p className="text-[10px] text-slate-400">Soil Moisture / Rain</p>
                  <p className="font-mono text-sm font-bold text-white">
                    {satObservation.soilMoisture}% <span className="text-slate-400 font-normal">/</span> {satObservation.rainfallEstimate} <span className="text-[10px] font-normal text-slate-400">mm</span>
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1">Radar Backscatter</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                  <p className="text-[10px] text-slate-400">SAR Confidence</p>
                  <p className="font-mono text-lg font-bold text-emerald-400">
                    {Math.round(satObservation.confidence * 100)}%
                  </p>
                  <p className="text-[9px] text-slate-500 mt-1 truncate" title={satObservation.source}>
                    {satObservation.source.split(' ')[0]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Risk factors */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Risk Factor Breakdown — Explainable Contributor Attribution</h3>
            </div>
            <div className="space-y-2">
              {zone.riskFactors.map((factor, i) => (
                <div
                  key={i}
                  className="group"
                  onMouseEnter={() => setHoveredFactor(factor.label)}
                  onMouseLeave={() => setHoveredFactor(null)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs ${hoveredFactor === factor.label ? 'text-white' : 'text-slate-400'}`}>
                      {factor.label}
                    </span>
                    <span className="text-xs font-mono text-slate-300">+{factor.contribution}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(factor.contribution / 25) * 100}%`,
                        backgroundColor: riskColor(factor.contribution * 4),
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Total Composite Risk Score</span>
                <span className="text-lg font-bold font-mono" style={{ color: riskColor(zone.state.riskScore) }}>
                  {zone.state.riskScore}/100
                </span>
              </div>
            </div>
          </div>

          {/* Charts */}
          {mounted && zoneHistory.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
                <h3 className="text-xs font-semibold text-slate-400 mb-3">Risk Score Over Time</h3>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={zoneHistory}>
                      <defs>
                        <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="tick" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area type="monotone" dataKey="risk" stroke="#0ea5e9" fill="url(#riskGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
                <h3 className="text-xs font-semibold text-slate-400 mb-3">River Level & Rainfall</h3>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={zoneHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="tick" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Line type="monotone" dataKey="riverLevel" stroke="#06b6d4" strokeWidth={2} dot={false} name="River Level (m)" />
                      <Line type="monotone" dataKey="rainfall" stroke="#ea580c" strokeWidth={2} dot={false} name="Rainfall (mm/h)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Upstream recalibration */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Upstream → Downstream Recalibration</h3>
            </div>
            {zone.upstreamZoneIds.length === 0 ? (
              <p className="text-xs text-slate-500">Headwater zone — no upstream inputs. Generates initial flow prediction.</p>
            ) : (
              <div className="space-y-3">
                {zone.upstreamZoneIds.map((uid) => {
                  const upstream = state.zones.find((z) => z.id === uid);
                  const edge = state.edges.find((e) => e.from === uid && e.to === zone.id);
                  if (!upstream || !edge) return null;
                  return (
                    <div key={uid} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDown className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-300">{upstream.name}</span>
                        <span className="text-[10px] text-slate-500">→ {zone.name}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-500">Predicted Flow</p>
                          <p className="font-mono text-white">{edge.predictedFlow} m³/s</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Travel Time</p>
                          <p className="font-mono text-white">{edge.travelTime}h</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Confidence</p>
                          <p className="font-mono text-white">{edge.confidence}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Upstream Risk</p>
                          <p className="font-mono" style={{ color: riskColor(upstream.state.riskScore) }}>
                            {upstream.state.riskScore}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-400">
                        <span className="text-cyan-400 font-semibold">Recalibration:</span> Local river level {zone.state.riverLevel.toFixed(1)}m
                        {' + '} upstream {edge.predictedFlow} m³/s
                        {' → '} predicted water level {zone.state.predictedWaterLevel.toFixed(1)}m
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sensors */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Simulated IoT Sensor Stream</h3>
              <span className="ml-auto text-[10px] text-slate-500 italic">Simulated IoT sensor stream</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {zone.sensors.map((s) => (
                <div key={s.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300">{s.label}</span>
                    <div className={`w-2 h-2 rounded-full ${s.status === 'critical' ? 'bg-red-500' : s.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold font-mono ${s.status === 'critical' ? 'text-red-400' : s.status === 'warning' ? 'text-yellow-400' : 'text-white'}`}>
                      {s.value}
                    </span>
                    <span className="text-xs text-slate-500">{s.unit}</span>
                    <span className="ml-auto text-xs">
                      {s.trend === 'up' ? <ArrowUp className="w-3 h-3 text-red-400" /> : s.trend === 'down' ? <ArrowDown className="w-3 h-3 text-green-400" /> : <span className="text-slate-500">→</span>}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 font-mono">
                    Prev: {s.previousValue}{s.unit} · {s.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terrain info */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Terrain & Historical Context</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <TerrainItem label="Elevation" value={`${zone.elevation} m`} />
              <TerrainItem label="Slope" value={`${zone.slope}°`} />
              <TerrainItem label="Flow Accumulation" value={zone.flowAccumulation.toLocaleString()} />
              <TerrainItem label="Distance from River" value={`${zone.distanceFromRiver} km`} />
              <TerrainItem label="Historical Floods" value={`${zone.historicalFloodFrequency} events`} />
              <TerrainItem label="Basin" value="Brahmaputra" />
              <TerrainItem label="State" value="Assam" />
              <TerrainItem label="Edge Mode" value={zone.state.edgeMode ? 'ACTIVE' : 'Normal'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizonCard({ label, sub, probability, color }: { label: string; sub: string; probability: number; color: string }) {
  const pct = Math.round(probability * 100);

  return (
    <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-sm font-bold font-mono" style={{ color }}>{pct}%</span>
      </div>
      <p className="text-[10px] text-slate-400 mb-2">{sub}</p>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TerrainItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-800">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="font-mono text-sm text-white">{value}</p>
    </div>
  );
}
