/**
 * App — routing + the mobile app shell. Uses a hash router so shareable links
 * (and static hosting) work without server-side route config. The bottom nav
 * is shown on the primary screens and hidden on focused flows (analyse,
 * transcription, shared) where the screen owns the full viewport.
 */
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { HomeScreen } from '@/screens/HomeScreen';
import { AnalyzeScreen } from '@/screens/AnalyzeScreen';
import { TranscriptionScreen } from '@/screens/TranscriptionScreen';
import { TunerScreen } from '@/screens/TunerScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { SharedScreen } from '@/screens/SharedScreen';

const FULLSCREEN_ROUTES = ['/analyze', '/project/', '/shared/'];

function Shell() {
  const location = useLocation();
  const hideNav = FULLSCREEN_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="app-shell amp-bg">
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/analyze" element={<AnalyzeScreen />} />
          <Route path="/project/:id" element={<TranscriptionScreen />} />
          <Route path="/tuner" element={<TunerScreen />} />
          <Route path="/library" element={<DashboardScreen />} />
          <Route path="/shared/:payload" element={<SharedScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
