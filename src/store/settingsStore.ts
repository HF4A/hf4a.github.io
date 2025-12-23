import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardType } from '../types/card';

export type DefaultMode = 'scan' | 'catalog';
export type DefaultScanResult = 'visible' | 'opposite';

// Module definitions for HF4A
// Base: Core patent cards
// Module 0 (Colonization): GW Thrusters, Freighters, Colonists, Bernals
// Module 1 (Politics): Crew
// Module 2 (Failsafe): Contracts
// Module 3 (Exiles): Spaceborn
export const MODULE_CARD_TYPES: Record<number, CardType[]> = {
  [-1]: ['thruster', 'reactor', 'generator', 'radiator', 'robonaut', 'refinery'], // Base (always included)
  0: ['gw-thruster', 'freighter', 'colonist', 'bernal'],
  1: ['crew'],
  2: ['contract'],
  3: ['spaceborn', 'exodus'],
};

export const MODULE_LABELS: Record<number, string> = {
  0: 'Module 0: Colonization',
  1: 'Module 1: Politics',
  2: 'Module 2: Failsafe',
  3: 'Module 3: Exiles',
};

interface SettingsState {
  // Settings
  defaultMode: DefaultMode;
  defaultScanResult: DefaultScanResult;
  hasSeenWelcome: boolean;
  activeModules: number[]; // Which expansion modules are active (0, 1, 2, 3)

  // Actions
  setDefaultMode: (mode: DefaultMode) => void;
  setDefaultScanResult: (result: DefaultScanResult) => void;
  setHasSeenWelcome: (seen: boolean) => void;
  setActiveModules: (modules: number[]) => void;
  toggleModule: (module: number) => void;

  // Computed
  getActiveCardTypes: () => CardType[];
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default values
      defaultMode: 'scan',
      defaultScanResult: 'visible',
      hasSeenWelcome: false,
      activeModules: [0, 1, 2], // Default: base + modules 0, 1, 2 (excludes Exiles)

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

      // Computed: Get all active card types (base + selected modules)
      getActiveCardTypes: () => {
        const modules = get().activeModules;
        const types: CardType[] = [...MODULE_CARD_TYPES[-1]]; // Always include base
        for (const mod of modules) {
          if (MODULE_CARD_TYPES[mod]) {
            types.push(...MODULE_CARD_TYPES[mod]);
          }
        }
        return types;
      },
    }),
    {
      name: 'showxating-settings',
    }
  )
);
