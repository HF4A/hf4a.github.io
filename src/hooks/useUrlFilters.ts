import { useEffect, useRef } from 'react';
import { useFilterStore } from '../store/filterStore';
import type { CardType, SpectralType, ReactorType } from '../types/card';

// Valid values for validation
const VALID_CARD_TYPES: CardType[] = [
  'thruster', 'reactor', 'generator', 'radiator', 'robonaut',
  'refinery', 'colonist', 'bernal', 'freighter', 'gw-thruster',
  'crew', 'contract', 'spaceborn', 'exodus', 'unknown'
];
const VALID_SPECTRAL_TYPES: SpectralType[] = ['C', 'D', 'H', 'M', 'S', 'V', 'G', 'K', 'Y', 'Any'];
const VALID_REACTOR_TYPES: ReactorType[] = ['X', 'wave', 'bomb'];
const VALID_GENERATOR_TYPES = ['push', 'electric'] as const;
const VALID_SPECIALTIES = ['Engineer', 'Miner', 'Prospector', 'Scientist', 'Pilot', 'Commander'];

export function useUrlFilters() {
  const initialized = useRef(false);
  const {
    cardTypes,
    spectralTypes,
    specialties,
    reactorTypes,
    generatorTypes,
    searchQuery,
    showFlipped,
    setCardTypes,
    setSpectralTypes,
    setSearchQuery,
    setFilters,
    toggleFlipped,
  } = useFilterStore();

  // Read filters from URL on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);

    // Parse type (single value)
    const typeParam = params.get('type');
    if (typeParam && VALID_CARD_TYPES.includes(typeParam as CardType)) {
      setCardTypes([typeParam as CardType]);
    }

    // Parse spectral (comma-separated)
    const spectralParam = params.get('spectral');
    if (spectralParam) {
      const types = spectralParam.split(',').filter(t =>
        VALID_SPECTRAL_TYPES.includes(t as SpectralType)
      ) as SpectralType[];
      if (types.length > 0) {
        setFilters({ spectralTypes: types });
      }
    }

    // Parse specialty (comma-separated)
    const specialtyParam = params.get('specialty');
    if (specialtyParam) {
      const specs = specialtyParam.split(',').filter(s =>
        VALID_SPECIALTIES.includes(s)
      );
      if (specs.length > 0) {
        setFilters({ specialties: specs });
      }
    }

    // Parse reactor (comma-separated)
    const reactorParam = params.get('reactor');
    if (reactorParam) {
      const types = reactorParam.split(',').filter(t =>
        VALID_REACTOR_TYPES.includes(t as ReactorType)
      ) as ReactorType[];
      if (types.length > 0) {
        setFilters({ reactorTypes: types });
      }
    }

    // Parse generator (comma-separated)
    const generatorParam = params.get('generator');
    if (generatorParam) {
      const types = generatorParam.split(',').filter(t =>
        VALID_GENERATOR_TYPES.includes(t as typeof VALID_GENERATOR_TYPES[number])
      ) as ('push' | 'electric')[];
      if (types.length > 0) {
        setFilters({ generatorTypes: types });
      }
    }

    // Parse search
    const searchParam = params.get('q');
    if (searchParam) {
      setSearchQuery(searchParam);
    }

    // Parse flipped
    const flippedParam = params.get('promoted');
    if (flippedParam === 'true') {
      toggleFlipped();
    }
  }, [setCardTypes, setSpectralTypes, setSearchQuery, setFilters, toggleFlipped]);

  // Update URL when filters change
  useEffect(() => {
    if (!initialized.current) return;

    const params = new URLSearchParams();

    // Type (single value)
    if (cardTypes.length === 1) {
      params.set('type', cardTypes[0]);
    }

    // Spectral types
    if (spectralTypes.length > 0) {
      params.set('spectral', spectralTypes.join(','));
    }

    // Specialties
    if (specialties.length > 0) {
      params.set('specialty', specialties.join(','));
    }

    // Reactor types
    if (reactorTypes.length > 0) {
      params.set('reactor', reactorTypes.join(','));
    }

    // Generator types
    if (generatorTypes.length > 0) {
      params.set('generator', generatorTypes.join(','));
    }

    // Search query
    if (searchQuery) {
      params.set('q', searchQuery);
    }

    // Show promoted
    if (showFlipped) {
      params.set('promoted', 'true');
    }

    // Update URL without triggering navigation
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [cardTypes, spectralTypes, specialties, reactorTypes, generatorTypes, searchQuery, showFlipped]);
}
