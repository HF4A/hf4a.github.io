# Merge Algorithm Analysis - 2025-12-26

## Executive Summary

**Problem**: Off-by-one errors persist. Cards assigned to wrong bbox positions.

**Root Cause**: Current algorithm assumes API returns cards in reading order. This is FALSE.

**Proposed Solution**: Grid-based merge that uses RELATIVE positioning within each coordinate
space, not absolute positions or array indices.

**Key Insight**: Even if API bbox positions are absolutely wrong, they may preserve RELATIVE
ordering (card A left of card B in reality → A.x < B.x in API response, even if both values wrong).

---

## Problem Statement

Off-by-one errors persist despite multiple fix attempts. Cards are being assigned to wrong bbox positions.

## Diagnostic Data Analysis

### Session 2025-12-26T21-47 (7 cards)

From scans.json (merged result - OpenCV positions, possibly wrong cardIds):

| Index | cardId | Center (x,y) | Grid Position |
|-------|--------|--------------|---------------|
| 0 | thruster-12 | (326, 339) | Row 0, Col 1 |
| 1 | generator-06 | (565, 328) | Row 0, Col 2 |
| 2 | generator-09 | (125, 607) | Row 1, Col 0 |
| 3 | robonaut-12 | (335, 616) | Row 1, Col 1 |
| 4 | reactor-09 | (600, 610) | Row 1, Col 2 |
| 5 | reactor-10 | (365, 899) | Row 2, Col 1 |
| 6 | refinery-04 | (603, 903) | Row 2, Col 2 |

**Detected Grid Structure:**
```
        Col 0       Col 1         Col 2
        (x~125)     (x~340)       (x~590)
Row 0   [empty]     [card 0]      [card 1]
(y~330)             thruster-12   generator-06

Row 1   [card 2]    [card 3]      [card 4]
(y~610) generator-09 robonaut-12  reactor-09

Row 2   [empty]     [card 5]      [card 6]
(y~900)             reactor-10    refinery-04
```

**From Screenshot (actual cards):**
```
        Col 0       Col 1         Col 2
Row 0   [empty]     ROBONAUT      Generator-Ericsson ✓
Row 1   Generator-  THRUSTER      Reactor-Penning ✓
        InCore ✓    SolarMoth
Row 2   [empty]     Reactor-      Refinery ✓
                    Orion ✓
```

**Errors:**
- Position (0,1): Has thruster-12, should be robonaut-12
- Position (1,1): Has robonaut-12, should be thruster-12

Cards at positions 0 and 3 have SWAPPED identifications.

---

## Current Merge Algorithm (v0.4.3)

```
1. Sort OpenCV bboxes by reading order (Y then X)
2. Use cloud cards in original API return order (no sort)
3. Pair 1:1 by array index
```

**Assumption:** GPT-4 Vision returns cards in reading order.

**Problem:** This assumption is FALSE, or the reading order doesn't match OpenCV's sort.

### Why It Fails

OpenCV sorting produces order:
```
[0] (326, 339) - Row 0, Col 1
[1] (565, 328) - Row 0, Col 2
[2] (125, 607) - Row 1, Col 0  ← LEFTMOST in row
[3] (335, 616) - Row 1, Col 1
[4] (600, 610) - Row 1, Col 2
[5] (365, 899) - Row 2, Col 1
[6] (603, 903) - Row 2, Col 2
```

But API might return cards in different order. If API returns:
```
[0] thruster (at position that sorts to index 3)
[1] generator-06
[2] generator-09
[3] robonaut (at position that sorts to index 0)
[4] reactor-09
[5] reactor-10
[6] refinery-04
```

Then pairing by index gives wrong result.

---

## Proposed Grid-Based Algorithm

### Step 1: Detect Grid from OpenCV

```
Input: OpenCV corners[][]
Output: Grid cells with (row, col) assignments + inferred empty positions

Algorithm:
1. Calculate center for each bbox
2. Cluster Y values to identify rows
   - Sort centers by Y
   - Group into rows using gap detection (gap > avgHeight * 0.5)
   - Calculate row centroid Y for each row
3. Cluster X values to identify columns
   - Sort centers by X
   - Group into columns using gap detection (gap > avgWidth * 0.5)
   - Calculate column centroid X for each column
4. Assign each bbox to (row, col) based on its center
5. Identify grid dimensions: M rows × N columns
6. Infer empty cells: positions (r, c) where no bbox was detected
   - These are grid positions implied by the M×N structure
   - Position inferred from row centroid Y and column centroid X
   - No OpenCV bbox exists there (card may be missing or undetected)
```

