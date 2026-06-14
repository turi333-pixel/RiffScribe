/**
 * Fretboard logic: turn chord names and melody notes into concrete string/fret
 * positions for *any* tuning. This is what lets the app "regenerate tab
 * fingering" when the user changes tuning.
 *
 * It is intentionally a heuristic voicer, not a full chord-shape database — it
 * produces playable, readable voicings for arbitrary tunings without shipping
 * thousands of hard-coded shapes.
 */
import { NOTE_NAMES, noteToMidi } from '@/lib/music';
import type { TabNote, Technique, Tuning } from '@/types';

const PITCH_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** Interval recipes (semitones from root) for supported chord qualities. */
const QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7], // major
  maj: [0, 4, 7],
  M: [0, 4, 7],
  m: [0, 3, 7], // minor
  min: [0, 3, 7],
  '5': [0, 7], // power chord
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10], // dominant 7
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '9': [0, 4, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};

export interface ParsedChord {
  root: string; // pitch class, e.g. "E"
  rootPc: number; // 0–11
  quality: string;
  bassPc?: number; // for slash chords, e.g. G/B
  /** Pitch classes (0–11) that belong to the chord. */
  pitchClasses: number[];
}

/**
 * Parse a chord name like "Em", "Cadd9", "G/B", "F#m7b5" into its pitch
 * classes. Returns null if it can't be understood (falls back to a power
 * chord elsewhere).
 */
export function parseChord(name: string): ParsedChord | null {
  const slash = name.split('/');
  const main = slash[0].trim();
  const bass = slash[1]?.trim();

  const match = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!match) return null;
  const [, root, qualityRaw] = match;
  const rootPc = PITCH_INDEX[root];
  if (rootPc === undefined) return null;

  const quality = qualityRaw.trim();
  const intervals = QUALITY_INTERVALS[quality] ?? QUALITY_INTERVALS[''];

  const pitchClasses = intervals.map((i) => (rootPc + i) % 12);
  const bassPc = bass ? PITCH_INDEX[bass] : undefined;
  if (bassPc !== undefined && !pitchClasses.includes(bassPc)) {
    pitchClasses.unshift(bassPc);
  }

  return { root, rootPc, quality, bassPc, pitchClasses };
}

/** MIDI note of a given string played at a given fret, for this tuning. */
function openStringMidi(tuning: Tuning, stringIndex: number): number {
  // tuning.strings is low→high; stringIndex 0 = low E (6th string).
  return noteToMidi(tuning.strings[stringIndex]);
}

/**
 * Voice a chord on the fretboard for the given tuning.
 *
 * Returns one entry per string from 1 (high) to 6 (low). A fret of `-1` means
 * the string is muted / not played. The algorithm walks strings low→high,
 * choosing the lowest fret near a moving "hand position" whose note belongs to
 * the chord, preferring the bass note on the lowest sounding string.
 */
export function voiceChord(
  name: string,
  tuning: Tuning,
  opts: { maxFret?: number } = {},
): { stringNumber: number; fret: number }[] {
  const maxFret = opts.maxFret ?? 12;
  const parsed = parseChord(name);

  // Unknown chord → root power chord on the low strings.
  const chordPcs = parsed?.pitchClasses ?? [0, 7];
  const rootPc = parsed?.rootPc ?? 0;
  const bassPc = parsed?.bassPc ?? rootPc;

  const result: { stringNumber: number; fret: number }[] = [];
  let handPosition = 0; // tracks where the fretting hand sits
  let lowestVoiced = -1;

  for (let strIdx = 0; strIdx < 6; strIdx++) {
    const open = openStringMidi(tuning, strIdx);
    const stringNumber = 6 - strIdx; // strIdx 0 (low E) → string 6

    // Desired pitch class: bass note for the first sounding string, otherwise
    // any chord tone.
    const wantBass = lowestVoiced === -1;
    const candidates = wantBass ? [bassPc] : chordPcs;

    let best = -1;
    for (let fret = 0; fret <= maxFret; fret++) {
      const pc = (open + fret) % 12;
      if (!candidates.includes(pc)) continue;
      // Stay near the hand position for playability (open strings always ok).
      if (lowestVoiced !== -1 && fret !== 0 && Math.abs(fret - handPosition) > 4) continue;
      best = fret;
      break;
    }

    if (best === -1 && wantBass) {
      // No bass note reachable on this string; try any chord tone instead.
      for (let fret = 0; fret <= maxFret; fret++) {
        const pc = (open + fret) % 12;
        if (chordPcs.includes(pc)) {
          best = fret;
          break;
        }
      }
    }

    if (best === -1) {
      result.push({ stringNumber, fret: -1 });
      continue;
    }

    if (lowestVoiced === -1) lowestVoiced = strIdx;
    if (best > 0) handPosition = best;
    result.push({ stringNumber, fret: best });
  }

  // Power chords: only keep the root, fifth and octave on the low strings.
  if (parsed?.quality === '5') {
    return result.map((r, strIdx) => (strIdx >= 3 ? r : { ...r, fret: -1 }));
  }

  return result.sort((a, b) => a.stringNumber - b.stringNumber);
}

