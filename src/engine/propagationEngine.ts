import {
  Basin,
  FlowEdge,
  RiskLevel,
  SimulationHourStep,
  Zone,
  ZoneSimulationState,
  BasinSimulationResult,
  BasinRainfallForecast,
} from '../types/flood';
import {
  partitionRainfallInfiltration,
  updateSoilState,
  calculateRemainingStorage,
} from './soilInfiltrationModel';
import { calculateRiskExplanation } from './riskExplanationEngine';

/**
 * 1. updateZoneWaterLevel
 * Deterministically updates a zone's water stage based on net balance of
 * incoming upstream flow, outgoing discharge, and local rainfall runoff.
 */
export function updateZoneWaterLevel(
  currentLevel: number,
  incomingFlow: number,
  outgoingFlow: number,
  rainfallMm: number,
  areaKm2: number,
  soilSaturation: number = 75
): { newWaterLevel: number; riseRate: number } {
  // Hydraulic channel surface area estimate (~5% of sub-basin is active floodplain)
  const channelAreaM2 = Math.max(50_000, areaKm2 * 60_000);

  // Net inflow volume over 1 hour (3600 seconds)
  const netFlowVolumeM3 = (incomingFlow - outgoingFlow) * 3600;
  const flowDepthChange = netFlowVolumeM3 / channelAreaM2;

  // Runoff generated from rainfall based on soil saturation percentage
  const runoffCoeff = 0.25 + 0.65 * (soilSaturation / 100);
  const rainfallRise = (rainfallMm / 1000) * runoffCoeff * 1.8;

  // Total delta
  const delta = flowDepthChange + rainfallRise;
  const newWaterLevel = Math.max(0.4, parseFloat((currentLevel + delta).toFixed(3)));
  const riseRate = parseFloat((newWaterLevel - currentLevel).toFixed(3));

  return { newWaterLevel, riseRate };
}

/**
 * 2. calculateOutgoingFlow
 * Calculates outgoing discharge using a stage-storage rating curve.
 * As water level approaches or breaches the danger threshold, discharge accelerates.
 */
export function calculateOutgoingFlow(
  waterLevel: number,
  dangerThreshold: number,
  slopePercent: number,
  baseCapacity: number
): number {
  const safeThreshold = Math.max(1, dangerThreshold);
  const headRatio = Math.max(0.1, waterLevel / safeThreshold);

  // Gravity hydraulic gradient factor from slope
  const slopeFactor = Math.sqrt(Math.max(0.5, slopePercent) / 10);

  // Rating curve power law (prototype hydraulic conveyance)
  const flow = baseCapacity * Math.pow(headRatio, 1.5) * slopeFactor;

  // Clamp within realistic channel hydraulic limits
  const clampedFlow = Math.max(20, Math.min(baseCapacity * 2.2, Math.round(flow)));
  return clampedFlow;
}

/**
 * 3. propagateFlow
 * Distributes outgoing flow from an upstream zone along its outgoing edges
 * according to each edge's travel time delay and transmission factor.
 */
export function propagateFlow(
  outgoingFlow: number,
  outgoingEdges: FlowEdge[],
  currentHour: number,
  transitSchedule: Record<string, Record<number, number>>
): void {
  if (outgoingEdges.length === 0 || outgoingFlow <= 0) return;

  // Distribute flow equally or proportionally across outgoing branches
  const perEdgeFlow = outgoingFlow / outgoingEdges.length;

  for (const edge of outgoingEdges) {
    const targetZoneId = edge.downstreamZone || edge.targetZoneId;
    const travelTime = Math.max(1, Math.round(edge.travelTimeHours || edge.transitTimeHours || 1));
    const arrivalHour = currentHour + travelTime;
    const factor = edge.transmissionFactor ?? 0.92;
    const deliveredFlow = Math.round(perEdgeFlow * factor);

    if (!transitSchedule[targetZoneId]) {
      transitSchedule[targetZoneId] = {};
    }
    transitSchedule[targetZoneId][arrivalHour] =
      (transitSchedule[targetZoneId][arrivalHour] || 0) + deliveredFlow;
  }
}

/**
 * 4. calculateRisk
 * Pure, deterministic risk classifier based on water level and danger threshold.
 */
