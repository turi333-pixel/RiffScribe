/**
 * AnalyzeScreen — shown after upload/record. Decodes the audio, renders the
 * waveform with draggable trim handles, then runs the active transcription
 * engine (mock or cloud) with a progress readout and creates a Project.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { WaveformViewer } from '@/components/audio/WaveformViewer';
import { TuningSheet } from '@/components/edit/TuningSheet';
import { decodeAudioFile, extractWaveform, trimToWav, sliceBuffer } from '@/audio/mic';
import { getEngine, getFallbackEngine } from '@/engine';
import { useCaptureStore } from '@/store/useCaptureStore';
import { useProjectStore } from '@/store/useProjectStore';
import { saveAudio, saveProject } from '@/lib/storage';
import { STANDARD_TUNING } from '@/data/tunings';
import { uid, formatTime } from '@/lib/format';
import type { Project, Tuning } from '@/types';

export function AnalyzeScreen() {
  const navigate = useNavigate();
  const pending = useCaptureStore((s) => s.pending);
  const clearPending = useCaptureStore((s) => s.clear);
  const setProject = useProjectStore((s) => s.setProject);

  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(null);
  const [tuning, setTuning] = useState<Tuning>(STANDARD_TUNING);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const navigatingRef = useRef(false);

  // Decode the pending audio once.
  useEffect(() => {
    // Don't redirect home when `pending` clears because we've just finished and
    // are navigating to the new project (avoids a navigation race).
    if (!pending) {
      if (!navigatingRef.current) navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const buf = await decodeAudioFile(pending.blob);
        if (cancelled) return;
        setBuffer(buf);
        setPeaks(extractWaveform(buf, 480));
        setTrim({ start: 0, end: buf.duration });
      } catch {
        setError('Could not decode this audio file. Try a different mp3/wav/m4a.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, navigate]);

  const duration = buffer?.duration ?? 0;
  const trimmedLength = trim ? trim.end - trim.start : 0;
  const engineLabel = useMemo(() => getEngine().label, []);

  const runTranscription = async () => {
    if (!pending || !buffer) return;
    setError(null);
    setStage('Starting…');
    setProgress(0);

    // Crop to the trimmed region up front, so BOTH the analysis and the saved
    // playback audio share one 0-based timeline (no playhead/tab drift).
    const isTrimmed = !!trim && (trim.start > 0.05 || trim.end < duration - 0.05);
    const analysed = isTrimmed ? sliceBuffer(buffer, trim!.start, trim!.end) : buffer;
    const audioBlob = isTrimmed ? trimToWav(buffer, trim!.start, trim!.end) : pending.blob;

    const onProgress = (s: string, p: number) => {
      setStage(s);
      setProgress(p);
    };
    const run = (engine: ReturnType<typeof getEngine>) =>
      engine.transcribe(
        {
          audioBuffer: analysed,
          file: pending.source === 'upload' ? (pending.blob as File) : undefined,
          title: pending.title,
          tuning,
        },
        onProgress,
      );

    try {
      let result;
      try {
        result = await run(getEngine());
      } catch (primaryErr) {
        // On-device analysis failed (e.g. silence, or no WebGL) — fall back to
        // the offline mock so the user still gets something, and say so.
        console.warn('Primary engine failed, falling back to mock:', primaryErr);
        setError(
          primaryErr instanceof Error
            ? `On-device analysis: ${primaryErr.message} — showing an estimated transcription instead.`
            : 'On-device analysis failed — showing an estimated transcription instead.',
        );
        result = await run(getFallbackEngine());
      }

      const id = uid('proj');
      const now = new Date().toISOString();
      const project: Project = {
        id,
        title: result.title,
        artist: result.artist,
        duration: result.duration,
        bpm: result.bpm,
        key: result.key,
        timeSignature: result.timeSignature,
        tuning: result.tuning,
        sections: result.sections,
        chords: result.chords,
        tabLines: result.tabLines,
        bars: result.bars,
        confidenceScore: result.confidenceScore,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };

      // Persist audio + project so it survives reload and lives in the library.
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;
      project.audioFile = url;
      saveProject(project);
      void saveAudio(id, audioBlob);
      setProject(project);
      navigatingRef.current = true;
      navigate(`/project/${id}`, { replace: true });
      clearPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed.');
      setStage(null);
    }
  };

  const busy = stage !== null;

  return (
    <div className="flex min-h-full flex-col">
      <Header back title="Analyse" subtitle={pending?.title} onBack={() => navigate('/')} />

      <div className="flex-1 space-y-5 px-4 py-5">
        {error && (
          <div className="rounded-xl bg-signal-red/15 px-4 py-3 text-sm text-signal-red">{error}</div>
        )}

        {/* Waveform + trim */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Scissors size={16} className="text-ember" /> Trim section
            </span>
            {trim && (
              <button
                onClick={() => setTrim({ start: 0, end: duration })}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
          </div>

          {peaks.length ? (
            <WaveformViewer
              peaks={peaks}
              duration={duration}
              trim={trim ?? undefined}
              onTrimChange={setTrim}
              height={110}
            />
          ) : (
            <div className="flex h-[110px] items-center justify-center rounded-xl bg-ink-800/60">
              <Loader2 className="animate-spin text-ember" />
            </div>
          )}

          {trim && (
            <div className="mt-2 flex justify-between font-mono text-xs text-zinc-400">
              <span>{formatTime(trim.start, true)}</span>
              <span className="text-ember">{formatTime(trimmedLength, true)} selected</span>
              <span>{formatTime(trim.end, true)}</span>
            </div>
          )}
        </div>

        {/* Tuning */}
        <button
          onClick={() => setTuningOpen(true)}
          className="card flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Tuning</div>
            <div className="font-semibold">{tuning.name}</div>
          </div>
          <span className="font-mono text-sm text-zinc-400">{tuning.strings.join(' ')}</span>
        </button>

        {/* Engine info */}
        <p className="text-center text-xs text-zinc-500">
          Engine: <span className="text-zinc-300">{engineLabel}</span>
        </p>
      </div>

      {/* Sticky action */}
      <div className="sticky bottom-0 border-t border-white/5 bg-ink-900/95 px-4 py-4 backdrop-blur-lg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        {busy ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-200">
                <Loader2 size={16} className="animate-spin text-ember" />
                {stage}
              </span>
              <span className="font-mono text-zinc-400">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-ember transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : (
          <button onClick={runTranscription} disabled={!buffer} className="btn-primary w-full py-4 text-base">
            <Sparkles size={20} /> Transcribe
          </button>
        )}
      </div>

      <TuningSheet open={tuningOpen} current={tuning} onClose={() => setTuningOpen(false)} onSelect={setTuning} />
    </div>
  );
}
