# Data Regeneration Plan

**Goal:** Generate accurate `card-index.json` using Claude Opus 4.5's visual capabilities, establish clean file naming, and consolidate redundant data files.

---

## Current State Analysis

### Image Files (public/cards/full/)
| Category | Count | Description |
|----------|-------|-------------|
| Individual cards | 370 | Properly named (e.g., `Bernal01-Purple-SpaceElevatorLab.webp`) |
| Composite sheets | 12 | Source scans (`01a.webp`, `01b.webp`, etc.) - NOT cards |
| Steam reference sheets | 10 | URL-named files (`httpcloud3...webp`) - NOT cards |
| **Total** | **392** | |

### Data Files
| File | Location | Size | Status |
|------|----------|------|--------|
| `cards.json` | `data/` | 132KB | Intermediate - 358 cards |
| `cards.json` | `public/data/` | 235KB | Final enriched - 358 cards |
| `card-index.json` | `public/data/` | 128KB | **BROKEN** - 34 entries with empty names |
| `parsed-cards.json` | `data/` | 180KB | Intermediate |
| `cards-enriched.json` | `data/` | 235KB | Redundant copy |
| `cards-with-relationships.json` | `data/` | 224KB | Intermediate |
| `relationships.json` | `data/` | 125KB | Intermediate |
| `manifest.json` | `data/` | 254KB | Intermediate |
| `optimization-report.json` | `data/` | 68KB | Build artifact |

### Root Cause of Broken card-index.json
`generate-card-index.ts` walks ALL files in `/cards/full/` and matches by filename to `cards.json`:
- Composite sheets (`01a.webp`) don't match → `type: "01a.webp"`, `name: ""`
- URL files don't match → `type: "httpcloud3..."`, `name: ""`
- 12 Exodus cards have images but aren't in `cards.json` at all

---

## Design Decisions

### Q1: Rename files for consistency?
**Decision: YES** - Standardize all filenames to pattern:
```
{Type}{Number:02d}-{Side}-{Name}.webp
```
Examples:
- `Thruster01-White-HEATMassDriver.webp`
- `Exodus01-Purple-DecantingNetwork.webp`

**Rationale:** Current naming is 95% consistent; normalizing the remaining 5% prevents future edge cases.

### Q2: What to do with composite sheets?
**Decision: Move to `/cards/source-scans/`**

These are valuable historical artifacts but should not be processed as cards.

### Q3: What to do with Steam URL files?
**Decision: Move to `/cards/reference/`**

These appear to be Tabletop Simulator reference cards - different card format, not part of the physical game.

### Q4: Single source of truth?
**Decision: `public/data/cards.json` is the single source**

Eliminate intermediate files in `data/` folder after consolidation. The pipeline should be:
```
Source Images → Claude Visual Analysis → cards.json → card-index.json
                                              ↑
                            Spreadsheet data merged in
```

### Q5: What metadata to extract per card?
**Decision: Comprehensive extraction**

```typescript
interface CardData {
  // Identity
  id: string;                // "thruster-01"
  filename: string;          // Current filename
  cardGroupId: string;       // Groups white/purple sides

  // Classification
  type: CardType;            // "thruster", "bernal", etc.
  side: CardSide;            // "white", "purple", "black", etc.
  upgradeChain: string[];    // ["white", "purple"] - order matters

  // Core metadata (visible on card)
  name: string;              // "HEAT Mass Driver"
  mass: number;
  radHard: number;
  thrust?: number;
  fuelConsumption?: string;  // Can be fractions like "1/2"
  therms?: number;
  spectralType?: string;     // "SMC", "V", etc.

  // Ability text
  ability?: string;

  // Support requirements (icons on card)
  supportRequirements?: {
    generatorPush?: boolean;
    generatorElectric?: boolean;
    reactorFission?: boolean;
    reactorFusion?: boolean;
    reactorAntimatter?: boolean;
  };

  // Additional game mechanics
  isru?: string[];           // ["S", "M", "C"]
  afterburn?: boolean;
  push?: boolean;
  solar?: boolean;
  buggy?: boolean;
  missile?: boolean;
  raygun?: boolean;
  bonusPivots?: number;

  // Visual description (for AI-powered features)
  imageDescription?: string; // "Illustration shows a cylindrical mass driver..."

  // Spreadsheet enrichment (preserved from Google Sheets)
  spreadsheet?: {
    promotionColony?: string;
    future?: string;
    colonistType?: string;
    specialty?: string;
    ideology?: string;
  };

  // Card relationships
  relatedCards?: Record<string, string>; // side -> filename

  // Matching index data
  hash: string;              // dHash hex
  hashBytes: number[];       // dHash bytes for fast comparison
}
```

---

## Implementation Phases

### Phase 1: File Organization
**Time estimate: Manual task**

1. Create directories:
   ```bash
   mkdir -p public/cards/source-scans
   mkdir -p public/cards/reference
   ```

2. Move composite sheets:
   ```bash
   mv public/cards/full/0{1,3,4,7,9}[ab].webp public/cards/source-scans/
   mv public/cards/full/10[ab].webp public/cards/source-scans/
   ```

3. Move Steam reference files:
   ```bash
   mv public/cards/full/http*.webp public/cards/reference/
   ```

4. Verify 370 individual cards remain:
   ```bash
   ls public/cards/full/*.webp | wc -l  # Should be 370
   ```

### Phase 2: Visual Card Analysis (In-Session)
**Method: Direct image analysis via Claude Code**

Since Claude Code runs on a Pro Max account with multimodal capabilities, visual analysis happens directly in-session using the Read tool on image files. No separate API calls or scripts needed.

