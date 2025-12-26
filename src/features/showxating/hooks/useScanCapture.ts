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
import { useShowxatingStore, IdentifiedCard, CapturedScan, Point } from '../store/showxatingStore';
import { useCardStore } from '../../../store/cardStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { cloudScanner } from '../../../services/cloudScanner';
import { authService } from '../../../services/authService';
import { getCardMatcher } from '../services/cardMatcher';
import { detectAllCards, detectCardQuadrilateral } from '../services/visionPipeline';
import type { Card } from '../../../types/card';

/**
 * Merge cloud-identified cards with OpenCV-detected bboxes.
 *
 * PRINCIPLE: OpenCV is source of truth for POSITION, Cloud is source of truth for IDENTIFICATION.
 *
 * Cloud API bbox positions are UNRELIABLE (fake grid coords, wrong positions).
 * OpenCV bbox positions are ACCURATE but may miss cards (lower recall).
 *
 * Strategy: SIMPLE SORTED-ORDER MATCHING
 * 1. Sort OpenCV bboxes by position (reading order: top-to-bottom, left-to-right)
 * 2. Sort cloud cards by position (for relative ordering only)
 * 3. Pair 1:1 by array index - use cloud ID + OpenCV bbox
 * 4. Extra OpenCV bboxes → "unknown" (cloud missed identification)
 * 5. Extra cloud cards → DROPPED (no reliable position available)
 *
 * This is simple and avoids the complexity of grid matching across incompatible coordinate spaces.
 */
