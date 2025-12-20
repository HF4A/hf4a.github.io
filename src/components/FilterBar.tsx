import { useFilterStore } from '../store/filterStore';
import { useCards } from '../hooks/useCards';
import { CARD_TYPE_LABELS } from '../types/card';
import type { CardType, SpectralType } from '../types/card';

export function FilterBar() {
  const {
    cardTypes,
    spectralTypes,
    showFlipped,
    toggleCardType,
    toggleSpectralType,
    toggleFlipped,
    clearFilters,
  } = useFilterStore();

  const { filterOptions } = useCards();

  const hasFilters = cardTypes.length > 0 || spectralTypes.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Card Type Filter */}
      <FilterDropdown
        label="Type"
        options={filterOptions.types}
        selected={cardTypes}
        onToggle={(type) => toggleCardType(type as CardType)}
        getLabel={(type) => CARD_TYPE_LABELS[type as CardType] || type}
      />

      {/* Spectral Type Filter */}
      <FilterDropdown
        label="Spectral"
        options={filterOptions.spectralTypes}
        selected={spectralTypes}
        onToggle={(type) => toggleSpectralType(type as SpectralType)}
        getLabel={(type) => type}
      />

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
        {showFlipped ? 'Upgraded' : 'Base'}
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

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel: (value: string) => string;
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  getLabel,
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
      <div className="absolute bottom-full left-0 mb-1 py-2 bg-space-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px] max-h-64 overflow-y-auto">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-space-600 flex items-center gap-2"
          >
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
          </button>
        ))}
      </div>
    </div>
  );
}
