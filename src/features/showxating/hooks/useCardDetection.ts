import { useRef, useCallback, useEffect } from 'react';
import { useShowxatingStore } from '../store/showxatingStore';
import { useOpenCV } from './useOpenCV';
import { detectCardQuadrilateral, DetectionResult } from '../services/visionPipeline';

const TARGET_FPS = 15;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const STABLE_FRAMES_REQUIRED = 3; // Require 3 consecutive detections before "locked"

interface UseCardDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled?: boolean;
}

export function useCardDetection({ videoRef, enabled = true }: UseCardDetectionOptions) {
  const { ready: opencvReady, loading: opencvLoading, error: opencvError, load: loadOpenCV } = useOpenCV();

  const {
    cameraReady,
    setDetection,
    clearDetection,
    setDetectionStatus,
    overlayFrozen,
  } = useShowxatingStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const stableDetectionCountRef = useRef<number>(0);
  const lastDetectionRef = useRef<DetectionResult | null>(null);

  // Use refs to avoid stale closures in processFrame
  const cameraReadyRef = useRef(cameraReady);
  const opencvReadyRef = useRef(opencvReady);
  const overlayFrozenRef = useRef(overlayFrozen);
  cameraReadyRef.current = cameraReady;
  opencvReadyRef.current = opencvReady;
  overlayFrozenRef.current = overlayFrozen;

  // Create offscreen canvas for frame capture
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  // Process a single frame
  const processFrame = useCallback(() => {
    // Use refs to get current values (avoid stale closures)
    if (!videoRef.current || !cameraReadyRef.current || !opencvReadyRef.current || overlayFrozenRef.current) {
      console.log('[Detection] processFrame early return:', {
        hasVideo: !!videoRef.current,
        cameraReady: cameraReadyRef.current,
        opencvReady: opencvReadyRef.current,
        overlayFrozen: overlayFrozenRef.current,
      });
      return;
    }

    // Processing frame (removed log to reduce noise)

    const video = videoRef.current;
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Resize canvas to match video (use lower resolution for performance)
    const scale = 0.5; // Process at half resolution
    const width = Math.floor(video.videoWidth * scale);
    const height = Math.floor(video.videoHeight * scale);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Get image data
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
      console.error('[Detection] Failed to get image data:', e);
      return;
    }

    // Run detection
    let result;
    try {
      result = detectCardQuadrilateral(imageData, width, height);
    } catch (e) {
      console.error('[Detection] Detection error:', e);
      return;
    }

    // Log detection results only when found
    if (result.found) {
      console.log('[Detection] FOUND:', { confidence: result.confidence?.toFixed(2), area: result.area, corners: result.corners });
    }

    // Scale corners back to full resolution
    if (result.corners) {
      result.corners = result.corners.map(p => ({
        x: p.x / scale,
        y: p.y / scale,
      }));
    }

    // Update detection stability
    if (result.found) {
      // Check if this detection is similar to the last one (stable)
      if (isStableDetection(result, lastDetectionRef.current)) {
        stableDetectionCountRef.current++;
      } else {
        stableDetectionCountRef.current = 1;
      }

      lastDetectionRef.current = result;

      // Update store based on stability
      if (stableDetectionCountRef.current >= STABLE_FRAMES_REQUIRED) {
        console.log('[Detection] Setting LOCKED state with corners:', result.corners);
        setDetection(result.corners, null, result.confidence);
        setDetectionStatus('locked');
      } else {
        console.log('[Detection] Setting TRACKING state with corners:', result.corners);
        setDetection(result.corners, null, result.confidence * 0.5);
        setDetectionStatus('tracking');
      }
    } else {
      // No detection
      if (stableDetectionCountRef.current > 0) {
        stableDetectionCountRef.current = 0;
        setDetectionStatus('lost');
        // Keep last detection visible briefly
        setTimeout(() => {
          if (stableDetectionCountRef.current === 0) {
            clearDetection();
            setDetectionStatus('searching');
          }
        }, 500);
      }
    }
  }, [videoRef, getCanvas, setDetection, clearDetection, setDetectionStatus]);

  // Main detection loop - use ref to avoid stale closure
  const processFrameRef = useRef(processFrame);
  processFrameRef.current = processFrame;

  const loopCountRef = useRef(0);

  const runDetectionLoop = useCallback(() => {
    loopCountRef.current++;
    if (loopCountRef.current === 1) {
      console.log('[Detection] Loop running, first iteration');
    }

    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    if (elapsed >= FRAME_INTERVAL) {
      if (loopCountRef.current <= 3) {
        console.log('[Detection] Calling processFrame, iteration:', loopCountRef.current);
      }
      lastFrameTimeRef.current = now - (elapsed % FRAME_INTERVAL);
      processFrameRef.current();
    }

    animationFrameRef.current = requestAnimationFrame(runDetectionLoop);
  }, []);

  // Start/stop detection loop
  useEffect(() => {
    console.log('[Detection] Effect running:', { enabled, cameraReady, opencvReady, opencvLoading, opencvError });

    if (!enabled || !cameraReady) {
      console.log('[Detection] Not enabled or camera not ready');
      return;
    }

    // Load OpenCV if not ready
    if (!opencvReady && !opencvLoading && !opencvError) {
      console.log('[Detection] Loading OpenCV...');
      loadOpenCV();
      return;
    }

    if (!opencvReady) {
      console.log('[Detection] Waiting for OpenCV...');
      return;
    }

    console.log('[Detection] Starting detection loop');

    // Start the loop directly - runDetectionLoop is stable (no deps)
    animationFrameRef.current = requestAnimationFrame(runDetectionLoop);

    return () => {
      console.log('[Detection] Stopping detection loop');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, cameraReady, opencvReady, opencvLoading, opencvError, loadOpenCV, runDetectionLoop]);

  return {
    opencvReady,
    opencvLoading,
    opencvError,
  };
}

/**
 * Check if two detections are similar (stable detection)
 */
function isStableDetection(current: DetectionResult, previous: DetectionResult | null): boolean {
  if (!previous || !previous.corners || !current.corners) {
    return false;
  }

  // Check if corners are within threshold distance
  const threshold = 20; // pixels
  for (let i = 0; i < 4; i++) {
    const dx = current.corners[i].x - previous.corners[i].x;
    const dy = current.corners[i].y - previous.corners[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > threshold) {
      return false;
    }
  }

  return true;
}
