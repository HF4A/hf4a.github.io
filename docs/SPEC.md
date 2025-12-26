# High Frontier 4 All - Card Explorer Web App

**Repo:** `github.com/HF4A/hf4a.github.io`
**URL:** `https://hf4a.github.io/`

## Project Overview

A responsive web application for browsing, searching, filtering, and exploring cards from the board game High Frontier 4 All. Designed with extensibility in mind for future card games (baseball cards, other board games, etc.).

---

## Phase 1: Card Explorer (MVP)

### Core Features
1. **Card Grid View** - Display all cards in a responsive grid layout
2. **Card Detail Modal** - Click card to view full-screen with flip animation
3. **Card Flip** - Click again to flip between sides (White↔Black, Black↔Purple)
4. **Search** - Full-text search across card names, descriptions, and metadata
5. **Filters** - Multi-select filtering by card attributes
6. **Upgrade Toggle** - Global toggle to show upgraded sides (White→Black→Purple)

### Filter Categories
| Filter | Values |
|--------|--------|
| Card Type | Thruster, Reactor, Generator, Radiator, Robonaut, Refinery, Colonist, Bernal, Freighter, GW Thruster, Crew, Contract |
| Spectral Type | C, D, H, M, S, V, Any |
| ISRU Rating | 0, 1, 2, 3, 4 |
| Mass | 0-10+ (range slider) |
| Rad-Hard | 1-9+ (range slider) |
| Module | Core, Module 1 (Terawatt), Module 2 (Colonization), Module 3 (Conflict), Module 4 (Exodus) |
| Ideology (Contracts) | Individuality/Freedom, Honor/Unity, Authority/Equality, Exodus |

---

## Phase 2: Stack Builder (Future)

- Drag cards to build spacecraft stacks
- Calculate total mass, thrust-to-weight ratio
- Validate support chains (reactor→generator→radiator dependencies)
- Export/share stack configurations
- Calculate delta-v and reachable destinations

---

## Phase 3: LLM-Powered Q&A (Future)

### Vision
Replace traditional search/filter with natural language queries. Eventually voice-enabled.

### Example Interactions
```
User: "Show me all colonists with futures involving robots"
→ Filters to: Colonist type, futures containing robot-related text

User: "What thrusters work with S-type spectral sites and have thrust > 5?"
→ Filters to: Thrusters, spectral=S, thrust≥5

User: "Which reactors don't need a radiator?"
→ Filters to: Reactors where requires does not include radiator

User (voice): "Find me low-mass robonauts for asteroid prospecting"
→ Interprets: Robonauts, low mass, ISRU suitable for asteroids (S/M/C types)
```

### Technical Approach

**Query Processing Pipeline:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ User Input  │───▶│ LLM Parse   │───▶│ Filter      │───▶│ Update UI   │
│ (text/voice)│    │ (OpenAI)    │    │ Generation  │    │ State       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**LLM Integration (OpenAI):**
```typescript
interface QueryRequest {
  query: string;                    // Natural language input
  context: CardSchemaContext;       // Available fields, types, values
}

interface QueryResponse {
  filters: FilterState;             // Structured filter object
  explanation?: string;             // "Showing 12 colonists with robot-related futures"
  suggestions?: string[];           // "Did you also want to filter by ISRU?"
}
```

**Function Calling Schema:**
```typescript
// OpenAI function definition
const filterFunction = {
  name: "apply_card_filters",
  description: "Filter HF4A cards based on user query",
  parameters: {
    type: "object",
    properties: {
      cardTypes: { type: "array", items: { enum: [...cardTypes] } },
      spectralTypes: { type: "array", items: { enum: ["C","D","H","M","S","V","any"] } },
      isruRange: { type: "object", properties: { min: "number", max: "number" } },
      massRange: { type: "object", properties: { min: "number", max: "number" } },
      textSearch: { type: "string" },
      // ... other filter fields
    }
  }
};
```

**Voice Integration (Web Speech API):**
```typescript
// Browser-native, no additional dependencies
const recognition = new webkitSpeechRecognition();
recognition.continuous = false;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  processNaturalLanguageQuery(transcript);
};
```

### Architecture Considerations for Phase 3

