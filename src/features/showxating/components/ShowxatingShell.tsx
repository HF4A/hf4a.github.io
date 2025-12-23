import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView, CameraViewHandle } from './CameraView';
import { CapturedScanView } from './CapturedScanView';
import { ScanActionBar } from './ScanActionBar';
import { TopNavBar } from '../../../components/TopNavBar';
import { SysPanel } from '../../../components/SysPanel';
import { useShowxatingStore, IdentifiedCard, CapturedScan } from '../store/showxatingStore';
import { useCardIdentification } from '../hooks/useCardIdentification';
import { detectCardQuadrilateral } from '../services/visionPipeline';
import { getCardMatcher } from '../services/cardMatcher';
import { useSettingsStore } from '../../../store/settingsStore';
import '../styles/belter-theme.css';

export function ShowxatingShell() {
  const navigate = useNavigate();
  const [showSysPanel, setShowSysPanel] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraViewRef = useRef<CameraViewHandle>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    setMode,
    setActive,
    cameraPermission,
    cameraReady,
    detectionStatus,
    activeSlot,
    addCapture,
    reset,
  } = useShowxatingStore();

  const { defaultScanResult } = useSettingsStore();

  // Load card index for identification
  const { isIndexLoaded, isLoading: indexLoading } = useCardIdentification();

  // Direct capture function that accesses videoRef at call time
  const capture = useCallback(async () => {
    const video = cameraViewRef.current?.videoRef?.current;
    if (isCapturing || !video) {
      console.warn('[ShowxatingShell] Cannot capture - video not ready or already capturing');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('[ShowxatingShell] Video dimensions not ready');
      return;
    }

    setIsCapturing(true);
    console.log('[ShowxatingShell] Starting capture...');

    try {
      // Get or create canvas
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      const canvas = captureCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Capture frame
      ctx.drawImage(video, 0, 0);
      console.log('[ShowxatingShell] Frame captured:', canvas.width, 'x', canvas.height);

      // Convert to data URL for storage
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Get image data for detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect card quadrilateral
      const detection = detectCardQuadrilateral(imageData, canvas.width, canvas.height);
      console.log('[ShowxatingShell] Detection result:', detection);

      const identifiedCards: IdentifiedCard[] = [];

      if (detection.found && detection.corners) {
        // Get bounding box from corners
        const minX = Math.min(...detection.corners.map((c) => c.x));
        const maxX = Math.max(...detection.corners.map((c) => c.x));
        const minY = Math.min(...detection.corners.map((c) => c.y));
        const maxY = Math.max(...detection.corners.map((c) => c.y));

        const region = {
          x: Math.max(0, minX),
          y: Math.max(0, minY),
          width: Math.min(canvas.width - minX, maxX - minX),
          height: Math.min(canvas.height - minY, maxY - minY),
        };
        console.log('[ShowxatingShell] Card region:', region);

        // Identify the card
        const matcher = getCardMatcher();
        console.log('[ShowxatingShell] Matcher loaded:', matcher.isLoaded(), 'Index size:', matcher.getIndexSize());

        if (matcher.isLoaded()) {
          const matches = matcher.matchFromCanvas(canvas, region);
          console.log('[ShowxatingShell] Matches found:', matches.length, matches.slice(0, 3));

          if (matches.length > 0) {
            const match = matches[0];
            identifiedCards.push({
              cardId: match.cardId,
              filename: match.filename,
              side: match.side,
              confidence: match.confidence,
              corners: detection.corners,
              showingOpposite: defaultScanResult === 'opposite',
            });
          } else {
            // Card detected but not identified
            identifiedCards.push({
              cardId: 'unknown',
              filename: '',
              side: null,
              confidence: 0,
              corners: detection.corners,
              showingOpposite: defaultScanResult === 'opposite',
            });
          }
        } else {
          console.warn('[ShowxatingShell] Matcher not loaded!');
        }
      }

      // Create scan record
      const scan: CapturedScan = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        imageDataUrl,
        cards: identifiedCards,
      };

      addCapture(scan);
      console.log('[ShowxatingShell] Captured scan:', scan.id, 'cards:', identifiedCards.length);
    } catch (err) {
      console.error('[ShowxatingShell] Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, addCapture, defaultScanResult]);

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
