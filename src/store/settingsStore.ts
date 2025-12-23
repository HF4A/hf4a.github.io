import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DefaultMode = 'scan' | 'catalog';
export type DefaultScanResult = 'visible' | 'opposite';

interface SettingsState {
  // Settings
  defaultMode: DefaultMode;
  defaultScanResult: DefaultScanResult;
  hasSeenWelcome: boolean;

  // Actions
  setDefaultMode: (mode: DefaultMode) => void;
  setDefaultScanResult: (result: DefaultScanResult) => void;
  setHasSeenWelcome: (seen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default values
      defaultMode: 'scan',
      defaultScanResult: 'visible',
      hasSeenWelcome: false,

      // Actions
      setDefaultMode: (mode) => set({ defaultMode: mode }),
      setDefaultScanResult: (result) => set({ defaultScanResult: result }),
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
    }),
    {
      name: 'showxating-settings',
    }
  )
);
