// SHOWXATING Feature - Barrel Export

// Components
export { ShowxatingShell } from './components/ShowxatingShell';
export { CameraView } from './components/CameraView';
export type { CameraViewHandle } from './components/CameraView';
export { HudOverlay } from './components/HudOverlay';
export { ScanActionBar } from './components/ScanActionBar';
export { CapturedScanView } from './components/CapturedScanView';
export { SlotContextMenu } from './components/SlotContextMenu';

// Hooks
export { useCamera } from './hooks/useCamera';
export { useOpenCV } from './hooks/useOpenCV';
export { useCardDetection } from './hooks/useCardDetection';
export { useCardIdentification } from './hooks/useCardIdentification';
export type { IdentifiedCard, DetectedCard } from './hooks/useCardIdentification';
export { useScanCapture } from './hooks/useScanCapture';

// Services
export { detectCardQuadrilateral, detectAllCards } from './services/visionPipeline';
export type { DetectionResult, MultiDetectionResult } from './services/visionPipeline';
export { CardMatcher, getCardMatcher, computeDHashFromImageData, hammingDistance } from './services/cardMatcher';
export type { CardIndexEntry, MatchResult, MatchResultWithDebug } from './services/cardMatcher';
export { exportDiagnosticsZip, downloadDiagnostics, shareDiagnostics } from './services/exportDiagnostics';
export type { DiagnosticsMetadata, ScanDiagnostics, CardDiagnostics } from './services/exportDiagnostics';

// Store
export { useShowxatingStore, useScanSlotsStore } from './store/showxatingStore';
export type {
  ShowxatingMode,
  DetectionStatus,
  PermissionStatus,
  Point,
  ScanSlot,
  IdentifiedCard as StoreIdentifiedCard,
  CapturedScan,
  PersistedScanState,
} from './store/showxatingStore';
