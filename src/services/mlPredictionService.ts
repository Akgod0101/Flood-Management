/**
 * ML Prediction Service Client
 * ============================
 * Connects the BasinFlow AI frontend to the Python FastAPI ML backend (/predict).
 * 
 * Features:
 * - Gathers current ZoneState and sends 16 hydrological features to POST http://127.0.0.1:8000/predict.
 * - Receives multi-horizon probabilities (1h, 3h, 6h), risk tier, and confidence rating.
 * - Supports both current BasinFlow AI Zone format and legacy test scaffolds.
 * - Falls back to deterministic physical models if the backend is unreachable.
 * - Checks backend health (/health) to report online status.
 */

import type { AIPrediction } from '@/types';

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_API_URL || 'http://127.0.0.1:8000';

const REQUEST_TIMEOUT_MS = 2500;

export async function checkMLHealth(): Promise<{ online: boolean; algorithm: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${ML_BACKEND_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { online: true, algorithm: data.algorithm || 'XGBoost' };
    }
    return { online: false, algorithm: 'Deterministic Fallback' };
  } catch {
    return { online: false, algorithm: 'Deterministic Fallback' };
  }
}

/**
 * Deterministic fallback generator when ML backend is offline.
 */
function generateDeterministicFallback(zone: any, forecast?: any): AIPrediction {
  const s = zone.state || zone.currentState || {};
  const wl = s.riverLevel ?? s.currentWaterLevel ?? s.waterLevel ?? 4.0;
  const danger = s.dangerThreshold || (zone.historicalFloodFrequency > 8 ? 5.0 : 6.0);
  const riseRate = s.riverLevelRiseRate ?? s.waterLevelRiseRate ?? 0.1;
  const rain1h = s.rainfall1h ?? s.rainfallAccumulated1h ?? s.rainfallCurrent ?? s.rainfall ?? 0;
  const rain3h = forecast?.next3h ?? s.rainfall3h ?? (rain1h * 2.2);
  const rain6h = forecast?.next6h ?? s.rainfall6h ?? (rain1h * 3.4);
  const soilMoisture = s.soilMoisture ?? s.currentSoilMoisture ?? 70;
  const saturation = s.soilSaturation ?? s.saturation ?? Math.min(100, soilMoisture * 1.1);
  const incomingFlow = s.upstreamInflow ?? s.incomingFlow ?? 5000;
  const storage = s.remainingStorage ?? Math.max(5, (100 - soilMoisture) * 0.8);

  // 1h Flash Risk
  const stageRatio = wl / danger;
  const z1 = (stageRatio - 0.78) * 4.5 + riseRate * 3.2 + (rain1h / 40.0) * 1.5 + (saturation - 80) * 0.04;
  const p1h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z1))));

  // 3h Horizon Risk
  const z3 = (stageRatio - 0.72) * 3.8 + (rain3h / 55.0) * 2.2 + (incomingFlow / 18000.0) * 1.2 + (saturation - 75) * 0.05;
  const p3h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z3))));

  // 6h Horizon Risk
  const z6 = (stageRatio - 0.68) * 3.2 + (rain6h / 85.0) * 2.5 + (incomingFlow / 20000.0) * 1.4 + (1 - storage / 50.0) * 1.2;
  const p6h = Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-z6))));

  const maxP = Math.max(p1h, p3h, p6h);
  let riskTier: AIPrediction['risk_tier'] = 'safe';
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
 * Predicts multi-horizon flood probabilities for a single zone using FastAPI ML backend.
 */
export async function predictZoneFlood(zone: any, forecast?: any): Promise<AIPrediction> {
  const s = zone.state || zone.currentState || {};
  const rain1h = s.rainfall1h ?? s.rainfallAccumulated1h ?? s.rainfallCurrent ?? s.rainfall ?? 0;
  const rain3h = forecast?.next3h ?? s.rainfall3h ?? (rain1h * 2.2);
  const rain6h = forecast?.next6h ?? s.rainfall6h ?? (rain1h * 3.4);
  const rain24h = s.rainfall24h ?? s.rainfallAccumulated24h ?? (rain1h * 6.2);
  const soilMoisture = s.soilMoisture ?? s.currentSoilMoisture ?? 70;

  const payload = {
    zone_id: zone.id,
    rainfall_1h: rain1h,
    rainfall_3h: rain3h,
    rainfall_6h: rain6h,
    rainfall_24h: rain24h,
    forecast_rain_3h: forecast?.next3h ?? ((s.rainfallIntensity ?? rain1h) * 1.8),
    forecast_rain_6h: forecast?.next6h ?? ((s.rainfallIntensity ?? rain1h) * 2.5),
    soil_moisture: soilMoisture,
    soil_saturation: s.soilSaturation ?? s.saturation ?? Math.min(100, soilMoisture * 1.1),
    water_level: s.riverLevel ?? s.currentWaterLevel ?? s.waterLevel ?? 4.0,
    water_level_rise_rate: Math.max(0.01, s.riverLevelRiseRate ?? s.waterLevelRiseRate ?? 0.1),
    incoming_flow: s.upstreamInflow ?? s.incomingFlow ?? 5000,
    elevation: zone.elevation ?? zone.elevationMeters ?? 100,
    slope: zone.slope ?? zone.meanSlope ?? 3.0,
    flow_accumulation: zone.flowAccumulation ?? 100000,
    storage_remaining: s.remainingStorage ?? Math.max(5, (100 - soilMoisture) * 0.8),
    historical_flood_frequency: zone.historicalFloodFrequency ?? 2.0,
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
      risk_tier: data.risk_tier || 'safe',
      algorithm: data.model_metadata?.algorithm || 'XGBoost',
      isAvailable: true,
      notice: data.model_metadata?.notice,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return generateDeterministicFallback(zone, forecast);
  }
}

/**
 * Predicts multi-horizon flood probabilities for all zones in parallel.
 */
export async function predictAllZones(zones: any[], forecast?: any): Promise<Record<string, AIPrediction>> {
  if (!zones || zones.length === 0) return {};

  const promises = zones.map(async (zone) => {
    const zoneForecast = forecast?.zones ? forecast.zones[zone.id] : null;
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
