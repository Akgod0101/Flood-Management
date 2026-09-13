import { RainfallDataProvider, ZoneRainfallObservation } from '../providers/RainfallDataProvider';

/**
 * IMDRainfallAdapter (Stub / Future Adapter)
 * 
 * Target Integration: India Meteorological Department (IMD) Gridded Rainfall / AWS Network.
 * In Phase 4, this adapter will ingest:
 * - 0.25° x 0.25° daily/sub-daily gridded rainfall over Assam sub-basins
 * - Real-time Automatic Weather Station (AWS) precipitation gauges
 * - GPM (Global Precipitation Measurement) IMERG early run feeds
 */
export class IMDRainfallAdapter implements RainfallDataProvider {
  private apiEndpoint: string;

  constructor(apiEndpoint = 'https://mausam.imd.gov.in/api/gridded-rainfall') {
    this.apiEndpoint = apiEndpoint;
  }

  async getRainfallObservation(zoneId: string, timestamp?: string): Promise<ZoneRainfallObservation | null> {
    // TODO [Phase 4]: Intersect catchment geometry with IMD precipitation grid
    return null;
  }

  async getAccumulatedRainfall(zoneId: string, hours: number): Promise<number> {
    // TODO [Phase 4]: Aggregate IMD rainfall over requested time window
    return 0;
  }
}
