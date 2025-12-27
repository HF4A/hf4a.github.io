// App version - update this when releasing new versions
// Format: MAJOR.MINOR.PATCH
// 0.1.x - Initial catalog-only version
// 0.2.x - SHOWXATING scanner mode
//   0.2.1 - Expanded diagnostics with debug info
//   0.2.2 - Fix card identification: load cards at startup, perspective warp, stricter threshold
//   0.2.3 - Version on welcome screen, right-align slots, threshold tuning (18)
//   0.2.4 - Fix slot order (S1 right), raise threshold to 22
//   0.2.5 - Remove 34 orphan cards, module filter, fix backwards flip
//   0.2.6 - Fix image loading (.webp), FRONT/BACK labels, long-press modal
//   0.2.7 - Fix gestures (remove long-press), add swipe card detail, individual card type filters, logs system
//   0.2.8 - Type-first card matching, fix back side image orientation, fix WIPE IT button text
//   0.2.9 - Add Tesseract.js OCR, type filter dropdown in correction modal, tap-to-ID fix
//   0.2.10 - Region-targeted OCR (title area only), card template definitions, timing in logs
//   0.2.11 - Fix type filter: show ALL cards of type, expand OCR region, add confidence logging
//   0.2.12 - Fix front side image after correction (.webp), scale up OCR region for better accuracy
//   0.2.13 - OCR type region (top of card) instead of title (bottom) - type labels are more readable
//   0.2.14 - OCR preprocessing: binarize image, scale to 200px, expand type region
//   0.2.15 - Switch to OCR.space API (free tier) - much better accuracy than Tesseract
//   0.2.16 - Remove binarization (was destroying text), add debug logging, use Engine 1
// 0.3.x - Pipeline refactor: warp-then-detect, OCR-primary matching
//   0.3.0 - Full pipeline refactor: warp entire frame, OCR-primary, text matching, diagnostics
//   0.3.1 - Switch from OCR.space API to local PP-OCRv4 via ONNX (offline capable)
//   0.3.2 - Regenerate card data via visual analysis (fix 34 cards with empty names/invalid types)
//   0.3.3 - Fix OCR engine: force single-threaded WASM for GitHub Pages compatibility
//   0.3.4 - Improve text matching: clean OCR garbage, try last-N-words, tighter title region
//   0.3.5 - Progressive matching: all word combos, type-first search, stop words, better logging
//   0.3.6 - Revert OCR engine to static imports (dynamic import broke it)
//   0.3.8 - Multi-card OCR fixes: upscale small cards, expand title region, reject weak hash matches
//   0.3.9 - Reject type-only matches, filter type words from candidates, match quality tracking
// 0.4.x - Cloud-based scanning via OpenAI Vision API
//   0.4.0 - Cloud scanning via Cloudflare Worker + OpenAI Vision API, invite code auth, immediate OpenCV feedback
//   0.4.1 - Fix card flip functionality
//   0.4.2 - Remove redundant OCR in correction flow
//   0.4.3 - Fix off-by-one bbox mapping (don't sort cloud results)
//   0.4.4 - Grid-based merge algorithm for bbox matching
//   0.4.5 - Add scan object count to UI
// 0.5.x - Grid-based scan results view
//   0.5.0 - Replace photo+overlay with NxM grid of card images
//   0.5.1 - Fix grid dimensions: pass API gridRows/gridCols through data flow
//   0.5.2 - Add detailed logging for card name matching diagnostics
//   0.5.3 - Correction modal: pre-select type, show fronts only; diagnostics include grid info
//   0.5.4 - Fix worker gridRows/gridCols parsing, add grid dimension logging
//   0.5.5 - Fix Mo/Li Heat Pipe relatedCards (was missing reverse side reference)
//   0.5.6 - Fix card data: remove 24 duplicates, add 6 missing relatedCards
export const APP_VERSION = '0.5.6';
export const BUILD_DATE = '2025-12-26';

// Build hash injected at build time by Vite (see vite.config.ts)
// This provides a unique identifier for each build to verify deployments
declare const __BUILD_HASH__: string;
declare const __BUILD_TIME__: string;
export const BUILD_HASH = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'DEV';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
