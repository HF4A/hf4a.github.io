SHOWXATING Mode

Belter-themed visual recognition and capture system for High Frontier 4 All

Inspired by the Belter creole phrase seen throughout The Expanse.

Visual Reference: See IMG_2282.heic for HUD styling from The Expanse.
- Primary color: SHOWXATING Gold `#d4a84b` (muted amber, not bright yellow)
- Font: Condensed sans-serif, ALL CAPS (Eurostile Extended / Bank Gothic style)

⸻

1. Product intent

SHOWXATING is a new mode inside the HF4A web app that turns the phone camera into a Belter-style heads-up display for interacting with physical game artifacts.

It has two tightly related sub-modes:
	1.	Scan Mode
Live card recognition.  Detect a High Frontier card and overlay the opposite side in real time.
	2.	Capture Mode
Structured photo, video, and narrated audio capture for later model training.  No scoring.  No automation.  Data collection only.

Both modes share the same visual language and camera pipeline.

⸻

2. Design principles
	•	Belter, not cosplay.  Functional sci-fi UI.  Sparse.  Purposeful.
	•	Human in the loop.  Recognition assists.  Capture empowers.  Nothing acts silently.
	•	Local first.  Runs fully in browser.  No required backend.
	•	Dataset flywheel.  Every capture session is future leverage.

⸻

3. Rebranding and visual language

Overall UI rebrand

The entire SHOWXATING surface departs from the current flat web UI.

Visual traits
	•	Dark, near-black backgrounds with low-saturation color.
	•	High contrast accent colors.  Amber, cyan, desaturated red.
	•	Thin vector lines.  No heavy panels.
	•	Monospaced or narrow grotesk typography for system text.
	•	Subtle scanline and noise textures only when camera is active.

Motion
	•	Minimal.  Fast fades.  No easing theatrics.
	•	Lock-on effects use geometry, not glow.

Language
	•	Short system prompts.  Belter-inspired but readable.
	•	Examples: LOCK, SEARCHING, STEADY, CAPTURED, EXPORT READY.

⸻

4. App-Wide Navigation Architecture

Top Navigation Bar
```
┌────────────────────────────────┐
│ [SYS]    SHOWXATING     [CAT] │
└────────────────────────────────┘
```

- **Active view**: Large text, no bounding box
- **Inactive views**: Smaller text, bounding box (like buttons)
- When user taps [CAT], it becomes "CATALOG" (large, unboxed), and "SHOWXATING" shrinks into [SHO] box

Navigation Items:
- **SYS** - System settings panel (small, upper-left)
- **SHOWXATING** - Scan mode with live camera
- **CAT** - Card Catalog (original all-card sortable view)

Default Behavior:
- SHOWXATING (Scan mode) loads by default on app launch
- User can change default via SYS settings
- Setting persisted via localStorage

Theme Consistency:
- Apply Amber Belter theme to Card Catalog view
- Unified visual language across all app views
- Dark backgrounds, gold accents, Eurostile-style typography

⸻

5. Mode A: Scan Mode [SHOWXATING]

Purpose

Capture photos of HF4A cards on the table, identify them, and overlay the opposite side for easy reference. User can then explore captured cards away from the table.

Top Banner Position: Center (active view, large text, no box)

Bottom Action Bar
```
┌─────────────────────────────────┐
│ [S3] [S2] [S1]          [SCAN] │
└─────────────────────────────────┘
```

The bottom ribbon scrolls horizontally. The centered button indicates the active view:
- **SCAN centered**: Live camera view, ready to capture
- **S1/S2/S3 centered**: Viewing that captured image with overlays

Slot System (S1, S2, S3):
- **S1**: Most recent captured scan
- **S2**: Previous scan
- **S3**: Oldest scan (drops off when new scan captured)
- Maximum 3 captured scans in history
- New capture → S1, existing scans shift left (S1→S2, S2→S3, S3 dropped)

### Live View (SCAN centered)

Shows camera feed with visual indicators that image recognition is active:
- Card edge detection brackets (cyan/gold)
- Crosshair and status indicators
- **Does NOT identify cards by name in live view**
- Purpose: Show user that cards are being detected, ready to capture

### Capture Flow

When [SCAN] is pressed:
1. Static image captured from camera
2. Image becomes S1, view switches to S1
3. Card identification begins on the static image
4. **Multiple cards** may be in the scanned image - detect and identify ALL

### Card Identification Animation

For each detected card in the captured image:
1. Show bounding box around detected card shape
2. **Scanlines animate up/down** within the bounding box (indicates processing)
3. Once card is identified, replace bounding box with **scaled card image from library**
4. Initial overlay shows either **visible side** or **opposite side** based on SYS setting (Default Scan Result)

