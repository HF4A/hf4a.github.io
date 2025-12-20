import { useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import type { Card } from '../types/card';

const fuseOptions = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'ocr.name', weight: 2 },
    { name: 'ocr.description', weight: 1 },
    { name: 'ocr.flavorText', weight: 0.5 },
    { name: 'ocr.rawText', weight: 0.3 },
    { name: 'type', weight: 0.5 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
};

export function useCards() {
  const { cards, isLoading, error, setCards, setError } = useCardStore();
  const filters = useFilterStore();

  // Load cards on mount
  useEffect(() => {
    async function loadCards() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/cards.json`);
        if (!response.ok) throw new Error('Failed to load cards');
        const data = await response.json();
        setCards(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
    loadCards();
  }, [setCards, setError]);

  // Create Fuse instance for search
  const fuse = useMemo(() => new Fuse(cards, fuseOptions), [cards]);

  // Filter and search cards
  const filteredCards = useMemo(() => {
    let result = cards;

    // Apply search query
    if (filters.searchQuery.trim()) {
      const searchResults = fuse.search(filters.searchQuery);
      result = searchResults.map((r) => r.item);
    }

    // Filter by card type
    if (filters.cardTypes.length > 0) {
      result = result.filter((card) => filters.cardTypes.includes(card.type));
    }

    // Filter by spectral type
    if (filters.spectralTypes.length > 0) {
      result = result.filter((card) => {
        const spectral = card.ocr?.spectralType;
        if (!spectral) return false;
        return filters.spectralTypes.includes(spectral as any);
      });
    }

    // Filter by side
    if (filters.sides.length > 0) {
      result = result.filter((card) => {
        const side = card.side?.toLowerCase();
        return side && filters.sides.includes(side as any);
      });
    }

    // Filter by mass range
    if (filters.massRange) {
      result = result.filter((card) => {
        const mass = card.ocr?.stats?.mass;
        if (mass === undefined) return false;
        return mass >= filters.massRange!.min && mass <= filters.massRange!.max;
      });
    }

    // Filter by rad-hard range
    if (filters.radHardRange) {
      result = result.filter((card) => {
        const radHard = card.ocr?.stats?.radHard;
        if (radHard === undefined) return false;
        return radHard >= filters.radHardRange!.min && radHard <= filters.radHardRange!.max;
      });
    }

    // Filter by ISRU range
    if (filters.isruRange) {
      result = result.filter((card) => {
        const isru = card.ocr?.stats?.isru;
        if (isru === undefined) return false;
        return isru >= filters.isruRange!.min && isru <= filters.isruRange!.max;
      });
    }

    return result;
  }, [cards, fuse, filters]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const spectralTypes = new Set<string>();
    const sides = new Set<string>();
    let maxMass = 0;
    let maxRadHard = 0;
    let maxIsru = 0;

    cards.forEach((card) => {
      types.add(card.type);
      if (card.ocr?.spectralType) spectralTypes.add(card.ocr.spectralType);
      if (card.side) sides.add(card.side.toLowerCase());
      if (card.ocr?.stats?.mass !== undefined) maxMass = Math.max(maxMass, card.ocr.stats.mass);
      if (card.ocr?.stats?.radHard !== undefined) maxRadHard = Math.max(maxRadHard, card.ocr.stats.radHard);
      if (card.ocr?.stats?.isru !== undefined) maxIsru = Math.max(maxIsru, card.ocr.stats.isru);
    });

    return {
      types: Array.from(types).sort(),
      spectralTypes: Array.from(spectralTypes).sort(),
      sides: Array.from(sides).sort(),
      maxMass,
      maxRadHard,
      maxIsru,
    };
  }, [cards]);

  return {
    cards: filteredCards,
    allCards: cards,
    isLoading,
    error,
    filterOptions,
    totalCount: cards.length,
    filteredCount: filteredCards.length,
  };
}

export function useCardById(id: string | undefined): Card | undefined {
  const { cards } = useCardStore();
  return useMemo(() => cards.find((c) => c.id === id || c.filename === id), [cards, id]);
}

export function useRelatedCards(card: Card | undefined): Card[] {
  const { cards } = useCardStore();
  return useMemo(() => {
    if (!card?.relatedCards) return [];
    const related: Card[] = [];
    Object.values(card.relatedCards).forEach((filename) => {
      const found = cards.find((c) => c.filename === filename);
      if (found) related.push(found);
    });
    return related;
  }, [cards, card]);
}
