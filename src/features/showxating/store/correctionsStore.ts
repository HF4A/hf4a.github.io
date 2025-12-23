/**
 * Corrections Store
 *
 * Persists manual card identification corrections for training data collection.
 * Corrections are stored with the computed hash so they can help improve
 * future matching algorithms.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ManualCorrection {
  // When the correction was made
  timestamp: number;

  // The computed dHash from the scanned card region
  computedHash: string;

  // The original match (if any)
  originalCardId: string | null;
  originalConfidence: number;

  // The user-corrected card ID
  correctedCardId: string;

  // Additional context
  scanId: string; // ID of the scan where correction was made
  cardIndex: number; // Index within that scan
}

interface CorrectionsStore {
  // Manual corrections indexed by computedHash for quick lookup
  corrections: Record<string, ManualCorrection>;

  // Actions
  addCorrection: (correction: ManualCorrection) => void;
  getCorrection: (computedHash: string) => ManualCorrection | undefined;
  removeCorrection: (computedHash: string) => void;
  clearAllCorrections: () => void;
  getAllCorrections: () => ManualCorrection[];
}

export const useCorrectionsStore = create<CorrectionsStore>()(
  persist(
    (set, get) => ({
      corrections: {},

      addCorrection: (correction) =>
        set((state) => ({
          corrections: {
            ...state.corrections,
            [correction.computedHash]: correction,
          },
        })),

      getCorrection: (computedHash) => get().corrections[computedHash],

      removeCorrection: (computedHash) =>
        set((state) => {
          const { [computedHash]: _, ...rest } = state.corrections;
          return { corrections: rest };
        }),

      clearAllCorrections: () => set({ corrections: {} }),

      getAllCorrections: () => Object.values(get().corrections),
    }),
    {
      name: 'showxating-corrections',
    }
  )
);
