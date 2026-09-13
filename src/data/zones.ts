import type { Basin, Zone, SensorReading, GeoPoint } from '@/types';

// Brahmaputra Basin — Assam stretch
// Zones defined along hydrological flow: upstream Arunachal hills → Assam valley → confluence → downstream
// Coordinates follow the Brahmaputra river corridor through Assam

const sensorTypes: Array<{
  type: SensorReading['type'];
  label: string;
  unit: string;
}> = [
  { type: 'river_level', label: 'River Level', unit: 'm' },
  { type: 'flow', label: 'River Flow', unit: 'm³/s' },
  { type: 'rain', label: 'Rainfall', unit: 'mm/h' },
  { type: 'soil_moisture', label: 'Soil Saturation', unit: '%' },
  { type: 'rain', label: 'Boundary Rain', unit: 'mm/h' },
  { type: 'water_depth', label: 'Low-Area Depth', unit: 'm' },
  { type: 'environmental', label: 'Environmental', unit: 'AQI' },
];

function makeSensors(zoneId: string, seed: number): SensorReading[] {
  const sensors: SensorReading[] = [];
  const labels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

  for (let i = 0; i < 7; i++) {
    const config = sensorTypes[i];
    const s = seed + i * 7;
    const baseValue =
      config.type === 'river_level'
        ? 2 + (s % 30) / 10
        : config.type === 'flow'
        ? 50 + (s % 200)
        : config.type === 'rain'
        ? (s % 15)
        : config.type === 'soil_moisture'
        ? 40 + (s % 40)
        : config.type === 'water_depth'
        ? (s % 8) / 10
        : 50 + (s % 100);

    sensors.push({
      id: `${zoneId}-${labels[i]}`,
      type: config.type,
      label: `${labels[i]}: ${config.label}`,
      value: Math.round(baseValue * 10) / 10,
      unit: config.unit,
      previousValue: Math.round((baseValue - 0.3) * 10) / 10,
      trend: 'stable',
      timestamp: new Date().toISOString(),
      status: 'normal',
      simulated: true,
    });
  }
  return sensors;
}

interface ZoneConfig {
  id: string;
  name: string;
  type: Zone['type'];
  center: GeoPoint;
  polygon: GeoPoint[];
  elevation: number;
  slope: number;
  flowAccumulation: number;
  distanceFromRiver: number;
  historicalFloodFrequency: number;
  upstreamZoneIds: string[];
  downstreamZoneIds: string[];
  baseRiverLevel: number;
  baseRisk: number;
}

// Brahmaputra flows west-to-east through Assam, entering from Arunachal Pradesh
// and exiting toward Bangladesh. Major tributaries (Subansiri, Jia Bharali,
// Kapili, Manas) join from the north and south, creating a branching graph.
const zoneConfigs: ZoneConfig[] = [
  {
    id: 'z1',
    name: 'Pasighat Headwater',
    type: 'headwater',
    center: { lat: 28.07, lng: 95.33 },
    polygon: [
      { lat: 28.12, lng: 95.25 },
      { lat: 28.12, lng: 95.42 },
      { lat: 28.0, lng: 95.42 },
      { lat: 28.0, lng: 95.25 },
    ],
    elevation: 155,
    slope: 18,
    flowAccumulation: 18000,
    distanceFromRiver: 0.4,
    historicalFloodFrequency: 4,
    upstreamZoneIds: [],
    downstreamZoneIds: ['z2'],
    baseRiverLevel: 2.2,
    baseRisk: 18,
  },
  {
    id: 'z2',
    name: 'Dibrugarh Valley',
    type: 'valley',
    center: { lat: 27.47, lng: 94.91 },
    polygon: [
      { lat: 27.55, lng: 94.8 },
      { lat: 27.55, lng: 95.02 },
      { lat: 27.38, lng: 95.02 },
      { lat: 27.38, lng: 94.8 },
    ],
    elevation: 116,
    slope: 6,
    flowAccumulation: 32000,
    distanceFromRiver: 0.3,
    historicalFloodFrequency: 8,
    upstreamZoneIds: ['z1'],
    downstreamZoneIds: ['z3'],
    baseRiverLevel: 3.0,
    baseRisk: 32,
  },
  {
    id: 'z3',
    name: 'Jorhat Confluence',
    type: 'confluence',
    center: { lat: 26.75, lng: 94.2 },
    polygon: [
      { lat: 26.82, lng: 94.08 },
      { lat: 26.82, lng: 94.33 },
      { lat: 26.66, lng: 94.33 },
      { lat: 26.66, lng: 94.08 },
    ],
    elevation: 98,
    slope: 4,
    flowAccumulation: 58000,
    distanceFromRiver: 0.2,
    historicalFloodFrequency: 11,
    upstreamZoneIds: ['z2'],
    downstreamZoneIds: ['z4', 'z5'],
    baseRiverLevel: 3.8,
    baseRisk: 42,
  },
  {
    id: 'z4',
    name: 'Tezpur Bend',
    type: 'valley',
    center: { lat: 26.63, lng: 92.79 },
    polygon: [
      { lat: 26.7, lng: 92.68 },
      { lat: 26.7, lng: 92.9 },
      { lat: 26.55, lng: 92.9 },
      { lat: 26.55, lng: 92.68 },
    ],
    elevation: 72,
    slope: 3,
    flowAccumulation: 75000,
    distanceFromRiver: 0.3,
    historicalFloodFrequency: 9,
    upstreamZoneIds: ['z3'],
    downstreamZoneIds: ['z6'],
    baseRiverLevel: 3.4,
    baseRisk: 38,
  },
  {
    id: 'z5',
    name: 'Nagaon Floodplain',
    type: 'valley',
    center: { lat: 26.45, lng: 92.68 },
    polygon: [
      { lat: 26.52, lng: 92.55 },
      { lat: 26.52, lng: 92.82 },
      { lat: 26.36, lng: 92.82 },
      { lat: 26.36, lng: 92.55 },
    ],
    elevation: 58,
    slope: 2,
    flowAccumulation: 82000,
    distanceFromRiver: 0.5,
    historicalFloodFrequency: 12,
    upstreamZoneIds: ['z3'],
    downstreamZoneIds: ['z6'],
    baseRiverLevel: 4.0,
    baseRisk: 48,
  },
  {
    id: 'z6',
    name: 'Guwahati Capital Basin',
    type: 'confluence',
    center: { lat: 26.19, lng: 91.74 },
    polygon: [
      { lat: 26.28, lng: 91.6 },
      { lat: 26.28, lng: 91.88 },
      { lat: 26.08, lng: 91.88 },
      { lat: 26.08, lng: 91.6 },
    ],
    elevation: 49,
    slope: 2.5,
    flowAccumulation: 110000,
    distanceFromRiver: 0.2,
    historicalFloodFrequency: 14,
    upstreamZoneIds: ['z4', 'z5'],
    downstreamZoneIds: ['z7'],
    baseRiverLevel: 4.5,
    baseRisk: 55,
  },
  {
    id: 'z7',
    name: 'Goalpara Outflow',
    type: 'village',
    center: { lat: 26.16, lng: 90.62 },
    polygon: [
      { lat: 26.25, lng: 90.48 },
      { lat: 26.25, lng: 90.78 },
      { lat: 26.06, lng: 90.78 },
      { lat: 26.06, lng: 90.48 },
    ],
    elevation: 35,
    slope: 1.5,
    flowAccumulation: 145000,
    distanceFromRiver: 0.3,
    historicalFloodFrequency: 13,
    upstreamZoneIds: ['z6'],
    downstreamZoneIds: [],
    baseRiverLevel: 4.8,
    baseRisk: 52,
  },
];

