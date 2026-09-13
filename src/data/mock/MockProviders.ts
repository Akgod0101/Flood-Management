import { BasinDataProvider } from '../providers/BasinDataProvider';
import { ZoneDataProvider } from '../providers/ZoneDataProvider';
import { TerrainDataProvider, ZoneTerrainProfile } from '../providers/TerrainDataProvider';
import { RainfallDataProvider, ZoneRainfallObservation } from '../providers/RainfallDataProvider';
import { RiverGaugeDataProvider, RiverGaugeObservation } from '../providers/RiverGaugeDataProvider';
import { SatelliteFloodDataProvider, SatelliteFloodObservation } from '../providers/SatelliteFloodDataProvider';
import { IoTTelemetryProvider } from '../providers/IoTTelemetryProvider';
import { Basin, Zone, ZoneState, Sensor, TimeSeriesPoint } from '../models';
import { ASSAM_BRAHMAPUTRA_BASIN, MOCK_BASINS } from './mockAssamScaffold';

/**
 * MockBasinDataProvider
 * Concrete implementation serving Assam Brahmaputra River Basin scaffold.
 */
export class MockBasinDataProvider implements BasinDataProvider {
  async getBasins(): Promise<Basin[]> {
    return MOCK_BASINS;
  }

  async getBasinById(basinId: string): Promise<Basin | null> {
    const basin = MOCK_BASINS.find((b) => b.id === basinId);
    return basin ?? null;
  }
}

/**
 * MockZoneDataProvider
 */
export class MockZoneDataProvider implements ZoneDataProvider {
  async getZones(basinId: string): Promise<Zone[]> {
    const basin = MOCK_BASINS.find((b) => b.id === basinId);
    return basin ? basin.zones : [];
  }

  async getZoneById(basinId: string, zoneId: string): Promise<Zone | null> {
    const zones = await this.getZones(basinId);
    return zones.find((z) => z.id === zoneId) ?? null;
  }

  async getZoneState(basinId: string, zoneId: string): Promise<ZoneState | null> {
    const zone = await this.getZoneById(basinId, zoneId);
    return zone ? zone.currentState : null;
  }
}

/**
 * MockTerrainDataProvider
 */
export class MockTerrainDataProvider implements TerrainDataProvider {
  async getTerrainProfile(zoneId: string): Promise<ZoneTerrainProfile | null> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return null;

    return {
      zoneId: zone.id,
      elevationMeters: zone.elevation,
      meanSlopePercent: zone.meanSlope,
      flowAccumulationKm2: zone.flowAccumulation,
      riverDistanceKm: zone.riverDistance,
      floodplainAreaKm2: zone.floodplainArea,
      soilType: zone.currentState.terrain?.soilType || 'Alluvial silt & clay',
      isSynthetic: true,
    };
  }
}

/**
 * MockRainfallDataProvider
 */
export class MockRainfallDataProvider implements RainfallDataProvider {
  async getRainfallObservation(zoneId: string): Promise<ZoneRainfallObservation | null> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return null;

    return {
      zoneId: zone.id,
      timestamp: zone.currentState.timestamp,
      rainfallCurrentMmPerHour: zone.currentState.rainfall,
      accumulated1hMm: zone.currentState.rainfallAccumulated1h,
      accumulated6hMm: zone.currentState.rainfallAccumulated6h,
      accumulated24hMm: zone.currentState.rainfallAccumulated24h,
      history: zone.currentState.rainfallHistory,
      isSynthetic: true,
      stationOrSource: 'DEMO / SYNTHETIC (Scaffold for IMD AWS)',
    };
  }

  async getAccumulatedRainfall(zoneId: string, hours: number): Promise<number> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return 0;
    if (hours <= 1) return zone.currentState.rainfallAccumulated1h;
    if (hours <= 6) return zone.currentState.rainfallAccumulated6h;
    return zone.currentState.rainfallAccumulated24h;
  }
}

/**
 * MockRiverGaugeDataProvider
 */
export class MockRiverGaugeDataProvider implements RiverGaugeDataProvider {
  async getLatestGaugeObservation(zoneId: string): Promise<RiverGaugeObservation | null> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return null;

    return {
      zoneId: zone.id,
      gaugeStationId: `G-${zone.code}`,
      stationName: `${zone.name} Gauging Post`,
      timestamp: zone.currentState.timestamp,
      waterLevelMeters: zone.currentState.waterLevel,
      dangerLevelMeters: zone.currentState.dangerThreshold,
      warningLevelMeters: zone.currentState.dangerThreshold * 0.85,
      riseRateMPerHour: zone.currentState.waterLevelRiseRate,
      history: zone.currentState.waterLevelHistory,
      isSynthetic: true,
      agencySource: 'DEMO / SYNTHETIC (Scaffold for CWC Telemetry)',
    };
  }

  async getGaugeHistory(zoneId: string): Promise<TimeSeriesPoint[]> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    return zone ? zone.currentState.waterLevelHistory : [];
  }
}

/**
 * MockSatelliteFloodDataProvider
 */
export class MockSatelliteFloodDataProvider implements SatelliteFloodDataProvider {
  async getLatestPass(zoneId: string): Promise<SatelliteFloodObservation | null> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return null;

    const fraction = zone.currentState.satelliteWaterFraction || 0.25;
    return {
      zoneId: zone.id,
      passTimestamp: new Date().toISOString(),
      satelliteWaterFraction: fraction,
      inundatedAreaKm2: parseFloat((zone.areaKm2 * fraction).toFixed(1)),
      totalAreaKm2: zone.areaKm2,
      satelliteMission: 'DEMO / SYNTHETIC (Scaffold for Sentinel-1 SAR)',
      confidenceScore: 0.88,
      isSynthetic: true,
    };
  }

  async getBasinInundationSummary(basinId: string) {
    const basin = MOCK_BASINS.find((b) => b.id === basinId) || ASSAM_BRAHMAPUTRA_BASIN;
    const totalInundated = basin.zones.reduce((acc, z) => acc + z.areaKm2 * (z.currentState.satelliteWaterFraction || 0.2), 0);
    return {
      totalInundatedKm2: Math.round(totalInundated),
      observationTimestamp: new Date().toISOString(),
      isSynthetic: true,
    };
  }
}

import { generateInitialSensors } from '../../engine/sensorSimulator';

/**
 * MockIoTTelemetryProvider
 */
export class MockIoTTelemetryProvider implements IoTTelemetryProvider {
  async getZoneSensors(zoneId: string): Promise<Sensor[]> {
    const zone = ASSAM_BRAHMAPUTRA_BASIN.zones.find((z) => z.id === zoneId);
    if (!zone) return [];
    if (zone.sensors && zone.sensors.length > 0) return zone.sensors;
    return generateInitialSensors([zone]);
  }

  async getSensorReading(sensorId: string) {
    return {
      value: 8.5,
      unit: 'm',
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    };
  }
}

// Default instances for singleton injection
export const defaultBasinProvider = new MockBasinDataProvider();
export const defaultZoneProvider = new MockZoneDataProvider();
export const defaultTerrainProvider = new MockTerrainDataProvider();
export const defaultRainfallProvider = new MockRainfallDataProvider();
export const defaultRiverGaugeProvider = new MockRiverGaugeDataProvider();
export const defaultSatelliteProvider = new MockSatelliteFloodDataProvider();
export const defaultIoTProvider = new MockIoTTelemetryProvider();
