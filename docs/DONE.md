# Completed Features & Milestones

Historical record of completed work. For current roadmap, see [EVERGREEN-SPEC.md](./EVERGREEN-SPEC.md).

---

## v0.3.1 (2025-12-25)
- Switch from OCR.space API to local PP-OCRv4 via ONNX
- Offline OCR capability after first model download (~16MB)
- OCR engine lazy-loading with status indicator

## v0.3.0 (2025-12-23)
- Full pipeline refactor: warp-then-detect, OCR-primary matching
- Text matching at 85% weight, hash matching at 15%
- Full OCR extraction from card images
- Fusion diagnostics in export

## v0.2.x Series (2025-12-19 through 2025-12-23)
- SHOWXATING scan mode with Belter theme
- Live camera card recognition
- 7-slot scan capture system
- Card correction modal with type filtering
- Swipe gestures for card flip and dismiss
- Individual card type filters
- Logging system with Belter-styled viewer
- Factory reset ("Wipe the Core")
- Diagnostics export with images

## v0.1.x (Initial Release)
- Card Explorer catalog with 370+ cards
- Responsive grid layout
- Card detail modal with flip animation
- Full-text search with Fuse.js
- Multi-select type and module filters
- PWA with offline support
- GitHub Pages deployment

---

## Completed TODO Items

### SHOWXATING Mode
- [x] Snap a picture mode for multiple cards
- [x] Belter theme styling
- [x] Start on dynamic mode, configurable default
- [x] Factory reset button ("Wipe the Core")
- [x] Diagnostics pack includes actual images
- [x] Empty slots hidden
- [x] Version on welcome screen
- [x] Text extraction + image match (v0.3.0)
- [x] Change "blow the airlock" to "wipe the core"
- [x] Limited depth logs with Belter-styled viewer
- [x] Version number next to beratna quote
- [x] Belter/HF4A favicon
- [x] Back-side card orientation fix

### First Launch
- [x] Scrollable welcome screen with Belta Creole

---

## Archived Documentation

The following documents are preserved in `docs/archive/`:

| Document | Description | Status |
|----------|-------------|--------|
| `2025-12-23-01-19-pipeline.md` | Original scan pipeline documentation | Superseded by v0.3.0 |
| `2025-12-23-pipeline-refactor.md` | OCR-primary pipeline design | Implemented in v0.3.0 |
| `PLAN-SHOWXATING.md` | Original implementation plan | Implemented |
| `SPEC-SHOWXATING-MODE.md` | Belter theme design spec | Implemented |
| `REVIEW.md` | Code review with data gaps | Partially addressed |
