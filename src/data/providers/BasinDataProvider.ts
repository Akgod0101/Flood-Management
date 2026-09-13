import { Basin } from '../models/basin';

/**
 * BasinDataProvider
 * Interface for loading river basin metadata, boundaries, and topological graph structure.
 * Swappable between mock/scaffold implementations and future geospatial services.
 */
export interface BasinDataProvider {
  getBasins(): Promise<Basin[]>;
  getBasinById(basinId: string): Promise<Basin | null>;
}
