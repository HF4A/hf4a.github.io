# Pipeline Refactor Plan

**Created:** 2025-12-23 ~2:00am
**Status:** Draft for review
**Supersedes:** Current pipeline documented in `2025-12-23-01-19-pipeline.md`

---

## Executive Summary

Fundamental shift in card identification strategy:

| Current | Proposed |
|---------|----------|
| Hash-primary, OCR absent | OCR-primary, hash secondary |
| Warp individual cards | Warp entire frame first |
| 200×280 warp output | Full resolution preservation |
| Color-based type detection | Text-based type detection |
| No text in main pipeline | Full OCR extraction |

The new pipeline has two distinct phases:
1. **Phase A: Card Detection** - Find cards in frame using perspective-corrected image
2. **Phase B: Card Identification** - OCR + fuzzy text matching against metadata index

---

## Evaluation of New Approach

### Why Warp-Then-Detect is Better

**Current approach problems:**
- Detects quadrilaterals on skewed image
- Aspect ratio check on bounding box is inaccurate for tilted cards
- Each card warped individually (redundant work)
- Warped output is tiny (200×280) - lossy

**New approach benefits:**
- Warp entire frame once using detected skew
- All cards become properly oriented rectangles
- Detection on corrected image is more reliable
- Aspect ratio check becomes meaningful
- Size consistency check becomes meaningful
- Original resolution preserved for OCR

### Why OCR-Primary is Better

**Hash matching limitations (observed):**
- Hamming distance threshold (22 bits) is very loose
- Perspective distortion ruins hash even after warp
- Similar-looking cards produce similar hashes (radiators all look alike)
- No semantic understanding - can't distinguish "Refinery" from "Reactor"

**OCR advantages:**
- Card type text is unambiguous ("Refinery" vs "Reactor")
- Card name is unique identifier
- Fuzzy matching is cheap and well-understood
- Can segment search space by type first
- Human-readable for debugging

**OCR challenges (addressed below):**
- Latency (~300-600ms per card)
- Reliability (OCR.space returning empty)
- Font/styling variations

### Performance Budget

| Operation | Time | Notes |
|-----------|------|-------|
| Frame capture | <10ms | Synchronous |
| Pre-detect (skew) | ~50ms | Single largest quad |
| Full-frame warp | ~20ms | OpenCV perspective transform |
| Card detection | ~50ms | On corrected image |
| OCR per card | ~400ms | OCR.space Engine 2 |
| Hash per card | ~5ms | Local computation |
| Fuzzy match | <10ms | Fuse.js, fast |

**Worst case (9 cards):** ~500ms + 9×400ms = ~4.1 seconds

This is acceptable because:
1. Scanning animation provides feedback
2. Cards can be processed in parallel
3. Results appear progressively
4. User is at the table, not in a hurry

**Optimization opportunity:** Batch OCR requests or use parallel fetch calls.

---

## Updated Pipeline Overview

