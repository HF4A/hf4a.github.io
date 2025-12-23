import { useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import { useSettingsStore } from '../store/settingsStore';
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
  const { getActiveCardTypes } = useSettingsStore();

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

  // Get active modules for filtering
  const activeModules = useSettingsStore((state) => state.activeModules);

  // Filter and search cards
  const filteredCards = useMemo(() => {
    // Get active card types from module settings
    const activeTypes = new Set(getActiveCardTypes());

    // First, filter by active modules (card types)
    let result = cards.filter((card) => activeTypes.has(card.type));

    // Then filter to only show base side cards
    // Base side is the first element of upgradeChain
    // Cards without upgrade chains are standalone and all shown
    result = result.filter((card) => {
      // Cards without sides are always shown
      if (!card.side) return true;

      const side = card.side.toLowerCase();

      // If card has an upgrade chain, check if this is the base (first) side
      if (card.upgradeChain && card.upgradeChain.length > 0) {
        const baseSide = card.upgradeChain[0].toLowerCase();
        return side === baseSide;
      }

      // Cards without upgrade chain are standalone - show all of them
      // (e.g., Crew cards which are faction-specific)
      return true;
    });

    // Apply search query
    if (filters.searchQuery.trim()) {
      const searchResults = fuse.search(filters.searchQuery);
      const searchIds = new Set(searchResults.map((r) => r.item.id));
      result = result.filter((card) => searchIds.has(card.id));
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

    // Filter by colonist specialty
    if (filters.specialties.length > 0) {
      result = result.filter((card) => {
        const specialty = card.spreadsheet?.specialty;
        if (!specialty) return false;
        return filters.specialties.includes(specialty);
      });
    }

    // Filter by reactor type
    if (filters.reactorTypes.length > 0) {
      result = result.filter((card) => {
        const reactorType = card.ocr?.stats?.reactorType;
        if (!reactorType) return false;
        return filters.reactorTypes.includes(reactorType as any);
      });
    }

    // Filter by generator type
    if (filters.generatorTypes.length > 0) {
      result = result.filter((card) => {
        const generatorType = card.ocr?.stats?.generatorType;
        if (!generatorType) return false;
        return filters.generatorTypes.includes(generatorType as any);
      });
    }

    return result;
  }, [cards, fuse, filters, activeModules, getActiveCardTypes]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const spectralTypes = new Set<string>();
    const sides = new Set<string>();
    const specialties = new Set<string>();
    const reactorTypes = new Set<string>();
    const generatorTypes = new Set<string>();
    let maxMass = 0;
    let maxRadHard = 0;
    let maxIsru = 0;

    cards.forEach((card) => {
      types.add(card.type);
      if (card.ocr?.spectralType) spectralTypes.add(card.ocr.spectralType);
      if (card.side) sides.add(card.side.toLowerCase());
      if (card.spreadsheet?.specialty) specialties.add(card.spreadsheet.specialty);
      if (card.ocr?.stats?.reactorType) reactorTypes.add(card.ocr.stats.reactorType);
      if (card.ocr?.stats?.generatorType) generatorTypes.add(card.ocr.stats.generatorType);
      if (card.ocr?.stats?.mass !== undefined) maxMass = Math.max(maxMass, card.ocr.stats.mass);
      if (card.ocr?.stats?.radHard !== undefined) maxRadHard = Math.max(maxRadHard, card.ocr.stats.radHard);
      if (card.ocr?.stats?.isru !== undefined) maxIsru = Math.max(maxIsru, card.ocr.stats.isru);
    });

    return {
      types: Array.from(types).sort(),
      spectralTypes: Array.from(spectralTypes).sort(),
      sides: Array.from(sides).sort(),
      specialties: Array.from(specialties).sort(),
      reactorTypes: Array.from(reactorTypes).sort(),
      generatorTypes: Array.from(generatorTypes).sort(),
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
