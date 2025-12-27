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
 * Grid-based merge of cloud-identified cards with OpenCV-detected bboxes.
 *
 * PRINCIPLE: OpenCV is source of truth for POSITION, Cloud is source of truth for IDENTIFICATION.
 *
 * Strategy: GRID-BASED MATCHING
 * 1. Detect grid structure from OpenCV bbox centers (cluster into rows/columns)
 * 2. Assign each OpenCV bbox to a (row, col) grid cell
 * 3. Detect grid structure from cloud bbox centers (same clustering approach)
 * 4. Assign each cloud card to a (row, col) grid cell
 * 5. Merge by matching grid cells - cloud ID + OpenCV position
 *
 * KEY INSIGHT: Even if cloud bbox positions are absolutely wrong, they may preserve
 * RELATIVE ordering. We use centroid-based clustering in both coordinate spaces
 * independently, then match by (row, col) - not by absolute position or array index.
 */

interface GridCell {
  row: number;
  col: number;
}

interface GridStructure {
  rowBoundaries: number[];  // Y values that separate rows
  colBoundaries: number[];  // X values that separate columns
  rowCentroids: number[];   // Y centroid for each row
  colCentroids: number[];   // X centroid for each column
  numRows: number;
  numCols: number;
}

/**
 * Detect grid structure from a set of center points.
 * Uses gap detection to cluster Y values into rows and X values into columns.
 */
function detectGridStructure(centers: Point[], avgSize: number): GridStructure {
  if (centers.length === 0) {
    return { rowBoundaries: [], colBoundaries: [], rowCentroids: [], colCentroids: [], numRows: 0, numCols: 0 };
  }

  if (centers.length === 1) {
    return {
      rowBoundaries: [],
      colBoundaries: [],
      rowCentroids: [centers[0].y],
      colCentroids: [centers[0].x],
      numRows: 1,
      numCols: 1
    };
  }

  const gapThreshold = avgSize * 0.5;

  // Cluster Y values into rows
  const sortedByY = [...centers].sort((a, b) => a.y - b.y);
  const rowGroups: Point[][] = [[sortedByY[0]]];
  const rowBoundaries: number[] = [];

  for (let i = 1; i < sortedByY.length; i++) {
    const gap = sortedByY[i].y - sortedByY[i - 1].y;
    if (gap > gapThreshold) {
      rowBoundaries.push((sortedByY[i].y + sortedByY[i - 1].y) / 2);
      rowGroups.push([sortedByY[i]]);
    } else {
      rowGroups[rowGroups.length - 1].push(sortedByY[i]);
    }
  }

  // Calculate row centroids
  const rowCentroids = rowGroups.map(group =>
    group.reduce((sum, p) => sum + p.y, 0) / group.length
  );

  // Cluster X values into columns
  const sortedByX = [...centers].sort((a, b) => a.x - b.x);
  const colGroups: Point[][] = [[sortedByX[0]]];
  const colBoundaries: number[] = [];

  for (let i = 1; i < sortedByX.length; i++) {
    const gap = sortedByX[i].x - sortedByX[i - 1].x;
    if (gap > gapThreshold) {
      colBoundaries.push((sortedByX[i].x + sortedByX[i - 1].x) / 2);
      colGroups.push([sortedByX[i]]);
    } else {
      colGroups[colGroups.length - 1].push(sortedByX[i]);
    }
  }

  // Calculate column centroids
  const colCentroids = colGroups.map(group =>
    group.reduce((sum, p) => sum + p.x, 0) / group.length
  );

  return {
    rowBoundaries,
    colBoundaries,
    rowCentroids,
    colCentroids,
    numRows: rowGroups.length,
    numCols: colGroups.length
  };
}

/**
 * Assign a center point to a grid cell based on the grid structure.
 */
function assignToGridCell(center: Point, grid: GridStructure): GridCell {
  // Find row by comparing Y to row boundaries
  let row = 0;
  for (let i = 0; i < grid.rowBoundaries.length; i++) {
    if (center.y > grid.rowBoundaries[i]) {
      row = i + 1;
    }
  }

  // Find column by comparing X to column boundaries
  let col = 0;
  for (let i = 0; i < grid.colBoundaries.length; i++) {
    if (center.x > grid.colBoundaries[i]) {
      col = i + 1;
    }
  }

  return { row, col };
}

/**
 * Create a string key for a grid cell (for Map lookup)
 */
function cellKey(cell: GridCell): string {
  return `${cell.row},${cell.col}`;
}

