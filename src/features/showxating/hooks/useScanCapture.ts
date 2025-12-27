/**
 * useScanCapture Hook
 *
 * Handles the SCAN capture flow with immediate visual feedback:
 * 1. Capture static image from video
 * 2. Run OpenCV detection for immediate bboxes
 * 3. Store scan with placeholder cards (isProcessing: true)
 * 4. Send to cloud API in background
 * 5. Update scan when cloud returns
 *
 * Falls back to local dHash matching when offline.
 */

import { useCallback, useRef } from 'react';
import { useShowxatingStore, IdentifiedCard, CapturedScan } from '../store/showxatingStore';
import { useCardStore } from '../../../store/cardStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { cloudScanner } from '../../../services/cloudScanner';
import { authService } from '../../../services/authService';
import { getCardMatcher } from '../services/cardMatcher';
import { detectAllCards, detectCardQuadrilateral } from '../services/visionPipeline';
import { log } from '../../../store/logsStore';
import type { Card } from '../../../types/card';

/**
 * IMPORTANT: API results are the SOLE source of truth for card identification and grid layout.
 *
 * OpenCV detection is ONLY used as a visual placeholder while the API call is in progress.
 * When the API returns results, OpenCV detections are completely discarded.
 *
 * This prevents complex merge logic that can lose API-identified cards when grid cell
 * detection doesn't align perfectly between OpenCV and API coordinate spaces.
 */

interface UseScanCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
}

// Normalize card name for matching (lowercase, remove punctuation)
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

// Find card in database by name (fuzzy match)
function findCardByName(cards: Card[], cardName: string, cardType?: string): Card | null {
  const normalizedSearch = normalizeName(cardName);
  console.log(`[findCardByName] Searching for: "${cardName}" (normalized: "${normalizedSearch}") type: ${cardType || 'any'}`);

  // Try exact match first
  let match = cards.find(c => normalizeName(c.name) === normalizedSearch);
  if (match) {
    console.log(`[findCardByName] ✓ Exact match: ${match.id} "${match.name}"`);
    return match;
  }

  // Try match with type filter
  if (cardType) {
    const typeNormalized = cardType.toLowerCase();
    const typeFiltered = cards.filter(c => c.type === typeNormalized);
    console.log(`[findCardByName] Type filter "${typeNormalized}": ${typeFiltered.length} cards`);

    match = typeFiltered.find(c => normalizeName(c.name) === normalizedSearch);
    if (match) {
      console.log(`[findCardByName] ✓ Type+exact match: ${match.id} "${match.name}"`);
      return match;
    }

    // Try partial match within type
    match = typeFiltered.find(c => normalizeName(c.name).includes(normalizedSearch));
    if (match) {
      console.log(`[findCardByName] ✓ Type+partial match: ${match.id} "${match.name}"`);
      return match;
    }
  }

  // Try partial match
  match = cards.find(c => normalizeName(c.name).includes(normalizedSearch));
  if (match) {
    console.log(`[findCardByName] ✓ Partial match: ${match.id} "${match.name}"`);
    return match;
  }

  // Try reverse partial match
  match = cards.find(c => normalizedSearch.includes(normalizeName(c.name)));
  if (match) {
    console.log(`[findCardByName] ✓ Reverse partial match: ${match.id} "${match.name}"`);
    return match;
  }

  // No match - log some similar names for debugging
  const similar = cards
    .map(c => ({ card: c, norm: normalizeName(c.name) }))
    .filter(({ norm }) => {
      // Check if any word matches
      const searchWords = normalizedSearch.split(' ');
      const cardWords = norm.split(' ');
      return searchWords.some(sw => cardWords.some(cw => cw.includes(sw) || sw.includes(cw)));
    })
    .slice(0, 5);

  console.log(`[findCardByName] ✗ No match found. Similar cards:`, similar.map(s => `${s.card.id} "${s.card.name}"`));
  return null;
}

// Convert normalized bbox [x1, y1, x2, y2] to corner points
function bboxToCorners(
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): { x: number; y: number }[] {
  const [x1, y1, x2, y2] = bbox;
  return [
    { x: x1 * imageWidth, y: y1 * imageHeight }, // top-left
    { x: x2 * imageWidth, y: y1 * imageHeight }, // top-right
    { x: x2 * imageWidth, y: y2 * imageHeight }, // bottom-right
    { x: x1 * imageWidth, y: y2 * imageHeight }, // bottom-left
  ];
}

