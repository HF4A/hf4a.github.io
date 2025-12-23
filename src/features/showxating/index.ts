// SHOWXATING Feature - Barrel Export

// Components
export { ShowxatingShell } from './components/ShowxatingShell';
export { CameraView } from './components/CameraView';
export { HudOverlay } from './components/HudOverlay';

// Hooks
export { useCamera } from './hooks/useCamera';
export { useOpenCV } from './hooks/useOpenCV';
export { useCardDetection } from './hooks/useCardDetection';
export { useCardIdentification } from './hooks/useCardIdentification';
export type { IdentifiedCard, DetectedCard } from './hooks/useCardIdentification';

// Services
export { detectCardQuadrilateral } from './services/visionPipeline';
export type { DetectionResult } from './services/visionPipeline';
export { CardMatcher, getCardMatcher, computeDHashFromImageData, hammingDistance } from './services/cardMatcher';
export type { CardIndexEntry, MatchResult } from './services/cardMatcher';

// Store
export { useShowxatingStore } from './store/showxatingStore';
export type {
  ShowxatingMode,
  DetectionStatus,
  PermissionStatus,
  Point,
} from './store/showxatingStore';
