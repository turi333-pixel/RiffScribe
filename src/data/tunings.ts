import type { Tuning } from '@/types';

/**
 * Built-in tuning presets. `strings` is ordered low (6th) → high (1st) string,
 * matching the {@link Tuning} contract.
 */
export const TUNING_PRESETS: Tuning[] = [
  { name: 'Standard', strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { name: 'Drop D', strings: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { name: 'Drop C', strings: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { name: 'D Standard', strings: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { name: 'Half-step Down', strings: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
  { name: 'Open G', strings: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { name: 'Open D', strings: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
];

export const STANDARD_TUNING: Tuning = TUNING_PRESETS[0];

/** A blank custom tuning seeded from standard, for the custom-tuning editor. */
export function createCustomTuning(): Tuning {
  return { name: 'Custom', strings: [...STANDARD_TUNING.strings] };
}

export function isPreset(tuning: Tuning): boolean {
  return TUNING_PRESETS.some(
    (p) => p.name === tuning.name && p.strings.join() === tuning.strings.join(),
  );
}
