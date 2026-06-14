/** Export & share: PDF, Guitar-Pro text, plain-text tab, and a share link. */
import { useState } from 'react';
import { FileText, FileCode2, FileType, Link2, Check, Save } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import type { Project } from '@/types';
import { exportPdf } from '@/export/pdf';
import { toGuitarProText, toPlainTextTab, downloadText } from '@/export/text';
import { buildShareLink } from '@/lib/storage';

interface ExportSheetProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  onSaveVersion: () => void;
}

export function ExportSheet({ open, project, onClose, onSaveVersion }: ExportSheetProps) {
  const [copied, setCopied] = useState(false);
  const slug = project.title.replace(/\s+/g, '_');

  const copyShare = async () => {
    const link = buildShareLink(project);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this share link:', link);
    }
  };

  const rows = [
    { icon: FileText, label: 'Export PDF', sub: 'Printable lead sheet', action: () => void exportPdf(project) },
    {
      icon: FileCode2,
      label: 'Guitar Pro (text)',
      sub: 'Structured GP-style export',
      action: () => downloadText(`${slug}.gp.txt`, toGuitarProText(project)),
    },
    {
      icon: FileType,
      label: 'Plain text tab',
      sub: 'ASCII tablature',
      action: () => downloadText(`${slug}.txt`, toPlainTextTab(project)),
    },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Export & share">
      <div className="space-y-2">
        {rows.map((r) => (
          <button
            key={r.label}
            onClick={r.action}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-ink-800/60 px-4 py-3 text-left hover:bg-ink-750"
          >
            <r.icon size={22} className="text-ember" />
            <div className="flex-1">
              <div className="font-semibold">{r.label}</div>
              <div className="text-xs text-zinc-400">{r.sub}</div>
            </div>
          </button>
        ))}

        <button
          onClick={copyShare}
          className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-ink-800/60 px-4 py-3 text-left hover:bg-ink-750"
        >
          {copied ? <Check size={22} className="text-signal-green" /> : <Link2 size={22} className="text-amp-400" />}
          <div className="flex-1">
            <div className="font-semibold">{copied ? 'Link copied!' : 'Copy share link'}</div>
            <div className="text-xs text-zinc-400">Self-contained transcription URL</div>
          </div>
        </button>

        <button
          onClick={() => {
            onSaveVersion();
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-ink-800/60 px-4 py-3 text-left hover:bg-ink-750"
        >
          <Save size={22} className="text-zinc-200" />
          <div className="flex-1">
            <div className="font-semibold">Save a version</div>
            <div className="text-xs text-zinc-400">Snapshot the current transcription</div>
          </div>
        </button>
      </div>
    </Sheet>
  );
}
