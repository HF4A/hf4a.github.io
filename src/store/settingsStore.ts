import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardType } from '../types/card';

export type DefaultMode = 'scan' | 'catalog';
export type DefaultScanResult = 'visible' | 'opposite';

// All card types in the game
export const ALL_CARD_TYPES: CardType[] = [
  'thruster',
  'reactor',
  'generator',
  'radiator',
  'robonaut',
  'refinery',
  'crew',
  'gw-thruster',
  'freighter',
  'colonist',
  'bernal',
  'contract',
  'spaceborn',
];

// Card types grouped by module (for display purposes)
export const CARD_TYPE_GROUPS: { name: string; types: CardType[] }[] = [
  {
    name: 'Core Game',
    types: ['thruster', 'reactor', 'generator', 'radiator', 'robonaut', 'refinery'],
  },
  {
    name: 'Module 0: Politics',
    types: ['crew'],
  },
  {
    name: 'Module 1: Terawatt',
    types: ['gw-thruster', 'freighter'],
  },
  {
    name: 'Module 2: Colonization',
    types: ['colonist', 'bernal'],
  },
  {
    name: 'Module 4: Exodus',
    types: ['contract', 'spaceborn'],
  },
];

// Human-readable labels for card types
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  thruster: 'Thrusters',
  reactor: 'Reactors',
  generator: 'Generators',
  radiator: 'Radiators',
  robonaut: 'Robonauts',
  refinery: 'Refineries',
  crew: 'Crew',
  'gw-thruster': 'GW Thrusters',
  freighter: 'Freighters',
  colonist: 'Colonists',
  bernal: 'Bernals',
  contract: 'Contracts',
  spaceborn: 'Spaceborn',
  exodus: 'Exodus', // Legacy - not used
  unknown: 'Unknown',
};

// Legacy module definitions (for migration)
export const MODULE_CARD_TYPES: Record<number, CardType[]> = {
  [-1]: ['thruster', 'reactor', 'generator', 'radiator', 'robonaut', 'refinery'],
  0: ['gw-thruster', 'freighter', 'colonist', 'bernal'],
  1: ['crew'],
  2: ['contract'],
  3: ['spaceborn'],
};

export const MODULE_LABELS: Record<number, string> = {
  0: 'Module 0: Politics',
  1: 'Module 1: Terawatt',
  2: 'Module 2: Colonization',
  3: 'Module 4: Exodus',
};

interface SettingsState {
  // Settings
  defaultMode: DefaultMode;
  defaultScanResult: DefaultScanResult;
  hasSeenWelcome: boolean;
  activeModules: number[]; // Legacy - kept for migration
  activeCardTypes: CardType[]; // New - individual card type toggles

  // Actions
  setDefaultMode: (mode: DefaultMode) => void;
  setDefaultScanResult: (result: DefaultScanResult) => void;
  setHasSeenWelcome: (seen: boolean) => void;
  setActiveModules: (modules: number[]) => void;
  toggleModule: (module: number) => void;
  setActiveCardTypes: (types: CardType[]) => void;
  toggleCardType: (type: CardType) => void;
  isCardTypeActive: (type: CardType) => boolean;

  // Computed
  getActiveCardTypes: () => CardType[];
}

// Default active card types (core + common expansions)
const DEFAULT_ACTIVE_TYPES: CardType[] = [
  'thruster',
  'reactor',
  'generator',
  'radiator',
  'robonaut',
  'refinery',
  'crew',
  'gw-thruster',
  'freighter',
  'colonist',
  'bernal',
  'contract',
  'spaceborn',
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default values
      defaultMode: 'scan',
      defaultScanResult: 'visible',
      hasSeenWelcome: false,
      activeModules: [0, 1, 2], // Legacy
      activeCardTypes: DEFAULT_ACTIVE_TYPES,

      // Actions
      setDefaultMode: (mode) => set({ defaultMode: mode }),
      setDefaultScanResult: (result) => set({ defaultScanResult: result }),
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
      setActiveModules: (modules) => set({ activeModules: modules }),
      toggleModule: (module) => {
        const current = get().activeModules;
        if (current.includes(module)) {
          set({ activeModules: current.filter((m) => m !== module) });
        } else {
          set({ activeModules: [...current, module].sort() });
        }
      },

      setActiveCardTypes: (types) => set({ activeCardTypes: types }),

      toggleCardType: (type) => {
        const current = get().activeCardTypes;
        if (current.includes(type)) {
          set({ activeCardTypes: current.filter((t) => t !== type) });
        } else {
          set({ activeCardTypes: [...current, type] });
        }
      },

      isCardTypeActive: (type) => get().activeCardTypes.includes(type),

      // Computed: Get all active card types
      getActiveCardTypes: () => get().activeCardTypes,
    }),
    {
      name: 'showxating-settings',
      // Migration: convert old activeModules to activeCardTypes
      onRehydrateStorage: () => (state) => {
        if (state && !state.activeCardTypes?.length && state.activeModules?.length) {
          // Migrate from modules to individual types
          const types: CardType[] = [...MODULE_CARD_TYPES[-1]];
          for (const mod of state.activeModules) {
            if (MODULE_CARD_TYPES[mod]) {
              types.push(...MODULE_CARD_TYPES[mod]);
            }
          }
          state.activeCardTypes = types;
        }
      },
    }
  )
);
