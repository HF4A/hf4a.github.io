import type { Point } from '../store/showxatingStore';

export interface DetectionResult {
  found: boolean;
  corners: Point[] | null; // Ordered: TL, TR, BR, BL
  confidence: number;
  aspectRatio: number;
  area: number;
}

export interface MultiDetectionResult {
  cards: DetectionResult[];
  skewAngle: number; // Detected perspective skew in degrees
}

// Card aspect ratio is approximately 63mm x 88mm = 0.716 (width/height)
// Or inverted: 1.397 (height/width)
const CARD_ASPECT_RATIO = 88 / 63; // ~1.4
const ASPECT_RATIO_TOLERANCE = 0.35; // Allow some variance
const MIN_AREA_RATIO = 0.02; // Card must be at least 2% of frame (lowered for multi-card)
const MAX_AREA_RATIO = 0.6; // Card can't be more than 60% of frame (lowered for multi-card)
const SIZE_TOLERANCE = 0.4; // Cards must be within 40% of median size

/**
 * Detect a single card-shaped quadrilateral in the frame (legacy, for live detection)
 */
export function detectCardQuadrilateral(
  imageData: ImageData,
  frameWidth: number,
  frameHeight: number
): DetectionResult {
  const result = detectAllCards(imageData, frameWidth, frameHeight);
  if (result.cards.length === 0) {
    return { found: false, corners: null, confidence: 0, aspectRatio: 0, area: 0 };
  }
  // Return the largest/best card
  return result.cards[0];
}

/**
 * Detect all card-shaped quadrilaterals in the frame
 */
