#!/usr/bin/env node
/**
 * Merge all OCR partial results into a single comprehensive file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const PARTIAL_DIR = path.join(DATA_DIR, 'ocr-partial');
const OUTPUT_FILE = path.join(DATA_DIR, 'ocr-results.json');
const ORIGINAL_FILE = path.join(DATA_DIR, 'ocr-results-original.json');

async function mergePartials() {
  console.log('Merging OCR partial results...\n');

  const allCards = [];
  const fileStats = [];

  // First, backup original if it exists and hasn't been backed up
  if (fs.existsSync(OUTPUT_FILE) && !fs.existsSync(ORIGINAL_FILE)) {
    const original = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    fs.writeFileSync(ORIGINAL_FILE, JSON.stringify(original, null, 2));
    console.log(`Backed up original (${original.length} cards) to ocr-results-original.json`);

    // Add original cards
    allCards.push(...original);
    fileStats.push({ file: 'ocr-results-original.json', count: original.length });
  } else if (fs.existsSync(ORIGINAL_FILE)) {
    // Load from backup if already exists
    const original = JSON.parse(fs.readFileSync(ORIGINAL_FILE, 'utf-8'));
    allCards.push(...original);
    fileStats.push({ file: 'ocr-results-original.json', count: original.length });
  }

  // Get all partial files
  const partialFiles = fs.readdirSync(PARTIAL_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of partialFiles) {
    const filePath = path.join(PARTIAL_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    allCards.push(...data);
    fileStats.push({ file, count: data.length });
    console.log(`  ${file}: ${data.length} cards`);
  }

  // Deduplicate by filename (in case of overlaps)
  const seen = new Set();
  const uniqueCards = [];
  let duplicates = 0;

  for (const card of allCards) {
    if (!seen.has(card.filename)) {
      seen.add(card.filename);
      uniqueCards.push(card);
    } else {
      duplicates++;
    }
  }

  // Sort by filename for consistent ordering
  uniqueCards.sort((a, b) => a.filename.localeCompare(b.filename));

  // Write merged file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueCards, null, 2));

  console.log('\n--- Summary ---');
  console.log(`Files processed: ${fileStats.length}`);
  console.log(`Total cards before dedup: ${allCards.length}`);
  console.log(`Duplicates removed: ${duplicates}`);
  console.log(`Final unique cards: ${uniqueCards.length}`);
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);

  // Group by card type for breakdown
  const byType = {};
  for (const card of uniqueCards) {
    const type = card.parsedId.replace(/-\d+$/, '');
    byType[type] = (byType[type] || 0) + 1;
  }

  console.log('\n--- Cards by Type ---');
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`);
  }
}

mergePartials().catch(console.error);