```
╔══════════════════════════════════════════════════════════════════╗
║                    PHASE A: CARD DETECTION                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  A1. CAPTURE                                                 │  ║
║  │      - Full camera resolution (1920×1080 typical)           │  ║
║  │      - JPEG 95% or PNG                                      │  ║
║  │      - Store as imageDataUrl for later use                  │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  A2. PRE-DETECT (Skew Analysis)                              │  ║
║  │      - Run OpenCV edge detection                            │  ║
║  │      - Find largest quadrilateral                           │  ║
║  │      - Calculate skew angle from top edge                   │  ║
║  │      - Output: rotation angle + perspective params          │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  A3. FULL-FRAME WARP                                         │  ║
║  │      - Apply perspective correction to ENTIRE image         │  ║
║  │      - Output: corrected image at original resolution       │  ║
║  │      - Cards should now be upright rectangles               │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  A4. CARD DETECTION                                          │  ║
║  │      - OpenCV contour detection on corrected image          │  ║
║  │      - Find all card-shaped rectangles                      │  ║
║  │      - Validation:                                          │  ║
║  │        • Aspect ratio ~1.4 (±0.2, tighter now)             │  ║
║  │        • Size similarity (within 30% of median)             │  ║
║  │        • [Future] Convexity check                           │  ║
║  │      - Output: Array of card regions (corners in corrected  │  ║
║  │        image space)                                         │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
╚════════════════════════════╪════════════════════════════════════╝
                             │
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                  PHASE B: CARD IDENTIFICATION                     ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  B1. EXTRACT CARD IMAGES                                     │  ║
║  │      - Crop each detected region from corrected image       │  ║
║  │      - High resolution (~400×560 per card typical)          │  ║
║  │      - Store for display in correction modal                │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  B2. OCR EXTRACTION (per card, parallel)                     │  ║
║  │                                                              │  ║
║  │      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  ║
║  │      │ Full Card   │  │ Type Region │  │ Title Region│      │  ║
║  │      │ (all text)  │  │ (top 15%)   │  │ (bottom 20%)│      │  ║
║  │      └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │  ║
║  │             │                │                │              │  ║
║  │             └────────────────┼────────────────┘              │  ║
║  │                              │                               │  ║
║  │      Output per card:                                       │  ║
║  │        • fullText: "Refinery Metal refining... Carbo..."   │  ║
║  │        • typeText: "Refinery"                               │  ║
║  │        • titleText: "Carbo-Chlorination"                    │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  B3. TEXT MATCHING (Fuzzy Search)                            │  ║
║  │                                                              │  ║
║  │      Pass 1: Type-Segmented Search                          │  ║
║  │        - Parse typeText to card type enum                   │  ║
║  │        - Filter index to matching type + active types       │  ║
║  │        - Fuzzy match titleText against filtered cards       │  ║
║  │        - If high confidence match found → done              │  ║
║  │                                                              │  ║
║  │      Pass 2: Broad Search (if Pass 1 low confidence)        │  ║
║  │        - Search all active card types                       │  ║
║  │        - Fuzzy match fullText against all card metadata     │  ║
║  │        - Rank by match score                                │  ║
║  │                                                              │  ║
║  │      Output: Array of candidates with text match scores     │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  B4. HASH MATCHING (Secondary Signal)                        │  ║
║  │      - Resize card image to 9×8                             │  ║
║  │      - Compute dHash                                        │  ║
║  │      - Compare against index (filtered by active types)     │  ║
║  │      - Output: Array of candidates with hash distances      │  ║
║  │                                                              │  ║
║  │      NOTE: This step may be removed in future if OCR        │  ║
║  │      proves sufficient. Kept for now as fallback.           │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
║                            ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  B5. MATCH FUSION                                            │  ║
║  │                                                              │  ║
║  │      Scoring formula:                                       │  ║
║  │        finalScore = (textScore × 0.85) + (hashScore × 0.15) │  ║
║  │                                                              │  ║
║  │      Where:                                                 │  ║
║  │        textScore = weighted combination of:                 │  ║
║  │          - typeMatch: 0.3 (type text matches card type)     │  ║
║  │          - titleMatch: 0.5 (fuzzy title match score)        │  ║
║  │          - fullTextMatch: 0.2 (any supporting text)         │  ║
║  │                                                              │  ║
║  │        hashScore = 1.0 - (hammingDistance / 32)             │  ║
║  │          - Only contributes if distance < 32                │  ║
║  │          - 0 contribution if hash matching disabled         │  ║
║  │                                                              │  ║
║  │      Confidence thresholds:                                 │  ║
║  │        > 0.8: High confidence, auto-accept                  │  ║
║  │        0.5-0.8: Medium confidence, show in results          │  ║
║  │        < 0.5: Low confidence, mark as "unknown"             │  ║
║  │                                                              │  ║
║  │      Output: Ranked list of matches with final scores       │  ║
║  └─────────────────────────┬───────────────────────────────────┘  ║
║                            │                                       ║
╚════════════════════════════╪════════════════════════════════════╝
                             │
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                       PHASE C: STORAGE                            ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Store to localStorage:                                           ║
║    • Original capture (imageDataUrl, high quality)                ║
║    • Corrected frame (warpedImageDataUrl) - OR recreate on demand ║
║    • Per card:                                                    ║
║      - corners (in corrected image space)                         ║
║      - extractedText { fullText, typeText, titleText }            ║
║      - matchResult { cardId, filename, side, confidence }         ║
║      - computedHash (for debugging)                               ║
║      - topMatches (for correction modal)                          ║
║                                                                    ║
║  Storage optimization:                                            ║
║    If 9 cards × card images is too large, store only:             ║
║    - Original image + warp parameters                             ║
║    - Card corners in corrected space                              ║
║    - Recreate cropped card views on demand in correction modal    ║
║                                                                    ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Detailed Implementation Plan

### Prerequisites

Before implementing the new pipeline:

1. **Fix OCR.space integration** - Currently returning empty text
   - Verify API is being called correctly
   - Test with higher resolution input
   - Add retry logic

2. **Expand card metadata index** - Currently only has hash
   - Add `type` field (already derived from cardId)
   - Add `name` field (card title)
   - Add `keywords` field (searchable text from card)

---

### Step 1: Metadata Index Expansion

**File:** `scripts/generate-card-index.ts`

**Changes:**
```typescript
interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  hash: string;
  hashBytes: number[];
  // NEW fields:
  type: CardType;           // "refinery", "thruster", etc.
  name: string;             // "Carbo-Chlorination", "Re-Solar Moth"
  keywords: string[];       // ["metal", "refining", "chloride", "salts"]
}
```

**Source:** Parse from existing spreadsheet metadata in `cards.json`

**Output:** Updated `public/data/card-index.json`

---

### Step 2: Full-Frame Warp Infrastructure

**File:** `src/features/showxating/services/visionPipeline.ts`

**New functions:**

```typescript
/**
 * Detect the dominant skew angle from the frame
 * Returns angle and perspective transform parameters
 */
