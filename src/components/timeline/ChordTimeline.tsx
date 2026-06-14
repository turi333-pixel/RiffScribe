/**
 * ChordTimeline — a horizontally-scrollable lane of detected chords used as an
 * overview / seek strip. Chords are laid out as equal-spaced chips (not
 * time-proportional) so long names like "A#maj7" never overlap. The active
 * chord highlights and auto-centres within the strip during play-along; tapping
 * a chip seeks, the pencil opens the chord editor.
 */
import { useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import type { Project } from '@/types';
import { ConfidenceDot } from '@/components/ui/Confidence';

interface ChordTimelineProps {
  project: Project;
  currentTime: number;
  onSeek: (time: number) => void;
  onEditChord: (index: number) => void;
  followPlayhead?: boolean;
}

export function ChordTimeline({
  project,
  currentTime,
  onSeek,
  onEditChord,
  followPlayhead = true,
}: ChordTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIndex = project.chords.findIndex(
    (c) => currentTime >= c.startTime && currentTime < c.endTime,
  );

  // Centre the active chip — scrolling ONLY this strip horizontally (measuring
  // the element so it works regardless of chip widths).
  useEffect(() => {
    if (!followPlayhead || activeIndex < 0 || !scrollRef.current) return;
    const container = scrollRef.current;
    const el = container.querySelector<HTMLElement>(`[data-chord="${activeIndex}"]`);
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.left + eRect.width / 2 - (cRect.left + cRect.width / 2);
    container.scrollTo({ left: container.scrollLeft + delta, behavior: 'smooth' });
  }, [activeIndex, followPlayhead]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Chords</span>
        <span className="text-[11px] text-zinc-500">Tap to seek · ✎ to edit</span>
      </div>

      <div ref={scrollRef} className="no-scrollbar overflow-x-auto px-3 py-3">
        <div className="flex gap-2">
          {project.chords.map((chord, i) => {
            const active = i === activeIndex;
            return (
              <div key={i} data-chord={i} className="relative shrink-0 pt-1.5">
                <button
                  onClick={() => onSeek(chord.startTime)}
                  className={`flex h-14 min-w-[58px] flex-col items-center justify-center gap-1 rounded-lg border px-3 transition-all ${
                    active
                      ? 'border-ember bg-ember/20 shadow-glow'
                      : 'border-white/5 bg-ink-800/60 hover:bg-ink-750'
                  }`}
                >
                  <span
                    className={`whitespace-nowrap font-display text-base font-semibold ${
                      active ? 'text-ember-300' : 'text-zinc-100'
                    }`}
                  >
                    {chord.chordName}
                  </span>
                  <ConfidenceDot value={chord.confidence} />
                </button>
                <button
                  onClick={() => onEditChord(i)}
                  className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-ink-900 text-zinc-400 hover:text-ember"
                  aria-label={`Edit chord ${chord.chordName}`}
                >
                  <Pencil size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
