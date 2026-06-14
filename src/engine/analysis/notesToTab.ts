/**
 * Convert detected note events into tab lines for a given tuning.
 *
 * Notes are placed on the most natural string/fret via the fretboard mapper,
 * given a light technique read from the pitch-bend data, then segmented into
 * readable lines of two bars each.
 */
import type { TabLine, TabNote, Technique, Tuning } from '@/types';
import { noteToTab } from '../fretboard';
import { uid } from '@/lib/format';

/** Mirrors basic-pitch's NoteEventTime so this module has no hard dependency. */
export interface NoteEvent {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
  pitchBends?: number[];
}

/**
 * Classify a technique from the note's pitch-bend contour, if any. basic-pitch
 * reports bends in contour bins (~3 bins per semitone), so we require a clearly
 * audible deviation (≈⅔ of a semitone) before calling a bend/vibrato — steady
 * notes stay 'normal' rather than getting spurious bend marks.
 */
function techniqueFromBends(bends?: number[]): Technique {
  if (!bends || bends.length < 4) return 'normal';
  let min = Infinity;
  let max = -Infinity;
  for (const b of bends) {
    if (b < min) min = b;
    if (b > max) max = b;
  }
  const range = max - min;
  if (range < 2) return 'normal'; // < ~0.7 semitone — just intonation wobble
  // A sustained one-directional rise → bend; oscillation → vibrato.
  const net = Math.abs(bends[bends.length - 1] - bends[0]);
  return net > range * 0.6 ? 'bend' : 'vibrato';
}

export function notesToTabLines(
  notes: NoteEvent[],
  tuning: Tuning,
  bpm: number,
  duration: number,
): TabLine[] {
  const bar = (60 / bpm) * 4;
  const lineSpan = bar * 2;
  const lineCount = Math.max(1, Math.ceil(duration / lineSpan));

  // Map every note to a fret position once.
  const placed: TabNote[] = [];
  // Normalise amplitude → confidence.
  const maxAmp = notes.reduce((m, n) => Math.max(m, n.amplitude), 0.0001);
  for (const n of notes) {
    const pos = noteToTab(n.pitchMidi, tuning);
    if (!pos) continue; // out of fretboard range
    placed.push({
      stringNumber: pos.stringNumber,
      fret: pos.fret,
      startTime: n.startTimeSeconds,
      duration: n.durationSeconds,
      technique: techniqueFromBends(n.pitchBends),
      confidence: Math.max(0.3, Math.min(1, n.amplitude / maxAmp)),
    });
  }
  placed.sort((a, b) => a.startTime - b.startTime || a.stringNumber - b.stringNumber);

  const lines: TabLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const start = i * lineSpan;
    const end = Math.min((i + 1) * lineSpan, duration);
    lines.push({
      id: uid('line'),
      startTime: start,
      endTime: end,
      notes: placed.filter((n) => n.startTime >= start && n.startTime < end),
    });
  }
  // Drop trailing empty lines (silence at the end).
  while (lines.length > 1 && lines[lines.length - 1].notes.length === 0) lines.pop();
  return lines;
}
