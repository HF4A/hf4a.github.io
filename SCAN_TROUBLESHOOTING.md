# Scan Pipeline Troubleshooting Guide

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPTURE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User taps SCAN                                               │
│       ↓                                                          │
│  2. Capture frame from video → Canvas (720×1280)                 │
│       ↓                                                          │
│  3. OpenCV.js detectAllCards()                                   │
│       → Returns: Point[][] (accurate bbox corners)               │
│       → Immediate visual feedback with "SCANNING..." overlays    │
│       ↓                                                          │
│  4. Cloud API (async, ~2-3 seconds)                              │
│       → Returns: CardResult[] { card_name, card_type, bbox }     │
│       → bbox is UNRELIABLE (fake grid positions)                 │
│       ↓                                                          │
│  5. mergeCloudWithOpenCV()   ← BUG IS HERE                       │
│       → Attempts to pair cloud IDs with OpenCV positions         │
│       ↓                                                          │
│  6. Update UI with identified cards                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Root Cause Analysis

### The Problem
The merge algorithm sorts BOTH cloud results AND OpenCV results by "reading order" (top-to-bottom, left-to-right), then pairs them 1:1 by index.

**Flawed assumption**: Sorting both lists by position will produce matching indices.

**Reality**: Cloud API bbox positions are FAKE/UNRELIABLE. They don't match actual card positions in the image. Sorting by fake positions produces a different order than sorting by real positions.

### Example Failure (Session 2025-12-26T21-47)

Physical layout (7 cards):
```
Row 1: [Robonaut]  [Generator-Ericsson]
Row 2: [Generator-InCore] [Thruster-SolarMoth] [Reactor-Penning]
Row 3: [Reactor-Orion]  [Refinery-CarboChlor]
```

OpenCV detected 7 bboxes (CORRECT positions):
```
idx  center        actual card
0    (326, 339)    Robonaut
1    (565, 328)    Generator-Ericsson
2    (125, 607)    Generator-InCore
3    (335, 616)    Thruster-SolarMoth
4    (600, 610)    Reactor-Penning
5    (365, 899)    Reactor-Orion
6    (603, 903)    Refinery-CarboChlor
```

Cloud API returned 7 cards but with FAKE bbox positions. When sorted by those fake positions, the order became:
```
idx  cardId
0    thruster-12    ← Should be robonaut-12
1    generator-06   ✓
2    generator-09   ✓
3    robonaut-12    ← Should be thruster-12
4    reactor-09     ✓
5    reactor-10     ✓
6    refinery-04    ✓
```

Result: Positions 0 and 3 have swapped identifications.

## Solution Options

### Option A: Don't Sort Cloud Results (Recommended)
Trust that GPT-4 Vision returns cards in natural reading order. Only sort OpenCV bboxes.

```typescript
// Sort OpenCV by position
const sortedOpenCV = sortByReadingOrder(opencvCorners);

// DON'T sort cloud - use original API order
const cloudInOrder = cloudCards;

// Pair 1:1
```

**Pros**: Simple, leverages model's natural reading behavior
**Cons**: Assumes model always returns in reading order

### Option B: Use dHash for Correlation
For each OpenCV bbox, compute dHash of cropped region and match against cloud-identified card images.

```typescript
for (const opencvBbox of sortedOpenCV) {
  const croppedHash = computeDHash(crop(image, opencvBbox));
  const matchedCloud = cloudCards.find(c =>
    hammingDistance(croppedHash, getCardHash(c.cardId)) < threshold
  );
}
```

**Pros**: Position-independent matching
**Cons**: Requires card hash index, adds latency

### Option C: Hybrid - Use Cloud Results Only (No OpenCV)
If cloud API returns N cards, trust cloud completely including positions.

**Pros**: Simplest implementation
**Cons**: Cloud positions are known to be wrong

### Option D: Grid Analysis
Detect grid structure from OpenCV, map cloud results to grid cells.

**Pros**: Handles any layout
**Cons**: Complex, many edge cases

## Edge Cases to Test

| Case | Description | Expected Behavior |
|------|-------------|-------------------|
| E1 | Single card | Direct match, no ambiguity |
| E2 | 2×2 grid (4 cards) | All 4 correctly positioned |
| E3 | 3×3 grid (9 cards) | All 9 correctly positioned |
| E4 | Irregular layout (not grid) | Best-effort reading order |
| E5 | Partial overlap | Handle gracefully |
| E6 | Cloud returns fewer than OpenCV | Extra OpenCV → "unknown" |
| E7 | Cloud returns more than OpenCV | Extra cloud → dropped |
| E8 | Rotated cards | OpenCV handles, cloud may struggle |
| E9 | Poor lighting | Lower confidence, more unknowns |
| E10 | Mixed card types | No impact on positioning |

## Testing Routine

### Setup
1. Collect diagnostic exports with known issues
2. Extract to `diagnostics/session-YYYY-MM-DDTHH-MM/`
3. Include screenshot for visual reference

### Test Script (Manual)
```bash
# 1. Start local dev server
npm run dev

# 2. Open on device, scan cards
# 3. Export diagnostics
# 4. Compare scans.json cardIds to actual card positions in screenshot

# For each scan:
# - List cardIds in order
# - List actual cards from screenshot in same order
# - Mark mismatches
```

### Automated Test (Future)
Create test harness that:
1. Loads saved scan images
2. Runs OpenCV detection
3. Mocks cloud API response
4. Verifies merge produces correct pairings

## Diagnostic Data Format

### scans.json
```json
{
  "id": "scan-{timestamp}",
  "imageWidth": 720,
  "imageHeight": 1280,
  "cards": [
    {
      "cardId": "thruster-12",           // Cloud identification
      "corners": [...],                   // Should be OpenCV position
      "confidence": 1,
      "identified": true
    }
  ]
}
```

### What to Check
1. **cardId** - What cloud identified
2. **corners** - Where overlay will appear
3. Compare corners center to actual card position in screenshot

## Collected Test Cases

| Session | Cards | Issue | Status |
|---------|-------|-------|--------|
| 2025-12-26T21-47 | 7 | Positions 0↔3 swapped | Open |

## Fix History

| Version | Hash | Fix | Result |
|---------|------|-----|--------|
| v0.3.x | - | Initial sorted-order merge | Off-by-one errors |
| v0.4.x | 51D8 | Same algorithm | Still failing |
