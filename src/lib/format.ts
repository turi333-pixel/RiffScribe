/** Formatting helpers for time and confidence display. */

/** Seconds → "m:ss" (or "m:ss.t" with `tenths`). */
export function formatTime(seconds: number, tenths = false): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (tenths) {
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }
  return `${m}:${Math.floor(s).toString().padStart(2, '0')}`;
}

/** 0–1 → "87%". */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Map a 0–1 confidence to a traffic-light bucket used for colour coding
 * throughout the UI.
 */
export function confidenceLevel(value: number): 'high' | 'medium' | 'low' {
  if (value >= 0.8) return 'high';
  if (value >= 0.55) return 'medium';
  return 'low';
}

export function confidenceColor(value: number): string {
  switch (confidenceLevel(value)) {
    case 'high':
      return 'text-signal-green';
    case 'medium':
      return 'text-signal-amber';
    default:
      return 'text-signal-red';
  }
}

/** Generate a short, reasonably-unique id (no external dependency). */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
