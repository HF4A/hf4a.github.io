/**
 * Match Fusion Service
 *
 * Combines text matching (OCR) and hash matching (dHash) for robust card identification.
 * Text matching is primary (85% weight), hash matching is secondary (15%).
 *
 * v0.3.0: Fusion logic for hybrid matching approach
 * v0.3.9: Better confidence calibration, use matchQuality, improved diagnostics
 */

import type { OCRResult } from './ocrService';
import type { TextMatchResult, CardIndexEntry, MatchQuality } from './textMatcher';
import { matchByText, loadCardIndex } from './textMatcher';
import { log } from '../../../store/logsStore';

export interface HashMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  type: string;
  name: string;
  distance: number;       // Hamming distance (0 = perfect match)
  normalizedScore: number; // 0 = perfect, 1 = no match (for fusion)
}

export interface FusedMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  type: string;
  name: string;
  fusedScore: number;     // 0 = perfect match, 1 = no match
  textScore: number;      // Text match contribution
  hashScore: number;      // Hash match contribution
  matchSource: 'text' | 'hash' | 'fused'; // Primary match source
  confidence: 'high' | 'medium' | 'low';
  textMatchQuality: MatchQuality;  // Quality of text match for debugging
  diagnostics: FusionDiagnostics;
}

export interface FusionDiagnostics {
  textMatches: TextMatchResult[];
  hashMatches: HashMatchResult[];
  textWeight: number;
  hashWeight: number;
  fusionMethod: 'weighted' | 'text-only' | 'hash-only' | 'none';
  ocrHadContent: boolean;        // Did OCR extract any text?
  rejectionReason?: string;      // Why was match rejected (if applicable)
}

// Fusion weights
const TEXT_WEIGHT = 0.85;
const HASH_WEIGHT = 0.15;

// Confidence thresholds
const HIGH_CONFIDENCE_THRESHOLD = 0.25;    // fusedScore < 0.25
const MEDIUM_CONFIDENCE_THRESHOLD = 0.45;  // fusedScore < 0.45

// Maximum Hamming distance for hash matching (out of 64 bits)
const MAX_HAMMING_DISTANCE = 64;
const HASH_MATCH_THRESHOLD = 22; // Previously tuned value

// Hash-only match rejection threshold
// If OCR completely fails and hash is worse than this, prefer "unknown"
const HASH_ONLY_REJECT_DISTANCE = 18; // Stricter threshold for hash-only matches

/**
 * Compute dHash from a canvas (client-side version)
 * Returns 8 bytes representing 64-bit hash
 */
export async function computeDHashFromCanvas(
  canvas: HTMLCanvasElement
): Promise<number[]> {
  // Create a small canvas for hashing
  const hashCanvas = document.createElement('canvas');
  const HASH_WIDTH = 9;
  const HASH_HEIGHT = 8;
  hashCanvas.width = HASH_WIDTH;
  hashCanvas.height = HASH_HEIGHT;

  const ctx = hashCanvas.getContext('2d');
  if (!ctx) {
    log.error('[HashMatcher] Failed to create canvas context');
    return [];
  }

  // Draw resized and grayscaled
  ctx.drawImage(canvas, 0, 0, HASH_WIDTH, HASH_HEIGHT);
  const imageData = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  const data = imageData.data;

  // Convert to grayscale values
  const grayValues: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Standard grayscale conversion
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grayValues.push(gray);
  }

  // Compute difference hash
  const bits: boolean[] = [];
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const leftPixel = grayValues[y * HASH_WIDTH + x];
      const rightPixel = grayValues[y * HASH_WIDTH + x + 1];
      bits.push(leftPixel > rightPixel);
    }
  }

  // Convert bits to bytes
  const hashBytes: number[] = [];
  for (let i = 0; i < 64; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (bits[i + j]) {
        byte |= (1 << (7 - j));
      }
    }
    hashBytes.push(byte);
  }

  return hashBytes;
}

/**
 * Calculate Hamming distance between two byte arrays
 */
