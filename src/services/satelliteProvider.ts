/**
 * Satellite Provider Interface & Mock Implementation
 * ==================================================
 * Provides spatial satellite observations (e.g. Sentinel-1 SAR flood extent mapping).
 * The frontend consumes this provider interface without coupling to whether the
 * underlying data is simulated or fetched from an external satellite provider API.
 */

import type { SatelliteObservation, SatelliteProvider } from '@/types';

export class MockSatelliteProvider implements SatelliteProvider {
  private baseExtents: Record<string, number> = {
    z1: 0.08, // Pasighat (hills)
    z2: 0.22, // Dibrugarh
    z3: 0.35, // Jorhat
    z4: 0.31, // Tezpur
    z5: 0.48, // Nagaon (low-lying floodplain)
    z6: 0.54, // Guwahati (capital basin)
    z7: 0.62, // Goalpara (outflow reach)
  };

  /**
   * Fetches satellite observations for the requested zone IDs at a given timestamp.
   * Do NOT yet connect to a real satellite API.
   * Returns SatelliteObservation[] with all required fields.
   */
  async getSatelliteObservations(
    zoneIds: string[],
    timestamp?: string
  ): Promise<SatelliteObservation[]> {
    const obsTime = timestamp || new Date().toISOString();

    // Simulate minor async provider latency
    await new Promise((resolve) => setTimeout(resolve, 40));

    return zoneIds.map((zoneId) => {
      const baseFraction = this.baseExtents[zoneId] ?? 0.25;

      // Deterministic variations based on zoneId string hash
      const hash = zoneId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const variation = ((hash % 11) - 5) / 100; // -0.05 to +0.05

      const floodedFraction = Math.max(
        0.02,
        Math.min(0.98, parseFloat((baseFraction + variation).toFixed(3)))
      );
      const surfaceWaterChange = parseFloat((floodedFraction - baseFraction * 0.78).toFixed(3));
      const soilMoisture = Math.round(55 + floodedFraction * 40);
      const rainfallEstimate = parseFloat((8.5 + floodedFraction * 32.0).toFixed(1));
      const confidence = parseFloat((0.91 + (hash % 7) / 100).toFixed(2));

      return {
        timestamp: obsTime,
        zoneId,
        floodedFraction,
        surfaceWaterChange,
        soilMoisture,
        rainfallEstimate,
        source: 'Sentinel-1A SAR C-band (IW GRD)',
        confidence,
      };
    });
  }
}

/**
 * Singleton provider instance.
 * The frontend consumes this provider interface without knowing if the data is real or simulated.
 */
export const satelliteProvider: SatelliteProvider = new MockSatelliteProvider();
