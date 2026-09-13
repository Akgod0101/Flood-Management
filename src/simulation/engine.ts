import type {
  Zone,
  ZoneState,
  GraphEdge,
  Alert,
  AlertLevel,
  RiskFactor,
  Sarpass,
  TimeSnapshot,
  SensorReading,
} from '@/types';
import { zones as initialZones, basin, getEdgeKey } from '@/data/zones';

export interface SimulationConfig {
  riskThresholds: {
    watch: number;
    warning: number;
    danger: number;
  };
}

export const defaultConfig: SimulationConfig = {
  riskThresholds: { watch: 40, warning: 60, danger: 80 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function riskToLevel(score: number, cfg: SimulationConfig): AlertLevel {
  if (score >= cfg.riskThresholds.danger) return 'DANGER';
  if (score >= cfg.riskThresholds.warning) return 'WARNING';
  if (score >= cfg.riskThresholds.watch) return 'WATCH';
  return 'NORMAL';
}

// Weighted risk model — transparent, explainable scoring
// Each factor contributes a weighted score; final normalized to 0-100
function computeRiskFactors(state: ZoneState, zone: Zone): RiskFactor[] {
  const factors: RiskFactor[] = [];

  // Rainfall contribution (0-25 points)
  const rainfallScore = clamp(
    (state.rainfall24h / 120) * 25 + (state.rainfallIntensity / 40) * 10,
    0,
    25,
  );
  factors.push({
    label: '24h Rainfall Accumulation',
    contribution: Math.round(rainfallScore * 10) / 10,
    direction: 'positive',
  });

  // River level contribution (0-20 points)
  const dangerLevel = zone.historicalFloodFrequency > 8 ? 5.0 : 6.0;
  const riverScore = clamp((state.riverLevel / dangerLevel) * 20, 0, 20);
  factors.push({
    label: 'River Level Rise',
    contribution: Math.round(riverScore * 10) / 10,
    direction: 'positive',
  });

  // Soil saturation contribution (0-15 points)
  const soilScore = clamp(((state.soilMoisture - 40) / 60) * 15, 0, 15);
  factors.push({
    label: 'Soil Saturation',
    contribution: Math.round(soilScore * 10) / 10,
    direction: 'positive',
  });

  // Upstream flow contribution (0-20 points)
  const upstreamScore = clamp((state.upstreamInflow / 10000) * 20, 0, 20);
  factors.push({
    label: 'Upstream Inflow',
    contribution: Math.round(upstreamScore * 10) / 10,
    direction: 'positive',
  });

  // Terrain contribution (0-10 points) — low-lying = higher risk
  const terrainScore = clamp(
    ((100 - zone.elevation) / 100) * 5 + ((10 - zone.slope) / 10) * 3 + (zone.historicalFloodFrequency / 12) * 2,
    0,
    10,
  );
  factors.push({
    label: 'Low-Lying Terrain',
    contribution: Math.round(terrainScore * 10) / 10,
    direction: 'positive',
  });

  // SAR flood evidence (0-10 points)
  const sarScore = clamp((state.sarFloodExtent / 100) * 10, 0, 10);
  factors.push({
    label: 'SAR Water Expansion',
    contribution: Math.round(sarScore * 10) / 10,
    direction: 'positive',
  });

  return factors;
}

function computeRisk(factors: RiskFactor[]): number {
  const total = factors.reduce((sum, f) => sum + f.contribution, 0);
  return Math.round(clamp(total, 0, 100));
}

// Process upstream → downstream propagation in topological order
function topologicalOrder(zoneList: Zone[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const adj = new Map<string, string[]>();

  for (const z of zoneList) {
    for (const d of z.downstreamZoneIds) {
      if (!adj.has(z.id)) adj.set(z.id, []);
      adj.get(z.id)!.push(d);
    }
  }

  function dfs(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const zone = zoneList.find((z) => z.id === id);
    if (!zone) return;
    for (const u of zone.upstreamZoneIds) dfs(u);
    result.push(id);
  }

  for (const z of zoneList) dfs(z.id);
  return result;
}

const topoOrder = topologicalOrder(initialZones);

export interface SimState {
  zones: Zone[];
  edges: GraphEdge[];
  tick: number;
  timestamp: string;
  isRunning: boolean;
  eventPhase: 'idle' | 'rainfall' | 'rising' | 'peak' | 'recession' | 'sarr-correction';
  sarPass: Sarpass | null;
  alerts: Alert[];
  history: TimeSnapshot[];
  config: SimulationConfig;
  eventLabel: string;
  lastSarTick: number;
}

export function createInitialState(): SimState {
  return {
    zones: JSON.parse(JSON.stringify(initialZones)),
    edges: JSON.parse(JSON.stringify(basin.edges)),
    tick: 0,
    timestamp: new Date().toISOString(),
    isRunning: false,
    eventPhase: 'idle',
    sarPass: null,
    alerts: [],
    history: [],
    config: defaultConfig,
    eventLabel: 'Baseline — No active event',
    lastSarTick: 0,
  };
}

function updateSensors(zone: Zone, state: ZoneState): SensorReading[] {
  return zone.sensors.map((s) => {
    let value = s.value;
    const prev = s.value;

    switch (s.type) {
      case 'river_level':
        value = state.riverLevel + (Math.random() - 0.5) * 0.1;
        break;
      case 'flow':
        value = state.predictedOutgoingFlow + (Math.random() - 0.5) * 10;
        break;
      case 'rain':
        value = state.rainfallIntensity + (Math.random() - 0.5) * 2;
        break;
      case 'soil_moisture':
        value = state.soilMoisture + (Math.random() - 0.5) * 2;
        break;
      case 'water_depth':
        value = Math.max(0, state.riverLevel - 3 + (Math.random() - 0.5) * 0.2);
        break;
      default:
        value = 50 + Math.random() * 30;
    }

    const trend: SensorReading['trend'] =
      value > prev + 0.05 ? 'up' : value < prev - 0.05 ? 'down' : 'stable';
    const status: SensorReading['status'] =
      s.type === 'river_level' && value > 5
        ? 'critical'
        : s.type === 'rain' && value > 25
        ? 'critical'
        : s.type === 'soil_moisture' && value > 85
        ? 'warning'
        : 'normal';

    return {
      ...s,
      value: Math.round(value * 10) / 10,
      previousValue: Math.round(prev * 10) / 10,
      trend,
      status,
      timestamp: new Date().toISOString(),
    };
  });
}

function generateSarPass(tick: number, zones: Zone[]): Sarpass {
  const now = new Date();
  const acq = new Date(now.getTime() - 6 * 3600 * 1000);
  const proc = new Date(acq.getTime() + 2 * 3600 * 1000);
  const pred = new Date(now.getTime());

  const avgFloodExtent =
    zones.reduce((sum, z) => sum + z.state.sarFloodExtent, 0) / zones.length;

  return {
    acquisitionTime: acq.toISOString(),
    processingTime: proc.toISOString(),
    predictionTime: pred.toISOString(),
    lagHours: Math.round((pred.getTime() - acq.getTime()) / 3600000 * 10) / 10,
    floodExtentPercent: Math.round(avgFloodExtent * 10) / 10,
    orbit: tick % 2 === 0 ? 'ascending' : 'descending',
    polarization: 'VV+VH',
    productType: 'Level-1 GRD (IW)',
    resolution: '10 m × 10 m',
    mode: 'Interferometric Wide (IW)',
  };
}

export function stepSimulation(prev: SimState): SimState {
  const tick = prev.tick + 1;
  const zones = prev.zones.map((z) => ({
    ...z,
    state: { ...z.state },
    sensors: [...z.sensors],
  }));
  const edges = prev.edges.map((e) => ({ ...e }));
  const alerts: Alert[] = [];
  const phase = prev.eventPhase;

  // Event phase logic
  let eventLabel = prev.eventLabel;
  let rainfallMultiplier = 1;
  let soilIncrease = 0.5;
  let newPhase = phase;

  if (prev.isRunning) {
    if (tick < 5) {
      newPhase = 'rainfall';
      eventLabel = 'Phase 1: Heavy rainfall begins upstream';
      rainfallMultiplier = 3.5;
      soilIncrease = 2;
    } else if (tick < 10) {
      newPhase = 'rising';
      eventLabel = 'Phase 2: Soil saturating, river rising';
      rainfallMultiplier = 4;
      soilIncrease = 2.5;
    } else if (tick < 16) {
      newPhase = 'peak';
      eventLabel = 'Phase 3: Peak flood — downstream propagation';
      rainfallMultiplier = 3;
      soilIncrease = 1;
    } else if (tick < 22) {
      newPhase = 'recession';
      eventLabel = 'Phase 4: Flood recession';
      rainfallMultiplier = 0.5;
      soilIncrease = -1;
    } else if (tick < 25) {
      newPhase = 'sarr-correction';
      eventLabel = 'Phase 5: SAR correction loop — model recalibration';
      rainfallMultiplier = 0.3;
      soilIncrease = -2;
    } else {
      newPhase = 'idle';
      eventLabel = 'Baseline — Event complete';
      rainfallMultiplier = 0.2;
      soilIncrease = -2;
    }
  }

  // Update local state for each zone based on phase
  for (const zone of zones) {
    const isUpstream = zone.upstreamZoneIds.length === 0;
    const upstreamBoost = isUpstream ? 1.5 : 0.6;

    zone.state.rainfallIntensity = clamp(
      zone.state.rainfallIntensity * 0.9 + rainfallMultiplier * upstreamBoost * (1 + Math.random() * 0.3),
      0,
      60,
    );
    zone.state.rainfall1h = zone.state.rainfallIntensity;
    zone.state.rainfall3h = zone.state.rainfall3h * 0.7 + zone.state.rainfall1h * 0.3;
    zone.state.rainfall6h = zone.state.rainfall6h * 0.8 + zone.state.rainfall1h * 0.2;
    zone.state.rainfall12h = zone.state.rainfall12h * 0.9 + zone.state.rainfall1h * 0.1;
    zone.state.rainfall24h = zone.state.rainfall24h * 0.95 + zone.state.rainfall1h * 0.05;

    zone.state.soilMoisture = clamp(zone.state.soilMoisture + soilIncrease, 20, 98);

    // River level responds to rainfall + soil + upstream
    const localRise = (zone.state.rainfallIntensity / 30) * 0.15 * (zone.state.soilMoisture / 80);
    zone.state.riverLevelRiseRate = localRise + zone.state.upstreamInflow * 0.0003;
    zone.state.riverLevel = clamp(zone.state.riverLevel + zone.state.riverLevelRiseRate, 0.5, 9);

    // SAR flood extent grows with river level
    const floodThreshold = 3.5;
    if (zone.state.riverLevel > floodThreshold) {
      zone.state.sarFloodExtent = clamp(
        zone.state.sarFloodExtent + (zone.state.riverLevel - floodThreshold) * 1.5,
        0,
        100,
      );
    } else {
      zone.state.sarFloodExtent = clamp(zone.state.sarFloodExtent - 0.5, 0, 100);
    }
  }

  // Upstream → downstream propagation in topological order
  const zoneMap = new Map(zones.map((z) => [z.id, z]));

  for (const zid of topoOrder) {
    const zone = zoneMap.get(zid);
    if (!zone) continue;

    let totalUpstreamInflow = 0;
    let totalUpstreamContribution = 0;
    let upstreamConfidenceSum = 0;
    let upstreamCount = 0;

    // Gather upstream predictions
    for (const uid of zone.upstreamZoneIds) {
      const upstream = zoneMap.get(uid);
      if (!upstream) continue;

      const edge = edges.find((e) => e.from === uid && e.to === zid);
      if (!edge) continue;

      // Upstream sends its outgoing flow downstream (routed)
      const routedFlow = upstream.state.predictedOutgoingFlow * 0.85; // routing loss
      totalUpstreamInflow += routedFlow;
      totalUpstreamContribution += upstream.state.riskScore * 0.15;
      upstreamConfidenceSum += upstream.state.confidence;
      upstreamCount++;

      edge.predictedFlow = Math.round(routedFlow);
      edge.confidence = Math.round((upstream.state.confidence + zone.state.confidence) / 2);
      edge.predictedVolume = Math.round(routedFlow * edge.travelTime);
    }

    // Recalibration: combine upstream prediction with local observations
    zone.state.upstreamInflow = Math.round(totalUpstreamInflow);
    zone.state.upstreamContribution = Math.round(totalUpstreamContribution);

    // Predicted incoming flow = upstream inflow + local runoff
    const localRunoff =
      (zone.state.rainfall24h / 100) * 200 * (zone.state.soilMoisture / 100) * (zone.flowAccumulation / 10000);
    zone.state.predictedIncomingFlow = Math.round(totalUpstreamInflow + localRunoff);

    // Predicted outgoing flow = incoming flow minus storage/infiltration
    const storage = zone.elevation < 55 ? 0.7 : 0.85; // low-lying zones retain more
    zone.state.predictedOutgoingFlow = Math.round(zone.state.predictedIncomingFlow * storage);

    // Predicted water level
    zone.state.predictedWaterLevel = Math.round(
      (zone.state.riverLevel + totalUpstreamInflow * 0.002) * 10,
    ) / 10;

    // Estimated arrival time from upstream
    if (upstreamCount > 0) {
      const avgTravel = edges
        .filter((e) => zone.upstreamZoneIds.includes(e.from) && e.to === zid)
        .reduce((sum, e) => sum + e.travelTime, 0) / upstreamCount;
      zone.state.estimatedArrivalTime = Math.round(avgTravel * 10) / 10;
    }

    // Confidence: starts moderate, increases with observations, decreases with extreme conditions
    const baseConfidence = 75;
    const obsConfidence = zone.sensors.length * 1.5;
    const extremePenalty = zone.state.riskScore > 80 ? 10 : zone.state.riskScore > 60 ? 5 : 0;
    const upstreamConf = upstreamCount > 0 ? (upstreamConfidenceSum / upstreamCount) * 0.2 : 10;
    zone.state.confidence = Math.round(clamp(baseConfidence + obsConfidence + upstreamConf - extremePenalty, 30, 95));

    // Time to danger: based on current risk trajectory and arrival time
    if (zone.state.riskScore > 70) {
      zone.state.timeToDanger = Math.max(0, zone.state.estimatedArrivalTime);
      zone.state.timeToWarning = Math.max(0, zone.state.estimatedArrivalTime - 1);
    } else if (zone.state.riskScore > 50) {
      zone.state.timeToDanger = Math.max(0, zone.state.estimatedArrivalTime + 2);
      zone.state.timeToWarning = Math.max(0, zone.state.estimatedArrivalTime);
    } else {
      zone.state.timeToDanger = 99;
      zone.state.timeToWarning = 99;
    }

    // Compute risk factors and score
    zone.riskFactors = computeRiskFactors(zone.state, zone);
    zone.state.riskScore = computeRisk(zone.riskFactors);
    zone.state.alertLevel = riskToLevel(zone.state.riskScore, prev.config);

    // Update sensors
    zone.sensors = updateSensors(zone, zone.state);

    // Generate alerts
    if (zone.state.alertLevel === 'DANGER') {
      alerts.push({
        id: `alert-${tick}-${zone.id}`,
        zoneId: zone.id,
        zoneName: zone.name,
        level: 'DANGER',
        message: `${zone.name} may experience dangerous flooding in approximately ${zone.state.timeToDanger} hours. Immediate evacuation recommended.`,
        timeToDanger: zone.state.timeToDanger,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    } else if (zone.state.alertLevel === 'WARNING') {
      alerts.push({
        id: `alert-${tick}-${zone.id}`,
        zoneId: zone.id,
        zoneName: zone.name,
        level: 'WARNING',
        message: `${zone.name} flood warning. Predicted water arrival in ${zone.state.timeToWarning} hours. Prepare for possible evacuation.`,
        timeToDanger: zone.state.timeToWarning,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    } else if (zone.state.alertLevel === 'WATCH') {
      alerts.push({
        id: `alert-${tick}-${zone.id}`,
        zoneId: zone.id,
        zoneName: zone.name,
        level: 'WATCH',
        message: `${zone.name} under watch. Conditions developing. Monitor closely.`,
        timeToDanger: 99,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // SAR pass every 6 ticks
  let sarPass = prev.sarPass;
  let lastSarTick = prev.lastSarTick;
  if (tick - prev.lastSarTick >= 6 || (tick === 1 && prev.lastSarTick === 0)) {
    sarPass = generateSarPass(tick, zones);
    lastSarTick = tick;

    // SAR correction loop: adjust model based on observation
    for (const zone of zones) {
      const modelPredicted = zone.state.sarFloodExtent;
      const sarObserved = clamp(
        modelPredicted + (Math.random() - 0.4) * 15,
        0,
        100,
      );
      const correction = (sarObserved - modelPredicted) * 0.3;
      zone.state.sarFloodExtent = clamp(modelPredicted + correction, 0, 100);
    }
  }

  // Snapshot for history
  const snapshot: TimeSnapshot = {
    tick,
    timestamp: new Date().toISOString(),
    zoneStates: Object.fromEntries(zones.map((z) => [z.id, { ...z.state }])),
    edgeStates: Object.fromEntries(edges.map((e) => [getEdgeKey(e.from, e.to), { ...e }])),
    sarPass,
    alerts: [...alerts],
  };

  const history = [...prev.history, snapshot].slice(-60);

  return {
    zones,
    edges,
    tick,
    timestamp: snapshot.timestamp,
    isRunning: prev.isRunning,
    eventPhase: newPhase,
    sarPass,
    alerts,
    history,
    config: prev.config,
    eventLabel,
    lastSarTick,
  };
}

export function startEvent(state: SimState): SimState {
  return { ...state, isRunning: true, tick: 0, eventPhase: 'rainfall', eventLabel: 'Phase 1: Heavy rainfall begins upstream' };
}

export function stopEvent(state: SimState): SimState {
  return { ...state, isRunning: false, eventPhase: 'idle', eventLabel: 'Baseline — Simulation paused' };
}

export function resetEvent(): SimState {
  return createInitialState();
}

export function toggleEdgeMode(state: SimState, zoneId: string): SimState {
  return {
    ...state,
    zones: state.zones.map((z) =>
      z.id === zoneId ? { ...z, state: { ...z.state, edgeMode: !z.state.edgeMode } } : z,
    ),
  };
}
