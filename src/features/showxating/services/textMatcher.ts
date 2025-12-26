/**
 * Text Matching Service
 *
 * Progressive fuzzy text matching against card metadata using Fuse.js.
 * Strategy: Start narrow (detected type), progressively widen if needed.
 *
 * v0.3.0: Primary matching method (hash is secondary)
 * v0.3.5: Progressive matching with intelligent text extraction
 * v0.3.9: Reject type-only matches, add match quality tracking, better diagnostics
 */

import Fuse, { type FuseResult } from 'fuse.js';
import type { CardType } from '../../../types/card';
import { useSettingsStore } from '../../../store/settingsStore';
import { log } from '../../../store/logsStore';
import type { OCRResult } from './ocrService';
import { parseTypeFromText } from './ocrService';

export interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  type: string;
  name: string;
  hash: string;
  hashBytes: number[];
}

// Match quality levels for confidence calibration
export type MatchQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

export interface TextMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  type: string;
  name: string;
  score: number;          // 0 = perfect match, 1 = no match (Fuse.js convention)
  matchedOn: 'title' | 'fullText';
  matchedText: string;    // The text that matched
  matchQuality: MatchQuality;  // Quality assessment for confidence calibration
}

// Card index cache
let cardIndex: CardIndexEntry[] | null = null;
let indexLoadPromise: Promise<void> | null = null;

// Common words to filter out (not useful for matching)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'is', 'it',
  'mass', 'thrust', 'isp', 'crew', 'turns', 'cost', 'net', 'op', 'ops',
]);

// Card type words - should NEVER be used as match candidates
// Matching "radiator" to a radiator card is not useful - we need the NAME
const TYPE_WORDS = new Set([
  'thruster', 'thrusters',
  'generator', 'generators', 'generato', // OCR sometimes cuts off
  'reactor', 'reactors', 'revctor', // OCR misreads
  'radiator', 'radiators',
  'refinery', 'refineries',
  'robonaut', 'robonauts',
  'colonist', 'colonists',
  'freighter', 'freighters',
  'bernal', 'bernals',
  'contract', 'contracts',
  'crew',
  'exodus',
  'spaceborn',
  'gw', 'gwthruster',
]);

/**
 * Load the card index
 */
export async function loadCardIndex(): Promise<CardIndexEntry[]> {
  if (cardIndex) return cardIndex;

  if (!indexLoadPromise) {
    indexLoadPromise = (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}data/card-index.json`);
      if (!response.ok) {
        throw new Error(`Failed to load card index: ${response.status}`);
      }
      cardIndex = await response.json();
      log.info(`[TextMatcher] Loaded card index: ${cardIndex!.length} entries`);
    })();
  }

  await indexLoadPromise;
  return cardIndex!;
}

/**
 * Get active card types from settings
 */
function getActiveTypes(): Set<string> {
  const store = useSettingsStore.getState();
  return new Set(store.activeCardTypes);
}

/**
 * Check if a candidate is just a type word (useless for matching)
 */
function isTypeOnlyCandidate(candidate: string): boolean {
  const words = candidate.toLowerCase().split(' ');
  // If ALL words are type words, reject
  return words.every(w => TYPE_WORDS.has(w) || w.length < 3);
}

/**
 * Generate text candidates from OCR text - progressive word combinations
 * Returns candidates sorted by specificity (longer = more specific = try first)
 * Filters out type-only candidates that would cause false matches
 */
function generateCandidates(text: string, filterTypeWords: boolean = true): string[] {
  if (!text) return [];

  // Clean the text
  const cleaned = text
    .replace(/["""''()[\]{}|\\/<>@#$%^&*+=~`]/g, ' ')  // Remove special chars
    .replace(/\d+/g, ' ')                               // Remove numbers
    .replace(/\s+/g, ' ')                               // Normalize whitespace
    .trim()
    .toLowerCase();

  if (cleaned.length < 2) return [];

  // Extract meaningful words (filter stop words and short words)
  const words = cleaned.split(' ').filter(w =>
    w.length >= 2 && !STOP_WORDS.has(w)
  );

  if (words.length === 0) return [];

  const candidates: string[] = [];

  // Generate all contiguous word combinations (sliding window)
  // Longer combinations first (more specific)
  for (let len = words.length; len >= 1; len--) {
    for (let start = 0; start <= words.length - len; start++) {
      const phrase = words.slice(start, start + len).join(' ');
      if (phrase.length >= 3) {
        // Filter out type-only candidates if requested
        if (filterTypeWords && isTypeOnlyCandidate(phrase)) {
          continue;
        }
        candidates.push(phrase);
      }
    }
  }

  // Dedupe while preserving order (longer phrases first)
  return [...new Set(candidates)];
}

