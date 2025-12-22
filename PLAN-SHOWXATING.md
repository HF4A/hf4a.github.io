# SHOWXATING Mode Implementation Plan

## Summary

Belter-themed camera mode for HF4A card explorer with two sub-modes:
- **Scan Mode** (priority): Live card recognition + opposite-side overlay
- **Capture Mode** (secondary): Photo/video/audio data collection for model training

Inspired by Belter creole from The Expanse. Functional sci-fi UI, not cosplay.

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Card detection | OpenCV.js (~8MB, CDN, lazy-loaded) | Robust contour detection, acceptable bundle tradeoff |
| Card identification | dHash perceptual hashing | Fast (64-bit compare), pre-computed at build time |
| State management | New Zustand stores | Consistent with existing `cardStore`/`filterStore` |
| Theming | Scoped CSS custom properties | Belter theme isolated to feature, doesn't affect main app |
| Storage (Capture) | IndexedDB via `idb` | Browser-native, works offline |
| Export | JSZip | Client-side ZIP generation |

---

## New Dependencies

```json
{
  "dependencies": {
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "jszip": "^3.10.1"
  }
}
```

OpenCV.js loaded from CDN, cached via service worker.

---

## File Structure

```
src/features/showxating/
├── index.ts                     # Feature barrel export
├── types.ts                     # Showxating-specific types
│
├── components/
│   ├── ShowxatingShell.tsx      # Main container + mode switcher
│   ├── PermissionGate.tsx       # Camera/mic permission flow
│   ├── CameraView.tsx           # Video + canvas layers
│   ├── HudOverlay.tsx           # Belter HUD (SVG)
│   ├── CardOverlay.tsx          # Perspective-corrected card image
│   ├── ScanModeControls.tsx     # Freeze, flip, open detail
│   ├── CaptureModeControls.tsx  # Photo/video/audio buttons
│   └── CaptureReview.tsx        # Session review + export
│
├── hooks/
│   ├── useCamera.ts             # getUserMedia abstraction
│   ├── useOpenCV.ts             # Lazy loader
│   ├── useCardDetection.ts      # Frame processing loop
│   └── useCardIdentification.ts # Hash matching
│
├── store/
│   ├── showxatingStore.ts       # Detection/overlay state
│   └── captureStore.ts          # Session state
│
├── services/
│   ├── visionPipeline.ts        # OpenCV contour detection
│   ├── cardMatcher.ts           # dHash comparison
│   ├── perspectiveTransform.ts  # Homography calculation
│   └── exportBundle.ts          # ZIP creation
│
└── styles/
    └── belter-theme.css         # Scoped Belter visuals

scripts/
└── generate-card-index.ts       # Build-time hash generation

public/data/
└── card-index.json              # Pre-computed hashes (358 cards)
```

---

## Routes

```tsx
// App.tsx additions
<Route path="/showxating" element={<ShowxatingShell />}>
  <Route index element={<ModeSelector />} />
  <Route path="scan" element={<ScanMode />} />
  <Route path="capture" element={<CaptureMode />} />
  <Route path="capture/review/:sessionId" element={<CaptureReview />} />
</Route>
```

Nav entry point: Add "SHOWXATING" link to `Layout.tsx` header.

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
**Goal**: Camera working, basic HUD rendering

- [x] Create feature folder structure (`src/features/showxating/`)
- [x] `useCamera` hook with permission handling
- [x] `CameraView` component with video element
- [x] Basic `HudOverlay` with crosshair (no detection)
- [x] Routes and navigation entry
- [x] `showxatingStore` (basic state)
- [x] Belter theme CSS foundation

**Deliverable**: Camera opens, HUD renders, no detection
**Status**: Deployed and tested on desktop + mobile (2024-12-22)

### Phase 2: Detection Pipeline ✅ COMPLETE
**Goal**: Card quadrilateral detected in frame

- [x] `useOpenCV` lazy loader
- [x] `visionPipeline.ts` contour detection
- [x] `useCardDetection` hook (15 FPS frame loop)
- [x] `CardBrackets` HUD component (DetectedCardBrackets)
- [x] Connect detection to store

**Deliverable**: Brackets appear around detected card shapes
**Status**: Built, ready for testing

### Phase 3: Card Identification
**Goal**: Detected card matched to database

