'use client';

import { dataSources, sentinel1Metadata } from '@/data/historical';
import { Database, Satellite, CloudRain, Mountain, Map as MapIcon, History } from 'lucide-react';
import type { DataSource } from '@/types';

const categoryIcons: Record<DataSource['category'], typeof Satellite> = {
  satellite: Satellite,
  rainfall: CloudRain,
  dem: Mountain,
  geospatial: MapIcon,
  historical: History,
};

const categoryColors: Record<DataSource['category'], string> = {
  satellite: 'text-cyan-400 bg-cyan-600/10',
  rainfall: 'text-blue-400 bg-blue-600/10',
  dem: 'text-amber-400 bg-amber-600/10',
  geospatial: 'text-green-400 bg-green-600/10',
  historical: 'text-purple-400 bg-purple-600/10',
};

export function DataSources() {
  const usedSources = dataSources.filter((d) => d.status === 'used');
  const potentialSources = dataSources.filter((d) => d.status === 'potential');

  return (
    <div className="overflow-y-auto h-full p-6 w-full">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Data Sources & Provenance</h2>
            <p className="text-sm text-slate-400">Full transparency on datasets used in this prototype</p>
          </div>
        </div>

        {/* Honesty banner */}
        <div className="p-4 rounded-xl bg-amber-600/10 border border-amber-600/30 shadow-md">
          <p className="text-xs text-amber-200 leading-relaxed">
            Datasets marked as <span className="font-bold">USED</span> are actively integrated into the model pipeline.
            Datasets marked as <span className="font-bold">POTENTIAL</span> are publicly available and architecturally
            supported, but not automatically downloaded in this prototype due to API/download restrictions.
            We do not claim to use datasets we do not actually access.
          </p>
        </div>

        {/* Sentinel-1 primary */}
        <div className="bg-slate-900 rounded-xl border border-cyan-600/30 p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center">
              <Satellite className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{sentinel1Metadata.dataset} — PRIMARY</h3>
              <p className="text-xs text-slate-400">{sentinel1Metadata.sensor}</p>
            </div>
            <span className="ml-auto px-2 py-1 rounded text-[10px] font-bold bg-green-600/20 text-green-400 border border-green-600/30">USED</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <MetaItem label="Provider" value="Copernicus / ESA" />
            <MetaItem label="Resolution" value={sentinel1Metadata.resolution} />
            <MetaItem label="Revisit" value={sentinel1Metadata.revisit} />
            <MetaItem label="Product" value={sentinel1Metadata.productType} />
            <MetaItem label="Mode" value={sentinel1Metadata.mode} />
            <MetaItem label="Polarization" value={sentinel1Metadata.polarization} />
            <MetaItem label="Temporal Coverage" value="Oct 2014 — present" />
            <MetaItem label="Role" value={sentinel1Metadata.primaryUse} />
          </div>
          <div className="mt-3 p-3 rounded-lg bg-slate-800">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-amber-400">Limitations:</span> {sentinel1Metadata.disclaimer}
              SAR backscatter thresholding can produce false positives over wind-roughened water, urban areas
              (double-bounce), and vegetation. VV polarization is preferred; VH used for cross-validation.
            </p>
          </div>
        </div>

        {/* Used datasets */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Datasets Actively Used in Model</h3>
          <div className="space-y-3">
            {usedSources.filter((d) => d.id !== 'sentinel1').map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </div>

        {/* Potential datasets */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Potential Supporting Datasets (Not Auto-Downloaded)</h3>
          <div className="space-y-3">
            {potentialSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </div>

        {/* Data classification */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Data Classification in This Prototype</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-white">REAL DATA</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Historical flood event records (Assam 2017, Assam 2020). Sentinel-1 product specifications and metadata.
                DEM specifications. Data source descriptions and limitations.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs font-semibold text-white">SIMULATED DATA</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                IoT sensor streams (river level, rainfall, soil moisture, flow, water depth). Real-time zone states.
                SAR flood extent values. All clearly labeled as &ldquo;Simulated IoT sensor stream&rdquo; in the UI.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-xs font-semibold text-white">MODEL PREDICTION</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Risk scores, predicted water levels, predicted flows, time-to-danger, confidence scores.
                Generated by the distributed hydrological model from inputs.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-xs font-semibold text-white">HISTORICAL OBSERVATION</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Published flood extent maps, discharge records, affected population figures from government and
                research sources. Used for validation only.
              </p>
            </div>
          </div>
        </div>

        {/* Ingestion interface note */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-2">Data Ingestion Interface</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            This prototype includes a clean data-ingestion interface for connecting real datasets. Expected formats:
          </p>
          <div className="mt-3 space-y-2 text-xs">
            <FormatRow format="Sentinel-1 SAR" schema="GeoTIFF (IW GRD, VV/VH bands) — Copernicus Open Access Hub / STAC API" />
            <FormatRow format="Rainfall (IMD)" schema="CSV/NetCDF: station_id, timestamp, rainfall_mm, lat, lon" />
            <FormatRow format="DEM (SRTM)" schema="GeoTIFF (1 arc-second elevation) — USGS EarthExplorer" />
            <FormatRow format="Bhuvan LULC" schema="Shapefile/GeoJSON — Bhuvan portal download" />
            <FormatRow format="Historical Floods" schema="GeoJSON: event_id, date, region, extent_polygon, affected_count" />
          </div>
          <p className="mt-3 text-[10px] text-slate-500 italic">
            A small sample is included for demonstration purposes only, clearly labeled as demo data.
            We do not pretend simulated data is live data.
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  const Icon = categoryIcons[source.category];
  const colorClass = categoryColors[source.category];

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-700 p-4 shadow ${source.status === 'potential' ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">{source.datasetName}</h4>
          <p className="text-[10px] text-slate-400">{source.provider}</p>
        </div>
        <span className={`ml-auto px-2 py-1 rounded text-[10px] font-bold ${source.status === 'used' ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-slate-700 text-slate-400'}`}>
          {source.status === 'used' ? 'USED' : 'POTENTIAL'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetaItem label="Resolution" value={source.resolution} />
        <MetaItem label="Revisit" value={source.revisit} />
        <MetaItem label="Temporal Coverage" value={source.temporalCoverage} />
        <MetaItem label="Category" value={source.category.toUpperCase()} />
      </div>
      <div className="mt-2 text-xs">
        <p className="text-slate-300 leading-tight"><span className="text-slate-400 font-semibold">Role: </span>{source.role}</p>
      </div>
      <div className="mt-1 text-xs">
        <p className="text-slate-400 leading-tight"><span className="text-slate-500 font-semibold">Limitations: </span>{source.limitations}</p>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}

function FormatRow({ format, schema }: { format: string; schema: string }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800">
      <span className="text-slate-300 font-medium w-36 flex-shrink-0">{format}</span>
      <span className="text-slate-400 font-mono text-[11px]">{schema}</span>
    </div>
  );
}
