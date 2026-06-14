/** Edit a detected chord: pick a root + quality, or type a custom name. */
import { useEffect, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { ALL_NOTE_NAMES } from '@/engine/fretboard';

const QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', 'add9', 'dim', 'aug', '5'];
const QUALITY_LABEL: Record<string, string> = { '': 'maj' };

interface ChordEditorSheetProps {
  open: boolean;
  current: string;
  onClose: () => void;
  onSave: (chordName: string) => void;
}

export function ChordEditorSheet({ open, current, onClose, onSave }: ChordEditorSheetProps) {
  const [value, setValue] = useState(current);

  // Re-seed the editor whenever a different chord is opened.
  useEffect(() => {
    if (open) setValue(current);
  }, [open, current]);

  const setRoot = (root: string) => {
    const quality = value.replace(/^[A-G][#b]?/, '');
    setValue(root + quality);
  };
  const setQuality = (q: string) => {
    const root = (/^([A-G][#b]?)/.exec(value)?.[1]) ?? 'C';
    setValue(root + q);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit chord">
      <div className="mb-4 text-center">
        <span className="font-display text-4xl font-bold text-ember">{value || '—'}</span>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Root</p>
      <div className="mb-4 grid grid-cols-6 gap-1.5">
        {ALL_NOTE_NAMES.map((n) => {
          const rootMatch = /^([A-G][#b]?)/.exec(value)?.[1] === n;
          return (
            <button
              key={n}
              onClick={() => setRoot(n)}
              className={`rounded-lg py-2 text-sm font-semibold ${
                rootMatch ? 'bg-ember text-white' : 'bg-white/5 text-zinc-200'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Quality</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {QUALITIES.map((q) => {
          const quality = value.replace(/^[A-G][#b]?/, '');
          const active = quality === q;
          return (
            <button
              key={q || 'maj'}
              onClick={() => setQuality(q)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                active ? 'bg-ember text-white' : 'bg-white/5 text-zinc-200'
              }`}
            >
              {QUALITY_LABEL[q] ?? q}
            </button>
          );
        })}
      </div>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mb-4 w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 font-mono text-center text-lg focus:border-ember focus:outline-none"
        placeholder="Custom, e.g. G/B"
      />

      <button
        onClick={() => {
          onSave(value.trim());
          onClose();
        }}
        className="btn-primary w-full py-3.5 text-base"
      >
        Save chord
      </button>
    </Sheet>
  );
}