function mergeCloudWithOpenCV(
  cloudCards: IdentifiedCard[],
  opencvCorners: Point[][],
  defaultScanResult: string
): IdentifiedCard[] {
  // If no OpenCV corners, return cloud cards as fallback (positions may be wrong)
  if (opencvCorners.length === 0) {
    console.log('[mergeCloudWithOpenCV] No OpenCV corners, using cloud bboxes (fallback)');
    return cloudCards;
  }

  const getCenter = (corners: Point[]) => ({
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  });

  const getBounds = (corners: Point[]) => ({
    minY: Math.min(...corners.map(p => p.y)),
    maxY: Math.max(...corners.map(p => p.y)),
  });

  // Calculate row tolerance from OpenCV bbox heights (50% of average height)
  const avgHeight = opencvCorners.reduce((sum, corners) => {
    const bounds = getBounds(corners);
    return sum + (bounds.maxY - bounds.minY);
  }, 0) / opencvCorners.length;
  const rowTolerance = avgHeight * 0.5;

  // Sort by reading order: group into rows by Y, then sort by X within rows
  const sortByReadingOrder = <T extends { center: Point }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      // If Y difference is small, they're in the same row - sort by X
      if (Math.abs(a.center.y - b.center.y) < rowTolerance) {
        return a.center.x - b.center.x;
      }
      // Otherwise sort by Y (top to bottom)
      return a.center.y - b.center.y;
    });
  };

  // Sort OpenCV bboxes by position (source of truth for positions)
  const sortedOpenCV = sortByReadingOrder(
    opencvCorners.map(corners => ({ corners, center: getCenter(corners) }))
  );

  // Sort cloud cards by their (unreliable) positions for relative ordering
  const sortedCloud = sortByReadingOrder(
    cloudCards.map(card => ({ card, center: getCenter(card.corners) }))
  );

  const mergedCards: IdentifiedCard[] = [];
  const extraCloudCount = Math.max(0, sortedCloud.length - sortedOpenCV.length);

  // Pair cloud cards with OpenCV bboxes by sorted index
  for (let i = 0; i < sortedOpenCV.length; i++) {
    if (i < sortedCloud.length) {
      // Matched: cloud identification + OpenCV position
      mergedCards.push({
        ...sortedCloud[i].card,
        corners: sortedOpenCV[i].corners, // Use accurate OpenCV position
        showingOpposite: defaultScanResult === 'opposite',
      });
    } else {
      // Extra OpenCV bbox with no cloud match: unknown
      mergedCards.push({
        cardId: 'unknown',
        filename: '',
        side: null,
        confidence: 0.5,
        corners: sortedOpenCV[i].corners,
        showingOpposite: defaultScanResult === 'opposite',
      });
    }
  }

  // Note: Extra cloud cards beyond OpenCV count are dropped
  // Their positions are unreliable - better to show nothing than wrong positions
  if (extraCloudCount > 0) {
    console.log(
      '[mergeCloudWithOpenCV] Dropped',
      extraCloudCount,
      'cloud cards (no reliable position)'
    );
  }

  console.log(
    '[mergeCloudWithOpenCV] cloud:', cloudCards.length,
    '| opencv:', opencvCorners.length,
    '| paired:', Math.min(sortedCloud.length, sortedOpenCV.length),
    '| dropped:', extraCloudCount
  );

  return mergedCards;
}

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

  // Try exact match first
  let match = cards.find(c => normalizeName(c.name) === normalizedSearch);
  if (match) return match;

  // Try match with type filter
  if (cardType) {
    const typeNormalized = cardType.toLowerCase();
    const typeFiltered = cards.filter(c => c.type === typeNormalized);
    match = typeFiltered.find(c => normalizeName(c.name) === normalizedSearch);
    if (match) return match;

    // Try partial match within type
    match = typeFiltered.find(c => normalizeName(c.name).includes(normalizedSearch));
    if (match) return match;
  }

  // Try partial match
  match = cards.find(c => normalizeName(c.name).includes(normalizedSearch));
  if (match) return match;

  // Try reverse partial match
  match = cards.find(c => normalizedSearch.includes(normalizeName(c.name)));
  return match || null;
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

  // Cloud-based scan using OpenAI Vision API
  const scanWithCloud = useCallback(async (
    canvas: HTMLCanvasElement
  ): Promise<IdentifiedCard[]> => {
    const identifiedCards: IdentifiedCard[] = [];

    try {
      const response = await cloudScanner.scanFromCanvas(canvas);

      if (!response.success || response.cards.length === 0) {
        console.warn('[useScanCapture] Cloud scan returned no cards:', response.error);
        return identifiedCards;
      }

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
          });
        }
      }

      console.log('[useScanCapture] Cloud scan identified', identifiedCards.length, 'cards');
    } catch (err) {
      console.error('[useScanCapture] Cloud scan error:', err);
    }

    return identifiedCards;
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
      };

      addCapture(scan);
      console.log('[useScanCapture] Captured scan:', scanId, 'placeholder cards:', placeholderCards.length);

      // Store reference for async cloud processing
      pendingCaptureRef.current = { canvas, imageData, scanId };

      // Phase 4: Send to cloud in background (if authenticated)
      if (authService.hasCredentials()) {
        // Run cloud processing asynchronously (don't await)
        // Keep OpenCV bboxes, only use cloud for card identification
        const opencvCorners = placeholderCards.map(c => c.corners);
        (async () => {
          try {
            console.log('[useScanCapture] Starting cloud scan for', scanId);
            const cloudCards = await scanWithCloud(canvas);

            if (cloudCards.length > 0) {
              // Phase 5: Merge cloud IDs with OpenCV bboxes
              // Cloud API bboxes are unreliable - use OpenCV corners instead
              const mergedCards = mergeCloudWithOpenCV(cloudCards, opencvCorners, defaultScanResult);
              console.log('[useScanCapture] Cloud identified', cloudCards.length, 'cards, merged with', opencvCorners.length, 'OpenCV bboxes');
              updateScanCards(scanId, mergedCards, false);
            } else {
              // Cloud returned nothing - try local fallback
              console.log('[useScanCapture] Cloud returned no cards, trying local fallback');
              const localCards = await scanWithLocal(canvas, imageData);
              updateScanCards(scanId, localCards.length > 0 ? localCards : [], false);
            }
          } catch (err) {
            console.error('[useScanCapture] Cloud processing error:', err);
            // Mark as no longer processing even on error
            updateScanCards(scanId, [], false);
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
