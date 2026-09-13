export type SensorType = 'water_level' | 'rainfall' | 'soil_moisture' | 'flow_discharge';
export type SensorStatus = 'active' | 'degraded' | 'offline';

export interface TimeSeriesPoint {
  time: string;
  value: number;
}

export interface Sensor {
  id: string; // Sensor unique identifier
  sensorId: string; // Explicit alias requested by requirements
  zoneId: string; // Hydrological zone ID
  name: string; // Human readable label
  type: SensorType; // 'water_level' | 'rainfall' | 'soil_moisture'
  value: number; // Current instantaneous numerical reading
  unit: string; // Unit string: 'm', 'mm/h', '%'
  timestamp: string; // ISO timestamp of reading
  status: SensorStatus; // 'active' | 'degraded' | 'offline'
  coordinates: [number, number]; // [lng, lat]
  history: TimeSeriesPoint[]; // Recent readings for sparkline rendering
  lastReading: {
    value: number;
    unit: string;
    timestamp: string;
  };
  isSynthetic?: boolean;
}

export type RiskLevel = 'safe' | 'watch' | 'warning' | 'critical' | 'low' | 'moderate' | 'high';

export interface Prediction {
  horizonHours: number; // e.g. 3, 6, 12, 24
  riskLevel: RiskLevel;
  peakWaterLevelMeters: number;
  estimatedTimeToPeakHours: number;
  confidence: number; // 0 to 1 (confidence score)
  keyDrivers: string[];
}

export interface SimulationStep {
  stepIndex: number;
  relativeTimeHours: number; // e.g., 0, 1, 2, ... 24
  label: string; // e.g. "T-0 (Baseline)", "T+6h Forecast"
  timestamp: string;
  isForecast: boolean;
}
