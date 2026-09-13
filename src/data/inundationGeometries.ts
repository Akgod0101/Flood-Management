import type { GeoPoint, InundationPolygon, SatelliteObservation } from '@/types';

interface ZoneChannelBase {
  zoneId: string;
  name: string;
  permanentChannel: GeoPoint[];
  expansionCenters: { center: GeoPoint; maxRadiusKm: number; weight: number }[];
  baseAreaKm2: number;
}

/**
 * Baseline Brahmaputra River Channel & Floodplain Templates
 * Follows real-world river corridor coordinates through Assam.
 */
const zoneChannelBases: Record<string, ZoneChannelBase> = {
  z1: {
    zoneId: 'z1',
    name: 'Pasighat Headwater Reach',
    permanentChannel: [
      { lat: 28.11, lng: 95.36 },
      { lat: 28.09, lng: 95.34 },
      { lat: 28.06, lng: 95.32 },
      { lat: 28.03, lng: 95.30 },
      { lat: 28.01, lng: 95.28 },
      { lat: 28.02, lng: 95.27 },
      { lat: 28.05, lng: 95.29 },
      { lat: 28.08, lng: 95.31 },
      { lat: 28.11, lng: 95.34 },
    ],
    expansionCenters: [
      { center: { lat: 28.05, lng: 95.31 }, maxRadiusKm: 6.0, weight: 1.0 },
      { center: { lat: 28.09, lng: 95.35 }, maxRadiusKm: 4.5, weight: 0.7 },
    ],
    baseAreaKm2: 42.5,
  },
  z2: {
    zoneId: 'z2',
    name: 'Dibrugarh Braided Corridor',
    permanentChannel: [
      { lat: 27.53, lng: 94.98 },
      { lat: 27.50, lng: 94.94 },
      { lat: 27.46, lng: 94.89 },
      { lat: 27.42, lng: 94.84 },
      { lat: 27.40, lng: 94.82 },
      { lat: 27.42, lng: 94.81 },
      { lat: 27.45, lng: 94.85 },
      { lat: 27.49, lng: 94.90 },
      { lat: 27.53, lng: 94.95 },
    ],
    expansionCenters: [
      { center: { lat: 27.48, lng: 94.92 }, maxRadiusKm: 12.0, weight: 1.2 },
      { center: { lat: 27.43, lng: 94.86 }, maxRadiusKm: 9.5, weight: 0.9 },
    ],
    baseAreaKm2: 85.0,
  },
  z3: {
    zoneId: 'z3',
    name: 'Jorhat / Majuli Wetland Inundation',
    permanentChannel: [
      { lat: 26.80, lng: 94.30 },
      { lat: 26.77, lng: 94.24 },
      { lat: 26.74, lng: 94.18 },
      { lat: 26.70, lng: 94.12 },
      { lat: 26.68, lng: 94.10 },
      { lat: 26.70, lng: 94.09 },
      { lat: 26.73, lng: 94.14 },
      { lat: 26.77, lng: 94.20 },
      { lat: 26.80, lng: 94.26 },
    ],
    expansionCenters: [
      { center: { lat: 26.76, lng: 94.22 }, maxRadiusKm: 15.0, weight: 1.4 },
      { center: { lat: 26.71, lng: 94.15 }, maxRadiusKm: 11.0, weight: 1.1 },
    ],
    baseAreaKm2: 124.0,
  },
  z4: {
    zoneId: 'z4',
    name: 'Tezpur Braided Reach',
    permanentChannel: [
      { lat: 26.68, lng: 92.88 },
      { lat: 26.65, lng: 92.82 },
      { lat: 26.62, lng: 92.76 },
      { lat: 26.58, lng: 92.71 },
      { lat: 26.56, lng: 92.70 },
      { lat: 26.58, lng: 92.69 },
      { lat: 26.61, lng: 92.74 },
      { lat: 26.64, lng: 92.80 },
      { lat: 26.68, lng: 92.85 },
    ],
    expansionCenters: [
      { center: { lat: 26.63, lng: 92.79 }, maxRadiusKm: 13.5, weight: 1.1 },
      { center: { lat: 26.59, lng: 92.73 }, maxRadiusKm: 10.0, weight: 0.8 },
    ],
    baseAreaKm2: 110.0,
  },
  z5: {
    zoneId: 'z5',
    name: 'Nagaon / Kapili Lowland Floodplain',
    permanentChannel: [
      { lat: 26.50, lng: 92.78 },
      { lat: 26.47, lng: 92.73 },
      { lat: 26.44, lng: 92.68 },
      { lat: 26.40, lng: 92.62 },
      { lat: 26.38, lng: 92.59 },
      { lat: 26.40, lng: 92.58 },
      { lat: 26.43, lng: 92.64 },
      { lat: 26.47, lng: 92.70 },
      { lat: 26.50, lng: 92.75 },
    ],
    expansionCenters: [
      { center: { lat: 26.45, lng: 92.69 }, maxRadiusKm: 18.0, weight: 1.5 },
      { center: { lat: 26.41, lng: 92.63 }, maxRadiusKm: 14.0, weight: 1.3 },
    ],
    baseAreaKm2: 165.0,
  },
  z6: {
    zoneId: 'z6',
    name: 'Guwahati Urban Reach & Tributaries',
    permanentChannel: [
      { lat: 26.25, lng: 91.85 },
      { lat: 26.22, lng: 91.79 },
      { lat: 26.19, lng: 91.73 },
      { lat: 26.14, lng: 91.66 },
      { lat: 26.11, lng: 91.63 },
      { lat: 26.13, lng: 91.62 },
      { lat: 26.17, lng: 91.69 },
      { lat: 26.21, lng: 91.76 },
      { lat: 26.25, lng: 91.82 },
    ],
    expansionCenters: [
      { center: { lat: 26.19, lng: 91.74 }, maxRadiusKm: 16.0, weight: 1.3 },
      { center: { lat: 26.15, lng: 91.67 }, maxRadiusKm: 12.0, weight: 1.0 },
    ],
    baseAreaKm2: 195.0,
  },
  z7: {
    zoneId: 'z7',
    name: 'Goalpara Outflow & Wetland Basin',
    permanentChannel: [
      { lat: 26.23, lng: 90.75 },
      { lat: 26.19, lng: 90.68 },
      { lat: 26.15, lng: 90.61 },
      { lat: 26.10, lng: 90.54 },
      { lat: 26.08, lng: 90.51 },
      { lat: 26.10, lng: 90.50 },
      { lat: 26.14, lng: 90.57 },
      { lat: 26.18, lng: 90.65 },
      { lat: 26.23, lng: 90.72 },
    ],
    expansionCenters: [
      { center: { lat: 26.16, lng: 90.62 }, maxRadiusKm: 22.0, weight: 1.6 },
      { center: { lat: 26.11, lng: 90.54 }, maxRadiusKm: 15.0, weight: 1.2 },
    ],
    baseAreaKm2: 240.0,
  },
};

