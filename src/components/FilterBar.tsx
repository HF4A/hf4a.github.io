import { useFilterStore } from '../store/filterStore';
import { useCards } from '../hooks/useCards';
import { CARD_TYPE_LABELS } from '../types/card';
import type { CardType, SpectralType, CardSide } from '../types/card';

export function FilterBar() {
  const {
    cardTypes,
    spectralTypes,
    sides,
    showUpgradedSide,
    toggleCardType,
    toggleSpectralType,
    toggleSide,
    toggleShowUpgradedSide,
    clearFilters,
  } = useFilterStore();

  const { filterOptions } = useCards();

  const hasFilters =
    cardTypes.length > 0 ||
    spectralTypes.length > 0 ||
    sides.length > 0;

  return (
    <div className="border-t border-space-700 bg-space-800/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-4">
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

          {/* Side Filter */}
          <FilterDropdown
            label="Side"
            options={filterOptions.sides}
            selected={sides}
            onToggle={(side) => toggleSide(side as CardSide)}
            getLabel={(side) => side.charAt(0).toUpperCase() + side.slice(1)}
          />

          {/* Upgraded Toggle */}
          <button
            onClick={toggleShowUpgradedSide}
            className={`chip ${showUpgradedSide ? 'chip-active' : ''}`}
          >
            <span className="mr-1">{showUpgradedSide ? '✓' : '○'}</span>
            Show Upgraded
          </button>

          {/* Clear All */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Active Filters */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-3">
            {cardTypes.map((type) => (
              <ActiveFilter
                key={type}
                label={CARD_TYPE_LABELS[type] || type}
                onRemove={() => toggleCardType(type)}
              />
            ))}
            {spectralTypes.map((type) => (
              <ActiveFilter
                key={type}
                label={`Spectral: ${type}`}
                onRemove={() => toggleSpectralType(type)}
              />
            ))}
            {sides.map((side) => (
              <ActiveFilter
                key={side}
                label={side.charAt(0).toUpperCase() + side.slice(1)}
                onRemove={() => toggleSide(side)}
              />
            ))}
          </div>
        )}
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

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 py-2 bg-space-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[160px]">
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

interface ActiveFilterProps {
  label: string;
  onRemove: () => void;
}

function ActiveFilter({ label, onRemove }: ActiveFilterProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-sm">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-white"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}