export function detectFrameSkew(
  imageData: ImageData,
  width: number,
  height: number
): SkewAnalysis {
  // Find largest quadrilateral
  // Calculate rotation angle from top edge
  // Return transform parameters
}

/**
 * Apply perspective correction to entire frame
 * Returns corrected image at original resolution
 */
export function warpFullFrame(
  canvas: HTMLCanvasElement,
  skewParams: SkewAnalysis
): HTMLCanvasElement {
  // Apply perspective transform to entire image
  // Maintain original resolution
  // Return corrected canvas
}

/**
 * Detect cards in a perspective-corrected frame
 * Tighter validation since cards should now be upright
 */
export function detectCardsInCorrectedFrame(
  imageData: ImageData,
  width: number,
  height: number
): CardDetectionResult[] {
  // Same contour detection as before
  // Tighter aspect ratio tolerance (±0.2)
  // Size consistency filter
  // Return array of card regions
}
```

---

### Step 3: OCR Service

**New file:** `src/features/showxating/services/ocrService.ts`

```typescript
export interface OCRResult {
  fullText: string;
  typeText: string;
  titleText: string;
  confidence: number;
  rawResponse?: unknown; // For debugging
}

/**
 * Extract text from a card image
 * Runs three OCR passes: full card, type region, title region
 */
export async function extractCardText(
  cardCanvas: HTMLCanvasElement
): Promise<OCRResult> {
  // Run OCR on full card
  const fullText = await runOCR(cardCanvas);

  // Extract type region (top 15%)
  const typeCanvas = cropRegion(cardCanvas, { y: 0, h: 0.15 });
  const typeText = await runOCR(typeCanvas);

  // Extract title region (bottom 20%)
  const titleCanvas = cropRegion(cardCanvas, { y: 0.80, h: 0.20 });
  const titleText = await runOCR(titleCanvas);

  return { fullText, typeText, titleText, confidence };
}

/**
 * Run OCR on a canvas using OCR.space
 */
async function runOCR(canvas: HTMLCanvasElement): Promise<string> {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  const formData = new FormData();
  formData.append('base64Image', dataUrl);
  formData.append('language', 'eng');
  formData.append('OCREngine', '2');
  formData.append('scale', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'apikey': 'helloworld' }, // TODO: User-provided key
    body: formData,
  });

  const result = await response.json();
  return result.ParsedResults?.[0]?.ParsedText || '';
}
```

---

### Step 4: Text Matching Service

**New file:** `src/features/showxating/services/textMatcher.ts`

```typescript
import Fuse from 'fuse.js';

export interface TextMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  score: number;
  matchedOn: 'type' | 'title' | 'fullText';
}

/**
 * Match extracted text against card index
 * Two-pass approach: type-segmented first, then broad
 */
export function matchByText(
  ocrResult: OCRResult,
  activeTypes: Set<CardType>
): TextMatchResult[] {
  const index = getCardIndex();

  // Parse detected type
  const detectedType = parseTypeFromText(ocrResult.typeText);

  // Pass 1: Search within detected type
  if (detectedType && activeTypes.has(detectedType)) {
    const typeFiltered = index.filter(c => c.type === detectedType);
    const fuse = new Fuse(typeFiltered, {
      keys: ['name', 'keywords'],
      threshold: 0.4,
      includeScore: true,
    });

    const results = fuse.search(ocrResult.titleText);
    if (results.length > 0 && results[0].score < 0.3) {
      // High confidence match within type
      return formatResults(results, 'title');
    }
  }

  // Pass 2: Broad search across all active types
  const activeFiltered = index.filter(c => activeTypes.has(c.type));
  const fuse = new Fuse(activeFiltered, {
    keys: ['name', 'keywords', 'type'],
    threshold: 0.5,
    includeScore: true,
  });

  const results = fuse.search(ocrResult.fullText);
  return formatResults(results, 'fullText');
}

