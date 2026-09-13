'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Basin, Zone, FlowEdge, Sensor } from '@/types/flood';
import { Map as MapLibreMap, LngLatBounds, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  ArrowRight,
  ShieldAlert,
  Droplet,
  Mountain,
  Compass,
  Radio,
} from 'lucide-react';
import { SensorPopup } from './SensorPopup';

interface MapAreaProps {
  basin: Basin;
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  sensors?: Sensor[];
  selectedSensorId?: string | null;
  onSelectSensor?: (sensorId: string | null) => void;
  isLiveStreaming?: boolean;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#f43f5e', // rose-500
  warning: '#f59e0b', // amber-500
  watch: '#0284c7', // sky-600
  safe: '#10b981', // emerald-500
};

export const MapArea: React.FC<MapAreaProps> = ({
  basin,
  selectedZoneId,
  onSelectZone,
  sensors = [],
  selectedSensorId = null,
  onSelectSensor,
  isLiveStreaming = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<Zone | null>(null);
  const [showFlowVectors, setShowFlowVectors] = useState(true);
  const [showZoneLabels, setShowZoneLabels] = useState(true);
  const [showSensors, setShowSensors] = useState(true);

  // Convert Zones to GeoJSON FeatureCollection
  const buildZonesGeoJSON = useCallback(
    (currentSelectedId: string | null): GeoJSON.FeatureCollection => {
      return {
        type: 'FeatureCollection',
        features: basin.zones.map((zone) => {
          const isSelected = zone.id === currentSelectedId;
          const riskColor = RISK_COLORS[zone.riskLevel] || '#10b981';

          return {
            type: 'Feature',
            id: zone.id,
            geometry: {
              type: 'Polygon',
              coordinates: [zone.boundaryPolygon],
            },
            properties: {
              id: zone.id,
              name: zone.name,
              code: zone.code,
              elevation: zone.elevationMeters,
              area: zone.areaKm2,
              riskLevel: zone.riskLevel,
              waterLevel: zone.currentWaterLevelMeters,
              fillColor: riskColor,
              isSelected: isSelected,
            },
          };
        }),
      };
    },
    [basin.zones]
  );

  // Convert Flow Edges to GeoJSON FeatureCollection with smooth curved meanders
  const buildEdgesGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    const zoneLookup: Record<string, Zone> = {};
    basin.zones.forEach((z) => {
      zoneLookup[z.id] = z;
    });

    return {
      type: 'FeatureCollection',
      features: basin.edges
        .map((edge) => {
          const source = zoneLookup[edge.sourceZoneId];
          const target = zoneLookup[edge.targetZoneId];
          if (!source || !target) return null;

          // Generate slight hydrographic curve between source and target
          const [sx, sy] = source.coordinates;
          const [tx, ty] = target.coordinates;
          const midX = (sx + tx) / 2 + (sx > tx ? -0.012 : 0.015);
          const midY = (sy + ty) / 2;

          return {
            type: 'Feature',
            id: edge.id,
            geometry: {
              type: 'LineString',
              coordinates: [
                [sx, sy],
                [midX, midY],
                [tx, ty],
              ],
            },
            properties: {
              id: edge.id,
              sourceId: edge.sourceZoneId,
              targetId: edge.targetZoneId,
              discharge: edge.currentDischargeM3PerSec,
              capacity: edge.flowCapacityM3PerSec,
              transitTime: edge.transitTimeHours,
            },
          };
        })
        .filter(Boolean) as GeoJSON.Feature[],
    };
  }, [basin.zones, basin.edges]);

  // Convert Zone centers to GeoJSON points for labels
  const buildZoneCentersGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: basin.zones.map((zone) => ({
        type: 'Feature',
        id: `label-${zone.id}`,
        geometry: {
          type: 'Point',
          coordinates: zone.coordinates,
        },
        properties: {
          id: zone.id,
          name: zone.name,
          code: zone.code,
          elevation: `${zone.elevationMeters}m`,
          waterLevel: `${zone.currentWaterLevelMeters.toFixed(1)}m`,
        },
      })),
    };
  }, [basin.zones]);

  // Convert IoT Sensors to GeoJSON FeatureCollection
  const buildSensorsGeoJSON = useCallback(
    (currentSelectedSensorId: string | null): GeoJSON.FeatureCollection => {
      return {
        type: 'FeatureCollection',
        features: (sensors || []).map((sensor) => {
          const isSelected =
            sensor.id === currentSelectedSensorId ||
            sensor.sensorId === currentSelectedSensorId;

          let color = '#38bdf8'; // water_level: sky-400
          if (sensor.type === 'rainfall') color = '#0284c7'; // rainfall: deeper blue
          if (sensor.type === 'soil_moisture') color = '#10b981'; // soil: emerald-500

          return {
            type: 'Feature',
            id: sensor.id,
            geometry: {
              type: 'Point',
              coordinates: sensor.coordinates,
            },
            properties: {
              id: sensor.id,
              sensorId: sensor.sensorId,
              name: sensor.name,
              type: sensor.type,
              value: sensor.value,
              unit: sensor.unit,
              status: sensor.status,
              color: color,
              isSelected: isSelected,
            },
          };
        }),
      };
    },
    [sensors]
  );

  const activeSelectedSensor = useMemo(() => {
    if (!selectedSensorId || !sensors) return null;
    return (
      sensors.find(
        (s) => s.id === selectedSensorId || s.sensorId === selectedSensorId
      ) || null
    );
  }, [sensors, selectedSensorId]);

  const activeSensorParentZone = useMemo(() => {
    if (!activeSelectedSensor) return null;
    return (
      basin.zones.find((z) => z.id === activeSelectedSensor.zoneId) || null
    );
  }, [activeSelectedSensor, basin.zones]);

  // Fit map bounds to encompass all zones of the river basin
  const fitToBasin = useCallback(() => {
    if (!mapRef.current || basin.zones.length === 0) return;

    const bounds = new LngLatBounds();
    basin.zones.forEach((zone) => {
      zone.boundaryPolygon.forEach((coord) => {
        bounds.extend(coord as [number, number]);
      });
    });

    mapRef.current.fitBounds(bounds, {
      padding: 60,
      duration: 1200,
      maxZoom: 12,
    });
  }, [basin.zones]);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Esri World Dark Gray Canvas: clean, dark, high-contrast, free from watermarks
    const mapStyle: StyleSpecification = {
      version: 8,
      sources: {
        'esri-dark-base': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri &copy; OpenStreetMap contributors',
        },
        'esri-dark-labels': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri &copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'esri-dark-base-layer',
          type: 'raster',
          source: 'esri-dark-base',
          minzoom: 0,
          maxzoom: 20,
        },
        {
          id: 'esri-dark-labels-layer',
          type: 'raster',
          source: 'esri-dark-labels',
          minzoom: 0,
          maxzoom: 20,
          paint: {
            'raster-opacity': 0.7,
          },
        },
      ],
    };

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: mapStyle,
      center: basin.centerCoordinates,
      zoom: basin.defaultZoom,
      pitch: 15,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      // 1. Add Zone Polygons source
      map.addSource('zones-source', {
        type: 'geojson',
        data: buildZonesGeoJSON(selectedZoneId),
      });

      // 2. Add Flow Edges source
      map.addSource('edges-source', {
        type: 'geojson',
        data: buildEdgesGeoJSON(),
      });

      // 3. Add Zone Centers source for clean typography
      map.addSource('zone-centers-source', {
        type: 'geojson',
        data: buildZoneCentersGeoJSON(),
      });

      // Layer: Zone Fill
      map.addLayer({
        id: 'zones-fill-layer',
        type: 'fill',
        source: 'zones-source',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            0.65,
            0.32,
          ],
        },
      });

      // Layer: Zone Perimeter Outlines
      map.addLayer({
        id: 'zones-outline-layer',
        type: 'line',
        source: 'zones-source',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            '#38bdf8',
            ['get', 'fillColor'],
          ],
          'line-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            3.5,
            1.6,
          ],
          'line-opacity': 0.9,
        },
      });

      // Layer: Flow Edges Glow
      map.addLayer({
        id: 'edges-glow-layer',
        type: 'line',
        source: 'edges-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 5.5,
          'line-opacity': 0.35,
        },
      });

      // Layer: Flow Edges Animated Main Stream
      map.addLayer({
        id: 'edges-line-layer',
        type: 'line',
        source: 'edges-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.9,
        },
      });

      // Layer: Zone Center Markers (Water Level Pills)
      map.addLayer({
        id: 'zone-center-symbols',
        type: 'circle',
        source: 'zone-centers-source',
        paint: {
          'circle-radius': 5,
          'circle-color': '#0f172a',
          'circle-stroke-color': '#38bdf8',
          'circle-stroke-width': 1.5,
        },
      });

      // 4. Add IoT Sensors Source
      map.addSource('sensors-source', {
        type: 'geojson',
        data: buildSensorsGeoJSON(selectedSensorId || null),
      });

      // Layer: Sensor Outer Glow/Pulsing Ring
      map.addLayer({
        id: 'sensors-glow-layer',
        type: 'circle',
        source: 'sensors-source',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            12,
            7.5,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            0.6,
            0.28,
          ],
          'circle-stroke-width': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            2,
            0.9,
          ],
          'circle-stroke-color': ['get', 'color'],
        },
      });

      // Layer: Sensor Solid Center Marker
      map.addLayer({
        id: 'sensors-circle-layer',
        type: 'circle',
        source: 'sensors-source',
        paint: {
          'circle-radius': [
            'case',
            ['boolean', ['get', 'isSelected'], false],
            5.5,
            3.8,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#020617',
          'circle-stroke-width': 1.5,
        },
      });

      // Click IoT sensor handler
      map.on('click', 'sensors-circle-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const sensorId = feature.properties?.id || feature.properties?.sensorId;
          if (sensorId && onSelectSensor) {
            onSelectSensor(sensorId);
          }
        }
      });

      map.on('mouseenter', 'sensors-circle-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'sensors-circle-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Click zone polygon handler
      map.on('click', 'zones-fill-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const zoneId = feature.properties?.id;
          if (zoneId) {
            onSelectZone(zoneId);
          }
        }
      });

      // Hover zone polygon handler
      map.on('mousemove', 'zones-fill-layer', (e) => {
        if (e.features && e.features.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          const feature = e.features[0];
          const zoneId = feature.properties?.id;
          const found = basin.zones.find((z) => z.id === zoneId);
          setHoveredZone(found || null);
        }
      });

      map.on('mouseleave', 'zones-fill-layer', () => {
        map.getCanvas().style.cursor = '';
        setHoveredZone(null);
      });

      setMapLoaded(true);

      // Initial fit to basin
      const bounds = new LngLatBounds();
      basin.zones.forEach((zone) => {
        zone.boundaryPolygon.forEach((coord) => {
          bounds.extend(coord as [number, number]);
        });
      });
      map.fitBounds(bounds, { padding: 60, duration: 800 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    basin,
    buildZonesGeoJSON,
    buildEdgesGeoJSON,
    buildZoneCentersGeoJSON,
    buildSensorsGeoJSON,
    onSelectZone,
    onSelectSensor,
  ]);

  // Update selected zone highlight and risk colors dynamically without reloading the map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource('zones-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData(buildZonesGeoJSON(selectedZoneId));
    }
  }, [selectedZoneId, mapLoaded, buildZonesGeoJSON]);

  // Update edges source dynamically during simulation
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource('edges-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData(buildEdgesGeoJSON());
    }
  }, [buildEdgesGeoJSON, mapLoaded]);

  // Toggle flow vectors visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const visibility = showFlowVectors ? 'visible' : 'none';
    if (mapRef.current.getLayer('edges-line-layer')) {
      mapRef.current.setLayoutProperty('edges-line-layer', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('edges-glow-layer')) {
      mapRef.current.setLayoutProperty('edges-glow-layer', 'visibility', visibility);
    }
  }, [showFlowVectors, mapLoaded]);

  // Toggle zone labels visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const visibility = showZoneLabels ? 'visible' : 'none';
    if (mapRef.current.getLayer('zone-center-symbols')) {
      mapRef.current.setLayoutProperty('zone-center-symbols', 'visibility', visibility);
    }
  }, [showZoneLabels, mapLoaded]);

  // Update sensors source dynamically when telemetry stream ticks
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource('sensors-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData(buildSensorsGeoJSON(selectedSensorId || null));
    }
  }, [sensors, selectedSensorId, mapLoaded, buildSensorsGeoJSON]);

  // Toggle sensors layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const visibility = showSensors ? 'visible' : 'none';
    if (mapRef.current.getLayer('sensors-glow-layer')) {
      mapRef.current.setLayoutProperty('sensors-glow-layer', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('sensors-circle-layer')) {
      mapRef.current.setLayoutProperty('sensors-circle-layer', 'visibility', visibility);
    }
  }, [showSensors, mapLoaded]);

  return (
    <div className="relative flex-1 h-full w-full bg-slate-950 overflow-hidden select-none">
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Left Catchment Status Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-xl">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white">{basin.name}</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-mono text-[11px] font-semibold">
            {basin.zones.length} Hydrological Reaches [Demo]
          </span>
        </div>
      </div>

      {/* Top Right Map Controls (Zoom, Fit, Layers) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {/* Layer Switches */}
        <div className="p-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 space-y-1 shadow-xl text-xs min-w-[150px]">
          <div className="flex items-center gap-1.5 px-2 py-1 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Map Layers</span>
          </div>

          <button
            onClick={() => setShowFlowVectors(!showFlowVectors)}
            className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors ${
              showFlowVectors ? 'bg-cyan-950/60 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-[11px]">Flow Vectors</span>
            <span
              className={`w-2 h-2 rounded-full ${
                showFlowVectors ? 'bg-cyan-400' : 'bg-slate-700'
              }`}
            />
          </button>

          <button
            onClick={() => setShowZoneLabels(!showZoneLabels)}
            className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors ${
              showZoneLabels ? 'bg-cyan-950/60 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-[11px]">Zone Centers</span>
            <span
              className={`w-2 h-2 rounded-full ${
                showZoneLabels ? 'bg-cyan-400' : 'bg-slate-700'
              }`}
            />
          </button>

          <button
            onClick={() => setShowSensors(!showSensors)}
            className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors ${
              showSensors ? 'bg-cyan-950/60 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">IoT Sensors ({sensors.length})</span>
              {isLiveStreaming && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                showSensors ? 'bg-emerald-400' : 'bg-slate-700'
              }`}
            />
          </button>
        </div>

        {/* Zoom & Fit-to-Basin Toolbar */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 p-1 shadow-xl">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom In"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom Out"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />
          <button
            onClick={fitToBasin}
            title="Fit to Entire Basin"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors font-medium"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit Basin</span>
          </button>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredZone && (
        <div className="absolute top-16 left-4 z-10 p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 text-xs shadow-2xl space-y-1.5 pointer-events-none min-w-[210px]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
            <span className="font-bold text-white text-sm">{hoveredZone.name}</span>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${RISK_COLORS[hoveredZone.riskLevel]}25`,
                color: RISK_COLORS[hoveredZone.riskLevel],
                border: `1px solid ${RISK_COLORS[hoveredZone.riskLevel]}50`,
              }}
            >
              {hoveredZone.riskLevel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-0.5">
            <div>
              <span className="text-slate-500 block">Elevation:</span>
              <span className="font-mono text-slate-200">{hoveredZone.elevationMeters}m</span>
            </div>
            <div>
              <span className="text-slate-500 block">Area:</span>
              <span className="font-mono text-slate-200">{hoveredZone.areaKm2} km²</span>
            </div>
            <div>
              <span className="text-slate-500 block">Water Level:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {hoveredZone.currentWaterLevelMeters.toFixed(2)}m
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Rise Rate:</span>
              <span className="font-mono text-amber-300">
                +{(hoveredZone.currentState.waterLevelRiseRate ?? 0).toFixed(2)}m/h
              </span>
            </div>
          </div>

          {hoveredZone.currentState?.aiPrediction && (
            <div className="pt-1.5 border-t border-purple-500/20 flex items-center justify-between text-[10px] bg-purple-950/20 px-1.5 py-1 rounded">
              <span className="text-purple-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                AI Pred P(3h): {(hoveredZone.currentState.aiPrediction.probabilities.flood_probability_3h * 100).toFixed(0)}%
              </span>
              <span className="text-slate-400 font-mono">
                Conf: {(hoveredZone.currentState.aiPrediction.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}

          <span className="text-[10px] text-cyan-400/80 block pt-0.5 italic">
            Click zone to lock selection & inspect twin
          </span>
        </div>
      )}

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-4 left-4 z-10 p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-2xl text-xs space-y-2 min-w-[220px]">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider block border-b border-slate-800 pb-1">
          Hydrological Risk Legend
        </span>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500 border border-rose-400" />
            <span className="text-slate-300">Critical</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-400" />
            <span className="text-slate-300">Warning</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-600 border border-sky-400" />
            <span className="text-slate-300">Watch</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-400" />
            <span className="text-slate-300">Safe</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-slate-800/80 space-y-1 text-[10.5px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-cyan-400 border-b border-dashed border-cyan-200" />
            <span>Directed Flow Edge ({basin.edges.length} Channels)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full border border-cyan-400 bg-slate-900" />
            <span>Zone Ingress/Egress Node</span>
          </div>
          <div className="flex items-center gap-2 pt-0.5 border-t border-slate-900">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" title="Water Level" />
              <span className="w-2 h-2 rounded-full bg-blue-600" title="Precipitation" />
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Soil Moisture" />
            </div>
            <span>IoT Sensors (Stage / Rain / Soil)</span>
          </div>
        </div>
      </div>

      {/* Floating Interactive IoT Sensor Detail Card */}
      {activeSelectedSensor && (
        <SensorPopup
          sensor={activeSelectedSensor}
          zoneName={activeSensorParentZone?.name}
          zoneCode={activeSensorParentZone?.code}
          onClose={() => onSelectSensor && onSelectSensor(null)}
          onSelectParentZone={onSelectZone}
        />
      )}
    </div>
  );
};
