/**
 * Card Matcher Service
 *
 * Uses dHash perceptual hashing to identify cards from camera images.
 * Loads pre-computed hashes from card-index.json and compares against
 * hashes computed from detected card regions in the camera feed.
 */

export interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  hash: string;
  hashBytes: number[];
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
// Set to 18 (~28% bit difference) - balances false positives vs recognition rate
// With perspective warp, matches typically come in at 17-22 distance
const MAX_MATCH_DISTANCE = 18;

// Distance at which we consider it a very confident match
const CONFIDENT_DISTANCE = 10;

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
        this.index = await response.json();
        this.loaded = true;
        console.log(`[CardMatcher] Loaded ${this.index.length} card hashes`);
      } catch (error) {
        console.error('[CardMatcher] Failed to load index:', error);
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
   */
  matchFromHashWithDebug(queryHash: number[]): MatchResultWithDebug {
    if (!this.loaded) {
      throw new Error('Card index not loaded. Call loadIndex() first.');
    }

    const results: MatchResult[] = [];
    const allDistances: { cardId: string; distance: number }[] = [];

    for (const entry of this.index) {
      const distance = hammingDistance(queryHash, entry.hashBytes);
      allDistances.push({ cardId: entry.cardId, distance });

      if (distance <= MAX_MATCH_DISTANCE) {
        // Calculate confidence: 1.0 at distance 0, decreasing to 0.3 at MAX_MATCH_DISTANCE
        const confidence =
          distance <= CONFIDENT_DISTANCE
            ? 1.0 - (distance / CONFIDENT_DISTANCE) * 0.3 // 1.0 to 0.7 for confident matches
            : 0.7 - ((distance - CONFIDENT_DISTANCE) / (MAX_MATCH_DISTANCE - CONFIDENT_DISTANCE)) * 0.4; // 0.7 to 0.3 for uncertain matches

        results.push({
          filename: entry.filename,
          cardId: entry.cardId,
          side: entry.side,
          distance,
          confidence: Math.max(0, Math.min(1, confidence)),
        });
      }
    }

    // Sort by distance (best first)
    results.sort((a, b) => a.distance - b.distance);
    allDistances.sort((a, b) => a.distance - b.distance);

    return {
      matches: results,
      computedHash: hashToHex(queryHash),
      topMatches: allDistances.slice(0, 5), // Top 5 closest matches for debugging
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
   */
  matchFromCanvasWithDebug(
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ): MatchResultWithDebug {
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

    // Find matches with debug info
    return this.matchFromHashWithDebug(queryHash);
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