function mergeCloudWithOpenCV(
  cloudCards: IdentifiedCard[],
  opencvCorners: Point[][],
  defaultScanResult: string
): IdentifiedCard[] {
  // If no OpenCV corners, return cloud cards as fallback (positions may be wrong)
  if (opencvCorners.length === 0) {
    console.log('[GridMerge] No OpenCV corners, using cloud bboxes (fallback)');
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

  // Calculate average bbox size for gap threshold
  const avgSize = opencvCorners.reduce((sum, corners) => {
    const bounds = getBounds(corners);
    return sum + ((bounds.maxY - bounds.minY) + (bounds.maxX - bounds.minX)) / 2;
  }, 0) / opencvCorners.length;

  // Calculate centers for OpenCV bboxes
  const opencvCenters = opencvCorners.map(corners => getCenter(corners));

  // Step 1: Detect grid structure from OpenCV (source of truth)
  const opencvGrid = detectGridStructure(opencvCenters, avgSize);
  console.log(`[GridMerge] OpenCV grid: ${opencvGrid.numRows}×${opencvGrid.numCols}`);
  console.log(`[GridMerge] Row centroids: [${opencvGrid.rowCentroids.map(y => Math.round(y)).join(', ')}]`);
  console.log(`[GridMerge] Col centroids: [${opencvGrid.colCentroids.map(x => Math.round(x)).join(', ')}]`);

  // Step 2: Assign OpenCV bboxes to grid cells
  const opencvByCell = new Map<string, { corners: Point[]; center: Point }>();
  opencvCorners.forEach((corners, i) => {
    const center = opencvCenters[i];
    const cell = assignToGridCell(center, opencvGrid);
    const key = cellKey(cell);
    opencvByCell.set(key, { corners, center });
    console.log(`[GridMerge] OpenCV[${i}] center:(${Math.round(center.x)},${Math.round(center.y)}) → cell(${cell.row},${cell.col})`);
  });

  // Step 3: Detect grid structure from cloud cards (using same approach)
  const cloudCenters = cloudCards.map(card => getCenter(card.corners));

  // Use cloud's own coordinate space for clustering
  const cloudAvgSize = cloudCards.length > 0 ? cloudCards.reduce((sum, card) => {
    const bounds = getBounds(card.corners);
    return sum + ((bounds.maxY - bounds.minY) + (bounds.maxX - bounds.minX)) / 2;
  }, 0) / cloudCards.length : avgSize;

  const cloudGrid = detectGridStructure(cloudCenters, cloudAvgSize);
  console.log(`[GridMerge] Cloud grid: ${cloudGrid.numRows}×${cloudGrid.numCols}`);

  // Step 4: Assign cloud cards to grid cells
  const cloudByCell = new Map<string, IdentifiedCard>();
  cloudCards.forEach((card, i) => {
    const center = cloudCenters[i];
    const cell = assignToGridCell(center, cloudGrid);
    const key = cellKey(cell);
    cloudByCell.set(key, card);
    console.log(`[GridMerge] Cloud[${i}] ${card.cardId} center:(${Math.round(center.x)},${Math.round(center.y)}) → cell(${cell.row},${cell.col})`);
  });

  // Check for grid dimension mismatch
  if (opencvGrid.numRows !== cloudGrid.numRows || opencvGrid.numCols !== cloudGrid.numCols) {
    console.warn(`[GridMerge] Grid dimension mismatch! OpenCV: ${opencvGrid.numRows}×${opencvGrid.numCols}, Cloud: ${cloudGrid.numRows}×${cloudGrid.numCols}`);
  }

  // Step 5: Merge - CLOUD IS SOURCE OF TRUTH
  // Iterate over cloud cards (not OpenCV) to ensure all API results are included
  const mergedCards: IdentifiedCard[] = [];
  let improvedCount = 0;
  let usedApiBoxCount = 0;

  console.log('[GridMerge] Merging (cloud-first):');
  cloudByCell.forEach((cloudCard, key) => {
    const opencv = opencvByCell.get(key);

    if (opencv) {
      // Match found: use cloud ID + better OpenCV position
      console.log(`  cell(${key}): cloud:${cloudCard.cardId} ← improved by opencv:(${Math.round(opencv.center.x)},${Math.round(opencv.center.y)})`);
      mergedCards.push({
        ...cloudCard,
        corners: opencv.corners,
        showingOpposite: defaultScanResult === 'opposite',
      });
      improvedCount++;
    } else {
      // No OpenCV match - use cloud's own bbox (API results are truth)
      console.log(`  cell(${key}): cloud:${cloudCard.cardId} ← using API bbox`);
      mergedCards.push({
        ...cloudCard,
        showingOpposite: defaultScanResult === 'opposite',
      });
      usedApiBoxCount++;
    }
  });

  // Add any OpenCV-only detections as unknown cards
  let unknownCount = 0;
  opencvByCell.forEach((opencv, key) => {
    if (!cloudByCell.has(key)) {
      console.log(`  cell(${key}): opencv-only → unknown`);
      mergedCards.push({
        cardId: 'unknown',
        filename: '',
        side: null,
        confidence: 0.5,
        corners: opencv.corners,
        showingOpposite: defaultScanResult === 'opposite',
      });
      unknownCount++;
    }
  });

  console.log(`[GridMerge] Summary: cloud:${cloudCards.length} opencv:${opencvCorners.length} improved:${improvedCount} api-bbox:${usedApiBoxCount} unknown:${unknownCount}`);

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
        // Keep OpenCV bboxes, only use cloud for card identification
        const opencvCorners = placeholderCards.map(c => c.corners);
        (async () => {
          try {
            console.log('[useScanCapture] Starting cloud scan for', scanId);
            const cloudResult = await scanWithCloud(canvas);

            if (cloudResult.cards.length > 0) {
              // Phase 5: Merge cloud IDs with OpenCV bboxes
              // Cloud API bboxes are unreliable - use OpenCV corners instead
              const mergedCards = mergeCloudWithOpenCV(cloudResult.cards, opencvCorners, defaultScanResult);
              console.log('[useScanCapture] Cloud identified', cloudResult.cards.length, 'cards, merged with', opencvCorners.length, 'OpenCV bboxes');
              console.log('[useScanCapture] Storing grid dimensions:', { rows: cloudResult.gridRows, cols: cloudResult.gridCols });
              updateScanCards(
                scanId,
                mergedCards,
                false,
                { opencv: opencvCorners.length, api: cloudResult.cards.length },
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
