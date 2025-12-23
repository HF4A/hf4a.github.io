/**
 * useScanCapture Hook
 *
 * Handles the SCAN capture flow:
 * 1. Capture static image from video
 * 2. Detect card quadrilaterals
 * 3. Identify cards using dHash matching
 * 4. Store in scan slot
 */

import { useCallback, useRef } from 'react';
import { useShowxatingStore, IdentifiedCard, CapturedScan } from '../store/showxatingStore';
import { detectCardQuadrilateral } from '../services/visionPipeline';
import { getCardMatcher } from '../services/cardMatcher';
import { useSettingsStore } from '../../../store/settingsStore';

interface UseScanCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function useScanCapture({ videoRef }: UseScanCaptureOptions) {
  const { isCapturing, setCapturing, addCapture } = useShowxatingStore();
  const { defaultScanResult } = useSettingsStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  const capture = useCallback(async () => {
    if (isCapturing || !videoRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('[useScanCapture] Video not ready');
      return;
    }

    setCapturing(true);

    try {
      const canvas = getCanvas();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Capture frame
      ctx.drawImage(video, 0, 0);

      // Convert to data URL for storage
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Get image data for detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Detect card quadrilateral
      const detection = detectCardQuadrilateral(imageData, canvas.width, canvas.height);

      const identifiedCards: IdentifiedCard[] = [];

      if (detection.found && detection.corners) {
        // Get bounding box from corners
        const minX = Math.min(...detection.corners.map((c) => c.x));
        const maxX = Math.max(...detection.corners.map((c) => c.x));
        const minY = Math.min(...detection.corners.map((c) => c.y));
        const maxY = Math.max(...detection.corners.map((c) => c.y));

        const region = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };

        // Identify the card
        const matcher = getCardMatcher();
        if (matcher.isLoaded()) {
          const matches = matcher.matchFromCanvas(canvas, region);
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
      console.log('[useScanCapture] Captured scan:', scan.id, 'cards:', identifiedCards.length);
    } catch (err) {
      console.error('[useScanCapture] Capture error:', err);
    } finally {
      setCapturing(false);
    }
  }, [isCapturing, videoRef, getCanvas, setCapturing, addCapture, defaultScanResult]);

  return {
    capture,
    isCapturing,
  };
}