**Example for session data:**
```
Y clusters: [328-339], [607-616], [899-903] → 3 rows
X clusters: [125], [326-365], [565-603] → 3 columns
Grid: 3×3 with 2 empty cells
```

### Step 2: Map API Results to Grid

```
Input: API cards with bboxes
Output: Grid cells with (row, col) assignments

Algorithm:
1. Calculate center for each API bbox (even if absolute positions are wrong)
2. Cluster Y values to identify rows (same approach as Step 1)
   - Sort API centers by Y
   - Group into rows using gap detection
   - Calculate row centroid Y for each row
3. Cluster X values to identify columns (same approach as Step 1)
   - Sort API centers by X
   - Group into columns using gap detection
   - Calculate column centroid X for each column
4. Assign each API card to (row, col) based on its center's proximity to centroids
5. Verify: API grid dimensions should match OpenCV grid dimensions (M × N)
   - If mismatch, log warning and fall back to best-effort matching
```

**Key insight:** Even if API positions are absolutely wrong, they may be
RELATIVELY consistent. E.g., if card A is above card B in reality,
API might still report A.y < B.y even if both values are wrong.

The centroid-based clustering works in BOTH coordinate spaces independently,
then we match by grid cell (row, col) - not by absolute position.

### Step 3: Merge by Grid Cell

```
Input:
  - OpenCV grid: Map<(row,col), bbox>
  - API grid: Map<(row,col), cardId>
Output: Merged cards

Algorithm:
for each (row, col) in OpenCV grid:
    opencvBbox = opencvGrid[(row, col)]
    apiCard = apiGrid[(row, col)]  // May be null if API missed it

    if apiCard exists:
        merged.push({ ...apiCard, corners: opencvBbox.corners })
    else:
        merged.push({ cardId: 'unknown', corners: opencvBbox.corners })
```

---

## Robustness Analysis

### Advantages of Grid-Based Approach

1. **Position-independent matching**: Uses relative ordering, not absolute positions
2. **Handles irregular grids**: Works for 2×2, 3×3, 2×4, etc.
3. **Explicit empty cell handling**: Can detect when cards are missing
4. **Debuggable**: Grid assignments are visible and verifiable

### Edge Cases

| Case | Description | Handling |
|------|-------------|----------|
| Perfect grid | All cells filled | Direct mapping |
| Sparse grid | Some cells empty | Only match filled cells |
| Extra API cards | API returns more than OpenCV found | Drop extras |
| Missing API cards | API returns fewer | Mark as unknown |
| Rotated layout | Cards not axis-aligned | Still works if centers are correct |
| Overlapping cards | Partial visibility | May assign to wrong cell |
| Single card | No grid to detect | Fall back to direct match |
| Non-grid layout | Random arrangement | Needs different approach |

### Handling Truly Missing Cells (Future Scope)

**Scenario:** Physical 3×3 grid layout, but bottom-right position has no card.

```
[card] [card] [card]
[card] [card] [card]
[card] [card] [EMPTY - no physical card]
```

**Problem:**
- OpenCV detects 8 bboxes, clusters into 3 rows × 3 cols
- But row 2 only has 2 cards, not 3
- Column 2 has cards in rows 0 and 1, but not row 2
- Grid inference might incorrectly assume 3×3 = 9 positions

**Current approach (in scope):**
- Detect M rows and N columns from actual bbox positions
- Grid is M×N but some cells may be empty
- Only merge where BOTH OpenCV and API have data at (r, c)
- Works correctly: OpenCV has no bbox at (2,2), so nothing to merge there

**Why this works:**
- We don't "fill in" missing grid positions
- We only operate on actual OpenCV detections
- If OpenCV didn't detect it, we don't show an overlay there
- API might still identify 8 cards → 8 grid assignments → merge works

**Future enhancement (out of scope for now):**
- Detect "ragged" grids where rows have different column counts
- Infer expected positions for user to manually add missing cards
- Handle L-shaped or irregular arrangements

