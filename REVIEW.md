# Critical Review: HF4A Cards Web

## Executive Summary
The codebase is functional with solid React/TypeScript foundations, but has significant data completeness gaps and architectural debt. All 370 card images exist and match data (good), but spreadsheet metadata coverage is incomplete and the UI doesn't display all available data fields.

---

## Critical Issues

### 1. Exodus Cards Mistyped as "unknown"
12 Exodus cards (`Exodus01-DecantingNetwork.png` through `Exodus12-AtmosphericIsoRefinery.png`) are typed as `"unknown"` despite `"exodus"` existing in `CardType`. These should be properly classified.

```
Current: cards.filter(c => c.type === "unknown") → 12 cards
Expected: cards.filter(c => c.type === "exodus") → 12 cards
```

### 2. Spreadsheet Data Not Displayed in UI
The following fields are imported but **never shown** in `CardDetail.tsx`:

| Field | Available | Displayed |
|-------|-----------|-----------|
| `colonistType` (Robot/Human) | 18 cards | No |
| `specialty` (Engineer/Miner/etc.) | 18 cards | No |
| `ideology` (Green/Yellow/etc.) | 18 cards | No |
| `generatorType` (push / electric e) | in stats | No |
| `reactorType` (X/wave/bomb) | in stats | No |

**Impact:** Users can't see key card characteristics that differentiate colonists/generators/reactors.

### 3. Radiator Dual-Side Stats Missing
The radiators CSV has distinct light-side and heavy-side columns (Mass, Rad-Hard, Therms for each). The import script maps these to `lightSideMass`, `heavySideMass`, etc., but:
- UI doesn't distinguish which side's stats are shown
- Heavy-side columns aren't being captured (import script only maps light-side)

---

## Important Gaps

### 4. GW Thrusters/Freighters Missing "Type" Column
Both spreadsheets have a `Type` column distinguishing:
- GW Thrusters: base thruster vs promoted
- Freighters: "Freighter" vs "Freighter Fleet"

**Not captured in import script** - the `SHEET_CONFIGS` for these sheets omit the Type column mapping.

### 5. Import Script Not in npm Scripts
`scripts/import-spreadsheet.js` exists but no `npm run import-spreadsheet` in `package.json`. Users must run manually: `node scripts/import-spreadsheet.js`

### 6. 7 Unmatched Cards During Import
```
Monoatomic Plug Nozzle (thruster)
Levitated Dipole 6Li-H Fusion (gw-thruster)
Spheromak 3He-D Magnetic Fusion (gw-thruster)
Colliding FRC 3He-D Fusion (gw-thruster)
Daedalus 3He-D Inertial Fusion (gw-thruster)
D-D Fusion Inertial (robonaut)
JTEC H2 Thermoelectric (generator)
```
These are name-matching failures between OCR and spreadsheet - likely OCR transcription differences (e.g., "JTECH" vs "JTEC").

---

## What's Working Well

1. **100% Image Coverage** - All 370 cards have matching full + thumbnail webp images
2. **No Duplicate Images** - 0 checksum collisions (unique content verified)
3. **Clean TypeScript Types** - `src/types/card.ts` comprehensively defines all card structures
4. **Stats Import Working** - 231/238 cards matched and enriched with spreadsheet data
5. **Good Search** - Fuse.js fuzzy search across card names/descriptions
6. **PWA Ready** - vite-plugin-pwa configured for offline support
7. **Clean State Management** - Zustand stores are focused and well-typed

---

## Architecture Recommendations

### High Priority

**1. Fix Exodus Card Classification**
Update `scripts/parse-filenames.ts` to detect "Exodus" prefix and assign `type: 'exodus'`.

**2. Display Missing Fields in CardDetail**
Add sections for colonist-specific data:
```tsx
{/* Colonist Info */}
{displayCard.spreadsheet?.colonistType && (
  <div className="mb-6">
    <h2>Colonist</h2>
    <span>{displayCard.spreadsheet.colonistType}</span>
    {displayCard.spreadsheet.specialty && <span>{displayCard.spreadsheet.specialty}</span>}
    {displayCard.spreadsheet.ideology && <span className={`ideology-${displayCard.spreadsheet.ideology.toLowerCase()}`}>{displayCard.spreadsheet.ideology}</span>}
  </div>
)}
```

**3. Fix Radiator Dual-Side Import**
The CSV has columns: `Mass` (light), `Rad-Hard` (light), `Therms` (light), then repeated for heavy side. The import script needs to detect column position or use unique column names.

### Medium Priority

**4. Consolidate Data Files**
Current state in `data/`:
```
cards.json (same as public/data/cards.json)
cards-enriched.json (redundant)
cards-with-relationships.json (unused?)
ocr-partial/*.json (intermediate artifacts)
ocr-results.json, ocr-results-original.json (intermediate)
```
Recommend: Single source of truth in `public/data/cards.json`, delete redundant files, move `ocr-partial/` to `.gitignore`-tracked dev folder.

