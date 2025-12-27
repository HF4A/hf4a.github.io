# Project Notes for Claude

## Deployment
- **Production URL**: https://hf4a.github.io/
- **GitHub Repo**: HF4A/hf4a.github.io
- **Base URL**: `/` (root of domain, NOT a subdirectory)
- **To deploy**: `git push origin main`

## Cloud API (Card Scanner)
- **Worker URL**: https://hf4a-card-scanner.github-f2b.workers.dev
- **Worker source**: `workers/` directory
- **Deploy worker**: `cd workers && wrangler deploy`
- **Model**: GPT-4.1-mini (OpenAI Vision)
- **Auth design**: See `docs/EVERGREEN-SPEC.md` → "Authentication: Invite Code Scheme"
- **Rollback to local OCR**: `git checkout 59dfff3` (v0.3.9)

## Versioning
- **Display version**: `src/version.ts` → `APP_VERSION` (this is what users see)
- **package.json version**: NOT displayed, only for npm
- **MUST update `src/version.ts`** when releasing - includes changelog comments
- Build hash is auto-generated from git commit

## Key Files
- `src/version.ts` - **APP VERSION LIVES HERE** - update for every release
- `vite.config.ts` - Build config, base URL must stay `/`
- `src/types/card.ts` - Card type definitions with spreadsheet metadata
- `scripts/import-spreadsheet.js` - Imports metadata from Google Sheets CSVs

## Scan System Architecture
- **Read first**: `docs/EVERGREEN-SPEC.md` → "Scan System Architecture"
- **Critical principle**: API results are SOLE source of truth
- OpenCV detection is ONLY a placeholder during API call - completely discarded when API returns

## Card Data
- 370+ cards from High Frontier 4 All board game
- Cards have base/promoted sides (not base/upgraded)
- Base side determined by `upgradeChain[0]` (varies: white, black, blue)
- Spreadsheet metadata: https://docs.google.com/spreadsheets/d/1DItaALEldFCHqnehydBHAWEeCI3wNpSu1pEdZ3DSHLM/
