/** Small confidence indicators (dot + bar) reused across chords and tabs. */
import { confidenceLevel } from '@/lib/format';

const DOT_COLOR: Record<string, string> = {
  high: 'bg-signal-green',
  medium: 'bg-signal-amber',
  low: 'bg-signal-red',
};

export function ConfidenceDot({ value, className = '' }: { value: number; className?: string }) {
  const level = confidenceLevel(value);
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLOR[level]} ${className}`}
      title={`${Math.round(value * 100)}% confidence`}
    />
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const level = confidenceLevel(value);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full ${DOT_COLOR[level]} transition-all`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}
