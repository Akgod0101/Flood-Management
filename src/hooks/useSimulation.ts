import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type SimState,
  createInitialState,
  stepSimulation,
  startEvent,
  stopEvent,
  resetEvent,
  toggleEdgeMode,
} from '@/simulation/engine';

export function useSimulation() {
  const [state, setState] = useState<SimState>(createInitialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        setState((prev) => stepSimulation(prev));
      }, 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning]);

  const handleStart = useCallback(() => setState(startEvent), []);
  const handleStop = useCallback(() => setState(stopEvent), []);
  const handleReset = useCallback(() => setState(resetEvent()), []);
  const handleStep = useCallback(() => setState((prev) => stepSimulation(prev)), []);
  const handleToggleEdge = useCallback(
    (zoneId: string) => setState((prev) => toggleEdgeMode(prev, zoneId)),
    [],
  );

  return {
    state,
    startEvent: handleStart,
    stopEvent: handleStop,
    resetEvent: handleReset,
    step: handleStep,
    toggleEdgeMode: handleToggleEdge,
  };
}
