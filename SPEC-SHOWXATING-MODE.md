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

4. SHOWXATING entry point
	•	New primary navigation item: SHOWXATING
	•	First entry shows:
	•	Camera permission explanation.
	•	Audio permission explanation for Capture Mode.
	•	Statement that all processing is local unless exported.

⸻

5. Mode A.  Scan Mode (live card recognition)

Purpose

Recognize a single HF4A card in view and overlay the opposite side of that card in real time.

User flow
	1.	User enters SHOWXATING and selects Scan.
	2.	Camera opens with Belter HUD.
	3.	User points at a card.
	4.	HUD crosshair snaps to the card when detected.
	5.	App identifies the card.
	6.	Overlay renders the reverse side of the card aligned to perspective.
	7.	User may:
	•	Freeze frame.
	•	Toggle front/back overlay.
	•	Open full card details.

HUD elements
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

6. Mode B.  Capture Mode (training data collection)

Purpose

Create high-quality, structured datasets for future vision models using real games as ground truth, narrated by the player.

Core idea

After a game, the user walks around the table and records photos or video while narrating what matters.  The narration is the ground truth.  The app does not interpret it.

User flow
	1.	User selects Capture.
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

7. Data storage and export

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

8. Technology stack

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

9. Angular architecture

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

10. Guardrails and constraints
	•	Camera and microphone always require explicit consent.
	•	Recording indicators are always visible.
	•	No background capture.
	•	No silent uploads.
	•	Capture Mode disables all scoring logic.

⸻

11. Acceptance criteria
	•	Scan Mode recognizes cards and overlays the opposite side with stable alignment.
	•	Capture Mode records photos and narrated video.
	•	Exported bundles are complete, deterministic, and usable offline.
	•	UI consistently reflects the Belter aesthetic without harming legibility.
	•	Works in mobile Safari and Chrome within browser limits.

⸻

12. Product positioning

Scan Mode is the immediate value.
Capture Mode is the long-term unlock.

Together, SHOWXATING becomes both a useful tool today and the foundation for future automated scoring without pretending the hard problems are already solved.