- [ ] `scripts/generate-card-index.ts` build script
- [ ] Generate `card-index.json` with dHash values
- [ ] `CardMatcher` class
- [ ] `useCardIdentification` hook
- [ ] Confidence ring and status text in HUD

**Deliverable**: Card name appears when recognized

### Phase 4: Overlay Rendering
**Goal**: Opposite side overlaid with perspective correction

- [ ] `perspectiveTransform.ts` (homography)
- [ ] `CardOverlay` component with CSS matrix3d
- [ ] Connect to `relatedCards` for opposite lookup
- [ ] Freeze/unfreeze toggle
- [ ] Flip overlay (same vs opposite side)
- [ ] "Open Details" navigation

**Deliverable**: Full Scan Mode working

### Phase 5: Capture Mode
**Goal**: Photo/video/audio capture with storage

- [ ] IndexedDB schema (`lib/idb/captureDB.ts`)
- [ ] `captureStore`
- [ ] `CaptureModeControls`
- [ ] MediaRecorder for video/audio
- [ ] Session metadata form
- [ ] `CaptureReview` component

**Deliverable**: Can capture and review sessions

### Phase 6: Export & Polish
**Goal**: Export bundles, final polish

- [ ] ZIP export with JSZip
- [ ] Share/download flow
- [ ] HUD animations (Framer Motion)
- [ ] Performance optimization
- [ ] Mobile Safari testing
- [ ] Error handling

**Deliverable**: Feature complete

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add Showxating routes |
| `src/components/Layout.tsx` | Add nav link |
| `vite.config.ts` | PWA caching for OpenCV + card-index |
| `package.json` | Add dependencies |

---

## Key Technical Details

### Card Detection (OpenCV.js)
1. Grayscale → Gaussian blur → Canny edges → Find contours
2. Filter for 4-corner convex shapes with ~1.5 aspect ratio (card proportions)
3. Return largest matching quadrilateral corners

### Card Identification (dHash)
1. Extract detected region, resize to 9x8
2. Compute 64-bit difference hash
3. Compare Hamming distance against pre-computed index
4. Match = lowest distance below threshold

### Perspective Overlay
1. Compute homography from detected corners to display rectangle
2. Apply CSS `matrix3d()` transform to card image
3. Position overlay on canvas layer above video

### Belter HUD Elements
- Center crosshair (amber)
- Card brackets (cyan, animated on lock)
- Confidence ring (fills as match strengthens)
- Status text: `SEARCHING` → `TRACKING` → `LOCK`
- Subtle scanline overlay (camera active only)

### Visual Language (Reference: The Expanse HUD)

**Primary Color - SHOWXATING Gold**
- Hex: `#d4a84b` (muted amber/gold, NOT bright yellow)
- Used for: text, corner brackets, status indicators, borders

**Font**
- Style: Condensed sans-serif, ALL CAPS, slight letter-spacing
- Reference fonts: **Eurostile Extended**, **Bank Gothic**, or **Industry**
- Fallback: `'Eurostile', 'Bank Gothic', 'Industry', sans-serif`
- For system text, can use JetBrains Mono as secondary

**HUD Frame Elements**
- Yellow L-shaped corner brackets framing the camera view
- Status metadata in upper-left (TYPE, ORIGIN labels)
- Buffer/channel status bar at bottom
- Small colored indicator squares in corner

**General**
- Dark, near-black backgrounds
- Thin vector lines, no heavy panels
- Minimal motion, fast fades, no easing theatrics
- Secondary accents if needed: cyan (#00d4ff), desaturated red (#ff3b3b)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenCV.js slow load | Cache via SW, show loading state, defer until mode entered |
| False positive detection | Require 3+ frames of sustained detection |
| Mobile Safari quirks | Use `playsinline`, test early, handle permission errors |
| Hash matching inaccuracy | Combine dHash + histogram, allow manual card selection fallback |
| Battery drain | Throttle to 15 FPS, pause when tab hidden |

---

## Open Questions

1. **Manual fallback**: If recognition fails, show card picker grid?
2. **Multi-card**: Handle multiple cards in frame? (spec says single card)
3. **Orientation**: Handle upside-down cards? (rotate overlay 180°)

---

## Guardrails

- Camera and microphone always require explicit consent
- Recording indicators always visible when active
- No background capture
- No silent uploads
- All processing local unless user explicitly exports
