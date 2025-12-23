import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraView, CameraViewHandle } from './CameraView';
import { CapturedScanView } from './CapturedScanView';
import { ScanActionBar } from './ScanActionBar';
import { TopNavBar } from '../../../components/TopNavBar';
import { SysPanel } from '../../../components/SysPanel';
import { useShowxatingStore, IdentifiedCard, CapturedScan } from '../store/showxatingStore';
import { useCardIdentification } from '../hooks/useCardIdentification';
import {
  detectFrameSkew,
  warpFullFrame,
  detectCardsInCorrectedFrame,
  cropCardFromCanvas,
} from '../services/visionPipeline';
import { extractCardText } from '../services/ocrService';
import { fuseMatches, quickHashMatch } from '../services/matchFusion';
import { useSettingsStore } from '../../../store/settingsStore';
import { log } from '../../../store/logsStore';
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
  // v0.3.0 pipeline: warp-then-detect, OCR-primary matching
  const capture = useCallback(async () => {
    const video = cameraViewRef.current?.videoRef?.current;
    if (isCapturing || !video) {
      log.warn('[Capture] Cannot capture - video not ready or already capturing');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      log.warn('[Capture] Video dimensions not ready');
      return;
    }

    setIsCapturing(true);
    const captureStart = performance.now();
    log.info('[Capture] Starting v0.3.0 pipeline...');

    try {
      // Phase A1: Capture frame at full resolution
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      const canvas = captureCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(video, 0, 0);
      log.debug(`[Capture] Frame captured: ${canvas.width}x${canvas.height}`);

      // Convert to data URL for storage (95% quality for OCR)
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      // Phase A2: Detect frame skew
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const skewAnalysis = detectFrameSkew(imageData, canvas.width, canvas.height);
      log.debug(`[Capture] Skew analysis: ${skewAnalysis.angle.toFixed(1)}° (hasSkew: ${skewAnalysis.hasSkew})`);

      // Phase A3: Apply perspective correction if needed
      const { canvas: correctedCanvas } = warpFullFrame(canvas, skewAnalysis);

      // Phase A4: Detect cards in corrected frame
      const correctedCtx = correctedCanvas.getContext('2d');
      if (!correctedCtx) throw new Error('Could not get corrected canvas context');
      const correctedImageData = correctedCtx.getImageData(0, 0, correctedCanvas.width, correctedCanvas.height);
      const detectedCards = detectCardsInCorrectedFrame(correctedImageData, correctedCanvas.width, correctedCanvas.height);
      log.info(`[Capture] Detected ${detectedCards.length} cards in corrected frame`);

      const identifiedCards: IdentifiedCard[] = [];

      // Phase B: Process each detected card
      for (let i = 0; i < detectedCards.length; i++) {
        const card = detectedCards[i];
        if (!card.corners) continue;

        const cardStart = performance.now();
        log.debug(`[Capture] Processing card ${i + 1}/${detectedCards.length}`);

        // Get bounding box from corners (for diagnostics)
        const minX = Math.min(...card.corners.map((c) => c.x));
        const maxX = Math.max(...card.corners.map((c) => c.x));
        const minY = Math.min(...card.corners.map((c) => c.y));
        const maxY = Math.max(...card.corners.map((c) => c.y));
        const region = {
          x: Math.max(0, minX),
          y: Math.max(0, minY),
          width: Math.min(correctedCanvas.width - minX, maxX - minX),
          height: Math.min(correctedCanvas.height - minY, maxY - minY),
        };

        // Phase B1: Crop and warp card to high-res rectangle
        const cardCanvas = cropCardFromCanvas(correctedCanvas, card.corners);
        if (!cardCanvas) {
          log.warn(`[Capture] Failed to crop card ${i + 1}`);
          identifiedCards.push({
            cardId: 'unknown',
            filename: '',
            side: null,
            confidence: 0,
            corners: card.corners,
            showingOpposite: defaultScanResult === 'opposite',
            boundingBox: region,
          });
          continue;
        }

        // Phase B2: Extract text via OCR
        const ocrResult = await extractCardText(cardCanvas);
        log.debug(`[Capture] OCR result: type="${ocrResult.typeText}" title="${ocrResult.titleText}" (${ocrResult.timing.totalMs.toFixed(0)}ms)`);

        // Phase B3: Fuse text + hash matching
        const fusedMatch = await fuseMatches(ocrResult, cardCanvas);

        if (fusedMatch) {
          log.info(`[Capture] Card ${i + 1} matched: ${fusedMatch.cardId} (${fusedMatch.matchSource}, fused: ${fusedMatch.fusedScore.toFixed(3)})`);
          identifiedCards.push({
            cardId: fusedMatch.cardId,
            filename: fusedMatch.filename,
            side: fusedMatch.side,
            confidence: 1 - fusedMatch.fusedScore, // Convert score to confidence
            corners: card.corners,
            showingOpposite: defaultScanResult === 'opposite',
            boundingBox: region,
            ocrResult: {
              fullText: ocrResult.fullText,
              typeText: ocrResult.typeText,
              titleText: ocrResult.titleText,
              confidence: ocrResult.confidence,
              timing: ocrResult.timing,
            },
            matchSource: fusedMatch.matchSource,
            textScore: fusedMatch.textScore,
            hashScore: fusedMatch.hashScore,
            fusedScore: fusedMatch.fusedScore,
            topMatches: fusedMatch.diagnostics.hashMatches.slice(0, 5).map(h => ({
              cardId: h.cardId,
              distance: h.distance,
            })),
          });
        } else {
          // Try hash-only fallback
          const hashMatch = await quickHashMatch(cardCanvas);
          if (hashMatch) {
            log.info(`[Capture] Card ${i + 1} hash-only match: ${hashMatch.cardId} (distance: ${hashMatch.distance})`);
            identifiedCards.push({
              cardId: hashMatch.cardId,
              filename: hashMatch.filename,
              side: hashMatch.side,
              confidence: 1 - hashMatch.normalizedScore,
              corners: card.corners,
              showingOpposite: defaultScanResult === 'opposite',
              boundingBox: region,
              ocrResult: {
                fullText: ocrResult.fullText,
                typeText: ocrResult.typeText,
                titleText: ocrResult.titleText,
                confidence: ocrResult.confidence,
                timing: ocrResult.timing,
              },
              matchSource: 'hash',
              hashScore: hashMatch.normalizedScore,
              matchDistance: hashMatch.distance,
            });
          } else {
            log.warn(`[Capture] Card ${i + 1} not identified`);
            identifiedCards.push({
              cardId: 'unknown',
              filename: '',
              side: null,
              confidence: 0,
              corners: card.corners,
              showingOpposite: defaultScanResult === 'opposite',
              boundingBox: region,
              ocrResult: {
                fullText: ocrResult.fullText,
                typeText: ocrResult.typeText,
                titleText: ocrResult.titleText,
                confidence: ocrResult.confidence,
                timing: ocrResult.timing,
              },
            });
          }
        }

        const cardMs = performance.now() - cardStart;
        log.debug(`[Capture] Card ${i + 1} processed in ${cardMs.toFixed(0)}ms`);
      }

      const totalMs = performance.now() - captureStart;
      log.info(`[Capture] Complete: ${identifiedCards.length} cards in ${totalMs.toFixed(0)}ms`);

      // Create scan record
      const scan: CapturedScan = {
        id: `scan-${Date.now()}`,
        timestamp: Date.now(),
        imageDataUrl,
        cards: identifiedCards,
      };

      addCapture(scan);
    } catch (err) {
      log.error(`[Capture] Error: ${err instanceof Error ? err.message : String(err)}`);
      console.error('[Capture] Full error:', err);
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
