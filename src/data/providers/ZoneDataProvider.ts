import { Zone, ZoneState } from '../models/basin';

/**
 * ZoneDataProvider
 * Interface for querying hydrological zones and their local digital states.
 */
export interface ZoneDataProvider {
  getZones(basinId: string): Promise<Zone[]>;
  getZoneById(basinId: string, zoneId: string): Promise<Zone | null>;
  getZoneState(basinId: string, zoneId: string, timestamp?: string): Promise<ZoneState | null>;
}