### Potential Failure Modes

1. **API relative ordering wrong**: If API doesn't preserve relative positions at all,
   grid mapping will fail. However, this would be surprising behavior for a vision model.

2. **Grid detection error**: If OpenCV positions are close enough to be ambiguous
   about row/column assignment, wrong grid cells may be assigned.

3. **Different grid interpretations**: If API sees a 3×3 grid but OpenCV sees 3×2+1
   (due to a card being in an ambiguous position), mapping will fail.

---

## Comparison to Current Algorithm

| Aspect | Current (v0.4.3) | Proposed Grid-Based |
|--------|------------------|---------------------|
| Complexity | Simple | Moderate |
| Assumption | API returns in reading order | API preserves relative positions |
| Grid awareness | None | Explicit |
| Empty cell handling | None | Supported |
| Debug visibility | Array indices | Grid coordinates |
| Failure mode | Silent mismatch | Detectable mismatch |

---

## Recommendation

**Implement grid-based merge** with the following refinements:

1. **Add logging**: Output detected grid structure and cell assignments
2. **Validate grid**: Check that OpenCV and API agree on grid dimensions
3. **Handle mismatches**: If grids don't align, fall back to current algorithm or mark all as uncertain
4. **Store grid info**: Include grid coordinates in scan diagnostics for debugging

### Implementation Sketch

```typescript
interface GridCell {
  row: number;
  col: number;
}

interface GriddedItem<T> {
  item: T;
  cell: GridCell;
  center: Point;
}

function detectGrid(centers: Point[]): { rows: number[]; cols: number[] } {
  // Cluster Y values into rows
  // Cluster X values into columns
  // Return row/col boundaries
}

function assignToGrid(center: Point, grid: { rows: number[]; cols: number[] }): GridCell {
  // Find which row bucket contains center.y
  // Find which col bucket contains center.x
  // Return (row, col)
}

function mergeByGrid(
  opencvCorners: Point[][],
  cloudCards: IdentifiedCard[]
): IdentifiedCard[] {
  // 1. Calculate centers for both
  // 2. Detect grid from OpenCV (source of truth for structure)
  // 3. Assign OpenCV bboxes to grid cells
  // 4. Assign cloud cards to grid cells (using relative positions)
  // 5. Merge by matching grid cells
}
```

---

## Critical Missing Data

**We don't have the raw API response bboxes in diagnostics.** The scans.json only
contains the MERGED result (OpenCV positions + cloud IDs). To verify the grid-based
approach, we need to log:

1. Raw API response: `{ card_name, card_type, bbox }` for each card
2. API bbox centers before merge
3. Grid cell assignments for both OpenCV and API

### Recommended Logging Addition

```typescript
// In scanWithCloud, after API returns:
console.log('[API Response] Raw cards:', response.cards.map(c => ({
  name: c.card_name,
  type: c.card_type,
  bbox: c.bbox,
  center: c.bbox ? {
    x: (c.bbox[0] + c.bbox[2]) / 2,
    y: (c.bbox[1] + c.bbox[3]) / 2
  } : null
})));

// In mergeByGrid:
console.log('[Grid] OpenCV assignments:', opencvGrid);
console.log('[Grid] API assignments:', apiGrid);
```

---

## Test Plan

Using collected diagnostics:

1. **Session 2025-12-26T21-47 (7 cards)**
   - Expected grid: 3×3 with 2 empty cells
   - Verify: Positions 0↔3 no longer swapped

2. **Previous sessions** (if available)
   - Re-run merge with new algorithm
   - Compare to screenshot for accuracy

3. **Synthetic tests**
   - 2×2 grid (4 cards)
   - 3×3 grid (9 cards)
   - Irregular grids (5, 6, 7 cards)
   - Single card

---

## Next Steps

1. **Add API response logging** - Capture raw bboxes before merge to verify hypothesis
2. **Implement grid detection** - Cluster OpenCV centers into rows/columns
3. **Implement grid-based merge** - Match by (row, col) instead of array index
4. **Test with diagnostics** - Verify session 2025-12-26T21-47 produces correct result
5. **Deploy and collect more data** - Verify fix works across different layouts
