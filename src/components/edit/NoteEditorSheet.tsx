/** Edit a single tab note: string, fret and technique — or delete it. */
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import type { TabNote, Technique } from '@/types';

const TECHNIQUES: { id: Technique; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'hammer-on', label: 'Hammer' },
  { id: 'pull-off', label: 'Pull-off' },
  { id: 'slide', label: 'Slide' },
  { id: 'bend', label: 'Bend' },
  { id: 'vibrato', label: 'Vibrato' },
  { id: 'mute', label: 'Mute' },
];

interface NoteEditorSheetProps {
  open: boolean;
  note: TabNote | null;
  onClose: () => void;
  onSave: (patch: Partial<TabNote>) => void;
  onDelete: () => void;
}

export function NoteEditorSheet({ open, note, onClose, onSave, onDelete }: NoteEditorSheetProps) {
  const [fret, setFret] = useState(0);
  const [stringNumber, setStringNumber] = useState(1);
  const [technique, setTechnique] = useState<Technique>('normal');

  useEffect(() => {
    if (note) {
      setFret(note.fret);
      setStringNumber(note.stringNumber);
      setTechnique(note.technique);
    }
  }, [note]);

  return (
    <Sheet open={open} onClose={onClose} title="Edit note">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">String</p>
      <div className="mb-4 grid grid-cols-6 gap-1.5">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <button
            key={s}
            onClick={() => setStringNumber(s)}
            className={`rounded-lg py-2.5 text-sm font-semibold ${
              stringNumber === s ? 'bg-ember text-white' : 'bg-white/5 text-zinc-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Fret</p>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={24}
          value={fret}
          onChange={(e) => setFret(Number(e.target.value))}
          className="h-2 flex-1 accent-ember"
        />
        <span className="w-10 text-center font-mono text-xl font-semibold text-ember">{fret}</span>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Technique</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {TECHNIQUES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTechnique(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              technique === t.id ? 'bg-ember text-white' : 'bg-white/5 text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="btn-ghost px-4 py-3.5 text-signal-red"
          aria-label="Delete note"
        >
          <Trash2 size={20} />
        </button>
        <button
          onClick={() => {
            onSave({ fret, stringNumber, technique });
            onClose();
          }}
          className="btn-primary flex-1 py-3.5 text-base"
        >
          Save note
        </button>
      </div>
    </Sheet>
  );
}
