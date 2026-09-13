/**
 * ML Prediction Service Client
 * ============================
 * Connects the Next.js frontend to the Python FastAPI ML backend (/predict).
 * 
 * Features:
 * - Gathers current ZoneState and multi-horizon Rainfall Forecast.
 * - Dispatches payload to POST http://127.0.0.1:8000/predict.
 * - Receives multi-horizon probabilities (1h, 3h, 6h) and confidence rating.
 * - Gracefully falls back to deterministic physical rules if backend is unreachable.
 * - GUARANTEES ZERO APPLICATION CRASHES on API unavailability.
 */

import { Zone, AIPrediction, RiskLevel } from '@/data/models/basin';
import { ZoneRainfallForecast, BasinRainfallForecast } from '@/data/models/forecast';

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_API_URL || 'http://127.0.0.1:8000';

const REQUEST_TIMEOUT_MS = 2500;

/**
 * Deterministic fallback generator when ML backend is offline.
 * Employs transparent hydrological physics to estimate multi-horizon flood probabilities.
 */
function generateDeterministicFallback(
  zone: Zone,
  forecast?: ZoneRainfallForecast | null
): AIPrediction {
  const s = zone.currentState;
  const wl = s.currentWaterLevel ?? s.waterLevel ?? 5.0;
  const danger = s.dangerThreshold || 8.0;
  const riseRate = s.waterLevelRiseRate ?? 0.1;
  const rain1h = s.rainfallAccumulated1h ?? s.rainfallCurrent ?? s.rainfall ?? 0;
  const rain3h = forecast?.next3h ?? (rain1h * 2.2);
  const rain6h = forecast?.next6h ?? (rain1h * 3.8);
  const saturation = s.saturation ?? s.soilSaturation ?? 75;
  const storage = s.remainingStorage ?? 35;
  const incomingFlow = s.incomingFlow ?? 5000;

  // 1h Flash Risk: Driven primarily by stage proximity to danger threshold and stage acceleration
  const stageRatio = wl / danger;
  const z1 = (stageRatio - 0.78) * 4.5 + riseRate * 3.2 + (rain1h / 40.0) * 1.5 + (saturation - 80) * 0.04;
  const p1h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z1))));

  // 3h Horizon Risk: Driven by 3h forecast rain, upstream inflow surcharge, saturated soil
  const z3 = (stageRatio - 0.72) * 3.8 + (rain3h / 55.0) * 2.2 + (incomingFlow / 18000.0) * 1.2 + (saturation - 75) * 0.05;
  const p3h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z3))));

  // 6h Horizon Risk: Driven by 6h cumulative forecast rain, catchment accumulation, depleted storage
  const z6 = (stageRatio - 0.68) * 3.2 + (rain6h / 85.0) * 2.5 + (incomingFlow / 20000.0) * 1.4 + (1 - storage / 50.0) * 1.2;
  const p6h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z6))));

  const maxP = Math.max(p1h, p3h, p6h);
  let riskTier: RiskLevel = 'safe';
  if (maxP >= 0.75 || stageRatio >= 0.95) {
    riskTier = 'critical';
  } else if (maxP >= 0.50 || stageRatio >= 0.82) {
    riskTier = 'warning';
  } else if (maxP >= 0.25 || stageRatio >= 0.68) {
    riskTier = 'watch';
  }

  return {
    zone_id: zone.id,
    probabilities: {
      flood_probability_1h: parseFloat(p1h.toFixed(4)),
      flood_probability_3h: parseFloat(p3h.toFixed(4)),
      flood_probability_6h: parseFloat(p6h.toFixed(4)),
    },
    confidence: 0.88,
    risk_tier: riskTier,
    algorithm: 'Deterministic Fallback',
    isAvailable: false,
    notice: 'OFFLINE FALLBACK — DETERMINISTIC RULE ESTIMATE (Backend Offline)',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Predicts multi-horizon flood probabilities for a single zone.
 * Safely handles connection timeouts and errors without throwing exceptions.
 */
export async function predictZoneFlood(
  zone: Zone,
  forecast?: ZoneRainfallForecast | null
): Promise<AIPrediction> {
  const s = zone.currentState;

  // Extract the 16 features required by backend/model.py
  const rain1h = s.rainfallAccumulated1h ?? s.rainfallCurrent ?? s.rainfall ?? 0;
  const rain3h = (forecast?.next3h ? forecast.next3h * 0.8 : rain1h * 2.2);
  const rain6h = s.rainfallAccumulated6h ?? (rain1h * 3.4);
  const rain24h = s.rainfallAccumulated24h ?? (rain1h * 6.2);

  const payload = {
    zone_id: zone.id,
    rainfall_1h: rain1h,
    rainfall_3h: rain3h,
    rainfall_6h: rain6h,
    rainfall_24h: rain24h,
    forecast_rain_3h: forecast?.next3h ?? (rain1h * 1.8),
    forecast_rain_6h: forecast?.next6h ?? (rain1h * 2.6),
    soil_moisture: s.currentSoilMoisture ?? s.soilMoisture ?? 72.0,
    soil_saturation: s.saturation ?? s.soilSaturation ?? 78.0,
    water_level: s.currentWaterLevel ?? s.waterLevel ?? 5.4,
    water_level_rise_rate: s.waterLevelRiseRate ?? 0.18,
    incoming_flow: s.incomingFlow ?? 6500.0,
    elevation: zone.elevationMeters ?? zone.elevation ?? 120.0,
    slope: zone.meanSlope ?? 3.5,
    flow_accumulation: zone.flowAccumulation ?? 190000.0,
    storage_remaining: s.remainingStorage ?? 32.0,
    historical_flood_frequency: Math.max(0.4, Math.min(3.8, (180.0 - (zone.elevation || 100)) / 45.0)),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${ML_BACKEND_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[ML Service] Backend responded with HTTP ${response.status} for ${zone.id}. Falling back.`);
      return generateDeterministicFallback(zone, forecast);
    }

    const data = await response.json();

    return {
      zone_id: data.zone_id || zone.id,
      probabilities: {
        flood_probability_1h: data.probabilities.flood_probability_1h,
        flood_probability_3h: data.probabilities.flood_probability_3h,
        flood_probability_6h: data.probabilities.flood_probability_6h,
      },
      confidence: data.confidence,
      risk_tier: (data.risk_tier as RiskLevel) || 'safe',
      algorithm: data.model_metadata?.algorithm || 'XGBoost',
      isAvailable: true,
      notice: data.model_metadata?.notice,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    // Graceful fallback on network error or timeout
    return generateDeterministicFallback(zone, forecast);
  }
}

/**
 * Predicts multi-horizon flood probabilities for all zones in the basin.
 */
export async function predictAllZones(
  zones: Zone[],
  basinForecast?: BasinRainfallForecast | null
): Promise<Record<string, AIPrediction>> {
  if (!zones || zones.length === 0) return {};

  const promises = zones.map(async (zone) => {
    const zoneForecast = basinForecast?.zones[zone.id] || null;
    const prediction = await predictZoneFlood(zone, zoneForecast);
    return { zoneId: zone.id, prediction };
  });

  const results = await Promise.all(promises);

  const predictionMap: Record<string, AIPrediction> = {};
  results.forEach(({ zoneId, prediction }) => {
    predictionMap[zoneId] = prediction;
  });

  return predictionMap;
}