| Component | Phase 1 Design | Why |
|-----------|---------------|-----|
| Filter state | Zustand store with structured schema | LLM output maps directly to store |
| Search input | Single text field | Becomes NL query input |
| Filter UI | Dropdowns/checkboxes | Remains as visual feedback + manual override |
| Card data | JSON with consistent schema | LLM needs predictable field names |
| API layer | None (static) | Add thin proxy for OpenAI calls |

**API Key Handling:**
- Phase 3 requires server component OR user-provided API key
- Options:
  1. Cloudflare Worker as proxy (free tier: 100k requests/day)
  2. User enters own OpenAI key (stored in localStorage)
  3. Vercel Edge Function

### Voice Mode UX
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] HF4A Card Explorer     [Search: ____________] [🎤]  │
│                                                     ▲       │
│                                          Voice button       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🎤 Listening... "show me thrusters with high thrust"    ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Filters: [Thruster ✓] [Thrust: 5+]         [Clear] [Undo]  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3 Implementation Steps
1. **Add OpenAI integration** - Function calling for filter generation
2. **Query preprocessing** - Handle card-specific terminology
3. **Response mapping** - LLM output → Zustand filter state
4. **Fallback handling** - Graceful degradation if LLM unclear
5. **Voice input** - Web Speech API integration
6. **Conversation context** - Remember previous queries for refinement

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18+** | Component framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool, fast HMR |
| **vite-plugin-pwa** | PWA/offline support |
| **TailwindCSS** | Utility-first styling |
| **Framer Motion** | Card flip animations |
| **Zustand** | Lightweight state management |
| **React Router** | URL-based filtering (shareable links) |

### PWA Support
| Feature | Implementation |
|---------|---------------|
| **Offline mode** | Service worker caches app shell + card data |
| **Installable** | Web app manifest for "Add to Home Screen" |
| **Image caching** | Cache thumbnails on first view; full images on demand |
| **Works on GitHub Pages** | Yes - service workers work on any HTTPS host |

```typescript
// vite.config.ts PWA config
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HF4A Card Explorer',
        short_name: 'HF4A Cards',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/hf4a\.github\.io\/cards\/thumbs\//,
            handler: 'CacheFirst',
            options: { cacheName: 'card-thumbnails' },
          },
          {
            urlPattern: /^https:\/\/hf4a\.github\.io\/cards\/full\//,
            handler: 'CacheFirst',
            options: { cacheName: 'card-full-images' },
          },
        ],
      },
    }),
  ],
})
```

### Data Layer
| Technology | Purpose |
|------------|---------|
| **JSON** | Card metadata storage (no backend needed for Phase 1) |
| **Fuse.js** | Client-side fuzzy search (Phase 1); replaced by LLM in Phase 3 |

### State Management (LLM-Ready)

Filter state is structured to map directly to LLM function calling output:

```typescript
// src/store/filterStore.ts
import { create } from 'zustand';

interface FilterState {
  // Card type filters
  cardTypes: CardType[];           // Empty = all types

  // Attribute filters
  spectralTypes: SpectralType[];   // Empty = all
  isruRange: { min: number; max: number } | null;
  massRange: { min: number; max: number } | null;
  thrustRange: { min: number; max: number } | null;

  // Module filter
  modules: Module[];               // Empty = all

  // Text search (Phase 1: Fuse.js, Phase 3: LLM-interpreted)
  searchQuery: string;

  // Display options
  showUpgradedSide: boolean;       // Toggle white→black→purple

  // Actions
  setFilters: (filters: Partial<FilterState>) => void;
  clearFilters: () => void;
  toggleCardType: (type: CardType) => void;
  // ...
}

// This exact structure becomes the OpenAI function schema in Phase 3
// LLM returns: { cardTypes: ['colonist'], isruRange: { min: 0, max: 2 } }
// Store updates directly with setFilters(llmResponse)
```

**Why this matters for Phase 3:**
- LLM function calling returns structured JSON matching FilterState
- No translation layer needed between LLM output and UI state
- Filter UI shows current state whether set manually or by LLM
- Undo/history works uniformly for manual and voice commands

### Deployment
| Technology | Purpose |
|------------|---------|
| **GitHub Pages** | Free static hosting (primary choice) |
| **Image optimization** | WebP conversion, lazy loading, responsive srcset |

