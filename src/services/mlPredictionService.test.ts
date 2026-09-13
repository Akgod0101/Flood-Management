import test from 'node:test';
import assert from 'node:assert/strict';
import { predictZoneFlood, predictAllZones } from './mlPredictionService';
import { ASSAM_BRAHMAPUTRA_BASIN } from '../data/mock/mockAssamScaffold';
import { generateBasinRainfallForecast } from '../engine/forecastGenerator';

test('predictZoneFlood gracefully handles live ML API prediction with multi-horizon probabilities', async () => {
  const zone = ASSAM_BRAHMAPUTRA_BASIN.zones[0];
  const forecast = generateBasinRainfallForecast(ASSAM_BRAHMAPUTRA_BASIN, 'normal');
  const zoneForecast = forecast.zones[zone.id];

  const prediction = await predictZoneFlood(zone, zoneForecast);

  assert.ok(prediction);
  assert.equal(prediction.zone_id, zone.id);
  assert.ok(prediction.probabilities.flood_probability_1h >= 0 && prediction.probabilities.flood_probability_1h <= 1);
  assert.ok(prediction.probabilities.flood_probability_3h >= 0 && prediction.probabilities.flood_probability_3h <= 1);
  assert.ok(prediction.probabilities.flood_probability_6h >= 0 && prediction.probabilities.flood_probability_6h <= 1);
  assert.ok(['critical', 'warning', 'watch', 'safe'].includes(prediction.risk_tier));
  assert.ok(typeof prediction.confidence === 'number' && prediction.confidence > 0);
  assert.ok(typeof prediction.isAvailable === 'boolean');
});

test('predictAllZones maps predictions for all 20 zones in Assam basin', async () => {
  const forecast = generateBasinRainfallForecast(ASSAM_BRAHMAPUTRA_BASIN, 'heavy');
  const predictions = await predictAllZones(ASSAM_BRAHMAPUTRA_BASIN.zones, forecast);

  assert.equal(Object.keys(predictions).length, ASSAM_BRAHMAPUTRA_BASIN.zones.length);

  for (const zone of ASSAM_BRAHMAPUTRA_BASIN.zones) {
    const pred = predictions[zone.id];
    assert.ok(pred, `Prediction for zone ${zone.id} should exist`);
    assert.equal(pred.zone_id, zone.id);
    assert.ok(pred.probabilities.flood_probability_1h >= 0 && pred.probabilities.flood_probability_1h <= 1);
    assert.ok(pred.probabilities.flood_probability_3h >= 0 && pred.probabilities.flood_probability_3h <= 1);
    assert.ok(pred.probabilities.flood_probability_6h >= 0 && pred.probabilities.flood_probability_6h <= 1);
  }
});
