/**
 * Build card relationships (white↔black↔purple sides)
 * Input: data/parsed-cards.json
 * Output: data/relationships.json, data/cards-with-relationships.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ParsedCard {
  id: string;
  type: string;
  typeRaw: string;
  number: string;
  side: string;
  sideRaw: string;
  name: string;
  nameRaw: string;
  filename: string;
  relativePath: string;
  directory: string;
  size: number;
  checksum: string;
}

interface CardRelationship {
  cardId: string;           // Base card ID (type-number)
  type: string;
  number: string;
  sides: {
    white?: SideInfo;
    black?: SideInfo;
    purple?: SideInfo;
    blue?: SideInfo;
    yellow?: SideInfo;
  };
  upgradeChain: string[];   // e.g., ['white', 'black'] or ['white', 'black', 'purple']
}

interface SideInfo {
  name: string;
  filename: string;
  relativePath: string;
  checksum: string;
}

// Define upgrade chains for each card type
const UPGRADE_CHAINS: Record<string, string[]> = {
  'thruster': ['white', 'black'],
  'reactor': ['white', 'black'],
  'generator': ['white', 'black'],
  'radiator': ['white', 'black'],
  'robonaut': ['white', 'black'],
  'refinery': ['white', 'black'],
  'colonist': ['white', 'black', 'purple'],  // Some skip black
  'spaceborn': ['white', 'purple'],
  'bernal': ['white', 'purple'],
  'freighter': ['black', 'purple'],
  'gw-thruster': ['black', 'purple'],
  'crew': [],  // Single-sided, color is faction
  'contract': ['blue', 'yellow'],  // Two independent sides
};

async function main() {
  const parsedPath = path.join(process.cwd(), 'data', 'parsed-cards.json');

  console.log('Reading parsed cards...');
  const parsed: ParsedCard[] = JSON.parse(
    await fs.readFile(parsedPath, 'utf-8')
  );

  // Group cards by base ID (type + number, without ideology for contracts)
  const groups = new Map<string, ParsedCard[]>();

  for (const card of parsed) {
    // For contracts, group by ideology + number
    let groupKey = card.id;
    if (card.type === 'contract') {
      // Already includes ideology in ID
      groupKey = card.id;
    } else {
      // Standard grouping by type-number
      groupKey = `${card.type}-${card.number}`;
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(card);
  }

  console.log(`Found ${groups.size} unique cards (across all sides)`);

  const relationships: CardRelationship[] = [];
  const warnings: string[] = [];

  for (const [cardId, cards] of groups) {
    const type = cards[0].type;
    const number = cards[0].number;
    const expectedChain = UPGRADE_CHAINS[type] || [];

    const rel: CardRelationship = {
      cardId,
      type,
      number,
      sides: {},
      upgradeChain: [],
    };

    // Populate sides
    for (const card of cards) {
      const side = card.side as keyof typeof rel.sides;
      if (side && side !== 'unknown') {
        rel.sides[side] = {
          name: card.name,
          filename: card.filename,
          relativePath: card.relativePath,
          checksum: card.checksum,
        };
      }
    }

    // Determine actual upgrade chain based on available sides
    const availableSides = Object.keys(rel.sides);
    rel.upgradeChain = expectedChain.filter(s => availableSides.includes(s));

    // Validate: check for missing expected sides
    if (type !== 'crew') {
      const missingSides = expectedChain.filter(s => !availableSides.includes(s));
      if (missingSides.length > 0 && availableSides.length > 0) {
        // Some cards legitimately skip sides (colonists white→purple)
        const isColonistSkipBlack = type === 'colonist' &&
          availableSides.includes('white') &&
          availableSides.includes('purple') &&
          !availableSides.includes('black');

        if (!isColonistSkipBlack) {
          warnings.push(`${cardId}: missing sides [${missingSides.join(', ')}], has [${availableSides.join(', ')}]`);
        }
      }
    }

    relationships.push(rel);
  }

  // Sort relationships
  relationships.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.number.localeCompare(b.number);
  });

  // Write relationships
  const relPath = path.join(process.cwd(), 'data', 'relationships.json');
  await fs.writeFile(relPath, JSON.stringify(relationships, null, 2));

  console.log(`\nRelationships written to ${relPath}`);
  console.log(`Total card groups: ${relationships.length}`);

  // Summary
  const multiSided = relationships.filter(r => Object.keys(r.sides).length > 1).length;
  const singleSided = relationships.filter(r => Object.keys(r.sides).length === 1).length;

  console.log(`\nMulti-sided cards: ${multiSided}`);
  console.log(`Single-sided cards: ${singleSided}`);

  // By type
  const byType = relationships.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nCard groups by type:');
  Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  // Warnings
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.slice(0, 10).forEach(w => console.log(`  ${w}`));
    if (warnings.length > 10) {
      console.log(`  ... and ${warnings.length - 10} more`);
    }
  }

  // Also create a merged structure for easier consumption
  const cardsWithRelationships = relationships.map(rel => ({
    ...rel,
    images: rel.sides,
  }));

  const mergedPath = path.join(process.cwd(), 'data', 'cards-with-relationships.json');
  await fs.writeFile(mergedPath, JSON.stringify(cardsWithRelationships, null, 2));
  console.log(`\nMerged data written to ${mergedPath}`);
}

main().catch(console.error);
