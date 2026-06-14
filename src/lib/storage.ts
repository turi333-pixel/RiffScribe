/**
 * Local project persistence. Projects are stored in `localStorage` as JSON.
 *
 * NOTE on audio: object URLs (`blob:`) do not survive a reload, so for true
 * persistence audio is stored separately as a base64 data URL in its own key
 * (audio can be large; keeping it out of the project blob keeps list reads
 * fast). A real deployment would offload audio to the backend / IndexedDB.
 */
import type { Project, ProjectSummary } from '@/types';

const INDEX_KEY = 'riffscribe:index';
const PROJECT_PREFIX = 'riffscribe:project:';
const AUDIO_PREFIX = 'riffscribe:audio:';

function readIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export function saveProject(project: Project): void {
  const toStore: Project = { ...project, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(toStore));
    const index = readIndex();
    if (!index.includes(project.id)) writeIndex([project.id, ...index]);
  } catch (err) {
    // Most likely a quota error from a large embedded audio data URL.
    console.warn('Failed to save project', err);
  }
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  localStorage.removeItem(AUDIO_PREFIX + id);
  writeIndex(readIndex().filter((x) => x !== id));
}

export function listProjects(): ProjectSummary[] {
  return readIndex()
    .map((id) => loadProject(id))
    .filter((p): p is Project => !!p)
    .map((p) => ({
      id: p.id,
      title: p.title,
      artist: p.artist,
      key: p.key,
      bpm: p.bpm,
      confidenceScore: p.confidenceScore,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Persist the audio bytes for a project as a base64 data URL. */
export async function saveAudio(id: string, blob: Blob): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  try {
    localStorage.setItem(AUDIO_PREFIX + id, dataUrl);
  } catch (err) {
    console.warn('Audio too large to persist locally; it will not survive reload.', err);
  }
}

export function loadAudio(id: string): string | null {
  return localStorage.getItem(AUDIO_PREFIX + id);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Build a shareable link by encoding the project into the URL hash. */
export function buildShareLink(project: Project): string {
  // Strip the (potentially huge) audio reference for sharing.
  const shareable = { ...project, audioFile: undefined };
  const json = JSON.stringify(shareable);
  const encoded = btoa(encodeURIComponent(json));
  return `${location.origin}/#/shared/${encoded}`;
}

export function decodeShareLink(encoded: string): Project | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as Project;
  } catch {
    return null;
  }
}
