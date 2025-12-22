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

5. SYS Panel (System Settings)

Location: Upper-left corner, small bounding box

Contents:
- Default launch mode toggle (Catalog vs Scan)
- CAPTURE mode access (hidden here, not prominent)
- Future settings as needed

Design:
- Minimal footprint when closed
- Expands on tap to show options
- Same Belter styling as rest of app

⸻

6. Mode A.  Scan Mode (live card recognition)

Purpose

Recognize HF4A cards in view and overlay the opposite side in real time. Capture snapshots for detailed exploration away from the table.

Bottom Action Bar
```
┌─────────────────────────────────┐
│ [S3] [S2] [S1]          [SCAN] │
└─────────────────────────────────┘
```

Slot System (S1, S2, S3):
- **S1**: Most recent captured scan
- **S2**: Previous scan
- **S3**: Oldest scan (drops off when new scan captured)
- Maximum 3 active captured scans at a time
- Draggable/swipeable horizontally
- Centered slot is "active" (displayed in main view) and larger
- When SCAN is centered, live camera mode is visible

SCAN Button Behavior:
- Captures snapshot of current camera view with card overlays
- Frozen image with detected cards and overlays preserved
- New capture goes to S1, existing scans shift left (S1→S2, S2→S3, S3 dropped)
- User can then go back to their seat to explore captured cards in detail

User Flow
	1.	User opens SHOWXATING (default on app launch).
	2.	Camera opens with Belter HUD, SCAN centered (live view).
	3.	User points at card(s) on table.
	4.	HUD brackets snap to detected cards, overlays appear.
	5.	User taps SCAN to capture current view with overlays.
	6.	Captured view goes to S1, user can swipe to explore it.
	7.	User can return to seat and swipe through S1/S2/S3 to explore captures.
	8.	Swipe back to SCAN to return to live camera mode.

HUD Elements
	•	Center targeting crosshair.
	•	Card boundary brackets.
	•	Confidence indicator.
	•	Orientation indicator.
	•	Minimal status text.

Functional requirements
	•	Live camera via getUserMedia.
	•	Card quadrilateral detection.
	•	Perspective correction.
	•	Card identification via local index.
	•	Perspective-correct overlay of opposite side.

Explicit exclusions
	•	No scoring.
	•	No board-wide inference.
	•	No data recording unless Capture Mode is active.

⸻

7. Mode B.  Capture Mode (training data collection)

Access: Via SYS panel (not prominently displayed)

Purpose

Create high-quality, structured datasets for future vision models using real games as ground truth, narrated by the player.

Core idea

After a game, the user walks around the table and records photos or video while narrating what matters.  The narration is the ground truth.  The app does not interpret it.

User flow
	1.	User opens SYS panel and selects Capture.
	2.	App displays a short capture checklist:
	•	Lighting.
	•	Glare.
	•	Slow movement.
	•	Keep pieces visible.
	3.	User selects capture type:
	•	Photo set.
	•	Video sweep.
	•	Video sweep with narration.
	4.	Capture begins.  HUD shows acquisition aids only.
	5.	User ends capture.
	6.	Session review screen appears.
	7.	User exports the session bundle.

HUD behavior in Capture Mode
	•	No recognition overlays by default.
	•	Stability indicator.
	•	Exposure and blur hints.
	•	Recording indicator when audio or video is active.

What is captured

Media
	•	Photos.
	•	Video.
	•	Optional audio narration.

Metadata
	•	Timestamps.
	•	Device class and resolution.
	•	Capture mode.
	•	User-entered context fields:
	•	Expansion set.
	•	Lighting notes.
	•	Sleeves yes or no.
	•	App version and schema version.

Important
	•	No scoring.
	•	No auto-labeling.
	•	No inference output.

⸻

8. Data storage and export

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

9. Technology stack

Existing base
	•	Angular.
	•	TypeScript.
	•	GitHub Pages deployment.

Camera and media
	•	WebRTC getUserMedia.
	•	MediaRecorder API.
	•	Canvas 2D and optional WebGL.

Vision pipeline for Scan Mode
	•	Card contour detection.
	•	Perspective transform.
	•	Local card index using perceptual hashes or embeddings.
	•	No server calls.

Capture Mode additions
	•	MediaRecorder service.
	•	IndexedDB session store.
	•	ZIP export library.

⸻

10. Architecture

Routes
	•	/showxating/scan
	•	/showxating/capture

Key components
	•	ShowxatingShellComponent.
	•	CameraViewComponent.
	•	HudOverlayComponent.
	•	CardOverlayComponent.
	•	CaptureReviewComponent.

Services
	•	CameraService.
	•	VisionPipelineService.
	•	CaptureSessionService.
	•	ExportBundleService.

⸻

11. Guardrails and constraints
	•	Camera and microphone always require explicit consent.
	•	Recording indicators are always visible.
	•	No background capture.
	•	No silent uploads.
	•	Capture Mode disables all scoring logic.

⸻

12. Acceptance criteria
	•	Scan Mode recognizes cards and overlays the opposite side with stable alignment.
	•	Capture Mode records photos and narrated video.
	•	Exported bundles are complete, deterministic, and usable offline.
	•	UI consistently reflects the Belter aesthetic without harming legibility.
	•	Works in mobile Safari and Chrome within browser limits.

⸻

13. Product positioning

Scan Mode is the immediate value.
Capture Mode is the long-term unlock.

Together, SHOWXATING becomes both a useful tool today and the foundation for future automated scoring without pretending the hard problems are already solved.