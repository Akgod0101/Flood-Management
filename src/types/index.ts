export type RiskLevel = 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Extreme';
export type AlertLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'DANGER';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface SensorReading {
  id: string;
  type: 'river_level' | 'rain' | 'soil_moisture' | 'water_depth' | 'flow' | 'environmental';
  label: string;
  value: number;
  unit: string;
  previousValue: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
  simulated: true;
}

export interface AIPrediction {
  zone_id: string;
  probabilities: {
    flood_probability_1h: number;
    flood_probability_3h: number;
    flood_probability_6h: number;
  };
  confidence: number;
  risk_tier: 'safe' | 'watch' | 'warning' | 'critical';
  algorithm: string;
  isAvailable: boolean;
  notice?: string;
  timestamp: string;
}

export interface ZoneState {
  rainfall1h: number;
  rainfall3h: number;
  rainfall6h: number;
  rainfall12h: number;
  rainfall24h: number;
  rainfallIntensity: number;
  soilMoisture: number;
  riverLevel: number;
  riverLevelRiseRate: number;
  sarFloodExtent: number;
  predictedWaterLevel: number;
  predictedIncomingFlow: number;
  predictedOutgoingFlow: number;
  estimatedArrivalTime: number;
  timeToWarning: number;
  timeToDanger: number;
  confidence: number;
  upstreamInflow: number;
  upstreamContribution: number;
  riskScore: number;
  alertLevel: AlertLevel;
  edgeMode: boolean;
  mlPrediction?: AIPrediction;
}

export interface Zone {
  id: string;
  name: string;
  type: 'village' | 'valley' | 'confluence' | 'headwater';
  center: GeoPoint;
  polygon: GeoPoint[];
  elevation: number;
  slope: number;
  flowAccumulation: number;
  distanceFromRiver: number;
  historicalFloodFrequency: number;
  sensors: SensorReading[];
  state: ZoneState;
  riskFactors: RiskFactor[];
  upstreamZoneIds: string[];
  downstreamZoneIds: string[];
  basinId: string;
}

export interface RiskFactor {
  label: string;
  contribution: number;
  direction: 'positive' | 'negative';
}

export interface GraphEdge {
  from: string;
  to: string;
  predictedFlow: number;
  predictedVolume: number;
  travelTime: number;
  confidence: number;
}

export interface Basin {
  id: string;
  name: string;
  state: string;
  center: GeoPoint;
  polygon: GeoPoint[];
  zoneIds: string[];
  edges: GraphEdge[];
}

export interface SatelliteObservation {
  timestamp: string;
  zoneId: string;
  floodedFraction: number;
  surfaceWaterChange: number;
  soilMoisture: number;
  rainfallEstimate: number;
  source: string;
  confidence: number;
}

export interface SatelliteProvider {
  getSatelliteObservations(zoneIds: string[], timestamp?: string): Promise<SatelliteObservation[]>;
}

export interface InundationPolygon {
  id: string;
  zoneId: string;
  type: 'permanent_channel' | 'flood_inundation' | 'surface_ponding';
  coordinates: GeoPoint[];
  areaKm2: number;
  avgDepthM: number;
  backscatterDb: number;
  confidence: number;
  label: string;
}

export interface Sarpass {
  acquisitionTime: string;
  processingTime: string;
  predictionTime: string;
  lagHours: number;
  floodExtentPercent: number;
  orbit: 'ascending' | 'descending';
  polarization: 'VV' | 'VH' | 'VV+VH';
  productType: string;
  resolution: string;
  mode: string;
}

export interface HistoricalEvent {
  id: string;
  name: string;
  date: string;
  region: string;
  state: string;
  description: string;
  basinId: string;
  peakDischarge: string;
  affectedPeople: string;
  riskBefore: number;
  riskDuring: number;
  riskAfter: number;
  riskTimeline: { hour: string; risk: number; observed: number }[];
  sarObservedExtent: number;
  modelPredictedExtent: number;
  iou: number;
  precision: number;
  recall: number;
  f1: number;
  validationNote: string;
}

export interface DataSource {
  id: string;
  provider: string;
  datasetName: string;
  resolution: string;
  revisit: string;
  temporalCoverage: string;
  role: string;
  limitations: string;
  status: 'used' | 'potential';
  category: 'satellite' | 'rainfall' | 'dem' | 'geospatial' | 'historical';
}

export interface TimeSnapshot {
  tick: number;
  timestamp: string;
  zoneStates: Record<string, ZoneState>;
  edgeStates: Record<string, GraphEdge>;
  sarPass: Sarpass | null;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  zoneId: string;
  zoneName: string;
  level: AlertLevel;
  message: string;
  timeToDanger: number;
  timestamp: string;
  acknowledged: boolean;
}

export type PageId =
  | 'overview'
  | 'heatmap'
  | 'basin-graph'
  | 'zone-details'
  | 'satellite'
  | 'historical'
  | 'alerts'
  | 'data-sources';

