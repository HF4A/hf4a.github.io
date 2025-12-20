# Project Notes for Claude

## Deployment
- **Production URL**: https://hf4a.github.io/
- **Production remote**: `hf4a` → HF4A/hf4a.github.io.git (PUSH HERE FOR DEPLOYMENT)
- **Backup remote**: `origin` → oneross/hf4a-cards.git
- **Base URL**: `/` (root of domain, NOT a subdirectory)
- **To deploy**: `git push hf4a main`

## Key Files
- `vite.config.ts` - Build config, base URL must stay `/`
- `src/types/card.ts` - Card type definitions with spreadsheet metadata
- `scripts/import-spreadsheet.js` - Imports metadata from Google Sheets CSVs

## Card Data
- 370+ cards from High Frontier 4 All board game
- Cards have base/promoted sides (not base/upgraded)
- Base side determined by `upgradeChain[0]` (varies: white, black, blue)
- Spreadsheet metadata: https://docs.google.com/spreadsheets/d/1DItaALEldFCHqnehydBHAWEeCI3wNpSu1pEdZ3DSHLM/
