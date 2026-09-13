import { Basin, FlowEdge, Sensor, SensorStatus, TimeSeriesPoint, Zone } from '../types/flood';

/**
 * ============================================================================
 * DETERMINISTIC IOT SENSOR SIMULATION ENGINE
 * 
 * Physically coupled, high-frequency hydrological sensor simulation.
 * Models temporal coupling:
 * 1. Rainfall pulses dynamically infiltrate the soil stratum.
 * 2. Soil saturation dampens infiltration and accelerates surface runoff.
 * 3. Rainfall runoff and upstream channel inflows raise the river stage.
 * 4. High upstream discharge propagates downstream with hydrodynamic routing delay.
 * 5. Water level rise rates smoothly evolve with channel momentum and storage.
 * 
 * Strictly deterministic (no non-reproducible Math.random() in physics updates).
 * ============================================================================
 */

export interface PhysicalZoneState {
  zoneId: string;
  rainfallMmH: number;
  soilMoisturePct: number;
  waterLevelM: number;
  riseRateMPerHour: number;
  upstreamInflowM3s: number;
  dangerThresholdM: number;
}

/**
 * Generate initial sensor network across basin zones.
 * Each zone receives 3 calibrated sensors:
 * - Water level ultrasonic/radar gauge
 * - Tipping-bucket precipitation gauge
 * - Volumetric soil moisture TDR probe
 */
export function generateInitialSensors(zones: Zone[]): Sensor[] {
  const sensors: Sensor[] = [];

  zones.forEach((zone) => {
    const [clng, clat] = zone.coordinates;
    const now = new Date().toISOString();

    // 1. Water Level Gauge (river channel center)
    const initialWaterLevel = zone.currentWaterLevelMeters || 5.0;
    const waterHistory: TimeSeriesPoint[] = (zone.currentState?.waterLevelHistory || []).slice(-6);
    sensors.push({
      id: `sensor-wl-${zone.code.toLowerCase()}`,
      sensorId: `sensor-wl-${zone.code.toLowerCase()}`,
      zoneId: zone.id,
      name: `${zone.name} River Stage Radar`,
      type: 'water_level',
      value: initialWaterLevel,
      unit: 'm',
      timestamp: now,
      status: 'active',
      coordinates: [clng, clat],
      history: waterHistory.length > 0 ? waterHistory : [{ time: 'Now', value: initialWaterLevel }],
      lastReading: {
        value: initialWaterLevel,
        unit: 'm',
        timestamp: now,
      },
      isSynthetic: true,
    });

    // 2. Rainfall Gauge (elevated north-bank station)
    const initialRain = zone.currentState?.rainfallCurrent || 15.0;
    const rainHistory: TimeSeriesPoint[] = (zone.currentState?.rainfallHistory || []).slice(-6);
    sensors.push({
      id: `sensor-rain-${zone.code.toLowerCase()}`,
      sensorId: `sensor-rain-${zone.code.toLowerCase()}`,
      zoneId: zone.id,
      name: `${zone.name} Precipitation AWS`,
      type: 'rainfall',
      value: initialRain,
      unit: 'mm/h',
      timestamp: now,
      status: 'active',
      coordinates: [parseFloat((clng - 0.04).toFixed(4)), parseFloat((clat + 0.03).toFixed(4))],
      history: rainHistory.length > 0 ? rainHistory : [{ time: 'Now', value: initialRain }],
      lastReading: {
        value: initialRain,
        unit: 'mm/h',
        timestamp: now,
      },
      isSynthetic: true,
    });

    // 3. Soil Moisture Probe (floodplain alluvium)
    const initialSoil = zone.currentState?.soilMoisture || 78.0;
    sensors.push({
      id: `sensor-soil-${zone.code.toLowerCase()}`,
      sensorId: `sensor-soil-${zone.code.toLowerCase()}`,
      zoneId: zone.id,
      name: `${zone.name} Floodplain TDR Probe`,
      type: 'soil_moisture',
      value: initialSoil,
      unit: '%',
      timestamp: now,
      status: 'active',
      coordinates: [parseFloat((clng + 0.035).toFixed(4)), parseFloat((clat - 0.025).toFixed(4))],
      history: [{ time: 'Now', value: initialSoil }],
      lastReading: {
        value: initialSoil,
        unit: '%',
        timestamp: now,
      },
      isSynthetic: true,
    });
  });

  return sensors;
}

/**
 * Deterministic pseudo-random harmonic based on tickIndex and seed.
 * Ensures 100% reproducible micro-variations without Math.random().
 */
function deterministicHarmonic(tick: number, seed: number): number {
  return Math.sin(tick * 0.45 + seed * 1.7) * 0.6 + Math.cos(tick * 0.18 + seed * 3.1) * 0.4;
}

/**
 * Simulate single IoT sensor tick.
 * Updates physical state across all sensors with coupled hydrology.
 * 
 * @param currentSensors Current sensor state array
 * @param basin River basin graph with zones and flow edges
 * @param tickIndex Monotonically increasing tick counter (e.g. 0, 1, 2, ...)
 * @param stormIntensityMultiplier External forcing multiplier (default 1.0)
 */
