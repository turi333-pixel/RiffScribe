/**
 * Zustand store for the *active* project plus all mutating actions
 * (chord edits, note edits, tuning changes, versioning).
 * Persistence to localStorage happens on every mutation so work is never lost.
 */
import { create } from 'zustand';
import type { Chord, Project, TabNote, Tuning } from '@/types';
import { regenerateForTuning } from '@/engine/fretboard';
import { saveProject } from '@/lib/storage';
import { uid } from '@/lib/format';

interface ProjectState {
  project: Project | null;

  setProject: (project: Project) => void;
  clear: () => void;

  /** Rename a chord at a given index (manual correction). */
  editChord: (index: number, chordName: string) => void;
  /** Replace a single tab note (by line id + note index). */
  editNote: (lineId: string, noteIndex: number, patch: Partial<TabNote>) => void;
  /** Delete a tab note. */
  deleteNote: (lineId: string, noteIndex: number) => void;
  /** Change tuning and regenerate chord-derived fingering. */
  changeTuning: (tuning: Tuning) => void;
  /** Save a named version snapshot. */
  saveVersion: (label: string) => void;
  /** Restore a previously-saved version. */
  restoreVersion: (versionId: string) => void;
}

function persist(project: Project): Project {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  saveProject(updated);
  return updated;
}

/** Find the chord active at a given time (used when re-voicing tab). */
function chordNameAt(project: Project, time: number): string | undefined {
  return project.chords.find((c) => time >= c.startTime && time < c.endTime)?.chordName;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,

  setProject: (project) => set({ project }),
  clear: () => set({ project: null }),

  editChord: (index, chordName) => {
    const p = get().project;
    if (!p) return;
    const chords: Chord[] = p.chords.map((c, i) =>
      i === index ? { ...c, chordName, confidence: 1 } : c,
    );
    // Re-voice tab notes that fall within the edited chord's span.
    const edited = p.chords[index];
    const tabLines = p.tabLines.map((line) => {
      const touches = line.startTime < edited.endTime && line.endTime > edited.startTime;
      if (!touches) return line;
      return {
        ...line,
        notes: regenerateForTuning(
          line.notes,
          (t) => chordNameAt({ ...p, chords }, t),
          p.tuning,
          p.tuning,
        ),
      };
    });
    set({ project: persist({ ...p, chords, tabLines }) });
  },

  editNote: (lineId, noteIndex, patch) => {
    const p = get().project;
    if (!p) return;
    const tabLines = p.tabLines.map((line) =>
      line.id === lineId
        ? {
            ...line,
            notes: line.notes.map((n, i) =>
              i === noteIndex ? { ...n, ...patch, confidence: 1 } : n,
            ),
          }
        : line,
    );
    set({ project: persist({ ...p, tabLines }) });
  },

  deleteNote: (lineId, noteIndex) => {
    const p = get().project;
    if (!p) return;
    const tabLines = p.tabLines.map((line) =>
      line.id === lineId
        ? { ...line, notes: line.notes.filter((_, i) => i !== noteIndex) }
        : line,
    );
    set({ project: persist({ ...p, tabLines }) });
  },

  changeTuning: (tuning) => {
    const p = get().project;
    if (!p) return;
    const tabLines = p.tabLines.map((line) => ({
      ...line,
      notes: regenerateForTuning(line.notes, (t) => chordNameAt(p, t), p.tuning, tuning),
    }));
    set({ project: persist({ ...p, tuning, tabLines }) });
  },

  saveVersion: (label) => {
    const p = get().project;
    if (!p) return;
    const version = {
      id: uid('ver'),
      label,
      createdAt: new Date().toISOString(),
      snapshot: {
        chords: p.chords,
        tabLines: p.tabLines,
        sections: p.sections,
        tuning: p.tuning,
        key: p.key,
        bpm: p.bpm,
        timeSignature: p.timeSignature,
      },
    };
    set({ project: persist({ ...p, versions: [version, ...p.versions] }) });
  },

  restoreVersion: (versionId) => {
    const p = get().project;
    if (!p) return;
    const version = p.versions.find((v) => v.id === versionId);
    if (!version) return;
    set({ project: persist({ ...p, ...version.snapshot }) });
  },
}));