/**
 * Parse type string from OCR output
 * Handles variations: "Refinery", "REFINERY", "Refiner", etc.
 */
function parseTypeFromText(text: string): CardType | null {
  const normalized = text.toLowerCase().trim();

  const typeMap: Record<string, CardType> = {
    'refinery': 'refinery',
    'thruster': 'thruster',
    'reactor': 'reactor',
    'radiator': 'radiator',
    'robonaut': 'robonaut',
    'generator': 'generator',
    'crew': 'crew',
    'colonist': 'colonist',
    // Add fuzzy variants
    'refiner': 'refinery',
    'thrust': 'thruster',
    // etc.
  };

  for (const [pattern, type] of Object.entries(typeMap)) {
    if (normalized.includes(pattern)) return type;
  }

  return null;
}
```

---

### Step 5: Match Fusion

**File:** `src/features/showxating/services/cardMatcher.ts`

**New function:**

```typescript
export interface FusedMatchResult {
  cardId: string;
  filename: string;
  side: string | null;
  finalScore: number;
  textScore: number;
  hashScore: number;
  confidence: 'high' | 'medium' | 'low';
  extractedText: OCRResult;
}

/**
 * Fuse text matching and hash matching results
 * Text matching is primary (85%), hash is secondary (15%)
 */
export function fuseMatches(
  textMatches: TextMatchResult[],
  hashMatches: MatchResult[],
  ocrResult: OCRResult
): FusedMatchResult[] {
  const candidates = new Map<string, FusedMatchResult>();

  // Add text matches (primary)
  for (const tm of textMatches) {
    candidates.set(tm.cardId, {
      cardId: tm.cardId,
      filename: tm.filename,
      side: tm.side,
      textScore: 1.0 - tm.score, // Fuse score is 0=perfect, convert
      hashScore: 0,
      finalScore: 0,
      confidence: 'low',
      extractedText: ocrResult,
    });
  }

  // Add hash matches (secondary)
  for (const hm of hashMatches) {
    const existing = candidates.get(hm.cardId);
    const hashScore = Math.max(0, 1.0 - hm.distance / 32);

    if (existing) {
      existing.hashScore = hashScore;
    } else {
      candidates.set(hm.cardId, {
        cardId: hm.cardId,
        filename: hm.filename,
        side: hm.side,
        textScore: 0,
        hashScore,
        finalScore: 0,
        confidence: 'low',
        extractedText: ocrResult,
      });
    }
  }

  // Calculate final scores
  for (const c of candidates.values()) {
    c.finalScore = (c.textScore * 0.85) + (c.hashScore * 0.15);
    c.confidence = c.finalScore > 0.8 ? 'high'
                 : c.finalScore > 0.5 ? 'medium'
                 : 'low';
  }

  // Sort by final score descending
  return Array.from(candidates.values())
    .sort((a, b) => b.finalScore - a.finalScore);
}
```

---

### Step 6: Updated Capture Flow

**File:** `src/features/showxating/components/ShowxatingShell.tsx`

**Revised capture function:**

```typescript
const capture = useCallback(async () => {
  setIsCapturing(true);

  try {
    // A1: Capture at high quality
    const canvas = captureFrame(video, 0.95); // JPEG 95%
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // A2: Pre-detect skew
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const skewParams = detectFrameSkew(imageData, canvas.width, canvas.height);
    log.debug(`Detected skew: ${skewParams.angle.toFixed(1)}°`);

    // A3: Warp entire frame
    const correctedCanvas = warpFullFrame(canvas, skewParams);
    const correctedImageData = correctedCtx.getImageData(...);

    // A4: Detect cards in corrected frame
    const detectedCards = detectCardsInCorrectedFrame(
      correctedImageData,
      correctedCanvas.width,
      correctedCanvas.height
    );
    log.info(`Detected ${detectedCards.length} cards`);

    // B: Identify each card (parallel)
    const identifiedCards = await Promise.all(
      detectedCards.map(async (card) => {
        // B1: Extract card image
        const cardCanvas = cropCard(correctedCanvas, card.corners);

        // B2: OCR (async)
        const ocrResult = await extractCardText(cardCanvas);
        log.debug(`OCR: type="${ocrResult.typeText}" title="${ocrResult.titleText}"`);

        // B3: Text matching
        const textMatches = matchByText(ocrResult, activeTypes);

        // B4: Hash matching (secondary)
        const hashMatches = matcher.matchFromCanvas(cardCanvas);

        // B5: Fusion
        const fusedMatches = fuseMatches(textMatches, hashMatches, ocrResult);

        const bestMatch = fusedMatches[0];
        return {
          cardId: bestMatch?.cardId || 'unknown',
          filename: bestMatch?.filename || '',
          side: bestMatch?.side || null,
          confidence: bestMatch?.finalScore || 0,
          corners: card.corners,
          extractedText: ocrResult,
          topMatches: fusedMatches.slice(0, 5),
        };
      })
    );

    // C: Store
    const scan: CapturedScan = {
      id: `scan-${Date.now()}`,
      timestamp: Date.now(),
      imageDataUrl,                    // Original capture
      warpedImageDataUrl: correctedCanvas.toDataURL('image/jpeg', 0.95),
      cards: identifiedCards,
    };

    addCapture(scan);

  } finally {
    setIsCapturing(false);
  }
}, [/* deps */]);
```

---

### Step 7: Storage Optimization

**Decision required:** Store warped card images or recreate on demand?

**Option A: Store everything**
- Pro: Fast correction modal load
- Con: ~400KB per card × 9 cards = ~3.6MB per scan
- Con: 7 slots × 3.6MB = ~25MB (exceeds localStorage)

**Option B: Store original + recreate on demand**
- Pro: ~400KB per scan regardless of card count
- Pro: Fits easily in localStorage
- Con: ~100ms delay when opening correction modal

**Recommendation:** Option B with lazy recreation.

```typescript
// In CapturedScanView, recreate warped card on demand:
const getCardImage = useCallback((cardIndex: number) => {
  const card = scan.cards[cardIndex];

  // Load original image
  const img = new Image();
  img.src = scan.imageDataUrl;
  await img.decode();

  // Recreate warp and crop
  const canvas = document.createElement('canvas');
  // ... apply stored skew params, crop to card.corners

  return canvas.toDataURL();
}, [scan]);
```

---

## Implementation Phases

### Phase 1: Foundation (Do First)
- [ ] Expand card-index.json with type, name, keywords
- [ ] Fix OCR.space integration (test with full-res images)
- [ ] Add OCR service with full/type/title extraction

### Phase 2: Detection Refactor
- [ ] Implement `detectFrameSkew()`
- [ ] Implement `warpFullFrame()`
- [ ] Implement `detectCardsInCorrectedFrame()`
- [ ] Update capture flow to use new detection

### Phase 3: Identification Refactor
- [ ] Implement text matching service with Fuse.js
- [ ] Implement match fusion
- [ ] Update capture flow to use OCR + text matching
- [ ] Demote hash matching to secondary role

### Phase 4: Storage & UI
- [ ] Update storage schema for new data
- [ ] Implement on-demand card image recreation
- [ ] Update correction modal to show OCR results
- [ ] Add OCR text editing in correction modal

### Phase 5: Polish (Fast Followers)
- [ ] Add convexity check as optional filter
- [ ] Add user-provided OCR API key option
- [ ] Add OCR caching to avoid re-running
- [ ] Consider removing hash matching entirely

---

## Open Questions for Review

1. **OCR API key:** Continue with `helloworld` demo key, or add user-provided key in settings?

2. **Parallel OCR:** Run all cards through OCR simultaneously, or sequential to avoid rate limits?

3. **Warp storage:** Store warped frame, or just original + skew params and recreate?

4. **Convexity:** Include now as optional, or defer entirely?

5. **Hash removal timeline:** Keep hash matching for how long as fallback? Remove after N successful OCR-only releases?

---

## Files Changed Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `scripts/generate-card-index.ts` | Modify | Add type, name, keywords |
| `public/data/card-index.json` | Regenerate | Include new fields |
| `services/visionPipeline.ts` | Modify | Add skew detection, full-frame warp |
| `services/ocrService.ts` | New | OCR extraction service |
| `services/textMatcher.ts` | New | Fuzzy text matching |
| `services/cardMatcher.ts` | Modify | Add fusion logic, demote hash |
| `ShowxatingShell.tsx` | Modify | New capture flow |
| `store/showxatingStore.ts` | Modify | Update schema for OCR data |
| `CapturedScanView.tsx` | Modify | On-demand card recreation |

---

## Appendix: OCR Provider Evaluation & LLM-Enhanced Architecture

### Overview

This section evaluates alternative OCR approaches beyond OCR.space, with particular focus on OpenAI's vision APIs. This evaluation also considers the broader architectural implications of adopting a unified AI provider strategy, including future capabilities and hosting requirements.

---

### OCR Provider Comparison

| Provider | Cost | Latency | Accuracy | Client-Only | Notes |
|----------|------|---------|----------|-------------|-------|
| **OCR.space** | Free tier (25k/mo) | 300-600ms | Medium | ✅ Yes | Current choice, returning empty |
| **Tesseract.js** | Free | 500-1500ms | Low | ✅ Yes | Tested, garbage output on card text |
| **Google Cloud Vision** | $1.50/1k images | 200-400ms | High | ❌ No | Requires backend proxy |
| **AWS Textract** | $1.50/1k pages | 300-500ms | High | ❌ No | Requires backend proxy |
| **Azure Computer Vision** | $1/1k images | 200-400ms | High | ❌ No | Requires backend proxy |
| **OpenAI GPT-4o** | $2.50/1M input tokens | 500-1500ms | Very High | ❌ No | Vision + understanding |
| **OpenAI GPT-4o-mini** | $0.15/1M input tokens | 300-800ms | High | ❌ No | Cost-effective vision |
| **Anthropic Claude** | $3/1M input tokens | 500-1500ms | Very High | ❌ No | Vision + understanding |

**Key insight:** The high-accuracy providers (Google, AWS, Azure, OpenAI, Anthropic) all require backend infrastructure to protect API keys.

---

### OpenAI Vision API: Deep Evaluation

#### What GPT-4o Offers Beyond OCR

Traditional OCR extracts text. GPT-4o with vision can:

1. **Extract text** - "What text do you see on this card?"
2. **Understand context** - "This is a Refinery card that processes chloride salts"
3. **Describe visual elements** - "Yellow/orange icon in top-left, diagram showing chemical process"
4. **Identify card** - "This appears to be the Carbo-Chlorination refinery card"
5. **Compare to candidates** - "Given these 5 possible matches, which is most likely?"

#### LLM-Mediated Matching Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│  B2-ALT: LLM VISION EXTRACTION                                    │
│                                                                    │
│  Prompt:                                                          │
│  "Analyze this High Frontier 4 All card image. Extract:          │
│   1. Card type (top banner text)                                  │
│   2. Card name (bottom text)                                      │
│   3. Key stats visible (mass, rad-hard, etc.)                    │
│   4. Brief description of the diagram/artwork                     │
│   Return as JSON."                                                │
│                                                                    │
│  Response:                                                        │
│  {                                                                │
│    "type": "Refinery",                                           │
│    "name": "Carbo-Chlorination",                                 │
│    "stats": { "mass": 2, "radHard": 4 },                        │
│    "description": "Chemical process diagram showing AlCl3..."    │
│  }                                                                │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  B3-ALT: FUZZY MATCH (unchanged)                                  │
│  - Type-segmented search                                          │
│  - Fuzzy match on name + description                             │
│  - Narrow to top 5 candidates                                    │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼ (if confidence < 0.8)
┌──────────────────────────────────────────────────────────────────┐
│  B3.5-NEW: LLM DISAMBIGUATION (Optional)                          │
│                                                                    │
│  Prompt:                                                          │
│  "Given the extracted card info and these 5 candidates:          │
│   [candidate metadata with images]                                │
│   Which is the best match? Explain your reasoning."              │
│                                                                    │
│  Benefits:                                                        │
│  - Semantic understanding of card differences                    │
│  - Can distinguish "Carbo-Chlorination" from "Sabatier Methanator"│
│  - Handles OCR errors gracefully ("Carbo-Chlor1nation" → match)  │
└──────────────────────────────────────────────────────────────────┘
```

