/**
 * Plain-text and Guitar-Pro-style ASCII tab export.
 */
import { TECHNIQUE_SYMBOLS } from '@/engine/fretboard';
import { formatTime } from '@/lib/format';
import type { Project, TabLine } from '@/types';

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // string 1 → 6

/** Render one tab line to six ASCII rows. */
function renderTabLine(line: TabLine, slots = 16): string[] {
  // Quantise notes into evenly-spaced columns across the line's duration.
  const span = line.endTime - line.startTime || 1;
  const grid: string[][] = STRING_LABELS.map(() => Array(slots).fill('-'));

  for (const note of line.notes) {
    const rel = (note.startTime - line.startTime) / span;
    const col = Math.max(0, Math.min(slots - 1, Math.round(rel * (slots - 1))));
    const row = note.stringNumber - 1; // string 1 → row 0
    const tech = TECHNIQUE_SYMBOLS[note.technique];
    const token = `${note.fret}${tech}`;
    // Write token, expanding the column if needed.
    grid[row][col] = token;
  }

  // Equalise column widths so the rows line up.
  const widths = Array.from({ length: slots }, (_, c) =>
    Math.max(...grid.map((row) => row[c].length), 1),
  );
  return grid.map((row, i) => {
    const cells = row.map((cell, c) => cell.padEnd(widths[c], '-'));
    return `${STRING_LABELS[i]}|-${cells.join('-')}-|`;
  });
}

export function toPlainTextTab(project: Project): string {
  const lines: string[] = [];
  lines.push(`${project.title}${project.artist ? ` — ${project.artist}` : ''}`);
  lines.push(
    `Key: ${project.key}   Tempo: ${project.bpm} BPM   ` +
      `Time: ${project.timeSignature.beats}/${project.timeSignature.value}   ` +
      `Tuning: ${project.tuning.name} (${project.tuning.strings.join(' ')})`,
  );
  lines.push('Transcribed with RiffScribe');
  lines.push('');

  for (const section of project.sections) {
    lines.push(`[${(section.label ?? section.type).toUpperCase()}]  (${formatTime(section.startTime)})`);
    if (section.notes) lines.push(`# ${section.notes}`);

    // Chords spanning this section.
    const chordNames = project.chords
      .filter((c) => c.startTime >= section.startTime && c.startTime < section.endTime)
      .map((c) => c.chordName);
    if (chordNames.length) lines.push(chordNames.join('  '));

    const sectionLines = project.tabLines.filter(
      (l) => l.startTime >= section.startTime && l.startTime < section.endTime,
    );
    for (const tl of sectionLines) {
      lines.push(...renderTabLine(tl));
      lines.push('');
    }
    lines.push('');
  }

  lines.push('Legend: h=hammer-on  p=pull-off  /=slide  b=bend  ~=vibrato  x=mute');
  return lines.join('\n');
}

/**
 * Guitar-Pro-style text export. Guitar Pro's binary `.gp` format is
 * proprietary; this emits a readable structured text representation that
 * mirrors a GP session (track header + measures), suitable for import tools
 * that accept ASCII, and clearly extensible to a real `.gp5`/`.gpx` writer.
 */
export function toGuitarProText(project: Project): string {
  const out: string[] = [];
  out.push('// RiffScribe → Guitar Pro (text)');
  out.push(`TITLE "${project.title}"`);
  out.push(`ARTIST "${project.artist ?? ''}"`);
  out.push(`TEMPO ${project.bpm}`);
  out.push(`KEY "${project.key}"`);
  out.push(`TIMESIG ${project.timeSignature.beats}/${project.timeSignature.value}`);
  out.push(`TUNING ${project.tuning.strings.join(' ')}`);
  out.push('TRACK "Guitar" {');
  project.tabLines.forEach((line, i) => {
    out.push(`  MEASURE ${i + 1} {`);
    for (const note of line.notes.sort((a, b) => a.startTime - b.startTime)) {
      out.push(
        `    NOTE string=${note.stringNumber} fret=${note.fret} ` +
          `start=${note.startTime.toFixed(3)} dur=${note.duration.toFixed(3)} ` +
          `tech=${note.technique}`,
      );
    }
    out.push('  }');
  });
  out.push('}');
  return out.join('\n');
}

/** Trigger a browser download of a text file. */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
