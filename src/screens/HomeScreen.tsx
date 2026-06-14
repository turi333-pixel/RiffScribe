/**
 * HomeScreen — the landing screen. Two big actions (Upload song / Listen now)
 * and a peek at recent projects.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Mic, ChevronRight } from 'lucide-react';
import { Wordmark } from '@/components/layout/Header';
import { RecordSheet } from '@/components/audio/RecordSheet';
import { useCaptureStore } from '@/store/useCaptureStore';
import { listProjects } from '@/lib/storage';
import { formatPercent } from '@/lib/format';

const ACCEPT = 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a';

export function HomeScreen() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const setPending = useCaptureStore((s) => s.setPending);
  const recents = listProjects().slice(0, 3);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const title = file.name.replace(/\.[^.]+$/, '');
    setPending({ blob: file, title, source: 'upload' });
    navigate('/analyze');
  };

  const onRecorded = (blob: Blob) => {
    setRecording(false);
    // Timestamp the title so multiple takes are distinguishable in the library.
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPending({ blob, title: `Riff · ${stamp}`, source: 'mic' });
    navigate('/analyze');
  };

  return (
    <div className="amp-bg flex min-h-full flex-col px-5 pb-6 pt-8">
      <div className="mb-2 flex items-center justify-between">
        <Wordmark />
      </div>
      <p className="mb-8 text-sm text-zinc-400">Hear it. Read it. Play it.</p>

      {/* Two big actions */}
      <div className="grid gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-800 to-ink-850 p-6 text-left shadow-card active:scale-[0.99]"
        >
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-ember/10 blur-2xl" />
          <Upload className="mb-3 text-ember" size={32} />
          <div className="font-display text-2xl font-bold uppercase tracking-wide">Upload song</div>
          <div className="text-sm text-zinc-400">mp3 · wav · m4a</div>
        </button>

        <button
          onClick={() => setRecording(true)}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-ember-600 to-ember p-6 text-left shadow-ember active:scale-[0.99]"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <Mic className="mb-3 text-white" size={32} />
          <div className="font-display text-2xl font-bold uppercase tracking-wide text-white">Listen now</div>
          <div className="text-sm text-white/80">Record a riff through your mic</div>
        </button>
      </div>

      {/* Recent projects */}
      {recents.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Recent
            </h2>
            <button onClick={() => navigate('/library')} className="text-xs text-amp-400">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {recents.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-ink-850/70 px-4 py-3 text-left"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ember/15 font-display font-bold text-ember">
                  {p.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.title}</div>
                  <div className="text-xs text-zinc-400">
                    {p.key} · {p.bpm} BPM · {formatPercent(p.confidenceScore)} conf.
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <RecordSheet open={recording} onClose={() => setRecording(false)} onComplete={onRecorded} />

      <div className="mt-auto pt-8 text-center text-[11px] text-zinc-600">
        RiffScribe · on-device AI transcription
      </div>
    </div>
  );
}