### Card Overlay Interaction (on captured image)

**Single tap**: Flips card between visible/opposite side (quick toggle)
- Each card's flip state is tracked independently
- Flip states persist per card, per scan slot
- Quick way to check the other side without leaving the scan view

**Double-tap**: Opens full-screen card detail view (modal)
- Same behavior as Catalog card detail (consistent UX)
- Swipe left/right to flip card
- Swipe up for metadata info panel
- Swipe down to dismiss
- **[RESCAN] button** in top-right (only when opened from SHOWXATING) to trigger correction flow

### Card Detail View (full screen)

When user double-taps a card overlay:
1. Card expands to **full screen** (like card catalog detail view)
2. **Swipe left/right**: Flip card to see other side
3. **Swipe up**: Show metadata info panel
4. **Swipe down**: Dismiss, return to scanned image with overlays
5. **[RESCAN] button** (top-right, when from SHOWXATING): Opens correction flow

### Manual Correction Flow (via [RESCAN] button)

Split-screen layout for manual card identification:

**Left panel (1/3 width)**:
- Zoomed view of ONLY the detected bounding box (cropped from scan)
- Below: Any extracted text from the card region
- Shows what the camera actually captured for this card

**Right panel (2/3 width)**:
- Scrollable list of candidate matches
- Ordered by match score (best first)
- Each card shows: thumbnail, name, match score
- **Double-tap** on a card to select it as the correction

**Behavior**:
1. User taps [RESCAN] in card detail view
2. Correction panel slides up
3. User reviews cropped image and extracted text
4. User scrolls through candidates
5. User double-taps correct card
6. Correction saved to persistent cache
7. Overlay updates immediately

### State Persistence

- **Scan slots (S1-S7)**: Persisted in localStorage between page reloads
  - Captured image data
  - Detected cards and their positions
  - Flip state for each card
- **Settings**: Persisted in localStorage (see SYS settings)
- **Manual corrections cache**: Persisted separately from scan slots
  - Stores user corrections even after slots clear
  - Includes: original hash, incorrect match, correct match, timestamp
  - Exported with diagnostics for model training

### User Flow Summary
1. User opens SHOWXATING (default on app launch)
2. Live camera with detection indicators, SCAN centered
3. User points phone at card(s) on table
4. Brackets show detected card shapes (no identification yet)
5. User taps [SCAN] to capture
6. Static image captured, scanlines animate on each card
7. Cards identified, overlays appear (visible or opposite side per SYS setting)
8. User can **tap any overlay to flip** it (quick toggle between sides)
9. User can scroll ribbon to view S1/S2/S3 history or return to SCAN
10. User **long-presses overlay** for full card detail view
11. In detail view: swipe left/right to flip, up/down to dismiss

### HUD Elements (Live View)
- Center targeting crosshair
- Card boundary brackets (detection indicator)
- Status text: SEARCHING → TRACKING → READY
- Minimal, functional Belter aesthetic

### Functional Requirements
- Live camera via getUserMedia
- Card quadrilateral detection (OpenCV.js)
- Static image capture on SCAN press
- Card identification via dHash perceptual hashing
- Perspective-correct overlay of opposite side
- Support multiple cards per capture
- History of 3 captures

⸻

6. Mode B: Card Catalog [CAT]

Top Banner Position: Right (when inactive: small, boxed as [CAT])

Purpose

Searchable and filterable view of all HF4A cards, styled in Amber Belter theme.

This is the original app functionality before SHOWXATING was introduced, restyled to match the Belter aesthetic.

Features:
- Browse all 370+ cards
- Search by name, keywords
- Filter by type, spectral class, side, etc.
- Grid view with card thumbnails
- Same card detail view as Mode A (full screen, flip, [INFO] button)

Card Detail (same as Mode A):
- Full screen card image
- Swipe left/right to flip
- Swipe up/down to dismiss
- [INFO] button for metadata page
- No metadata panel cluttering the view

