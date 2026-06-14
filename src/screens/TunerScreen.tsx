/**
 * TunerScreen — chromatic guitar tuner with preset & custom tunings. Shows the
 * needle gauge, the six target strings (the nearest one highlights and turns
 * green when in tune), and a start/stop mic control.
 */
import { useState } from 'react';
import { Power, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { TunerGauge } from '@/components/tuner/TunerGauge';
import { TuningSheet } from '@/components/edit/TuningSheet';
import { useTuner } from '@/hooks/useTuner';
import { STANDARD_TUNING } from '@/data/tunings';
import { pitchClass } from '@/lib/music';
import type { Tuning } from '@/types';

export function TunerScreen() {
  const [tuning, setTuning] = useState<Tuning>(STANDARD_TUNING);
  const [tuningOpen, setTuningOpen] = useState(false);
  const { reading, error, start, stop, listening } = useTuner(tuning);

  const toggle = () => (listening ? stop() : void start());

  return (
    <div className="amp-bg flex min-h-full flex-col">
      <Header title="Tuner" subtitle={`${tuning.name} · ${tuning.strings.map(pitchClass).join(' ')}`} />

      <div className="flex flex-1 flex-col px-5 py-6">
        {/* Tuning picker */}
        <button
          onClick={() => setTuningOpen(true)}
          className="mx-auto mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-ink-800/70 px-5 py-2.5"
        >
          <span className="font-display font-semibold uppercase tracking-wide">{tuning.name}</span>
          <ChevronDown size={16} className="text-zinc-400" />
        </button>

        {error && (
          <div className="mb-4 rounded-xl bg-signal-red/15 px-4 py-3 text-center text-sm text-signal-red">
            {error}
          </div>
        )}

        {/* Gauge */}
        <div className="my-4">
          <TunerGauge reading={reading} />
        </div>

        {/* Strings */}
        <div className="mt-6 grid grid-cols-6 gap-2">
          {tuning.strings.map((s, i) => {
            const nearest = reading.nearestStringIndex === i && reading.active && reading.frequency > 0;
            const tuned = nearest && reading.inTune;
            return (
              <div
                key={i}
                className={`flex flex-col items-center rounded-xl border py-3 transition-all ${
                  tuned
                    ? 'border-signal-green bg-signal-green/15'
                    : nearest
                      ? 'border-ember bg-ember/15'
                      : 'border-white/5 bg-ink-800/60'
                }`}
              >
                <span className="text-[10px] text-zinc-500">{6 - i}</span>
                <span
                  className={`font-display text-xl font-bold ${
                    tuned ? 'text-signal-green' : nearest ? 'text-ember' : 'text-zinc-300'
                  }`}
                >
                  {pitchClass(s)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Start / stop */}
        <div className="mt-auto flex flex-col items-center pt-8">
          <button
            onClick={toggle}
            className={`grid h-20 w-20 place-items-center rounded-full transition-all active:scale-95 ${
              listening ? 'bg-signal-red text-white shadow-glow' : 'bg-ember text-white shadow-ember'
            }`}
            aria-label={listening ? 'Stop tuner' : 'Start tuner'}
          >
            <Power size={30} />
          </button>
          <span className="mt-3 text-sm text-zinc-400">{listening ? 'Listening…' : 'Tap to start'}</span>
        </div>
      </div>

      <TuningSheet open={tuningOpen} current={tuning} onClose={() => setTuningOpen(false)} onSelect={setTuning} />
    </div>
  );
}
