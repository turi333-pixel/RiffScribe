/** A mobile bottom-sheet modal with a backdrop and drag affordance. */
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md animate-slide-up rounded-t-3xl border-t border-white/10 bg-ink-850 p-5 pb-8 shadow-card">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wide">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
