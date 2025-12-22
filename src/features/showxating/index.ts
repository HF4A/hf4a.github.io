// SHOWXATING Feature - Barrel Export

// Components
export { ShowxatingShell } from './components/ShowxatingShell';
export { CameraView } from './components/CameraView';
export { HudOverlay } from './components/HudOverlay';

// Hooks
export { useCamera } from './hooks/useCamera';
export { useOpenCV } from './hooks/useOpenCV';
export { useCardDetection } from './hooks/useCardDetection';

// Services
export { detectCardQuadrilateral } from './services/visionPipeline';
export type { DetectionResult } from './services/visionPipeline';

// Store
export { useShowxatingStore } from './store/showxatingStore';
export type {
  ShowxatingMode,
  DetectionStatus,
  PermissionStatus,
  Point,
} from './store/showxatingStore';
