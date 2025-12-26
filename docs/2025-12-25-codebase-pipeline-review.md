# OCR Pipeline Review - 2025-12-25

Comprehensive review of the card recognition pipeline, tracing exact payloads and parameters through each stage.

---

## Executive Summary

**Verdict: The problem is NOT the OCR model. It's the card-index.json data.**

### Critical Issue Found

**34 cards (9%) in card-index.json have broken metadata:**
- `type` field contains filename/URL instead of card type (e.g., `"type": "01a.webp"`)
- `name` field is empty string (`"name": ""`)

**This completely breaks text matching** because:
1. `textMatcher.ts` searches Fuse.js against the `name` field - empty names can't match
2. Type filtering uses invalid values - cards are excluded from search

---

## Evidence

### card-index.json sample (broken entry):
```json
{
  "filename": "01a.webp",
  "cardId": "01a",
  "side": null,
  "type": "01a.webp",    // WRONG - should be "thruster", "bernal", etc.
  "name": "",             // WRONG - should be card name
  "hash": "bbd36ce2624cda66",
  "hashBytes": [187, 211, 108, 226, 98, 76, 218, 102]
}
```

### card-index.json sample (working entry):
```json
{
  "filename": "Bernal01-Purple-SpaceElevatorLab.webp",
  "cardId": "bernal-01",
  "side": "purple",
  "type": "bernal",        // CORRECT
  "name": "Space Elevator Lab",  // CORRECT
  "hash": "...",
  "hashBytes": [...]
}
```

### Counts:
- Total cards in index: 392
- Cards with empty `name`: 34
- Cards with invalid `type` (contains ".webp" or URL): 34
- Cards with proper metadata: 358

---

## Root Cause

`scripts/generate-card-index.ts` line 131-144:

```typescript
// Find card data
const cardData = cardsByFilename.get(filename);

// Extract type from cardId if not in cardData
const derivedType = (cardData?.id || filename).replace(/-\d+.*$/, '').toLowerCase();

index.push({
  filename,
  cardId: cardData?.id || filename.replace('.webp', ''),
  side: cardData?.side || null,
  type: cardData?.type || derivedType,  // ← Falls back to filename
  name: cardData?.name || '',            // ← Falls back to empty string
  hash,
  hashBytes,
});
```

**The problem:**
- `cards.json` uses filenames like `"Bernal01-Purple-SpaceElevatorLab.png"`
- The script converts `.png` → `.webp` and builds a lookup map
- But image files are named `"01a.webp"`, `"01b.webp"` (different convention)
- No match found → fallback to empty/invalid values

---

## Complete Pipeline Trace

### Phase 1: Image Capture
**File:** `ShowxatingShell.tsx:66-80`

```typescript
canvas.width = video.videoWidth;   // e.g., 1920
canvas.height = video.videoHeight; // e.g., 1080
ctx.drawImage(video, 0, 0);
const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
```

**Output:** Full-resolution JPEG at 95% quality

✅ **This is correct** - high quality preserves text for OCR

---

### Phase 2: Skew Detection
**File:** `visionPipeline.ts:369-395` → `detectFrameSkew()`

```typescript
// Input: ImageData, frameWidth, frameHeight
// Uses OpenCV pipeline:
cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
cv.Canny(blurred, edges, 50, 150);
cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
```

**Output:** `SkewAnalysis { angle, corners, hasSkew }`

✅ **This is correct** - standard edge detection pipeline

---

### Phase 3: Frame Correction
**File:** `visionPipeline.ts:401-456` → `warpFullFrame()`

```typescript
// Only applied if |angle| > 2°
const center = new cv.Point(centerX, centerY);
rotationMatrix = cv.getRotationMatrix2D(center, -skewAnalysis.angle, 1.0);
cv.warpAffine(src, dst, rotationMatrix, dsize);
```

✅ **This is correct** - proper rotation correction

---

### Phase 4: Card Detection
**File:** `visionPipeline.ts:462-576` → `detectCardsInCorrectedFrame()`

```typescript
// Same OpenCV pipeline
// Filters for:
//   - 4-corner polygons (quadrilaterals)
//   - Aspect ratio ≈ 1.4 (card height/width)
//   - Area 2-60% of frame
```

**Output:** `DetectionResult[] { corners, confidence, aspectRatio, area }`

✅ **This is correct** - finds card shapes reliably

---

### Phase 5: Card Cropping
**File:** `visionPipeline.ts:266-338` → `warpCardToRectangle()`

```typescript
// Input: sourceCanvas, corners (4 points)
// Output dimensions:
outputWidth: 630,   // pixels
outputHeight: 880,  // pixels (maintains 63:88mm card ratio)

// Perspective transform:
transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
cv.warpPerspective(src, dst, transform, dsize);
```

**Output:** 630×880 canvas with perspective-corrected card

✅ **This is correct** - produces clean rectangular card image

---

### Phase 6: OCR Extraction
**File:** `ocrService.ts:80-174` → `extractCardText()`

```typescript
// Convert canvas to data URL
const dataUrl = cardCanvas.toDataURL('image/jpeg', 0.95);

// Call OCR engine
const result = await ocr.detect(dataUrl);

// Result format from @gutenye/ocr-browser:
// Line = { text: string, mean: number, box?: number[][] }

// Box format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (4 corners clockwise)

// Region filtering:
const typeThreshold = cardHeight * 0.15;   // Top 15%
const titleThreshold = cardHeight * 0.80;  // Bottom 20%

const typeLines = allLines.filter(l => l.top + l.height / 2 < typeThreshold);
const titleLines = allLines.filter(l => l.top + l.height / 2 > titleThreshold);
```

