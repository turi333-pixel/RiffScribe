/**
 * SharedScreen — decodes a `#/shared/<payload>` link into a read-only project,
 * then offers to save it to the local library (which routes into the normal
 * transcription view).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { decodeShareLink, saveProject } from '@/lib/storage';
import { useProjectStore } from '@/store/useProjectStore';
import type { Project } from '@/types';

export function SharedScreen() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const setProject = useProjectStore((s) => s.setProject);
  const [project, setLocal] = useState<Project | null>(null);

  useEffect(() => {
    if (payload) setLocal(decodeShareLink(payload));
  }, [payload]);

  const importProject = () => {
    if (!project) return;
    saveProject(project);
    setProject(project);
    navigate(`/project/${project.id}`, { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header back title="Shared transcription" onBack={() => navigate('/')} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {project ? (
          <>
            <div className="mb-2 font-display text-3xl font-bold">{project.title}</div>
            <p className="mb-8 text-sm text-zinc-400">
              {project.artist ? `${project.artist} · ` : ''}
              {project.key} · {project.bpm} BPM · {project.tuning.name}
            </p>
            <button onClick={importProject} className="btn-primary px-6 py-3.5">
              <Download size={18} /> Save to my library
            </button>
          </>
        ) : (
          <p className="text-zinc-500">This share link could not be read.</p>
        )}
      </div>
    </div>
  );
}
