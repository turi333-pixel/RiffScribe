/**
 * MockEngine — a fully offline, deterministic transcription engine.
 *
 * It does *light* real analysis of the decoded audio (duration, a rough
 * tempo/energy estimate) and then synthesises a musically-coherent
 * transcription: a diatonic chord progression, structural sections, and tab
 * lines voiced with the real {@link fretboard} solver. The output shape is
 * identical to what a real backend returns, so the rest of the app is
 * engine-agnostic.
 */
import { uid } from '@/lib/format';
import { noteToMidi } from '@/lib/music';
import type {
  BarMarker,
  Chord,
  Section,
  TabLine,
  TabNote,
  Technique,
} from '@/types';
import { noteToTab, voiceChord } from './fretboard';
import type {
  ProgressFn,
  TranscriptionEngine,
  TranscriptionInput,
  TranscriptionResult,
} from './types';

/** Candidate keys and a fitting chord loop for each. */
const KEY_BANK: { key: string; progression: string[]; tonicNote: string }[] = [
  { key: 'E minor', progression: ['Em', 'C', 'G', 'D'], tonicNote: 'E4' },
  { key: 'A minor', progression: ['Am', 'F', 'C', 'G'], tonicNote: 'A4' },
  { key: 'G major', progression: ['G', 'D', 'Em', 'C'], tonicNote: 'G4' },
  { key: 'D major', progression: ['D', 'A', 'Bm', 'G'], tonicNote: 'D4' },
  { key: 'C major', progression: ['C', 'G', 'Am', 'F'], tonicNote: 'C4' },
  { key: 'A major', progression: ['A', 'E', 'F#m', 'D'], tonicNote: 'A4' },
  { key: 'B minor', progression: ['Bm', 'G', 'D', 'A'], tonicNote: 'B3' },
  { key: 'D minor', progression: ['Dm', 'Bb', 'F', 'C'], tonicNote: 'D4' },
];

/**
 * Pick patterns for note-by-note tab. Each number indexes into the chord's
 * voicing sorted low→high (0 = lowest sounding string), so the engine produces
 * a flowing single-note riff/arpeggio rather than stacked chord strums. One
 * value per eighth note across a bar. A different pattern is chosen per
 * recording so transcriptions read distinctly.
 */
const PICK_PATTERNS: number[][] = [
  [0, 3, 1, 3, 2, 3, 1, 3], // Travis-style fingerpick
  [0, 1, 2, 3, 4, 3, 2, 1], // ascending/descending run
  [0, 2, 4, 2, 1, 3, 4, 3], // arpeggio sweep
  [0, 4, 1, 4, 2, 4, 3, 4], // pedal high string
  [0, 2, 3, 4, 0, 2, 3, 4], // repeating climb
];

/** A few lead licks for the solo section. */
const SOLO_LICKS: string[][] = [
  ['E4', 'G4', 'A4', 'B4', 'A4', 'G4', 'E4', 'D4'],
  ['A4', 'C5', 'B4', 'A4', 'G4', 'E4', 'G4', 'A4'],
  ['D4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4'],
];

/** Alternate song structures, chosen per recording for variety. */
const SECTION_FLOWS: { type: Section['type']; bars: number; label?: string }[][] = [
  [
    { type: 'intro', bars: 4 },
    { type: 'verse', bars: 8 },
    { type: 'chorus', bars: 8 },
    { type: 'verse', bars: 8, label: 'Verse 2' },
    { type: 'chorus', bars: 8, label: 'Chorus 2' },
    { type: 'solo', bars: 8 },
    { type: 'outro', bars: 4 },
  ],
  [
    { type: 'intro', bars: 2 },
    { type: 'verse', bars: 8 },
    { type: 'pre-chorus', bars: 4 },
    { type: 'chorus', bars: 8 },
    { type: 'bridge', bars: 4 },
    { type: 'chorus', bars: 8, label: 'Chorus 2' },
    { type: 'outro', bars: 2 },
  ],
  [
    { type: 'intro', bars: 4 },
    { type: 'verse', bars: 8 },
    { type: 'chorus', bars: 8 },
    { type: 'breakdown', bars: 4 },
    { type: 'solo', bars: 8 },
    { type: 'outro', bars: 4 },
  ],
];

