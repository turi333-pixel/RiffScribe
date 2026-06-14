/**
 * Chord inference from detected note events.
 *
 * For each beat-sized window we build an amplitude-weighted pitch-class profile
 * from the notes sounding in it, score it against a bank of chord templates,
 * pick the best root+quality, then merge consecutive identical chords into
 * spans. This produces real chord names derived from what was actually played.
 */
import type { Chord } from '@/types';
import type { NoteEvent } from './notesToTab';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Chord quality templates: intervals (semitones from root) → display suffix. */
const TEMPLATES: { suffix: string; intervals: number[] }[] = [
  { suffix: '', intervals: [0, 4, 7] }, // major
  { suffix: 'm', intervals: [0, 3, 7] }, // minor
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] },
  { suffix: '5', intervals: [0, 7] }, // power chord
];

/**
 * Score a 12-bin pitch-class profile against every template/root and return
 * the best chord name with a 0–1 confidence, or null if the profile is too
 * weak/ambiguous to call a chord.
 */
function bestChord(pcp: number[]): { name: string; confidence: number } | null {
  const total = pcp.reduce((a, b) => a + b, 0);
  if (total < 1e-4) return null;

  let best: { name: string; score: number } | null = null;
  for (let root = 0; root < 12; root++) {
    for (const tmpl of TEMPLATES) {
      let inChord = 0;
      for (const iv of tmpl.intervals) inChord += pcp[(root + iv) % 12];
      // Penalise energy on non-chord tones so dense noise doesn't win.
      const outChord = total - inChord;
      const score = inChord - 0.55 * outChord - tmpl.intervals.length * 0.0001;
      if (!best || score > best.score) {
        best = { name: NOTE_NAMES[root] + tmpl.suffix, score };
      }
    }
  }
  if (!best) return null;
  const confidence = Math.max(0, Math.min(1, best.score / total));
  if (confidence < 0.25) return null;
  return { name: best.name, confidence };
}

export function detectChords(
  notes: NoteEvent[],
  bpm: number,
  duration: number,
): Chord[] {
  const beat = 60 / bpm;
  // Analyse on a half-bar grid (2 beats) — chords usually change there or
  // slower, and it keeps the chart readable.
  const window = beat * 2;
  const raw: { start: number; end: number; name: string; confidence: number }[] = [];

  for (let t = 0; t < duration; t += window) {
    const end = t + window;
    const pcp = new Array(12).fill(0);
    for (const n of notes) {
      const noteEnd = n.startTimeSeconds + n.durationSeconds;
      const overlap = Math.min(end, noteEnd) - Math.max(t, n.startTimeSeconds);
      if (overlap <= 0) continue;
      pcp[((n.pitchMidi % 12) + 12) % 12] += n.amplitude * overlap;
    }
    const chord = bestChord(pcp);
    if (chord) raw.push({ start: t, end, name: chord.name, confidence: chord.confidence });
  }

  // Merge consecutive windows with the same chord name into spans.
  const merged: Chord[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.chordName === seg.name && Math.abs(last.endTime - seg.start) < 1e-6) {
      last.endTime = seg.end;
      last.confidence = Math.max(last.confidence, seg.confidence);
    } else {
      merged.push({
        startTime: seg.start,
        endTime: seg.end,
        chordName: seg.name,
        confidence: seg.confidence,
      });
    }
  }
  return merged;
}