---

## Card Data Model

### Image Inventory Summary
- **Total images**: 742
- **Card categories**: 13 types across Core + 4 Modules

### Naming Convention (Existing)
```
{Type}{Number}-{Side}-{CardName}.png

Examples:
- Thruster01-White-AblativePlate.png
- Thruster01-Black-AblativeNozzle.png
- Colonist01-Purple-UtilityFogHalbonaut.png
- Contract01-Blue-AvatarTourists-InnerTour.png
```

### Side Relationships
| Base Side | Upgraded Side | Notes |
|-----------|---------------|-------|
| White | Black | Standard patent upgrade |
| Black | Purple | GW Thrusters, Freighters, some Colonists |
| White | Purple | Some Colonists (skip black) |
| Blue | Yellow | Contract card alternatives |

### Card Schema (JSON)
```typescript
interface Card {
  id: string;                    // Unique identifier (from filename)
  cardId: string;                // In-game ID (e.g., "CT052F")
  type: CardType;                // thruster, reactor, generator, etc.
  name: string;                  // Display name
  description: string;           // Flavor text (OCR'd from cards)

  // Attributes (nullable - not all cards have all attributes)
  mass: number | null;
  radHard: number | null;
  spectralType: SpectralType | 'any' | null;
  isru: number | null;           // 0-4, robonauts/colonists only

  // Type-specific attributes
  thrust?: number;               // Thrusters
  fuelEfficiency?: number;       // Thrusters (blue number)
  afterburn?: number;            // Thrusters (magenta number)
  powerOutput?: number;          // Reactors/Generators (MW)
  efficiency?: number;           // Percentage
  loadLimit?: number;            // Freighters

  // Support system
  supports: SupportIcon[];       // What this card provides
  requires: SupportIcon[];       // What this card needs

  // Images
  sides: {
    white?: string;              // Path to white side image
    black?: string;              // Path to black side image
    purple?: string;             // Path to purple side image
    blue?: string;               // Contract blue side
    yellow?: string;             // Contract yellow side
  };

  // Relationships
  upgradesTo?: string;           // Card ID of upgraded version
  upgradesFrom?: string;         // Card ID of base version

  // Categorization
  module: Module;                // core, m1, m2, m3, m4
  subtype?: string;              // e.g., "Engineer Colonist", "Human", "Robot"
  ideology?: Ideology;           // Contracts only
}

type CardType =
  | 'thruster' | 'reactor' | 'generator' | 'radiator'
  | 'robonaut' | 'refinery' | 'colonist' | 'bernal'
  | 'freighter' | 'gw-thruster' | 'crew' | 'contract';

type SpectralType = 'C' | 'D' | 'H' | 'M' | 'S' | 'V';

type SupportIcon =
  | 'reactor' | 'generator' | 'radiator'
  | 'crew' | 'robonaut' | 'refinery';

type Module = 'core' | 'm1-terawatt' | 'm2-colonization' | 'm3-conflict' | 'm4-exodus';

type Ideology = 'individuality-freedom' | 'honor-unity' | 'authority-equality' | 'exodus';
```

---

## Card Type Reference

### Patent Deck Cards (Auctioned)
| Type | Header Color | Count | Sides | Key Stats |
|------|--------------|-------|-------|-----------|
| Thruster | Orange | 12 | W/B | Mass, Thrust, Fuel Eff, Afterburn |
| Reactor | Purple | 12 | W/B | Mass, Power (MWth), Efficiency |
| Generator | Coral/Red | 17 | W/B | Mass, Output (MWe), Efficiency |
| Radiator | Cyan | 12 | W/B | Mass, Thermal capacity |
| Robonaut | Magenta | 12 | W/B | Mass, ISRU, Operation type |
| Refinery | Tan/Brown | 12 | W/B | Mass, ISRU |

### Module 1: Terawatt Cards
| Type | Header Color | Count | Sides | Key Stats |
|------|--------------|-------|-------|-----------|
| GW Thruster | Orange (dark) | 7 | B/P | Mass, Thrust (GW scale) |
| Freighter | Teal | 7 | B/P | Mass, Load-limit |