**5. Remove Unused `content/` Folder**
The `content/hf4a-cards/` and `content/hf4a content/` directories contain source images that aren't used at runtime. Either:
- Add to `.gitignore` (save repo size)
- Document as source material
- Move to separate repo/storage

**6. Add Type Column to Import Configs**
For freighters and gw-thrusters:
```javascript
'Type': 'cardSubtype', // Distinguish "Freighter" vs "Freighter Fleet"
```

### Low Priority (Nice-to-Have)

- **7. Filter by Colonist Specialty** - Add to FilterBar once specialty is displayed
- **8. Filter by Reactor/Generator Type** - Useful for deck building
- **9. Card Comparison Mode** - Side-by-side stat comparison
- **10. URL-Based Filter State** - Shareable filter URLs

---

## Spreadsheet Schema Comparison Summary

All 10 spreadsheet CSVs match their online counterparts. Key columns per sheet:

| Sheet | Unique Columns Not in Import |
|-------|------------------------------|
| GW Thrusters | `Type` (base vs promoted) |
| Freighters | `Type` (Freighter vs Fleet) |
| Radiators | Heavy-side columns (Mass, Rad-Hard, Therms) |
| Colonists | All captured |
| Others | Fully captured |

---

## Verdict

**Solid foundation, incomplete data layer.** The React/TypeScript implementation is clean, but the data pipeline has gaps that prevent full utilization of spreadsheet metadata. Focus on displaying already-imported data (colonist fields, reactor/generator types) and fixing the 12 misclassified Exodus cards for quick wins.

---

## Review Update: December 2024

### Issues Resolved

#### Critical Issues (All Fixed)

**1. Exodus Cards** - FIXED
- Added `'exodus'` to typeMap in `scripts/parse-filenames.ts`
- Added auto-fix in `scripts/import-spreadsheet.js` to convert remaining 'unknown' to 'exodus'
- Result: All 12 Exodus cards now correctly typed

**2. Spreadsheet Data Not Displayed** - FIXED
- Added Colonist Info section in `CardDetail.tsx` showing:
  - Colonist type (Robot/Human)
  - Specialty (Engineer, Miner, Prospector, Scientist, Pilot, Commander)
  - Ideology (Green, Yellow, Blue, Red, Purple)
- Added Generator Type display (Push ⟛ / Electric e)
- Added Reactor Type display (Fission X / Fusion ∿ / Antimatter 💣)
- Added cardSubtype badge for GW Thrusters and Freighters

**3. Radiator Dual-Side Stats** - FIXED
- Updated import-spreadsheet.js to use `columnIndices` for radiators (duplicate column headers)
- Maps light-side (columns 2,3,4) and heavy-side (columns 5,6,7) correctly
- Added dual-side display in CardDetail.tsx showing both Light Side and Heavy Side stats

**4. GW Thrusters/Freighters Type Column** - FIXED
- Added `'Type': 'cardSubtype'` mapping for both sheet configs
- Now captures "Freighter Fleet", "GW Thruster" subtypes

**5. Import Script npm Command** - FIXED
- Added `"import-spreadsheet": "node scripts/import-spreadsheet.js"` to package.json

**6. 7 Unmatched Cards** - FIXED
- Added NAME_ALIASES in import-spreadsheet.js:
  ```javascript
  'monoatomic plug nozzle': 'monatomic plug nozzle',
  'levitated dipole 6li-h fusion': 'levitated dipole li-h fusion',
  'spheromak 3he-d magnetic fusion': 'spheromak he-d magnetic fusion',
  'colliding frc 3he-d fusion': 'colliding frc he-d fusion',
  'daedalus 3he-d inertial fusion': 'daedalus he-d inertial fusion',
  'd-d fusion inertial': 'd-d inertial fusion',
  'jtec h2 thermoelectric': 'jtech h2 thermoelectric',
  ```
- Result: All 238 spreadsheet cards now match (0 unmatched)

#### Medium Priority Items (All Fixed)

**4. Consolidate Data Files** - FIXED
- Removed redundant intermediate files from data/
- Added to .gitignore: `data/ocr-partial/`, `data/ocr-results*.json`, `data/optimization-report.json`, `data/parsed-cards.json`, `data/relationships.json`, `data/cards-with-relationships.json`, `data/cards-enriched.json`
- Essential files: `data/manifest.json`, `data/cards.json`, `public/data/cards.json`

**5. Organize content/ Folder** - FIXED
- Created `content/README.md` documenting:
  - Directory structure
  - Processing pipeline steps
  - How to obtain source files
  - File naming conventions
