/**
 * Engine registry / factory. The rest of the app imports {@link getEngine} and
 * never references a concrete engine, so transcription backends can be swapped
 * without touching UI code.
 *
 * Resolution order:
 *   1. Cloud engine, if a backend is configured (highest accuracy, future).
 *   2. On-device AI engine (basic-pitch) — the default; real analysis, offline.
 *   3. Mock engine — fallback if the on-device engine fails, and for the demo.
 */
import { MockEngine } from './mockEngine';
import { LocalAnalysisEngine } from './localEngine';
import { ApiEngine, API_BASE_URL, hasBackend } from './apiEngine';
import type { TranscriptionEngine } from './types';

export type EngineId = 'local' | 'mock' | 'api';

const mock = new MockEngine();
const local = new LocalAnalysisEngine();

export function getEngine(prefer?: EngineId): TranscriptionEngine {
  if (prefer === 'mock') return mock;
  if (prefer === 'local') return local;
  if (prefer === 'api' || hasBackend()) {
    if (API_BASE_URL) return new ApiEngine(API_BASE_URL);
  }
  return local;
}

/** The engine to fall back to when the preferred one fails. */
export function getFallbackEngine(): TranscriptionEngine {
  return mock;
}

export function listEngines(): TranscriptionEngine[] {
  const engines: TranscriptionEngine[] = [local, mock];
  if (API_BASE_URL) engines.push(new ApiEngine(API_BASE_URL));
  return engines;
}

export * from './types';
export { hasBackend };
