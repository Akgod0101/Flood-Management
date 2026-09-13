import { Basin, SimulationStep, Zone, ZoneState } from '@/types/flood';
import { BasinDataProvider, ZoneDataProvider } from '@/data/providers';
import { defaultBasinProvider, defaultZoneProvider, MOCK_SIMULATION_STEPS } from '@/data/mock';

/**
 * BasinService
 * Application-level facade for flood graph data operations.
 * Consumes swappable data providers rather than hardcoded datasets.
 */
class BasinServiceImpl {
  private basinProvider: BasinDataProvider;
  private zoneProvider: ZoneDataProvider;

  constructor(
    basinProvider: BasinDataProvider = defaultBasinProvider,
    zoneProvider: ZoneDataProvider = defaultZoneProvider
  ) {
    this.basinProvider = basinProvider;
    this.zoneProvider = zoneProvider;
  }

  /**
   * Allow dynamic swapping of data providers (e.g. from Mock to Real API in later phases)
   */
  public setProviders(basinProvider: BasinDataProvider, zoneProvider: ZoneDataProvider) {
    this.basinProvider = basinProvider;
    this.zoneProvider = zoneProvider;
  }

  /**
   * Retrieve all available river basins.
   */
  async getBasins(): Promise<Basin[]> {
    return this.basinProvider.getBasins();
  }

  /**
   * Retrieve a specific basin by ID.
   */
  async getBasinById(basinId: string): Promise<Basin | null> {
    return this.basinProvider.getBasinById(basinId);
  }

  /**
   * Retrieve all hydrologically connected zones within a basin.
   */
  async getZonesByBasinId(basinId: string): Promise<Zone[]> {
    return this.zoneProvider.getZones(basinId);
  }

  /**
   * Retrieve a single zone by ID from a basin.
   */
  async getZoneById(basinId: string, zoneId: string): Promise<Zone | null> {
    return this.zoneProvider.getZoneById(basinId, zoneId);
  }

  /**
   * Retrieve live / simulated zone digital state.
   */
  async getZoneState(basinId: string, zoneId: string, timestamp?: string): Promise<ZoneState | null> {
    return this.zoneProvider.getZoneState(basinId, zoneId, timestamp);
  }

  /**
   * Retrieve timeline simulation and observation steps.
   */
  async getSimulationSteps(): Promise<SimulationStep[]> {
    return MOCK_SIMULATION_STEPS;
  }
}

export const BasinService = new BasinServiceImpl();
