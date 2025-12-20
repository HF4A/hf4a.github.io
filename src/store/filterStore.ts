import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardType, SpectralType, CardSide, FilterState } from '../types/card';

interface FilterStore extends FilterState {
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
  clearFilters: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
}

const initialState: FilterState = {
  cardTypes: [],
  spectralTypes: [],
  sides: [],
  massRange: null,
  radHardRange: null,
  isruRange: null,
  searchQuery: '',
  showUpgradedSide: false,
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

      clearFilters: () => set(initialState),

      setFilters: (filters) => set(filters),
    }),
    {
      name: 'hf4a-filters',
      partialize: (state) => ({
        showUpgradedSide: state.showUpgradedSide,
      }),
    }
  )
);
