/**
 * Heuristic song-structure labelling. True verse/chorus detection is its own
 * ML problem; this scales a conventional song template to the clip length and
 * labels sections with friendly (approximate) names, which the user opted to
 * keep. Also emits the bar grid.
 */
import { uid } from '@/lib/format';
import type { BarMarker, Section } from '@/types';

const FLOW: { type: Section['type']; weight: number; label?: string }[] = [
  { type: 'intro', weight: 1 },
  { type: 'verse', weight: 2 },
  { type: 'chorus', weight: 2 },
  { type: 'verse', weight: 2, label: 'Verse 2' },
  { type: 'chorus', weight: 2, label: 'Chorus 2' },
  { type: 'solo', weight: 2 },
  { type: 'outro', weight: 1 },
];

export function buildSections(totalBars: number, bar: number): Section[] {
  const totalWeight = FLOW.reduce((a, s) => a + s.weight, 0);
  const sections: Section[] = [];
  let cursor = 0;
  for (const s of FLOW) {
    const len = Math.max(1, Math.round((s.weight / totalWeight) * totalBars));
    if (cursor >= totalBars) break;
    sections.push({
      id: uid('sec'),
      type: s.type,
      label: s.label,
      startTime: cursor * bar,
      endTime: Math.min((cursor + len) * bar, totalBars * bar),
    });
    cursor += len;
  }
  if (sections.length) sections[sections.length - 1].endTime = totalBars * bar;
  return sections;
}

export function buildBars(totalBars: number, bar: number): BarMarker[] {
  return Array.from({ length: totalBars }, (_, i) => ({ index: i, startTime: i * bar }));
}
