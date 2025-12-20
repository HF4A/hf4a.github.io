#!/usr/bin/env node
/**
 * Merge OCR results with parsed card data and relationships to create final cards.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');

async function mergeCards() {
  console.log('Merging final cards.json...\n');

  // Load all data sources
  const parsedCards = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'parsed-cards.json'), 'utf-8'));
  const relationships = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'relationships.json'), 'utf-8'));
  const ocrResults = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ocr-results.json'), 'utf-8'));

  console.log(`Parsed cards: ${parsedCards.length}`);
  console.log(`Relationships: ${relationships.length}`);
  console.log(`OCR results: ${ocrResults.length}`);

  // Create lookup maps
  const ocrByFilename = new Map();
  for (const ocr of ocrResults) {
    ocrByFilename.set(ocr.filename, ocr);
  }

  // Build relationship lookup by filename
  const relationshipsByFilename = new Map();
  for (const rel of relationships) {
    // Each relationship has sides (white, black, purple)
    if (rel.sides) {
      for (const [color, sideData] of Object.entries(rel.sides)) {
        if (sideData && sideData.filename) {
          relationshipsByFilename.set(sideData.filename, {
            cardId: rel.cardId,
            color,
            sides: rel.sides,
            upgradeChain: rel.upgradeChain
          });
        }
      }
    }
  }

  // Merge everything
  const finalCards = [];
  let ocrMatched = 0;
  let relMatched = 0;

  for (const card of parsedCards) {
    const merged = { ...card };

    // Add OCR data
    const ocr = ocrByFilename.get(card.filename);
    if (ocr && ocr.success && ocr.data) {
      merged.ocr = ocr.data;
      ocrMatched++;
    }

    // Add relationships
    const rel = relationshipsByFilename.get(card.filename);
    if (rel) {
      merged.cardGroupId = rel.cardId;
      merged.upgradeChain = rel.upgradeChain;

      // Add references to other sides
      const otherSides = {};
      for (const [color, sideData] of Object.entries(rel.sides)) {
        if (sideData && sideData.filename !== card.filename) {
          otherSides[color] = sideData.filename;
        }
      }
      if (Object.keys(otherSides).length > 0) {
        merged.relatedCards = otherSides;
      }
      relMatched++;
    }

    finalCards.push(merged);
  }

  // Sort by type then number
  finalCards.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.number !== b.number) return (a.number || 0) - (b.number || 0);
    return a.filename.localeCompare(b.filename);
  });

  // Write final output
  const outputPath = path.join(DATA_DIR, 'cards.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalCards, null, 2));

  console.log(`\n--- Merge Summary ---`);
  console.log(`Total cards: ${finalCards.length}`);
  console.log(`OCR data matched: ${ocrMatched} (${Math.round(ocrMatched/finalCards.length*100)}%)`);
  console.log(`Relationships matched: ${relMatched} (${Math.round(relMatched/finalCards.length*100)}%)`);
  console.log(`\nOutput: ${outputPath}`);

  // Validate
  console.log('\n--- Validation ---');
  const issues = [];

  for (const card of finalCards) {
    if (!card.ocr) {
      issues.push(`Missing OCR: ${card.filename}`);
    }
    if (!card.ocr?.name) {
      issues.push(`Missing name: ${card.filename}`);
    }
  }

  if (issues.length === 0) {
    console.log('✓ All cards have OCR data');
  } else {
    console.log(`Issues found: ${issues.length}`);
    issues.slice(0, 10).forEach(i => console.log(`  - ${i}`));
    if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`);
  }

  // Stats by type
  console.log('\n--- Cards by Type ---');
  const byType = {};
  for (const card of finalCards) {
    byType[card.type] = (byType[card.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`);
  }
}

mergeCards().catch(console.error);