export function useScanCapture({ videoRef }: UseScanCaptureOptions) {
  const { isCapturing, setCapturing, addCapture, updateScanCards } = useShowxatingStore();
  const { cards } = useCardStore();
  const { defaultScanResult } = useSettingsStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep track of captured image data for async cloud processing
  const pendingCaptureRef = useRef<{
    canvas: HTMLCanvasElement;
    imageData: ImageData;
    scanId: string;
  } | null>(null);

  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    return canvasRef.current;
  }, []);

  // Cloud scan result with grid dimensions
  interface CloudScanResult {
    cards: IdentifiedCard[];
    gridRows?: number;
    gridCols?: number;
  }

  // Cloud-based scan using OpenAI Vision API
  const scanWithCloud = useCallback(async (
    canvas: HTMLCanvasElement
  ): Promise<CloudScanResult> => {
    const identifiedCards: IdentifiedCard[] = [];

    try {
      const response = await cloudScanner.scanFromCanvas(canvas);

      if (!response.success || response.cards.length === 0) {
        console.warn('[useScanCapture] Cloud scan returned no cards:', response.error);
        return { cards: identifiedCards };
      }

      // Log all API results for debugging
      console.log('[useScanCapture] API returned', response.cards.length, 'cards:');
      response.cards.forEach((c, i) => {
        console.log(`  [${i}] type="${c.card_type}" name="${c.card_name}" side="${c.side}" conf=${c.confidence}`);
      });

      // Store API response in logs for diagnostic modal
      log.scan(`API scan: ${response.cards.length} cards, grid ${response.gridRows}x${response.gridCols}`, {
        apiResponse: {
          success: response.success,
          cardCount: response.cards.length,
          cards: response.cards.map(c => ({
            type: c.card_type,
            name: c.card_name,
            side: c.side,
            confidence: c.confidence,
            bbox: c.bbox,
          })),
          gridRows: response.gridRows,
          gridCols: response.gridCols,
          model: response.model_used,
          tokens: response.tokens_used,
          latency: response.latency_ms,
        }
      });

      // Map API results to IdentifiedCard format
      for (const apiCard of response.cards) {
        // Find matching card in our database
        const matchedCard = findCardByName(cards, apiCard.card_name, apiCard.card_type);

        // Convert bbox to corners if present, otherwise use placeholder
        const corners = apiCard.bbox
          ? bboxToCorners(apiCard.bbox, canvas.width, canvas.height)
          : [{ x: 0, y: 0 }, { x: canvas.width, y: 0 }, { x: canvas.width, y: canvas.height }, { x: 0, y: canvas.height }];

        if (matchedCard) {
          identifiedCards.push({
            cardId: matchedCard.id,
            filename: matchedCard.filename,
            side: matchedCard.side || null,
            confidence: apiCard.confidence,
            corners,
            showingOpposite: defaultScanResult === 'opposite',
            // Propagate OCR text from cloud API for correction flow
            extractedText: apiCard.ocr_text || `${apiCard.card_type}: ${apiCard.card_name}`,
          });
        } else {
          // Card detected but not found in database
          console.warn('[useScanCapture] Card not found in database:', apiCard.card_name);

          identifiedCards.push({
            cardId: 'unknown',
            filename: '',
            side: null,
            confidence: apiCard.confidence * 0.5, // Lower confidence for unmatched
            corners,
            showingOpposite: defaultScanResult === 'opposite',
            // Store what the API detected for correction flow
            extractedText: apiCard.ocr_text || `${apiCard.card_type}: ${apiCard.card_name}`,
          });
        }
      }

      console.log('[useScanCapture] Cloud scan identified', identifiedCards.length, 'cards, grid:', response.gridRows, 'x', response.gridCols);
      console.log('[useScanCapture] API response raw grid:', { gridRows: response.gridRows, gridCols: response.gridCols });
      return {
        cards: identifiedCards,
        gridRows: response.gridRows,
        gridCols: response.gridCols,
      };
    } catch (err) {
      console.error('[useScanCapture] Cloud scan error:', err);
      return { cards: identifiedCards };
    }
  }, [cards, defaultScanResult]);

  // Local fallback scan using dHash matching
  const scanWithLocal = useCallback(async (
    canvas: HTMLCanvasElement,
    imageData: ImageData
  ): Promise<IdentifiedCard[]> => {
    const identifiedCards: IdentifiedCard[] = [];

    // Detect card quadrilateral
    const detection = detectCardQuadrilateral(imageData, canvas.width, canvas.height);

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

      // Identify the card using dHash
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

    console.log('[useScanCapture] Local scan identified', identifiedCards.length, 'cards');
    return identifiedCards;
  }, [defaultScanResult]);

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

      // Phase 1: Capture frame immediately
      ctx.drawImage(video, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scanId = `scan-${Date.now()}`;

      // Phase 2: Run OpenCV detection for immediate bboxes
      let placeholderCards: IdentifiedCard[] = [];
      const opencvResult = detectAllCards(imageData, canvas.width, canvas.height);

      if (opencvResult.cards.length > 0) {
        console.log('[useScanCapture] OpenCV detected', opencvResult.cards.length, 'cards');
        // Create placeholder cards with OpenCV bboxes
        placeholderCards = opencvResult.cards.map((detection) => ({
          cardId: 'unknown',
          filename: '',
          side: null,
          confidence: 0.5, // Placeholder confidence
          corners: detection.corners!,
          showingOpposite: defaultScanResult === 'opposite',
        }));
      }

      // Phase 3: Store scan with placeholder cards (isProcessing: true)
      const scan: CapturedScan = {
        id: scanId,
        timestamp: Date.now(),
        imageDataUrl,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        cards: placeholderCards,
        isProcessing: authService.hasCredentials(), // Only processing if we'll call cloud
        opencvCardCount: placeholderCards.length,   // Track OpenCV detection count
      };

      addCapture(scan);
      console.log('[useScanCapture] Captured scan:', scanId, 'OpenCV detected:', placeholderCards.length);

      // Store reference for async cloud processing
      pendingCaptureRef.current = { canvas, imageData, scanId };

      // Phase 4: Send to cloud in background (if authenticated)
      if (authService.hasCredentials()) {
        // Run cloud processing asynchronously (don't await)
        // IMPORTANT: API results are the SOLE source of truth - OpenCV is only placeholder
        const opencvCount = placeholderCards.length;
        (async () => {
          try {
            console.log('[useScanCapture] Starting cloud scan for', scanId);
            const cloudResult = await scanWithCloud(canvas);

            if (cloudResult.cards.length > 0) {
              // Phase 5: Use cloud results directly (API is source of truth)
              // OpenCV detections are completely discarded - they were only placeholders
              console.log('[useScanCapture] API identified', cloudResult.cards.length, 'cards');
              console.log('[useScanCapture] Discarding', opencvCount, 'OpenCV placeholders - API is source of truth');
              console.log('[useScanCapture] Storing grid dimensions:', { rows: cloudResult.gridRows, cols: cloudResult.gridCols });
              updateScanCards(
                scanId,
                cloudResult.cards,  // Use API cards directly, not merged
                false,
                { opencv: opencvCount, api: cloudResult.cards.length },
                { rows: cloudResult.gridRows, cols: cloudResult.gridCols }
              );
            } else {
              // Cloud returned nothing - try local fallback
              console.log('[useScanCapture] Cloud returned no cards, trying local fallback');
              const localCards = await scanWithLocal(canvas, imageData);
              updateScanCards(scanId, localCards.length > 0 ? localCards : [], false, { api: 0 });
            }
          } catch (err) {
            console.error('[useScanCapture] Cloud processing error:', err);
            // Mark as no longer processing even on error
            updateScanCards(scanId, [], false, { api: 0 });
          }
        })();
      } else if (placeholderCards.length === 0) {
        // No cloud access and no OpenCV results - try local fallback
        console.log('[useScanCapture] Trying local fallback');
        const localCards = await scanWithLocal(canvas, imageData);
        if (localCards.length > 0) {
          updateScanCards(scanId, localCards, false);
        }
      }
    } catch (err) {
      console.error('[useScanCapture] Capture error:', err);
    } finally {
      setCapturing(false);
    }
  }, [isCapturing, videoRef, getCanvas, setCapturing, addCapture, updateScanCards, defaultScanResult, scanWithCloud, scanWithLocal]);

  return {
    capture,
    isCapturing,
  };
}
