import assert from 'node:assert';
import test from 'node:test';
import {
  updateZoneWaterLevel,
  calculateOutgoingFlow,
  propagateFlow,
  calculateRisk,
  simulateFloodPropagation,
} from './propagationEngine';
import { MOCK_BASINS } from '../data/mockData';
import { FlowEdge } from '../types/flood';

test('updateZoneWaterLevel increases water level when inflow exceeds outflow', () => {
  const initialLevel = 4.0;
  const incomingFlow = 1500;
  const outgoingFlow = 500;
  const rainfall = 20;
  const areaKm2 = 200;

  const result = updateZoneWaterLevel(initialLevel, incomingFlow, outgoingFlow, rainfall, areaKm2, 80);
  assert.ok(result.newWaterLevel > initialLevel, 'Water level should increase when inflow > outflow');
  assert.ok(result.riseRate > 0, 'Rise rate should be positive');
});

test('calculateOutgoingFlow increases as water level approaches danger threshold', () => {
  const dangerThreshold = 8.0;
  const slope = 10;
  const capacity = 1000;

  const lowFlow = calculateOutgoingFlow(2.0, dangerThreshold, slope, capacity);
  const midFlow = calculateOutgoingFlow(5.0, dangerThreshold, slope, capacity);
  const highFlow = calculateOutgoingFlow(9.0, dangerThreshold, slope, capacity);

  assert.ok(midFlow > lowFlow, 'Mid flow should exceed low flow');
  assert.ok(highFlow > midFlow, 'High flow should exceed mid flow as stage rises');
});

test('propagateFlow schedules flow at downstream zones according to travel time', () => {
  const schedule: Record<string, Record<number, number>> = {};
  const mockEdges: FlowEdge[] = [
    {
      id: 'edge-1',
      upstreamZone: 'zone-A',
      downstreamZone: 'zone-B',
      travelTimeHours: 2,
      transmissionFactor: 0.9,
      flowCapacityM3PerSec: 1000,
      currentDischargeM3PerSec: 500,
      sourceZoneId: 'zone-A',
      targetZoneId: 'zone-B',
      transitTimeHours: 2,
    },
  ];

  propagateFlow(500, mockEdges, 3, schedule);

  // Flow should arrive at zone-B at hour 3 + 2 = 5
  assert.strictEqual(typeof schedule['zone-B']?.[5], 'number');
  assert.strictEqual(schedule['zone-B'][5], Math.round(500 * 0.9));
});

test('calculateRisk correctly assigns risk tiers', () => {
  const threshold = 8.0;
  assert.strictEqual(calculateRisk(3.0, threshold, 0.05), 'safe');
  assert.strictEqual(calculateRisk(5.6, threshold, 0.15), 'watch');
  assert.strictEqual(calculateRisk(6.8, threshold, 0.22), 'warning');
  assert.strictEqual(calculateRisk(8.2, threshold, 0.4), 'critical');
});

test('simulateFloodPropagation deterministically simulates 24 hours of flood transit', () => {
  const basin = MOCK_BASINS[0];
  const result = simulateFloodPropagation(basin, basin.zones, 24);

  assert.strictEqual(result.hourlySteps.length, 25, 'Should have 25 steps (0 to 24 hours)');

  // Step 0 check
  const step0 = result.hourlySteps[0];
  assert.strictEqual(step0.hour, 0);
  const firstZoneId = basin.zones[0].id;
  assert.ok(step0.zoneStates[firstZoneId], `Zone ${firstZoneId} should exist in step 0`);

  // Step 24 check
  const step24 = result.hourlySteps[24];
  assert.strictEqual(step24.hour, 24);
  const lastZoneId = basin.zones[basin.zones.length - 1].id;
  assert.ok(step24.zoneStates[lastZoneId], `Zone ${lastZoneId} should exist in step 24`);

  // Verify determinism: repeating the call yields identical output
  const midZoneId = basin.zones[6].id;
  const repeat = simulateFloodPropagation(basin, basin.zones, 24);
  assert.deepStrictEqual(
    result.hourlySteps[12].zoneStates[midZoneId],
    repeat.hourlySteps[12].zoneStates[midZoneId],
    'Simulation must be strictly deterministic'
  );
});