#### Cost Analysis

**Assumptions:**
- Average card image: ~100KB JPEG ≈ 1,500 tokens (GPT-4o vision encoding)
- Prompt + response: ~500 tokens
- Total per card: ~2,000 tokens

**Per-scan costs (9 cards max):**

| Model | Input Cost | Per Card | Per Scan (9) | Monthly (100 scans) |
|-------|------------|----------|--------------|---------------------|
| GPT-4o | $2.50/1M | $0.005 | $0.045 | $4.50 |
| GPT-4o-mini | $0.15/1M | $0.0003 | $0.0027 | $0.27 |
| Claude Sonnet | $3/1M | $0.006 | $0.054 | $5.40 |

**Verdict:** GPT-4o-mini at ~$0.003 per scan is essentially free for personal use.

---

### Unified AI Provider Strategy

#### Beyond Card Matching: Future Capabilities

Adopting OpenAI as primary AI provider unlocks:

| Capability | API | Use Case in HF4A |
|------------|-----|------------------|
| **Vision OCR** | GPT-4o Vision | Card text extraction |
| **Semantic matching** | GPT-4o | Disambiguation when fuzzy match uncertain |
| **Voice input** | Whisper | "Scan my cards" voice command |
| **Voice output** | TTS | "Found 7 cards: 3 thrusters, 2 refineries..." |
| **Image generation** | DALL-E 3 | Generate custom crew cards (Expanse theme) |
| **Natural language Q&A** | GPT-4o | "Which thruster has the best ISP?" |
| **Rules assistant** | GPT-4o + RAG | "How does radiation work in this game?" |
| **Game state analysis** | GPT-4o Vision | "What's the best move with these cards?" |