export function detectAllCards(
  imageData: ImageData,
  frameWidth: number,
  frameHeight: number
): MultiDetectionResult {
  const cv = window.cv;

  if (!cv || !cv.Mat) {
    return { cards: [], skewAngle: 0 };
  }

  const frameArea = frameWidth * frameHeight;
  const minArea = frameArea * MIN_AREA_RATIO;
  const maxArea = frameArea * MAX_AREA_RATIO;

  let src: any = null;
  let gray: any = null;
  let blurred: any = null;
  let edges: any = null;
  let contours: any = null;
  let hierarchy: any = null;

  try {
    // Convert ImageData to OpenCV Mat
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Canny edge detection
    cv.Canny(blurred, edges, 50, 150);

    // Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Collect all valid card candidates
    const candidates: DetectionResult[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Filter by area
      if (area < minArea || area > maxArea) {
        continue;
      }

      // Approximate the contour to a polygon
      const approx = new cv.Mat();
      const epsilon = 0.04 * cv.arcLength(contour, true);
      cv.approxPolyDP(contour, approx, epsilon, true);

      // We want quadrilaterals (4 corners)
      if (approx.rows === 4) {
        // Check if convex
        if (cv.isContourConvex(approx)) {
          // Get bounding rect for aspect ratio check
          const rect = cv.boundingRect(approx);
          const aspectRatio = rect.height / rect.width;

          // Check aspect ratio matches a card (with tolerance)
          const aspectDiff = Math.abs(aspectRatio - CARD_ASPECT_RATIO);
          const invertedAspectDiff = Math.abs(1 / aspectRatio - CARD_ASPECT_RATIO);
          const minAspectDiff = Math.min(aspectDiff, invertedAspectDiff);

          if (minAspectDiff < ASPECT_RATIO_TOLERANCE) {
            // Calculate confidence based on area and aspect ratio match
            const areaConfidence = Math.min(area / (frameArea * 0.1), 1);
            const aspectConfidence = 1 - (minAspectDiff / ASPECT_RATIO_TOLERANCE);
            const confidence = (areaConfidence * 0.4 + aspectConfidence * 0.6);

            if (confidence > 0.1) {
              candidates.push({
                found: true,
                corners: extractCorners(approx),
                confidence,
                aspectRatio,
                area,
              });
            }
          }
        }
      }

      approx.delete();
    }

    // If no candidates, return empty
    if (candidates.length === 0) {
      return { cards: [], skewAngle: 0 };
    }

    // Sort by area (largest first)
    candidates.sort((a, b) => b.area - a.area);

    // Calculate median area for size filtering
    const areas = candidates.map(c => c.area);
    const medianArea = areas[Math.floor(areas.length / 2)];

    // Filter cards by size consistency (within tolerance of median)
    const filteredCards = candidates.filter(c => {
      const sizeRatio = c.area / medianArea;
      return sizeRatio >= (1 - SIZE_TOLERANCE) && sizeRatio <= (1 + SIZE_TOLERANCE);
    });

    // Calculate skew angle from the largest card
    const skewAngle = filteredCards.length > 0
      ? calculateSkewAngle(filteredCards[0].corners!)
      : 0;

    console.log(`[detectAllCards] Found ${candidates.length} candidates, ${filteredCards.length} after size filtering, skew: ${skewAngle.toFixed(1)}°`);

    return {
      cards: filteredCards,
      skewAngle,
    };
  } catch (err) {
    console.error('Vision pipeline error:', err);
    return { cards: [], skewAngle: 0 };
  } finally {
    // Cleanup OpenCV matrices
    src?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

/**
 * Calculate the skew angle of a card from its corners
 * Returns angle in degrees (positive = clockwise rotation)
 */
function calculateSkewAngle(corners: Point[]): number {
  // Use the top edge (TL to TR) to determine rotation
  const topLeft = corners[0];
  const topRight = corners[1];

  const dx = topRight.x - topLeft.x;
  const dy = topRight.y - topLeft.y;

  // Calculate angle in degrees
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return angle;
}

/**
 * Extract corner points from an OpenCV Mat (4x1 contour)
 * Orders them as: Top-Left, Top-Right, Bottom-Right, Bottom-Left
 */
function extractCorners(approx: any): Point[] {
  const points: Point[] = [];

  // OpenCV.js stores contour points in data32S as flat array [x1, y1, x2, y2, ...]
  // For a 4-point contour, we have 8 values
  for (let i = 0; i < 4; i++) {
    points.push({
      x: approx.data32S[i * 2],
      y: approx.data32S[i * 2 + 1],
    });
  }


  // Sort to get consistent ordering (TL, TR, BR, BL)
  return orderCorners(points);
}

/**
 * Order corners clockwise starting from top-left
 */
function orderCorners(points: Point[]): Point[] {
  // Find centroid
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;

  // Sort by angle from centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find top-left (smallest x + y sum)
  let tlIndex = 0;
  let minSum = Infinity;
  sorted.forEach((p, i) => {
    const sum = p.x + p.y;
    if (sum < minSum) {
      minSum = sum;
      tlIndex = i;
    }
  });

  // Rotate array so TL is first
  const ordered = [
    sorted[tlIndex],
    sorted[(tlIndex + 1) % 4],
    sorted[(tlIndex + 2) % 4],
    sorted[(tlIndex + 3) % 4],
  ];

  return ordered;
}

/**
 * Warp a detected card quadrilateral to a rectangle
 * Returns a canvas with the perspective-corrected card image
 *
 * @param sourceCanvas - The canvas containing the source image
 * @param corners - The 4 corners of the detected card (TL, TR, BR, BL order)
 * @param outputWidth - Width of the output image (default: 200)
 * @param outputHeight - Height of the output image (default: 280, based on card aspect ratio)
 */
export function warpCardToRectangle(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[],
  outputWidth: number = 630,
  outputHeight: number = 880
): HTMLCanvasElement | null {
  const cv = window.cv;

  if (!cv || !cv.Mat) {
    console.warn('[warpCardToRectangle] OpenCV not loaded');
    return null;
  }

  let src: any = null;
  let dst: any = null;
  let srcPoints: any = null;
  let dstPoints: any = null;
  let transform: any = null;

  try {
    // Get source image from canvas
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    src = cv.matFromImageData(imageData);

    // Define source points (detected corners)
    // Corners are already ordered: TL, TR, BR, BL
    srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,  // TL
      corners[1].x, corners[1].y,  // TR
      corners[2].x, corners[2].y,  // BR
      corners[3].x, corners[3].y,  // BL
    ]);

    // Define destination points (rectangle)
    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,                        // TL
      outputWidth, 0,              // TR
      outputWidth, outputHeight,   // BR
      0, outputHeight,             // BL
    ]);

    // Compute perspective transform matrix
    transform = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // Create output mat
    dst = new cv.Mat();
    const dsize = new cv.Size(outputWidth, outputHeight);

    // Apply perspective warp
    cv.warpPerspective(src, dst, transform, dsize);

    // Convert result to canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    cv.imshow(outputCanvas, dst);

    return outputCanvas;
  } catch (err) {
    console.error('[warpCardToRectangle] Error:', err);
    return null;
  } finally {
    // Cleanup OpenCV matrices
    src?.delete();
    dst?.delete();
    srcPoints?.delete();
    dstPoints?.delete();
    transform?.delete();
  }
}

