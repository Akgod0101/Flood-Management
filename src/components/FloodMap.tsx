'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Zone, GraphEdge, SatelliteObservation } from '@/types';
import { riskColor, riskBgColor } from '@/lib/utils';
import { getAllInundationPolygons } from '@/data/inundationGeometries';

interface Props {
  zones: Zone[];
  edges: GraphEdge[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  fitToBasin?: boolean;
  showSatelliteLayer?: boolean;
  satelliteObservations?: Record<string, SatelliteObservation>;
}

function formatObsTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC';
    }
  } catch {}
  return ts.length > 16 ? ts.slice(11, 16) : ts;
}

/**
 * Draws a continuous thermal risk heat corridor across the Brahmaputra basin,
 * interpolating radial heat fields at zone centers and along river flow reaches.
 */
function drawRiskHeatmap(layer: L.LayerGroup, zones: Zone[], edges: GraphEdge[]) {
  // 1. Heat Corridor Propagation along River Reach Edges
  for (const edge of edges) {
    const fromZone = zones.find((z) => z.id === edge.from);
    const toZone = zones.find((z) => z.id === edge.to);
    if (!fromZone || !toZone) continue;

    const fromRisk = fromZone.state.riskScore;
    const toRisk = toZone.state.riskScore;

    // 3 intermediate interpolation points along river stretch
    for (const t of [0.25, 0.5, 0.75]) {
      const midLat = fromZone.center.lat + (toZone.center.lat - fromZone.center.lat) * t;
      const midLng = fromZone.center.lng + (toZone.center.lng - fromZone.center.lng) * t;
      const interRisk = fromRisk + (toRisk - fromRisk) * t;
      const c = riskColor(interRisk);

      L.circle([midLat, midLng], {
        radius: 20000,
        stroke: false,
        fillColor: c,
        fillOpacity: 0.22,
        className: 'heat-plume-blur',
      }).addTo(layer);

      L.circle([midLat, midLng], {
        radius: 36000,
        stroke: false,
        fillColor: c,
        fillOpacity: 0.08,
        className: 'heat-plume-blur',
      }).addTo(layer);
    }
  }

  // 2. Concentric Radial Thermal Fields for each Zone Center
  for (const zone of zones) {
    const risk = zone.state.riskScore;
    const c = riskColor(risk);

    // Inner high-intensity thermal core
    L.circle([zone.center.lat, zone.center.lng], {
      radius: 12000,
      stroke: false,
      fillColor: c,
      fillOpacity: 0.42,
      className: 'heat-plume-blur',
    }).addTo(layer);

    // Mid thermal radiation zone
    L.circle([zone.center.lat, zone.center.lng], {
      radius: 25000,
      stroke: false,
      fillColor: c,
      fillOpacity: 0.24,
      className: 'heat-plume-blur',
    }).addTo(layer);

    // Outer thermal dissipation
    L.circle([zone.center.lat, zone.center.lng], {
      radius: 42000,
      stroke: false,
      fillColor: c,
      fillOpacity: 0.12,
      className: 'heat-plume-blur',
    }).addTo(layer);

    // Ambient regional plume
    L.circle([zone.center.lat, zone.center.lng], {
      radius: 66000,
      stroke: false,
      fillColor: c,
      fillOpacity: 0.05,
      className: 'heat-plume-blur',
    }).addTo(layer);

    // Animated warning isopleth pulse ring for elevated risk zones (>= 45)
    if (risk >= 45) {
      L.circle([zone.center.lat, zone.center.lng], {
        radius: 28000,
        color: c,
        weight: 1.5,
        opacity: 0.6,
        dashArray: '4 4',
        fill: false,
        className: 'heat-isopleth-pulse',
      }).addTo(layer);
    }
  }
}