#### Single Provider Advantages

1. **One API key** - Simpler user configuration
2. **One billing relationship** - Predictable costs
3. **Consistent latency characteristics** - Easier to optimize
4. **Unified rate limits** - Single pool to manage
5. **Cross-feature context** - Voice → Vision → Text in one session

---

### Backend Architecture Requirement

#### Why Backend is Required

All serious AI providers require API key protection. Options:

| Approach | Pros | Cons |
|----------|------|------|
| **Client-only (current)** | Simple, free hosting | Limited to weak APIs |
| **User-provided keys** | No backend needed | Bad UX, security concerns |
| **Backend proxy** | Secure, full API access | Requires hosting, costs |

**Recommendation:** Backend proxy is necessary for production-quality AI features.

#### Cloudflare Workers: Recommended Platform

**Why Cloudflare Workers:**

| Factor | Cloudflare Workers | Vercel Edge | AWS Lambda |
|--------|-------------------|-------------|------------|
| **Free tier** | 100k req/day | 100k req/mo | 1M req/mo |
| **Cold start** | ~0ms (V8 isolates) | ~50ms | ~100-500ms |
| **Latency** | Edge (global) | Edge (global) | Regional |
| **Pricing** | $5/mo for 10M req | $20/mo | Pay-per-use |
| **Complexity** | Low | Medium | High |
| **AI bindings** | Workers AI native | None | Bedrock |

