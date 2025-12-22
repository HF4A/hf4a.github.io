import { useRef, useState, useCallback, useEffect } from 'react';
import { useShowxatingStore } from '../store/showxatingStore';

export interface CameraConfig {
  facingMode: 'environment' | 'user';
  width?: number;
  height?: number;
}

const DEFAULT_CONFIG: CameraConfig = {
  facingMode: 'environment',
  width: 1280,
  height: 720,
};

export function useCamera(config: Partial<CameraConfig> = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const facingModeRef = useRef(config.facingMode ?? DEFAULT_CONFIG.facingMode);

  const {
    cameraReady,
    cameraError,
    setCameraReady,
    setCameraError,
    setCameraPermission,
  } = useShowxatingStore();

  const start = useCallback(async () => {
    // Use ref to prevent race conditions
    if (streamRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    setIsStarting(true);
    setCameraError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingModeRef.current,
          width: { ideal: config.width ?? DEFAULT_CONFIG.width },
          height: { ideal: config.height ?? DEFAULT_CONFIG.height },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraPermission('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          video.onloadedmetadata = () => {
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          video.onerror = () => reject(new Error('Video element error'));
        });

        setCameraReady(true);
      }
    } catch (err) {
      const error = err as Error;

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setCameraPermission('denied');
        setCameraError('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError('Camera is in use by another application.');
      } else {
        setCameraError(`Camera error: ${error.message}`);
      }

      console.error('Camera error:', error);
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }, [config.width, config.height, setCameraError, setCameraPermission, setCameraReady]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, [setCameraReady]);

  const switchCamera = useCallback(async () => {
    facingModeRef.current = facingModeRef.current === 'environment' ? 'user' : 'environment';
    stop();
    await start();
  }, [start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    stream: streamRef.current,
    isStarting,
    cameraReady,
    cameraError,
    start,
    stop,
    switchCamera,
  };
}