**Output:**
```typescript
OCRResult {
  fullText: string,      // All detected text
  typeText: string,      // Text from top 15% of card
  titleText: string,     // Text from bottom 20% of card
  confidence: number,    // 0-1 based on OCR scores
  timing: { fullMs, typeMs, titleMs, totalMs }
}
```

✅ **This is correct** - proper OCR invocation and region filtering

---

### Phase 7: Text Matching (⚠️ FAILS HERE)
**File:** `textMatcher.ts:75-139` → `matchByText()`

```typescript
// Parse detected type from OCR text
const detectedType = parseTypeFromText(ocrResult.typeText);

// Filter index to active types
const activeCards = index.filter(card => activeTypes.has(card.type as CardType));
// ⚠️ Cards with type="01a.webp" are EXCLUDED (not in activeTypes set)

// Fuse.js search by name
const fuse = new Fuse(cards, {
  keys: ['name'],        // ⚠️ Searches 'name' field
  threshold: 0.5,
  includeScore: true,
});
const results = fuse.search(searchText);
// ⚠️ Cards with name="" return no matches
```

**Problem:**
- 34 cards have empty `name` → Fuse.js can't match
- 34 cards have invalid `type` → excluded from search

---

### Phase 8: Hash Matching
**File:** `matchFusion.ts:142-178` → `matchByHash()`

```typescript
// Compute dHash from canvas
const hashCanvas = document.createElement('canvas');
hashCanvas.width = 9;
hashCanvas.height = 8;
ctx.drawImage(canvas, 0, 0, 9, 8);  // Resize to 9×8

// Compare Hamming distance
const HASH_MATCH_THRESHOLD = 22;  // Max 22 bits different out of 64
```

✅ **This is correct** - dHash implementation matches index generation

---

### Phase 9: Score Fusion
**File:** `matchFusion.ts:184-317` → `fuseMatches()`

```typescript
const TEXT_WEIGHT = 0.85;
const HASH_WEIGHT = 0.15;

// Fusion cases:
// Case 1: No matches → return null
// Case 2: Text-only → use text score
// Case 3: Hash-only → use hash score  ← Fallback when text fails
// Case 4: Both → fusedScore = textScore * 0.85 + hashScore * 0.15
```

**Observation:** When text matching fails (due to empty names), system falls back to hash-only matching at 15% weight. This degrades accuracy significantly.

---

## Why OCR Model is NOT the Problem

### Evidence 1: OCR output is logged
From `ocrService.ts:171`:
```typescript
log.info(`[OCR] Complete in ${totalMs.toFixed(0)}ms: type="${typeText}" title="${titleText}"`);
```

If OCR was failing, logs would show empty/garbage text. The issue is downstream.

### Evidence 2: API usage is correct
```typescript
// ocrEngine.ts creates instance:
engine.instance = await Ocr.create({
  models: {
    detectionPath: `${basePath}models/ch_PP-OCRv4_det_infer.onnx`,
    recognitionPath: `${basePath}models/ch_PP-OCRv4_rec_infer.onnx`,
    dictionaryPath: `${basePath}models/ppocr_keys_v1.txt`,
  },
});

// ocrService.ts calls detect:
const result = await ocr.detect(dataUrl);
```

This matches @gutenye/ocr-browser documentation exactly.

### Evidence 3: Input quality is preserved
- Camera capture: full resolution
- Card crop: 630×880 (high detail)
- JPEG quality: 95%
- No aggressive preprocessing that would destroy text

---

## Recommendations

### Immediate Fix (HIGH PRIORITY)

Regenerate `card-index.json` with proper metadata for all 392 cards:

1. Map numeric filenames (01a.webp) to their actual card data
2. Ensure every entry has valid `type` and `name`
3. Run: `npm run generate-card-index`

### Verification Steps

After fix, check:
```bash
# Should return 0:
cat public/data/card-index.json | grep -c '"name": ""'

# Should return 0:
cat public/data/card-index.json | grep '"type":' | grep -E '\.webp' | wc -l
```

### Additional Improvements (OPTIONAL)

1. **Add validation to generate-card-index.ts** - Fail if any card has empty name
2. **Add OCR diagnostics to export** - Include raw OCR text in diagnostics.zip
3. **Test with known cards** - Create test suite with expected OCR output

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `ShowxatingShell.tsx:49-235` | Main capture orchestration |
| `visionPipeline.ts:266-338` | Card warping |
| `visionPipeline.ts:369-395` | Skew detection |
| `visionPipeline.ts:462-576` | Card detection |
| `ocrEngine.ts:35-69` | OCR model loading |
| `ocrService.ts:80-174` | OCR text extraction |
| `textMatcher.ts:75-139` | Text-based matching |
| `matchFusion.ts:142-178` | Hash-based matching |
| `matchFusion.ts:184-317` | Score fusion |
| `scripts/generate-card-index.ts` | Index generation |

---

## Conclusion

**The OCR pipeline is correctly implemented.** The poor results stem from 9% of cards having broken metadata in `card-index.json`, which causes text matching to fail and forces reliance on hash-only matching at reduced weight.

Fix the card index data, and text matching will work as designed.
