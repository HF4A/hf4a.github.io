import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardType, SpectralType, CardSide, FilterState, ReactorType } from '../types/card';

interface FilterStore extends FilterState {
  showFlipped: boolean;
  setCardTypes: (types: CardType[]) => void;
  toggleCardType: (type: CardType) => void;
  setSpectralTypes: (types: SpectralType[]) => void;
  toggleSpectralType: (type: SpectralType) => void;
  setSides: (sides: CardSide[]) => void;
  toggleSide: (side: CardSide) => void;
  setMassRange: (range: { min: number; max: number } | null) => void;
  setRadHardRange: (range: { min: number; max: number } | null) => void;
  setIsruRange: (range: { min: number; max: number } | null) => void;
  setSearchQuery: (query: string) => void;
  setShowUpgradedSide: (show: boolean) => void;
  toggleShowUpgradedSide: () => void;
  toggleFlipped: () => void;
  clearFilters: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
  // Advanced filter actions
  toggleSpecialty: (specialty: string) => void;
  toggleReactorType: (type: ReactorType) => void;
  toggleGeneratorType: (type: 'push' | 'electric') => void;
}

interface ExtendedFilterState extends FilterState {
  showFlipped: boolean;
}

const initialState: ExtendedFilterState = {
  cardTypes: [],
  spectralTypes: [],
  sides: [],
  massRange: null,
  radHardRange: null,
  isruRange: null,
  searchQuery: '',
  showUpgradedSide: false,
  showFlipped: false,
  // Advanced filters
  specialties: [],
  reactorTypes: [],
  generatorTypes: [],
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      ...initialState,

      setCardTypes: (types) => set({ cardTypes: types }),

      toggleCardType: (type) =>
        set((state) => ({
          cardTypes: state.cardTypes.includes(type)
            ? state.cardTypes.filter((t) => t !== type)
            : [...state.cardTypes, type],
        })),

      setSpectralTypes: (types) => set({ spectralTypes: types }),

      toggleSpectralType: (type) =>
        set((state) => ({
          spectralTypes: state.spectralTypes.includes(type)
            ? state.spectralTypes.filter((t) => t !== type)
            : [...state.spectralTypes, type],
        })),

      setSides: (sides) => set({ sides }),

      toggleSide: (side) =>
        set((state) => ({
          sides: state.sides.includes(side)
            ? state.sides.filter((s) => s !== side)
            : [...state.sides, side],
        })),

      setMassRange: (range) => set({ massRange: range }),

      setRadHardRange: (range) => set({ radHardRange: range }),

      setIsruRange: (range) => set({ isruRange: range }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setShowUpgradedSide: (show) => set({ showUpgradedSide: show }),

      toggleShowUpgradedSide: () =>
        set((state) => ({ showUpgradedSide: !state.showUpgradedSide })),

      toggleFlipped: () =>
        set((state) => ({ showFlipped: !state.showFlipped })),

      clearFilters: () => set(initialState),

      setFilters: (filters) => set(filters),

      // Advanced filter toggles
      toggleSpecialty: (specialty) =>
        set((state) => ({
          specialties: state.specialties.includes(specialty)
            ? state.specialties.filter((s) => s !== specialty)
            : [...state.specialties, specialty],
        })),

      toggleReactorType: (type) =>
        set((state) => ({
          reactorTypes: state.reactorTypes.includes(type)
            ? state.reactorTypes.filter((t) => t !== type)
            : [...state.reactorTypes, type],
        })),

      toggleGeneratorType: (type) =>
        set((state) => ({
          generatorTypes: state.generatorTypes.includes(type)
            ? state.generatorTypes.filter((t) => t !== type)
            : [...state.generatorTypes, type],
        })),
    }),
    {
      name: 'hf4a-filters',
      partialize: (state) => ({
        showUpgradedSide: state.showUpgradedSide,
      }),
    }
  )
);
