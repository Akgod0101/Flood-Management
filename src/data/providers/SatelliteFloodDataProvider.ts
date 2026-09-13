/**
 * SatelliteFloodDataProvider
 * Interface for spatial observation layer (e.g. Sentinel-1 SAR flood extent mapping).
 * Acts as an observational correction layer against predicted hydrological state.
 * (Will integrate Sentinel-1 SAR flood extent in Phase 5).
 */
export interface SatelliteFloodObservation {
  zoneId: string;
  passTimestamp: string;
  satelliteWaterFraction: number; // 0 to 1 fraction of zone area inundated
  inundatedAreaKm2: number;
  totalAreaKm2: number;
  satelliteMission: string; // e.g. "Sentinel-1A SAR" or "DEMO / SYNTHETIC"
  confidenceScore: number;
  isSynthetic: boolean;
}

export interface SatelliteFloodDataProvider {
  getLatestPass(zoneId: string): Promise<SatelliteFloodObservation | null>;
  getBasinInundationSummary(basinId: string): Promise<{
    totalInundatedKm2: number;
    observationTimestamp: string;
    isSynthetic: boolean;
  }>;
}