// ============================================================================
// NEW PIPELINE: Warp-Then-Detect (v0.3.0)
// ============================================================================

/**
 * Skew analysis result from pre-detection
 */
export interface SkewAnalysis {
  angle: number;              // Rotation angle in degrees
  corners: Point[] | null;    // The corners used for skew detection
  hasSkew: boolean;           // Whether significant skew was detected
}

/**
 * Corrected frame result after perspective warp
 */
export interface CorrectedFrameResult {
  canvas: HTMLCanvasElement;
  skewAnalysis: SkewAnalysis;
}

// Tighter tolerances for post-warp detection (cards should be upright)
const CORRECTED_ASPECT_RATIO_TOLERANCE = 0.25; // Tighter than pre-warp
const CORRECTED_SIZE_TOLERANCE = 0.35;          // Cards should be more uniform

/**
 * Phase A2: Detect frame skew from the largest quadrilateral
 * Used to determine perspective correction parameters
 */
export function detectFrameSkew(
  imageData: ImageData,
  frameWidth: number,
  frameHeight: number
): SkewAnalysis {
  // Use existing detection to find the largest card
  const result = detectAllCards(imageData, frameWidth, frameHeight);

  if (result.cards.length === 0) {
    return { angle: 0, corners: null, hasSkew: false };
  }

  // Use the largest card (first after sorting) for skew reference
  const largestCard = result.cards[0];
  const angle = result.skewAngle;

  // Consider skew significant if > 2 degrees
  const hasSkew = Math.abs(angle) > 2;

  console.log(`[detectFrameSkew] Detected skew: ${angle.toFixed(1)}° from ${result.cards.length} cards`);

  return {
    angle,
    corners: largestCard.corners,
    hasSkew,
  };
}

/**
 * Phase A3: Apply perspective correction to entire frame
 * Returns a new canvas with the corrected image
 */
export function warpFullFrame(
  sourceCanvas: HTMLCanvasElement,
  skewAnalysis: SkewAnalysis
): CorrectedFrameResult {
  const cv = window.cv;

  // If no significant skew or no OpenCV, return original
  if (!skewAnalysis.hasSkew || !skewAnalysis.corners || !cv || !cv.Mat) {
    console.log('[warpFullFrame] No warp needed, returning original');
    return { canvas: sourceCanvas, skewAnalysis };
  }

  let src: any = null;
  let dst: any = null;
  let rotationMatrix: any = null;

  try {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) {
      return { canvas: sourceCanvas, skewAnalysis };
    }

    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    src = cv.matFromImageData(imageData);

    // Calculate rotation center (center of frame)
    const centerX = sourceCanvas.width / 2;
    const centerY = sourceCanvas.height / 2;

    // Create rotation matrix (negative angle to correct the skew)
    const center = new cv.Point(centerX, centerY);
    rotationMatrix = cv.getRotationMatrix2D(center, -skewAnalysis.angle, 1.0);

    // Apply rotation
    dst = new cv.Mat();
    const dsize = new cv.Size(sourceCanvas.width, sourceCanvas.height);
    cv.warpAffine(src, dst, rotationMatrix, dsize);

    // Convert result to canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    cv.imshow(outputCanvas, dst);

    console.log(`[warpFullFrame] Applied ${(-skewAnalysis.angle).toFixed(1)}° rotation correction`);

    return { canvas: outputCanvas, skewAnalysis };
  } catch (err) {
    console.error('[warpFullFrame] Error:', err);
    return { canvas: sourceCanvas, skewAnalysis };
  } finally {
    src?.delete();
    dst?.delete();
    rotationMatrix?.delete();
  }
}

