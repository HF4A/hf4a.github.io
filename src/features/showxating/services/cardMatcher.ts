/**
 * Card Matcher Service
 *
 * Uses dHash perceptual hashing to identify cards from camera images.
 * Loads pre-computed hashes from card-index.json and compares against
 * hashes computed from detected card regions in the camera feed.
 *
 * Two-stage matching (v0.2.8):
 * 1. Detect card type from visual features (top-left icon area)
 * 2. Filter candidates to detected type, then hash match
 */

import type { CardType } from '../../../types/card';
import { useSettingsStore } from '../../../store/settingsStore';
import { log } from '../../../store/logsStore';

/**
 * Card type detection based on icon region color analysis
 * Returns array of likely types (most likely first)
 */
export interface TypeDetectionResult {
  detectedTypes: CardType[];
  confidence: number;
  dominantHue: number;
  dominantSaturation: number;
}

// Type icon color signatures (HSL ranges)
// HF4A cards have distinctive type icons in top-left corner
const TYPE_COLOR_SIGNATURES: {
  type: CardType;
  hueRange: [number, number]; // Hue 0-360
  satRange: [number, number]; // Saturation 0-1
  lightRange: [number, number]; // Lightness 0-1
}[] = [
  // Thruster/GW-Thruster: Yellow-orange flame
  { type: 'thruster', hueRange: [30, 60], satRange: [0.5, 1.0], lightRange: [0.4, 0.8] },
  { type: 'gw-thruster', hueRange: [30, 60], satRange: [0.5, 1.0], lightRange: [0.4, 0.8] },
  // Reactor: Red-orange atom
  { type: 'reactor', hueRange: [0, 30], satRange: [0.5, 1.0], lightRange: [0.3, 0.7] },
  // Generator: Yellow lightning
  { type: 'generator', hueRange: [45, 70], satRange: [0.6, 1.0], lightRange: [0.5, 0.9] },
  // Radiator: Blue-cyan waves
  { type: 'radiator', hueRange: [180, 220], satRange: [0.4, 1.0], lightRange: [0.4, 0.8] },
  // Robonaut: Gray/metallic (low saturation)
  { type: 'robonaut', hueRange: [0, 360], satRange: [0.0, 0.3], lightRange: [0.3, 0.7] },
  // Refinery: Brown-orange
  { type: 'refinery', hueRange: [15, 45], satRange: [0.4, 0.8], lightRange: [0.3, 0.6] },
  // Contract: Blue header
  { type: 'contract', hueRange: [200, 250], satRange: [0.3, 0.8], lightRange: [0.3, 0.7] },
  // Bernal: Purple
  { type: 'bernal', hueRange: [260, 310], satRange: [0.3, 0.8], lightRange: [0.3, 0.7] },
  // Colonist: Various (person icon) - detected by process of elimination
  { type: 'colonist', hueRange: [0, 360], satRange: [0.2, 0.6], lightRange: [0.4, 0.7] },
  // Crew: Various (person icon)
  { type: 'crew', hueRange: [0, 360], satRange: [0.3, 0.7], lightRange: [0.4, 0.7] },
  // Freighter: Gray/metallic ship
  { type: 'freighter', hueRange: [0, 360], satRange: [0.0, 0.3], lightRange: [0.3, 0.6] },
  // Spaceborn: Various
  { type: 'spaceborn', hueRange: [0, 360], satRange: [0.2, 0.7], lightRange: [0.3, 0.7] },
];

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s, l];
}

/**
 * Detect card type from the icon region (top-left area)
 * Analyzes color distribution to determine most likely card type(s)
 */
