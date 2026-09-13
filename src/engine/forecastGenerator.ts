import {
  Basin,
  Zone,
  RainfallScenario,
  RainfallIntensity,
  ZoneRainfallForecast,
  BasinRainfallForecast,
} from '../types/flood';

/**
 * Classifies rainfall intensity based on peak hourly precipitation rate
 * (aligned with Indian Meteorological Department - IMD standards).
 */
export function classifyIntensity(peakHourlyMm: number): RainfallIntensity {
  if (peakHourlyMm < 2.5) return 'light';
  if (peakHourlyMm <= 7.5) return 'moderate';
  if (peakHourlyMm <= 20.0) return 'heavy';
  if (peakHourlyMm <= 40.0) return 'very_heavy';
  return 'extreme';
}

/**
 * Calculates climatological 24h baseline rainfall for an Assam river reach
 * based on elevation, catchment area, and orographic position.
 */
export function calculateBaselineRainfall(zone: Zone): number {
  const elev = zone.elevationMeters || zone.currentState.elevation || 100;
  // Orographic enhancement: higher foothills receive higher baseline monsoon precipitation
  const orographicBonus = Math.max(0, (elev - 80) * 0.15);
  const baseline = Math.round(18 + orographicBonus);
  return Math.min(45, Math.max(15, baseline));
}

/**
 * Deterministic synthetic hourly hyetograph generator for 24 hours.
 * Uses harmonic Fourier components with storm envelope dynamics.
 */
function generateHourlyHyetograph(
  zone: Zone,
  scenario: RainfallScenario,
  baseline: number
): number[] {
  // Zone seed derived from zone ID characters
  const seed = zone.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const elev = zone.elevationMeters || zone.currentState.elevation || 100;
  const isHeadwater = (zone.upstreamZoneIds || []).length === 0;

  // Scenario multipliers and storm profile peak timings
  let baseMultiplier = 1.0;
  let peakHour = 4.0;
  let stormSpread = 4.0;

  switch (scenario) {
    case 'extreme':
      // Severe cloudburst / concentrated orographic deluge event (>40 mm/h peak)
      baseMultiplier = isHeadwater ? 16.0 : 13.5;
      peakHour = 3.5;
      stormSpread = 3.5;
      break;
    case 'heavy':
      // Widespread heavy monsoon trough (15-35 mm/h peak)
      baseMultiplier = isHeadwater ? 5.8 : 4.6;
      peakHour = 4.5;
      stormSpread = 4.5;
      break;
    case 'normal':
    default:
      // Standard seasonal monsoon showers (2-6 mm/h peak)
      baseMultiplier = 1.0;
      peakHour = 6.0;
      stormSpread = 6.5;
      break;
  }

  const hourly: number[] = [];

  for (let h = 1; h <= 24; h++) {
    // Gaussian storm envelope centered around peakHour
    const envelope = Math.exp(-Math.pow((h - peakHour) / stormSpread, 2));

    // Secondary afternoon diurnal pulse around hour 14-16
    const diurnalPulse = 0.35 * Math.exp(-Math.pow((h - 15) / 2.5, 2));

    // Spatial variation based on elevation and zone seed
    const spatialFactor = 0.85 + 0.3 * Math.sin(seed + h * 0.45) + (elev > 120 ? 0.25 : 0);

    // Hourly intensity calculation
    const baseHourRate = (baseline / 24) * baseMultiplier;
    let rate = baseHourRate * (envelope * 2.8 + diurnalPulse + 0.2) * spatialFactor;

    // Minimum baseline trickle for monsoon season
    rate = Math.max(scenario === 'extreme' ? 3.5 : scenario === 'heavy' ? 1.2 : 0.2, rate);

    hourly.push(parseFloat(rate.toFixed(1)));
  }

  return hourly;
}

/**
 * Generates a complete ZoneRainfallForecast for a single zone.
 */
