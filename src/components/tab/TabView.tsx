/**
 * TabView — the scrollable tab reader. Tab lines flow continuously; each line
 * shows the chords playing over it, then the six-string grid. During play-along
 * the active line auto-scrolls into view.
 */
import { useEffect, useRef } from 'react';
import type { Project } from '@/types';
import { formatTime } from '@/lib/format';
import { TabLineView } from './TabLineView';

interface TabViewProps {
  project: Project;
  currentTime: number;
  playAlong: boolean;
  onEditNote: (lineId: string, noteIndex: number) => void;
  onSeek: (time: number) => void;
}

export function TabView({ project, currentTime, playAlong, onEditNote, onSeek }: TabViewProps) {
  const beatDuration = 60 / project.bpm;
  const activeLineRef = useRef<HTMLDivElement>(null);

  // The id of the line under the playhead. We scroll only when this *changes*
  // — scrolling on every animation frame is what made play-along feel laggy
  // and out of time.
  const activeLineId = project.tabLines.find(
    (l) => currentTime >= l.startTime && currentTime < l.endTime,
  )?.id;
  const lastScrolledId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!playAlong || !activeLineId) return;
    if (lastScrolledId.current === activeLineId) return;
    lastScrolledId.current = activeLineId;
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playAlong, activeLineId]);

  return (
    <div className="space-y-3">
      {project.tabLines.map((line) => {
        const isActive = currentTime >= line.startTime && currentTime < line.endTime;
        const chords = project.chords.filter(
          (c) => c.startTime < line.endTime && c.endTime > line.startTime,
        );
        return (
          <div
            key={line.id}
            ref={isActive ? activeLineRef : null}
            className={`card overflow-hidden ${isActive && playAlong ? 'ring-1 ring-ember/50' : ''}`}
          >
            {/* Slim header — just the timestamp; chords now sit over the grid */}
            <div className="flex items-center justify-end border-b border-white/5 px-3 py-1">
              <span className="font-mono text-[10px] text-zinc-600">{formatTime(line.startTime)}</span>
            </div>
            {/* Chords + six-string grid (scroll together) */}
            <div className="no-scrollbar overflow-x-auto px-2 py-2">
              <TabLineView
                line={line}
                chords={chords}
                tuning={project.tuning}
                beatDuration={beatDuration}
                currentTime={currentTime}
                onEditNote={onEditNote}
                onSeek={onSeek}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
