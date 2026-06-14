/**
 * DashboardScreen ("Library") — all saved projects, with the demo seeded in.
 * Tap to open; swipe-free delete via a trailing button.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Sparkles, Guitar } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { listProjects, deleteProject, saveProject } from '@/lib/storage';
import { buildDemoProject, DEMO_PROJECT_ID } from '@/data/demoSong';
import { useProjectStore } from '@/store/useProjectStore';
import { formatPercent, confidenceColor } from '@/lib/format';
import type { ProjectSummary } from '@/types';

export function DashboardScreen() {
  const navigate = useNavigate();
  const setProject = useProjectStore((s) => s.setProject);
  const [projects, setProjects] = useState<ProjectSummary[]>(() => listProjects());

  const refresh = () => setProjects(listProjects());

  const remove = (id: string) => {
    deleteProject(id);
    refresh();
  };

  const openDemo = () => {
    const demo = buildDemoProject();
    saveProject(demo);
    setProject(demo);
    navigate(`/project/${DEMO_PROJECT_ID}`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header
        title="Library"
        right={
          <button onClick={() => navigate('/')} className="rounded-lg p-2 text-ember hover:bg-white/5" aria-label="New transcription">
            <Plus size={22} />
          </button>
        }
      />

      <div className="flex-1 space-y-3 px-4 py-4">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-ink-800">
              <Guitar size={30} className="text-zinc-600" />
            </div>
            <p className="mb-1 font-display text-lg font-semibold">No transcriptions yet</p>
            <p className="mb-6 max-w-xs text-sm text-zinc-500">
              Record a riff or upload a song to get chords, tabs and structure.
            </p>
            <button onClick={() => navigate('/')} className="btn-primary px-6 py-3">
              <Plus size={18} /> New transcription
            </button>
            <button onClick={openDemo} className="mt-3 flex items-center gap-2 text-sm text-amp-400">
              <Sparkles size={16} /> Or open the demo
            </button>
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/project/${p.id}`)}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-white/5 bg-ink-850/70 px-4 py-3 text-left active:scale-[0.99]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-ember/15 font-display text-lg font-bold text-ember">
                  {p.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.title}</div>
                  <div className="text-xs text-zinc-400">
                    {p.artist ? `${p.artist} · ` : ''}
                    {p.key} · {p.bpm} BPM
                  </div>
                  <div className="mt-0.5 text-[11px]">
                    <span className={confidenceColor(p.confidenceScore)}>
                      {formatPercent(p.confidenceScore)} confidence
                    </span>
                  </div>
                </div>
              </button>
              <button
                onClick={() => remove(p.id)}
                className="rounded-xl p-3 text-zinc-500 hover:bg-signal-red/10 hover:text-signal-red"
                aria-label={`Delete ${p.title}`}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
