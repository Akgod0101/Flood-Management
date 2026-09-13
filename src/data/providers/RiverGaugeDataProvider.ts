import { TimeSeriesPoint } from '../models/telemetry';

export interface RiverGaugeObservation {
  zoneId: string;
  gaugeStationId: string;
  stationName: string;
  timestamp: string;
  waterLevelMeters: number;
  dangerLevelMeters: number;
  warningLevelMeters: number;
  riseRateMPerHour: number;
  history: TimeSeriesPoint[];
  isSynthetic: boolean;
  agencySource: string; // e.g. "CWC (Central Water Commission)" or "DEMO / SYNTHETIC"
}

/**
 * RiverGaugeDataProvider
 * Interface for reading river stage observations and official gauge warning/danger levels.
 * (Will integrate official CWC telemetry in Phase 4).
 */
export interface RiverGaugeDataProvider {
  getLatestGaugeObservation(zoneId: string): Promise<RiverGaugeObservation | null>;
  getGaugeHistory(zoneId: string, hours: number): Promise<TimeSeriesPoint[]>;
}
