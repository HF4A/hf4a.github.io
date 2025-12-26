# Spec: Grid-Based Scan Results View

## Overview

Replace the current bbox-overlay approach with a clean NxM grid of identified card images. This eliminates the fragile coordinate-space merge between OpenCV detection and API identification.

## User Flow

### Phase 1: Capture & Initial Detection (unchanged)
1. User taps SCAN
2. Photo captured, displayed in slot
3. OpenCV detects card bboxes, draws animated overlays ("SCANNING...")
4. OpenCV bbox count stored for later use

### Phase 2: API Processing
1. Image sent to cloud API
2. API returns identified cards with grid info
3. **Transition**: Photo view fades to grid view

### Phase 3: Grid Results View
1. NxM grid of card images replaces the photo
2. Identified cards show catalog images
3. Unidentified/missing cells show cropped regions from original photo
4. User can toggle back to original photo view

## Grid Layout Determination

Three-phase fallback logic:

### Phase A: Explicit API Response
API returns explicit `gridRows` and `gridCols` fields.
```json
{
  "gridRows": 3,
  "gridCols": 3,
  "cards": [...]
}
```

### Phase B: Infer from API Bboxes
If API doesn't return explicit grid dimensions, use existing grid detection logic on API-returned bboxes:
- Cluster Y-centers into rows
- Cluster X-centers into columns
- Derive NxM from cluster counts

### Phase C: Fallback to OpenCV
If API bbox inference fails or is unreliable, use OpenCV's initial detection:
- Same clustering algorithm on OpenCV bboxes
- This is the most spatially accurate

## Grid Cell Contents

### Identified Card (cardId !== 'unknown')
- Catalog image from `/cards/full/{filename}`
- Card-like aspect ratio (2:3)
- Tap to flip (FRONT/BACK)
- Double-tap to open detail modal
- Confidence badge ONLY if < 70%
- Side indicator (FRONT/BACK) in corner

### Unidentified Card (cardId === 'unknown', has OpenCV bbox)
- Cropped region from original scan photo (using OpenCV bbox)
- Yellow/gold border to indicate action needed
- Overlay text: "UNIDENTIFIED" + "TAP TO ID"
- Tap opens correction modal

### Empty Cell (OpenCV detected but API didn't return)
- Subtle dashed border or placeholder
- Text: "NOT DETECTED"
- Tap opens correction modal with cropped region from OpenCV bbox
- Allows user to manually identify cards API missed

### True Empty Cell (grid position with no detection)
- Minimal visual treatment (very dim border or none)
- Non-interactive

## View Toggle

Top-right corner button to switch views:
- **GRID** (default after API returns): NxM card grid
- **PHOTO**: Original captured image with OpenCV bbox overlays

Toggle preserves:
- Card flip states
- Any corrections made

## Visual Design

### Grid Container
- Scrollable if grid exceeds viewport
- Default zoom: 3x3 grid fits comfortably
- Padding between cells: 8px
- Background: black (matches current aesthetic)

### Card Cells
- Aspect ratio: 2:3 (standard card proportions)
- Border: 2px solid
  - Cyan for identified cards
  - Gold for cards needing attention (< 70% confidence or unidentified)
- Rounded corners: 8px
- Drop shadow for depth

### Confidence Badge (only if < 70%)
- Bottom-right corner
- Small pill: "67%"
- Gold/warning color

### Side Indicator
- Top-left corner
- "FRONT" or "BACK"
- Dim text, always visible

## Data Flow

### API Response Structure (proposed update)
```typescript
interface CloudScanResponse {
  gridRows?: number;        // Explicit grid dimensions (Phase A)
  gridCols?: number;
  cards: Array<{
    cardId: string;
    confidence: number;
    bbox: [number, number, number, number];  // For Phase B inference
    gridPosition?: { row: number; col: number };  // Optional explicit position
    ocr_text?: string;
  }>;
}
```

### Local State
```typescript
interface GridCell {
  row: number;
  col: number;
  type: 'identified' | 'unidentified' | 'empty' | 'missing';
  card?: IdentifiedCard;      // For identified/unidentified
  cropDataUrl?: string;       // For unidentified/missing (from OpenCV bbox)
  opencvBbox?: Point[];       // Original OpenCV corners for crop
}

interface GridViewState {
  rows: number;
  cols: number;
  cells: GridCell[];
  viewMode: 'grid' | 'photo';
}
```

## Implementation Plan

### Step 1: Update API Response Handling
- Modify worker to return `gridRows`, `gridCols` if determinable
- Add `gridPosition` to each card if available
- Update `useScanCapture.ts` to parse new fields

### Step 2: Grid Detection Utility
- Extract grid detection logic into `src/features/showxating/utils/gridDetection.ts`
- Support all three phases (A, B, C)
- Unit tests for edge cases (1x1, 1xN, irregular counts)

### Step 3: Grid Cell Assignment
- Create `assignCardsToGrid()` function
- Handle identified, unidentified, empty, missing states
- Generate crop data URLs for unidentified cells

### Step 4: New GridResultsView Component
- `src/features/showxating/components/GridResultsView.tsx`
- Renders NxM CSS Grid
- Handles card interactions (tap, double-tap)
- View toggle button

### Step 5: Update CapturedScanView
- Keep existing photo+overlay view
- Add conditional rendering based on `viewMode`
- Wire up view toggle

### Step 6: Preserve Existing Functionality
- Card flip state management
- Detail modal
- Correction modal
- Diagnostics export

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| API returns 0 cards | Show OpenCV grid with all "UNIDENTIFIED" |
| OpenCV detects 0, API returns cards | Use API bbox inference for grid |
| 1 card detected | 1x1 grid |
| Irregular count (7) | 3x3 with 2 empty cells |
| API timeout | Stay in photo view, all cards "UNIDENTIFIED" |
| Very large grid (4x4+) | Scrollable, cells scale down |

## Migration Notes

- No changes to scan capture flow
- No changes to cloud worker API contract (additive only)
- Existing scans in localStorage will show in photo view (no grid data)
- Corrections store unchanged

## Resolved Design Decisions

### Transition Animation
"Scan complete" effect using Framer Motion:
1. Cyan scanline sweeps top→bottom over photo (0.3s)
2. Photo fades out, grid fades in (0.2s crossfade)
3. Grid cells stagger-fade in reading order (0.05s delay per cell)

### Grid Sizing
- Fixed cell sizing, no pinch-to-zoom
- Cells scale to fit viewport while maintaining aspect ratio
- 3x3 grid should fit comfortably without scroll on most phones

### Trailing Empty Cells
- Show empty cells to maintain rectangular grid
- e.g., 7 cards in 3x3 = cells 8,9 shown as empty placeholders

---

*Spec version: 1.1*
*Date: 2025-12-26*
