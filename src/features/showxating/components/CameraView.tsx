import { useEffect, useState, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useCardDetection } from '../hooks/useCardDetection';
import { HudOverlay } from './HudOverlay';
import { useShowxatingStore } from '../store/showxatingStore';

export function CameraView() {
  const { videoRef, cameraReady, cameraError, isStarting, start, stop } = useCamera();
  const { isActive, mode } = useShowxatingStore();

  // Track video dimensions for HUD
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });

  // Card detection (only in scan mode)
  const { opencvLoading } = useCardDetection({
    videoRef,
    enabled: mode === 'scan' && cameraReady,
  });

  // Use refs to avoid effect re-runs from function identity changes
  const startRef = useRef(start);
  const stopRef = useRef(stop);
  startRef.current = start;
  stopRef.current = stop;

  // Start camera when component mounts and mode is active
  useEffect(() => {
    if (isActive) {
      startRef.current();
    }
    return () => {
      stopRef.current();
    };
  }, [isActive]);

  // Update dimensions when video loads
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoWidth = videoRef.current.videoWidth || 1280;
      const videoHeight = videoRef.current.videoHeight || 720;
      setVideoDimensions({ width: videoWidth, height: videoHeight });
      setDimensions({ width: videoWidth, height: videoHeight });
    }
  };

  // Track container size for proper HUD scaling
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Video feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* HUD overlay */}
      {cameraReady && (
        <HudOverlay
          width={dimensions.width}
          height={dimensions.height}
          videoWidth={videoDimensions.width}
          videoHeight={videoDimensions.height}
        />
      )}

      {/* Scanline effect */}
      {cameraReady && <div className="scanline-overlay" />}

      {/* OpenCV loading indicator */}
      {cameraReady && opencvLoading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded">
          <div className="hud-text hud-text-dim text-sm">LOADING VISION...</div>
        </div>
      )}

      {/* Loading state */}
      {isStarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="hud-text hud-text-glow text-lg mb-2">INITIALIZING</div>
            <div className="hud-text hud-text-dim text-sm">Requesting camera access...</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center max-w-sm px-4">
            <div className="hud-text text-red-500 text-lg mb-2">ERROR</div>
            <div className="text-gray-300 text-sm mb-4">{cameraError}</div>
            <button
              onClick={start}
              className="showxating-btn"
            >
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* Not active state */}
      {!isActive && !isStarting && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="hud-text hud-text-dim">CAMERA STANDBY</div>
        </div>
      )}
    </div>
  );
}
