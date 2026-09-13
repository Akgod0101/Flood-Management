'use client';

import React from 'react';
import { SimulationStep } from '@/types/flood';
import {
  Play,
  Pause,
  Clock,
  ChevronLeft,
  ChevronRight,
  History,
  TrendingUp,
} from 'lucide-react';

interface TimelineScrubberProps {
  steps: SimulationStep[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  steps,
  currentStepIndex,
  onSelectStep,
  isPlaying,
  onTogglePlay,
}) => {
  const currentStep = steps[currentStepIndex] || steps[0];

  return (
    <footer className="h-16 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 flex items-center gap-4 z-30 shrink-0 select-none">
      {/* Playhead control & current step badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
          title={isPlaying ? 'Pause' : 'Play Timeline'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="hidden sm:flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Hydrological Timeline
          </span>
          <span className="text-xs font-mono font-bold text-white">
            {currentStep.label}
          </span>
        </div>
      </div>

      {/* Prev / Next navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
          disabled={currentStepIndex === 0}
          className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1))}
          disabled={currentStepIndex === steps.length - 1}
          className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Step Track */}
      <div className="flex-1 flex flex-col justify-center px-2">
        {/* Timeline Horizon Indicator (Past vs Forecast) */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-mono">
          <span className="flex items-center gap-1 text-slate-400">
            <History className="w-3 h-3 text-cyan-500" />
            Historical Telemetry (-12h)
          </span>
          <span className="text-cyan-400 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50">
            T-0 (Now)
          </span>
          <span className="flex items-center gap-1 text-indigo-400">
            <TrendingUp className="w-3 h-3" />
            Forecast Horizon (+24h)
          </span>
        </div>

        {/* Scrubber track with clickable steps */}
        <div className="relative w-full h-3 bg-slate-900 rounded-full border border-slate-800/80 flex items-center">
          {/* Progress fill */}
          <div
            className="absolute left-0 h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-indigo-500 rounded-full opacity-60 transition-all duration-200"
            style={{
              width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
            }}
          />

          {/* Clickable Step Points */}
          <div className="relative w-full flex justify-between px-1 z-10">
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;

              return (
                <button
                  key={step.stepIndex}
                  onClick={() => onSelectStep(idx)}
                  title={`${step.label} (${new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                  className="group relative flex flex-col items-center focus:outline-none"
                >
                  <span
                    className={`w-3 h-3 rounded-full transition-all border ${
                      isActive
                        ? 'bg-cyan-400 border-white ring-2 ring-cyan-500/50 scale-125'
                        : isPast
                        ? 'bg-cyan-700 border-cyan-500 group-hover:bg-cyan-500'
                        : 'bg-slate-800 border-slate-700 group-hover:bg-slate-700'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Timestamp / Step details */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        <span>
          {new Date(currentStep.timestamp).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          })}
        </span>
      </div>
    </footer>
  );
};