/**
 * Expands a polygon outward from a center point by a scaling factor.
 */
function expandPolygon(coords: GeoPoint[], center: GeoPoint, scaleFactor: number): GeoPoint[] {
  return coords.map((p) => {
    const dLat = p.lat - center.lat;
    const dLng = p.lng - center.lng;
    return {
      lat: parseFloat((center.lat + dLat * scaleFactor).toFixed(4)),
      lng: parseFloat((center.lng + dLng * scaleFactor).toFixed(4)),
    };
  });
}

/**
 * Generates dynamic SAR flood inundation polygons for a specific zone based on
 * satellite observations (floodedFraction, surfaceWaterChange).
 */
export function generateZoneInundation(
  zoneId: string,
  floodedFraction: number,
  surfaceWaterChange: number = 0
): InundationPolygon[] {
  const base = zoneChannelBases[zoneId];
  if (!base) return [];

  const results: InundationPolygon[] = [];

  // 1. Permanent Main Channel (Base water body detected by SAR during low flow)
  results.push({
    id: `inundation-${zoneId}-permanent`,
    zoneId,
    type: 'permanent_channel',
    coordinates: base.permanentChannel,
    areaKm2: parseFloat(base.baseAreaKm2.toFixed(1)),
    avgDepthM: 6.8,
    backscatterDb: -19.5, // Calm deep water exhibits strong specular reflection away from sensor
    confidence: 0.98,
    label: `${base.name} (Permanent River Channel)`,
  });

  // 2. Active SAR Flood Inundation Extent (Expands with floodedFraction)
  if (floodedFraction > 0.05) {
    const expansionCenter = base.expansionCenters[0].center;
    // Scale factor ranges from 1.15 to ~2.6 depending on floodedFraction
    const scale = 1.15 + floodedFraction * 1.55;
    const floodCoords = expandPolygon(base.permanentChannel, expansionCenter, scale);

    const floodedAreaKm2 = parseFloat((base.baseAreaKm2 * (1 + floodedFraction * 2.8)).toFixed(1));
    const avgDepthM = parseFloat((0.8 + floodedFraction * 3.4).toFixed(1));
    // Backscatter thresholding (Otsu threshold around -16.5 dB)
    const backscatterDb = parseFloat((-15.2 - floodedFraction * 3.8).toFixed(1));

    results.push({
      id: `inundation-${zoneId}-flood`,
      zoneId,
      type: 'flood_inundation',
      coordinates: floodCoords,
      areaKm2: floodedAreaKm2,
      avgDepthM,
      backscatterDb,
      confidence: parseFloat((0.92 + (floodedFraction * 0.06)).toFixed(2)),
      label: `${base.name} (SAR Inundated Floodplain)`,
    });
  }

  // 3. Surface Ponding / Saturated Lowland Depressions (When surfaceWaterChange is positive or floodedFraction is high)
  if (surfaceWaterChange > 0.02 || floodedFraction > 0.38) {
    const secCenter = base.expansionCenters[1]?.center || base.expansionCenters[0].center;
    const pondingScale = 0.85 + Math.abs(surfaceWaterChange) * 2.2;
    // Create an offset ellipse for wetland/beel ponding
    const pondingCoords: GeoPoint[] = [];
    const steps = 8;
    const rLat = 0.035 * pondingScale;
    const rLng = 0.055 * pondingScale;

    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      pondingCoords.push({
        lat: parseFloat((secCenter.lat + Math.sin(angle) * rLat).toFixed(4)),
        lng: parseFloat((secCenter.lng + Math.cos(angle) * rLng).toFixed(4)),
      });
    }

    const pondingAreaKm2 = parseFloat((18.5 + (surfaceWaterChange * 45)).toFixed(1));

    results.push({
      id: `inundation-${zoneId}-ponding`,
      zoneId,
      type: 'surface_ponding',
      coordinates: pondingCoords,
      areaKm2: Math.max(5.0, pondingAreaKm2),
      avgDepthM: 0.45,
      backscatterDb: -13.8, // Rougher water / emerging vegetation mixture
      confidence: 0.88,
      label: `${base.name} (Backwater Beels & Lowland Ponding)`,
    });
  }

  return results;
}

/**
 * Batch generates inundation polygons for all zones given observation records.
 */
export function getAllInundationPolygons(
  observations: Record<string, SatelliteObservation>
): InundationPolygon[] {
  const all: InundationPolygon[] = [];
  for (const [zoneId, obs] of Object.entries(observations)) {
    const polygons = generateZoneInundation(zoneId, obs.floodedFraction, obs.surfaceWaterChange);
    all.push(...polygons);
  }
  return all;
}
