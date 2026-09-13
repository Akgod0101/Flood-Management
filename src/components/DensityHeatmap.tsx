'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number; // 0.0 to 1.0
  label: string;
  zoneId: string;
  metricLabel: string;
  metricValue: string;
  elevation?: number;
}

interface Props {
  points: HeatmapPoint[];
  basemap?: 'shaded' | 'topo' | 'dark' | 'satellite';
  radius?: number; // pixel radius of each heat plume (e.g. 35 to 80)
  opacity?: number; // global alpha opacity (e.g. 0.4 to 1.0)
  blur?: number; // gradient falloff ratio (0.5 to 0.95)
  showLabels?: boolean;
  onSelectPoint?: (zoneId: string) => void;
  focusPoint?: { lat: number; lng: number } | null;
}

/**
 * Precomputes a 256-color thermal gradient lookup table (LUT)
 * exactly matching the authentic density heat map in the user's reference image:
 * Transparent -> Sky Blue/Cyan Halo -> Vibrant Blue Rim -> Golden Yellow -> Fiery Orange -> Saturated Crimson Red Core.
 */
function createThermalPalette(): Uint8ClampedArray | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.08, 'rgba(56, 189, 248, 0)');       // fade in
  grad.addColorStop(0.18, 'rgba(56, 189, 248, 0.60)');    // distinct sky blue/cyan ambient halo
  grad.addColorStop(0.32, 'rgba(14, 165, 233, 0.80)');    // transition blue rim
  grad.addColorStop(0.48, 'rgba(234, 179, 8, 0.90)');     // golden yellow
  grad.addColorStop(0.66, 'rgba(249, 115, 22, 0.96)');    // fiery orange
  grad.addColorStop(0.82, 'rgba(220, 38, 38, 0.98)');     // intense crimson red
  grad.addColorStop(1.00, 'rgba(185, 28, 28, 1.0)');      // deep thermal core

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

/**
 * Creates an offscreen radial brush disc with Gaussian-like falloff
 */
