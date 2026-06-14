/**
 * Transient store for audio captured on the Home screen and handed to the
 * Analyze screen. Blobs can't ride React Router state cleanly, so we stash the
 * pending capture here for the next screen to pick up.
 */
import { create } from 'zustand';

export interface PendingCapture {
  blob: Blob;
  /** Best-guess title (from file name or "Live recording"). */
  title: string;
  /** 'upload' | 'mic' — affects the analyze copy. */
  source: 'upload' | 'mic';
}

interface CaptureState {
  pending: PendingCapture | null;
  setPending: (capture: PendingCapture) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
