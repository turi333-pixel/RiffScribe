/**
 * TabLineView — renders one line of tablature as a six-string grid, with a
 * chord lane on top.
 *
 * Notes are quantised into an eighth-note column grid so they line up
 * vertically and stay readable. Chords sit in a lane above the grid, positioned
 * over the exact column where they start — so they read like real tab. A sticky
 * left gutter shows the string tuning labels; the chord lane + grid scroll
 * horizontally together when a line is wider than the screen. The active column
 * is highlighted during play-along, and tapping a fret opens the note editor.
 */
import { TECHNIQUE_SYMBOLS } from '@/engine/fretboard';
import { pitchClass } from '@/lib/music';
import type { Chord, TabLine, TabNote, Tuning } from '@/types';

interface TabLineViewProps {
  line: TabLine;
  /** Chords overlapping this line, for the chord lane. */
  chords: Chord[];
  tuning: Tuning;
  beatDuration: number;
  currentTime: number;
  onEditNote: (lineId: string, noteIndex: number) => void;
  onSeek: (time: number) => void;
}

const COL_WIDTH = 26; // px per eighth-note column
const ROW_HEIGHT = 22;
const CHORD_H = 26; // height of the chord lane
const GUTTER_W = 22;

export function TabLineView({
  line,
  chords,
  tuning,
  beatDuration,
  currentTime,
  onEditNote,
  onSeek,
}: TabLineViewProps) {
  const span = line.endTime - line.startTime || beatDuration * 8;
  // One column per eighth note, minimum 8.
  const slots = Math.max(8, Math.round(span / (beatDuration / 2)));

  // Fractional column for x-positioning (no rounding, so chords sit exactly
  // above the note that starts them).
  const xOf = (t: number) => {
    const frac = Math.max(0, Math.min(1, (t - line.startTime) / span));
    return frac * (slots - 1) * COL_WIDTH;
  };
  const colOf = (t: number) =>
    Math.max(0, Math.min(slots - 1, Math.round(((t - line.startTime) / span) * (slots - 1))));

  // String labels low→high become rows high→low (string 1 at top).
  const stringLabels = [...tuning.strings].reverse().map(pitchClass); // [e,B,G,D,A,E]

  // Index notes by [row][col].
  const cellNotes: { note: TabNote; index: number }[][][] = Array.from({ length: 6 }, () =>
    Array.from({ length: slots }, () => []),
  );
  line.notes.forEach((note, index) => {
    const row = note.stringNumber - 1; // string 1 → row 0
    if (row < 0 || row > 5) return;
    cellNotes[row][colOf(note.startTime)].push({ note, index });
  });

  const activeCol =
    currentTime >= line.startTime && currentTime < line.endTime ? colOf(currentTime) : -1;

  const gridWidth = slots * COL_WIDTH;
  const activeChord = chords.find((c) => currentTime >= c.startTime && currentTime < c.endTime);

  return (
    <div className="flex">
      {/* Sticky tuning gutter (with a spacer aligning to the chord lane) */}
      <div className="sticky left-0 z-10 flex flex-col bg-ink-850 pr-1">
        <div style={{ height: CHORD_H, width: GUTTER_W }} />
        {stringLabels.map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-center font-mono text-[11px] font-semibold text-zinc-500"
            style={{ height: ROW_HEIGHT, width: GUTTER_W }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ width: gridWidth }}>
        {/* Chord lane — positioned over the column each chord starts on */}
        <div className="relative" style={{ height: CHORD_H }}>
          {chords.map((chord, i) => {
            const active = chord === activeChord;
            return (
              <button
                key={i}
                onClick={() => onSeek(Math.max(chord.startTime, line.startTime))}
                className={`absolute top-0 whitespace-nowrap font-display text-[15px] font-semibold leading-[26px] transition-colors ${
                  active ? 'text-ember' : 'text-ember-300/90 hover:text-ember'
                }`}
                style={{ left: xOf(chord.startTime) }}
              >
                {chord.chordName}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="relative" style={{ height: ROW_HEIGHT * 6 }}>
          {/* Active column highlight */}
          {activeCol >= 0 && (
            <div
              className="absolute top-0 rounded bg-ember/15 ring-1 ring-ember/40 transition-[left] duration-100"
              style={{ left: activeCol * COL_WIDTH, width: COL_WIDTH, height: ROW_HEIGHT * 6 }}
            />
          )}

          {/* String lines */}
          {stringLabels.map((_, row) => (
            <div
              key={row}
              className="absolute left-0 right-0 border-t border-white/10"
              style={{ top: row * ROW_HEIGHT + ROW_HEIGHT / 2 }}
            />
          ))}

          {/* Beat ticks every 2 columns */}
          {Array.from({ length: Math.ceil(slots / 2) }).map((_, b) => (
            <div
              key={b}
              className="absolute bottom-0 top-0 w-px bg-white/5"
              style={{ left: b * 2 * COL_WIDTH }}
            />
          ))}

          {/* Notes */}
          {cellNotes.map((cols, row) =>
            cols.map((cell, col) =>
              cell.map(({ note, index }) => {
                const tech = TECHNIQUE_SYMBOLS[note.technique];
                const lowConf = (note.confidence ?? 1) < 0.55;
                return (
                  <button
                    key={`${row}-${col}-${index}`}
                    onClick={() => onEditNote(line.id, index)}
                    className={`absolute grid place-items-center rounded font-mono text-[12px] font-semibold leading-none transition-colors ${
                      lowConf ? 'text-signal-amber' : 'text-zinc-100'
                    } hover:bg-ember/20`}
                    style={{
                      left: col * COL_WIDTH,
                      top: row * ROW_HEIGHT + 3,
                      width: COL_WIDTH,
                      height: ROW_HEIGHT - 6,
                    }}
                    title={`String ${note.stringNumber}, fret ${note.fret}${note.technique !== 'normal' ? ` (${note.technique})` : ''}`}
                  >
                    <span className="rounded bg-ink-850 px-0.5">
                      {note.fret}
                      <span className="text-amp-400">{tech}</span>
                    </span>
                  </button>
                );
              }),
            ),
          )}
        </div>
      </div>
    </div>
  );
}