export function hammingDistance(hash1: number[], hash2: number[]): number {
  if (hash1.length !== hash2.length || hash1.length === 0) {
    return MAX_HAMMING_DISTANCE;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    let xor = hash1[i] ^ hash2[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Match a card image by dHash against the card index
 */
export async function matchByHash(
  cardCanvas: HTMLCanvasElement
): Promise<HashMatchResult[]> {
  const index = await loadCardIndex();
  const targetHash = await computeDHashFromCanvas(cardCanvas);

  if (targetHash.length === 0) {
    log.warn('[HashMatcher] Failed to compute hash from canvas');
    return [];
  }

  // Compute distances for all cards
  const matches: HashMatchResult[] = [];

  for (const card of index) {
    const distance = hammingDistance(targetHash, card.hashBytes);

    if (distance <= HASH_MATCH_THRESHOLD) {
      matches.push({
        cardId: card.cardId,
        filename: card.filename,
        side: card.side,
        type: card.type,
        name: card.name,
        distance,
        normalizedScore: distance / MAX_HAMMING_DISTANCE,
      });
    }
  }

  // Sort by distance (closest first)
  matches.sort((a, b) => a.distance - b.distance);

  log.debug(`[HashMatcher] Found ${matches.length} matches within threshold ${HASH_MATCH_THRESHOLD}`);

  return matches.slice(0, 10);
}

/**
 * Fuse text and hash matching results
 * Primary matching method for v0.3.0 pipeline
 * v0.3.9: Better diagnostics, use textMatchQuality, stricter rejection
 */
export async function fuseMatches(
  ocrResult: OCRResult,
  cardCanvas: HTMLCanvasElement
): Promise<FusedMatchResult | null> {
  // Check if OCR extracted meaningful text
  const ocrHadContent = ocrResult.typeText.length > 2 || ocrResult.titleText.length > 2;

  // Run both matching methods
  const [textMatches, hashMatches] = await Promise.all([
    matchByText(ocrResult),
    matchByHash(cardCanvas),
  ]);

  const diagnostics: FusionDiagnostics = {
    textMatches,
    hashMatches,
    textWeight: TEXT_WEIGHT,
    hashWeight: HASH_WEIGHT,
    fusionMethod: 'weighted',
    ocrHadContent,
  };

  // Case 1: No matches at all
  if (textMatches.length === 0 && hashMatches.length === 0) {
    diagnostics.fusionMethod = 'none';
    diagnostics.rejectionReason = 'No text or hash matches found';
    log.debug('[MatchFusion] No matches from either method');
    return null;
  }

  // Case 2: Only text matches
  if (hashMatches.length === 0) {
    diagnostics.fusionMethod = 'text-only';
    const best = textMatches[0];
    const fusedScore = best.score;

    return {
      cardId: best.cardId,
      filename: best.filename,
      side: best.side,
      type: best.type,
      name: best.name,
      fusedScore,
      textScore: best.score,
      hashScore: 1, // No hash match
      matchSource: 'text',
      confidence: getConfidenceFromQuality(best.matchQuality),
      textMatchQuality: best.matchQuality,
      diagnostics,
    };
  }

  // Case 3: Only hash matches (text matching failed)
  if (textMatches.length === 0) {
    diagnostics.fusionMethod = 'hash-only';
    const best = hashMatches[0];

    // If OCR had content but text matching found nothing, be skeptical of hash
    // This likely means the card isn't in our index, or OCR was garbage
    if (ocrHadContent && best.distance > HASH_ONLY_REJECT_DISTANCE) {
      diagnostics.rejectionReason = `OCR had content but text match failed, hash too weak (${best.distance} > ${HASH_ONLY_REJECT_DISTANCE})`;
      log.info(`[MatchFusion] Rejecting: ${diagnostics.rejectionReason}`);
      return null;
    }

    // If OCR had NO content, be very skeptical of hash
    if (!ocrHadContent && best.distance > HASH_ONLY_REJECT_DISTANCE) {
      diagnostics.rejectionReason = `No OCR content, hash too weak (${best.distance} > ${HASH_ONLY_REJECT_DISTANCE})`;
      log.info(`[MatchFusion] Rejecting: ${diagnostics.rejectionReason}`);
      return null;
    }

    // Accept hash match but with appropriate confidence
    const confidence = ocrHadContent ? 'low' : (best.distance <= 15 ? 'medium' : 'low');

    return {
      cardId: best.cardId,
      filename: best.filename,
      side: best.side,
      type: best.type,
      name: best.name,
      fusedScore: best.normalizedScore,
      textScore: 1, // No text match
      hashScore: best.normalizedScore,
      matchSource: 'hash',
      confidence,
      textMatchQuality: 'none',
      diagnostics,
    };
  }

  // Case 4: Both methods have matches - fuse them
  // Build a map of cardId -> scores
  const scoreMap = new Map<string, { textScore: number; hashScore: number; card: CardIndexEntry }>();

  // Add text matches
  for (const tm of textMatches) {
    scoreMap.set(tm.cardId, {
      textScore: tm.score,
      hashScore: 1, // Default if no hash match
      card: { cardId: tm.cardId, filename: tm.filename, side: tm.side, type: tm.type, name: tm.name, hash: '', hashBytes: [] },
    });
  }

  // Merge hash matches
  for (const hm of hashMatches) {
    const existing = scoreMap.get(hm.cardId);
    if (existing) {
      existing.hashScore = hm.normalizedScore;
    } else {
      scoreMap.set(hm.cardId, {
        textScore: 1, // Default if no text match
        hashScore: hm.normalizedScore,
        card: { cardId: hm.cardId, filename: hm.filename, side: hm.side, type: hm.type, name: hm.name, hash: '', hashBytes: [] },
      });
    }
  }

  // Calculate fused scores and find best match
  let bestMatch: FusedMatchResult | null = null;
  let bestFusedScore = Infinity;

  for (const [cardId, scores] of scoreMap) {
    const fusedScore = (scores.textScore * TEXT_WEIGHT) + (scores.hashScore * HASH_WEIGHT);

    if (fusedScore < bestFusedScore) {
      bestFusedScore = fusedScore;

      // Determine primary match source
      let matchSource: 'text' | 'hash' | 'fused';
      if (scores.textScore < 0.3 && scores.hashScore < 0.3) {
        matchSource = 'fused';
      } else if (scores.textScore < scores.hashScore) {
        matchSource = 'text';
      } else {
        matchSource = 'hash';
      }

      // Get text match quality if we have a text match for this card
      const textMatchForCard = textMatches.find(tm => tm.cardId === cardId);
      const textMatchQuality: MatchQuality = textMatchForCard?.matchQuality || 'none';

      bestMatch = {
        cardId,
        filename: scores.card.filename,
        side: scores.card.side,
        type: scores.card.type,
        name: scores.card.name,
        fusedScore,
        textScore: scores.textScore,
        hashScore: scores.hashScore,
        matchSource,
        confidence: textMatchQuality !== 'none'
          ? getConfidenceFromQuality(textMatchQuality)
          : getConfidence(fusedScore),
        textMatchQuality,
        diagnostics,
      };
    }
  }

  if (bestMatch) {
    log.info(`[MatchFusion] Best match: ${bestMatch.cardId} (fused: ${bestMatch.fusedScore.toFixed(3)}, text: ${bestMatch.textScore.toFixed(3)}, hash: ${bestMatch.hashScore.toFixed(3)})`);
  }

  return bestMatch;
}

/**
 * Get confidence level from fused score
 */
function getConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score < HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score < MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Get confidence level from match quality
 * More intuitive than using fused scores
 */
function getConfidenceFromQuality(quality: MatchQuality): 'high' | 'medium' | 'low' {
  switch (quality) {
    case 'excellent': return 'high';
    case 'good': return 'high';
    case 'fair': return 'medium';
    case 'poor': return 'low';
    case 'none': return 'low';
    default: return 'low';
  }
}

/**
 * Quick hash-only match for fallback scenarios
 * Used when OCR fails or is unavailable
 */
export async function quickHashMatch(
  cardCanvas: HTMLCanvasElement
): Promise<HashMatchResult | null> {
  const matches = await matchByHash(cardCanvas);
  return matches.length > 0 ? matches[0] : null;
}
