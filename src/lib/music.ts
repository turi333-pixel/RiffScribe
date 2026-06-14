/**
 * Music-theory helpers: note ↔ frequency conversion, scientific-pitch parsing,
 * and fretboard math. Pure functions, no side effects — safe to use anywhere.
 */

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

const A4_FREQ = 440;
const A4_MIDI = 69;

/** MIDI note number → frequency in Hz (equal temperament, A4 = 440Hz). */
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Frequency in Hz → (fractional) MIDI note number. */
export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

/** Parse scientific pitch notation, e.g. "E2", "C#4", "Gb3" → MIDI number. */
export function noteToMidi(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) throw new Error(`Invalid note: ${note}`);
  const [, letter, accidental, octaveStr] = match;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = base[letter];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  const octave = parseInt(octaveStr, 10);
  // MIDI: C-1 = 0, so C4 = 60.
  return semitone + (octave + 1) * 12;
}

/** Scientific pitch notation → frequency in Hz. */
export function noteToFreq(note: string): number {
  return midiToFreq(noteToMidi(note));
}

/** MIDI number → { name, octave }, using sharps. */
export function midiToNote(midi: number): { name: NoteName; octave: number } {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave };
}

/** Pretty scientific pitch string from MIDI, e.g. 64 → "E4". */
export function midiToNoteName(midi: number): string {
  const { name, octave } = midiToNote(midi);
  return `${name}${octave}`;
}

/**
 * Given a detected frequency, return the nearest equal-tempered note and how
 * far off it is, in cents (−50…+50). Used by the tuner.
 */
export function analysePitch(freq: number): {
  midi: number;
  noteName: string;
  cents: number;
} {
  const exactMidi = freqToMidi(freq);
  const midi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - midi) * 100);
  return { midi, noteName: midiToNoteName(midi), cents };
}

/**
 * Given a string's open-note MIDI and a target fret, return the resulting note.
 */
export function fretToMidi(openMidi: number, fret: number): number {
  return openMidi + fret;
}

/** Strip the octave from a scientific pitch string: "E2" → "E". */
export function pitchClass(note: string): string {
  return note.replace(/-?\d+$/, '');
}
