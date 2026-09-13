import { RiskLevel, Sensor, Prediction, TimeSeriesPoint, SimulationStep } from './telemetry';

export interface TerrainInfo {
  elevationMeters: number;
  averageSlopePercent: number;
  drainageAreaKm2: number;
  soilType: string;
}

/**
 * Hydrological Zone State
 * Represents the local digital state of a catchment zone at a specific point in time.
 * Note: When real data pipelines are connected, these fields will be populated
 * from CWC gauges, IMD rainfall, CartoDEM/SRTM, and Sentinel-1 SAR observations.
 */
export interface ZoneState {
  timestamp: string; // ISO-8601 string
  waterLevel: number; // in meters (stage)
  waterLevelRiseRate: number; // in m/h
  rainfall: number; // in mm/h (instantaneous intensity)
  accumulatedRainfall?: {
    h1: number;
    h6: number;
    h24: number;
  } | number;
  soilMoisture: number; // volumetric moisture %
  soilSaturation: number; // pore saturation %
  incomingFlow: number; // m³/s from upstream reaches
  outgoingFlow: number; // m³/s discharge to downstream reaches
  satelliteWaterFraction: number; // 0 to 1 (Sentinel-1 SAR observed inundation fraction)
  floodRisk: RiskLevel;
  predictionConfidence: number; // 0 to 1 confidence metric
  predictedDangerTime: string; // e.g. "T+2.5h (Critical Breach)" or "Stable"

  // Physical context & thresholds
  dangerThreshold: number; // meters
  elevation: number; // meters ASL
  slope: number; // %
  flowAccumulation: number; // km²
  terrain?: TerrainInfo;

  // Time-series progressions
  waterLevelHistory: TimeSeriesPoint[];
  rainfallHistory: TimeSeriesPoint[];

  // Provenance & Synthetic Flag
  isSynthetic?: boolean;
  dataSource?: string;

  // Backward compatibility aliases
  currentWaterLevel: number;
  rainfallCurrent: number;
  rainfallAccumulated1h: number;
  rainfallAccumulated6h: number;
  rainfallAccumulated24h: number;
  confidence: number;
  waterLevelMeters?: number;
  waterLevelRiseRateMPerHour?: number;
  rainfallMmPerHour?: number;
  soilMoisturePercent?: number;
  incomingFlowM3PerSecond?: number;
  predictedFloodRisk?: RiskLevel;
  confidenceScore?: number;
}

/**
 * Hydrological Zone Model
 * Represents a hydrologically meaningful area delineated by DEM, flow direction,
 * drainage network, and terrain connectivity (NOT an arbitrary square grid cell).
 */
export interface Zone {
  id: string;
  name: string;
  code: string;
  basinId: string;

  // Hydrological & Geomorphic attributes
  elevation: number; // mean elevation in meters
  meanSlope: number; // average topographic slope %
  flowAccumulation: number; // upstream contributing catchment area in km²
  riverDistance: number; // distance in km along the main river channel
  storageCapacity: number; // retention capacity in million m³ or m³
  floodplainArea: number; // active riparian floodplain in km²

  // Graph connectivity
  upstreamZoneIds: string[];
  downstreamZoneIds: string[];
  travelTimeToDownstream: Record<string, number>; // downstreamZoneId -> travel time in hours

  // Spatial representation
  geometry?: any; // GeoJSON geometry (Polygon / MultiPolygon)
  coordinates: [number, number]; // Centroid [lng, lat]
  boundaryPolygon: [number, number][]; // Polygon coordinates [lng, lat]

  // State & Sensors
  riskLevel: RiskLevel;
  currentWaterLevelMeters: number;
  dangerThreshold: number;
  currentState: ZoneState;
  sensors: Sensor[];
  latestPrediction?: Prediction;

  // Provenance & Scaffold Flag
  isSynthetic?: boolean;
  dataSource?: string;

  // Backward compatibility aliases
  elevationMeters: number;
  areaKm2: number;
}

/**
 * Directed Flow Edge
 * Represents the hydrological conveyance channel routing water between upstream and downstream zones.
 */
export interface FlowEdge {
  id: string;
  upstreamZone: string; // Source zone ID
  downstreamZone: string; // Destination zone ID
  travelTimeHours: number; // Hydrodynamic routing delay in hours
  transmissionFactor: number; // 0 to 1 (in-channel conveyance efficiency accounting for losses)
  flowCapacityM3PerSec: number;
  currentDischargeM3PerSec: number;

  // Backward compatibility aliases
  sourceZoneId: string;
  targetZoneId: string;
  transitTimeHours: number;
}

export interface BasinEvent {
  id: string;
  name: string;
  type: 'live' | 'historical' | 'scenario';
  startDate: string;
  description: string;
  severity: RiskLevel;
  isSynthetic?: boolean;
}

/**
 * River Basin Model
 */
export interface Basin {
  id: string;
  name: string;
  region: string;
  totalAreaKm2: number;
  centerCoordinates: [number, number]; // [lng, lat]
  defaultZoom: number;
  availableEvents: BasinEvent[];
  zones: Zone[];
  edges: FlowEdge[];
  isSynthetic?: boolean;
}

/**
 * Hourly Simulation State Models (Propagation Engine)
 */
export interface ZoneSimulationState {
  timestepHour: number;
  waterLevel: number;
  waterLevelRiseRate: number;
  incomingFlow: number;
  outgoingFlow: number;
  rainfall: number;
  soilSaturation: number;
  riskLevel: RiskLevel;
  dangerThreshold: number;
}

export interface SimulationHourStep {
  hour: number;
  timestamp: string;
  label: string;
  zoneStates: Record<string, ZoneSimulationState>;
  edgeDischarges: Record<string, number>;
}

export interface BasinSimulationResult {
  hourlySteps: SimulationHourStep[];
}
