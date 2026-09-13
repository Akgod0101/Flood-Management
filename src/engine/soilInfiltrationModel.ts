/**
 * Simple Explainable Soil Infiltration & Surface Runoff Model
 *
 * Implements physically grounded, transparent infiltration mechanics:
 * 1. Rainfall first infiltrates into the soil matrix according to current infiltration capacity
 *    and available pore storage.
 * 2. Any excess rainfall beyond the infiltration capacity becomes direct surface runoff.
 * 3. As soil moisture approaches 100% saturation:
 *    - Infiltration capacity diminishes non-linearly towards baseline hydraulic conductivity
 *    - Remaining storage approaches zero
 *    - Surface runoff dramatically increases, accelerating river stage rise
 */

export interface InfiltrationPartitionResult {
  actualInfiltrationMmPerHour: number;
  surfaceRunoffMmPerHour: number;
  effectiveInfiltrationCapacity: number;
  runoffFraction: number; // 0 to 1
}

export interface SoilStateUpdateResult {
  currentSoilMoisture: number; // in % volumetric moisture
  saturation: number; // in % pore volume saturation
  remainingStorage: number; // in mm available before saturation
  infiltrationCapacity: number; // in mm/h current capacity
}

/**
 * Calculates remaining available soil storage in mm before surface ponding/saturation.
 *
 * @param rootDepthMm - Effective active hydrologic root zone depth (typically 400mm)
 * @param porosity - Total pore volume fraction (0.35 - 0.52)
 * @param saturationPercent - Current saturation percentage (0 - 100%)
 */
export function calculateRemainingStorage(
  rootDepthMm: number = 400,
  porosity: number = 0.45,
  saturationPercent: number = 75
): number {
  const maxStorageMm = rootDepthMm * porosity; // e.g. 400 * 0.45 = 180 mm
  const remaining = maxStorageMm * (1 - Math.min(100, Math.max(0, saturationPercent)) / 100);
  return parseFloat(Math.max(0, remaining).toFixed(1));
}

/**
 * Calculates current effective infiltration capacity based on soil saturation.
 * Replicates empirical Horton/Green-Ampt infiltration decay:
 * When dry (saturation ~35%), capacity is near maximum (f0).
 * When saturated (saturation -> 100%), capacity approaches minimal percolation (fc).
 *
 * @param baseCapacityMmPerHour - Initial unsaturated infiltration capacity f0 (mm/h)
 * @param saturationPercent - Current saturation percentage (0 - 100%)
 * @param minPercolationMmPerHour - Minimum saturated hydraulic conductivity fc (mm/h)
 */
export function calculateEffectiveInfiltrationCapacity(
  baseCapacityMmPerHour: number = 32.0,
  saturationPercent: number = 75,
  minPercolationMmPerHour: number = 2.0
): number {
  const satRatio = Math.min(100, Math.max(0, saturationPercent)) / 100;
  // Non-linear power decay as capillary suction head diminishes
  const decayFactor = Math.pow(1 - satRatio, 1.6);
  const capacity = minPercolationMmPerHour + (baseCapacityMmPerHour - minPercolationMmPerHour) * decayFactor;
  return parseFloat(Math.max(minPercolationMmPerHour, capacity).toFixed(1));
}

/**
 * Deterministically partitions rainfall into soil infiltration vs excess surface runoff.
 *
 * Rule:
 * 1. Soil absorbs rainfall up to effective infiltration capacity and remaining pore storage.
 * 2. Any excess precipitation that cannot be infiltrated becomes overland surface runoff.
 *
 * @param rainfallMmPerHour - Incoming rainfall rate in mm/h
 * @param baseCapacityMmPerHour - Base infiltration capacity in mm/h
 * @param saturationPercent - Current soil saturation %
 * @param remainingStorageMm - Available pore volume storage in mm
 */
export function partitionRainfallInfiltration(
  rainfallMmPerHour: number,
  baseCapacityMmPerHour: number = 32.0,
  saturationPercent: number = 75,
  remainingStorageMm: number = 45.0
): InfiltrationPartitionResult {
  const effectiveCapacity = calculateEffectiveInfiltrationCapacity(
    baseCapacityMmPerHour,
    saturationPercent
  );

  // Maximum water that can enter soil matrix this hour
  const maxInfiltratable = Math.min(effectiveCapacity, remainingStorageMm);

  // Rainfall first contributes to infiltration
  const actualInfiltration = Math.max(0, Math.min(rainfallMmPerHour, maxInfiltratable));

  // Excess rainfall becomes surface runoff
  const surfaceRunoff = Math.max(0, rainfallMmPerHour - actualInfiltration);

  const runoffFraction = rainfallMmPerHour > 0 ? surfaceRunoff / rainfallMmPerHour : 0;

  return {
    actualInfiltrationMmPerHour: parseFloat(actualInfiltration.toFixed(1)),
    surfaceRunoffMmPerHour: parseFloat(surfaceRunoff.toFixed(1)),
    effectiveInfiltrationCapacity: effectiveCapacity,
    runoffFraction: parseFloat(runoffFraction.toFixed(2)),
  };
}

/**
 * Updates soil moisture, saturation, and remaining storage over an hourly timestep.
 *
 * @param currentSaturation - Previous saturation percentage (0 - 100%)
 * @param porosity - Total pore volume fraction (e.g. 0.45)
 * @param actualInfiltrationMm - Water absorbed by soil this hour (mm)
 * @param drainageRateMm - Deep groundwater percolation / subsurface drainage per hour (mm)
 * @param rootDepthMm - Depth of active hydrologic soil column (mm)
 * @param baseCapacity - Baseline infiltration capacity (mm/h)
 */
export function updateSoilState(
  currentSaturation: number,
  porosity: number = 0.45,
  actualInfiltrationMm: number = 0,
  drainageRateMm: number = 0.7,
  rootDepthMm: number = 400,
  baseCapacity: number = 32.0
): SoilStateUpdateResult {
  const maxStorageMm = rootDepthMm * porosity; // total pore storage

  // Net water change in root zone
  const netInflowMm = actualInfiltrationMm - drainageRateMm;
  const saturationDeltaPercent = (netInflowMm / maxStorageMm) * 100;

  // New saturation clamped between dry baseline (30%) and maximum (99%)
  const newSaturation = Math.min(
    99,
    Math.max(30, parseFloat((currentSaturation + saturationDeltaPercent).toFixed(1)))
  );

  // Volumetric soil moisture = porosity * (saturation / 100) * 100%
  const currentSoilMoisture = parseFloat((porosity * newSaturation).toFixed(1));

  // Remaining storage in mm
  const remainingStorage = calculateRemainingStorage(rootDepthMm, porosity, newSaturation);

  // Updated current infiltration capacity
  const infiltrationCapacity = calculateEffectiveInfiltrationCapacity(baseCapacity, newSaturation);

  return {
    currentSoilMoisture,
    saturation: newSaturation,
    remainingStorage,
    infiltrationCapacity,
  };
}
