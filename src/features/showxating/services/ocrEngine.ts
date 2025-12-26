/**
 * OCR Engine - Local PP-OCRv4 via ONNX
 *
 * Lazy-loads the OCR engine with promise deduplication.
 * Uses @gutenye/ocr-browser for client-side text detection.
 *
 * v0.3.1: Replaces OCR.space API with local ONNX inference
 */

import Ocr from '@gutenye/ocr-browser';
import { log } from '../../../store/logsStore';

export type OcrEngineStatus = 'idle' | 'loading' | 'ready' | 'error';

type OcrInstance = Awaited<ReturnType<typeof Ocr.create>>;

interface OcrEngineState {
  status: OcrEngineStatus;
  error: string | null;
  loadPromise: Promise<void> | null;
  instance: OcrInstance | null;
}

const engine: OcrEngineState = {
  status: 'idle',
  error: null,
  loadPromise: null,
  instance: null,
};

/**
 * Load the OCR engine (lazy, with promise deduplication)
 * Follows same pattern as loadCardIndex() in textMatcher.ts
 */
export async function loadOcrEngine(): Promise<void> {
  if (engine.status === 'ready') return;
  if (engine.loadPromise) return engine.loadPromise;

  engine.status = 'loading';
  log.info('[OcrEngine] Loading PP-OCRv4 models...');

  engine.loadPromise = (async () => {
    try {
      const basePath = import.meta.env.BASE_URL;
      const startTime = performance.now();

      engine.instance = await Ocr.create({
        models: {
          detectionPath: `${basePath}models/ch_PP-OCRv4_det_infer.onnx`,
          recognitionPath: `${basePath}models/ch_PP-OCRv4_rec_infer.onnx`,
          dictionaryPath: `${basePath}models/ppocr_keys_v1.txt`,
        },
      });

      const loadTime = performance.now() - startTime;
      engine.status = 'ready';
      engine.error = null;
      log.info(`[OcrEngine] Models loaded in ${loadTime.toFixed(0)}ms`);
    } catch (err) {
      engine.status = 'error';
      engine.error = err instanceof Error ? err.message : String(err);
      engine.loadPromise = null; // Allow retry
      log.error(`[OcrEngine] Failed to load: ${engine.error}`);
      throw err;
    }
  })();

  return engine.loadPromise;
}

/**
 * Get the current OCR engine status
 */
export function getOcrEngineStatus(): OcrEngineStatus {
  return engine.status;
}

/**
 * Get the OCR engine error message (if any)
 */
export function getOcrEngineError(): string | null {
  return engine.error;
}

/**
 * Get the loaded OCR engine instance
 * Throws if engine is not ready
 */
export function getOcrEngine(): OcrInstance {
  if (engine.status !== 'ready' || !engine.instance) {
    throw new Error('OCR engine not loaded. Call loadOcrEngine() first.');
  }
  return engine.instance;
}

/**
 * Check if the OCR engine is ready to use
 */
export function isOcrEngineReady(): boolean {
  return engine.status === 'ready' && engine.instance !== null;
}
