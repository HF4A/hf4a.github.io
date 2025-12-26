# HF4A Scan Pipeline Specification

## Current Issues (v0.4.0, build EC4B)

### 1. Bbox Mapping Failures
- **Overlapping bboxes**: Grid matching produces duplicate bboxes for same card position
- **Bad aspect ratios**: Transformed cloud bboxes have incorrect aspect ratios (e.g., 65px height)
- **Wrong cell assignment**: Cloud and OpenCV assigned to different grid cells for same physical location

**Root cause**: Cloud bboxes are in a fake coordinate space that doesn't match image reality. Grid-based matching tries to reconcile two incompatible coordinate systems.

### 2. Async Scan Correlation
- User can snap multiple scans quickly before API returns
- Each scan needs unique correlation ID
- API responses must update the correct scan slot
- Currently: scans stored with `id` but unclear if async updates work correctly

### 3. Card Flip Not Working
- Tapping identified card should flip to show opposite side
- Currently broken - need to investigate data flow

### 4. Correction Flow
- Shows "Running OCR" when it should use cached API data
- Needs refactoring for new cloud pipeline

---

## Revised Architecture

### Principle: OpenCV is Source of Truth for Position

Cloud API is unreliable for bbox positions. OpenCV is reliable for positions but may miss cards.

**Decision**: Only use OpenCV bboxes. Cloud provides identification only.

### Scan Flow

```
1. CAPTURE
   - Capture frame from video → imageDataUrl
   - Generate unique scanId: `scan-${Date.now()}-${randomId()}`
   - Store scan immediately with:
     - id, timestamp, imageDataUrl, imageWidth, imageHeight
     - cards: [] (empty)
     - isProcessing: true

2. OPENCV DETECTION (sync, ~50ms)
   - Run detectAllCards() on canvas
   - Get array of corner points (accurate positions)
   - Update scan.cards with placeholder cards:
     - cardId: 'detecting'
     - corners: from OpenCV
     - identified: false

3. CLOUD API (async, ~2-3s)
   - Send image to cloud with scanId in request
   - Response includes scanId for correlation
   - Parse card identifications (ignore cloud bboxes entirely)

4. MERGE (on API response)
   - Find scan by scanId
   - Match cloud identifications to OpenCV bboxes by sorted order
   - Update scan.cards with identified info
   - Set isProcessing: false
```

### Matching Algorithm (Simplified)

```typescript
function matchCloudToOpenCV(
  cloudCards: CloudCard[],     // From API (ignore bboxes)
  opencvBboxes: Point[][]      // From OpenCV (accurate)
): IdentifiedCard[] {

  // Sort OpenCV by position (reading order)
  const sortedOpenCV = sortByReadingOrder(opencvBboxes);

  // Sort cloud by their (unreliable) positions for relative ordering
  const sortedCloud = sortByReadingOrder(cloudCards);

  // Pair 1:1 by array index
  const result: IdentifiedCard[] = [];

  for (let i = 0; i < sortedOpenCV.length; i++) {
    if (i < sortedCloud.length) {
      // Matched: use cloud ID + OpenCV bbox
      result.push({
        cardId: sortedCloud[i].cardId,
        filename: sortedCloud[i].filename,
        side: sortedCloud[i].side,
        confidence: sortedCloud[i].confidence,
        corners: sortedOpenCV[i],  // OpenCV position!
        identified: true,
      });
    } else {
      // Extra OpenCV bbox: unknown
      result.push({
        cardId: 'unknown',
        corners: sortedOpenCV[i],
        identified: false,
      });
    }
  }

  // Note: Extra cloud cards (beyond OpenCV count) are dropped
  // Their positions are unreliable, better to show nothing than wrong

  return result;
}
```

### Data Model

```typescript
interface CapturedScan {
  id: string;              // Unique correlation ID
  timestamp: number;
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  cards: IdentifiedCard[];
  isProcessing: boolean;   // True while waiting for API
  apiRequestId?: string;   // For async correlation
}

interface IdentifiedCard {
  cardId: string;          // 'unknown' | 'detecting' | actual ID
  filename: string;
  side: 'white' | 'black' | 'blue' | null;
  confidence: number;
  corners: Point[];
  identified: boolean;
  showingOpposite: boolean;
}
```

### UI States

| State | Card Label | Bbox Style |
|-------|------------|------------|
| Detecting (OpenCV done, API pending) | "SCANNING..." | Dashed cyan |
| Identified | Card name + "FRONT/BACK" | Solid cyan |
| Unknown (API done, no match) | "UNIDENTIFIED" | Dashed gray |
| Failed (API error) | "SCAN FAILED" | Dashed red |

### Card Flip Behavior

When user taps an identified card:
1. Toggle `showingOpposite` flag
2. Display opposite side image (load from card data)
3. Change label from "FRONT" to "BACK"

Required: Card data must include `oppositeFilename` or similar.

### Correction Flow

When user taps unidentified card or selects "Rescan":
1. Show card selector (NOT "Running OCR")
2. User can search/browse to find correct card
3. On selection, update card in scan
4. Log correction for analytics

---

## Implementation Checklist

- [ ] Simplify merge function: array-order matching, OpenCV positions only
- [ ] Add proper scanId to API requests/responses
- [ ] Verify async update flow with multiple rapid scans
- [ ] Fix card flip toggle
- [ ] Remove "Running OCR" from correction flow
- [ ] Add "SCANNING..." state during API wait
- [ ] Handle API timeout/error gracefully

---

## Known Limitations

1. **If OpenCV misses a card, it cannot be shown**
   - Cloud may identify it, but we have no reliable position
   - Could show "X additional cards detected" message

2. **Card order depends on reliable reading-order sort**
   - Works for regular grids
   - May fail for irregular arrangements

3. **No card flip data currently**
   - Need to verify card data includes opposite side info
