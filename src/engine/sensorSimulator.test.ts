import assert from 'node:assert';
import test from 'node:test';
import {
  generateInitialSensors,
  simulateSensorTick,
} from './sensorSimulator';
import { ASSAM_BRAHMAPUTRA_BASIN } from '../data/mock/mockAssamScaffold';
import { Sensor } from '../types/flood';

test('generateInitialSensors creates 3 sensors per zone with valid coordinates and types', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;
  const sensors = generateInitialSensors(basin.zones);

  assert.strictEqual(sensors.length, basin.zones.length * 3, 'Should generate exactly 3 sensors per zone');

  const zone1Sensors = sensors.filter((s) => s.zoneId === basin.zones[0].id);
  assert.strictEqual(zone1Sensors.length, 3);

  const types = zone1Sensors.map((s) => s.type);
  assert.ok(types.includes('water_level'), 'Must include water_level sensor');
  assert.ok(types.includes('rainfall'), 'Must include rainfall sensor');
  assert.ok(types.includes('soil_moisture'), 'Must include soil_moisture sensor');

  // Verify coordinates are numbers within Assam geographic box
  zone1Sensors.forEach((s) => {
    assert.strictEqual(typeof s.coordinates[0], 'number');
    assert.strictEqual(typeof s.coordinates[1], 'number');
    assert.ok(s.coordinates[0] >= 89 && s.coordinates[0] <= 97, 'Longitude must be in Assam bounds');
    assert.ok(s.coordinates[1] >= 25 && s.coordinates[1] <= 29, 'Latitude must be in Assam bounds');
  });
});

test('rainfall dynamically increases soil moisture through infiltration', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;
  const initialSensors = generateInitialSensors(basin.zones);

  // Set rainfall high on zone 0 and soil moisture relatively low
  const testSensors: Sensor[] = initialSensors.map((s) => {
    if (s.zoneId === basin.zones[0].id && s.type === 'rainfall') {
      return { ...s, value: 45.0 };
    }
    if (s.zoneId === basin.zones[0].id && s.type === 'soil_moisture') {
      return { ...s, value: 60.0 };
    }
    return s;
  });

  const nextSensors = simulateSensorTick(testSensors, basin, 1, 2.0);
  const updatedSoil = nextSensors.find(
    (s) => s.zoneId === basin.zones[0].id && s.type === 'soil_moisture'
  );

  assert.ok(updatedSoil, 'Updated soil sensor must exist');
  assert.ok(
    updatedSoil.value > 60.0,
    `Soil moisture should increase from 60.0 under high rainfall (got ${updatedSoil.value})`
  );
});

test('soil saturation accelerates water level rise compared to dry soil', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;
  const initialSensors = generateInitialSensors(basin.zones);

  // Scenario A: Dry soil (45%)
  const drySensors: Sensor[] = initialSensors.map((s) => {
    if (s.zoneId === basin.zones[0].id && s.type === 'rainfall') return { ...s, value: 35.0 };
    if (s.zoneId === basin.zones[0].id && s.type === 'soil_moisture') return { ...s, value: 45.0 };
    if (s.zoneId === basin.zones[0].id && s.type === 'water_level') return { ...s, value: 5.0 };
    return s;
  });

  // Scenario B: Saturated soil (95%)
  const satSensors: Sensor[] = initialSensors.map((s) => {
    if (s.zoneId === basin.zones[0].id && s.type === 'rainfall') return { ...s, value: 35.0 };
    if (s.zoneId === basin.zones[0].id && s.type === 'soil_moisture') return { ...s, value: 95.0 };
    if (s.zoneId === basin.zones[0].id && s.type === 'water_level') return { ...s, value: 5.0 };
    return s;
  });

  const afterDry = simulateSensorTick(drySensors, basin, 1, 1.0);
  const afterSat = simulateSensorTick(satSensors, basin, 1, 1.0);

  const dryWl = afterDry.find((s) => s.zoneId === basin.zones[0].id && s.type === 'water_level')!;
  const satWl = afterSat.find((s) => s.zoneId === basin.zones[0].id && s.type === 'water_level')!;

  assert.ok(
    satWl.value > dryWl.value,
    `Saturated soil should cause higher water level rise (${satWl.value} vs ${dryWl.value})`
  );
});

test('upstream high water level propagates downstream to connected zone', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;
  const initialSensors = generateInitialSensors(basin.zones);

  const upstreamZone = basin.zones[0]; // Sadiya
  const downstreamZone = basin.zones[1]; // Dibang-Lohit

  // Case 1: Low upstream stage
  const lowUpstreamSensors: Sensor[] = initialSensors.map((s) => {
    if (s.zoneId === upstreamZone.id && s.type === 'water_level') return { ...s, value: 2.0 };
    if (s.zoneId === downstreamZone.id && s.type === 'water_level') return { ...s, value: 5.0 };
    return s;
  });

  // Case 2: High upstream stage (surge)
  const highUpstreamSensors: Sensor[] = initialSensors.map((s) => {
    if (s.zoneId === upstreamZone.id && s.type === 'water_level') return { ...s, value: 9.5 };
    if (s.zoneId === downstreamZone.id && s.type === 'water_level') return { ...s, value: 5.0 };
    return s;
  });

  const resultLow = simulateSensorTick(lowUpstreamSensors, basin, 1);
  const resultHigh = simulateSensorTick(highUpstreamSensors, basin, 1);

  const downWlLow = resultLow.find((s) => s.zoneId === downstreamZone.id && s.type === 'water_level')!;
  const downWlHigh = resultHigh.find((s) => s.zoneId === downstreamZone.id && s.type === 'water_level')!;

  assert.ok(
    downWlHigh.value > downWlLow.value,
    `High upstream river stage should propagate to downstream zone (${downWlHigh.value} vs ${downWlLow.value})`
  );
});

test('simulateSensorTick is strictly deterministic and reproducible', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;
  const sensors = generateInitialSensors(basin.zones);

  const run1 = simulateSensorTick(sensors, basin, 42, 1.5);
  const run2 = simulateSensorTick(sensors, basin, 42, 1.5);

  assert.strictEqual(run1.length, run2.length);

  for (let i = 0; i < run1.length; i++) {
    assert.strictEqual(run1[i].value, run2[i].value, `Sensor ${run1[i].id} value must be identical`);
    assert.strictEqual(run1[i].status, run2[i].status, `Sensor ${run1[i].id} status must be identical`);
  }
});
