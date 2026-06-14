/**
 * TuningSheet — pick a preset tuning or build a custom one. Choosing a tuning
 * triggers fingering regeneration upstream (see ProjectStore.changeTuning).
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { TUNING_PRESETS, createCustomTuning } from '@/data/tunings';
import { ALL_NOTE_NAMES } from '@/engine/fretboard';
import { pitchClass } from '@/lib/music';
import type { Tuning } from '@/types';

interface TuningSheetProps {
  open: boolean;
  current: Tuning;
  onClose: () => void;
  onSelect: (tuning: Tuning) => void;
}

export function TuningSheet({ open, current, onClose, onSelect }: TuningSheetProps) {
  const [custom, setCustom] = useState<Tuning>(createCustomTuning());
  const [editingCustom, setEditingCustom] = useState(false);

  const sameAs = (t: Tuning) => t.strings.join() === current.strings.join();

  // Change one string of the custom tuning, bumping the octave with the note.
  const setCustomString = (index: number, noteName: string) => {
    const octave = current.strings[index].replace(/^[A-G][#b]?/, '') || '2';
    const next = [...custom.strings] as Tuning['strings'];
    next[index] = `${noteName}${octave}`;
    setCustom({ name: 'Custom', strings: next });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tuning">
      <div className="space-y-2">
        {TUNING_PRESETS.map((t) => (
          <button
            key={t.name}
            onClick={() => {
              onSelect(t);
              onClose();
            }}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 ${
              sameAs(t) ? 'border-ember bg-ember/15' : 'border-white/5 bg-ink-800/60'
            }`}
          >
            <div className="text-left">
              <div className="font-semibold">{t.name}</div>
              <div className="font-mono text-xs text-zinc-400">
                {t.strings.map((s) => pitchClass(s)).join(' ')}
              </div>
            </div>
            {sameAs(t) && <Check size={18} className="text-ember" />}
          </button>
        ))}

        {/* Custom tuning */}
        <button
          onClick={() => setEditingCustom((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-ink-800/60 px-4 py-3"
        >
          <span className="font-semibold">Custom tuning</span>
          <span className="text-xs text-amp-400">{editingCustom ? 'Hide' : 'Edit'}</span>
        </button>

        {editingCustom && (
          <div className="rounded-xl border border-white/5 bg-ink-800/40 p-3">
            <div className="grid grid-cols-6 gap-1.5">
              {custom.strings.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="mb-1 text-[10px] text-zinc-500">{6 - i}</div>
                  <select
                    value={pitchClass(s)}
                    onChange={(e) => setCustomString(i, e.target.value)}
                    className="w-full rounded-lg bg-ink-750 py-2 text-center font-mono text-sm"
                  >
                    {ALL_NOTE_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                onSelect(custom);
                onClose();
              }}
              className="btn-primary mt-3 w-full py-3"
            >
              Apply custom tuning
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