export function generateZoneRainfallForecast(
  zone: Zone,
  scenario: RainfallScenario
): ZoneRainfallForecast {
  const baseline = calculateBaselineRainfall(zone);
  const hourly = generateHourlyHyetograph(zone, scenario, baseline);

  // Cumulative sums for requested horizons
  const next1h = parseFloat(hourly[0].toFixed(1));
  const next3h = parseFloat(hourly.slice(0, 3).reduce((a, b) => a + b, 0).toFixed(1));
  const next6h = parseFloat(hourly.slice(0, 6).reduce((a, b) => a + b, 0).toFixed(1));
  const next12h = parseFloat(hourly.slice(0, 12).reduce((a, b) => a + b, 0).toFixed(1));
  const next24h = parseFloat(hourly.slice(0, 24).reduce((a, b) => a + b, 0).toFixed(1));

  const accumulatedRainfall = next24h;
  const peakIntensity = Math.max(...hourly);
  const intensity = classifyIntensity(peakIntensity);

  const anomalyMm = parseFloat((accumulatedRainfall - baseline).toFixed(1));
  const anomalyPercent = Math.round(((accumulatedRainfall - baseline) / baseline) * 100);

  return {
    zoneId: zone.id,
    zoneName: zone.name,
    scenario,
    next1h,
    next3h,
    next6h,
    next12h,
    next24h,
    hourlyRainfallMm: hourly,
    accumulatedRainfall,
    rainfallIntensity: intensity,
    peakIntensityMmPerHour: peakIntensity,
    baselineRainfall24h: baseline,
    rainfallAnomalyMm: anomalyMm,
    rainfallAnomalyPercentage: anomalyPercent,
  };
}

/**
 * Generates basin-wide rainfall forecasts for all zones under a given scenario.
 */
export function generateBasinRainfallForecast(
  basin: Basin,
  scenario: RainfallScenario
): BasinRainfallForecast {
  const zoneForecasts: Record<string, ZoneRainfallForecast> = {};
  let totalAccumulated = 0;
  let totalAnomalyPercent = 0;
  let maxRainfall = -1;
  let highestRiskZoneId = basin.zones[0]?.id || '';

  for (const zone of basin.zones) {
    const forecast = generateZoneRainfallForecast(zone, scenario);
    zoneForecasts[zone.id] = forecast;

    totalAccumulated += forecast.accumulatedRainfall;
    totalAnomalyPercent += forecast.rainfallAnomalyPercentage;

    if (forecast.accumulatedRainfall > maxRainfall) {
      maxRainfall = forecast.accumulatedRainfall;
      highestRiskZoneId = zone.id;
    }
  }

  const zoneCount = Math.max(1, basin.zones.length);
  const avgAccumulated = parseFloat((totalAccumulated / zoneCount).toFixed(1));
  const avgAnomalyPercent = Math.round(totalAnomalyPercent / zoneCount);

  let scenarioName = 'Normal Monsoon Baseline';
  let scenarioDescription =
    'Standard seasonal precipitation across Assam. River channels convey inflows within safe hydrological thresholds.';

  if (scenario === 'heavy') {
    scenarioName = 'Heavy Monsoon Trough';
    scenarioDescription =
      'Orographic precipitation band across Upper Assam foothills. Escalated runoff raises tributary stages toward warning levels.';
  } else if (scenario === 'extreme') {
    scenarioName = 'Extreme Cloudburst & Deluge';
    scenarioDescription =
      'Severe multi-reach cloudburst event. Infiltration capacity overwhelmed, causing rapid downstream surge waves and widespread critical alerts.';
  }

  return {
    scenario,
    scenarioName,
    scenarioDescription,
    generatedAt: new Date().toISOString(),
    zones: zoneForecasts,
    basinAverageAccumulated24h: avgAccumulated,
    basinAverageAnomalyPercentage: avgAnomalyPercent,
    highestRiskZoneId,
  };
}
