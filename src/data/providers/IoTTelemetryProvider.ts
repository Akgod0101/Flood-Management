import { Sensor } from '../models/telemetry';

/**
 * IoTTelemetryProvider
 * Interface for high-frequency in-situ sensor networks (ultrasonic gauges, tipping buckets, TDR soil probes).
 * Note: Per project principles, IoT is one observation layer, not the sole foundation.
 * The system remains functional even when IoT streams are sparse or unavailable.
 */
export interface IoTTelemetryProvider {
  getZoneSensors(zoneId: string): Promise<Sensor[]>;
  getSensorReading(sensorId: string): Promise<{
    value: number;
    unit: string;
    timestamp: string;
    isSynthetic: boolean;
  } | null>;
}