export const zones: Zone[] = zoneConfigs.map((c, i) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  center: c.center,
  polygon: c.polygon,
  elevation: c.elevation,
  slope: c.slope,
  flowAccumulation: c.flowAccumulation,
  distanceFromRiver: c.distanceFromRiver,
  historicalFloodFrequency: c.historicalFloodFrequency,
  sensors: makeSensors(c.id, i * 13 + 3),
  upstreamZoneIds: c.upstreamZoneIds,
  downstreamZoneIds: c.downstreamZoneIds,
  basinId: 'brahmaputra',
  state: {
    rainfall1h: 0.5,
    rainfall3h: 1.2,
    rainfall6h: 2.5,
    rainfall12h: 5.0,
    rainfall24h: 8.0,
    rainfallIntensity: 0.5,
    soilMoisture: 45 + (i % 20),
    riverLevel: c.baseRiverLevel,
    riverLevelRiseRate: 0,
    sarFloodExtent: 2 + (i % 5),
    predictedWaterLevel: c.baseRiverLevel,
    predictedIncomingFlow: 100 + i * 50,
    predictedOutgoingFlow: 100 + i * 50,
    estimatedArrivalTime: 0,
    timeToWarning: 99,
    timeToDanger: 99,
    confidence: 72 + (i % 15),
    upstreamInflow: 0,
    upstreamContribution: 0,
    riskScore: c.baseRisk,
    alertLevel: 'NORMAL',
    edgeMode: false,
  },
  riskFactors: [],
}));

export const basin: Basin = {
  id: 'brahmaputra',
  name: 'Brahmaputra Basin — Pasighat to Goalpara',
  state: 'Assam',
  center: { lat: 26.9, lng: 92.8 },
  polygon: [
    { lat: 28.2, lng: 90.4 },
    { lat: 28.2, lng: 95.5 },
    { lat: 26.0, lng: 95.5 },
    { lat: 26.0, lng: 90.4 },
  ],
  zoneIds: zones.map((z) => z.id),
  edges: [
    { from: 'z1', to: 'z2', predictedFlow: 3000, predictedVolume: 0, travelTime: 2.0, confidence: 85 },
    { from: 'z2', to: 'z3', predictedFlow: 4500, predictedVolume: 0, travelTime: 2.5, confidence: 82 },
    { from: 'z3', to: 'z4', predictedFlow: 6000, predictedVolume: 0, travelTime: 3.0, confidence: 80 },
    { from: 'z3', to: 'z5', predictedFlow: 5500, predictedVolume: 0, travelTime: 3.5, confidence: 78 },
    { from: 'z4', to: 'z6', predictedFlow: 6800, predictedVolume: 0, travelTime: 2.5, confidence: 76 },
    { from: 'z5', to: 'z6', predictedFlow: 7200, predictedVolume: 0, travelTime: 3.0, confidence: 75 },
    { from: 'z6', to: 'z7', predictedFlow: 12000, predictedVolume: 0, travelTime: 4.0, confidence: 73 },
  ],
};

export function getZone(id: string): Zone | undefined {
  return zones.find((z) => z.id === id);
}

export function getEdgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}
