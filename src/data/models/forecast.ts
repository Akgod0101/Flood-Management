/**
 * Rainfall Forecast Domain Models
 * Provides hydrological precipitation forecasts across multi-hour horizons
 * for normal, heavy, and extreme rainfall scenarios in Assam's river basin.
 */

export type RainfallScenario = 'normal' | 'heavy' | 'extreme';

export type RainfallIntensity =
  | 'light'
  | 'moderate'
  | 'heavy'
  | 'very_heavy'
  | 'extreme';

export interface ZoneRainfallForecast {
  zoneId: string;
  zoneName: string;
  scenario: RainfallScenario;

  // Forecast horizons (cumulative precipitation in mm)
  next1h: number;  // Expected precipitation in next 1 hour (mm)
  next3h: number;  // Cumulative precipitation over next 3 hours (mm)
  next6h: number;  // Cumulative precipitation over next 6 hours (mm)
  next12h: number; // Cumulative precipitation over next 12 hours (mm)
  next24h: number; // Cumulative precipitation over next 24 hours (mm)

  // Hourly rainfall profile for simulation execution [hour 1 to 24] in mm/h
  hourlyRainfallMm: number[];

  // Calculated hydrological metrics
  accumulatedRainfall: number; // Total 24h accumulated rainfall (mm)
  rainfallIntensity: RainfallIntensity; // Categorical classification
  peakIntensityMmPerHour: number; // Maximum single-hour intensity (mm/h)
  baselineRainfall24h: number; // Climatological normal baseline (mm)
  rainfallAnomalyMm: number; // Anomaly in mm relative to baseline
  rainfallAnomalyPercentage: number; // Percentage anomaly (+/- %)
}

export interface BasinRainfallForecast {
  scenario: RainfallScenario;
  scenarioName: string;
  scenarioDescription: string;
  generatedAt: string;
  zones: Record<string, ZoneRainfallForecast>;
  basinAverageAccumulated24h: number;
  basinAverageAnomalyPercentage: number;
  highestRiskZoneId: string;
}
