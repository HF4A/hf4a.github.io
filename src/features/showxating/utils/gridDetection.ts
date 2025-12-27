/**
 * Grid Detection Utility
 *
 * Detects NxM grid structure from card bounding boxes.
 * Used for both bbox merge logic and grid results view.
 */

import type { Point } from '../store/showxatingStore';

export interface GridCell {
  row: number;
  col: number;
}

export interface GridStructure {
  rowBoundaries: number[];  // Y values that separate rows
  colBoundaries: number[];  // X values that separate columns
  rowCentroids: number[];   // Y centroid for each row
  colCentroids: number[];   // X centroid for each column
  numRows: number;
  numCols: number;
}

export interface GridDimensions {
  rows: number;
  cols: number;
}

/**
 * Get center point from corner array
 */
export function getCenter(corners: Point[]): Point {
  return {
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  };
}

/**
 * Get bounding box from corner array
 */
export function getBounds(corners: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.min(...corners.map(p => p.x)),
    maxX: Math.max(...corners.map(p => p.x)),
    minY: Math.min(...corners.map(p => p.y)),
    maxY: Math.max(...corners.map(p => p.y)),
  };
}

/**
 * Calculate average bbox size from array of corner arrays
 */
export function getAverageSize(cornerArrays: Point[][]): number {
  if (cornerArrays.length === 0) return 100; // Default fallback

  return cornerArrays.reduce((sum, corners) => {
    const bounds = getBounds(corners);
    return sum + ((bounds.maxY - bounds.minY) + (bounds.maxX - bounds.minX)) / 2;
  }, 0) / cornerArrays.length;
}

/**
 * Detect grid structure from a set of center points.
 * Uses gap detection to cluster Y values into rows and X values into columns.
 */
export function detectGridStructure(centers: Point[], avgSize: number): GridStructure {
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
export function assignToGridCell(center: Point, grid: GridStructure): GridCell {
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
export function cellKey(cell: GridCell): string {
  return `${cell.row},${cell.col}`;
}

/**
 * Parse a cell key back into row/col
 */
export function parseKey(key: string): GridCell {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

/**
 * Determine grid dimensions using 3-phase fallback:
 * Phase A: Explicit API response (gridRows/gridCols)
 * Phase B: Infer from API bboxes
 * Phase C: Infer from OpenCV bboxes
 */
export function determineGridDimensions(
  apiGridRows?: number,
  apiGridCols?: number,
  apiBboxes?: Point[][],
  opencvBboxes?: Point[][]
): GridDimensions {
  // Phase A: Explicit from API
  if (apiGridRows && apiGridCols && apiGridRows > 0 && apiGridCols > 0) {
    console.log(`[GridDetection] Phase A: Using API explicit grid ${apiGridRows}x${apiGridCols}`);
    return { rows: apiGridRows, cols: apiGridCols };
  }

  // Phase B: Infer from API bboxes
  if (apiBboxes && apiBboxes.length > 0) {
    const centers = apiBboxes.map(getCenter);
    const avgSize = getAverageSize(apiBboxes);
    const grid = detectGridStructure(centers, avgSize);

    if (grid.numRows > 0 && grid.numCols > 0) {
      console.log(`[GridDetection] Phase B: Inferred from API bboxes ${grid.numRows}x${grid.numCols}`);
      return { rows: grid.numRows, cols: grid.numCols };
    }
  }

  // Phase C: Infer from OpenCV bboxes
  if (opencvBboxes && opencvBboxes.length > 0) {
    const centers = opencvBboxes.map(getCenter);
    const avgSize = getAverageSize(opencvBboxes);
    const grid = detectGridStructure(centers, avgSize);

    if (grid.numRows > 0 && grid.numCols > 0) {
      console.log(`[GridDetection] Phase C: Inferred from OpenCV bboxes ${grid.numRows}x${grid.numCols}`);
      return { rows: grid.numRows, cols: grid.numCols };
    }
  }

  // Fallback: estimate from count
  const count = Math.max(
    apiBboxes?.length || 0,
    opencvBboxes?.length || 0,
    1
  );

  // Try to make a reasonable grid (prefer squarish)
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  console.log(`[GridDetection] Fallback: Estimated ${rows}x${cols} from count ${count}`);
  return { rows, cols };
}

/**
 * Build a complete grid cell mapping from bboxes
 * Returns a Map of cellKey -> bbox index
 *
 * If explicit dimensions provided, use fixed grid assignment (divide space evenly).
 * Otherwise, infer grid from bbox positions.
 */
export function buildGridCellMap(
  bboxes: Point[][],
  explicitRows?: number,
  explicitCols?: number
): Map<string, number> {
  if (bboxes.length === 0) return new Map();

  const centers = bboxes.map(getCenter);
  const cellMap = new Map<string, number>();

  // If explicit dimensions provided, use fixed grid assignment
  if (explicitRows && explicitCols && explicitRows > 0 && explicitCols > 0) {
    // Find bounding box of all centers
    const allX = centers.map(c => c.x);
    const allY = centers.map(c => c.y);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    // Add padding to avoid edge cases
    const padX = (maxX - minX) * 0.1 || 50;
    const padY = (maxY - minY) * 0.1 || 50;
    const gridMinX = minX - padX;
    const gridMaxX = maxX + padX;
    const gridMinY = minY - padY;
    const gridMaxY = maxY + padY;

    const cellWidth = (gridMaxX - gridMinX) / explicitCols;
    const cellHeight = (gridMaxY - gridMinY) / explicitRows;

    bboxes.forEach((_, index) => {
      const center = centers[index];
      const col = Math.min(Math.floor((center.x - gridMinX) / cellWidth), explicitCols - 1);
      const row = Math.min(Math.floor((center.y - gridMinY) / cellHeight), explicitRows - 1);
      const key = cellKey({ row, col });

      // Only set if not already occupied (first card wins)
      if (!cellMap.has(key)) {
        cellMap.set(key, index);
      }
    });

    return cellMap;
  }

  // Fallback: infer grid from bbox positions
  const avgSize = getAverageSize(bboxes);
  const grid = detectGridStructure(centers, avgSize);

  bboxes.forEach((_, index) => {
    const cell = assignToGridCell(centers[index], grid);
    const key = cellKey(cell);
    cellMap.set(key, index);
  });

  return cellMap;
}

/**
 * Generate all cell keys for a given grid dimension
 * Returns keys in reading order (left-to-right, top-to-bottom)
 */
export function getAllCellKeys(rows: number, cols: number): string[] {
  const keys: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      keys.push(cellKey({ row, col }));
    }
  }
  return keys;
}