**Cloudflare-specific benefits:**
- **Workers AI** - Native LLM inference at edge (Llama, Mistral)
- **Vectorize** - Built-in vector DB for RAG
- **D1** - SQLite at edge for state
- **KV** - Key-value for caching OCR results
- **R2** - Object storage for images (if needed)

#### Proposed Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                              │
│  - Camera capture                                                │
│  - OpenCV detection (client-side, no change)                    │
│  - UI rendering                                                  │
│  - Local storage for scans                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (api.hf4a.app)                    │
│                                                                  │
│  Endpoints:                                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /api/ocr                                               │ │
│  │   Input: { image: base64 }                                 │ │
│  │   Action: Call GPT-4o-mini vision                          │ │
│  │   Output: { type, name, stats, description }               │ │
│  │   Cache: KV with image hash as key                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /api/match                                             │ │
│  │   Input: { candidates: [...], ocrResult: {...} }           │ │
│  │   Action: LLM disambiguation if needed                     │ │
│  │   Output: { bestMatch, confidence, reasoning }             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /api/voice/transcribe                                  │ │
│  │   Input: { audio: base64 }                                 │ │
│  │   Action: Whisper API                                      │ │
│  │   Output: { text, confidence }                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /api/voice/synthesize                                  │ │
│  │   Input: { text, voice }                                   │ │
│  │   Action: OpenAI TTS                                       │ │
│  │   Output: { audio: base64 }                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ POST /api/ask                                               │ │
│  │   Input: { question, context }                             │ │
│  │   Action: RAG over rules + card data                       │ │
│  │   Output: { answer, sources }                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Storage:                                                       │
│  - KV: OCR result cache (image hash → result)                  │
│  - D1: Usage tracking, user preferences                        │
│  - Secrets: OPENAI_API_KEY                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Pros and Cons Analysis

#### Option A: Stay Client-Only (OCR.space)

**Pros:**
- Zero hosting cost
- Simple architecture
- No backend maintenance
- Works offline (if OCR cached)

**Cons:**
- Limited to weak OCR APIs
- No LLM features possible
- No voice features
- No semantic understanding
- API key exposed in client (if upgraded)

**Verdict:** Sufficient for MVP if OCR.space works. Dead end for advanced features.

#### Option B: Backend with OpenAI

