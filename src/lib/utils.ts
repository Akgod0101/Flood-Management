import type { AlertLevel } from '@/types';

// Smooth green → red gradient for heatmap visualization
// 0 = green (low risk), 100 = red (high risk)
// Interpolates through: green → lime → yellow → orange → red
function interpolateColor(c1: number[], c2: number[], t: number): number[] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

export function riskColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  const t = s / 100;

  // Color stops: green → lime → yellow → orange → red
  const stops: number[][] = [
    [34, 197, 94],    // green-500 (#22c55e)
    [132, 204, 22],   // lime-500 (#84cc16)
    [234, 179, 8],    // yellow-500 (#eab308)
    [234, 88, 12],    // orange-500 (#ea580c)
    [220, 38, 38],    // red-600 (#dc2626)
  ];

  const segment = t * (stops.length - 1);
  const idx = Math.floor(segment);
  const frac = segment - idx;

  const c = idx >= stops.length - 1
    ? stops[stops.length - 1]
    : interpolateColor(stops[idx], stops[idx + 1], frac);

  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function riskBgColor(score: number, opacity = 0.4): string {
  const s = Math.max(0, Math.min(100, score));
  const t = s / 100;

  const stops: number[][] = [
    [34, 197, 94],
    [132, 204, 22],
    [234, 179, 8],
    [234, 88, 12],
    [220, 38, 38],
  ];

  const segment = t * (stops.length - 1);
  const idx = Math.floor(segment);
  const frac = segment - idx;

  const c = idx >= stops.length - 1
    ? stops[stops.length - 1]
    : interpolateColor(stops[idx], stops[idx + 1], frac);

  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${opacity})`;
}

export function alertLevelColor(level: AlertLevel): string {
  switch (level) {
    case 'DANGER': return '#dc2626';
    case 'WARNING': return '#ea580c';
    case 'WATCH': return '#eab308';
    default: return '#22c55e';
  }
}

export function alertLevelBg(level: AlertLevel): string {
  switch (level) {
    case 'DANGER': return 'bg-red-600 text-white';
    case 'WARNING': return 'bg-orange-600 text-white';
    case 'WATCH': return 'bg-yellow-500 text-black';
    default: return 'bg-green-600 text-white';
  }
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