/**
 * Map a single melody note (MIDI) to the most natural string/fret in the
 * tuning, preferring a low fret on a string that isn't too high.
 */
export function noteToTab(
  midi: number,
  tuning: Tuning,
  opts: { preferStringIndex?: number; maxFret?: number } = {},
): { stringNumber: number; fret: number } | null {
  const maxFret = opts.maxFret ?? 16;
  let best: { stringNumber: number; fret: number; score: number } | null = null;

  for (let strIdx = 0; strIdx < 6; strIdx++) {
    const open = openStringMidi(tuning, strIdx);
    const fret = midi - open;
    if (fret < 0 || fret > maxFret) continue;
    // Lower frets and proximity to a preferred string score better.
    const proximity =
      opts.preferStringIndex !== undefined ? Math.abs(strIdx - opts.preferStringIndex) : 0;
    const score = fret + proximity * 1.5;
    if (!best || score < best.score) {
      best = { stringNumber: 6 - strIdx, fret, score };
    }
  }
  if (!best) return null;
  return { stringNumber: best.stringNumber, fret: best.fret };
}

/** MIDI pitch a note currently sounds, given the tuning it was written for. */
function noteMidi(note: TabNote, tuning: Tuning): number {
  const strIdx = 6 - note.stringNumber; // string 6 (low E) → index 0
  return openStringMidi(tuning, strIdx) + note.fret;
}

/**
 * Re-fret every note for a new tuning, preserving timing, technique and — for
 * single (melody) notes — the actual pitch. Chord stacks (multiple notes at the
 * same instant) are re-voiced from the chord; single notes are transposed by
 * deriving their MIDI pitch in the old tuning and re-placing it in the new one.
 *
 * Passing the same tuning for old & new (with a changed chord) simply re-voices
 * chord stacks — used by chord correction.
 */
export function regenerateForTuning(
  notes: TabNote[],
  chordAt: (t: number) => string | undefined,
  oldTuning: Tuning,
  newTuning: Tuning,
): TabNote[] {
  // Group notes by their start time so chord stacks re-voice as a unit.
  const byTime = new Map<number, TabNote[]>();
  for (const n of notes) {
    const arr = byTime.get(n.startTime) ?? [];
    arr.push(n);
    byTime.set(n.startTime, arr);
  }

  const out: TabNote[] = [];
  for (const [time, group] of byTime) {
    const chordName = chordAt(time);
    if (group.length > 1 && chordName) {
      const voicing = voiceChord(chordName, newTuning).filter((v) => v.fret >= 0);
      voicing.forEach((v, i) => {
        const template = group[Math.min(i, group.length - 1)];
        out.push({
          ...template,
          stringNumber: v.stringNumber,
          fret: v.fret,
        });
      });
    } else {
      // Single melody note: transpose by pitch into the new tuning.
      for (const n of group) {
        if (oldTuning.strings.join() === newTuning.strings.join()) {
          out.push(n);
          continue;
        }
        const pos = noteToTab(noteMidi(n, oldTuning), newTuning);
        out.push(pos ? { ...n, stringNumber: pos.stringNumber, fret: pos.fret } : n);
      }
    }
  }
  return out.sort((a, b) => a.startTime - b.startTime || a.stringNumber - b.stringNumber);
}

export const ALL_NOTE_NAMES = NOTE_NAMES;
export const TECHNIQUE_SYMBOLS: Record<Technique, string> = {
  normal: '',
  slide: '/',
  bend: 'b',
  'hammer-on': 'h',
  'pull-off': 'p',
  vibrato: '~',
  mute: 'x',
};
