/**
 * LocalAnalysisEngine — real, on-device transcription using Spotify's
 * basic-pitch (a small polyphonic note-detection CNN running in the browser via
 * TensorFlow.js). This is the default engine: it detects the actual notes you
 * played, then derives tab, chords, tempo and structure from them.
 *
 * Heavy deps (tfjs + the model) are dynamically imported so they only load when
 * a transcription is actually run.
 */
import type {
  ProgressFn,
  TranscriptionEngine,
  TranscriptionInput,
  TranscriptionResult,
} from './types';
import { resampleTo22050Mono } from '@/audio/resample';
import { estimateTempo } from './analysis/tempo';
import { detectChords } from './analysis/chords';
import { notesToTabLines, type NoteEvent } from './analysis/notesToTab';
import { buildBars, buildSections } from './analysis/structure';

const MODEL_URL = `${import.meta.env.BASE_URL}models/basic-pitch/model.json`;

export class LocalAnalysisEngine implements TranscriptionEngine {
  readonly id = 'local';
  readonly label = 'On-device AI (basic-pitch)';
  readonly requiresBackend = false;

  async transcribe(
    input: TranscriptionInput,
    onProgress?: ProgressFn,
  ): Promise<TranscriptionResult> {
    if (!input.audioBuffer) {
      throw new Error('LocalAnalysisEngine requires decoded audio.');
    }

    // ---- 1. Crop to the trimmed region & resample to 22.05 kHz mono --------
    onProgress?.('Preparing audio', 0.05);
    const buffer = input.audioBuffer;
    const audio = await resampleTo22050Mono(buffer);

    // ---- 2. Load the model + tfjs (lazy) -----------------------------------
    onProgress?.('Loading AI model', 0.12);
    const tf = await import('@tensorflow/tfjs');
    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();
    const { BasicPitch, outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } =
      await import('@spotify/basic-pitch');

    const basicPitch = new BasicPitch(MODEL_URL);

    // ---- 3. Run note detection ---------------------------------------------
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];
    await basicPitch.evaluateModel(
      audio,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (pct) => onProgress?.('Detecting notes', 0.15 + pct * 0.6),
    );

    onProgress?.('Extracting notes', 0.8);
    const noteEvents = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        // onsetThresh, frameThresh, minNoteLen (frames) — tuned for guitar.
        outputToNotesPoly(frames, onsets, 0.45, 0.3, 5),
      ),
    ) as NoteEvent[];

    const duration = buffer.duration;

    // If the model heard essentially nothing, surface that clearly.
    if (noteEvents.length < 3) {
      throw new Error('No clear notes detected — try a louder, cleaner recording.');
    }

    // ---- 4. Tempo / beat grid ----------------------------------------------
    onProgress?.('Finding the beat', 0.85);
    const bpm = estimateTempo(buffer);
    const beat = 60 / bpm;
    const bar = beat * 4;
    const totalBars = Math.max(1, Math.round(duration / bar));

    // ---- 5. Chords + tab + structure ---------------------------------------
    onProgress?.('Building chords & tab', 0.92);
    const chords = detectChords(noteEvents, bpm, duration);
    const tabLines = notesToTabLines(noteEvents, input.tuning, bpm, duration);
    const sections = buildSections(totalBars, bar);
    const bars = buildBars(totalBars, bar);

    onProgress?.('Finalising', 1);

    const confidenceScore = chords.length
      ? chords.reduce((a, c) => a + c.confidence, 0) / chords.length
      : 0.5;

    return {
      title: input.title,
      duration,
      bpm,
      key: estimateKey(chords),
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

/**
 * Crude key estimate: the most common chord root, biased toward calling it
 * major/minor by the most frequent chord quality. Good enough for a label.
 */
function estimateKey(chords: { chordName: string }[]): string {
  if (chords.length === 0) return 'Unknown';
  const counts = new Map<string, number>();
  for (const c of chords) {
    const root = /^[A-G][#b]?/.exec(c.chordName)?.[0] ?? c.chordName;
    counts.set(root, (counts.get(root) ?? 0) + 1);
  }
  let bestRoot = chords[0].chordName;
  let best = 0;
  for (const [root, n] of counts) {
    if (n > best) {
      best = n;
      bestRoot = root;
    }
  }
  // Count triad qualities only (ignore power chords, which are ambiguous).
  const minor = chords.filter((c) => /m(?!aj)/.test(c.chordName)).length;
  const major = chords.filter((c) => /^[A-G][#b]?(maj7?|7|sus|add)?$/.test(c.chordName)).length;
  const quality = minor >= major && minor > 0 ? 'minor' : 'major';
  return `${bestRoot} ${quality}`;
}
