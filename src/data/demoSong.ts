/**
 * "Ember Skyline" — a hand-authored demo transcription bundled with the app so
 * a first-time user can explore the full tab / play-along experience without
 * recording anything. Generated programmatically from the fretboard voicer so
 * the tab is internally consistent with the chosen tuning.
 */
import { noteToMidi } from '@/lib/music';
import { uid } from '@/lib/format';
import { STANDARD_TUNING } from './tunings';
import { noteToTab, voiceChord } from '@/engine/fretboard';
import type {
  BarMarker,
  Chord,
  Project,
  Section,
  TabLine,
  TabNote,
  Technique,
} from '@/types';

const BPM = 120;
const BEAT = 60 / BPM; // 0.5s
const BAR = BEAT * 4; // 2s (4/4)

/** Repeating progression, one chord per bar. */
const PROGRESSION = ['Em', 'C', 'G', 'D'];

/** Section layout in bars: [type, lengthInBars]. */
const SECTION_LAYOUT: { type: Section['type']; bars: number; label?: string }[] = [
  { type: 'intro', bars: 4 },
  { type: 'verse', bars: 8 },
  { type: 'chorus', bars: 8 },
  { type: 'verse', bars: 8, label: 'Verse 2' },
  { type: 'chorus', bars: 8, label: 'Chorus 2' },
  { type: 'solo', bars: 8 },
  { type: 'outro', bars: 4 },
];

function buildChords(totalBars: number): Chord[] {
  const chords: Chord[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const name = PROGRESSION[bar % PROGRESSION.length];
    chords.push({
      startTime: bar * BAR,
      endTime: (bar + 1) * BAR,
      chordName: name,
      // Confidence drifts a little so the UI shows a realistic mix.
      confidence: 0.72 + 0.2 * Math.abs(Math.sin(bar * 1.3)),
    });
  }
  return chords;
}

// A fingerpicking pattern for the rhythm sections: indexes into the chord
// voicing (low→high) so the demo reads as a flowing note-by-note arpeggio.
const PICK = [0, 2, 3, 4, 1, 4, 3, 2];

/** Arpeggiate a chord across one bar, note by note (eighth notes). */
function arpeggiateBar(name: string, barStart: number): TabNote[] {
  const voicing = voiceChord(name, STANDARD_TUNING)
    .filter((v) => v.fret >= 0)
    .sort((a, b) => b.stringNumber - a.stringNumber);
  if (voicing.length === 0) return [];
  const notes: TabNote[] = [];
  for (let i = 0; i < 8; i++) {
    const v = voicing[Math.min(PICK[i], voicing.length - 1)];
    notes.push({
      stringNumber: v.stringNumber,
      fret: v.fret,
      startTime: barStart + i * (BEAT / 2),
      duration: BEAT / 2,
      technique: (i === 3 ? 'hammer-on' : 'normal') as Technique,
      confidence: 0.85,
    });
  }
  return notes;
}

/** A pentatonic-ish lead lick for the solo section, with a few techniques. */
function soloLick(startBar: number): TabNote[] {
  // E minor pentatonic-ish melody (MIDI), with timing in eighth notes.
  const sequence: { note: string; tech: Technique }[] = [
    { note: 'E4', tech: 'normal' },
    { note: 'G4', tech: 'hammer-on' },
    { note: 'A4', tech: 'normal' },
    { note: 'B4', tech: 'bend' },
    { note: 'A4', tech: 'pull-off' },
    { note: 'G4', tech: 'normal' },
    { note: 'E4', tech: 'normal' },
    { note: 'D4', tech: 'slide' },
    { note: 'E4', tech: 'vibrato' },
    { note: 'G4', tech: 'normal' },
    { note: 'B4', tech: 'normal' },
    { note: 'D5', tech: 'bend' },
    { note: 'B4', tech: 'normal' },
    { note: 'A4', tech: 'normal' },
    { note: 'G4', tech: 'normal' },
    { note: 'E4', tech: 'vibrato' },
  ];
  const notes: TabNote[] = [];
  sequence.forEach((step, i) => {
    const pos = noteToTab(noteToMidi(step.note), STANDARD_TUNING, { preferStringIndex: 4 });
    if (!pos) return;
    notes.push({
      ...pos,
      startTime: startBar * BAR + i * (BEAT / 2),
      duration: BEAT / 2,
      technique: step.tech,
      confidence: 0.6 + 0.3 * Math.random(),
    });
  });
  return notes;
}

function buildTabLines(sections: Section[]): TabLine[] {
  const lines: TabLine[] = [];
  for (const section of sections) {
    const startBar = Math.round(section.startTime / BAR);
    const endBar = Math.round(section.endTime / BAR);

    if (section.type === 'solo') {
      // One lead line per 2 bars across the solo.
      for (let bar = startBar; bar < endBar; bar += 2) {
        lines.push({
          id: uid('line'),
          startTime: bar * BAR,
          endTime: Math.min((bar + 2) * BAR, section.endTime),
          notes: soloLick(bar).filter(
            (n) => n.startTime >= bar * BAR && n.startTime < (bar + 2) * BAR,
          ),
        });
      }
      continue;
    }

    // Rhythm sections: 2 bars per line, chord arpeggiated note by note.
    for (let bar = startBar; bar < endBar; bar += 2) {
      const notes: TabNote[] = [];
      for (let b = bar; b < Math.min(bar + 2, endBar); b++) {
        notes.push(...arpeggiateBar(PROGRESSION[b % PROGRESSION.length], b * BAR));
      }
      lines.push({
        id: uid('line'),
        startTime: bar * BAR,
        endTime: Math.min((bar + 2) * BAR, section.endTime),
        notes,
      });
    }
  }
  return lines;
}

/** Build the demo project fresh (so each load gets stable ids within a run). */
export function buildDemoProject(): Project {
  const sections: Section[] = [];
  let cursorBar = 0;
  for (const layout of SECTION_LAYOUT) {
    sections.push({
      id: uid('sec'),
      type: layout.type,
      label: layout.label,
      startTime: cursorBar * BAR,
      endTime: (cursorBar + layout.bars) * BAR,
    });
    cursorBar += layout.bars;
  }
  const totalBars = cursorBar;
  const duration = totalBars * BAR;

  const bars: BarMarker[] = Array.from({ length: totalBars }, (_, i) => ({
    index: i,
    startTime: i * BAR,
  }));

  const now = new Date().toISOString();
  return {
    id: 'demo-ember-skyline',
    title: 'Ember Skyline',
    artist: 'RiffScribe Demo',
    duration,
    bpm: BPM,
    key: 'E minor',
    timeSignature: { beats: 4, value: 4 },
    tuning: STANDARD_TUNING,
    sections,
    chords: buildChords(totalBars),
    tabLines: buildTabLines(sections),
    bars,
    confidenceScore: 0.82,
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const DEMO_PROJECT_ID = 'demo-ember-skyline';
