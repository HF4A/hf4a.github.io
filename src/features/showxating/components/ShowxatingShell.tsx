import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView, CameraViewHandle } from './CameraView';
import { CapturedScanView } from './CapturedScanView';
import { ScanActionBar } from './ScanActionBar';
import { TopNavBar } from '../../../components/TopNavBar';
import { SysPanel } from '../../../components/SysPanel';
import { useShowxatingStore } from '../store/showxatingStore';
import { useScanCapture } from '../hooks/useScanCapture';
import { useCardIdentification } from '../hooks/useCardIdentification';
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

  // Get videoRef from CameraView for capture
  const videoRef = useRef<HTMLVideoElement>(null);

  // Create a stable ref that points to the camera's video element
  const getVideoRef = () => {
    if (cameraViewRef.current?.videoRef?.current) {
      return { current: cameraViewRef.current.videoRef.current };
    }
    return videoRef;
  };

  const { capture, isCapturing } = useScanCapture({ videoRef: getVideoRef() });

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

  const canScan = cameraReady && isIndexLoaded && !isCapturing;

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
          <CapturedScanView slotId={activeSlot as 's1' | 's2' | 's3'} />
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
            {cameraPermission === 'denied'
              ? 'CAMERA ACCESS DENIED'
              : indexLoading
              ? 'LOADING CARD INDEX...'
              : !isIndexLoaded
              ? 'INDEX NOT READY'
              : activeSlot !== 'live'
              ? `VIEWING ${activeSlot.toUpperCase()}`
              : cameraReady
              ? `STATUS: ${detectionStatus.toUpperCase()}`
              : 'AWAITING CAMERA'}
          </span>
        </div>
      </footer>
    </div>
  );
}
