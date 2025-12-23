/**
 * Test script for card matching
 * Verifies that the dHash matching works correctly
 *
 * Run: npx tsx scripts/test-card-matching.ts
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const CARDS_DIR = 'public/cards/full';
const INDEX_FILE = 'public/data/card-index.json';

interface CardIndexEntry {
  filename: string;
  cardId: string;
  side: string | null;
  hash: string;
  hashBytes: number[];
}

/**
 * Compute dHash for an image (same algorithm as build script)
 */
async function computeDHash(imagePath: string): Promise<number[]> {
  const { data } = await sharp(imagePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits.push(data[y * 9 + x] > data[y * 9 + x + 1]);
    }
  }

  const hashBytes: number[] = [];
  for (let i = 0; i < 64; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (bits[i + j]) {
        byte |= 1 << (7 - j);
      }
    }
    hashBytes.push(byte);
  }

  return hashBytes;
}

/**
 * Hamming distance between two hashes
 */
function hammingDistance(hash1: number[], hash2: number[]): number {
  let distance = 0;
  for (let i = 0; i < 8; i++) {
    let xor = hash1[i] ^ hash2[i];
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Find best matches for a hash
 */
function findMatches(
  queryHash: number[],
  index: CardIndexEntry[],
  maxDistance = 15
): { entry: CardIndexEntry; distance: number }[] {
  const results: { entry: CardIndexEntry; distance: number }[] = [];

  for (const entry of index) {
    const distance = hammingDistance(queryHash, entry.hashBytes);
    if (distance <= maxDistance) {
      results.push({ entry, distance });
    }
  }

  results.sort((a, b) => a.distance - b.distance);
  return results;
}

async function main() {
  console.log('Loading card index...');
  const index: CardIndexEntry[] = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
  console.log(`Loaded ${index.length} cards\n`);

  // Test 1: Self-matching (should have distance 0)
  console.log('=== Test 1: Self-matching ===');
  const testCards = index.slice(0, 5);

  for (const card of testCards) {
    const imagePath = join(CARDS_DIR, card.filename);
    const computedHash = await computeDHash(imagePath);
    const distance = hammingDistance(computedHash, card.hashBytes);
    const status = distance === 0 ? '✓' : '✗';
    console.log(`${status} ${card.cardId}: self-match distance = ${distance}`);
  }

  // Test 2: Find similar cards (opposite sides should be similar)
  console.log('\n=== Test 2: Similar card pairs ===');
  const similarPairs: { card1: string; card2: string; distance: number }[] = [];

  for (let i = 0; i < Math.min(100, index.length); i++) {
    for (let j = i + 1; j < Math.min(100, index.length); j++) {
      const distance = hammingDistance(index[i].hashBytes, index[j].hashBytes);
      if (distance <= 10) {
        similarPairs.push({
          card1: index[i].filename,
          card2: index[j].filename,
          distance,
        });
      }
    }
  }

  similarPairs.sort((a, b) => a.distance - b.distance);
  console.log(`Found ${similarPairs.length} similar pairs (distance <= 10)`);
  for (const pair of similarPairs.slice(0, 10)) {
    console.log(`  ${pair.card1} ~ ${pair.card2} (distance: ${pair.distance})`);
  }

  // Test 3: Query matching
  console.log('\n=== Test 3: Query matching ===');
  const queryCard = index[50]; // Pick a card to query
  const imagePath = join(CARDS_DIR, queryCard.filename);
  const queryHash = await computeDHash(imagePath);

  console.log(`Query: ${queryCard.cardId} (${queryCard.filename})`);
  const matches = findMatches(queryHash, index, 15);
  console.log(`Found ${matches.length} matches within distance 15:`);

  for (const match of matches.slice(0, 5)) {
    const confidence = match.distance <= 8
      ? 1.0 - (match.distance / 8) * 0.3
      : 0.7 - ((match.distance - 8) / 7) * 0.7;
    console.log(`  ${match.entry.cardId}: distance=${match.distance}, confidence=${confidence.toFixed(2)}`);
  }

  console.log('\n✓ All tests completed!');
}

main().catch(console.error);
