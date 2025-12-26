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
 * Cloud API provides accurate card identification but UNRELIABLE absolute bbox positions.
 * However, cloud bboxes are RELATIVELY correct (card A left of card B is accurate).
 * OpenCV provides accurate bboxes but lower recall (may miss some cards).
 *
 * Strategy: GRID-BASED MATCHING
 * 1. Detect grid dimensions from cloud cards (e.g., 3x3)
 * 2. Assign each cloud card to a grid cell based on relative position
 * 3. Assign each OpenCV bbox to a grid cell based on position
 * 4. Match by grid cell - handles missing detections gracefully
 * 5. Transform unmatched cloud bboxes to image coordinate space
 */
function mergeCloudWithOpenCV(
  cloudCards: IdentifiedCard[],
  opencvCorners: Point[][],
  defaultScanResult: string
): IdentifiedCard[] {
  // If no OpenCV corners, just return cloud cards as-is (fallback)
  if (opencvCorners.length === 0) {
    console.log('[mergeCloudWithOpenCV] No OpenCV corners, using cloud bboxes (fallback)');
    return cloudCards;
  }

  const getCenter = (corners: Point[]) => ({
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  });

  const getBounds = (corners: Point[]) => ({
    minX: Math.min(...corners.map(p => p.x)),
    maxX: Math.max(...corners.map(p => p.x)),
    minY: Math.min(...corners.map(p => p.y)),
    maxY: Math.max(...corners.map(p => p.y)),
  });

  // Detect grid dimensions by clustering Y coordinates into rows
  const detectGrid = (centers: Point[]): { rows: number; cols: number; rowTolerance: number } => {
    if (centers.length === 0) return { rows: 1, cols: 1, rowTolerance: 50 };

    // Sort by Y to find row breaks
    const sortedY = [...centers].sort((a, b) => a.y - b.y);
    const yGaps: number[] = [];
    for (let i = 1; i < sortedY.length; i++) {
      yGaps.push(sortedY[i].y - sortedY[i - 1].y);
    }

    // Row tolerance is the median small gap (within-row spacing is small, between-row is large)
    const sortedGaps = [...yGaps].sort((a, b) => a - b);
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 50;
    const rowTolerance = medianGap * 1.5;

    // Count rows
    let rows = 1;
    for (const gap of yGaps) {
      if (gap > rowTolerance) rows++;
    }

    const cols = Math.ceil(centers.length / rows);
    return { rows, cols, rowTolerance };
  };

  // Assign items to grid cells
  const assignToGrid = <T extends { center: Point }>(
    items: T[],
    _rows: number,
    _cols: number,
    rowTolerance: number
  ): Map<string, T> => {
    const grid = new Map<string, T>();

    // Sort by Y to group into rows
    const sortedByY = [...items].sort((a, b) => a.center.y - b.center.y);

    let currentRow = 0;
    let rowStartY = sortedByY[0]?.center.y ?? 0;
    const rowItems: T[][] = [[]];

    for (const item of sortedByY) {
      if (item.center.y - rowStartY > rowTolerance) {
        currentRow++;
        rowItems[currentRow] = [];
        rowStartY = item.center.y;
      }
      rowItems[currentRow].push(item);
    }

    // Within each row, sort by X and assign column
    for (let row = 0; row < rowItems.length; row++) {
      const sorted = rowItems[row].sort((a, b) => a.center.x - b.center.x);
      for (let col = 0; col < sorted.length; col++) {
        grid.set(`${row},${col}`, sorted[col]);
      }
    }

    return grid;
  };

  // Prepare cloud items
  const cloudItems = cloudCards.map(card => ({
    card,
    center: getCenter(card.corners),
    bounds: getBounds(card.corners),
  }));

  // Prepare OpenCV items
  const opencvItems = opencvCorners.map(corners => ({
    corners,
    center: getCenter(corners),
    bounds: getBounds(corners),
  }));

  // Detect grid from cloud (it has higher recall)
  const cloudCenters = cloudItems.map(c => c.center);
  const { rows, cols, rowTolerance: cloudRowTolerance } = detectGrid(cloudCenters);

  // Assign cloud cards to grid cells
  const cloudGrid = assignToGrid(cloudItems, rows, cols, cloudRowTolerance);

  // Calculate OpenCV row tolerance from bbox heights
  const opencvAvgHeight = opencvItems.reduce((sum, item) =>
    sum + (item.bounds.maxY - item.bounds.minY), 0) / opencvItems.length;
  const opencvRowTolerance = opencvAvgHeight * 0.5;

  // Assign OpenCV bboxes to grid cells
  const opencvGrid = assignToGrid(opencvItems, rows, cols, opencvRowTolerance);

  // Calculate coordinate transform from cloud to OpenCV space
  // Use ALL matched pairs for better accuracy
  const matchedCloud: Point[] = [];
  const matchedOpenCV: Point[] = [];

  for (const [cell, cloudItem] of cloudGrid) {
    const opencvItem = opencvGrid.get(cell);
    if (opencvItem) {
      matchedCloud.push(cloudItem.center);
      matchedOpenCV.push(opencvItem.center);
    }
  }

  // Linear interpolation helper with extrapolation support
  const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    if (inMax === inMin) return (outMin + outMax) / 2;
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
  };

  // Build transform from matched pairs
  let transformCorners: (corners: Point[]) => Point[];

  if (matchedCloud.length >= 2) {
    const cloudBounds = {
      minX: Math.min(...matchedCloud.map(p => p.x)),
      maxX: Math.max(...matchedCloud.map(p => p.x)),
      minY: Math.min(...matchedCloud.map(p => p.y)),
      maxY: Math.max(...matchedCloud.map(p => p.y)),
    };
    const opencvBounds = {
      minX: Math.min(...matchedOpenCV.map(p => p.x)),
      maxX: Math.max(...matchedOpenCV.map(p => p.x)),
      minY: Math.min(...matchedOpenCV.map(p => p.y)),
      maxY: Math.max(...matchedOpenCV.map(p => p.y)),
    };

    transformCorners = (corners: Point[]): Point[] => {
      return corners.map(p => ({
        x: lerp(p.x, cloudBounds.minX, cloudBounds.maxX, opencvBounds.minX, opencvBounds.maxX),
        y: lerp(p.y, cloudBounds.minY, cloudBounds.maxY, opencvBounds.minY, opencvBounds.maxY),
      }));
    };
  } else {
    // Fallback: use cloud corners as-is
    transformCorners = (corners) => corners;
  }

  // Build merged result
  const mergedCards: IdentifiedCard[] = [];
  const usedOpencvCells = new Set<string>();

  // First pass: cloud cards with OpenCV matches (use OpenCV bbox)
  for (const [cell, cloudItem] of cloudGrid) {
    const opencvItem = opencvGrid.get(cell);
    if (opencvItem) {
      usedOpencvCells.add(cell);
      mergedCards.push({
        ...cloudItem.card,
        corners: opencvItem.corners, // Use accurate OpenCV position
        showingOpposite: defaultScanResult === 'opposite',
      });
    }
  }

  // Second pass: cloud cards WITHOUT OpenCV match (transform cloud bbox)
  for (const [cell, cloudItem] of cloudGrid) {
    if (!opencvGrid.has(cell)) {
      const transformedCorners = transformCorners(cloudItem.card.corners);
      mergedCards.push({
        ...cloudItem.card,
        corners: transformedCorners,
        showingOpposite: defaultScanResult === 'opposite',
      });
    }
  }

  // Third pass: OpenCV bboxes not matched to any cloud card (unknown)
  for (const [cell, opencvItem] of opencvGrid) {
    if (!usedOpencvCells.has(cell)) {
      mergedCards.push({
        cardId: 'unknown',
        filename: '',
        side: null,
        confidence: 0.5,
        corners: opencvItem.corners,
        showingOpposite: defaultScanResult === 'opposite',
      });
    }
  }

  console.log(
    '[mergeCloudWithOpenCV] Grid:', rows, 'x', cols,
    '| cloud:', cloudCards.length,
    '| opencv:', opencvCorners.length,
    '| matched:', matchedCloud.length,
    '| cloud-only:', cloudGrid.size - matchedCloud.length,
    '| opencv-only:', opencvGrid.size - usedOpencvCells.size
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
