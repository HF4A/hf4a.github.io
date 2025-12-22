import { useState, useCallback, useEffect } from 'react';

// OpenCV.js types (minimal)
declare global {
  interface Window {
    cv: typeof cv;
    Module: {
      onRuntimeInitialized: () => void;
    };
  }
  const cv: {
    Mat: new () => Mat;
    MatVector: new () => MatVector;
    Size: new (width: number, height: number) => Size;
    Point: new (x: number, y: number) => Point;
    Scalar: new (r: number, g: number, b: number, a?: number) => Scalar;
    matFromImageData: (imageData: ImageData) => Mat;
    cvtColor: (src: Mat, dst: Mat, code: number) => void;
    GaussianBlur: (src: Mat, dst: Mat, ksize: Size, sigmaX: number) => void;
    Canny: (src: Mat, dst: Mat, threshold1: number, threshold2: number) => void;
    findContours: (image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number) => void;
    approxPolyDP: (curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean) => void;
    arcLength: (curve: Mat, closed: boolean) => number;
    contourArea: (contour: Mat) => number;
    boundingRect: (contour: Mat) => Rect;
    isContourConvex: (contour: Mat) => boolean;
    COLOR_RGBA2GRAY: number;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;
  };
  interface Mat {
    delete: () => void;
    rows: number;
    cols: number;
    data: Uint8Array;
    data32S: Int32Array;
    intPtr: (row: number, col: number) => number;
    get: (i: number) => Mat;
  }
  interface MatVector {
    delete: () => void;
    size: () => number;
    get: (i: number) => Mat;
  }
  interface Size {}
  interface Point {}
  interface Scalar {}
  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
}

const OPENCV_CDN_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

interface UseOpenCVResult {
  ready: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useOpenCV(): UseOpenCVResult {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && window.cv && window.cv.Mat) {
      setReady(true);
    }
  }, []);

  const load = useCallback(async () => {
    // Already loaded
    if (window.cv && window.cv.Mat) {
      setReady(true);
      return;
    }

    // Already loading
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await new Promise<void>((resolve, reject) => {
        // Check if script already exists
        const existingScript = document.querySelector(`script[src="${OPENCV_CDN_URL}"]`);
        if (existingScript) {
          // Script exists, wait for cv to be ready
          const checkReady = setInterval(() => {
            if (window.cv && window.cv.Mat) {
              clearInterval(checkReady);
              resolve();
            }
          }, 100);

          // Timeout after 30 seconds
          setTimeout(() => {
            clearInterval(checkReady);
            reject(new Error('OpenCV.js load timeout'));
          }, 30000);
          return;
        }

        const script = document.createElement('script');
        script.src = OPENCV_CDN_URL;
        script.async = true;

        script.onload = () => {
          // OpenCV.js uses Module.onRuntimeInitialized
          if (window.Module) {
            window.Module.onRuntimeInitialized = () => {
              resolve();
            };
          } else {
            // Fallback: poll for cv to be ready
            const checkReady = setInterval(() => {
              if (window.cv && window.cv.Mat) {
                clearInterval(checkReady);
                resolve();
              }
            }, 100);

            setTimeout(() => {
              clearInterval(checkReady);
              reject(new Error('OpenCV.js initialization timeout'));
            }, 30000);
          }
        };

        script.onerror = () => {
          reject(new Error('Failed to load OpenCV.js from CDN'));
        };

        document.body.appendChild(script);
      });

      setReady(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading OpenCV.js';
      setError(message);
      console.error('OpenCV.js load error:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { ready, loading, error, load };
}