Visual Style:
- Dark backgrounds
- Gold/amber accents (#d4a84b)
- Eurostile-style typography
- Thin borders, no heavy panels

⸻

7. Mode C: System Settings [SYS]

Top Banner Position: Left (always small, boxed as [SYS])

Purpose

System configuration and diagnostics access.

### Settings Options

**1. Default Launch Mode**
Toggle between:
- **Scan** (Mode A) - Default
- **Catalog** (Mode B)

Preference stored in localStorage.

**2. Default Scan Result**
When a new scan is captured, show:
- **Visible Side** (Default) - Show the same side that was photographed
- **Opposite Side** - Show the reverse of what was photographed

Preference stored in localStorage.

**3. [ACTIVE CARD TYPES] Button**
Opens popup showing all card types that can be toggled on/off independently.

Card types grouped by HF4A module (for reference only - each type toggled independently):
- **Core Game**: Thrusters, Reactors, Generators, Radiators, Robonauts, Refineries
- **Module 0: Politics**: Crew
- **Module 1: Terawatt**: GW Thrusters, Freighters
- **Module 2: Colonization**: Colonists, Bernals
- **Module 4: Exodus**: Contracts, Spaceborn

Active card types affect:
- Which cards appear in Catalog
- Which cards are matched during scanning

**4. [SEND DIAGNOSTICS]**
- Packages all scan data, corrections, and logs as ZIP
- Shares via system share sheet

**5. [VIEW LOGS] Button**
- Opens Belter-styled system log viewer
- Shows recent app events, errors, and diagnostics
- Logs stored in localStorage with automatic aging (max 100 entries)
- Displayed as ship's computer terminal readout

### System Info Display

Displayed in Belter ship status style:
- App version number
- System date/time
- Device info
- Connection status
- Other relevant system metrics

Visual style: Like a ship's system readout panel - functional, minimal, amber text on dark background.

### Factory Reset

**[WIPE THE CORE]** button:
- Clears all localStorage data (scans, settings, corrections, logs)
- Requires confirmation
- Thematically: "wiping the core" like in The Expanse

⸻

8. Card Detail View (Shared)

Used by both Mode A (Scan) and Mode B (Catalog).

Layout:
- Full screen card image
- Dark background
- Card centered and scaled appropriately

Interactions:
- **Swipe left/right**: Flip card to opposite side
- **Swipe up/down**: Dismiss, return to previous view
- **[INFO] button**: Small, bottom corner, Belter style - opens metadata page

Metadata/Info Page:
- Accessed via [INFO] button only
- Shows all card details (name, type, stats, flavor text, etc.)
- Styled in Amber Belter theme
- Back button to return to card view

Design Principle:
- Card image is primary
- Metadata is secondary, accessed on demand
- Clean, uncluttered viewing experience

⸻

9. Data storage and export

Local storage
	•	IndexedDB for session metadata and thumbnails.
	•	Media stored temporarily until export.

Export bundle

User exports a single ZIP per session containing:
	•	/media/ photos, video, audio.
	•	/session.json structured metadata.
	•	/manifest.json file list, hashes, schema version.

Export is explicit and user-initiated.

⸻

10. Technology stack

Existing base
	•	React 18 + Vite
	•	TypeScript
	•	Zustand (state management)
	•	Framer Motion (animations)
	•	TailwindCSS
	•	GitHub Pages deployment

Camera and media
	•	WebRTC getUserMedia
	•	MediaRecorder API
	•	Canvas 2D for frame processing

Vision pipeline for Scan Mode
	•	OpenCV.js (~8MB, CDN, lazy-loaded)
	•	Card contour detection
	•	Perspective transform
	•	Multi-factor card identification (weighted scoring):
		- Text extraction via contrast analysis (70% weight)
		- dHash perceptual hashing for visual structure (30% weight)
		- Fuse.js fuzzy matching against card metadata (title, description, stats)
		- Combined scoring for improved accuracy
	•	No server calls

Capture Mode additions
	•	MediaRecorder for video/audio
	•	IndexedDB via `idb` library
	•	JSZip for export bundles

⸻

11. Architecture

Routes
	•	/ (root, redirects based on default setting)
	•	/showxating (Scan Mode)
	•	/catalog (Card Catalog)
	•	/showxating/capture (via SYS panel)

Key components
	•	ShowxatingShell.tsx
	•	CameraView.tsx
	•	HudOverlay.tsx
	•	CardOverlay.tsx
	•	CaptureReview.tsx

Hooks
	•	useCamera.ts
	•	useOpenCV.ts
	•	useCardDetection.ts
	•	useCardIdentification.ts

Stores (Zustand)
	•	showxatingStore.ts
	•	captureStore.ts

⸻

12. Guardrails and constraints
	•	Camera and microphone always require explicit consent.
	•	Recording indicators are always visible.
	•	No background capture.
	•	No silent uploads.
	•	Capture Mode disables all scoring logic.

⸻

13. Acceptance criteria
	•	Scan Mode recognizes cards and overlays the opposite side with stable alignment.
	•	Capture Mode records photos and narrated video.
	•	Exported bundles are complete, deterministic, and usable offline.
	•	UI consistently reflects the Belter aesthetic without harming legibility.
	•	Works in mobile Safari and Chrome within browser limits.

⸻

14. Product positioning

Scan Mode is the immediate value.
Capture Mode is the long-term unlock.

Together, SHOWXATING becomes both a useful tool today and the foundation for future automated scoring without pretending the hard problems are already solved.