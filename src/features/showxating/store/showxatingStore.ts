import { create } from 'zustand';

export type ShowxatingMode = 'idle' | 'scan' | 'capture';
export type DetectionStatus = 'searching' | 'tracking' | 'locked' | 'lost';
export type PermissionStatus = 'prompt' | 'granted' | 'denied';

export interface Point {
  x: number;
  y: number;
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

  // Detection state (Scan Mode)
  detectionStatus: DetectionStatus;
  detectedQuadrilateral: Point[] | null;
  matchedCardId: string | null;
  matchConfidence: number;

  // Overlay state
  overlayFrozen: boolean;
  showingOpposite: boolean;

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
  reset: () => void;
}

export const useShowxatingStore = create<ShowxatingStore>((set) => ({
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
    }),
}));
