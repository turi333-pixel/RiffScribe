/**
 * PDF export via jsPDF. Renders a clean, printable lead sheet: header metadata,
 * then per-section chords and monospaced ASCII tab.
 */
import type { Project } from '@/types';
import { toPlainTextTab } from './text';

export async function exportPdf(project: Project): Promise<void> {
  // Lazy-load jsPDF (pulls in html2canvas) so it only ships when used.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 12;

  const addLine = (text: string, opts: { bold?: boolean; size?: number; color?: number[] } = {}) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont(opts.bold ? 'courier' : 'courier', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size ?? 9);
    if (opts.color) doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
    else doc.setTextColor(20, 20, 20);
    doc.text(text, margin, y);
    y += lineHeight;
  };

  // Title block.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(project.title, margin, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${project.artist ? project.artist + '  •  ' : ''}${project.key}  •  ${project.bpm} BPM  •  ` +
      `${project.timeSignature.beats}/${project.timeSignature.value}  •  ${project.tuning.name}`,
    margin,
    y,
  );
  y += 24;

  // Body: reuse the ASCII tab renderer for fidelity with on-screen tab.
  const body = toPlainTextTab(project).split('\n');
  // Skip the first three header lines we've already drawn nicely.
  for (const line of body.slice(4)) {
    const isSection = /^\[.*\]/.test(line);
    addLine(line, isSection ? { bold: true, size: 10, color: [200, 60, 20] } : {});
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Transcribed with RiffScribe', margin, pageHeight - 20);

  doc.save(`${project.title.replace(/\s+/g, '_')}.pdf`);
}
