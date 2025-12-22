import type { Point } from '../store/showxatingStore';

export interface DetectionResult {
  found: boolean;
  corners: Point[] | null; // Ordered: TL, TR, BR, BL
  confidence: number;
  aspectRatio: number;
  area: number;
}

// Card aspect ratio is approximately 63mm x 88mm = 0.716 (width/height)
// Or inverted: 1.397 (height/width)
const CARD_ASPECT_RATIO = 88 / 63; // ~1.4
const ASPECT_RATIO_TOLERANCE = 0.3; // Allow some variance
const MIN_AREA_RATIO = 0.04; // Card must be at least 4% of frame (filters out internal card elements)
const MAX_AREA_RATIO = 0.9; // Card can't be more than 90% of frame

/**
 * Detect a card-shaped quadrilateral in the frame
 */
export function detectCardQuadrilateral(
  imageData: ImageData,
  frameWidth: number,
  frameHeight: number
): DetectionResult {
  const cv = window.cv;

  if (!cv || !cv.Mat) {
    return { found: false, corners: null, confidence: 0, aspectRatio: 0, area: 0 };
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

    let bestQuad: Point[] | null = null;
    let bestArea = 0;
    let bestConfidence = 0;
    let bestAspectRatio = 0;

    // Iterate through contours to find card-like quadrilaterals
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Filter by area
      if (area < minArea || area > maxArea) {
        continue;
      }

      // Approximate the contour to a polygon
      // Use larger epsilon (0.04) to smooth rounded corners into 4-point quad
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
            const areaConfidence = Math.min(area / (frameArea * 0.15), 1); // Larger is better up to 15%
            const aspectConfidence = 1 - (minAspectDiff / ASPECT_RATIO_TOLERANCE);
            const confidence = (areaConfidence * 0.4 + aspectConfidence * 0.6);

            // Keep the best match (largest area with reasonable confidence)
            if (area > bestArea && confidence > 0.1) {
              bestArea = area;
              bestConfidence = confidence;
              bestAspectRatio = aspectRatio;
              bestQuad = extractCorners(approx);
            }
          }
        }
      }

      approx.delete();
    }

    return {
      found: bestQuad !== null,
      corners: bestQuad,
      confidence: bestConfidence,
      aspectRatio: bestAspectRatio,
      area: bestArea,
    };
  } catch (err) {
    console.error('Vision pipeline error:', err);
    return { found: false, corners: null, confidence: 0, aspectRatio: 0, area: 0 };
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
