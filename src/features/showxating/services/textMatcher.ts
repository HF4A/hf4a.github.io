/**
 * Text Matching Service
 *
 * Fuzzy text matching against card metadata using Fuse.js.
 * Two-pass approach: type-segmented search first, then broad search.
 *
 * v0.3.0: Primary matching method (hash is secondary)
 */

import Fuse from 'fuse.js';
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

export interface TextMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  type: string;
  name: string;
  score: number;          // 0 = perfect match, 1 = no match (Fuse.js convention)
  matchedOn: 'type' | 'title' | 'fullText';
  matchedText: string;    // The text that matched
}

// Card index cache
let cardIndex: CardIndexEntry[] | null = null;
let indexLoadPromise: Promise<void> | null = null;

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
 * Match OCR results against card index
 * Two-pass approach for better accuracy
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

  // Parse detected type from OCR
  const detectedType = parseTypeFromText(ocrResult.typeText);
  log.debug(`[TextMatcher] Detected type: ${detectedType || 'unknown'}`);

  // Pass 1: Type-segmented search (if we detected a type)
  if (detectedType && activeTypes.has(detectedType as CardType)) {
    const typeFiltered = activeCards.filter(c => c.type === detectedType);

    if (typeFiltered.length > 0) {
      // Search by title within type
      const titleResults = fuzzySearchByName(typeFiltered, ocrResult.titleText);

      // If we got a good match (score < 0.3), use it
      if (titleResults.length > 0 && titleResults[0].score < 0.3) {
        log.debug(`[TextMatcher] Pass 1 hit: ${titleResults[0].cardId} (score: ${titleResults[0].score.toFixed(3)})`);
        return titleResults.map(r => ({ ...r, matchedOn: 'title' as const }));
      }

      // Try matching on full text within type
      const fullTextResults = fuzzySearchByName(typeFiltered, ocrResult.fullText);
      if (fullTextResults.length > 0 && fullTextResults[0].score < 0.4) {
        log.debug(`[TextMatcher] Pass 1 fullText hit: ${fullTextResults[0].cardId} (score: ${fullTextResults[0].score.toFixed(3)})`);
        return fullTextResults.map(r => ({ ...r, matchedOn: 'fullText' as const }));
      }
    }
  }

  // Pass 2: Broad search across all active types
  log.debug('[TextMatcher] Pass 2: Broad search');

  // Try title text first
  if (ocrResult.titleText) {
    const titleResults = fuzzySearchByName(activeCards, ocrResult.titleText);
    if (titleResults.length > 0 && titleResults[0].score < 0.4) {
      log.debug(`[TextMatcher] Pass 2 title hit: ${titleResults[0].cardId} (score: ${titleResults[0].score.toFixed(3)})`);
      return titleResults.map(r => ({ ...r, matchedOn: 'title' as const }));
    }
  }

  // Try full text
  if (ocrResult.fullText) {
    const fullTextResults = fuzzySearchByName(activeCards, ocrResult.fullText);
    if (fullTextResults.length > 0) {
      log.debug(`[TextMatcher] Pass 2 fullText: ${fullTextResults[0].cardId} (score: ${fullTextResults[0].score.toFixed(3)})`);
      return fullTextResults.map(r => ({ ...r, matchedOn: 'fullText' as const }));
    }
  }

  log.debug('[TextMatcher] No matches found');
  return [];
}

/**
 * Fuzzy search cards by name
 */
function fuzzySearchByName(
  cards: CardIndexEntry[],
  searchText: string
): TextMatchResult[] {
  if (!searchText || searchText.length < 2) {
    return [];
  }

  const fuse = new Fuse(cards, {
    keys: ['name'],
    threshold: 0.5,         // Allow loose matching
    includeScore: true,
    ignoreLocation: true,   // Match anywhere in string
    minMatchCharLength: 2,
  });

  const results = fuse.search(searchText);

  return results.slice(0, 10).map(result => ({
    cardId: result.item.cardId,
    filename: result.item.filename,
    side: result.item.side,
    type: result.item.type,
    name: result.item.name,
    score: result.score || 1,
    matchedOn: 'title' as const,
    matchedText: searchText,
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
