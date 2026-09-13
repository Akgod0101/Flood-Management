import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRemainingStorage,
  calculateEffectiveInfiltrationCapacity,
  partitionRainfallInfiltration,
  updateSoilState,
} from './soilInfiltrationModel';
import { calculateRiskExplanation } from './riskExplanationEngine';

test('calculateRemainingStorage correctly decreases as saturation increases', () => {
  const rootDepth = 400; // mm
  const porosity = 0.45; // total pore storage = 180 mm

  const dryStorage = calculateRemainingStorage(rootDepth, porosity, 30);
  const midStorage = calculateRemainingStorage(rootDepth, porosity, 70);
  const saturatedStorage = calculateRemainingStorage(rootDepth, porosity, 100);

  assert.equal(dryStorage, 126.0); // 180 * (1 - 0.3)
  assert.equal(midStorage, 54.0);  // 180 * (1 - 0.7)
  assert.equal(saturatedStorage, 0.0); // 180 * (1 - 1.0)
});

test('calculateEffectiveInfiltrationCapacity decays non-linearly with saturation', () => {
  const dryCapacity = calculateEffectiveInfiltrationCapacity(35.0, 30);
  const midCapacity = calculateEffectiveInfiltrationCapacity(35.0, 75);
  const wetCapacity = calculateEffectiveInfiltrationCapacity(35.0, 95);

  assert.ok(dryCapacity > midCapacity, 'Dry capacity must exceed mid-saturation capacity');
  assert.ok(midCapacity > wetCapacity, 'Mid-saturation capacity must exceed wet capacity');
  assert.ok(wetCapacity >= 2.0, 'Capacity should not drop below minimum percolation (2.0 mm/h)');
});

test('partitionRainfallInfiltration: rainfall first infiltrates up to capacity, excess becomes runoff', () => {
  // Case A: Light rain (8 mm/h) on dry soil (capacity ~25 mm/h, storage 60mm)
  const lightRain = partitionRainfallInfiltration(8.0, 32.0, 50, 60.0);
  assert.equal(lightRain.actualInfiltrationMmPerHour, 8.0, 'All light rain should infiltrate');
  assert.equal(lightRain.surfaceRunoffMmPerHour, 0.0, 'No surface runoff generated');
  assert.equal(lightRain.runoffFraction, 0.0);

  // Case B: Heavy rain (45 mm/h) on saturated soil (capacity ~4 mm/h, storage 10mm)
  const heavyRain = partitionRainfallInfiltration(45.0, 32.0, 95, 10.0);
  assert.ok(heavyRain.actualInfiltrationMmPerHour <= 4.0, 'Infiltration constrained by degraded capacity');
  assert.ok(heavyRain.surfaceRunoffMmPerHour >= 41.0, 'Excess rainfall becomes direct surface runoff');
  assert.ok(heavyRain.runoffFraction > 0.9, 'Over 90% of rain should become surface runoff');
});

test('updateSoilState correctly tracks moisture, saturation and capacity', () => {
  const initialState = {
    saturation: 60,
    porosity: 0.44,
  };

  // Infiltrate 15 mm of rain with 0.8 mm drainage
  const updated = updateSoilState(initialState.saturation, initialState.porosity, 15.0, 0.8);

  assert.ok(updated.saturation > initialState.saturation, 'Saturation must increase with infiltration');
  assert.ok(updated.currentSoilMoisture > 26.0, 'Volumetric moisture must reflect increased water content');
  assert.ok(updated.remainingStorage < 70.0, 'Remaining storage must decrease');
  assert.ok(updated.infiltrationCapacity < 32.0, 'Infiltration capacity should decay as saturation increases');
});

test('calculateRiskExplanation calculates transparent weighted contributors matching expected breakdown', () => {
  // Scenario representing severe flood risk in an Assam floodplain reach
  const explanation = calculateRiskExplanation({
    waterLevel: 9.8,
    dangerThreshold: 10.0,
    riseRate: 0.38,
    rainfallMmPerHour: 48.0,
    soilSaturation: 94.0,
    incomingFlow: 2400,
    flowCapacity: 2000,
    slopePercent: 3.5,
    elevationMeters: 95,
    remainingStorageMm: 8.5,
  });

  // Verify total risk score and critical classification
  assert.ok(explanation.totalRiskScore >= 80, `Total risk score (${explanation.totalRiskScore}%) should be >= 80%`);
  assert.equal(explanation.riskLevel, 'critical');

  // Verify 5 contributors exist
  assert.equal(explanation.contributors.length, 5);

  const [rain, soil, inflow, rise, terrain] = explanation.contributors;

  assert.equal(rain.name, 'Heavy rainfall');
  assert.ok(rain.points >= 22 && rain.points <= 30, `Rainfall points (${rain.points}) should be between 22 and 30`);

  assert.equal(soil.name, 'High soil saturation');
  assert.ok(soil.points >= 17 && soil.points <= 25, `Soil points (${soil.points}) should be between 17 and 25`);

  assert.equal(inflow.name, 'Upstream inflow');
  assert.ok(inflow.points >= 18 && inflow.points <= 25, `Inflow points (${inflow.points}) should be between 18 and 25`);

  assert.equal(rise.name, 'Rapid water rise');
  assert.ok(rise.points >= 10 && rise.points <= 15, `Rise points (${rise.points}) should be between 10 and 15`);

  assert.equal(terrain.name, 'Low terrain / storage');
  assert.ok(terrain.points >= 6 && terrain.points <= 10, `Terrain points (${terrain.points}) should be between 6 and 10`);

  // Sum of contributor points matches total risk score
  const sumPoints = rain.points + soil.points + inflow.points + rise.points + terrain.points;
  assert.equal(explanation.totalRiskScore, Math.min(99, Math.max(5, sumPoints)));
});
