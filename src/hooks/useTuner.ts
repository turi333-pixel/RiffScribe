/**
 * useTuner — opens the mic, runs pitch detection on a rAF loop, and reports the
 * nearest note + cents offset against the active tuning. Smoothed so the needle
 * doesn't jitter.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { openMic, type MicStream } from '@/audio/mic';
import { detectPitch } from '@/audio/pitchDetect';
import { analysePitch, noteToMidi } from '@/lib/music';
import type { Tuning } from '@/types';

export interface TunerReading {
  active: boolean;
  frequency: number;
  noteName: string;
  cents: number;
  /** Index (0–5, low→high) of the closest target string in the tuning. */
  nearestStringIndex: number | null;
  /** True when within ±5 cents of the nearest target string. */
  inTune: boolean;
  clarity: number;
}

const EMPTY: TunerReading = {
  active: false,
  frequency: -1,
  noteName: '—',
  cents: 0,
  nearestStringIndex: null,
  inTune: false,
  clarity: 0,
};

export function useTuner(tuning: Tuning) {
  const [reading, setReading] = useState<TunerReading>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const micRef = useRef<MicStream | null>(null);
  const rafRef = useRef(0);
  const bufRef = useRef<Float32Array>(new Float32Array(4096));
  const smoothFreq = useRef(0);
  // Recent detected frequencies for median filtering (rejects octave blips).
  const historyRef = useRef<number[]>([]);
  // Consecutive frames without a clear pitch — used to "hold" the last note
  // through brief gaps instead of snapping the needle back to centre.
  const silentFramesRef = useRef(0);
  const lastEmitRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    micRef.current?.stop();
    micRef.current = null;
    smoothFreq.current = 0;
    historyRef.current = [];
    silentFramesRef.current = 0;
    setReading(EMPTY);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      // A longer window resolves the low E (~82 Hz) far more reliably.
      const mic = await openMic(4096);
      micRef.current = mic;
      bufRef.current = new Float32Array(mic.analyser.fftSize);
      historyRef.current = [];
      silentFramesRef.current = 0;

      const targets = tuning.strings.map((s) => noteToMidi(s));

      const loop = () => {
        const mic = micRef.current;
        if (!mic) return;
        rafRef.current = requestAnimationFrame(loop);

        mic.read(bufRef.current);
        const { frequency, clarity } = detectPitch(bufRef.current, mic.context.sampleRate);

        if (frequency > 0) {
          silentFramesRef.current = 0;

          // 1) Median-filter the last few raw readings to reject octave jumps
          //    and one-off glitches before they reach the needle.
          const hist = historyRef.current;
          hist.push(frequency);
          if (hist.length > 6) hist.shift();
          const median = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];

          // 2) Heavy exponential smoothing for a calm needle. If the input
          //    jumps a long way (new string), snap rather than crawl.
          const jump = smoothFreq.current && Math.abs(median - smoothFreq.current) / smoothFreq.current > 0.06;
          if (!smoothFreq.current || jump) {
            smoothFreq.current = median;
            hist.length = 0;
            hist.push(median);
          } else {
            smoothFreq.current = smoothFreq.current * 0.92 + median * 0.08;
          }

          const { midi, noteName, cents } = analysePitch(smoothFreq.current);

          let nearestStringIndex = 0;
          let best = Infinity;
          targets.forEach((t, i) => {
            const d = Math.abs(t - midi);
            if (d < best) {
              best = d;
              nearestStringIndex = i;
            }
          });

          // 3) Throttle React updates to ~30 Hz — the rAF runs faster than the
          //    eye needs and re-rendering every frame is what looks "shaky".
          const now = performance.now();
          if (now - lastEmitRef.current < 33) return;
          lastEmitRef.current = now;

          setReading({
            active: true,
            frequency: smoothFreq.current,
            noteName,
            cents,
            nearestStringIndex,
            inTune: Math.abs(cents) <= 5 && best === 0,
            clarity,
          });
        } else {
          // Hold the last note briefly through gaps, then go quiet.
          silentFramesRef.current += 1;
          if (silentFramesRef.current > 18) {
            historyRef.current = [];
            smoothFreq.current = 0;
            setReading((r) => (r.frequency === -1 ? r : { ...r, frequency: -1 }));
          }
        }
      };
      loop();
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not access the microphone.',
      );
    }
  }, [tuning]);

  useEffect(() => () => stop(), [stop]);

  return { reading, error, start, stop, listening: !!micRef.current };
}
