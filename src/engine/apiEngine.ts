/**
 * ApiEngine — the real-backend transcription engine.
 *
 * ============================================================================
 *  🔌  REAL API INTEGRATION POINTS
 * ============================================================================
 * This class is the single place where RiffScribe talks to server-side audio
 * analysis. Everything is stubbed and clearly marked with `TODO(api)`. To go
 * live, implement the backend endpoints described below and set
 * `VITE_API_BASE_URL` in your environment; the app will then prefer this
 * engine automatically (see {@link getEngine}).
 *
 * Suggested backend pipeline (each can be a separate microservice / model):
 *   1. POST  /api/audio            → upload, returns { audioId, url, duration }
 *   2. POST  /api/analyze/structure→ key, tempo, time-sig, sections
 *   3. POST  /api/analyze/chords   → chord progression + confidence
 *   4. POST  /api/analyze/notes    → onset + pitch tracking (melody/notes)
 *   5. POST  /api/analyze/separate → optional source separation (guitar stem)
 *   6. POST  /api/transcribe/tab   → melody-to-tab for a given tuning
 *
 * Recommended models / services to wire in behind these endpoints:
 *   • Chord detection:   Chordino / BTC / madmom
 *   • Onset detection:   madmom / librosa onset
 *   • Pitch tracking:    CREPE / SPICE / basic-pitch (Spotify)
 *   • Source separation: Demucs / Spleeter
 *   • Melody → tab:      custom heuristic on top of basic-pitch output
 * ============================================================================
 */
import type {
  ProgressFn,
  TranscriptionEngine,
  TranscriptionInput,
  TranscriptionResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export class ApiEngine implements TranscriptionEngine {
  readonly id = 'api';
  readonly label = 'Cloud transcription (beta)';
  readonly requiresBackend = true;

  constructor(private readonly baseUrl: string) {}

  async transcribe(
    input: TranscriptionInput,
    onProgress?: ProgressFn,
  ): Promise<TranscriptionResult> {
    if (!input.file) {
      throw new Error('ApiEngine requires the original file to upload.');
    }

    // ---- 1. Upload audio ----------------------------------------------------
    onProgress?.('Uploading audio', 0.1);
    // TODO(api): replace with the real upload endpoint.
    //   const form = new FormData();
    //   form.append('file', input.file);
    //   const { audioId } = await this.post('/api/audio', form);
    const audioId = await this.uploadStub(input.file);

    // ---- 2. Structure (key / tempo / sections) ------------------------------
    onProgress?.('Detecting key & tempo', 0.35);
    // TODO(api): const structure = await this.post('/api/analyze/structure', { audioId, trim: input.trim });

    // ---- 3. Chords ----------------------------------------------------------
    onProgress?.('Detecting chords', 0.55);
    // TODO(api): const chords = await this.post('/api/analyze/chords', { audioId });

    // ---- 4. Notes (onset + pitch) ------------------------------------------
    onProgress?.('Extracting notes', 0.75);
    // TODO(api): const notes = await this.post('/api/analyze/notes', { audioId });

    // ---- 5. Tab generation for the chosen tuning ---------------------------
    onProgress?.('Generating tab', 0.9);
    // TODO(api): const tab = await this.post('/api/transcribe/tab', { audioId, tuning: input.tuning });

    onProgress?.('Finalising', 1);

    // TODO(api): assemble and return the real TranscriptionResult from the
    // responses above. Until the backend exists, fail loudly so callers can
    // fall back to the MockEngine.
    void audioId;
    throw new Error(
      'ApiEngine is not yet wired to a backend. Implement the endpoints in apiEngine.ts.',
    );
  }

  /** Placeholder upload — swap for a real multipart POST. */
  private async uploadStub(file: File): Promise<string> {
    void file;
    void this.baseUrl;
    return 'stub-audio-id';
  }

  // Convenience helper for real implementations.
  // private async post<T>(path: string, body: unknown): Promise<T> {
  //   const res = await fetch(`${this.baseUrl}${path}`, {
  //     method: 'POST',
  //     headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
  //     body: body instanceof FormData ? body : JSON.stringify(body),
  //   });
  //   if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  //   return res.json() as Promise<T>;
  // }
}

/** Whether a remote backend is configured. */
export function hasBackend(): boolean {
  return typeof API_BASE === 'string' && API_BASE.length > 0;
}

export const API_BASE_URL = API_BASE;