/** Estimate tempo (BPM) from buffer energy autocorrelation — rough but real. */
function estimateTempo(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  // Down-sample to an energy envelope at ~50 Hz.
  const hop = Math.floor(sr / 50);
  const env: number[] = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop && i + j < data.length; j++) sum += Math.abs(data[i + j]);
    env.push(sum / hop);
  }
  // Autocorrelate the envelope over plausible beat periods (60–180 BPM).
  const envRate = 50;
  let bestLag = 0;
  let bestCorr = -1;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = Math.round((60 / bpm) * envRate);
    let corr = 0;
    for (let i = 0; i + lag < env.length; i++) corr += env[i] * env[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  const bpm = bestLag > 0 ? Math.round((60 * envRate) / bestLag) : 120;
  return Math.min(180, Math.max(70, bpm));
}

/** Deterministic seed from buffer content, for stable key selection. */
function seedFromBuffer(buffer?: AudioBuffer): number {
  if (!buffer) return 0;
  const data = buffer.getChannelData(0);
  // Index-weighted accumulation + zero-crossing count make the seed depend on
  // the *shape* of the recording, so different takes diverge instead of all
  // landing on the same key/structure.
  let acc = 0;
  let crossings = 0;
  const step = Math.max(1, Math.floor(data.length / 4000));
  for (let i = step; i < data.length; i += step) {
    acc += Math.abs(data[i]) * ((i / step) % 17);
    if (data[i] >= 0 !== data[i - step] >= 0) crossings++;
  }
  return Math.floor(acc * 1000) + crossings * 31;
}

/**
 * Build a note-by-note arpeggio for one bar of a chord, following a pick
 * pattern. Returns eight eighth-notes, each a single fret on a single string.
 */
function arpeggiateBar(
  name: string,
  barStart: number,
  beat: number,
  tuning: TranscriptionInput['tuning'],
  pattern: number[],
): TabNote[] {
  // Voicing sorted low→high so pattern index 0 is the bass note.
  const voicing = voiceChord(name, tuning)
    .filter((v) => v.fret >= 0)
    .sort((a, b) => b.stringNumber - a.stringNumber);
  if (voicing.length === 0) return [];

  const eighth = beat / 2;
  const notes: TabNote[] = [];
  for (let i = 0; i < 8; i++) {
    const v = voicing[Math.min(pattern[i % pattern.length], voicing.length - 1)];
    // A little playable colour: ghost a couple of notes with hammer/pull.
    const technique: Technique =
      i === 3 && voicing.length > 2 ? 'hammer-on' : i === 6 ? 'pull-off' : 'normal';
    notes.push({
      stringNumber: v.stringNumber,
      fret: v.fret,
      startTime: barStart + i * eighth,
      duration: eighth,
      technique,
      confidence: 0.68 + 0.24 * Math.random(),
    });
  }
  return notes;
}

export class MockEngine implements TranscriptionEngine {
  readonly id = 'mock';
  readonly label = 'Mock engine (offline demo)';
  readonly requiresBackend = false;