/**
 * Phase A4: Detect cards in a perspective-corrected frame
 * Uses tighter tolerances since cards should now be upright rectangles
 */
export function detectCardsInCorrectedFrame(
  imageData: ImageData,
  frameWidth: number,
  frameHeight: number
): DetectionResult[] {
  const cv = window.cv;

  if (!cv || !cv.Mat) {
    return [];
  }

  const frameArea = frameWidth * frameHeight;
  const minArea = frameArea * MIN_AREA_RATIO;
  const maxArea = frameArea * MAX_AREA_RATIO;

  let src: any = null;
  let gray: any = null;
  let blurred: any = null;
  let edges: any = null;
  let contours: any = null;
  let hierarchy: any = null;

  try {
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates: DetectionResult[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < minArea || area > maxArea) {
        continue;
      }

      const approx = new cv.Mat();
      const epsilon = 0.04 * cv.arcLength(contour, true);
      cv.approxPolyDP(contour, approx, epsilon, true);

      if (approx.rows === 4) {
        // Relaxed convexity check for corrected frame
        // (convexity issues may come from lighting, not actual card shape)
        const isConvex = cv.isContourConvex(approx);

        const rect = cv.boundingRect(approx);
        const aspectRatio = rect.height / rect.width;

        // Use tighter aspect ratio tolerance for corrected frame
        const aspectDiff = Math.abs(aspectRatio - CARD_ASPECT_RATIO);
        const invertedAspectDiff = Math.abs(1 / aspectRatio - CARD_ASPECT_RATIO);
        const minAspectDiff = Math.min(aspectDiff, invertedAspectDiff);

        if (minAspectDiff < CORRECTED_ASPECT_RATIO_TOLERANCE) {
          const areaConfidence = Math.min(area / (frameArea * 0.1), 1);
          const aspectConfidence = 1 - (minAspectDiff / CORRECTED_ASPECT_RATIO_TOLERANCE);
          // Slight penalty for non-convex, but don't reject
          const convexPenalty = isConvex ? 0 : 0.1;
          const confidence = (areaConfidence * 0.4 + aspectConfidence * 0.6) - convexPenalty;

          if (confidence > 0.1) {
            candidates.push({
              found: true,
              corners: extractCorners(approx),
              confidence,
              aspectRatio,
              area,
            });
          }
        }
      }

      approx.delete();
    }

    if (candidates.length === 0) {
      return [];
    }

    // Sort by area (largest first)
    candidates.sort((a, b) => b.area - a.area);

    // Size consistency filter with tighter tolerance
    const areas = candidates.map(c => c.area);
    const medianArea = areas[Math.floor(areas.length / 2)];

    const filteredCards = candidates.filter(c => {
      const sizeRatio = c.area / medianArea;
      return sizeRatio >= (1 - CORRECTED_SIZE_TOLERANCE) && sizeRatio <= (1 + CORRECTED_SIZE_TOLERANCE);
    });

    console.log(`[detectCardsInCorrectedFrame] Found ${candidates.length} candidates, ${filteredCards.length} after filtering`);

    return filteredCards;
  } catch (err) {
    console.error('[detectCardsInCorrectedFrame] Error:', err);
    return [];
  } finally {
    src?.delete();
    gray?.delete();
    blurred?.delete();
    edges?.delete();
    contours?.delete();
    hierarchy?.delete();
  }
}

/**
 * Crop a card region from a canvas
 * Returns a new canvas with just the card image at high resolution
 */
export function cropCardFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[]
): HTMLCanvasElement | null {
  // Use perspective warp to get a clean rectangular card image
  return warpCardToRectangle(sourceCanvas, corners);
}
