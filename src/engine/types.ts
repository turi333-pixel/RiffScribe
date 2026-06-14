import type {
  BarMarker,
  Chord,
  Section,
  TabLine,
  TimeSignature,
  Tuning,
} from '@/types';

/**
 * The result of analysing one piece of audio. This is everything a
 * transcription engine produces; the app merges it into a {@link Project}.
 */
export interface TranscriptionResult {
  title: string;
  artist?: string;
  duration: number;
  bpm: number;
  key: string;
  timeSignature: TimeSignature;
  tuning: Tuning;
  sections: Section[];
  chords: Chord[];
  tabLines: TabLine[];
  bars: BarMarker[];
  confidenceScore: number;
}

/** Input the engine accepts. We hand it the decoded audio plus metadata. */
export interface TranscriptionInput {
  /** The decoded audio. May be undefined for pure-demo flows. */
  audioBuffer?: AudioBuffer;
  /** Raw file, when the source was an upload (the engine may upload it). */
  file?: File;
  /** Best-guess title (e.g. derived from the file name). */
  title: string;
  /** Tuning the user has selected before analysis. */
  tuning: Tuning;
  /** Trim window in seconds, if the user cropped the audio. */
  trim?: { start: number; end: number };
}

/** Progress callback emitted during long-running analysis. */
export type ProgressFn = (stage: string, progress: number) => void;

/**
 * A pluggable transcription backend. Implementations: {@link MockEngine}
 * (offline, deterministic) and {@link ApiEngine} (remote services). Swap the
 * active engine via {@link getEngine}.
 */
export interface TranscriptionEngine {
  readonly id: string;
  readonly label: string;
  /** True when this engine needs network / a configured backend. */
  readonly requiresBackend: boolean;
  transcribe(input: TranscriptionInput, onProgress?: ProgressFn): Promise<TranscriptionResult>;
}
