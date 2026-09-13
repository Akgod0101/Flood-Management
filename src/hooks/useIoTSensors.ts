'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Basin, Sensor } from '@/types/flood';
import { generateInitialSensors, simulateSensorTick } from '@/engine/sensorSimulator';

export interface UseIoTSensorsReturn {
  sensors: Sensor[];
  selectedSensor: Sensor | null;
  selectedSensorId: string | null;
  isLiveStreaming: boolean;
  tickCount: number;
  lastUpdated: Date;
  selectSensor: (sensorId: string | null) => void;
  toggleLiveStreaming: () => void;
  setLiveStreaming: (active: boolean) => void;
  forceTick: () => void;
}

/**
 * useIoTSensors
 * Clean React hook managing high-frequency simulated IoT sensor telemetry.
 * Ticks deterministically every intervalMs (default 2.5s) to produce realistic
 * hydrologically coupled observations across the river basin.
 */
export function useIoTSensors(
  basin: Basin | null,
  intervalMs: number = 2500
): UseIoTSensorsReturn {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [tickCount, setTickCount] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Initialize sensors when basin is loaded or changes
  useEffect(() => {
    if (!basin || basin.zones.length === 0) return;
    const initial = generateInitialSensors(basin.zones);
    setSensors(initial);
    setTickCount(0);
    setLastUpdated(new Date());
  }, [basin?.id]);

  // Handle live deterministic stream ticker
  useEffect(() => {
    if (!isLiveStreaming || !basin || sensors.length === 0) return;

    const timer = setInterval(() => {
      setTickCount((prevTick) => {
        const nextTick = prevTick + 1;
        setSensors((current) => simulateSensorTick(current, basin, nextTick));
        setLastUpdated(new Date());
        return nextTick;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isLiveStreaming, basin, intervalMs, sensors.length]);

  const selectSensor = useCallback((sensorId: string | null) => {
    setSelectedSensorId(sensorId);
  }, []);

  const toggleLiveStreaming = useCallback(() => {
    setIsLiveStreaming((prev) => !prev);
  }, []);

  const setLiveStreaming = useCallback((active: boolean) => {
    setIsLiveStreaming(active);
  }, []);

  const forceTick = useCallback(() => {
    if (!basin) return;
    setTickCount((prevTick) => {
      const nextTick = prevTick + 1;
      setSensors((current) => simulateSensorTick(current, basin, nextTick));
      setLastUpdated(new Date());
      return nextTick;
    });
  }, [basin]);

  const selectedSensor = useMemo(() => {
    if (!selectedSensorId) return null;
    return (
      sensors.find(
        (s) => s.id === selectedSensorId || s.sensorId === selectedSensorId
      ) || null
    );
  }, [sensors, selectedSensorId]);

  return {
    sensors,
    selectedSensor,
    selectedSensorId,
    isLiveStreaming,
    tickCount,
    lastUpdated,
    selectSensor,
    toggleLiveStreaming,
    setLiveStreaming,
    forceTick,
  };
}
