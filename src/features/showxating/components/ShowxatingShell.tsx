import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView } from './CameraView';
import { TopNavBar } from '../../../components/TopNavBar';
import { SysPanel } from '../../../components/SysPanel';
import { useShowxatingStore } from '../store/showxatingStore';
import '../styles/belter-theme.css';

export function ShowxatingShell() {
  const navigate = useNavigate();
  const [showSysPanel, setShowSysPanel] = useState(false);
  const {
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
        navigate('/catalog');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="showxating-shell fixed inset-0 z-50 flex flex-col">
      {/* Top Navigation */}
      <TopNavBar onSysClick={() => setShowSysPanel(true)} />

      {/* SYS Panel */}
      <SysPanel isOpen={showSysPanel} onClose={() => setShowSysPanel(false)} />

      {/* Main camera area */}
      <main className="flex-1 relative">
        <CameraView />
      </main>

      {/* Bottom controls - will be replaced with S3/S2/S1/SCAN ribbon later */}
      <footer className="px-4 py-4 bg-black/80 border-t border-[var(--showxating-gold-dim)]">
        <div className="flex items-center justify-center gap-4">
          {/* SCAN button placeholder */}
          <button
            className="showxating-btn showxating-btn-primary"
            disabled
            title="Coming in Phase 6"
          >
            SCAN
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
