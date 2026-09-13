'use client';

import {
  LayoutDashboard,
  Network,
  MapPin,
  Satellite,
  History,
  Bell,
  Database,
  Play,
  Square,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import type { PageId } from '@/types';

interface Props {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onStep: () => void;
}

const navItems: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'basin-graph', label: 'Basin Graph', icon: Network },
  { id: 'zone-details', label: 'Zone Details', icon: MapPin },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'historical', label: 'Historical Validation', icon: History },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'data-sources', label: 'Data Sources', icon: Database },
];

export function Sidebar({ activePage, onPageChange, isRunning, onStart, onStop, onReset, onStep }: Props) {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col flex-shrink-0 h-full">
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-2 flex-shrink-0">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-1">Simulation Control</div>
        {!isRunning ? (
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors shadow-md shadow-green-600/20"
          >
            <Play className="w-4 h-4" />
            Start Flood Event
          </button>
        ) : (
          <button
            onClick={onStop}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors shadow-md shadow-red-600/20"
          >
            <Square className="w-4 h-4" />
            Stop Simulation
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onStep}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <StepForward className="w-3.5 h-3.5" />
            Step
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
}
