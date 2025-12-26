import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShowxatingMode = 'idle' | 'scan' | 'capture';
export type DetectionStatus = 'searching' | 'tracking' | 'locked' | 'lost';
export type PermissionStatus = 'prompt' | 'granted' | 'denied';
export type ScanSlot = 'live' | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';

export interface Point {
  x: number;
  y: number;
}

export interface IdentifiedCard {
  cardId: string;
  filename: string;
  side: string | null;
  confidence: number;
  corners: Point[];
  showingOpposite: boolean; // flip state for this card
  // Debug info for diagnostics
  boundingBox?: { x: number; y: number; width: number; height: number };
  computedHash?: string; // 64-bit dHash as hex string
  matchDistance?: number;
  topMatches?: { cardId: string; distance: number }[];
  extractedText?: string; // Text extracted from card for matching (future)
  detectedTypes?: string[]; // Card types detected from color analysis
  // v0.3.0: OCR-based matching diagnostics
  ocrResult?: {
    fullText: string;
    typeText: string;
    titleText: string;
    confidence: number;
    timing: { fullMs: number; typeMs: number; titleMs: number; totalMs: number };
  };
  matchSource?: 'text' | 'hash' | 'fused'; // Which method provided the match
  textScore?: number;  // Text matching score (0 = perfect)
  hashScore?: number;  // Hash matching score (0 = perfect)
  fusedScore?: number; // Combined score (0 = perfect)
}

export interface CapturedScan {
  id: string;
  timestamp: number;
  imageDataUrl: string;
  imageWidth: number;   // Original capture width for bbox coordinate conversion
  imageHeight: number;  // Original capture height for bbox coordinate conversion
  cards: IdentifiedCard[];
  isProcessing?: boolean;  // True while waiting for cloud API response
  // Scan statistics for UI display
  opencvCardCount?: number;  // How many cards OpenCV detected
  apiCardCount?: number;     // How many cards the cloud API returned
}

interface ShowxatingStore {
  // Mode state
  mode: ShowxatingMode;
  isActive: boolean;

  // Permission state
  cameraPermission: PermissionStatus;
  micPermission: PermissionStatus;

  // Camera state
  cameraReady: boolean;
  cameraError: string | null;

  // Detection state (live scan)
  detectionStatus: DetectionStatus;
  detectedQuadrilateral: Point[] | null;
  matchedCardId: string | null;
  matchConfidence: number;

  // Overlay state
  overlayFrozen: boolean;
  showingOpposite: boolean;

  // Scan capture state (Phase 6-7, expanded to 7 slots in Phase 9)
  activeSlot: ScanSlot;
  isCapturing: boolean;
  scanSlots: {
    s1: CapturedScan | null;
    s2: CapturedScan | null;
    s3: CapturedScan | null;
    s4: CapturedScan | null;
    s5: CapturedScan | null;
    s6: CapturedScan | null;
    s7: CapturedScan | null;
  };

  // Actions
  setMode: (mode: ShowxatingMode) => void;
  setActive: (active: boolean) => void;
  setCameraPermission: (status: PermissionStatus) => void;
  setMicPermission: (status: PermissionStatus) => void;
  setCameraReady: (ready: boolean) => void;
  setCameraError: (error: string | null) => void;
  setDetectionStatus: (status: DetectionStatus) => void;
  setDetection: (quad: Point[] | null, cardId: string | null, confidence: number) => void;
  clearDetection: () => void;
  toggleFreeze: () => void;
  toggleOverlaySide: () => void;

