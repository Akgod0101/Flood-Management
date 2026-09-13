import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIntensity,
  calculateBaselineRainfall,
  generateZoneRainfallForecast,
  generateBasinRainfallForecast,
} from './forecastGenerator';
import { simulateFloodPropagation } from './propagationEngine';
import { ASSAM_BRAHMAPUTRA_BASIN } from '../data/mock/mockAssamScaffold';

test('classifyIntensity maps correctly to meteorological intensity tiers', () => {
  assert.equal(classifyIntensity(1.2), 'light');
  assert.equal(classifyIntensity(5.0), 'moderate');
  assert.equal(classifyIntensity(15.0), 'heavy');
  assert.equal(classifyIntensity(30.0), 'very_heavy');
  assert.equal(classifyIntensity(55.0), 'extreme');
});

test('generateZoneRainfallForecast produces strictly monotonic cumulative horizons', () => {
  const zone = ASSAM_BRAHMAPUTRA_BASIN.zones[0]; // Sadiya & Siang Confluence
  const forecast = generateZoneRainfallForecast(zone, 'heavy');

  assert.equal(forecast.zoneId, zone.id);
  assert.equal(forecast.scenario, 'heavy');
  assert.equal(forecast.hourlyRainfallMm.length, 24);

  // Cumulative horizons must be monotonically non-decreasing
  assert.ok(forecast.next1h <= forecast.next3h, 'next1h <= next3h');
  assert.ok(forecast.next3h <= forecast.next6h, 'next3h <= next6h');
  assert.ok(forecast.next6h <= forecast.next12h, 'next6h <= next12h');
  assert.ok(forecast.next12h <= forecast.next24h, 'next12h <= next24h');
  assert.equal(forecast.accumulatedRainfall, forecast.next24h);
});

test('scenarios dynamically scale precipitation volumes and anomalies', () => {
  const zone = ASSAM_BRAHMAPUTRA_BASIN.zones[1]; // Dibang-Lohit Inflow Reach

  const normalFc = generateZoneRainfallForecast(zone, 'normal');
  const heavyFc = generateZoneRainfallForecast(zone, 'heavy');
  const extremeFc = generateZoneRainfallForecast(zone, 'extreme');

  // Accumulation scaling
  assert.ok(
    normalFc.accumulatedRainfall < heavyFc.accumulatedRainfall,
    `Normal (${normalFc.accumulatedRainfall}mm) must be < Heavy (${heavyFc.accumulatedRainfall}mm)`
  );
  assert.ok(
    heavyFc.accumulatedRainfall < extremeFc.accumulatedRainfall,
    `Heavy (${heavyFc.accumulatedRainfall}mm) must be < Extreme (${extremeFc.accumulatedRainfall}mm)`
  );

  // Anomaly percentage scaling
  assert.ok(
    heavyFc.rainfallAnomalyPercentage > normalFc.rainfallAnomalyPercentage,
    'Heavy anomaly must exceed normal anomaly'
  );
  assert.ok(
    extremeFc.rainfallAnomalyPercentage > 150,
    `Extreme anomaly (${extremeFc.rainfallAnomalyPercentage}%) should exceed +150%`
  );

  // Intensity categories
  assert.ok(['light', 'moderate'].includes(normalFc.rainfallIntensity));
  assert.ok(['heavy', 'very_heavy', 'extreme'].includes(heavyFc.rainfallIntensity));
  assert.equal(extremeFc.rainfallIntensity, 'extreme');
});

test('generateBasinRainfallForecast aggregates metrics across all 20 reaches', () => {
  const basinForecast = generateBasinRainfallForecast(ASSAM_BRAHMAPUTRA_BASIN, 'heavy');

  assert.equal(basinForecast.scenario, 'heavy');
  assert.equal(Object.keys(basinForecast.zones).length, 20);
  assert.ok(basinForecast.basinAverageAccumulated24h > 50);
  assert.ok(basinForecast.basinAverageAnomalyPercentage > 0);
  assert.ok(basinForecast.highestRiskZoneId.length > 0);
});

test('downstream flood propagation visibly escalates under extreme rainfall scenario', () => {
  const basin = ASSAM_BRAHMAPUTRA_BASIN;

  // Run simulation under Normal scenario
  const normalForecast = generateBasinRainfallForecast(basin, 'normal');
  const normalSim = simulateFloodPropagation(basin, basin.zones, 24, normalForecast);

  // Run simulation under Extreme scenario
  const extremeForecast = generateBasinRainfallForecast(basin, 'extreme');
  const extremeSim = simulateFloodPropagation(basin, basin.zones, 24, extremeForecast);

  // Inspect downstream reaches (e.g. Guwahati, Goalpara, Dhubri) at Hour 18-24
  const finalNormalStep = normalSim.hourlySteps[24];
  const finalExtremeStep = extremeSim.hourlySteps[24];

  // Count elevated risk zones (warning or critical)
  const normalElevatedCount = Object.values(finalNormalStep.zoneStates).filter(
    (s) => s.riskLevel === 'critical' || s.riskLevel === 'warning'
  ).length;

  const extremeElevatedCount = Object.values(finalExtremeStep.zoneStates).filter(
    (s) => s.riskLevel === 'critical' || s.riskLevel === 'warning'
  ).length;

  // Extreme scenario must visibly escalate elevated risk reaches compared to normal
  assert.ok(
    extremeElevatedCount > normalElevatedCount,
    `Extreme elevated zones (${extremeElevatedCount}) must exceed normal (${normalElevatedCount})`
  );

  // Downstream zone: Guwahati Choke Reach (zone-as-16)
  const downstreamZoneId = 'zone-as-16';
  const normalGuwahati = finalNormalStep.zoneStates[downstreamZoneId];
  const extremeGuwahati = finalExtremeStep.zoneStates[downstreamZoneId];

  assert.ok(
    extremeGuwahati.waterLevel > normalGuwahati.waterLevel,
    `Guwahati stage under extreme (${extremeGuwahati.waterLevel}m) must exceed normal (${normalGuwahati.waterLevel}m)`
  );
  assert.ok(
    extremeGuwahati.incomingFlow > normalGuwahati.incomingFlow,
    `Guwahati inflow under extreme (${extremeGuwahati.incomingFlow} m3/s) must exceed normal (${normalGuwahati.incomingFlow} m3/s)`
  );
});