### Module 2: Colonization Cards
| Type | Header Color | Count | Sides | Key Stats |
|------|--------------|-------|-------|-----------|
| Bernal | Gray | 12 | W/P | Mass, HOME ability, VP |
| Colonist | Gray (dark) | 18+ | W/B/P or W/P | Mass, ISRU, Dome type, Futures |
| Spaceborn | Gray | 10 | W/P | Mass, ISRU, special abilities |

### Crew Cards
| Type | Header Color | Count | Notes |
|------|--------------|-------|-------|
| Crew | Faction color | 12 | Yellow, Purple, White, Green, Grey, Red |

### Contract Cards
| Type | Sides | Count per Ideology | Notes |
|------|-------|-------------------|-------|
| Contract | Blue/Yellow | 12 | VP conditions, Late Fee, Advance |

---

## Support Icon Reference

### Icon Types (from card visual analysis)
| Icon | Meaning | Found On |
|------|---------|----------|
| Wavy line (∿) | Radiator required | Many cards |
| Circle with dot (⊙) | Generator required | Many cards |
| Wrench | Robonaut/operational | Reactors, Generators |
| Thermometer | Heat-related | Radiators |
| Lightning | Power-related | Generators |
| X | Hazard/restriction | Various |
| Buggy | ISRU operation | Robonauts |
| Raygun | ISRU operation | Robonauts |

---

## Screen Designs

### 1. Card Grid (Main View)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] High Frontier 4 All Card Explorer    [Search: ____] │
├─────────────────────────────────────────────────────────────┤
│ Filters: [Type ▼] [Spectral ▼] [ISRU ▼] [Module ▼]        │
│          [Show Upgraded ○]                    [Clear All]  │
├─────────────────────────────────────────────────────────────┤
│ Showing 234 of 742 cards                                    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │     │ │     │ │     │ │     │ │     │ │     │ │     │  │
│ │Card │ │Card │ │Card │ │Card │ │Card │ │Card │ │Card │  │
│ │     │ │     │ │     │ │     │ │     │ │     │ │     │  │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ │     │ │     │ │     │ │     │ │     │ │     │ │     │  │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Card Detail Modal
```
┌─────────────────────────────────────────────────────────────┐
│                                                    [X Close]│
│                                                             │
│     ┌───────────────────────────────────┐                  │
│     │                                   │                  │
│     │                                   │                  │
│     │         [Card Image]              │   Card Name      │
│     │         (click to flip)           │   ───────────    │
│     │                                   │   Type: Thruster │
│     │                                   │   Mass: 1        │
│     │                                   │   Spectral: V    │
│     │                                   │   Thrust: 1      │
│     └───────────────────────────────────┘   Module: Core   │
│                                                             │
│     [◀ White] [● Black] [○ Purple]                         │
│                                                             │
│     Description: The plate is tapered to absorb pulsed...  │
│                                                             │
│     Supports: ⊙ Generator  ∿ Radiator                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Mobile View
- Single column card grid
- Bottom sheet for filters
- Swipe to flip cards
- Pinch to zoom card detail

---

## Implementation Plan

### Phase 1A: Data Pipeline
1. **Inventory all images** - Generate manifest of all card images
2. **Parse filenames** - Extract type, number, side, name from filenames
3. **Build card relationships** - Match White↔Black↔Purple sides
4. **Claude OCR batch** - Extract text, stats, cardId from all 742 images (~$2.25)
5. **Merge & validate** - Combine filename + OCR data, spot-check 10%
6. **Image optimization** - Convert PNG→WebP, generate thumbnails

### Phase 1B: Core UI
1. **Project setup** - Vite + React + TypeScript + Tailwind + PWA plugin
2. **Zustand store** - FilterState structure (LLM-ready schema)
3. **Card grid component** - Responsive, virtualized for performance
4. **Card thumbnail** - Lazy loading, placeholder states
5. **Filter UI** - Multi-select dropdowns, clear all
6. **Search** - Debounced input, Fuse.js integration

### Phase 1C: Card Detail
1. **Modal component** - Overlay with card detail
2. **Flip animation** - Framer Motion 3D transform
3. **Side navigation** - Switch between available sides
4. **Keyboard navigation** - Arrow keys, Escape to close
5. **URL routing** - Shareable card/filter links

### Phase 1D: Polish & Deploy
1. **PWA manifest** - Icons, theme, offline caching strategy
2. **Performance audit** - Lighthouse, bundle size, image loading
3. **Mobile testing** - Touch interactions, responsive, install prompt
4. **Deploy** - GitHub Pages (hf4a.github.io)
5. **Documentation** - README, CLAUDE.md, CONTRIBUTING

---

## Data Extraction Strategy

### Step 1: Generate Image Manifest
```bash
# Output all images with metadata
fd -e png . content/hf4a-cards --exec basename {} \; | sort > manifest.txt
```

### Step 2: Parse to JSON Structure
```javascript
// Filename pattern: {Type}{Number}-{Side}-{CardName}.png
const pattern = /^(\w+)(\d+)-(\w+)-(.+)\.png$/;

