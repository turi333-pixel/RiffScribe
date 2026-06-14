/** Compact top bar with optional back button and right-aligned actions. */
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, back, onBack, right }: HeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/5 bg-ink-900/85 px-3 py-3 backdrop-blur-lg">
      {back && (
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="-ml-1 rounded-lg p-1.5 text-zinc-300 hover:bg-white/5"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className="truncate font-display text-lg font-semibold uppercase tracking-wide text-zinc-100">
            {title}
          </h1>
        )}
        {subtitle && <p className="truncate text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </header>
  );
}

/** The wordmark used on the home screen. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-ember shadow-glow">
        <span className="font-display text-lg font-bold text-white">R</span>
      </div>
      <span className="font-display text-2xl font-bold uppercase tracking-tight">
        Riff<span className="text-ember">Scribe</span>
      </span>
    </div>
  );
}