export function detectCardTypeFromCanvas(
  canvas: HTMLCanvasElement,
  region?: { x: number; y: number; width: number; height: number }
): TypeDetectionResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { detectedTypes: [], confidence: 0, dominantHue: 0, dominantSaturation: 0 };
  }

  // Define the icon region (top-left 25% of card)
  const srcX = region?.x ?? 0;
  const srcY = region?.y ?? 0;
  const srcW = region?.width ?? canvas.width;
  const srcH = region?.height ?? canvas.height;

  // Icon is in top-left corner, roughly 25% width and 15% height
  const iconX = srcX;
  const iconY = srcY;
  const iconW = Math.floor(srcW * 0.25);
  const iconH = Math.floor(srcH * 0.15);

  // Get pixel data from icon region
  const imageData = ctx.getImageData(iconX, iconY, iconW, iconH);
  const data = imageData.data;

  // Calculate average HSL in the icon region
  let totalH = 0;
  let totalS = 0;
  let totalL = 0;
  let pixelCount = 0;

  // Also track color histogram for better detection
  const hueHistogram: number[] = new Array(36).fill(0); // 10-degree bins

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    // Skip very dark or very light pixels (likely background)
    if (l < 0.1 || l > 0.95) continue;

    totalH += h;
    totalS += s;
    totalL += l;
    pixelCount++;

    // Add to histogram
    const hueBin = Math.floor(h / 10) % 36;
    hueHistogram[hueBin]++;
  }

  if (pixelCount === 0) {
    return { detectedTypes: [], confidence: 0, dominantHue: 0, dominantSaturation: 0 };
  }

  // avgH not used - dominantHue from histogram is more robust
  const avgS = totalS / pixelCount;
  const avgL = totalL / pixelCount;

  // Find dominant hue from histogram
  let maxBin = 0;
  let maxCount = 0;
  for (let i = 0; i < 36; i++) {
    if (hueHistogram[i] > maxCount) {
      maxCount = hueHistogram[i];
      maxBin = i;
    }
  }
  const dominantHue = maxBin * 10 + 5; // Center of bin

  // Score each card type based on color match
  const typeScores: { type: CardType; score: number }[] = [];

  for (const sig of TYPE_COLOR_SIGNATURES) {
    let score = 0;

    // Check hue match (wrap around for red hues near 0/360)
    const hueInRange =
      sig.hueRange[0] <= sig.hueRange[1]
        ? dominantHue >= sig.hueRange[0] && dominantHue <= sig.hueRange[1]
        : dominantHue >= sig.hueRange[0] || dominantHue <= sig.hueRange[1];

    if (hueInRange) score += 2;

    // Check saturation match
    if (avgS >= sig.satRange[0] && avgS <= sig.satRange[1]) score += 1;

    // Check lightness match
    if (avgL >= sig.lightRange[0] && avgL <= sig.lightRange[1]) score += 1;

    if (score > 0) {
      typeScores.push({ type: sig.type, score });
    }
  }

  // Sort by score descending
  typeScores.sort((a, b) => b.score - a.score);

  // Get unique types (thruster and gw-thruster might both match)
  const seenTypes = new Set<CardType>();
  const detectedTypes: CardType[] = [];
  for (const { type } of typeScores) {
    if (!seenTypes.has(type)) {
      seenTypes.add(type);
      detectedTypes.push(type);
    }
  }

  // Calculate confidence based on best score
  const maxScore = typeScores.length > 0 ? typeScores[0].score : 0;
  const confidence = maxScore / 4; // Max possible score is 4

  log.debug(`Type detection: hue=${dominantHue.toFixed(0)}, sat=${avgS.toFixed(2)}, types=${detectedTypes.slice(0, 3).join(',')}`);

  return {
    detectedTypes: detectedTypes.slice(0, 5), // Top 5 likely types
    confidence,
    dominantHue,
    dominantSaturation: avgS,
  };
}

export interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  hash: string;
  hashBytes: number[];
  type?: CardType; // Derived from cardId
}

/**
 * Extract card type from cardId (e.g., "bernal-01" -> "bernal")
 */
function getTypeFromCardId(cardId: string): CardType {
  const typeStr = cardId.replace(/-\d+$/, '').toLowerCase();
  // Handle special cases
  if (typeStr === 'gw-thruster') return 'gw-thruster';
  return typeStr as CardType;
}

/**
 * Get currently active card types from settings
 */
function getActiveTypes(): Set<CardType> {
  const store = useSettingsStore.getState();
  return new Set<CardType>(store.activeCardTypes);
}

export interface MatchResult {
  filename: string;
  cardId: string;
  side: string | null;
  distance: number;
  confidence: number; // 0-1, where 1 is perfect match
}

export interface MatchResultWithDebug {
  matches: MatchResult[];
  computedHash: string;
  topMatches: { cardId: string; distance: number }[];
}

// Maximum Hamming distance to consider a match (out of 64 bits)
// Set to 22 (~34% bit difference) - allows matches despite perspective distortion
// With perspective warp, matches typically come in at 21-25 distance
const MAX_MATCH_DISTANCE = 22;

