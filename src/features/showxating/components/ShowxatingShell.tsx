import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CameraView } from './CameraView';
import { useShowxatingStore } from '../store/showxatingStore';
import '../styles/belter-theme.css';

export function ShowxatingShell() {
  const navigate = useNavigate();
  const {
    mode,
    setMode,
    setActive,
    cameraPermission,
    cameraReady,
    detectionStatus,
    reset,
  } = useShowxatingStore();

  // Use ref to avoid effect re-runs
  const resetRef = useRef(reset);
  resetRef.current = reset;

  // Activate scan mode by default - run only once on mount
  useEffect(() => {
    setMode('scan');
    setActive(true);

    return () => {
      resetRef.current();
    };
  }, []); // Empty deps - run once on mount

  // Handle escape key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="showxating-shell fixed inset-0 z-50 flex flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-[var(--showxating-gold-dim)]">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="hud-text hud-text-dim hover:text-[var(--showxating-gold)] transition-colors"
          >
            ← EXIT
          </Link>
          <h1 className="hud-text hud-text-glow text-lg">SHOWXATING</h1>
        </div>

        {/* Mode indicator */}
        <div className="flex items-center gap-4">
          <span className="hud-text hud-text-dim text-xs">
            {mode === 'scan' ? 'SCAN MODE' : mode === 'capture' ? 'CAPTURE MODE' : 'STANDBY'}
          </span>
          {cameraReady && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </header>

      {/* Main camera area */}
      <main className="flex-1 relative">
        <CameraView />
      </main>

      {/* Bottom controls */}
      <footer className="px-4 py-4 bg-black/80 border-t border-[var(--showxating-gold-dim)]">
        <div className="flex items-center justify-center gap-4">
          {/* Mode toggle buttons */}
          <button
            onClick={() => {
              setMode('scan');
              setActive(true);
            }}
            className={`showxating-btn ${mode === 'scan' ? 'showxating-btn-primary' : ''}`}
          >
            SCAN
          </button>
          <button
            onClick={() => {
              setMode('capture');
              setActive(true);
            }}
            className={`showxating-btn ${mode === 'capture' ? 'showxating-btn-primary' : ''}`}
            disabled
            title="Coming soon"
          >
            CAPTURE
          </button>
        </div>

        {/* Status line */}
        <div className="mt-3 text-center">
          <span className="hud-text hud-text-dim text-xs">
            {cameraPermission === 'denied'
              ? 'CAMERA ACCESS DENIED'
              : cameraReady
              ? `STATUS: ${detectionStatus.toUpperCase()}`
              : 'AWAITING CAMERA'}
          </span>
        </div>
      </footer>
    </div>
  );
}
