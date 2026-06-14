/**
 * TranscriptionScreen — the full results view: song metadata, waveform with
 * playhead, chord timeline, the continuous scrollable tab, the transport bar,
 * and every editor (chord / note / tuning / export). This is where a guitarist
 * actually plays along.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Share2, Music4, History } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { WaveformViewer } from '@/components/audio/WaveformViewer';
import { ChordTimeline } from '@/components/timeline/ChordTimeline';
import { TabView } from '@/components/tab/TabView';
import { Transport } from '@/components/transport/Transport';
import { ChordEditorSheet } from '@/components/edit/ChordEditorSheet';
import { NoteEditorSheet } from '@/components/edit/NoteEditorSheet';
import { TuningSheet } from '@/components/edit/TuningSheet';
import { ExportSheet } from '@/components/edit/ExportSheet';
import { Sheet } from '@/components/ui/Sheet';
import { useProjectStore } from '@/store/useProjectStore';
import { usePlayer } from '@/hooks/usePlayer';
import { loadAudio, loadProject } from '@/lib/storage';
import { decodeAudioFile, extractWaveform } from '@/audio/mic';
import { formatPercent, formatTime } from '@/lib/format';
import { confidenceColor } from '@/lib/format';
import type { TabNote } from '@/types';

export function TranscriptionScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.project);
  const { setProject, editChord, editNote, deleteNote, changeTuning, saveVersion, restoreVersion } =
    useProjectStore();
  const { player, state } = usePlayer();

  const [peaks, setPeaks] = useState<number[]>([]);
  const [playAlong, setPlayAlong] = useState(false);
  const [countIn, setCountIn] = useState(false);

  // Editor sheet state
  const [chordIdx, setChordIdx] = useState<number | null>(null);
  const [noteRef, setNoteRef] = useState<{ lineId: string; index: number } | null>(null);
  const [tuningOpen, setTuningOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const loadedAudioFor = useRef<string | null>(null);

  // Ensure the requested project is the active one (deep-link / reload).
  useEffect(() => {
    if (!id) return;
    if (project?.id === id) return;
    const loaded = loadProject(id);
    if (loaded) setProject(loaded);
    else navigate('/library', { replace: true });
  }, [id, project, setProject, navigate]);

  // Load audio into the player + build waveform peaks.
  useEffect(() => {
    if (!project || loadedAudioFor.current === project.id) return;
    loadedAudioFor.current = project.id;

    // Prefer the persisted (data-URL) copy: a stored `audioFile` may be a dead
    // blob: URL after a reload. Fall back to the live object URL for the
    // current session before the persisted copy finishes writing.
    const audioUrl = loadAudio(project.id) ?? project.audioFile ?? undefined;
    if (audioUrl) {
      player.load(audioUrl, project.bpm);
      player.setBpm(project.bpm);
      // Build waveform from the stored audio.
      fetch(audioUrl)
        .then((r) => r.blob())
        .then(decodeAudioFile)
        .then((buf) => setPeaks(extractWaveform(buf, 480)))
        .catch(() => setPeaks(Array.from({ length: 120 }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i)))));
    } else {
      // Demo / shared projects without audio: drive the playhead from a virtual
      // clock so play-along still works, and synthesise a decorative waveform.
      player.loadVirtual(project.duration, project.bpm);
      setPeaks(Array.from({ length: 160 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.6))));
    }
  }, [project, player]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">Loading…</div>
    );
  }

  // Loop the bars currently under the playhead (the tab line being played).
  const toggleLoop = () => {
    if (state.loop) {
      player.setLoop(null);
      return;
    }
    const line =
      project.tabLines.find((l) => state.currentTime >= l.startTime && state.currentTime < l.endTime) ??
      project.tabLines[0];
    if (line) player.setLoop({ start: line.startTime, end: line.endTime });
  };

  const toggleCountIn = () => {
    const next = !countIn;
    setCountIn(next);
    player.setCountIn(next ? project.timeSignature.beats : 0);
  };

  const activeNote: TabNote | null =
    noteRef
      ? project.tabLines.find((l) => l.id === noteRef.lineId)?.notes[noteRef.index] ?? null
      : null;

  return (
    <div className="flex min-h-full flex-col">
      <Header
        back
        title={project.title}
        subtitle={project.artist}
        onBack={() => navigate('/')}
        right={
          <>
            <button onClick={() => setVersionsOpen(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-white/5" aria-label="Versions">
              <History size={20} />
            </button>
            <button onClick={() => setExportOpen(true)} className="rounded-lg p-2 text-zinc-300 hover:bg-white/5" aria-label="Export & share">
              <Share2 size={20} />
            </button>
          </>
        }
      />

      <div className="flex-1 space-y-4 px-4 py-4">
        {/* Metadata chips */}
        <div className="grid grid-cols-4 gap-2">
          <div className="stat-chip">
            <span className="text-[10px] uppercase text-zinc-500">Key</span>
            <span className="text-sm font-semibold">{project.key}</span>
          </div>
          <div className="stat-chip">
            <span className="text-[10px] uppercase text-zinc-500">Tempo</span>
            <span className="text-sm font-semibold">{project.bpm}</span>
          </div>
          <div className="stat-chip">
            <span className="text-[10px] uppercase text-zinc-500">Time</span>
            <span className="text-sm font-semibold">
              {project.timeSignature.beats}/{project.timeSignature.value}
            </span>
          </div>
          <button onClick={() => setTuningOpen(true)} className="stat-chip hover:bg-ink-750">
            <span className="text-[10px] uppercase text-zinc-500">Tuning</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-ember">
              <Music4 size={12} /> {project.tuning.name}
            </span>
          </button>
        </div>

        <div className="px-1 text-xs">
          <span className="text-zinc-500">
            Overall confidence{' '}
            <span className={confidenceColor(project.confidenceScore)}>
              {formatPercent(project.confidenceScore)}
            </span>
          </span>
        </div>

        {/* Waveform */}
        <div className="card p-3">
          <WaveformViewer
            peaks={peaks}
            duration={project.duration}
            playhead={state.currentTime}
            loop={state.loop}
            onSeek={(t) => player.seek(t)}
            height={72}
          />
        </div>

        {/* Chord timeline */}
        <ChordTimeline
          project={project}
          currentTime={state.currentTime}
          onSeek={(t) => player.seek(t)}
          onEditChord={setChordIdx}
          followPlayhead={playAlong}
        />

        {/* Tab */}
        <TabView
          project={project}
          currentTime={state.currentTime}
          playAlong={playAlong}
          onEditNote={(lineId, index) => setNoteRef({ lineId, index })}
          onSeek={(t) => player.seek(t)}
        />
      </div>

      {/* Count-in overlay */}
      {state.countingIn && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-black/40">
          <div className="animate-pulse-ring font-display text-7xl font-bold text-ember">●</div>
        </div>
      )}

      {/* Transport */}
      <div className="sticky bottom-0 z-30">
        <Transport
          player={player}
          state={state}
          playAlong={playAlong}
          onTogglePlayAlong={() => setPlayAlong((v) => !v)}
          onToggleLoop={toggleLoop}
          hasLoop={!!state.loop}
          countIn={countIn}
          onToggleCountIn={toggleCountIn}
        />
      </div>

      {/* ---- Editors ---- */}
      <ChordEditorSheet
        open={chordIdx !== null}
        current={chordIdx !== null ? project.chords[chordIdx].chordName : ''}
        onClose={() => setChordIdx(null)}
        onSave={(name) => chordIdx !== null && editChord(chordIdx, name)}
      />

      <NoteEditorSheet
        open={noteRef !== null}
        note={activeNote}
        onClose={() => setNoteRef(null)}
        onSave={(patch) => noteRef && editNote(noteRef.lineId, noteRef.index, patch)}
        onDelete={() => noteRef && deleteNote(noteRef.lineId, noteRef.index)}
      />

      <TuningSheet
        open={tuningOpen}
        current={project.tuning}
        onClose={() => setTuningOpen(false)}
        onSelect={changeTuning}
      />

      <ExportSheet
        open={exportOpen}
        project={project}
        onClose={() => setExportOpen(false)}
        onSaveVersion={() => saveVersion(`Version ${project.versions.length + 1}`)}
      />

      {/* Versions */}
      <Sheet open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Saved versions">
        <button
          onClick={() => saveVersion(`Version ${project.versions.length + 1}`)}
          className="btn-primary mb-4 w-full py-3"
        >
          Save current as new version
        </button>
        {project.versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No versions yet.</p>
        ) : (
          <div className="space-y-2">
            {project.versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-xl bg-ink-800/60 px-4 py-3">
                <div>
                  <div className="font-semibold">{v.label}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(v.createdAt).toLocaleString()} · {formatTime(0)} {v.snapshot.key}
                  </div>
                </div>
                <button
                  onClick={() => {
                    restoreVersion(v.id);
                    setVersionsOpen(false);
                  }}
                  className="btn-outline px-3 py-1.5 text-sm"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