  // Scan capture actions
  setActiveSlot: (slot: ScanSlot) => void;
  setCapturing: (capturing: boolean) => void;
  addCapture: (scan: CapturedScan) => void;
  updateScanCards: (scanId: string, cards: IdentifiedCard[], isProcessing?: boolean, counts?: { opencv?: number; api?: number }) => void;
  updateCardFlip: (slotId: ScanSlot, cardIndex: number, showingOpposite: boolean) => void;
  clearSlot: (slotId: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7') => void;
  removeSlot: (slotId: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7') => void; // Remove and shift

  reset: () => void;
}

// Separate persisted state for scan slots (survives page reload)
export interface PersistedScanState {
  scanSlots: {
    s1: CapturedScan | null;
    s2: CapturedScan | null;
    s3: CapturedScan | null;
    s4: CapturedScan | null;
    s5: CapturedScan | null;
    s6: CapturedScan | null;
    s7: CapturedScan | null;
  };
}

export const useScanSlotsStore = create<PersistedScanState>()(
  persist(
    (): PersistedScanState => ({
      scanSlots: {
        s1: null,
        s2: null,
        s3: null,
        s4: null,
        s5: null,
        s6: null,
        s7: null,
      },
    }),
    {
      name: 'showxating-scan-slots',
    }
  )
);

export const useShowxatingStore = create<ShowxatingStore>((set, get) => ({
  // Initial state
  mode: 'idle',
  isActive: false,
  cameraPermission: 'prompt',
  micPermission: 'prompt',
  cameraReady: false,
  cameraError: null,
  detectionStatus: 'searching',
  detectedQuadrilateral: null,
  matchedCardId: null,
  matchConfidence: 0,
  overlayFrozen: false,
  showingOpposite: true,

  // Scan capture state
  activeSlot: 'live',
  isCapturing: false,
  scanSlots: useScanSlotsStore.getState().scanSlots,

  // Actions
  setMode: (mode) => set({ mode }),
  setActive: (active) => set({ isActive: active }),
  setCameraPermission: (status) => set({ cameraPermission: status }),
  setMicPermission: (status) => set({ micPermission: status }),
  setCameraReady: (ready) => set({ cameraReady: ready }),
  setCameraError: (error) => set({ cameraError: error, cameraReady: false }),

  setDetectionStatus: (status) => set({ detectionStatus: status }),

  setDetection: (quad, cardId, confidence) =>
    set({
      detectedQuadrilateral: quad,
      matchedCardId: cardId,
      matchConfidence: confidence,
      detectionStatus: confidence > 0.8 ? 'locked' : confidence > 0.5 ? 'tracking' : 'searching',
    }),

  clearDetection: () =>
    set({
      detectedQuadrilateral: null,
      matchedCardId: null,
      matchConfidence: 0,
      detectionStatus: 'searching',
    }),

  toggleFreeze: () => set((state) => ({ overlayFrozen: !state.overlayFrozen })),
  toggleOverlaySide: () => set((state) => ({ showingOpposite: !state.showingOpposite })),

  // Scan capture actions
  setActiveSlot: (slot) => set({ activeSlot: slot }),
  setCapturing: (capturing) => set({ isCapturing: capturing }),

  addCapture: (scan) => {
    const state = get();
    // Shift slots: s6 -> s7, s5 -> s6, ... s1 -> s2, new -> s1
    const newSlots = {
      s1: scan,
      s2: state.scanSlots.s1,
      s3: state.scanSlots.s2,
      s4: state.scanSlots.s3,
      s5: state.scanSlots.s4,
      s6: state.scanSlots.s5,
      s7: state.scanSlots.s6,
    };
    set({ scanSlots: newSlots, activeSlot: 's1' });
    // Persist to localStorage
    useScanSlotsStore.setState({ scanSlots: newSlots });
  },

  updateScanCards: (scanId, cards, isProcessing = false, counts) => {
    const state = get();
    const slotOrder = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;

    // Find slot containing scan with matching ID
    for (const slotId of slotOrder) {
      const slot = state.scanSlots[slotId];
      if (slot && slot.id === scanId) {
        const newSlots = {
          ...state.scanSlots,
          [slotId]: {
            ...slot,
            cards,
            isProcessing,
            ...(counts?.opencv !== undefined && { opencvCardCount: counts.opencv }),
            ...(counts?.api !== undefined && { apiCardCount: counts.api }),
          },
        };
        set({ scanSlots: newSlots });
        useScanSlotsStore.setState({ scanSlots: newSlots });
        return;
      }
    }
  },

  updateCardFlip: (slotId, cardIndex, showingOpposite) => {
    if (slotId === 'live') return;
    const state = get();
    const slot = state.scanSlots[slotId as keyof typeof state.scanSlots];
    if (!slot || !slot.cards[cardIndex]) return;

    const updatedCards = [...slot.cards];
    updatedCards[cardIndex] = { ...updatedCards[cardIndex], showingOpposite };

    const newSlots = {
      ...state.scanSlots,
      [slotId]: { ...slot, cards: updatedCards },
    };
    set({ scanSlots: newSlots });
    useScanSlotsStore.setState({ scanSlots: newSlots });
  },

  clearSlot: (slotId) => {
    const state = get();
    const newSlots = { ...state.scanSlots, [slotId]: null };
    set({ scanSlots: newSlots });
    useScanSlotsStore.setState({ scanSlots: newSlots });
  },

  removeSlot: (slotId) => {
    const state = get();
    const slotOrder = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;
    const slotIndex = slotOrder.indexOf(slotId);
    if (slotIndex === -1) return;

    // Build new slots by shifting everything after the removed slot
    const newSlots = { ...state.scanSlots };
    for (let i = slotIndex; i < slotOrder.length - 1; i++) {
      newSlots[slotOrder[i]] = state.scanSlots[slotOrder[i + 1]];
    }
    newSlots.s7 = null; // Last slot becomes empty

    // If we were viewing the removed slot, go to live
    const newActiveSlot = state.activeSlot === slotId ? 'live' : state.activeSlot;

    set({ scanSlots: newSlots, activeSlot: newActiveSlot });
    useScanSlotsStore.setState({ scanSlots: newSlots });
  },

  reset: () =>
    set({
      mode: 'idle',
      isActive: false,
      cameraReady: false,
      cameraError: null,
      detectionStatus: 'searching',
      detectedQuadrilateral: null,
      matchedCardId: null,
      matchConfidence: 0,
      overlayFrozen: false,
      showingOpposite: true,
      activeSlot: 'live',
      isCapturing: false,
    }),
}));

// Sync persisted slots on load
useScanSlotsStore.subscribe((state) => {
  useShowxatingStore.setState({ scanSlots: state.scanSlots });
});
