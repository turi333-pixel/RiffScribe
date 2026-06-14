/** Fixed bottom navigation — the primary way to move between the main areas. */
import { NavLink } from 'react-router-dom';
import { Home, Guitar, Library } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/tuner', label: 'Tuner', icon: Guitar, end: false },
  { to: '/library', label: 'Library', icon: Library, end: false },
];

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-white/5 bg-ink-900/90 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                isActive ? 'text-ember' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
