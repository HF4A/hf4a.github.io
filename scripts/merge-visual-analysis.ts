/**
 * Merge visual analysis results with existing card data
 *
 * Combines:
 * - Visual analysis JSON files from data/visual-analysis/
 * - Existing cards.json with spreadsheet enrichment
 *
 * Outputs:
 * - Updated public/data/cards.json
 * - Regenerated public/data/card-index.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const VISUAL_DIR = 'data/visual-analysis';
const EXISTING_CARDS = 'public/data/cards.json';
const OUTPUT_CARDS = 'public/data/cards.json';
const OUTPUT_INDEX = 'public/data/card-index.json';
const CARDS_DIR = 'public/cards/full';

interface VisualCard {
  filename: string;
  type: string;
  side: string;
  name: string;
  mass?: number;
  radHard?: number;
  thrust?: number;
  fuelConsumption?: string;
  therms?: number;
  spectralType?: string;
  ability?: string;
  imageDescription?: string;
  specialIcons?: Record<string, boolean>;
  supportRequirements?: Record<string, boolean>;
  [key: string]: unknown;
}

interface ExistingCard {
  id: string;
  type: string;
  filename: string;
  name: string;
  side?: string;
  ocr?: {
    stats?: Record<string, unknown>;
    ability?: string;
    spectralType?: string;
  };
  spreadsheet?: Record<string, unknown>;
  relatedCards?: Record<string, string>;
  [key: string]: unknown;
}

interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  type: string;
  name: string;
  searchableText: string;
  hash: string;
  hashBytes: number[];
}

/**
 * Compute dHash for an image
 */
async function computeDHash(imagePath: string): Promise<{ hash: string; hashBytes: number[] }> {
  const { data } = await sharp(imagePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const leftPixel = data[y * 9 + x];
      const rightPixel = data[y * 9 + x + 1];
      bits.push(leftPixel > rightPixel);
    }
  }

  const hashBytes: number[] = [];
  for (let i = 0; i < 64; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (bits[i + j]) {
        byte |= (1 << (7 - j));
      }
    }
    hashBytes.push(byte);
  }

  const hash = hashBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash, hashBytes };
}

/**
 * Normalize filename for matching
 */
function normalizeFilename(filename: string): string {
  return filename.toLowerCase().replace(/\.(webp|png|jpg)$/i, '');
}

/**
 * Generate card ID from filename
 */
function generateCardId(filename: string, type: string): string {
  // Extract number from filename patterns like "Thruster01-White-Name.webp"
  const match = filename.match(/(\d+)/);
  const number = match ? match[1].padStart(2, '0') : '00';
  return `${type}-${number}`;
}

async function main() {
  console.log('Loading visual analysis results...');

  // Load all visual analysis JSON files
  const visualCards: VisualCard[] = [];
  const files = readdirSync(VISUAL_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const content = readFileSync(join(VISUAL_DIR, file), 'utf-8');
    const cards = JSON.parse(content);
    if (Array.isArray(cards)) {
      visualCards.push(...cards);
    }
  }

  console.log(`Loaded ${visualCards.length} cards from visual analysis`);

  // Load existing cards for spreadsheet enrichment
  let existingCards: ExistingCard[] = [];
  try {
    existingCards = JSON.parse(readFileSync(EXISTING_CARDS, 'utf-8'));
    console.log(`Loaded ${existingCards.length} existing cards for enrichment`);
  } catch {
    console.log('No existing cards.json found, starting fresh');
  }

  // Build lookup map for existing cards by normalized filename
  const existingByFilename = new Map<string, ExistingCard>();
  for (const card of existingCards) {
    const normalized = normalizeFilename(card.filename);
    existingByFilename.set(normalized, card);
  }

  // Merge visual with existing
  const mergedCards: ExistingCard[] = [];

  for (const visual of visualCards) {
    const normalizedFilename = normalizeFilename(visual.filename);
    const existing = existingByFilename.get(normalizedFilename);

    const cardId = existing?.id || generateCardId(visual.filename, visual.type);

    const merged: ExistingCard = {
      id: cardId,
      type: visual.type,
      filename: visual.filename,
      name: visual.name,
      side: visual.side,

      // Preserve visual analysis data
      ocr: {
        stats: {
          mass: visual.mass,
          radHard: visual.radHard,
          thrust: visual.thrust,
          fuelConsumption: visual.fuelConsumption,
          therms: visual.therms,
          ...visual.specialIcons,
        },
        ability: visual.ability,
        spectralType: visual.spectralType,
        supportRequirements: visual.supportRequirements,
      },

      // Add visual description
      imageDescription: visual.imageDescription,

      // Preserve spreadsheet enrichment from existing
      spreadsheet: existing?.spreadsheet,
      relatedCards: existing?.relatedCards,
    };

    // Clean up undefined values
    if (merged.ocr?.stats) {
      merged.ocr.stats = Object.fromEntries(
        Object.entries(merged.ocr.stats).filter(([, v]) => v !== undefined && v !== null)
      );
    }

    mergedCards.push(merged);
  }

  console.log(`Merged ${mergedCards.length} cards`);

  // Write merged cards
  writeFileSync(OUTPUT_CARDS, JSON.stringify(mergedCards, null, 2));
  console.log(`Wrote ${OUTPUT_CARDS}`);

  // Generate card index with hashes
  console.log('Generating card index with hashes...');
  const cardIndex: CardIndexEntry[] = [];

  for (const card of mergedCards) {
    const imagePath = join(CARDS_DIR, card.filename);

    try {
      const { hash, hashBytes } = await computeDHash(imagePath);

      // Build searchable text from name + ability
      const searchableText = [
        card.name,
        card.ocr?.ability,
      ].filter(Boolean).join(' ');

      cardIndex.push({
        filename: card.filename,
        cardId: card.id,
        side: card.side || null,
        type: card.type,
        name: card.name,
        searchableText,
        hash,
        hashBytes,
      });
    } catch (err) {
      console.error(`Error processing ${card.filename}:`, err);
    }
  }

  // Sort by type, then filename
  cardIndex.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.filename.localeCompare(b.filename);
  });

  writeFileSync(OUTPUT_INDEX, JSON.stringify(cardIndex, null, 2));
  console.log(`Wrote ${OUTPUT_INDEX} with ${cardIndex.length} entries`);

  // Validation
  const emptyNames = cardIndex.filter(c => !c.name || c.name === '');
  const invalidTypes = cardIndex.filter(c => c.type.includes('.webp') || c.type.includes('http'));

  console.log('\n--- Validation ---');
  console.log(`Total cards: ${cardIndex.length}`);
  console.log(`Empty names: ${emptyNames.length}`);
  console.log(`Invalid types: ${invalidTypes.length}`);

  if (emptyNames.length > 0) {
    console.log('\nCards with empty names:');
    emptyNames.forEach(c => console.log(`  - ${c.filename}`));
  }

  if (invalidTypes.length > 0) {
    console.log('\nCards with invalid types:');
    invalidTypes.forEach(c => console.log(`  - ${c.filename}: ${c.type}`));
  }
}

main().catch(console.error);
