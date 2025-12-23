/**
 * OCR Service for card text extraction
 *
 * Extracts text from card images using OCR.space API.
 * Provides detailed diagnostics for troubleshooting.
 *
 * v0.3.0: Full card OCR with type/title region extraction
 */

import { log } from '../../../store/logsStore';

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
}

export interface OCRRegionDiagnostics {
  inputSize: { width: number; height: number };
  imageKB: number;
  apiResponse: unknown;
  error?: string;
}

// OCR region definitions (as percentage of card dimensions)
const OCR_REGIONS = {
  // Full card - no cropping
  full: { x: 0, y: 0, w: 100, h: 100 },
  // Type region - top banner where "Refinery", "Thruster" etc. appears
  type: { x: 0, y: 0, w: 100, h: 15 },
  // Title region - bottom where card name appears
  title: { x: 0, y: 80, w: 100, h: 20 },
};

/**
 * Extract text from a card image using OCR
 * Runs three extractions: full card, type region, title region
 */
export async function extractCardText(
  cardCanvas: HTMLCanvasElement
): Promise<OCRResult> {
  const startTime = performance.now();
  const diagnostics: OCRDiagnostics = {
    fullCard: createEmptyDiagnostics(),
    typeRegion: createEmptyDiagnostics(),
    titleRegion: createEmptyDiagnostics(),
  };

  log.debug(`[OCR] Starting extraction from ${cardCanvas.width}x${cardCanvas.height} card image`);

  // Run all three OCR extractions
  // Note: Running in sequence to avoid rate limiting, but could be parallelized
  const fullStart = performance.now();
  const fullResult = await runOCROnRegion(cardCanvas, OCR_REGIONS.full, diagnostics.fullCard);
  const fullMs = performance.now() - fullStart;

  const typeStart = performance.now();
  const typeResult = await runOCROnRegion(cardCanvas, OCR_REGIONS.type, diagnostics.typeRegion);
  const typeMs = performance.now() - typeStart;

  const titleStart = performance.now();
  const titleResult = await runOCROnRegion(cardCanvas, OCR_REGIONS.title, diagnostics.titleRegion);
  const titleMs = performance.now() - titleStart;

  const totalMs = performance.now() - startTime;

  // Calculate overall confidence
  const hasFullText = fullResult.length > 0;
  const hasTypeText = typeResult.length > 0;
  const hasTitleText = titleResult.length > 0;
  const confidence = (hasFullText ? 0.4 : 0) + (hasTypeText ? 0.3 : 0) + (hasTitleText ? 0.3 : 0);

  const result: OCRResult = {
    fullText: fullResult,
    typeText: typeResult,
    titleText: titleResult,
    confidence,
    timing: { fullMs, typeMs, titleMs, totalMs },
    diagnostics,
  };

  log.info(`[OCR] Complete in ${totalMs.toFixed(0)}ms: type="${typeResult}" title="${titleResult}" (${fullResult.length} chars total)`);

  return result;
}

/**
 * Run OCR on a specific region of the card
 */
async function runOCROnRegion(
  cardCanvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  diagnostics: OCRRegionDiagnostics
): Promise<string> {
  try {
    // Calculate pixel coordinates
    const x = Math.round((region.x / 100) * cardCanvas.width);
    const y = Math.round((region.y / 100) * cardCanvas.height);
    const w = Math.round((region.w / 100) * cardCanvas.width);
    const h = Math.round((region.h / 100) * cardCanvas.height);

    // Create canvas for this region
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = w;
    regionCanvas.height = h;
    const ctx = regionCanvas.getContext('2d');

    if (!ctx) {
      diagnostics.error = 'Failed to create canvas context';
      return '';
    }

    // Draw the region (no downscaling - preserve full resolution)
    ctx.drawImage(cardCanvas, x, y, w, h, 0, 0, w, h);

    diagnostics.inputSize = { width: w, height: h };

    // Convert to high-quality JPEG
    const dataUrl = regionCanvas.toDataURL('image/jpeg', 0.95);
    diagnostics.imageKB = Math.round(dataUrl.length / 1024);

    log.debug(`[OCR] Region ${w}x${h}px, ${diagnostics.imageKB}KB`);

    // Call OCR.space API
    const text = await callOCRSpace(dataUrl, diagnostics);
    return text;
  } catch (err) {
    diagnostics.error = err instanceof Error ? err.message : String(err);
    log.error(`[OCR] Region extraction error: ${diagnostics.error}`);
    return '';
  }
}

/**
 * Call OCR.space API
 */
async function callOCRSpace(
  dataUrl: string,
  diagnostics: OCRRegionDiagnostics
): Promise<string> {
  const formData = new FormData();
  formData.append('base64Image', dataUrl);
  formData.append('language', 'eng');
  formData.append('OCREngine', '2');  // Engine 2 better for photos/screenshots
  formData.append('scale', 'true');   // Let OCR.space scale if needed

  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': 'helloworld', // Free demo key
      },
      body: formData,
    });

    const result = await response.json();
    diagnostics.apiResponse = result;

    if (result.ParsedResults && result.ParsedResults.length > 0) {
      const parsed = result.ParsedResults[0];
      const text = parsed.ParsedText || '';
      // Clean up the text: normalize whitespace, trim
      return text.replace(/\s+/g, ' ').trim();
    }

    if (result.IsErroredOnProcessing) {
      const errorMsg = result.ErrorMessage?.[0] || 'Processing error';
      diagnostics.error = errorMsg;
      log.error(`[OCR] OCR.space error: ${errorMsg}`);
    }

    return '';
  } catch (err) {
    diagnostics.error = err instanceof Error ? err.message : String(err);
    log.error(`[OCR] Network error: ${diagnostics.error}`);
    return '';
  }
}

/**
 * Create empty diagnostics object
 */
function createEmptyDiagnostics(): OCRRegionDiagnostics {
  return {
    inputSize: { width: 0, height: 0 },
    imageKB: 0,
    apiResponse: null,
  };
}

/**
 * Extract just the type text from a card (lightweight, single OCR call)
 * Used for quick type detection without full extraction
 */
export async function extractTypeText(
  cardCanvas: HTMLCanvasElement
): Promise<{ text: string; diagnostics: OCRRegionDiagnostics }> {
  const diagnostics = createEmptyDiagnostics();
  const text = await runOCROnRegion(cardCanvas, OCR_REGIONS.type, diagnostics);
  return { text, diagnostics };
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