export function FloodMap({
  zones,
  edges,
  selectedZoneId,
  onSelectZone,
  fitToBasin,
  showSatelliteLayer = false,
  satelliteObservations = {},
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const baseTileRef = useRef<L.LayerGroup | null>(null);
  const [basemap, setBasemap] = useState<'heatmap' | 'shaded' | 'dark' | 'satellite'>('heatmap');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [26.9, 92.8],
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
    });

    baseTileRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      baseTileRef.current = null;
    };
  }, []);

  // Update base tiles whenever basemap selection changes (clean, non-watermarked tiles)
  useEffect(() => {
    const map = mapRef.current;
    const baseGroup = baseTileRef.current;
    if (!map || !baseGroup) return;

    baseGroup.clearLayers();

    if (basemap === 'satellite') {
      // Esri World Imagery (satellite photography)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
          maxZoom: 18,
        },
      ).addTo(baseGroup);

      // Boundaries & place labels
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 18,
        },
      ).addTo(baseGroup);
    } else if (basemap === 'shaded') {
      // Esri World Shaded Relief Terrain (matches reference image with hillshading)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS',
          maxZoom: 13,
        },
      ).addTo(baseGroup);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 18,
          opacity: 0.85,
        },
      ).addTo(baseGroup);
    } else {
      // Esri World Dark Gray Base (clean dark canvas, no watermarks, no API keys needed)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        },
      ).addTo(baseGroup);

      // Labels and transport lines
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 16,
        },
      ).addTo(baseGroup);
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 0. Draw Thermal Flood Risk Heatmap across the basin when in heatmap or shaded mode
    if (basemap === 'heatmap' || basemap === 'shaded') {
      drawRiskHeatmap(layer, zones, edges);
    }


    // 1. Draw dynamic SAR inundation polygons & water body masks when Satellite Layer is active
    if (showSatelliteLayer && Object.keys(satelliteObservations).length > 0) {
      const inundationPolygons = getAllInundationPolygons(satelliteObservations);

      for (const inun of inundationPolygons) {
        const isPermanent = inun.type === 'permanent_channel';
        const isFlood = inun.type === 'flood_inundation';

        const strokeColor = isPermanent ? '#0284c7' : isFlood ? '#06b6d4' : '#38bdf8';
        const fillColor = isPermanent ? '#0369a1' : isFlood ? '#0284c7' : '#0891b2';
        const fillOpacity = isPermanent ? 0.85 : isFlood ? 0.68 : 0.48;
        const weight = isPermanent ? 2 : isFlood ? 2.5 : 1.5;
        const dashArray = isFlood ? '5 3' : isPermanent ? undefined : '3 3';
        const className = isFlood ? 'sar-flood-polygon sar-radar-stroke' : isPermanent ? 'sar-channel-polygon' : '';

        const inunPoly = L.polygon(
          inun.coordinates.map((p) => [p.lat, p.lng]),
          {
            color: strokeColor,
            weight,
            dashArray,
            fillColor,
            fillOpacity,
            className,
          }
        );

        inunPoly.on('click', () => onSelectZone(inun.zoneId));

        const inunTooltip = `
          <div style="font-family: monospace; font-size: 11px; padding: 2px;">
            <div style="font-weight: bold; color: ${strokeColor};">${inun.label}</div>
            <div>Water Area: <b>${inun.areaKm2} km²</b> · Est. Depth: ~${inun.avgDepthM}m</div>
            <div style="font-size: 9px; color: #94a3b8;">SAR Backscatter σ⁰: ${inun.backscatterDb} dB · Otsu Threshold</div>
          </div>
        `;

        inunPoly.bindTooltip(inunTooltip, {
          permanent: false,
          direction: 'top',
          className: 'leaflet-tooltip',
        });

        // Inundation popup
        const inunPopupHtml = `
          <div style="min-width: 220px; font-family: sans-serif;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 14px;">🛰️</span>
              <span style="font-weight: bold; color: #38bdf8; font-size: 13px;">${inun.label}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Copernicus Sentinel-1A SAR Inundation Mask</div>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 11px;">
              <span style="color: #94a3b8;">Water Area</span>
              <span style="font-weight: bold; color: #38bdf8; font-family: monospace;">${inun.areaKm2} km²</span>
              <span style="color: #94a3b8;">Stage / Depth</span>
              <span style="color: #e2e8f0; font-family: monospace;">~${inun.avgDepthM} m</span>
              <span style="color: #94a3b8;">Radar Backscatter</span>
              <span style="color: #e2e8f0; font-family: monospace;">${inun.backscatterDb} dB</span>
              <span style="color: #94a3b8;">Hydrological Type</span>
              <span style="color: #34d399; font-family: monospace;">${inun.type.replace('_', ' ').toUpperCase()}</span>
              <span style="color: #94a3b8;">Classification Confidence</span>
              <span style="color: #34d399; font-family: monospace;">${(inun.confidence * 100).toFixed(0)}%</span>
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: #64748b;">Click zone marker for full telemetry</div>
          </div>
        `;
        inunPoly.bindPopup(inunPopupHtml);

        inunPoly.addTo(layer);
      }
    }

    // 2. Draw edges (upstream → downstream arrows)
    for (const edge of edges) {
      const fromZone = zones.find((z) => z.id === edge.from);
      const toZone = zones.find((z) => z.id === edge.to);
      if (!fromZone || !toZone) continue;

      const flowColor = edge.predictedFlow > 8000 ? '#dc2626' : edge.predictedFlow > 5000 ? '#ea580c' : '#0ea5e9';
      const line = L.polyline(
        [
          [fromZone.center.lat, fromZone.center.lng],
          [toZone.center.lat, toZone.center.lng],
        ],
        {
          color: flowColor,
          weight: Math.max(2, Math.min(8, edge.predictedFlow / 1500)),
          opacity: 0.7,
          dashArray: '6 4',
          className: 'flow-arrow',
        },
      );
      line.addTo(layer);

      // Arrow midpoint label
      const midLat = (fromZone.center.lat + toZone.center.lat) / 2;
      const midLng = (fromZone.center.lng + toZone.center.lng) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:rgba(30,41,59,0.9);padding:2px 6px;border-radius:4px;font-size:10px;color:${flowColor};border:1px solid ${flowColor};white-space:nowrap;font-family:monospace;font-weight:bold;">${edge.predictedFlow} m³/s</div>`,
          iconSize: [64, 16],
          iconAnchor: [32, 8],
        }),
      }).addTo(layer);
    }

    // 3. Draw zone polygons
    for (const zone of zones) {
      const risk = zone.state.riskScore;
      const color = riskColor(risk);
      const obs = showSatelliteLayer ? satelliteObservations[zone.id] : undefined;

      // When satellite layer is enabled, styling emphasizes radar water extent and transparent zone backdrop
      const strokeColor = showSatelliteLayer ? '#06b6d4' : color;
      const fillColor = basemap === 'heatmap'
        ? riskBgColor(risk, 0.22)
        : showSatelliteLayer ? '#0f172a' : riskBgColor(risk, 0.35);
      const fillOpacity = basemap === 'heatmap' ? 0.35 : (showSatelliteLayer ? 0.22 : 0.5);

      const polygon = L.polygon(
        zone.polygon.map((p) => [p.lat, p.lng]),
        {
          color: strokeColor,
          weight: selectedZoneId === zone.id ? 3 : (showSatelliteLayer ? 2 : 1.5),
          dashArray: showSatelliteLayer ? '6 3' : undefined,
          fillColor,
          fillOpacity,
        },
      );

      polygon.on('click', () => onSelectZone(zone.id));

      // Zone center marker with risk badge
      const alertIcon = zone.state.alertLevel === 'DANGER' || zone.state.alertLevel === 'WARNING' ? '!' : '';
      const iconHtml = `
        <div style="position:relative;cursor:pointer;">
          <div style="
            width:32px;height:32px;border-radius:50%;
            background:${color};border:2px solid ${selectedZoneId === zone.id ? '#fff' : 'rgba(0,0,0,0.3)'};
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:bold;color:#fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
          ">${risk}${alertIcon}</div>
          ${zone.state.alertLevel !== 'NORMAL' ? `<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:${color};border:1px solid #fff;" class="pulse-dot"></div>` : ''}
        </div>
      `;

      const marker = L.marker([zone.center.lat, zone.center.lng], {
        icon: L.divIcon({
          className: '',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      });

      marker.on('click', () => onSelectZone(zone.id));

      // Satellite Observation HUD badge on zone when satellite layer is enabled
      if (showSatelliteLayer && obs) {
        const changeSign = obs.surfaceWaterChange >= 0 ? '+' : '';
        const changeColor = obs.surfaceWaterChange >= 0 ? '#fb923c' : '#34d399';
        const dateStr = formatObsTimestamp(obs.timestamp);

        const satBadgeHtml = `
          <div style="
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid #06b6d4;
            border-radius: 6px;
            padding: 3px 6px;
            box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            line-height: 1.25;
            white-space: nowrap;
            cursor: pointer;
            backdrop-filter: blur(4px);
          ">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; font-weight: bold; color: #38bdf8;">
              <span>🛰️ Extent:</span>
              <span style="color: #67e8f9;">${(obs.floodedFraction * 100).toFixed(1)}%</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 9px;">
              <span style="color: #94a3b8;">Surface Δ:</span>
              <span style="font-weight: 600; color: ${changeColor};">${changeSign}${(obs.surfaceWaterChange * 100).toFixed(1)}%</span>
            </div>
            <div style="font-size: 8px; color: #64748b; margin-top: 1px; border-top: 1px solid #334155; padding-top: 1px;">
              🕒 ${dateStr}
            </div>
          </div>
        `;

        const satMarker = L.marker([zone.center.lat - 0.075, zone.center.lng], {
          icon: L.divIcon({
            className: 'satellite-hud-marker',
            html: satBadgeHtml,
            iconSize: [116, 50],
            iconAnchor: [58, 0],
          }),
        });
        satMarker.on('click', () => onSelectZone(zone.id));
        satMarker.addTo(layer);
      }

      // Popup
      const satSection = obs ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #334155;">
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:4px;">
            <span>🛰️ SATELLITE SAR OBSERVATION</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:3px 8px;font-size:11px;">
            <span style="color:#94a3b8;">Water Extent:</span>
            <span style="font-weight:bold;color:#38bdf8;font-family:monospace;">${(obs.floodedFraction * 100).toFixed(1)}%</span>
            <span style="color:#94a3b8;">Surface Change:</span>
            <span style="font-weight:bold;color:${obs.surfaceWaterChange >= 0 ? '#fb923c' : '#34d399'};font-family:monospace;">
              ${obs.surfaceWaterChange >= 0 ? '+' : ''}${(obs.surfaceWaterChange * 100).toFixed(1)}%
            </span>
            <span style="color:#94a3b8;">Observation Time:</span>
            <span style="color:#e2e8f0;font-family:monospace;font-size:10px;">${obs.timestamp}</span>
            <span style="color:#94a3b8;">Soil Moisture:</span>
            <span style="color:#e2e8f0;font-family:monospace;">${obs.soilMoisture}%</span>
            <span style="color:#94a3b8;">Rainfall Estimate:</span>
            <span style="color:#e2e8f0;font-family:monospace;">${obs.rainfallEstimate} mm</span>
            <span style="color:#94a3b8;">Sensor Source:</span>
            <span style="color:#94a3b8;font-size:10px;">${obs.source}</span>
            <span style="color:#94a3b8;">Confidence:</span>
            <span style="color:#34d399;font-family:monospace;">${(obs.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      ` : '';

      const popupHtml = `
        <div style="min-width:220px;font-family:sans-serif;">
          <div style="font-weight:bold;font-size:14px;margin-bottom:4px;color:#e2e8f0;">${zone.name}</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">${zone.type.toUpperCase()} · ${zone.state.alertLevel}</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:4px 12px;font-size:12px;">
            <span style="color:#94a3b8;">Risk Score</span><span style="font-weight:bold;color:${color};font-family:monospace;">${risk}/100</span>
            <span style="color:#94a3b8;">River Level</span><span style="color:#e2e8f0;font-family:monospace;">${zone.state.riverLevel.toFixed(1)} m</span>
            <span style="color:#94a3b8;">Rainfall</span><span style="color:#e2e8f0;font-family:monospace;">${zone.state.rainfallIntensity.toFixed(1)} mm/h</span>
            <span style="color:#94a3b8;">Soil Moisture</span><span style="color:#e2e8f0;font-family:monospace;">${zone.state.soilMoisture.toFixed(0)}%</span>
            <span style="color:#94a3b8;">Upstream Inflow</span><span style="color:#e2e8f0;font-family:monospace;">${zone.state.upstreamInflow} m³/s</span>
            <span style="color:#94a3b8;">Confidence</span><span style="color:#e2e8f0;font-family:monospace;">${zone.state.confidence}%</span>
            <span style="color:#94a3b8;">Time to Danger</span><span style="color:${zone.state.timeToDanger < 99 ? '#dc2626' : '#94a3b8'};font-family:monospace;">${zone.state.timeToDanger < 99 ? zone.state.timeToDanger + 'h' : '—'}</span>
          </div>
          ${satSection}
          <div style="margin-top:8px;font-size:10px;color:#64748b;">Click for full details</div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      polygon.bindPopup(popupHtml);

      polygon.addTo(layer);
      marker.addTo(layer);

      // Simulated sensor dots
      for (let i = 0; i < zone.sensors.length; i++) {
        const sensor = zone.sensors[i];
        const angle = (i / zone.sensors.length) * Math.PI * 2;
        const offsetLat = Math.cos(angle) * 0.015;
        const offsetLng = Math.sin(angle) * 0.015;
        const sensorColor = sensor.status === 'critical' ? '#dc2626' : sensor.status === 'warning' ? '#eab308' : '#06b6d4';

        L.circleMarker([zone.center.lat + offsetLat, zone.center.lng + offsetLng], {
          radius: 3,
          color: sensorColor,
          fillColor: sensorColor,
          fillOpacity: 0.8,
          weight: 1,
        })
          .bindTooltip(`${sensor.label}: ${sensor.value}${sensor.unit}`, {
            permanent: false,
            direction: 'top',
            className: 'leaflet-tooltip',
          })
          .addTo(layer);
      }
    }

    if (fitToBasin && zones.length > 0) {
      const bounds = L.latLngBounds(zones.flatMap((z) => z.polygon.map((p) => [p.lat, p.lng] as [number, number])));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [zones, edges, selectedZoneId, onSelectZone, fitToBasin, showSatelliteLayer, satelliteObservations, basemap]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={containerRef} className="w-full h-full min-h-[400px]" />

      {/* Floating Basemap Switcher (Heatmap vs Clean Dark vs High-Res Satellite) */}
      <div className="absolute top-3 left-14 z-[1000] flex items-center bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-700 p-1 shadow-xl text-xs gap-1">
        <button
          onClick={() => setBasemap('heatmap')}
          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            basemap === 'heatmap'
              ? 'bg-gradient-to-r from-amber-500 to-red-600 text-white shadow-md shadow-orange-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Switch to Regional Risk Heatmap"
        >
          <span>🔥</span>
          <span>Risk Heatmap</span>
        </button>
        <button
          onClick={() => setBasemap('shaded')}
          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            basemap === 'shaded'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Switch to Shaded Relief Terrain with Risk Overlay"
        >
          <span>🏔️</span>
          <span>Shaded Relief</span>
        </button>
        <button
          onClick={() => setBasemap('dark')}
          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            basemap === 'dark'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Switch to Minimalist Clean Dark Canvas"
        >
          <span>🗺️</span>
          <span>Dark Canvas</span>
        </button>
        <button
          onClick={() => setBasemap('satellite')}
          className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            basemap === 'satellite'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Switch to Real Satellite Imagery"
        >
          <span>🛰️</span>
          <span>Satellite Photo</span>
        </button>
      </div>

    </div>
  );
}

