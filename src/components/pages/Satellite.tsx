'use client';

import { useState, useEffect } from 'react';
import type { SimState } from '@/simulation/engine';
import type { SatelliteObservation } from '@/types';
import { satelliteProvider } from '@/services/satelliteProvider';
import { sentinel1Metadata } from '@/data/historical';
import { formatTime } from '@/lib/utils';
import { Satellite as SatelliteIcon, Radar, Clock, Layers, AlertCircle, CheckCircle, Radio } from 'lucide-react';

interface Props {
  state: SimState;
}

export function Satellite({ state }: Props) {
  const sar = state.sarPass;
  const [observations, setObservations] = useState<SatelliteObservation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadObservations() {
      if (!state.zones || state.zones.length === 0) return;
      setLoading(true);
      try {
        const zoneIds = state.zones.map((z) => z.id);
        const data = await satelliteProvider.getSatelliteObservations(zoneIds, state.timestamp);
        if (!cancelled) {
          setObservations(data);
        }
      } catch (err) {
        console.error('Failed to load satellite observations:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadObservations();
    return () => {
      cancelled = true;
    };
  }, [state.zones, state.timestamp]);

  return (
    <div className="overflow-y-auto h-full p-6 w-full">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <SatelliteIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Sentinel-1 SAR — Satellite Observations</h2>
            <p className="text-sm text-slate-400">Copernicus C-band Synthetic Aperture Radar (Active Spatial Feed)</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-4 rounded-xl bg-amber-600/10 border border-amber-600/30 flex items-start gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200 font-medium mb-1">Important: Satellite observations are periodic, not live streaming.</p>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              {sentinel1Metadata.disclaimer}
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Radar className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Sentinel-1 Product Details</h3>
            </div>
            <div className="space-y-2 text-xs">
              <MetaRow label="Dataset" value={sentinel1Metadata.dataset} />
              <MetaRow label="Sensor" value={sentinel1Metadata.sensor} />
              <MetaRow label="Primary Use" value={sentinel1Metadata.primaryUse} />
              <MetaRow label="Resolution" value={sentinel1Metadata.resolution} />
              <MetaRow label="Revisit" value={sentinel1Metadata.revisit} />
              <MetaRow label="Product Type" value={sentinel1Metadata.productType} />
              <MetaRow label="Mode" value={sentinel1Metadata.mode} />
              <MetaRow label="Polarization" value={sentinel1Metadata.polarization} />
            </div>
          </div>

          {/* Latest SAR pass */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Latest SAR Pass — Lag Display</h3>
            </div>
            {sar ? (
              <div className="space-y-2 text-xs">
                <MetaRow label="Acquisition Time" value={formatTime(sar.acquisitionTime)} />
                <MetaRow label="Processing Time" value={formatTime(sar.processingTime)} />
                <MetaRow label="Prediction Time" value={formatTime(sar.predictionTime)} />
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Satellite-to-Prediction Lag</span>
                    <span className="font-mono text-xl font-bold text-cyan-300">{sar.lagHours}h</span>
                  </div>
                </div>
                <MetaRow label="Orbit" value={sar.orbit} />
                <MetaRow label="Flood Extent (avg)" value={`${sar.floodExtentPercent}%`} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No SAR pass yet. Passes occur every 6 simulation ticks.</p>
            )}
          </div>
        </div>

        {/* Live SatelliteProvider Inundation Feed */}
        <div className="bg-slate-900 rounded-xl border border-cyan-500/30 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Satellite Observation Feed (SatelliteProvider)</h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-full">
              {loading ? 'Fetching Provider...' : `${observations.length} Zones Observed`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {observations.map((obs) => {
              const zone = state.zones.find((z) => z.id === obs.zoneId);
              const isPositive = obs.surfaceWaterChange >= 0;

              return (
                <div key={obs.zoneId} className="p-3 rounded-lg bg-slate-800/90 border border-slate-700 hover:border-cyan-500/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white truncate">{zone ? zone.name : obs.zoneId}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-700">
                      {obs.zoneId.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">Water Extent</span>
                      <span className="font-mono text-sm font-bold text-cyan-300">
                        {(obs.floodedFraction * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, obs.floodedFraction * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Surface Change</span>
                      <span className={`font-mono font-semibold ${isPositive ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {isPositive ? '+' : ''}{(obs.surfaceWaterChange * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Soil Moisture</span>
                      <span className="font-mono text-slate-200">{obs.soilMoisture}%</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Rainfall Est.</span>
                      <span className="font-mono text-slate-200">{obs.rainfallEstimate} mm/h</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Confidence</span>
                      <span className="font-mono text-emerald-400">{Math.round(obs.confidence * 100)}%</span>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-700/80 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                      <span>Obs: {obs.timestamp.length > 19 ? obs.timestamp.slice(11, 19) + ' UTC' : obs.timestamp}</span>
                      <span className="text-cyan-400">SAR Validated</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SAR processing pipeline */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">SAR Processing Pipeline</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { step: '1', title: 'Load SAR Imagery', desc: 'Sentinel-1 IW GRD product (VV + VH polarization)' },
              { step: '2', title: 'Preprocessing', desc: 'Radiometric calibration, terrain correction, speckle filtering' },
              { step: '3', title: 'Water Detection', desc: 'Backscatter thresholding: calm water = low σ⁰. Change detection vs. reference scene.' },
              { step: '4', title: 'Flood Mask', desc: 'Binary inundation map. Binning threshold on VV polarization.' },
              { step: '5', title: 'Zone Aggregation', desc: 'Spatial flood extent features per hydrological zone' },
            ].map((s) => (
              <div key={s.step} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {s.step}
                  </span>
                  <span className="text-xs font-semibold text-white">{s.title}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <span className="text-amber-400 font-semibold">Note:</span> NDWI is NOT used for SAR. NDWI/MNDWI are optical indices
              applicable to Landsat/MODIS imagery only. For Sentinel-1 SAR, water detection uses backscatter thresholding
              and change detection — SAR-specific methods that work through clouds and darkness.
            </p>
          </div>
        </div>

        {/* SAR correction loop */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">SAR Correction Loop — Model Recalibration</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.zones.slice(0, 6).map((zone) => {
              const obs = observations.find((o) => o.zoneId === zone.id);
              const sarObserved = obs ? obs.floodedFraction * 100 : zone.state.sarFloodExtent;
              const modelPredicted = zone.state.sarFloodExtent;
              const overlap = Math.min(modelPredicted, sarObserved);
              const falsePositive = Math.max(0, modelPredicted - sarObserved);
              const missedFlood = Math.max(0, sarObserved - modelPredicted);

              return (
                <div key={zone.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <p className="text-xs font-semibold text-white mb-2">{zone.name}</p>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Model Predicted</span>
                      <span className="font-mono text-cyan-300">{modelPredicted.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">SAR Observed</span>
                      <span className="font-mono text-green-300">{sarObserved.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Overlap</span>
                      <span className="font-mono text-white">{overlap.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">False Positive</span>
                      <span className="font-mono text-orange-300">{falsePositive.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Missed Flood</span>
                      <span className="font-mono text-red-300">{missedFlood.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-green-400 font-medium">
            Model corrected using latest SAR observation. Risk map updated where SAR shows deviation from prediction.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-200 text-right font-medium">{value}</span>
    </div>
  );
}
