import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DefaultMode = 'scan' | 'catalog';
export type DefaultScanResult = 'visible' | 'opposite';

interface SettingsState {
  // Settings
  defaultMode: DefaultMode;
  defaultScanResult: DefaultScanResult;

  // Actions
  setDefaultMode: (mode: DefaultMode) => void;
  setDefaultScanResult: (result: DefaultScanResult) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default values
      defaultMode: 'scan',
      defaultScanResult: 'visible',

      // Actions
      setDefaultMode: (mode) => set({ defaultMode: mode }),
      setDefaultScanResult: (result) => set({ defaultScanResult: result }),
    }),
    {
      name: 'showxating-settings',
    }
  )
);
