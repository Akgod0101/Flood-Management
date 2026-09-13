import { RiskExplanation, RiskContributor } from '../data/models/basin';
import type { RiskLevel } from '../data/models/telemetry';

export interface RiskExplanationInput {
  waterLevel: number; // m
  dangerThreshold: number; // m
  riseRate: number; // m/h
  rainfallMmPerHour: number; // mm/h
  soilSaturation: number; // % (0 - 100)
  incomingFlow: number; // m³/s
  flowCapacity: number; // m³/s
  slopePercent: number; // %
  elevationMeters: number; // m
  remainingStorageMm: number; // mm
}

/**
 * Deterministic Explainable Risk Contributor Engine
 *
 * Computes a transparent, 0-100% flood risk score and attributes exact point contributions
 * across 5 fundamental hydrological drivers:
 * 1. Rainfall intensity & volume (+0 to +30)
 * 2. Soil saturation & infiltration depletion (+0 to +25)
 * 3. Upstream channel inflow & hydraulic surcharge (+0 to +25)
 * 4. Water stage rate of rise (+0 to +15)
 * 5. Terrain geomorphology & depleted storage capacity (+0 to +10)
 */
export function calculateRiskExplanation(input: RiskExplanationInput): RiskExplanation {
  const {
    waterLevel,
    dangerThreshold,
    riseRate,
    rainfallMmPerHour,
    soilSaturation,
    incomingFlow,
    flowCapacity,
    slopePercent,
    remainingStorageMm,
  } = input;

  // 1. Contributor: Rainfall Intensity & Volume (0 to 30 pts)
  let rainPts: number;
  let rainDesc: string;
  if (rainfallMmPerHour >= 45) {
    rainPts = Math.min(30, Math.round(24 + (rainfallMmPerHour - 45) * 0.15));
    rainDesc = `Extreme cloudburst intensity (${rainfallMmPerHour.toFixed(1)} mm/h) overwhelming drainage`;
  } else if (rainfallMmPerHour >= 20) {
    rainPts = Math.round(18 + ((rainfallMmPerHour - 20) / 25) * 6);
    rainDesc = `Heavy monsoon precipitation trough (${rainfallMmPerHour.toFixed(1)} mm/h)`;
  } else if (rainfallMmPerHour >= 8) {
    rainPts = Math.round(11 + ((rainfallMmPerHour - 8) / 12) * 6);
    rainDesc = `Moderate convective rainfall (${rainfallMmPerHour.toFixed(1)} mm/h)`;
  } else if (rainfallMmPerHour >= 2) {
    rainPts = Math.round(5 + ((rainfallMmPerHour - 2) / 6) * 5);
    rainDesc = `Light seasonal precipitation (${rainfallMmPerHour.toFixed(1)} mm/h)`;
  } else {
    rainPts = Math.max(1, Math.round(rainfallMmPerHour * 2));
    rainDesc = `Trace precipitation (${rainfallMmPerHour.toFixed(1)} mm/h)`;
  }

  // 2. Contributor: High Soil Saturation (0 to 25 pts)
  let soilPts: number;
  let soilDesc: string;
  if (soilSaturation >= 92) {
    soilPts = Math.min(25, Math.round(19 + ((soilSaturation - 92) / 8) * 6));
    soilDesc = `Soil column saturated (${soilSaturation.toFixed(0)}%); infiltration buffering completely exhausted`;
  } else if (soilSaturation >= 80) {
    soilPts = Math.round(14 + ((soilSaturation - 80) / 12) * 5);
    soilDesc = `High saturation (${soilSaturation.toFixed(0)}%); rapid overland surface runoff generation`;
  } else if (soilSaturation >= 65) {
    soilPts = Math.round(8 + ((soilSaturation - 65) / 15) * 5);
    soilDesc = `Moderate soil saturation (${soilSaturation.toFixed(0)}%) with partial infiltration buffer`;
  } else {
    soilPts = Math.max(1, Math.round((soilSaturation / 65) * 7));
    soilDesc = `Soil permeable (${soilSaturation.toFixed(0)}% sat); active pore space absorbs rainfall`;
  }

  // 3. Contributor: Upstream Inflow & Routing (0 to 25 pts)
  const inflowRatio = incomingFlow / Math.max(400, flowCapacity);
  let inflowPts: number;
  let inflowDesc: string;
  if (inflowRatio >= 1.15 || incomingFlow >= 2200) {
    inflowPts = Math.min(25, Math.round(20 + Math.min(5, (inflowRatio - 1.15) * 6)));
    inflowDesc = `Severe upstream flood discharge (${incomingFlow.toLocaleString()} m³/s) surcharging reach conveyance`;
  } else if (inflowRatio >= 0.8 || incomingFlow >= 1300) {
    inflowPts = Math.round(15 + ((inflowRatio - 0.8) / 0.35) * 5);
    inflowDesc = `Substantial upstream flow wave (${incomingFlow.toLocaleString()} m³/s) filling channel capacity`;
  } else if (inflowRatio >= 0.45 || incomingFlow >= 650) {
    inflowPts = Math.round(9 + ((inflowRatio - 0.45) / 0.35) * 5);
    inflowDesc = `Normal seasonal inflow (${incomingFlow.toLocaleString()} m³/s) from upstream sub-basins`;
  } else {
    inflowPts = Math.max(1, Math.round(inflowRatio * 15));
    inflowDesc = `Low baseflow inflow (${incomingFlow.toLocaleString()} m³/s)`;
  }

  // 4. Contributor: Rapid Water Rise Rate (0 to 15 pts)
  let risePts: number;
  let riseDesc: string;
  if (riseRate >= 0.35) {
    risePts = Math.min(15, Math.round(12 + Math.min(3, (riseRate - 0.35) * 6)));
    riseDesc = `Flash surge rise rate (+${riseRate.toFixed(2)} m/h); rapid river stage escalation`;
  } else if (riseRate >= 0.18) {
    risePts = Math.round(8 + ((riseRate - 0.18) / 0.17) * 4);
    riseDesc = `Fast water level rise (+${riseRate.toFixed(2)} m/h)`;
  } else if (riseRate >= 0.05) {
    risePts = Math.round(4 + ((riseRate - 0.05) / 0.13) * 4);
    riseDesc = `Gradual water level rise (+${riseRate.toFixed(2)} m/h)`;
  } else if (riseRate > 0) {
    risePts = 2;
    riseDesc = `Slight positive water level creep (+${riseRate.toFixed(2)} m/h)`;
  } else {
    risePts = 0;
    riseDesc = `Water stage stable or receding (${riseRate.toFixed(2)} m/h)`;
  }

  // 5. Contributor: Low Terrain & Depleted Retention Storage (0 to 10 pts)
  let terrainPts: number;
  let terrainDesc: string;
  if (remainingStorageMm <= 12 && slopePercent <= 4) {
    terrainPts = 9;
    terrainDesc = `Flat alluvial floodplain (slope ${slopePercent}%) with depleted storage (${remainingStorageMm.toFixed(1)} mm left)`;
  } else if (remainingStorageMm <= 25 || slopePercent <= 7) {
    terrainPts = Math.round(6 + (remainingStorageMm <= 20 ? 2 : 0));
    terrainDesc = `Low-lying riparian zone with constricted retention storage (${remainingStorageMm.toFixed(1)} mm left)`;
  } else {
    terrainPts = Math.max(1, Math.round(10 - Math.min(8, slopePercent * 0.5 + remainingStorageMm * 0.05)));
    terrainDesc = `Well-drained terrain profile (${slopePercent}% slope, ${remainingStorageMm.toFixed(1)} mm storage)`;
  }

  // Total risk score calculation
  const rawTotal = rainPts + soilPts + inflowPts + risePts + terrainPts;
  const totalRiskScore = Math.min(99, Math.max(5, rawTotal));

  // Categorize risk tier based on total risk score
  let riskLevel: RiskLevel = 'safe';
  if (totalRiskScore >= 78 || waterLevel >= dangerThreshold * 0.98) {
    riskLevel = 'critical';
  } else if (totalRiskScore >= 58 || waterLevel >= dangerThreshold * 0.82) {
    riskLevel = 'warning';
  } else if (totalRiskScore >= 38 || waterLevel >= dangerThreshold * 0.68) {
    riskLevel = 'watch';
  }

  const contributors: RiskContributor[] = [
    {
      name: 'Heavy rainfall',
      category: 'rainfall',
      points: rainPts,
      percentageOfTotal: Math.round((rainPts / totalRiskScore) * 100),
      description: rainDesc,
    },
    {
      name: 'High soil saturation',
      category: 'soil',
      points: soilPts,
      percentageOfTotal: Math.round((soilPts / totalRiskScore) * 100),
      description: soilDesc,
    },
    {
      name: 'Upstream inflow',
      category: 'inflow',
      points: inflowPts,
      percentageOfTotal: Math.round((inflowPts / totalRiskScore) * 100),
      description: inflowDesc,
    },
    {
      name: 'Rapid water rise',
      category: 'rise_rate',
      points: risePts,
      percentageOfTotal: Math.round((risePts / totalRiskScore) * 100),
      description: riseDesc,
    },
    {
      name: 'Low terrain / storage',
      category: 'terrain',
      points: terrainPts,
      percentageOfTotal: Math.round((terrainPts / totalRiskScore) * 100),
      description: terrainDesc,
    },
  ];

  let summary = `Total flood risk calculated at ${totalRiskScore}%. Conditions remain manageable.`;
  if (riskLevel === 'critical') {
    summary = `Critical flood breach alert (${totalRiskScore}% risk). Severe precipitation combined with saturated soil is driving overland runoff directly into the river channel.`;
  } else if (riskLevel === 'warning') {
    summary = `Warning-tier surcharge (${totalRiskScore}% risk). Elevated upstream flow and high soil saturation are accelerating channel stage rise.`;
  } else if (riskLevel === 'watch') {
    summary = `Elevated watch status (${totalRiskScore}% risk). Infiltration buffering is diminishing as storm pulses continue.`;
  }

  return {
    totalRiskScore,
    riskLevel,
    summary,
    contributors,
  };
}

export const generateRiskExplanation = calculateRiskExplanation;
