import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView, CameraViewHandle } from './CameraView';
import { CapturedScanView } from './CapturedScanView';
import { ScanActionBar } from './ScanActionBar';
import { TopNavBar } from '../../../components/TopNavBar';
import { SysPanel } from '../../../components/SysPanel';
import { useShowxatingStore } from '../store/showxatingStore';
import { useCardIdentification } from '../hooks/useCardIdentification';
import { useScanCapture } from '../hooks/useScanCapture';
import { authService } from '../../../services/authService';
import '../styles/belter-theme.css';

export function ShowxatingShell() {
  const navigate = useNavigate();
  const [showSysPanel, setShowSysPanel] = useState(false);
  const cameraViewRef = useRef<CameraViewHandle>(null);

  const {
    setMode,
    setActive,
    cameraPermission,
    cameraReady,
    detectionStatus,
    activeSlot,
    reset,
  } = useShowxatingStore();

  // Load card index for identification
  const { isIndexLoaded, isLoading: indexLoading } = useCardIdentification();

  // Cloud-based scan capture (with local fallback)
  const { capture, isCapturing } = useScanCapture({
    videoRef: cameraViewRef.current?.videoRef ?? { current: null },
  });

  // Check auth status for status line
  const isAuthenticated = authService.hasCredentials();

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

  // Can scan if camera ready, index loaded, and authenticated (or local fallback available)
  const canScan = cameraReady && isIndexLoaded && !isCapturing;

  // Status message
  const getStatusMessage = () => {
    if (cameraPermission === 'denied') return 'CAMERA ACCESS DENIED';
    if (indexLoading) return 'LOADING CARD INDEX...';
    if (!isIndexLoaded) return 'INDEX NOT READY';
    if (activeSlot !== 'live') return `VIEWING ${activeSlot.toUpperCase()}`;
    if (!cameraReady) return 'AWAITING CAMERA';
    if (isCapturing) return 'SCANNING...';
    if (!isAuthenticated) return 'OFFLINE MODE (LOCAL MATCHING)';
    return `STATUS: ${detectionStatus.toUpperCase()}`;
  };

  return (
    <div className="showxating-shell fixed inset-0 z-50 flex flex-col">
      {/* Top Navigation */}
      <TopNavBar onSysClick={() => setShowSysPanel(true)} />

      {/* SYS Panel */}
      <SysPanel isOpen={showSysPanel} onClose={() => setShowSysPanel(false)} />

      {/* Main view area */}
      <main className="flex-1 relative">
        {activeSlot === 'live' ? (
          <CameraView ref={cameraViewRef} />
        ) : (
          <CapturedScanView slotId={activeSlot as 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'} />
        )}
      </main>

      {/* Bottom action bar */}
      <footer className="px-4 py-4 bg-black/80 border-t border-[var(--showxating-gold-dim)]">
        <ScanActionBar
          onScan={capture}
          disabled={!canScan}
        />

        {/* Status line */}
        <div className="mt-3 text-center">
          <span className="hud-text hud-text-dim text-xs">
            {getStatusMessage()}
          </span>
        </div>
      </footer>
    </div>
  );
}
