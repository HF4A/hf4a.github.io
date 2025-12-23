/**
 * Generate card index with dHash perceptual hashes for card identification
 *
 * dHash algorithm:
 * 1. Resize image to 9x8 grayscale (to get 8x8 gradient comparisons)
 * 2. For each pixel, compare with neighbor to the right
 * 3. Create 64-bit hash based on gradient direction
 *
 * Run: npm run generate-card-index
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const CARDS_DIR = 'public/cards/full';
const OUTPUT_FILE = 'public/data/card-index.json';
const CARDS_JSON = 'public/data/cards.json';

interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  hash: string;
  // Also store the hash as array of 8 bytes for faster comparison
  hashBytes: number[];
}

interface CardData {
  id: string;
  filename: string;
  side?: string;
  type: string;
  ocr?: {
    name?: string;
  };
}

/**
 * Compute dHash for an image buffer
 * Returns 16-character hex string (64 bits)
 */
async function computeDHash(imagePath: string): Promise<{ hash: string; hashBytes: number[] }> {
  // Resize to 9x8 grayscale
  const { data } = await sharp(imagePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute difference hash
  // Compare each pixel with its right neighbor
  const bits: boolean[] = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const leftPixel = data[y * 9 + x];
      const rightPixel = data[y * 9 + x + 1];
      bits.push(leftPixel > rightPixel);
    }
  }

  // Convert bits to bytes
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

  // Convert to hex string
  const hash = hashBytes.map(b => b.toString(16).padStart(2, '0')).join('');

  return { hash, hashBytes };
}

/**
 * Calculate Hamming distance between two hashes
 */
function hammingDistance(hash1: number[], hash2: number[]): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    let xor = hash1[i] ^ hash2[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

async function main() {
  console.log('Generating card index with dHash values...\n');

  // Load cards.json to get card metadata
  const cardsData: CardData[] = JSON.parse(readFileSync(CARDS_JSON, 'utf-8'));

  // Create a map from filename to card data
  const cardsByFilename = new Map<string, CardData>();
  for (const card of cardsData) {
    // Normalize filename to match webp files
    const webpFilename = card.filename.replace(/\.(png|jpg)$/i, '.webp');
    cardsByFilename.set(webpFilename, card);
  }

  // Get all webp images
  const imageFiles = readdirSync(CARDS_DIR)
    .filter(f => f.endsWith('.webp'))
    .sort();

  console.log(`Found ${imageFiles.length} card images`);

  const index: CardIndexEntry[] = [];
  let processed = 0;
  let errors = 0;

  for (const filename of imageFiles) {
    const imagePath = join(CARDS_DIR, filename);

    try {
      const { hash, hashBytes } = await computeDHash(imagePath);

      // Find card data
      const cardData = cardsByFilename.get(filename);

      index.push({
        filename,
        cardId: cardData?.id || filename.replace('.webp', ''),
        side: cardData?.side || null,
        hash,
        hashBytes,
      });

      processed++;
      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${imageFiles.length}`);
      }
    } catch (err) {
      console.error(`  Error processing ${filename}:`, err);
      errors++;
    }
  }

  // Check for duplicate hashes (which might indicate issues)
  const hashCounts = new Map<string, string[]>();
  for (const entry of index) {
    const files = hashCounts.get(entry.hash) || [];
    files.push(entry.filename);
    hashCounts.set(entry.hash, files);
  }

  const duplicates = Array.from(hashCounts.entries())
    .filter(([, files]) => files.length > 1);

  if (duplicates.length > 0) {
    console.log(`\nWarning: ${duplicates.length} duplicate hashes found:`);
    for (const [hash, files] of duplicates.slice(0, 5)) {
      console.log(`  ${hash}: ${files.join(', ')}`);
    }
    if (duplicates.length > 5) {
      console.log(`  ... and ${duplicates.length - 5} more`);
    }
  }

  // Write the index
  writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));

  console.log(`\nComplete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Output: ${OUTPUT_FILE}`);

  // Test: find some similar pairs
  console.log(`\nSample similarity check (looking for near-matches):`);
  const sampleSize = Math.min(10, index.length);
  for (let i = 0; i < sampleSize; i++) {
    let bestMatch = -1;
    let bestDistance = 65;

    for (let j = 0; j < index.length; j++) {
      if (i === j) continue;
      const dist = hammingDistance(index[i].hashBytes, index[j].hashBytes);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = j;
      }
    }

    if (bestDistance < 15) {
      console.log(`  ${index[i].filename} ~ ${index[bestMatch].filename} (distance: ${bestDistance})`);
    }
  }
}

main().catch(console.error);