export function simulateSensorTick(
  currentSensors: Sensor[],
  basin: Basin,
  tickIndex: number,
  stormIntensityMultiplier: number = 1.0
): Sensor[] {
  const timestamp = new Date().toISOString();

  // Group current sensors by zone
  const sensorsByZone: Record<string, { wl?: Sensor; rain?: Sensor; soil?: Sensor }> = {};
  currentSensors.forEach((s) => {
    if (!sensorsByZone[s.zoneId]) sensorsByZone[s.zoneId] = {};
    if (s.type === 'water_level') sensorsByZone[s.zoneId].wl = s;
    if (s.type === 'rainfall') sensorsByZone[s.zoneId].rain = s;
    if (s.type === 'soil_moisture') sensorsByZone[s.zoneId].soil = s;
  });

  // Calculate upstream river stage excess for downstream propagation
  const stageExcessByZone: Record<string, number> = {};
  basin.zones.forEach((z) => {
    const wlSensor = sensorsByZone[z.id]?.wl;
    const currentWl = wlSensor ? wlSensor.value : z.currentWaterLevelMeters;
    const baseWl = z.currentWaterLevelMeters * 0.75;
    stageExcessByZone[z.id] = Math.max(0, currentWl - baseWl);
  });

  // Update sensors zone-by-zone with coupled physical equations
  return currentSensors.map((sensor, sIdx) => {
    const zone = basin.zones.find((z) => z.id === sensor.zoneId);
    if (!zone) return sensor;

    const zoneIdx = basin.zones.indexOf(zone);
    const dangerLimit = zone.dangerThreshold || 10.0;
    let newValue = sensor.value;
    let status: SensorStatus = sensor.status;

    if (sensor.type === 'rainfall') {
      // 1. Rainfall Dynamics:
      // Orographic storm wave moving from northeast (headwaters) to southwest, modulated by tick
      const phaseOffset = zoneIdx * 0.35;
      const stormCycle = Math.sin((tickIndex * 0.15) - phaseOffset);
      const stormPulse = Math.max(0, stormCycle) * 18.0 * stormIntensityMultiplier;
      const microVar = deterministicHarmonic(tickIndex, zoneIdx) * 1.2;
      const baseRain = Math.max(2.0, (zone.currentState?.rainfallCurrent || 10.0) * 0.4);

      newValue = Math.max(0, parseFloat((baseRain + stormPulse + microVar).toFixed(1)));
      // Sensor status remains active unless severe lightning or storm surge
      status = newValue > 65 ? 'degraded' : 'active';
    } else if (sensor.type === 'soil_moisture') {
      // 2. Soil Moisture Infiltration Dynamics:
      // Infiltration depends on rainfall and available pore space (100 - currentMoisture)
      const rainSensor = sensorsByZone[sensor.zoneId]?.rain;
      const currentRain = rainSensor ? rainSensor.value : 10.0;

      const poreSpaceFraction = Math.max(0.05, (100 - sensor.value) / 100);
      const infiltrationGain = (currentRain / 20.0) * 0.85 * poreSpaceFraction;

      // Natural percolation & drainage drainage loss
      const baseMoisture = Math.max(45, zone.elevation > 100 ? 65 : 75);
      const drainageLoss = Math.max(0, (sensor.value - baseMoisture) * 0.04);

      const deltaSoil = infiltrationGain - drainageLoss;
      newValue = Math.min(99.4, Math.max(30.0, parseFloat((sensor.value + deltaSoil).toFixed(1))));
      status = 'active';
    } else if (sensor.type === 'water_level') {
      // 3. Water Level & River Stage Dynamics:
      const rainSensor = sensorsByZone[sensor.zoneId]?.rain;
      const soilSensor = sensorsByZone[sensor.zoneId]?.soil;
      const currentRain = rainSensor ? rainSensor.value : 10.0;
      const currentSoil = soilSensor ? soilSensor.value : 80.0;

      // Surface runoff is amplified as soil moisture reaches saturation (>80%)
      const saturationRatio = Math.max(0, currentSoil / 100);
      const runoffCoefficient = Math.pow(saturationRatio, 2.5); // non-linear runoff exponent
      const localRunoffContribution = (currentRain / 100) * runoffCoefficient * 0.28;

      // Upstream Hydrodynamic Inflow:
      // Directed flow edges route excess water from upstream zones
      let upstreamInflowDelta = 0;
      zone.upstreamZoneIds.forEach((upId) => {
        const upExcess = stageExcessByZone[upId] || 0;
        const edge = basin.edges.find((e) => (e.upstreamZone === upId || e.sourceZoneId === upId) && (e.downstreamZone === zone.id || e.targetZoneId === zone.id));
        const transmission = edge?.transmissionFactor ?? 0.94;
        upstreamInflowDelta += upExcess * 0.045 * transmission;
      });

      // Channel Discharge / Outflow Drainage:
      // Higher stage accelerates gravity drainage
      const drainageDischarge = Math.max(0.01, (sensor.value / dangerLimit) * 0.06);

      const netStageDelta = localRunoffContribution + upstreamInflowDelta - drainageDischarge;
      const smoothedDelta = Math.min(0.25, Math.max(-0.15, netStageDelta));
      newValue = Math.max(0.8, parseFloat((sensor.value + smoothedDelta).toFixed(2)));

      // Sensor status degrades if water level breaches extreme threshold (>98% danger)
      status = newValue >= dangerLimit * 0.98 ? 'degraded' : 'active';
    }

    // Maintain a rolling history window of the last 12 readings
    const updatedHistory: TimeSeriesPoint[] = [
      ...(sensor.history || []).slice(-11),
      { time: `+${(tickIndex % 60) * 2}s`, value: newValue },
    ];

    return {
      ...sensor,
      value: newValue,
      timestamp,
      status,
      history: updatedHistory,
      lastReading: {
        value: newValue,
        unit: sensor.unit,
        timestamp,
      },
    };
  });
}
