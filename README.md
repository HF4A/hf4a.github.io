# HF4A Card Explorer

A Progressive Web App for browsing and searching **High Frontier 4 All** game cards.

## Features

- **370 cards** with OCR-extracted metadata
- **Fuzzy search** powered by Fuse.js
- **Multi-filter** by card type, spectral type, and side
- **Card flip animation** to view both sides
- **PWA** with offline support
- **Responsive** grid layout (2-6 columns)
- **Keyboard navigation** (Esc to close, Space to flip)

## Tech Stack

- React 18 + TypeScript
- Vite + vite-plugin-pwa
- TailwindCSS
- Zustand (state management)
- Framer Motion (animations)
- Fuse.js (fuzzy search)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Data Pipeline

The card data was extracted from game images using:

```bash
# Generate image manifest
npm run generate-manifest

# Parse filenames for metadata
npm run parse-filenames

# Build card relationships
npm run build-relationships

# Optimize images to WebP
npm run optimize-images
```

OCR was performed using Claude's vision capabilities to extract card names, descriptions, stats, and spectral types.

## Project Structure

```
src/
├── components/
│   ├── CardGrid.tsx      # Responsive card grid
│   ├── CardThumbnail.tsx # Lazy-loaded card preview
│   ├── CardDetail.tsx    # Modal with flip animation
│   ├── FilterBar.tsx     # Multi-select filters
│   ├── SearchInput.tsx   # Debounced search
│   └── Layout.tsx        # App shell
├── store/
│   ├── cardStore.ts      # Card data state
│   └── filterStore.ts    # Filter state with persistence
├── hooks/
│   └── useCards.ts       # Card loading and filtering
├── types/
│   └── card.ts           # TypeScript interfaces
└── App.tsx               # Routes and layout

public/
├── cards/
│   ├── full/             # Full-size WebP images
│   └── thumbs/           # Thumbnail WebP images
└── data/
    └── cards.json        # Card metadata
```

## License

Card images are from [High Frontier 4 All](https://boardgamegeek.com/boardgame/281655/high-frontier-4-all) by ION Game Design.

This project is for personal/educational use only.
