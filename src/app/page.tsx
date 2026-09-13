'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Basin, BasinEvent, SimulationStep, RainfallScenario, AIPrediction, RiskLevel } from '@/types/flood';
import { BasinService } from '@/services/basinService';
import { simulateFloodPropagation } from '@/engine/propagationEngine';
import { generateBasinRainfallForecast } from '@/engine/forecastGenerator';
import { predictAllZones } from '@/services/mlPredictionService';
import { useIoTSensors } from '@/hooks/useIoTSensors';
import dynamic from 'next/dynamic';
import { Header } from '@/components/dashboard/Header';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { ZoneDetailsPanel } from '@/components/dashboard/ZoneDetailsPanel';
import { TimelineScrubber } from '@/components/dashboard/TimelineScrubber';

const MapArea = dynamic(
  () => import('@/components/dashboard/MapArea').then((mod) => mod.MapArea),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 h-full w-full flex items-center justify-center bg-slate-950 text-cyan-400">
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>INITIALIZING MAPLIBRE SPATIAL ENGINE...</span>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  const [basins, setBasins] = useState<Basin[]>([]);
  const [selectedBasinId, setSelectedBasinId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Rainfall forecast scenario: normal | heavy | extreme
  const [rainfallScenario, setRainfallScenario] = useState<RainfallScenario>('heavy');

  // Simulation timeline state (0 to 24 hours)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);

  // AI Prediction state (map of zoneId -> AIPrediction)
  const [aiPredictions, setAiPredictions] = useState<Record<string, AIPrediction>>({});

  // Load initial data through BasinService abstraction
  useEffect(() => {
    async function initData() {
      const loadedBasins = await BasinService.getBasins();
      setBasins(loadedBasins);

      if (loadedBasins.length > 0) {
        setSelectedBasinId(loadedBasins[0].id);
        if (loadedBasins[0].availableEvents.length > 0) {
          setSelectedEventId(loadedBasins[0].availableEvents[0].id);
        }
      }
    }

    initData();
  }, []);

  // Current active basin template
  const currentBasin = useMemo(() => {
    return basins.find((b) => b.id === selectedBasinId) || basins[0];
  }, [basins, selectedBasinId]);

  // Current active event object
  const currentEvent = useMemo(() => {
    if (!currentBasin) return null;
    return (
      currentBasin.availableEvents.find((e) => e.id === selectedEventId) ||
      currentBasin.availableEvents[0]
    );
  }, [currentBasin, selectedEventId]);

  // Generate simulated rainfall forecast for all zones based on the selected scenario
  const basinForecast = useMemo(() => {
    if (!currentBasin || currentBasin.zones.length === 0) return null;
    return generateBasinRainfallForecast(currentBasin, rainfallScenario);
  }, [currentBasin, rainfallScenario]);

  // 1. Run deterministic 24-hour propagation simulation consuming the rainfall forecast
  const simulationResult = useMemo(() => {
    if (!currentBasin || currentBasin.zones.length === 0) return null;
    return simulateFloodPropagation(currentBasin, currentBasin.zones, 24, basinForecast);
  }, [currentBasin, basinForecast]);

  // 2. Generate 25 hourly timeline steps (Hour 0 to Hour 24)
  const simulationSteps: SimulationStep[] = useMemo(() => {
    if (!simulationResult) return [];
    return simulationResult.hourlySteps.map((step) => ({
      stepIndex: step.hour,
      relativeTimeHours: step.hour,
      label: step.label,
      timestamp: step.timestamp,
      isForecast: step.hour > 0,
    }));
  }, [simulationResult]);

  // 3. Current active basin with dynamic zone states for the active simulation hour
  const activeBasin: Basin | null = useMemo(() => {
    if (!currentBasin) return null;
    if (!simulationResult) return currentBasin;

    const hourStep = simulationResult.hourlySteps[currentStepIndex] || simulationResult.hourlySteps[0];
    if (!hourStep) return currentBasin;

    const updatedZones = currentBasin.zones.map((zone) => {
      const sim = hourStep.zoneStates[zone.id];
      if (!sim) return zone;

      const aiPred = aiPredictions[zone.id];
      const effectiveRisk: RiskLevel = aiPred?.risk_tier || sim.riskLevel;

      // Update the 12-hour history chart to reflect simulated water progression up to this hour
      const history = (zone.currentState.waterLevelHistory || []).map((pt, idx, arr) => {
        if (idx === arr.length - 1) {
          return { ...pt, value: sim.waterLevel };
        }
        return pt;
      });

      return {
        ...zone,
        riskLevel: effectiveRisk,
        currentWaterLevelMeters: sim.waterLevel,
        aiPrediction: aiPred,
        latestPrediction: aiPred
          ? {
              horizonHours: 3,
              riskLevel: effectiveRisk,
              peakWaterLevelMeters: sim.waterLevel * (1 + (aiPred.probabilities.flood_probability_3h || 0) * 0.2),
              estimatedTimeToPeakHours: 3,
              confidence: aiPred.confidence,
              keyDrivers: [
                `AI P(1h) = ${(aiPred.probabilities.flood_probability_1h * 100).toFixed(1)}%`,
                `AI P(3h) = ${(aiPred.probabilities.flood_probability_3h * 100).toFixed(1)}%`,
                `AI P(6h) = ${(aiPred.probabilities.flood_probability_6h * 100).toFixed(1)}%`,
                aiPred.isAvailable ? 'Live XGBoost Multi-Horizon Model' : 'Deterministic Physical Fallback',
              ],
            }
          : zone.latestPrediction,
        currentState: {
          ...zone.currentState,
          waterLevel: sim.waterLevel,
          currentWaterLevel: sim.waterLevel,
          waterLevelRiseRate: sim.waterLevelRiseRate,
          incomingFlow: sim.incomingFlow,
          outgoingFlow: sim.outgoingFlow,
          rainfall: sim.rainfall,
          rainfallCurrent: sim.rainfall,
          soilSaturation: sim.soilSaturation,
          soilMoisture: sim.currentSoilMoisture ?? zone.currentState.soilMoisture,
          currentSoilMoisture: sim.currentSoilMoisture ?? zone.currentState.currentSoilMoisture,
          saturation: sim.saturation ?? zone.currentState.saturation,
          soilType: sim.soilType ?? zone.currentState.soilType,
          porosity: sim.porosity ?? zone.currentState.porosity,
          infiltrationCapacity: sim.infiltrationCapacity ?? zone.currentState.infiltrationCapacity,
          remainingStorage: sim.remainingStorage ?? zone.currentState.remainingStorage,
          actualInfiltration: sim.actualInfiltration ?? zone.currentState.actualInfiltration,
          surfaceRunoff: sim.surfaceRunoff ?? zone.currentState.surfaceRunoff,
          riskExplanation: sim.riskExplanation ?? zone.currentState.riskExplanation,
          aiPrediction: aiPred,
          confidence: aiPred?.confidence ?? zone.currentState.confidence ?? 0.85,
          predictionConfidence: aiPred?.confidence ?? zone.currentState.predictionConfidence ?? 0.85,
          floodRisk: effectiveRisk,
          waterLevelHistory: history,
        },
      };
    });

    const updatedEdges = currentBasin.edges.map((edge) => {
      const discharge = hourStep.edgeDischarges[edge.id];
      return {
        ...edge,
        currentDischargeM3PerSec: discharge !== undefined ? discharge : edge.currentDischargeM3PerSec,
      };
    });

    return {
      ...currentBasin,
      zones: updatedZones,
      edges: updatedEdges,
    };
  }, [currentBasin, simulationResult, currentStepIndex, aiPredictions]);

  // 3b. Asynchronous AI Prediction Cycle (FastAPI XGBoost backend)
  useEffect(() => {
    if (!currentBasin || currentBasin.zones.length === 0) return;

    let isCancelled = false;

    async function executePredictionCycle() {
      try {
        const hourStep = simulationResult?.hourlySteps[currentStepIndex] || simulationResult?.hourlySteps[0];
        const zonesForInference = currentBasin.zones.map((zone) => {
          const sim = hourStep?.zoneStates[zone.id];
          if (!sim) return zone;
          return {
            ...zone,
            currentWaterLevelMeters: sim.waterLevel,
            currentState: {
              ...zone.currentState,
              waterLevel: sim.waterLevel,
              currentWaterLevel: sim.waterLevel,
              waterLevelRiseRate: sim.waterLevelRiseRate,
              incomingFlow: sim.incomingFlow,
              rainfall: sim.rainfall,
              rainfallCurrent: sim.rainfall,
              soilSaturation: sim.soilSaturation,
              remainingStorage: sim.remainingStorage ?? zone.currentState.remainingStorage,
            },
          };
        });

        const predictions = await predictAllZones(zonesForInference, basinForecast);
        if (!isCancelled) {
          setAiPredictions(predictions);
        }
      } catch (err) {
        console.warn('[AI Prediction Cycle] Non-fatal error during cycle:', err);
      }
    }

    executePredictionCycle();

    return () => {
      isCancelled = true;
    };
  }, [currentBasin?.id, currentStepIndex, rainfallScenario, basinForecast, simulationResult]);

  // Current active zone object (derived from activeBasin)
  const selectedZone = useMemo(() => {
    if (!activeBasin || !selectedZoneId) return null;
    return activeBasin.zones.find((z) => z.id === selectedZoneId) || null;
  }, [activeBasin, selectedZoneId]);

  // Current timeline step info
  const currentStep = useMemo(() => {
    if (simulationSteps.length === 0) {
      return { stepIndex: 0, relativeTimeHours: 0, label: 'T-0 (Baseline)', timestamp: new Date().toISOString(), isForecast: false };
    }
    return simulationSteps[currentStepIndex] || simulationSteps[0];
  }, [simulationSteps, currentStepIndex]);

  // 4. Live Simulated IoT Sensor Stream Hook
  const {
    sensors,
    selectedSensorId,
    selectSensor,
    isLiveStreaming,
  } = useIoTSensors(activeBasin);

  // Handle simulation playback ticker (advancing through the 24 hours)
  useEffect(() => {
    if (!isPlaying || simulationSteps.length === 0) return;

    const intervalMs = Math.max(700, 2000 / simulationSpeed);
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= simulationSteps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, simulationSpeed, simulationSteps.length]);

  // Handlers
  const handleSelectBasin = (basinId: string) => {
    setSelectedBasinId(basinId);
    setSelectedZoneId(null);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    const nextBasin = basins.find((b) => b.id === basinId);
    if (nextBasin && nextBasin.availableEvents.length > 0) {
      setSelectedEventId(nextBasin.availableEvents[0].id);
    }
  };

  const handleTogglePlay = () => {
    if (!isPlaying && currentStepIndex >= simulationSteps.length - 1) {
      setCurrentStepIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.min(simulationSteps.length - 1, prev + 1));
  };

  const handleResetSimulation = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0); // Reset to T-0
  };

  if (!activeBasin || !currentEvent) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider">
            RUNNING DETERMINISTIC HYDROLOGICAL ENGINE...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 1. Global Header */}
      <Header
        currentBasin={activeBasin}
        currentEvent={currentEvent}
        currentTimeLabel={currentStep.label}
        isLiveIoT={isLiveStreaming}
        rainfallScenario={rainfallScenario}
      />

      {/* 2. Main Middle Workspace (Sidebar, Map Canvas, Details Panel) */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Sidebar */}
        <Sidebar
          basins={basins}
          selectedBasin={activeBasin}
          onSelectBasin={handleSelectBasin}
          selectedEvent={currentEvent}
          onSelectEvent={setSelectedEventId}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
          onResetSimulation={handleResetSimulation}
          simulationSpeed={simulationSpeed}
          onSetSimulationSpeed={setSimulationSpeed}
          currentTimeLabel={currentStep.label}
          rainfallScenario={rainfallScenario}
          onSelectRainfallScenario={setRainfallScenario}
        />

        {/* Central Map Area with dynamic zone colors, flow propagation & IoT sensor markers */}
        <MapArea
          basin={activeBasin}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          sensors={sensors}
          selectedSensorId={selectedSensorId}
          onSelectSensor={selectSensor}
          isLiveStreaming={isLiveStreaming}
        />

        {/* Right Information Panel with simulated zone state & forecast */}
        <ZoneDetailsPanel
          basin={activeBasin}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZoneId}
          onClearSelection={() => setSelectedZoneId(null)}
          basinForecast={basinForecast}
          rainfallScenario={rainfallScenario}
          onSelectScenario={setRainfallScenario}
        />
      </div>

      {/* 3. Bottom Timeline Scrubber */}
      <TimelineScrubber
        steps={simulationSteps}
        currentStepIndex={currentStepIndex}
        onSelectStep={(idx) => {
          setIsPlaying(false);
          setCurrentStepIndex(idx);
        }}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );
}
