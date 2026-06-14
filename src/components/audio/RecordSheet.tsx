/**
 * RecordSheet — full microphone capture UI: live level meter, elapsed time, and
 * start/stop. On stop it returns the recorded Blob to the caller.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Recorder, openMic, type MicStream } from '@/audio/mic';
import { Sheet } from '@/components/ui/Sheet';
import { formatTime } from '@/lib/format';

interface RecordSheetProps {
  open: boolean;
  onClose: () => void;
  onComplete: (blob: Blob) => void;
}

export function RecordSheet({ open, onClose, onComplete }: RecordSheetProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'finishing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array(40).fill(0.05));

  const recorderRef = useRef<Recorder | null>(null);
  const micRef = useRef<MicStream | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const bufRef = useRef<Float32Array>(new Float32Array(1024));

  const cleanup = () => {
    cancelAnimationFrame(rafRef.current);
    micRef.current?.stop();
    micRef.current = null;
    recorderRef.current?.cancel();
    recorderRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      cleanup();
      setState('idle');
      setElapsed(0);
      setError(null);
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = async () => {
    try {
      setError(null);
      const recorder = new Recorder();
      await recorder.start();
      recorderRef.current = recorder;

      // Separate analyser stream for the live meter.
      const mic = await openMic(1024);
      micRef.current = mic;
      bufRef.current = new Float32Array(mic.analyser.fftSize);
      startRef.current = performance.now();
      setState('recording');

      const tick = () => {
        if (!micRef.current) return;
        micRef.current.read(bufRef.current);
        let rms = 0;
        for (const v of bufRef.current) rms += v * v;
        rms = Math.sqrt(rms / bufRef.current.length);
        setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 6 + 0.04)]);
        setElapsed((performance.now() - startRef.current) / 1000);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not access the microphone.',
      );
      setState('idle');
    }
  };

  const stop = async () => {
    if (!recorderRef.current) return;
    setState('finishing');
    cancelAnimationFrame(rafRef.current);
    micRef.current?.stop();
    const blob = await recorderRef.current.stop();
    cleanup();
    onComplete(blob);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Listen now">
      {error && (
        <div className="mb-4 rounded-xl bg-signal-red/15 px-4 py-3 text-sm text-signal-red">{error}</div>
      )}

      {/* Live waveform meter */}
      <div className="mb-6 flex h-28 items-center justify-center gap-[3px] rounded-2xl bg-ink-800/70 px-4">
        {levels.map((lvl, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-[height] duration-75 ${
              state === 'recording' ? 'bg-ember' : 'bg-white/15'
            }`}
            style={{ height: `${Math.max(4, lvl * 100)}%` }}
          />
        ))}
      </div>

      <div className="mb-6 text-center font-mono text-3xl font-semibold tabular-nums">
        {formatTime(elapsed, true)}
      </div>

      <div className="flex items-center justify-center">
        {state === 'idle' && (
          <button onClick={start} className="btn-primary h-20 w-20 rounded-full" aria-label="Start recording">
            <Mic size={32} />
          </button>
        )}
        {state === 'recording' && (
          <button onClick={stop} className="relative grid h-20 w-20 place-items-center rounded-full bg-signal-red text-white" aria-label="Stop recording">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-signal-red/60" />
            <Square size={28} fill="currentColor" />
          </button>
        )}
        {state === 'finishing' && (
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/5 text-ember">
            <Loader2 size={32} className="animate-spin" />
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">
        {state === 'recording' ? 'Tap to stop & analyse' : 'Play your riff into the mic'}
      </p>
    </Sheet>
  );
}