export function calculateRisk(
  waterLevel: number,
  dangerThreshold: number,
  riseRate: number
): RiskLevel {
  const ratio = waterLevel / Math.max(0.5, dangerThreshold);

  if (ratio >= 0.98 || (ratio >= 0.92 && riseRate >= 0.3)) {
    return 'critical';
  }
  if (ratio >= 0.82 || (ratio >= 0.74 && riseRate >= 0.2)) {
    return 'warning';
  }
  if (ratio >= 0.68 || riseRate >= 0.15) {
    return 'watch';
  }
  return 'safe';
}

/**
 * 5. simulateFloodPropagation
 * Pure, deterministic TypeScript simulation function.
 * Propagates flood wave forward through the zone graph in hourly steps,
 * consuming forecasted precipitation across zones and routing discharge downstream.
 *
 * @param basin - River basin containing zones and directed edges
 * @param initialConditions - Starting zone states at T=0
 * @param forecastHours - Duration of forward projection in hours (default 24h)
 * @param rainfallForecast - Optional zone-by-zone forecasted precipitation scenario
 * @returns Complete hourly state matrix for all zones
 */
export function simulateFloodPropagation(
  basin: Basin,
  initialConditions: Zone[],
  forecastHours: number = 24,
  rainfallForecast?: BasinRainfallForecast | null
): BasinSimulationResult {
  const steps: SimulationHourStep[] = [];

  // Map zone lookup
  const zoneMap = new Map(initialConditions.map((z) => [z.id, z]));

  // Index outgoing edges by source zone
  const edgesBySource: Record<string, FlowEdge[]> = {};
  for (const edge of basin.edges) {
    const src = edge.upstreamZone || edge.sourceZoneId;
    if (!edgesBySource[src]) edgesBySource[src] = [];
    edgesBySource[src].push(edge);
  }

  // Transit schedule queue: transitSchedule[zoneId][arrivalHour] = incomingFlowM3PerSec
  const transitSchedule: Record<string, Record<number, number>> = {};

  // Current simulation state tracking
  const currentStates: Record<
    string,
    {
      waterLevel: number;
      incomingFlow: number;
      outgoingFlow: number;
      rainfall: number;
      soilSaturation: number;
      dangerThreshold: number;
      areaKm2: number;
      slope: number;
      storageCapacity: number;
      soilType: string;
      porosity: number;
      infiltrationCapacity: number;
      currentSoilMoisture: number;
      saturation: number;
      remainingStorage: number;
      elevation: number;
    }
  > = {};

  // Initialize from initial conditions
  for (const zone of initialConditions) {
    const dangerThreshold = zone.dangerThreshold || zone.currentState.dangerThreshold || 6.0;
    const currentWaterLevel = zone.currentWaterLevelMeters || zone.currentState.currentWaterLevel || 3.0;
    const incomingFlow = zone.currentState.incomingFlow || 0;
    const outgoingFlow = zone.currentState.outgoingFlow || Math.round(incomingFlow * 0.9);
    const rainfall = zone.currentState.rainfallCurrent || 0;
    const saturation = zone.currentState.saturation || zone.currentState.soilSaturation || 75;
    const slope = zone.currentState.slope || zone.currentState.terrain?.averageSlopePercent || 10;
    const storageCapacity = zone.storageCapacity || zone.areaKm2 * 100_000;
    const soilType = zone.currentState.soilType || zone.currentState.terrain?.soilType || 'Alluvial Silt Loam';
    const porosity = zone.currentState.porosity || 0.45;
    const infiltrationCapacity = zone.currentState.infiltrationCapacity || 32.0;
    const currentSoilMoisture = zone.currentState.currentSoilMoisture || 34.0;
    const remainingStorage = zone.currentState.remainingStorage ?? calculateRemainingStorage(400, porosity, saturation);
    const elevation = zone.elevationMeters || zone.currentState.elevation || 100;

    currentStates[zone.id] = {
      waterLevel: currentWaterLevel,
      incomingFlow,
      outgoingFlow,
      rainfall,
      soilSaturation: saturation,
      dangerThreshold,
      areaKm2: zone.areaKm2,
      slope,
      storageCapacity,
      soilType,
      porosity,
      infiltrationCapacity,
      currentSoilMoisture,
      saturation,
      remainingStorage,
      elevation,
    };
  }

  // Pre-seed any initial flows already in transit based on baseline edge discharges
  for (const edge of basin.edges) {
    const target = edge.downstreamZone || edge.targetZoneId;
    const travelTime = Math.max(1, Math.round(edge.travelTimeHours || edge.transitTimeHours || 1));
    const factor = edge.transmissionFactor ?? 0.92;
    const initialFlow = Math.round(edge.currentDischargeM3PerSec * factor);

    if (!transitSchedule[target]) transitSchedule[target] = {};
    for (let h = 1; h <= travelTime; h++) {
      transitSchedule[target][h] = (transitSchedule[target][h] || 0) + initialFlow / travelTime;
    }
  }

  const baseDate = new Date('2026-09-13T00:00:00Z');

  // Step 0: Initial State (T=0)
  const stepZeroStates: Record<string, ZoneSimulationState> = {};
  const stepZeroEdgeDischarges: Record<string, number> = {};

  for (const zone of initialConditions) {
    const state = currentStates[zone.id];
    const risk = calculateRisk(state.waterLevel, state.dangerThreshold, 0);
    const initialRiskExp = calculateRiskExplanation({
      waterLevel: state.waterLevel,
      dangerThreshold: state.dangerThreshold,
      riseRate: 0,
      rainfallMmPerHour: state.rainfall,
      soilSaturation: state.saturation,
      incomingFlow: state.incomingFlow,
      flowCapacity: 1600,
      slopePercent: state.slope,
      elevationMeters: state.elevation,
      remainingStorageMm: state.remainingStorage,
    });

    stepZeroStates[zone.id] = {
      timestepHour: 0,
      waterLevel: state.waterLevel,
      waterLevelRiseRate: 0,
      incomingFlow: state.incomingFlow,
      outgoingFlow: state.outgoingFlow,
      rainfall: state.rainfall,
      soilSaturation: state.saturation,
      riskLevel: risk,
      dangerThreshold: state.dangerThreshold,
      soilType: state.soilType,
      porosity: state.porosity,
      infiltrationCapacity: state.infiltrationCapacity,
      currentSoilMoisture: state.currentSoilMoisture,
      saturation: state.saturation,
      remainingStorage: state.remainingStorage,
      actualInfiltration: 0,
      surfaceRunoff: 0,
      riskExplanation: initialRiskExp,
    };
  }

  for (const edge of basin.edges) {
    stepZeroEdgeDischarges[edge.id] = edge.currentDischargeM3PerSec;
  }

  steps.push({
    hour: 0,
    timestamp: baseDate.toISOString(),
    label: 'T-0 (Current Baseline)',
    zoneStates: stepZeroStates,
    edgeDischarges: stepZeroEdgeDischarges,
  });

  // Simulate forward for hours 1 to forecastHours
  for (let hour = 1; hour <= forecastHours; hour++) {
    const hourTimestamp = new Date(baseDate.getTime() + hour * 3600 * 1000).toISOString();
    const hourZoneStates: Record<string, ZoneSimulationState> = {};
    const hourEdgeDischarges: Record<string, number> = {};

    // 1. Calculate incoming flows, soil infiltration and updated rainfall for this hour
    for (const zone of initialConditions) {
      const state = currentStates[zone.id];

      // 1. Determine hourly rainfall from forecast if available, else use fallback curve
      let simulatedRain: number;
      const zoneForecast = rainfallForecast?.zones[zone.id];
      if (zoneForecast && zoneForecast.hourlyRainfallMm[hour - 1] !== undefined) {
        simulatedRain = zoneForecast.hourlyRainfallMm[hour - 1];
      } else {
        const stormDecay = Math.max(0.05, Math.exp(-Math.pow((hour - 2.5) / 4.5, 2)));
        simulatedRain = parseFloat((state.rainfall * stormDecay).toFixed(1));
      }

      // 2. Explainable Infiltration Model: partition rainfall into infiltration vs surface runoff
      const { actualInfiltrationMmPerHour, surfaceRunoffMmPerHour } =
        partitionRainfallInfiltration(
          simulatedRain,
          state.infiltrationCapacity,
          state.saturation,
          state.remainingStorage
        );

      // 3. Update Soil State (moisture increases, remaining storage depletes, capacity decays)
      const soilUpdate = updateSoilState(
        state.saturation,
        state.porosity,
        actualInfiltrationMmPerHour,
        0.7,
        400,
        34.0
      );
      state.currentSoilMoisture = soilUpdate.currentSoilMoisture;
      state.saturation = soilUpdate.saturation;
      state.soilSaturation = soilUpdate.saturation;
      state.remainingStorage = soilUpdate.remainingStorage;
      state.infiltrationCapacity = soilUpdate.infiltrationCapacity;

      // Inflow from scheduled transit arrivals at this hour
      const scheduledInflow = Math.round(transitSchedule[zone.id]?.[hour] || 0);

      // Direct overland surface runoff generated from excess precipitation
      const isHeadwater = (zone.upstreamZoneIds || []).length === 0;
      const runoffScale = isHeadwater ? 0.24 : 0.06;
      const saturationMultiplier = Math.max(0.6, state.saturation / 65);
      const localRunoffInflow = Math.round(
        (surfaceRunoffMmPerHour + simulatedRain * 0.1) * state.areaKm2 * runoffScale * saturationMultiplier
      );
      const totalIncomingFlow = scheduledInflow + localRunoffInflow;
      state.incomingFlow = totalIncomingFlow;

      // 4. Update Zone Water Level
      const { newWaterLevel, riseRate } = updateZoneWaterLevel(
        state.waterLevel,
        totalIncomingFlow,
        state.outgoingFlow,
        surfaceRunoffMmPerHour,
        state.areaKm2,
        state.saturation
      );
      state.waterLevel = newWaterLevel;

      // 5. Calculate Outgoing Flow
      const outgoingEdges = edgesBySource[zone.id] || [];
      const baseCapacity = outgoingEdges.reduce((acc, e) => acc + e.flowCapacityM3PerSec, 0) || 1200;
      const newOutgoingFlow = calculateOutgoingFlow(
        newWaterLevel,
        state.dangerThreshold,
        state.slope,
        baseCapacity
      );
      state.outgoingFlow = newOutgoingFlow;

      // 6. Propagate Flow along Outgoing Edges
      propagateFlow(newOutgoingFlow, outgoingEdges, hour, transitSchedule);

      // Record edge discharges for map animation
      if (outgoingEdges.length > 0) {
        const perEdge = Math.round(newOutgoingFlow / outgoingEdges.length);
        for (const e of outgoingEdges) {
          hourEdgeDischarges[e.id] = perEdge;
        }
      }

      // 7. Calculate Flood Risk & Explainable Contributors
      const risk = calculateRisk(newWaterLevel, state.dangerThreshold, riseRate);
      const riskExplanation = calculateRiskExplanation({
        waterLevel: newWaterLevel,
        dangerThreshold: state.dangerThreshold,
        riseRate,
        rainfallMmPerHour: simulatedRain,
        soilSaturation: state.saturation,
        incomingFlow: totalIncomingFlow,
        flowCapacity: baseCapacity,
        slopePercent: state.slope,
        elevationMeters: state.elevation,
        remainingStorageMm: state.remainingStorage,
      });

      // 8. Store Step State
      hourZoneStates[zone.id] = {
        timestepHour: hour,
        waterLevel: newWaterLevel,
        waterLevelRiseRate: riseRate,
        incomingFlow: totalIncomingFlow,
        outgoingFlow: newOutgoingFlow,
        rainfall: simulatedRain,
        soilSaturation: state.saturation,
        riskLevel: risk,
        dangerThreshold: state.dangerThreshold,
        soilType: state.soilType,
        porosity: state.porosity,
        infiltrationCapacity: state.infiltrationCapacity,
        currentSoilMoisture: state.currentSoilMoisture,
        saturation: state.saturation,
        remainingStorage: state.remainingStorage,
        actualInfiltration: actualInfiltrationMmPerHour,
        surfaceRunoff: surfaceRunoffMmPerHour,
        riskExplanation,
      };
    }

    steps.push({
      hour,
      timestamp: hourTimestamp,
      label: `T+${hour}h (Forecast)`,
      zoneStates: hourZoneStates,
      edgeDischarges: hourEdgeDischarges,
    });
  }

  return { hourlySteps: steps };
}