  async transcribe(
    input: TranscriptionInput,
    onProgress?: ProgressFn,
  ): Promise<TranscriptionResult> {
    const tick = async (stage: string, p: number) => {
      onProgress?.(stage, p);
      // Yield to the event loop so the UI can paint the progress bar.
      await new Promise((r) => setTimeout(r, 220));
    };

    await tick('Decoding audio', 0.1);

    const bpm = input.audioBuffer ? estimateTempo(input.audioBuffer) : 120;
    const beat = 60 / bpm;
    const bar = beat * 4;
    await tick('Detecting tempo & beats', 0.3);

    const seed = seedFromBuffer(input.audioBuffer);
    // Independent "dimensions" of the seed pick the key, structure, rhythm and
    // lead lick, so two different recordings produce distinct transcriptions.
    const keyChoice = KEY_BANK[seed % KEY_BANK.length];
    const flow = SECTION_FLOWS[Math.floor(seed / 7) % SECTION_FLOWS.length];
    const progOffset = Math.floor(seed / 13) % keyChoice.progression.length;
    const pattern = PICK_PATTERNS[Math.floor(seed / 31) % PICK_PATTERNS.length];
    const lick = SOLO_LICKS[Math.floor(seed / 53) % SOLO_LICKS.length];
    const progAt = (b: number) =>
      keyChoice.progression[(b + progOffset) % keyChoice.progression.length];
    await tick('Estimating key', 0.45);

    // Fit the section flow to the available audio length when we have it.
    const rawDuration = input.audioBuffer?.duration ?? flow.reduce((a, s) => a + s.bars, 0) * bar;
    const trimmed = input.trim ? input.trim.end - input.trim.start : rawDuration;
    const totalBars = Math.max(8, Math.round(trimmed / bar));

    await tick('Detecting chords', 0.65);
    const chords: Chord[] = [];
    for (let b = 0; b < totalBars; b++) {
      chords.push({
        startTime: b * bar,
        endTime: (b + 1) * bar,
        chordName: progAt(b),
        confidence: 0.68 + 0.25 * Math.abs(Math.sin((b + seed) * 0.7)),
      });
    }

    // Build sections, scaling the chosen flow to fit the bar count.
    const flowBars = flow.reduce((a, s) => a + s.bars, 0);
    const scale = totalBars / flowBars;
    const sections: Section[] = [];
    let cursor = 0;
    for (const s of flow) {
      const len = Math.max(2, Math.round(s.bars * scale));
      sections.push({
        id: uid('sec'),
        type: s.type,
        label: s.label,
        startTime: cursor * bar,
        endTime: Math.min((cursor + len) * bar, totalBars * bar),
      });
      cursor += len;
      if (cursor >= totalBars) break;
    }
    if (sections.length) sections[sections.length - 1].endTime = totalBars * bar;

    await tick('Transcribing tab', 0.85);
    const tabLines: TabLine[] = [];
    for (const section of sections) {
      const startBar = Math.round(section.startTime / bar);
      const endBar = Math.round(section.endTime / bar);
      for (let b = startBar; b < endBar; b += 2) {
        const notes: TabNote[] = [];
        if (section.type === 'solo') {
          lick.forEach((n, i) => {
            const pos = noteToTab(noteToMidi(n), input.tuning, { preferStringIndex: 4 });
            if (pos) {
              notes.push({
                ...pos,
                startTime: b * bar + i * (beat / 2),
                duration: beat / 2,
                technique: (i % 4 === 1 ? 'hammer-on' : i % 4 === 3 ? 'bend' : 'normal') as Technique,
                confidence: 0.55 + 0.3 * Math.random(),
              });
            }
          });
        } else {
          // Note-by-note arpeggio of each bar's chord, using the chosen pattern.
          for (let bb = b; bb < Math.min(b + 2, endBar); bb++) {
            notes.push(...arpeggiateBar(progAt(bb), bb * bar, beat, input.tuning, pattern));
          }
        }
        tabLines.push({
          id: uid('line'),
          startTime: b * bar,
          endTime: Math.min((b + 2) * bar, section.endTime),
          notes,
        });
      }
    }

    const bars: BarMarker[] = Array.from({ length: totalBars }, (_, i) => ({
      index: i,
      startTime: i * bar,
    }));

    await tick('Finalising', 1);

    const confidenceScore =
      chords.reduce((a, c) => a + c.confidence, 0) / Math.max(1, chords.length);

    return {
      title: input.title,
      duration: totalBars * bar,
      bpm,
      key: keyChoice.key,
      timeSignature: { beats: 4, value: 4 },
      tuning: input.tuning,
      sections,
      chords,
      tabLines,
      bars,
      confidenceScore,
    };
  }
}