// Distance at which we consider it a very confident match
const CONFIDENT_DISTANCE = 14;

/**
 * Compute dHash from an ImageData object (from canvas)
 * Returns 8-byte array representing 64-bit hash
 */
export function computeDHashFromImageData(imageData: ImageData): number[] {
  const { data, width, height } = imageData;

  // We need to resize to 9x8 and convert to grayscale
  // Since canvas already resized the image for us, we just need grayscale
  if (width !== 9 || height !== 8) {
    throw new Error(`Expected 9x8 image, got ${width}x${height}`);
  }

  // Convert to grayscale array
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // Standard luminance formula
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Compute difference hash
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const leftPixel = gray[y * 9 + x];
      const rightPixel = gray[y * 9 + x + 1];
      bits.push(leftPixel > rightPixel);
    }
  }

  // Convert bits to bytes
  const hashBytes: number[] = [];
  for (let i = 0; i < 64; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (bits[i + j]) {
        byte |= 1 << (7 - j);
      }
    }
    hashBytes.push(byte);
  }

  return hashBytes;
}

/**
 * Calculate Hamming distance between two 8-byte hashes
 */
export function hammingDistance(hash1: number[], hash2: number[]): number {
  let distance = 0;
  for (let i = 0; i < 8; i++) {
    let xor = hash1[i] ^ hash2[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Convert hash bytes to hex string for display
 */
export function hashToHex(hashBytes: number[]): string {
  return hashBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * CardMatcher class for identifying cards
 */
export class CardMatcher {
  private index: CardIndexEntry[] = [];
  private loaded = false;
  private loading: Promise<void> | null = null;

  /**
   * Load the card index from the pre-computed JSON file
   */
  async loadIndex(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/card-index.json`);
        if (!response.ok) {
          throw new Error(`Failed to load card index: ${response.status}`);
        }
        const rawIndex: CardIndexEntry[] = await response.json();
        // Add type to each entry
        this.index = rawIndex.map((entry) => ({
          ...entry,
          type: getTypeFromCardId(entry.cardId),
        }));
        this.loaded = true;
        log.info(`Card index loaded: ${this.index.length} hashes`);
      } catch (error) {
        log.error('Failed to load card index', { error: String(error) });
        throw error;
      }
    })();

    return this.loading;
  }

  /**
   * Check if the index is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get the number of cards in the index
   */
  getIndexSize(): number {
    return this.index.length;
  }

  /**
   * Match a card image against the index
   *
   * @param canvas - Canvas element containing the card image
   * @param region - Optional region within the canvas to match (default: entire canvas)
   * @returns Array of match results, sorted by distance (best first)
   */
  matchFromCanvas(
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ): MatchResult[] {
    if (!this.loaded) {
      throw new Error('Card index not loaded. Call loadIndex() first.');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Create a temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 9;
    tempCanvas.height = 8;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('Could not create temp canvas context');
    }

    // Draw the region (or entire canvas) scaled to 9x8
    const srcX = region?.x ?? 0;
    const srcY = region?.y ?? 0;
    const srcW = region?.width ?? canvas.width;
    const srcH = region?.height ?? canvas.height;

    tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, 9, 8);

    // Get the image data and compute hash
    const imageData = tempCtx.getImageData(0, 0, 9, 8);
    const queryHash = computeDHashFromImageData(imageData);

    // Find matches
    return this.matchFromHash(queryHash);
  }

  /**
   * Match a hash against the index
   */
  matchFromHash(queryHash: number[]): MatchResult[] {
    return this.matchFromHashWithDebug(queryHash).matches;
  }

  /**
   * Match a hash against the index with debug info
   * Only matches cards from active modules
   */
  matchFromHashWithDebug(queryHash: number[], detectedTypes?: CardType[]): MatchResultWithDebug {
    if (!this.loaded) {
      throw new Error('Card index not loaded. Call loadIndex() first.');
    }

    const activeTypes = getActiveTypes();
    const results: MatchResult[] = [];
    const allDistances: { cardId: string; distance: number }[] = [];

    // If we have detected types, create a filter set
    const typeFilter = detectedTypes && detectedTypes.length > 0
      ? new Set(detectedTypes)
      : null;

    for (const entry of this.index) {
      // Skip cards not in active modules
      if (entry.type && !activeTypes.has(entry.type)) {
        continue;
      }

      // If we detected types, prefer matching within those types
      // But still compute distance for all for debug output
      const distance = hammingDistance(queryHash, entry.hashBytes);

      const isPreferredType = !typeFilter || (entry.type && typeFilter.has(entry.type));

      // Add to allDistances for debug (mark with type info)
      allDistances.push({ cardId: entry.cardId, distance });

      // For type-filtered matching, use stricter threshold for non-matching types
      const effectiveThreshold = isPreferredType ? MAX_MATCH_DISTANCE : MAX_MATCH_DISTANCE - 5;

      if (distance <= effectiveThreshold) {
        // Calculate confidence: higher for preferred types
        let confidence =
          distance <= CONFIDENT_DISTANCE
            ? 1.0 - (distance / CONFIDENT_DISTANCE) * 0.3
            : 0.7 - ((distance - CONFIDENT_DISTANCE) / (MAX_MATCH_DISTANCE - CONFIDENT_DISTANCE)) * 0.4;

        // Boost confidence for type matches
        if (isPreferredType && typeFilter) {
          confidence = Math.min(1.0, confidence + 0.15);
        }

        results.push({
          filename: entry.filename,
          cardId: entry.cardId,
          side: entry.side,
          distance,
          confidence: Math.max(0, Math.min(1, confidence)),
        });
      }
    }

    // Sort by distance (best first), but with type preference
    results.sort((a, b) => {
      // If we have type filter, prefer matching types
      if (typeFilter) {
        const aType = getTypeFromCardId(a.cardId);
        const bType = getTypeFromCardId(b.cardId);
        const aMatches = typeFilter.has(aType);
        const bMatches = typeFilter.has(bType);

        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }
      return a.distance - b.distance;
    });

    allDistances.sort((a, b) => a.distance - b.distance);

    if (typeFilter) {
      log.debug(`Type-filtered matching: ${typeFilter.size} types, ${results.length} matches`);
    }

    return {
      matches: results,
      computedHash: hashToHex(queryHash),
      topMatches: allDistances.slice(0, 5),
    };
  }

  /**
   * Get the best match for a card image
   */
  getBestMatch(
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ): MatchResult | null {
    const matches = this.matchFromCanvas(canvas, region);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Match from canvas with debug info
   * Now includes type detection for two-stage matching (v0.2.8)
   */
  matchFromCanvasWithDebug(
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ): MatchResultWithDebug & { detectedTypes?: CardType[] } {
    if (!this.loaded) {
      throw new Error('Card index not loaded. Call loadIndex() first.');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Step 1: Detect card type from icon region
    const typeResult = detectCardTypeFromCanvas(canvas, region);
    const detectedTypes = typeResult.detectedTypes;

    // Step 2: Create a temporary canvas for resizing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 9;
    tempCanvas.height = 8;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('Could not create temp canvas context');
    }

    // Draw the region (or entire canvas) scaled to 9x8
    const srcX = region?.x ?? 0;
    const srcY = region?.y ?? 0;
    const srcW = region?.width ?? canvas.width;
    const srcH = region?.height ?? canvas.height;

    tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, 9, 8);

    // Get the image data and compute hash
    const imageData = tempCtx.getImageData(0, 0, 9, 8);
    const queryHash = computeDHashFromImageData(imageData);

    // Step 3: Find matches with type-aware filtering
    const result = this.matchFromHashWithDebug(queryHash, detectedTypes);

    return {
      ...result,
      detectedTypes,
    };
  }

  /**
   * Match from an HTMLImageElement
   */
  matchFromImage(image: HTMLImageElement): MatchResult[] {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas context');
    }
    ctx.drawImage(image, 0, 0);
    return this.matchFromCanvas(canvas);
  }

  /**
   * Match from a video frame
   */
  matchFromVideo(
    video: HTMLVideoElement,
    region?: { x: number; y: number; width: number; height: number }
  ): MatchResult[] {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas context');
    }
    ctx.drawImage(video, 0, 0);
    return this.matchFromCanvas(canvas, region);
  }
}

// Singleton instance
let matcherInstance: CardMatcher | null = null;

export function getCardMatcher(): CardMatcher {
  if (!matcherInstance) {
    matcherInstance = new CardMatcher();
  }
  return matcherInstance;
}