**Process:**
1. Read each card image file directly (Read tool renders images to Claude)
2. Extract metadata visually in batches of ~10-20 cards
3. Output results as JSON to `data/visual-analysis.json`
4. Cross-reference with existing `cards.json` to preserve spreadsheet enrichment

**Extraction targets per card:**
- Card Type (header): thruster, reactor, generator, radiator, robonaut, refinery, colonist, bernal, freighter, gw-thruster, crew, contract, spaceborn, exodus
- Card Side (border): white, black, purple, blue, yellow, green, red, grey
- Card Name (gold banner at bottom)
- Stats: Mass, Rad-Hard, Thrust, Fuel Consumption, Therms
- Spectral Type: S, M, C, V, D combinations
- Support icons: generator (⟛/e), reactor (X/∿/💣)
- Ability text (yellow box)
- Special icons: ISRU, Afterburn, Push, Solar, Buggy, Missile, Raygun
- Brief illustration description (2-3 sentences)

**Cost: $0** (included in Pro Max subscription)

### Phase 3: Merge Visual + Spreadsheet Data
**New script: `scripts/merge-card-data.ts`**

1. Load visual analysis results
2. Load spreadsheet data (from `data/spreadsheet/*.csv`)
3. Match by normalized name
4. Merge, preferring spreadsheet values where conflicts exist (human-verified)
5. Generate unified `cards.json`

```typescript
function mergeCardData(
  visual: VisualAnalysis,
  spreadsheet: SpreadsheetRow | null,
  existingCard: ExistingCard | null
): CardData {
  return {
    // Use visual for identity
    type: visual.type,
    side: visual.side,
    name: visual.name,

    // Use spreadsheet for stats (more accurate)
    mass: spreadsheet?.mass ?? visual.mass,
    radHard: spreadsheet?.radHard ?? visual.radHard,

    // Visual-only fields
    imageDescription: visual.imageDescription,

    // Preserve existing enrichment
    spreadsheet: existingCard?.spreadsheet ?? {},
    relatedCards: existingCard?.relatedCards ?? {},
  };
}
```

### Phase 4: Generate card-index.json
**Modify: `scripts/generate-card-index.ts`**

Changes:
1. Only process files matching card naming pattern
2. Require non-empty `name` and valid `type` from `cards.json`
3. Add validation step that fails build if any card has empty name
4. Add `searchableText` field combining name + ability for Fuse.js

```typescript
interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  type: CardType;
  name: string;
  searchableText: string;  // NEW: "HEAT Mass Driver Afterburn thrust doubles"
  hash: string;
  hashBytes: number[];
}
```

### Phase 5: Cleanup
1. Delete redundant `data/` intermediate files
2. Update `.gitignore` to exclude `data/visual-analysis/` (large, regenerable)
3. Update npm scripts to reflect new pipeline
4. Run full build to verify

---

## File Cleanup Plan

### Delete (redundant/regenerable)
- `data/cards.json` (intermediate)
- `data/cards-enriched.json` (duplicate of public)
- `data/cards-with-relationships.json` (intermediate)
- `data/parsed-cards.json` (intermediate)
- `data/relationships.json` (intermediate)
- `data/optimization-report.json` (build artifact)

### Keep
- `data/manifest.json` (needed for image processing)
- `data/spreadsheet/*.csv` (source data from Google Sheets)
- `public/data/cards.json` (single source of truth)
- `public/data/card-index.json` (matching index)

### Move
- `public/cards/full/0{1,3,4,7,9,10}[ab].webp` → `public/cards/source-scans/`
- `public/cards/full/http*.webp` → `public/cards/reference/`

---

## New npm Scripts

```json
{
  "scripts": {
    "analyze-cards": "tsx scripts/analyze-cards-visual.ts",
    "merge-data": "tsx scripts/merge-card-data.ts",
    "generate-index": "tsx scripts/generate-card-index.ts",
    "data-pipeline": "npm run analyze-cards && npm run merge-data && npm run generate-index",
    "validate-index": "tsx scripts/validate-card-index.ts"
  }
}
```

---

## Validation Checklist

After implementation:

```bash
# All 370 cards have non-empty names
cat public/data/card-index.json | grep -c '"name": ""'
# Expected: 0

# All cards have valid types
cat public/data/card-index.json | grep '"type":' | grep -E '\.webp|http' | wc -l
# Expected: 0

# Card count matches
cat public/data/card-index.json | grep -c '"cardId"'
# Expected: 370

# All Exodus cards included
cat public/data/card-index.json | grep -c '"type": "exodus"'
# Expected: 12
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Context window limits | Process cards in batches of 10-20, save intermediate JSON |
| Visual analysis errors | Cross-validate against spreadsheet data, flag discrepancies |
| Breaking existing features | Run full test suite before/after, diff card-index.json |
| Losing spreadsheet enrichment | Explicit merge step preserves all existing data |

---

## Success Criteria

1. `card-index.json` has 370 entries (down from 392)
2. Zero entries with empty `name` or invalid `type`
3. All 12 Exodus cards properly indexed
4. Text matching works for all cards in SHOWXATING mode
5. Existing spreadsheet metadata preserved
6. `data/` folder contains only essential source files

---

## Next Steps

1. **Approve this plan** - any changes needed?
2. **Phase 1**: File reorganization - move 22 non-card files (5 min)
3. **Phase 2**: Visual analysis in-session - read and analyze 370 cards in batches
4. **Phase 3**: Merge visual data with spreadsheet enrichment
5. **Phase 4**: Generate clean card-index.json
6. **Phase 5**: Cleanup redundant files and validate

**Estimated time:** 2-3 hours total (mostly Phase 2 visual analysis)