- Added `content/` to .gitignore (source images not tracked)

**6. Add Type Column** - Covered in Critical Fix #4

#### Nice-to-Have Items (Implemented)

**7. Filter by Colonist Specialty** - IMPLEMENTED
- Added `specialties` to FilterState in `src/types/card.ts`
- Added `toggleSpecialty` action in `src/store/filterStore.ts`
- Added filtering logic in `src/hooks/useCards.ts`
- Added Specialty dropdown in FilterBar with count display

**8. Filter by Reactor/Generator Type** - IMPLEMENTED
- Added `reactorTypes` and `generatorTypes` to FilterState
- Added toggle actions for both in filterStore
- Added filtering logic in useCards.ts
- Added Reactor dropdown (Fission/Fusion/Antimatter) with counts
- Added Generator dropdown (Push/Electric) with counts

### Current State Summary

| Metric | Value |
|--------|-------|
| Total cards | 370 |
| Cards with spreadsheet data | 238 (100% matched) |
| Exodus cards properly typed | 12 |
| Image coverage | 100% (full + thumbnails) |
| Unmatched spreadsheet rows | 0 |

### Remaining Suggestions (Low Priority)

- **9. Card Comparison Mode** - Side-by-side stat comparison for deck building
- ~~**10. URL-Based Filter State**~~ - IMPLEMENTED (Share button + URL params)
- **11. Mass/Rad-Hard Range Filters** - Slider filters for numeric stats

### Build Status

```
npm run build ✓
npm run import-spreadsheet ✓ (0 unmatched)
```

---

## Feedback Mechanism Proposal

### Goal
Enable users to provide feedback on card data accuracy (OCR errors, missing stats, incorrect values) and channel it to a reviewable location.

### Recommended Approach: GitHub Issues with Template

**Why GitHub Issues:**
- Already integrated with the repo (HF4A/hf4a.github.io)
- No additional infrastructure or costs
- Structured templates ensure consistent feedback
- Easy to track, assign, and close issues
- Public visibility encourages community contributions

**Implementation Steps:**

1. **Create Issue Template** (`.github/ISSUE_TEMPLATE/card-feedback.yml`):
```yaml
name: Card Feedback
description: Report incorrect data, missing stats, or OCR errors on a card
title: "[Card] "
labels: ["card-data", "needs-review"]
body:
  - type: input
    id: card-name
    attributes:
      label: Card Name
      placeholder: e.g., "VASIMR Plasma Drive"
    validations:
      required: true
  - type: dropdown
    id: card-type
    attributes:
      label: Card Type
      options:
        - Thruster
        - Reactor
        - Generator
        - Radiator
        - Robonaut
        - Refinery
        - Colonist
        - Bernal
        - Freighter
        - GW Thruster
        - Crew
        - Contract
        - Other
    validations:
      required: true
  - type: dropdown
    id: issue-type
    attributes:
      label: Issue Type
      options:
        - Incorrect stat value
        - Missing stat
        - Wrong card name (OCR error)
        - Wrong spectral type
        - Missing ability text
        - Image quality issue
        - Other
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Description
      description: What's wrong and what should it be?
      placeholder: |
        Current value: Mass = 5
        Correct value: Mass = 3
        Source: Physical card / rulebook page X
    validations:
      required: true
  - type: input
    id: source
    attributes:
      label: Source/Reference
      placeholder: "Physical card, rulebook p.42, BGG thread, etc."
```

2. **Add Feedback Button to CardDetail.tsx**:
```tsx
// Add near the close button in card detail modal
<a
  href={`https://github.com/HF4A/hf4a.github.io/issues/new?template=card-feedback.yml&title=${encodeURIComponent(`[Card] ${card.name}`)}&card-name=${encodeURIComponent(card.name)}&card-type=${encodeURIComponent(card.type)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm text-gray-400 hover:text-white"
>
  Report Issue
</a>
```

3. **Review Workflow**:
   - Issues automatically labeled `card-data` + `needs-review`
   - Maintainer reviews issue, verifies against source
   - Update spreadsheet or OCR data
   - Re-run `npm run import-spreadsheet`
   - Close issue with commit reference

### Alternative Options

| Option | Pros | Cons |
|--------|------|------|
| **Google Form → Sheet** | Easy setup, familiar UI | Separate from codebase, manual export needed |
| **Airtable** | Rich UI, API access | Cost for larger usage, another tool to manage |
| **Discord Channel** | Community engagement | Informal, hard to track/close items |
| **In-app Database** | Seamless UX | Requires backend, auth, moderation |

### Recommendation

Start with **GitHub Issues + Template**. It's zero-cost, already integrated, and provides structure. Add a "Report Issue" link in CardDetail.tsx that pre-fills the card name and type. If feedback volume grows significantly, consider a more streamlined in-app solution later.
