import { useMemo } from 'react';
import { useFilterStore } from '../store/filterStore';
import { useCardStore } from '../store/cardStore';
import { CARD_TYPE_LABELS, SPECIALTY_LABELS, REACTOR_TYPE_LABELS } from '../types/card';
import type { CardType, SpectralType, ReactorType, Specialty, Card } from '../types/card';

// Ordered list of card types for the filter
const TYPE_ORDER: CardType[] = [
  'thruster',
  'robonaut',
  'refinery',
  'reactor',
  'generator',
  'radiator',
  'gw-thruster',
  'freighter',
  'bernal',
  'colonist',
  'crew',
  'contract',
  'spaceborn',
  'unknown',
  'exodus',
];

// Check if a card is a base-side card
function isBaseSide(card: Card): boolean {
  if (!card.side) return true;
  const side = card.side.toLowerCase();
  if (card.upgradeChain && card.upgradeChain.length > 0) {
    const baseSide = card.upgradeChain[0].toLowerCase();
    return side === baseSide;
  }
  return true;
}

export function FilterBar() {
  const {
    cardTypes,
    spectralTypes,
    specialties,
    reactorTypes,
    generatorTypes,
    showFlipped,
    setCardTypes,
    toggleSpectralType,
    toggleSpecialty,
    toggleReactorType,
    toggleGeneratorType,
    toggleFlipped,
    clearFilters,
  } = useFilterStore();

  const { cards } = useCardStore();

  const hasFilters = cardTypes.length > 0 || spectralTypes.length > 0 ||
    specialties.length > 0 || reactorTypes.length > 0 || generatorTypes.length > 0;

  // Get base-side cards only for counting
  const baseCards = useMemo(() => {
    return cards.filter(isBaseSide);
  }, [cards]);

  // Calculate counts for type filter (affected by spectral filter)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Filter by spectral if needed
    let filteredCards = baseCards;
    if (spectralTypes.length > 0) {
      filteredCards = baseCards.filter(c => {
        const spectral = c.ocr?.spectralType;
        return spectral && spectralTypes.includes(spectral as SpectralType);
      });
    }

    // Count unique cards per type
    const typeGroups: Record<string, Set<string>> = {};
    filteredCards.forEach(c => {
      if (!typeGroups[c.type]) typeGroups[c.type] = new Set();
      typeGroups[c.type].add(c.cardGroupId || c.id);
    });

    Object.entries(typeGroups).forEach(([type, groups]) => {
      counts[type] = groups.size;
    });

    return counts;
  }, [baseCards, spectralTypes]);

  // Calculate counts for spectral filter (affected by type filter)
  const spectralCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Filter by type if needed
    let filteredCards = baseCards;
    if (cardTypes.length > 0) {
      filteredCards = baseCards.filter(c => cardTypes.includes(c.type));
    }

    // Count unique cards per spectral type
    const spectralGroups: Record<string, Set<string>> = {};
    filteredCards.forEach(c => {
      const spectral = c.ocr?.spectralType;
      if (spectral) {
        if (!spectralGroups[spectral]) spectralGroups[spectral] = new Set();
        spectralGroups[spectral].add(c.cardGroupId || c.id);
      }
    });

    Object.entries(spectralGroups).forEach(([spectral, groups]) => {
      counts[spectral] = groups.size;
    });

    return counts;
  }, [baseCards, cardTypes]);

  // Get available types and sort them
  const orderedTypes = useMemo(() => {
    const types = [...new Set(baseCards.map(c => c.type))];
    return types.sort((a, b) => {
      const aIndex = TYPE_ORDER.indexOf(a as CardType);
      const bIndex = TYPE_ORDER.indexOf(b as CardType);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [baseCards]);

  // Get available spectral types
  const spectralOptions = useMemo(() => {
    const types = new Set<string>();
    baseCards.forEach(c => {
      if (c.ocr?.spectralType) types.add(c.ocr.spectralType);
    });
    return Array.from(types).sort();
  }, [baseCards]);

  // Get available specialties (from colonist cards)
  const specialtyOptions = useMemo(() => {
    const specs = new Set<string>();
    baseCards.forEach(c => {
      if (c.spreadsheet?.specialty) specs.add(c.spreadsheet.specialty);
    });
    return Array.from(specs).sort();
  }, [baseCards]);

  // Calculate specialty counts
  const specialtyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let filteredCards = baseCards;
    if (cardTypes.length > 0) {
      filteredCards = baseCards.filter(c => cardTypes.includes(c.type));
    }
    filteredCards.forEach(c => {
      const spec = c.spreadsheet?.specialty;
      if (spec) {
        counts[spec] = (counts[spec] || 0) + 1;
      }
    });
    return counts;
  }, [baseCards, cardTypes]);

  // Get available reactor types
  const reactorTypeOptions = useMemo(() => {
    const types = new Set<string>();
    baseCards.forEach(c => {
      if (c.ocr?.stats?.reactorType) types.add(c.ocr.stats.reactorType);
    });
    return Array.from(types).sort();
  }, [baseCards]);

  // Calculate reactor type counts
  const reactorTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let filteredCards = baseCards;
    if (cardTypes.length > 0) {
      filteredCards = baseCards.filter(c => cardTypes.includes(c.type));
    }
    filteredCards.forEach(c => {
      const rt = c.ocr?.stats?.reactorType;
      if (rt) {
        counts[rt] = (counts[rt] || 0) + 1;
      }
    });
    return counts;
  }, [baseCards, cardTypes]);

  // Get available generator types
  const generatorTypeOptions = useMemo(() => {
    const types = new Set<string>();
    baseCards.forEach(c => {
      if (c.ocr?.stats?.generatorType) types.add(c.ocr.stats.generatorType);
    });
    return Array.from(types).sort();
  }, [baseCards]);

  // Calculate generator type counts
  const generatorTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let filteredCards = baseCards;
    if (cardTypes.length > 0) {
      filteredCards = baseCards.filter(c => cardTypes.includes(c.type));
    }
    filteredCards.forEach(c => {
      const gt = c.ocr?.stats?.generatorType;
      if (gt) {
        counts[gt] = (counts[gt] || 0) + 1;
      }
    });
    return counts;
  }, [baseCards, cardTypes]);

  // Handle single-select type toggle
  const handleTypeSelect = (type: string) => {
    const cardType = type as CardType;
    if (cardTypes.includes(cardType)) {
      setCardTypes([]);
    } else {
      setCardTypes([cardType]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Card Type Filter - Single Select */}
      <SingleSelectFilter
        label="Type"
        options={orderedTypes}
        selected={cardTypes[0] || null}
        onSelect={handleTypeSelect}
        getLabel={(type) => CARD_TYPE_LABELS[type as CardType] || type}
        getCounts={(type) => typeCounts[type] || 0}
      />

      {/* Spectral Type Filter */}
      <FilterDropdown
        label="Spectral"
        options={spectralOptions}
        selected={spectralTypes}
        onToggle={(type) => toggleSpectralType(type as SpectralType)}
        getLabel={(type) => type}
        getCounts={(type) => spectralCounts[type] || 0}
      />

      {/* Specialty Filter - show only when colonist or robonaut type selected */}
      {(cardTypes.includes('colonist') || cardTypes.includes('robonaut')) && specialtyOptions.length > 0 && (
        <FilterDropdown
          label="Specialty"
          options={specialtyOptions}
          selected={specialties}
          onToggle={(spec) => toggleSpecialty(spec)}
          getLabel={(spec) => SPECIALTY_LABELS[spec as Specialty] || spec}
          getCounts={(spec) => specialtyCounts[spec] || 0}
        />
      )}

      {/* Reactor Type Filter - show only when reactor type selected */}
      {cardTypes.includes('reactor') && reactorTypeOptions.length > 0 && (
        <FilterDropdown
          label="Reactor"
          options={reactorTypeOptions}
          selected={reactorTypes}
          onToggle={(type) => toggleReactorType(type as ReactorType)}
          getLabel={(type) => REACTOR_TYPE_LABELS[type as ReactorType] || type}
          getCounts={(type) => reactorTypeCounts[type] || 0}
        />
      )}

      {/* Generator Type Filter - show only when generator type selected */}
      {cardTypes.includes('generator') && generatorTypeOptions.length > 0 && (
        <FilterDropdown
          label="Generator"
          options={generatorTypeOptions}
          selected={generatorTypes}
          onToggle={(type) => toggleGeneratorType(type as 'push' | 'electric')}
          getLabel={(type) => type === 'push' ? 'Push (⟛)' : 'Electric (e)'}
          getCounts={(type) => generatorTypeCounts[type] || 0}
        />
      )}

      {/* Flip All Toggle */}
      <button
        onClick={toggleFlipped}
        className={`chip ${showFlipped ? 'chip-active' : ''}`}
      >
        <svg
          className={`w-4 h-4 mr-1 transition-transform ${showFlipped ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {showFlipped ? 'Promoted' : 'Base'}
      </button>

      {/* Clear All */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

interface SingleSelectFilterProps {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
  getLabel: (value: string) => string;
  getCounts: (value: string) => number;
}

function SingleSelectFilter({
  label,
  options,
  selected,
  onSelect,
  getLabel,
  getCounts,
}: SingleSelectFilterProps) {
  return (
    <div className="relative group">
      <button
        className={`chip ${selected ? 'chip-active' : ''}`}
      >
        {selected ? getLabel(selected) : label}
        <svg
          className="ml-1 w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown - opens upward since we're at the bottom */}
      <div className="absolute bottom-full left-0 mb-1 py-2 bg-space-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[180px] max-h-64 overflow-y-auto">
        {options.map((option) => {
          const count = getCounts(option);
          return (
            <button
              key={option}
              onClick={() => onSelect(option)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-space-600 flex items-center justify-between gap-2 ${
                selected === option ? 'bg-space-600 text-white' : 'text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    selected === option
                      ? 'bg-blue-500'
                      : 'border border-gray-500'
                  }`}
                />
                {getLabel(option)}
              </div>
              <span className="text-xs text-gray-500">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel: (value: string) => string;
  getCounts: (value: string) => number;
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  getLabel,
  getCounts,
}: FilterDropdownProps) {
  return (
    <div className="relative group">
      <button
        className={`chip ${selected.length > 0 ? 'chip-active' : ''}`}
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">
            {selected.length}
          </span>
        )}
        <svg
          className="ml-1 w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown - opens upward since we're at the bottom */}
      <div className="absolute bottom-full left-0 mb-1 py-2 bg-space-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px] max-h-64 overflow-y-auto">
        {options.map((option) => {
          const count = getCounts(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-space-600 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded border ${
                    selected.includes(option)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-500'
                  } flex items-center justify-center`}
                >
                  {selected.includes(option) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                {getLabel(option)}
              </div>
              <span className="text-xs text-gray-500">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
