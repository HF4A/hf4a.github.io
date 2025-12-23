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
**Status**: Working on mobile (2024-12-22). Desktop has SVG rendering quirk (paths/rects don't render, only lines).

### Phase 3: App-Wide Navigation & Theme ✅ COMPLETE
**Goal**: Unified navigation and Belter theme across app

Top Navigation Bar:
```
┌────────────────────────────────┐
│ [SYS]    SHOWXATING     [CAT] │
└────────────────────────────────┘
```

- [x] Create new top nav component with [SYS] / active title / [CAT] layout
- [x] Active view = large text, no box; inactive = smaller, boxed
- [x] Apply Belter theme (gold, dark bg, Eurostile font) to Card Catalog
- [x] Default to SHOWXATING on app launch
- [x] localStorage for user preference (default mode setting)
- [x] Update routing: `/` redirects based on setting, `/showxating`, `/catalog`

**Deliverable**: Unified Belter-themed app with seamless navigation
**Status**: Deployed (2024-12-22). TopNavBar, SysPanel, CatalogLayout, settingsStore all implemented.

### Phase 4: Card Detail View (Shared) ✅ COMPLETE
**Goal**: Full-screen card detail with swipe gestures, used by both Scan and Catalog

- [x] Full-screen card component (dark bg, centered card)
- [x] Swipe left/right to flip card
- [x] Swipe up/down to dismiss (down) or show info (up)
- [x] Small [INFO] button (Belter style) in header
- [x] Info page shows metadata in Belter style (full-screen slide-up panel)
- [x] Remove metadata panel from current card detail
- [x] Works in Catalog grid (Scan overlays in later phase)

**Deliverable**: Clean card detail view with flip/dismiss gestures
**Status**: Deployed (2024-12-22). New CardDetailView component with drag gestures, Belter styling.

### Phase 5: Card Identification System ✅ COMPLETE
**Goal**: Build dHash index and matching for card identification

- [x] `scripts/generate-card-index.ts` build script
- [x] Generate `card-index.json` with dHash values for all 392 cards
- [x] `CardMatcher` class for hash comparison
- [x] `useCardIdentification` hook
- [x] Support matching multiple cards from single image
- [x] Return matched card ID + confidence + bounding box

**Deliverable**: Can identify cards from captured image
**Status**: Deployed (2024-12-22). dHash matching working with confidence scoring.

### Phase 6: Scan Capture & Overlays ✅ COMPLETE
**Goal**: SCAN button captures image, identifies cards, shows overlays

- [x] SCAN button captures static image from camera
- [x] Run card detection on static image (find all cards)
- [x] For each detected card: show bounding box with scanline animation
- [x] Match each card against dHash index
- [x] Once identified: replace bounding box with scaled card image
- [x] Initial overlay shows visible or opposite side (based on SYS setting)
- [x] `perspectiveTransform.ts` for correct overlay positioning (bounding box)
- [x] **Tap overlay**: Flip between visible/opposite side (quick toggle)
- [x] **Long-press overlay**: Open full card detail view
- [x] Track flip state per card independently

**Deliverable**: Captured image shows identified cards with flippable overlays
**Status**: Deployed (2024-12-22). SCAN captures, detects, identifies, overlays with flip.

### Phase 7: Scan History (Bottom Ribbon) ✅ COMPLETE
**Goal**: S1/S2/S3 slot system for scan history with persistence

Bottom Action Bar:
```
┌─────────────────────────────────┐
│ [S3] [S2] [S1]          [SCAN] │
└─────────────────────────────────┘
```

- [x] Horizontal bottom ribbon (ScanActionBar component)
- [x] SCAN + 3 history slots (S1, S2, S3)
- [x] SCAN button = live camera, history slots = captured scans
- [x] New capture → S1, shifts older left
- [x] Max 3 captures in memory
- [x] **Persist scan slots in localStorage** via Zustand persist:
  - Captured image data (as data URL)
  - Detected cards and positions
  - Flip state for each card per slot
- [x] Restore slots on page reload
- [x] LIVE button returns to camera feed

**Deliverable**: User can scroll between live view and 3 captured scans (persisted)
**Status**: Deployed (2024-12-22). Slots persist, thumbnails show, tap to switch views.

### Phase 8: Multi-Card Detection ✅ COMPLETE
**Goal**: Detect and identify multiple cards in a single scan

**Assumptions**:
- Cards are roughly the same size in the image
- Cards have similar orientation (not wildly rotated)
- Some parallax is expected (image not from directly overhead)

**Approach**:
1. Detect perspective skew from the dominant card orientation
2. Apply correction to normalize the view
3. Find all card-sized quadrilaterals (not just the largest)
4. Filter by consistent size (within tolerance of median card size)
5. Identify each detected card independently

**Implementation**:
- [x] Refactor `detectCardQuadrilateral` to `detectAllCards` returning array
- [x] Add perspective skew estimation from largest detected quad
- [x] Size-based filtering: keep quads within 40% of median area
- [x] Update `ShowxatingShell` capture to handle multiple detections
- [x] Update `CapturedScanView` to render multiple card overlays
- [x] Test with 2-4 cards in frame

**Deliverable**: Can detect and identify multiple cards in single capture
**Status**: Deployed (2024-12-22). Multi-card detection working. Irregular edges from overlapping cards and rotation >10° can reduce detection accuracy.

### Phase 9: System Settings & Diagnostics ✅ COMPLETE
**Goal**: Settings panel with diagnostics export and expanded scan history

**SYS Panel Buttons**:
- [x] **Setting 1**: Default Launch Mode (Scan vs Catalog) - already implemented
- [x] **Setting 2**: Default Scan Result (Visible Side vs Opposite Side) - already implemented
- [x] **[SEND DIAGNOSTICS]**: Package full local state as ZIP for troubleshooting:
  - All captured scan images (data URLs)
  - Detected bounding boxes and corners
  - OpenCV detection metadata (skew angle, confidence, areas)
  - Card identification results (matched IDs, distances, confidence)
  - Device info and app version
  - Export via share sheet (mail, messages, etc.)
- [x] **[RECORD TELEMETRY]**: Greyed out placeholder for future video recording capability
- [x] System info display (Belter ship status style):
  - App version
  - System date/time
  - Device info
  - Connection status

**Bottom Ribbon Expansion**:
- [x] Expand scan slots from 3 to 7 (S1-S7)
- [x] Make entire bottom bar horizontally scrollable
- [x] **Long-press on slot**: Show dialog with:
  - [CLEAR] - Remove slot, shift older scans to fill gap
  - [SEND] - Greyed out, future functionality

**Implementation**:
- [x] Update `showxatingStore` to support 7 slots
- [x] Add horizontal scroll container to `ScanActionBar`
- [x] Create `SlotContextMenu` component for long-press dialog
- [x] Create `exportDiagnostics.ts` service for ZIP generation
- [x] Add JSZip dependency
- [x] Wire up SEND DIAGNOSTICS button in SysPanel

**Deliverable**: Settings accessible, diagnostics exportable, 7 scan slots with management
**Status**: Deployed (2024-12-22). 7 slots, scrollable ribbon, long-press context menu, diagnostics export.

### Phase 10: Card Identification Critical Fixes 🚨
**Goal**: Fix broken card identification pipeline

**Status**: Diagnostics from 2025-12-23 revealed card matching is fundamentally broken.

#### Problem 1: Cards NEVER Display as Identified (UI Bug)
**Symptom**: All cards show "UNIDENTIFIED" in the UI, even when diagnostics show successful matches.

**Root Cause**: Card catalog data not loaded in SHOWXATING mode.
- `CapturedScanView.tsx:121` looks up cards via `useCardStore()` directly
- `useCardStore()` returns raw state (empty array until loaded)
- `useCards()` hook fetches `cards.json` but is only called in Catalog components
- If user defaults to SHOWXATING and never visits Catalog, cards array is always empty
- All `catalogCards.find(c => c.id === card.cardId)` calls return undefined → UNIDENTIFIED

**Fix**:
- [x] **Option A**: Call `useCards()` in `App.tsx` to ensure cards load on startup ✅ v0.2.2
- [ ] ~~**Option B**: Move card loading to a provider that wraps the entire app~~
- [ ] Add loading state check before rendering card overlays

**Files to modify**:
- `src/features/showxating/components/ShowxatingShell.tsx` - Add `useCards()` call
- OR `src/App.tsx` - Add card loading at app root

---

#### Problem 2: dHash Matching Accuracy (Algorithm Issue)
**Symptom**: When matches ARE computed (visible in diagnostics), they're ~95% wrong.

**Evidence from diagnostics** (5 scans, 29 detected cards):
- Actual cards: Thrusters, Generators, Robonauts, Reactors, Refineries, Radiators
- Matched cards: Contracts, Colonists, Crew cards (completely different types)
- Match distances: 14-20 bits (14-31% bit difference)
- Only 1 correct match out of 18 "identified" cards: `generator-09` at distance 20

**Root Causes**:

1. **No perspective correction before hashing**
   - Camera captures skewed quadrilaterals
   - Hash computed from axis-aligned bounding box, not warped card content
   - Background pixels contaminate the hash
   - Reference images are clean, orthogonal shots

2. **Threshold too loose**
   - `MAX_MATCH_DISTANCE = 20` accepts 31% bit difference (20/64)
   - Top matches are 1-3 bits apart (noise-level)
   - Effectively random selection among ~5-10 candidates

3. **Low-entropy reference images**
   - Crew cards all have similar face/uniform layouts → similar hashes
   - Contracts have similar border/text layouts → cluster together
   - Cross-type confusion (Reactor matched as Crew card)

**Fixes** (priority order):

- [x] **Quick win: Lower threshold** to 12 bits (19% difference) ✅ v0.2.2
  - File: `src/features/showxating/services/cardMatcher.ts`
  - Change: `MAX_MATCH_DISTANCE = 12`, `CONFIDENT_DISTANCE = 6`
  - Effect: More cards show as "unknown" but fewer false positives

- [x] **Medium: Perspective warp before hashing** ✅ v0.2.2
  - Added `warpCardToRectangle()` to visionPipeline.ts
  - Uses OpenCV `getPerspectiveTransform()` + `warpPerspective()`
  - ShowxatingShell now warps detected cards before hashing
  - Falls back to bounding box if warp fails

- [ ] **Medium: Crop inner region**
  - Hash only center 70-80% of detected area
  - Excludes card borders and background contamination
  - Reduces sensitivity to edge detection errors

- [ ] **Larger: Multi-feature matching**
  - Combine dHash with color histogram matching
  - Weight card type icons (top-left corner) heavily
  - Consider card title text area separately

- [ ] **Future: OCR fallback**
  - If hash confidence < threshold, read card title text
  - Use fuzzy string matching against card names
  - More robust but slower

---

#### Problem 3: Empty Slots Still Display ✅ FIXED v0.2.2
**Symptom**: All 7 slot buttons (S1-S7) visible even when empty.

**User Request**: "I noted earlier not to display slots that were empty. So, they shouldn't be in the ribbon at the bottom, until an image is actually in the slot."

**Fix**:
- [x] Filter `slots.map()` to only render slots with content ✅ v0.2.2

**File modified**:
- `src/features/showxating/components/ScanActionBar.tsx`

```tsx
// Now only renders slots with content
{slots.filter(({ id }) => scanSlots[id] !== null).map(({ id, label }) => { ... })}
```

---

#### Diagnostics Improvements (Completed in v0.2.1)
- [x] Add `computedHash` to diagnostics (what hash was computed for detected card)
- [x] Add `matchDistance` (Hamming distance to best match)
- [x] Add `topMatches[]` (top 5 closest matches with distances)
- [x] Add `boundingBox` coordinates
- [x] Semantic versioning: v0.2.1

---

**Deliverable**: Cards correctly identified and displayed in overlay
**Priority**: CRITICAL - feature is non-functional without these fixes

---

### Phase 11: Polish & Optimization
**Goal**: Final polish and performance

- [ ] Scanline animation refinement
- [ ] Smooth transitions between views
- [ ] Performance optimization (lazy loading, caching)
- [ ] Mobile Safari edge cases
- [ ] Error handling and recovery
- [ ] Fix desktop SVG rendering issue
- [ ] Accessibility review
- [ ] Improved detection robustness (irregular edges, rotation tolerance)

**Deliverable**: Production-ready feature

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
2. Filter for 4-corner convex shapes with ~1.4 aspect ratio (card proportions)
3. **Multi-card mode**: Return all matching quadrilaterals within size tolerance
4. Optional skew correction based on dominant card orientation

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
