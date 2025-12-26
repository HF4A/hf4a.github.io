/**
 * OCR Service for card text extraction
 *
 * Extracts text from card images using local PP-OCRv4 via ONNX.
 * Provides detailed diagnostics for troubleshooting.
 *
 * v0.3.1: Switched from OCR.space API to local ONNX inference
 */

import { log } from '../../../store/logsStore';
import { loadOcrEngine, getOcrEngine, isOcrEngineReady } from './ocrEngine';

export interface OCRResult {
  fullText: string;           // All text extracted from full card
  typeText: string;           // Text from type region (top 15%)
  titleText: string;          // Text from title region (bottom 20%)
  confidence: number;         // Overall confidence 0-1
  timing: {
    fullMs: number;
    typeMs: number;
    titleMs: number;
    totalMs: number;
  };
  diagnostics: OCRDiagnostics;
}

export interface OCRDiagnostics {
  fullCard: OCRRegionDiagnostics;
  typeRegion: OCRRegionDiagnostics;
  titleRegion: OCRRegionDiagnostics;
  engineType: 'local';
}

export interface OCRRegionDiagnostics {
  inputSize: { width: number; height: number };
  imageKB: number;
  detectedLines: TextLineInfo[];
  error?: string;
}

interface TextLineInfo {
  text: string;
  score: number;  // Confidence (from 'mean' in OCR result)
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Convert OCR box (array of 4 corner points) to bounding rect
 * Box format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (4 corners, clockwise from top-left)
 */
function boxToRect(box: number[][] | undefined): { top: number; left: number; width: number; height: number } {
  if (!box || box.length < 4) {
    return { top: 0, left: 0, width: 0, height: 0 };
  }
  const xs = box.map(p => p[0]);
  const ys = box.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Region boundaries (as percentage of card height)
const TYPE_REGION_MAX_Y = 0.15;   // Top 15% of card
const TITLE_REGION_MIN_Y = 0.85;  // Bottom 15% of card (was 80%, tighter to avoid stats)

/**
 * Extract text from a card image using local OCR
 * Runs single OCR pass, then filters by region
 */
export async function extractCardText(
  cardCanvas: HTMLCanvasElement
): Promise<OCRResult> {
  const startTime = performance.now();
  const cardHeight = cardCanvas.height;
  const cardWidth = cardCanvas.width;

  const diagnostics: OCRDiagnostics = {
    fullCard: createEmptyDiagnostics(cardWidth, cardHeight),
    typeRegion: createEmptyDiagnostics(cardWidth, Math.round(cardHeight * TYPE_REGION_MAX_Y)),
    titleRegion: createEmptyDiagnostics(cardWidth, Math.round(cardHeight * (1 - TITLE_REGION_MIN_Y))),
    engineType: 'local',
  };

  log.debug(`[OCR] Starting local extraction from ${cardWidth}x${cardHeight} card image`);

  // Ensure OCR engine is loaded
  if (!isOcrEngineReady()) {
    log.debug('[OCR] Loading OCR engine...');
    await loadOcrEngine();
  }

  const ocr = getOcrEngine();

  // Convert canvas to data URL
  const dataUrl = cardCanvas.toDataURL('image/jpeg', 0.95);
  diagnostics.fullCard.imageKB = Math.round(dataUrl.length / 1024);

  // Run single OCR pass on full card
  const fullStart = performance.now();
  let allLines: TextLineInfo[] = [];

  try {
    const result = await ocr.detect(dataUrl);
    allLines = result.map(line => {
      const rect = boxToRect(line.box);
      return {
        text: line.text,
        score: line.mean,  // 'mean' is the confidence score
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    });
    diagnostics.fullCard.detectedLines = allLines;
  } catch (err) {
    diagnostics.fullCard.error = err instanceof Error ? err.message : String(err);
    log.error(`[OCR] Detection error: ${diagnostics.fullCard.error}`);
  }

  const fullMs = performance.now() - fullStart;

  // Extract full text (all lines)
  const fullText = allLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim();

  // Filter lines by region
  const typeStart = performance.now();
  const typeThreshold = cardHeight * TYPE_REGION_MAX_Y;
  const typeLines = allLines.filter(l => l.top + l.height / 2 < typeThreshold);
  const typeText = typeLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim();
  diagnostics.typeRegion.detectedLines = typeLines;
  const typeMs = performance.now() - typeStart;

  const titleStart = performance.now();
  const titleThreshold = cardHeight * TITLE_REGION_MIN_Y;
  const titleLines = allLines.filter(l => l.top + l.height / 2 > titleThreshold);
  const titleText = titleLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim();
  diagnostics.titleRegion.detectedLines = titleLines;
  const titleMs = performance.now() - titleStart;

  const totalMs = performance.now() - startTime;

  // Calculate overall confidence based on detected text and scores
  const avgScore = allLines.length > 0
    ? allLines.reduce((sum, l) => sum + l.score, 0) / allLines.length
    : 0;
  const hasFullText = fullText.length > 0;
  const hasTypeText = typeText.length > 0;
  const hasTitleText = titleText.length > 0;
  const confidence = avgScore * ((hasFullText ? 0.4 : 0) + (hasTypeText ? 0.3 : 0) + (hasTitleText ? 0.3 : 0));

  const result: OCRResult = {
    fullText,
    typeText,
    titleText,
    confidence,
    timing: { fullMs, typeMs, titleMs, totalMs },
    diagnostics,
  };

  log.info(`[OCR] Complete in ${totalMs.toFixed(0)}ms: type="${typeText}" title="${titleText}" (${allLines.length} lines, ${fullText.length} chars)`);

  return result;
}

/**
 * Create empty diagnostics object
 */
function createEmptyDiagnostics(width: number, height: number): OCRRegionDiagnostics {
  return {
    inputSize: { width, height },
    imageKB: 0,
    detectedLines: [],
  };
}

/**
 * Extract just the type text from a card (lightweight, single OCR call)
 * Used for quick type detection without full extraction
 */
export async function extractTypeText(
  cardCanvas: HTMLCanvasElement
): Promise<{ text: string; diagnostics: OCRRegionDiagnostics }> {
  const result = await extractCardText(cardCanvas);
  return {
    text: result.typeText,
    diagnostics: result.diagnostics.typeRegion,
  };
}

/**
 * Parse card type from OCR text
 * Handles variations: "Refinery", "REFINERY", "Refiner", etc.
 */
export function parseTypeFromText(text: string): string | null {
  if (!text) return null;

  const normalized = text.toLowerCase().trim();

  // Known card types and their variations
  const typePatterns: [RegExp, string][] = [
    [/refiner/i, 'refinery'],
    [/thrust/i, 'thruster'],
    [/gw.?thrust/i, 'gw-thruster'],
    [/reactor/i, 'reactor'],
    [/radiat/i, 'radiator'],
    [/robonaut/i, 'robonaut'],
    [/generat/i, 'generator'],
    [/crew/i, 'crew'],
    [/colon/i, 'colonist'],
    [/freighter/i, 'freighter'],
    [/bernal/i, 'bernal'],
    [/contract/i, 'contract'],
    [/spaceborn/i, 'spaceborn'],
  ];

  for (const [pattern, type] of typePatterns) {
    if (pattern.test(normalized)) {
      return type;
    }
  }

  return null;
}
