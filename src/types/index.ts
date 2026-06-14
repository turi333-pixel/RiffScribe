/**
 * RiffScribe core data model.
 *
 * These types are the contract shared between the UI, the local persistence
 * layer, and any transcription engine (mock or remote). Keep them serialisable
 * (plain JSON) so a Project can round-trip through `localStorage` or a backend
 * API without custom (de)serialisation.
 */

/** A guitar playing technique attached to a single tab note. */
export type Technique =
  | 'normal'
  | 'slide'
  | 'bend'
  | 'hammer-on'
  | 'pull-off'
  | 'vibrato'
  | 'mute';

/** Labels used to group the song into recognisable structural parts. */
export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'solo'
  | 'breakdown'
  | 'outro';

/**
 * A guitar tuning. `strings` is ordered from the lowest (6th) string to the
 * highest (1st) string using scientific pitch notation, e.g. standard tuning
 * is `['E2','A2','D3','G3','B3','E4']`.
 */
export interface Tuning {
  /** Human-readable name, e.g. "Standard", "Drop D". */
  name: string;
  /** Six notes, low string → high string, scientific pitch notation. */
  strings: [string, string, string, string, string, string];
}

/** A detected chord occupying a span of the timeline. */
export interface Chord {
  /** Seconds from the start of the audio. */
  startTime: number;
  endTime: number;
  /** Display name, e.g. "Em", "Cadd9", "G/B". */
  chordName: string;
  /** 0–1 model confidence. */
  confidence: number;
}

/** A single note placed on the fretboard at a moment in time. */
export interface TabNote {
  /** 1 = high E (1st string) … 6 = low E (6th string). */
  stringNumber: number;
  /** Fret number; 0 = open string. */
  fret: number;
  /** Seconds from the start of the audio. */
  startTime: number;
  /** Duration in seconds. */
  duration: number;
  technique: Technique;
  /** 0–1 model confidence for this note. */
  confidence?: number;
}

/** A structural region of the song (intro / verse / chorus …). */
export interface Section {
  id: string;
  type: SectionType;
  /** Optional display label override, e.g. "Chorus 2". */
  label?: string;
  startTime: number;
  endTime: number;
  /** Free-text annotation the player can attach. */
  notes?: string;
}

/** A rendered "line" of tablature — a window of the timeline. */
export interface TabLine {
  id: string;
  startTime: number;
  endTime: number;
  notes: TabNote[];
}

/** A single bar/measure marker derived from tempo + time signature. */
export interface BarMarker {
  index: number;
  startTime: number;
}

export interface TimeSignature {
  beats: number; // numerator, e.g. 4
  value: number; // denominator, e.g. 4
}

/** A point-in-time snapshot of a transcription the user chose to keep. */
export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: string;
  /** Snapshot of the mutable analysis fields at save time. */
  snapshot: Pick<
    Project,
    'chords' | 'tabLines' | 'sections' | 'tuning' | 'key' | 'bpm' | 'timeSignature'
  >;
}

/** The top-level entity persisted per song. */
export interface Project {
  id: string;
  title: string;
  artist?: string;

  /**
   * Reference to the source audio. For locally-saved projects this is an
   * object URL or a base64 data URL; for server-backed projects it is the URL
   * returned by the upload endpoint.
   */
  audioFile?: string;
  /** Original audio duration in seconds. */
  duration: number;

  bpm: number;
  key: string; // e.g. "E minor"
  timeSignature: TimeSignature;
  tuning: Tuning;

  sections: Section[];
  chords: Chord[];
  tabLines: TabLine[];
  bars: BarMarker[];

  /** Aggregate 0–1 confidence for the whole transcription. */
  confidenceScore: number;

  versions: ProjectVersion[];

  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Lightweight summary used by the dashboard list. */
export interface ProjectSummary {
  id: string;
  title: string;
  artist?: string;
  key: string;
  bpm: number;
  confidenceScore: number;
  updatedAt: string;
}