// Example: Thruster01-White-AblativePlate.png
// Groups: [Thruster, 01, White, AblativePlate]
```

### Step 3: Build Relationships
```javascript
// Group by Type + Number to find related sides
// Thruster01 → [White-AblativePlate, Black-AblativeNozzle]
```

### Step 4: Claude OCR for Card Text
```typescript
// scripts/ocr-cards.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

interface CardOCRResult {
  filename: string;
  name: string;
  cardId: string;           // e.g., "CT052F"
  description: string;      // Flavor text
  stats: {
    mass?: number;
    radHard?: number;
    thrust?: number;
    isru?: number;
    powerOutput?: string;   // e.g., "550 MWth"
    efficiency?: string;    // e.g., "70%"
  };
  spectralType?: string;
  supportIcons: string[];   // ["radiator", "generator"]
  rawText: string;          // Full OCR for search indexing
}

async function ocrCard(imagePath: string): Promise<CardOCRResult> {
  const imageData = await fs.readFile(imagePath);
  const base64 = imageData.toString('base64');
  const mediaType = 'image/png';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Extract all text and data from this High Frontier 4 All card.
Return JSON with:
- name: card name (bottom of card)
- cardId: ID code (bottom right corner, e.g., "CT052F")
- description: flavor/description text
- stats: { mass, radHard, thrust, isru, powerOutput, efficiency } (numbers where applicable)
- spectralType: letter in hexagon (C, D, H, M, S, V, or "any")
- supportIcons: array of support types shown (radiator, generator, reactor, crew, robonaut)
- rawText: all text on card for search indexing

Return valid JSON only.`
        }
      ],
    }],
  });

  return JSON.parse(response.content[0].text);
}

// Batch process with rate limiting
async function processAllCards(imageDir: string) {
  const files = await fs.readdir(imageDir, { recursive: true });
  const pngFiles = files.filter(f => f.endsWith('.png'));

  const results: CardOCRResult[] = [];
  for (const file of pngFiles) {
    console.log(`Processing: ${file}`);
    const result = await ocrCard(path.join(imageDir, file));
    result.filename = file;
    results.push(result);

    // Rate limit: ~50 requests/minute for Claude
    await new Promise(r => setTimeout(r, 1200));
  }

  await fs.writeFile('data/ocr-results.json', JSON.stringify(results, null, 2));
}
```

**Estimated OCR Cost:**
- 742 images × ~$0.003/image (Sonnet with vision) ≈ **$2.25 total**

### Step 5: Merge OCR with Filename Metadata
```typescript
// Combine parsed filenames + OCR results into final cards.json
// Filename gives: type, number, side
// OCR gives: name, stats, description, cardId
```

### Step 6: Validation Checklist
- [ ] Every card has at least one image
- [ ] White cards have matching Black/Purple where expected
- [ ] No orphaned images
- [ ] All spectral types valid (C, D, H, M, S, V, any)
- [ ] Card IDs unique
- [ ] OCR results manually spot-checked (sample 10%)

---

## Directory Structure

Designed for clarity, maintainability, and MCP/AI tool access (e.g., gitcontext).

```
hf4a.github.io/
│
├── README.md                     # Project overview, quick start
├── CLAUDE.md                     # AI assistant instructions (MCP/gitcontext)
├── SPEC.md                       # This file - full specification
├── CONTRIBUTING.md               # How to contribute card data
│
├── docs/                         # Documentation (AI-indexable)
│   ├── CARD_TYPES.md             # Reference: all card types explained
│   ├── DATA_SCHEMA.md            # Reference: JSON schema documentation
│   └── GAME_RULES_SUMMARY.md     # Quick reference for HF4A mechanics
│
├── data/                         # Card data (separate from code)
│   ├── cards.json                # Master card database
│   ├── manifest.json             # Image inventory + checksums
│   ├── schema.json               # JSON Schema for validation
│   └── relationships.json        # Card upgrade paths (white→black→purple)
│
├── public/                       # Static assets (deployed as-is)
│   ├── cards/                    # Optimized card images
│   │   ├── full/                 # Full resolution WebP
│   │   │   ├── thrusters/
│   │   │   ├── reactors/
│   │   │   └── ...
│   │   └── thumbs/               # 200px thumbnails
│   │       ├── thrusters/
│   │       └── ...
│   └── favicon.ico
│
├── src/                          # Application source
│   ├── components/
│   │   ├── CardGrid.tsx
│   │   ├── CardThumbnail.tsx
│   │   ├── CardDetail.tsx
│   │   ├── CardFlip.tsx
│   │   ├── FilterBar.tsx
│   │   ├── SearchInput.tsx
│   │   └── Layout.tsx
│   ├── hooks/
│   │   ├── useCards.ts
│   │   ├── useFilters.ts
│   │   └── useSearch.ts
│   ├── store/
│   │   └── filterStore.ts        # Zustand state
│   ├── types/
│   │   └── card.ts               # TypeScript interfaces
│   ├── utils/
│   │   ├── cardHelpers.ts
│   │   └── imageHelpers.ts
│   ├── App.tsx
│   └── main.tsx
│
├── scripts/                      # Build-time utilities
│   ├── generate-manifest.ts      # Inventory images → manifest.json
│   ├── parse-filenames.ts        # Extract metadata from filenames
│   ├── build-relationships.ts    # Map card upgrade paths
│   ├── optimize-images.ts        # PNG → WebP + thumbnails
│   └── validate-data.ts          # Check data integrity
│
├── content/                      # Source images (gitignored, not deployed)
│   └── hf4a-cards/               # Original PNGs
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Pages deployment
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `data/` at root | Easy to find, edit, validate independently of code |
| `docs/` at root | AI tools can index game rules without parsing code |
| `CLAUDE.md` | Instructions for AI assistants accessing via MCP |
| `manifest.json` | Single source of truth for image inventory |
| `relationships.json` | Explicit card upgrade mappings (not buried in code) |
| Source images gitignored | Keep repo lean; originals stored elsewhere |

### CLAUDE.md (AI Assistant Context)

```markdown
# CLAUDE.md - AI Assistant Instructions

## Project
HF4A Card Explorer - web app for browsing High Frontier 4 All game cards.

## Key Files
- `SPEC.md` - Full project specification
- `data/cards.json` - All card metadata (source of truth)
- `data/schema.json` - JSON Schema for card data validation
- `docs/CARD_TYPES.md` - Card type reference

## Data Structure
Cards are in `data/cards.json`. Schema in `data/schema.json`.
Images are in `public/cards/{full|thumbs}/{type}/{filename}.webp`.

## Common Tasks
- Add card metadata: Edit `data/cards.json`, run `npm run validate`
- Add new images: Place in `content/`, run `npm run build-images`
- Update card relationships: Edit `data/relationships.json`

## Code Conventions
- React functional components with TypeScript
- Zustand for state management
- TailwindCSS for styling
- All card types defined in `src/types/card.ts`
```

---

## Hosting Plan

### Primary: GitHub Pages (Recommended)

**Why it works:**
- 100% static app (React + Vite compiles to HTML/CSS/JS)
- No backend, no API calls, no database
- All card data in JSON, images served as static assets

**Limits (more than sufficient):**
| Resource | Limit | This App |
|----------|-------|----------|
| Repo size | 1 GB soft | ~200-300 MB |
| Site size | 1 GB | ~200-300 MB |
| Bandwidth | 100 GB/month | Plenty for demo |
| Builds | 10/hour | Not an issue |

**Setup (one-time):**
```typescript
// vite.config.ts - root path for org page
export default defineConfig({
  base: '/',
  plugins: [react()],
})
```

**Deploy via GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

**URL:** `https://hf4a.github.io/`

**Repo name:** `hf4a.github.io` (in HF4A org)

---

### Alternative: Cloudflare Pages (If bandwidth becomes issue)

**Why consider:**
- Unlimited bandwidth (free tier)
- Faster global CDN than GitHub
- Same simplicity - just connect repo

**Setup:**
1. Go to Cloudflare Dashboard → Pages
2. Connect GitHub repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Done

**URL:** `https://hf4a.pages.dev` (or custom domain free)

---

### Comparison Table

| Feature | GitHub Pages | Cloudflare Pages | Vercel | Netlify |
|---------|-------------|------------------|--------|---------|
| **Cost** | Free | Free | Free | Free |
| **Bandwidth** | 100GB/mo | Unlimited | 100GB/mo | 100GB/mo |
| **CDN** | Basic | Global (fastest) | Global | Global |
| **Setup** | Native to GH | Connect repo | Connect repo | Connect repo |
| **Custom domain** | Free | Free | Free | Free |
| **Build minutes** | Unlimited | 500/mo | 6000/mo | 300/mo |
| **Best for** | Simplicity | Performance | React apps | Simplicity |

**Recommendation:** Start with GitHub Pages. Zero additional accounts needed. If you hit bandwidth limits or want faster global performance, migrate to Cloudflare Pages (10-minute migration).

---

### Image Optimization Strategy

Large image assets are the main concern. Mitigation:

1. **Convert to WebP** - 30-50% smaller than PNG
   ```bash
   # Using sharp-cli
   npx sharp-cli --input "content/**/*.png" --output "public/cards" --format webp --quality 85
   ```

2. **Generate thumbnails** - 200px wide for grid view
   ```bash
   npx sharp-cli --input "content/**/*.png" --output "public/cards/thumbs" --resize 200 --format webp
   ```

3. **Lazy loading** - Only load visible cards
   ```tsx
   <img loading="lazy" src={card.thumbnail} />
   ```

4. **Estimated sizes:**
   | Asset | Original | Optimized |
   |-------|----------|-----------|
   | Full images (742) | ~150 MB | ~75 MB (WebP) |
   | Thumbnails (742) | N/A | ~15 MB |
   | JSON data | N/A | ~500 KB |
   | App bundle | N/A | ~200 KB |
   | **Total** | ~150 MB | **~90 MB** |

---

## Decisions Log

| Question | Decision | Notes |
|----------|----------|-------|
| OCR for descriptions? | **Claude model** | Use Claude API for batch OCR of card text |
| Card ID in data? | **Yes, searchable only** | Include in metadata for search, don't display in UI |
| Multi-language? | **No** | Not at this time |
| PWA/Offline? | **Yes** | vite-plugin-pwa, works on GitHub Pages |
| Print mode? | **No** | Not needed |

---

## Open Questions

1. **Claude OCR batch strategy** - Process all 742 images in one script run, or incremental?
2. **Card description granularity** - OCR full card text, or just key fields (name, stats)?
3. **Phase 3 API proxy** - Cloudflare Worker vs user-provided OpenAI key?

---

## References

- [High Frontier 4 All - BoardGameGeek](https://boardgamegeek.com/boardgame/281655/high-frontier-4-all)
- [ION Game Design Official Page](https://iongamedesign.com/products/high-frontier-4-all)
- [HF4 Card List (BGG)](https://boardgamegeek.com/filepage/207172/hf4-card-list)
- [HF4 Core Rules PDF](https://boardgamegeek.com/filepage/203638/hf4-all-core-rules-final)
- [HF4 Official Appendix](https://boardgamegeek.com/filepage/203643/hf4-all-official-appendix-final)
- [Card Organization Chart](https://letsgetsboard.substack.com/p/a-chart-to-help-you-play-high-frontier)
- [Module 1 Terawatt Rules](https://gamers-hq.de/media/pdf/78/b6/06/HF4-M1_Terawatt_rules.pdf)
- [Module 2 Colonization Rules](https://gamers-hq.de/media/pdf/a0/4d/14/HF4-M2_Colonization_rules.pdf)