function createRadialBrush(r: number, blurFactor: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const d = r * 2;
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  grad.addColorStop(Math.min(0.95, Math.max(0.2, blurFactor)), 'rgba(0, 0, 0, 0.5)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

export function DensityHeatmap({
  points,
  basemap = 'shaded',
  radius = 52,
  opacity = 0.88,
  blur = 0.82,
  showLabels = true,
  onSelectPoint,
  focusPoint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.LayerGroup | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const paletteRef = useRef<Uint8ClampedArray | null>(null);

  // Initialize Leaflet map and base layers
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Center on the Brahmaputra Valley (Guwahati -> Dibrugarh), matching user's image
    const map = L.map(containerRef.current, {
      center: [26.85, 93.35],
      zoom: 8,
      zoomControl: true,
      attributionControl: true,
      minZoom: 6,
      maxZoom: 14,
    });

    // Distance Scale Bar in bottom-left corner (50 km / 30 mi like in user image)
    L.control.scale({ imperial: true, metric: true, position: 'bottomleft' }).addTo(map);

    baseTileRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    paletteRef.current = createThermalPalette();

    const resizeTimer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      baseTileRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Update base tiles whenever basemap prop changes
  useEffect(() => {
    const map = mapRef.current;
    const baseGroup = baseTileRef.current;
    if (!map || !baseGroup) return;

    baseGroup.clearLayers();

    if (basemap === 'shaded') {
      // 1. Esri World Shaded Relief Terrain (authentic match to reference image with relief shading)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS',
          maxZoom: 13,
        },
      ).addTo(baseGroup);

      // Boundaries, place names, city labels and elevation text
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 18,
          opacity: 0.9,
        },
      ).addTo(baseGroup);
    } else if (basemap === 'topo') {
      // 2. Esri World Topographic Map (detailed contours and hydrography)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, USGS, NPS',
          maxZoom: 18,
        },
      ).addTo(baseGroup);
    } else if (basemap === 'satellite') {
      // 3. Esri World Imagery (satellite photography)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
          maxZoom: 18,
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
      // 4. Esri World Dark Gray Base
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        },
      ).addTo(baseGroup);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '',
          maxZoom: 16,
        },
      ).addTo(baseGroup);
    }
  }, [basemap]);

  // Focus point pan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.panTo([focusPoint.lat, focusPoint.lng], { animate: true, duration: 0.8 });
  }, [focusPoint]);

  // Render Canvas Gaussian Heatmap and Interactive Labels
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !canvas || !markersGroup) return;

    // Redraw function executed on map movement, zoom, and prop updates
    const drawHeatmap = () => {
      const size = map.getSize();
      if (size.x <= 0 || size.y <= 0) return;

      canvas.width = size.x;
      canvas.height = size.y;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (!paletteRef.current) {
        paletteRef.current = createThermalPalette();
      }
      const palette = paletteRef.current;
      if (!palette) return;

      ctx.clearRect(0, 0, size.x, size.y);

      // Create pre-rendered radial brush
      const brush = createRadialBrush(radius, blur);

      // 1. Draw grayscale alpha stamp for each heat point
      // Overlapping points accumulate intensity via additive alpha blending
      for (const pt of points) {
        const pixel = map.latLngToContainerPoint([pt.lat, pt.lng]);
        const alpha = Math.min(1.0, Math.max(0.12, pt.intensity));

        ctx.globalAlpha = alpha;
        ctx.drawImage(brush, pixel.x - radius, pixel.y - radius);
      }

      // 2. Colorize alpha channel using the thermal gradient palette
      const imgData = ctx.getImageData(0, 0, size.x, size.y);
      const data = imgData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;

        // Multiply by 4 because each entry in palette is [R, G, B, A]
        const pIdx = a * 4;
        data[i] = palette[pIdx];         // Red
        data[i + 1] = palette[pIdx + 1]; // Green
        data[i + 2] = palette[pIdx + 2]; // Blue
        // Apply global user opacity to final alpha
        data[i + 3] = Math.round(a * opacity);
      }

      ctx.putImageData(imgData, 0, 0);
    };

    // Draw interactive station markers & tooltips
    markersGroup.clearLayers();

    for (const pt of points) {
      // Invisible hover circle for click and tooltip
      const hitCircle = L.circleMarker([pt.lat, pt.lng], {
        radius: Math.max(16, radius * 0.4),
        fillColor: 'transparent',
        color: 'transparent',
        weight: 1,
      });

      hitCircle.bindTooltip(
        `
        <div style="font-family: sans-serif; min-width: 140px; padding: 2px;">
          <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${pt.label}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            ${pt.metricLabel}: <b style="color: #dc2626;">${pt.metricValue}</b>
          </div>
          <div style="font-size: 10px; color: #64748b;">
            Intensity: ${(pt.intensity * 100).toFixed(0)}% · Lat: ${pt.lat.toFixed(2)}, Lng: ${pt.lng.toFixed(2)}
          </div>
        </div>
        `,
        { direction: 'top', className: 'leaflet-tooltip-dark' },
      );

      if (onSelectPoint) {
        hitCircle.on('click', () => onSelectPoint(pt.zoneId));
      }

      hitCircle.addTo(markersGroup);

      // Station Label Pills (matching the place names in the user's photo)
      if (showLabels) {
        const labelHtml = `
          <div style="
            background: rgba(15, 23, 42, 0.88);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
            color: #ffffff;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${pt.label}
          </div>
        `;

        const labelMarker = L.marker([pt.lat - 0.05, pt.lng], {
          icon: L.divIcon({
            className: '',
            html: labelHtml,
            iconSize: [80, 20],
            iconAnchor: [40, 0],
          }),
        });

        if (onSelectPoint) {
          labelMarker.on('click', () => onSelectPoint(pt.zoneId));
        }

        labelMarker.addTo(markersGroup);
      }
    }

    drawHeatmap();

    // Re-draw canvas whenever map moves or zooms
    map.on('move', drawHeatmap);
    map.on('moveend', drawHeatmap);
    map.on('zoomend', drawHeatmap);
    map.on('resize', drawHeatmap);

    return () => {
      map.off('move', drawHeatmap);
      map.off('moveend', drawHeatmap);
      map.off('zoomend', drawHeatmap);
      map.off('resize', drawHeatmap);
    };
  }, [points, radius, opacity, blur, showLabels, onSelectPoint]);

  return (
    <div className="relative w-full h-full min-h-[450px]">
      {/* Leaflet Map DOM Container */}
      <div ref={containerRef} className="w-full h-full min-h-[450px]" />

      {/* Synchronized Gaussian Density Heatmap Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-[400] transition-opacity duration-200"
      />
    </div>
  );
}
