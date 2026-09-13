import { TimeSeriesPoint } from '../models/telemetry';

export interface ZoneRainfallObservation {
  zoneId: string;
  timestamp: string;
  rainfallCurrentMmPerHour: number;
  accumulated1hMm: number;
  accumulated6hMm: number;
  accumulated24hMm: number;
  history: TimeSeriesPoint[];
  isSynthetic: boolean;
  stationOrSource: string; // e.g. "IMD Automatic Weather Station" or "DEMO / SYNTHETIC"
}

/**
 * RainfallDataProvider
 * Interface for retrieving rainfall observations, hyetographs, and gridded precipitation.
 * (Will integrate IMD / GPM in Phase 4).
 */
export interface RainfallDataProvider {
  getRainfallObservation(zoneId: string, timestamp?: string): Promise<ZoneRainfallObservation | null>;
  getAccumulatedRainfall(zoneId: string, hours: number): Promise<number>;
}