/**
 * Assess match quality based on score
 */
function assessMatchQuality(score: number): MatchQuality {
  if (score < 0.1) return 'excellent';
  if (score < 0.25) return 'good';
  if (score < 0.4) return 'fair';
  if (score < 0.6) return 'poor';
  return 'none';
}

/**
 * Progressive matching within a card set
 * Tries candidates from most specific to least, returns best match
 */
function progressiveMatch(
  cards: CardIndexEntry[],
  candidates: string[],
  threshold: number
): { results: FuseResult<CardIndexEntry>[]; matchedText: string; quality: MatchQuality } | null {
  if (cards.length === 0 || candidates.length === 0) return null;

  const fuse = new Fuse(cards, {
    keys: ['name'],
    threshold,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  let bestResults: FuseResult<CardIndexEntry>[] = [];
  let bestScore = 1;
  let bestMatchedText = '';

  for (const candidate of candidates) {
    const results = fuse.search(candidate);

    if (results.length > 0) {
      const score = results[0].score ?? 1;

      // Accept if under threshold and better than current best
      if (score < threshold && score < bestScore) {
        bestResults = results;
        bestScore = score;
        bestMatchedText = candidate;

        // If we get a really good match, stop early
        if (score < 0.15) {
          log.debug(`[TextMatcher] Excellent match: "${candidate}" → ${results[0].item.name} (${score.toFixed(3)})`);
          break;
        }
      }
    }
  }

  if (bestResults.length > 0) {
    const quality = assessMatchQuality(bestScore);
    return { results: bestResults, matchedText: bestMatchedText, quality };
  }

  return null;
}

/**
 * Match OCR results against card index
 * Progressive strategy: narrow type → loose type → all types
 * v0.3.9: Rejects type-only matches to prevent false positives
 */
export async function matchByText(
  ocrResult: OCRResult
): Promise<TextMatchResult[]> {
  const index = await loadCardIndex();
  const activeTypes = getActiveTypes();

  // Filter to only active card types
  const activeCards = index.filter(card => activeTypes.has(card.type as CardType));

  if (activeCards.length === 0) {
    log.warn('[TextMatcher] No active card types to match against');
    return [];
  }

  // Generate candidates from title and full text
  // Filter type words to prevent "radiator" matching to random radiator card
  const titleCandidates = generateCandidates(ocrResult.titleText, true);
  const fullTextCandidates = generateCandidates(ocrResult.fullText, true);

  const hasTitleCandidates = titleCandidates.length > 0;
  const hasFullTextCandidates = fullTextCandidates.length > 0;

  log.debug(`[TextMatcher] Generated ${titleCandidates.length} title candidates, ${fullTextCandidates.length} fullText candidates`);
  if (titleCandidates.length > 0) {
    log.debug(`[TextMatcher] Top title candidates: ${titleCandidates.slice(0, 5).join(', ')}`);
  }

  // If we have NO useful candidates (only type words), return early
  if (!hasTitleCandidates && !hasFullTextCandidates) {
    log.debug('[TextMatcher] No useful candidates after filtering type words - returning empty');
    return [];
  }

  // Parse detected type from OCR
  const detectedType = parseTypeFromText(ocrResult.typeText);
  log.debug(`[TextMatcher] Detected type: ${detectedType || 'unknown'}`);

  // PHASE 1: Type-constrained matching (if we detected a type)
  if (detectedType && activeTypes.has(detectedType as CardType)) {
    const typeFiltered = activeCards.filter(c => c.type === detectedType);
    log.debug(`[TextMatcher] Phase 1: Searching ${typeFiltered.length} ${detectedType} cards`);

    if (typeFiltered.length > 0) {
      // Try title candidates first (strict threshold)
      let match = progressiveMatch(typeFiltered, titleCandidates, 0.4);
      if (match && match.results[0].score! < 0.3) {
        log.info(`[TextMatcher] Phase 1 title hit: ${match.results[0].item.cardId} via "${match.matchedText}" (${match.results[0].score!.toFixed(3)}) [${match.quality}]`);
        return formatResults(match.results, match.matchedText, 'title', match.quality);
      }

      // Try full text candidates (looser threshold)
      match = progressiveMatch(typeFiltered, fullTextCandidates, 0.5);
      if (match && match.results[0].score! < 0.4) {
        log.info(`[TextMatcher] Phase 1 fullText hit: ${match.results[0].item.cardId} via "${match.matchedText}" (${match.results[0].score!.toFixed(3)}) [${match.quality}]`);
        return formatResults(match.results, match.matchedText, 'fullText', match.quality);
      }

      // Phase 1b: Loosen threshold within type, but ONLY if we have title candidates
      // This prevents matching just because we know the type
      if (hasTitleCandidates) {
        match = progressiveMatch(typeFiltered, titleCandidates, 0.5);
        if (match) {
          log.info(`[TextMatcher] Phase 1b loose hit: ${match.results[0].item.cardId} via "${match.matchedText}" (${match.results[0].score!.toFixed(3)}) [${match.quality}]`);
          return formatResults(match.results, match.matchedText, 'title', match.quality);
        }
      }
    }
  }

  // PHASE 2: Expand to all active types (only if we have real candidates)
  if (hasTitleCandidates || hasFullTextCandidates) {
    log.debug(`[TextMatcher] Phase 2: Searching all ${activeCards.length} active cards`);

    // Try title candidates
    let match = progressiveMatch(activeCards, titleCandidates, 0.4);
    if (match) {
      log.info(`[TextMatcher] Phase 2 title hit: ${match.results[0].item.cardId} via "${match.matchedText}" (${match.results[0].score!.toFixed(3)}) [${match.quality}]`);
      return formatResults(match.results, match.matchedText, 'title', match.quality);
    }

    // Try full text candidates
    match = progressiveMatch(activeCards, fullTextCandidates, 0.5);
    if (match) {
      log.info(`[TextMatcher] Phase 2 fullText hit: ${match.results[0].item.cardId} via "${match.matchedText}" (${match.results[0].score!.toFixed(3)}) [${match.quality}]`);
      return formatResults(match.results, match.matchedText, 'fullText', match.quality);
    }
  }

  log.debug('[TextMatcher] No matches found');
  return [];
}

/**
 * Format Fuse results into TextMatchResult array
 */
function formatResults(
  results: FuseResult<CardIndexEntry>[],
  matchedText: string,
  matchedOn: 'title' | 'fullText',
  matchQuality: MatchQuality
): TextMatchResult[] {
  return results.slice(0, 10).map(result => ({
    cardId: result.item.cardId,
    filename: result.item.filename,
    side: result.item.side,
    type: result.item.type,
    name: result.item.name,
    score: result.score || 1,
    matchedOn,
    matchedText,
    matchQuality,
  }));
}

/**
 * Direct type matching - find all cards of a given type
 */
export async function getCardsByType(type: string): Promise<CardIndexEntry[]> {
  const index = await loadCardIndex();
  const activeTypes = getActiveTypes();

  if (!activeTypes.has(type as CardType)) {
    return [];
  }

  return index.filter(c => c.type === type);
}

/**
 * Get a card by its ID
 */
export async function getCardById(cardId: string): Promise<CardIndexEntry | null> {
  const index = await loadCardIndex();
  return index.find(c => c.cardId === cardId) || null;
}
