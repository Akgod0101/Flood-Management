import { TerrainInfo } from '../models/basin';

export interface ZoneTerrainProfile {
  zoneId: string;
  elevationMeters: number;
  meanSlopePercent: number;
  flowAccumulationKm2: number;
  riverDistanceKm: number;
  floodplainAreaKm2: number;
  soilType: string;
  isSynthetic: boolean;
}

/**
 * TerrainDataProvider
 * Interface for extracting digital elevation, slope, flow accumulation,
 * and catchment geomorphology (e.g. from CartoDEM / SRTM 30m in Phase 2).
 */
export interface TerrainDataProvider {
  getTerrainProfile(zoneId: string): Promise<ZoneTerrainProfile | null>;
  getElevationRasterUrl?(basinId: string): string;
}