**Pros:**
- High-accuracy OCR via GPT-4o vision
- Semantic card matching
- Voice input/output ready
- Natural language Q&A ready
- Image generation for custom cards
- Single provider simplicity
- Future-proof architecture

**Cons:**
- Requires hosting (~$5/mo Cloudflare, or free tier)
- API costs (~$0.27-$5/mo depending on usage)
- Added complexity (deploy pipeline, monitoring)
- Requires internet for AI features
- Cold start latency (minimal with Workers)

**Verdict:** Required for production-quality features. Cost is negligible.

#### Option C: Hybrid (Client OCR + Backend LLM)

**Pros:**
- OCR works offline/cheap
- LLM only for disambiguation
- Lower API costs

**Cons:**
- Two failure modes
- Inconsistent quality
- More complex client logic

**Verdict:** Unnecessary complexity. If we need backend anyway, use it fully.

---

### Recommended Approach

**Short-term (Phase 1-3):** Implement with OCR.space as planned. Validate the pipeline architecture works.

**Medium-term (Phase 6):** Add Cloudflare Worker backend with GPT-4o-mini for:
- OCR extraction (replace OCR.space)
- LLM disambiguation (new capability)

**Long-term (Phase 7+):** Expand backend for:
- Voice commands
- Natural language Q&A
- Custom card generation
- Game assistant features

---

### Implementation Plan: Backend Migration

#### Phase 6: Backend Foundation

**Duration:** 1-2 sessions

**Tasks:**
1. Create Cloudflare account and Workers project
2. Set up `api.hf4a.app` subdomain (or `hf4a-api.workers.dev`)
3. Implement `/api/ocr` endpoint
   - Accept base64 image
   - Call GPT-4o-mini with vision prompt
   - Return structured extraction
   - Cache results in KV by image hash
4. Update client OCR service to call backend
5. Add fallback to OCR.space if backend unavailable
6. Deploy and test

**Files:**
```
/workers/
  ├── wrangler.toml          # Cloudflare config
  ├── src/
  │   ├── index.ts           # Router
  │   ├── handlers/
  │   │   ├── ocr.ts         # OCR endpoint
  │   │   └── match.ts       # Match endpoint (future)
  │   └── lib/
  │       ├── openai.ts      # OpenAI client
  │       └── cache.ts       # KV caching
  └── package.json
```

**Cost:** Free tier sufficient for development. ~$5/mo if usage exceeds 100k requests.

#### Phase 7: LLM Disambiguation

**Duration:** 1 session

**Tasks:**
1. Implement `/api/match` endpoint
2. Accept OCR result + top 5 candidates
3. Call GPT-4o with card images and metadata
4. Return best match with reasoning
5. Update client fusion logic to call when confidence < 0.8

#### Phase 8: Voice Features

**Duration:** 2-3 sessions

**Tasks:**
1. Implement `/api/voice/transcribe` (Whisper)
2. Implement `/api/voice/synthesize` (TTS)
3. Add microphone capture to client
4. Add voice feedback for scan results
5. Add voice commands ("scan", "flip", "next")

#### Phase 9: Natural Language Features

**Duration:** 2-3 sessions

**Tasks:**
1. Build card + rules knowledge base
2. Implement RAG with Vectorize
3. Implement `/api/ask` endpoint
4. Add Q&A UI to app
5. Add context-aware suggestions

---

### Timeline Summary

| Phase | Focus | Duration | Depends On |
|-------|-------|----------|------------|
| 1-3 | Core pipeline refactor | Current plan | - |
| 4-5 | Storage, UI, polish | Current plan | Phases 1-3 |
| 6 | Backend + GPT-4o OCR | 1-2 sessions | Phases 1-3 |
| 7 | LLM disambiguation | 1 session | Phase 6 |
| 8 | Voice features | 2-3 sessions | Phase 6 |
| 9 | NL Q&A + assistant | 2-3 sessions | Phase 6 |

**Critical path:** Phases 1-3 → Phase 6 → Phases 7-9 (parallel)

---

### Open Questions: Backend Strategy

1. **Domain:** Use `api.hf4a.app` (requires DNS setup) or `hf4a-api.workers.dev` (free, immediate)?

2. **Authentication:** Anonymous (rate-limited by IP) or require user accounts?

3. **Cost sharing:** Absorb API costs personally, or add optional "supporter" tier?

4. **Offline mode:** Cache LLM results aggressively, or require online for AI features?

5. **Privacy:** Card images sent to OpenAI - acceptable for a board game app?

6. **Fallback:** If backend is down, fall back to client-only OCR.space, or show error?
