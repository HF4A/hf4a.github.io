/**
 * Parse card filenames to extract metadata
 * Input: data/manifest.json
 * Output: data/parsed-cards.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ManifestEntry {
  filename: string;
  path: string;
  relativePath: string;
  size: number;
  checksum: string;
  directory: string;
}

type CardType =
  | 'thruster' | 'reactor' | 'generator' | 'radiator'
  | 'robonaut' | 'refinery' | 'colonist' | 'bernal'
  | 'freighter' | 'gw-thruster' | 'crew' | 'contract'
  | 'spaceborn' | 'exodus' | 'unknown';

type CardSide = 'white' | 'black' | 'purple' | 'blue' | 'yellow' | 'green' | 'red' | 'grey' | 'unknown';

interface ParsedCard {
  id: string;              // Unique ID: type-number (e.g., "thruster-01")
  type: CardType;
  typeRaw: string;         // Original type string from filename
  number: string;          // Card number within type
  side: CardSide;
  sideRaw: string;         // Original side string
  name: string;            // Card name from filename
  nameRaw: string;         // Original name before cleanup
  filename: string;
  relativePath: string;
  directory: string;
  size: number;
  checksum: string;
}

// Filename patterns
const STANDARD_PATTERN = /^(\w+?)(\d+)-(\w+)-(.+)\.png$/;
const CREW_PATTERN = /^Crew([A-Z])-(\w+)-(.+)\.png$/;
const CONTRACT_PATTERN = /^Contract(\d+)-(\w+)-(.+)\.png$/;

function normalizeType(raw: string): CardType {
  const lower = raw.toLowerCase();
  const typeMap: Record<string, CardType> = {
    'thruster': 'thruster',
    'reactor': 'reactor',
    'generator': 'generator',
    'radiator': 'radiator',
    'robonaut': 'robonaut',
    'refinery': 'refinery',
    'colonist': 'colonist',
    'bernal': 'bernal',
    'freighter': 'freighter',
    'gwthruster': 'gw-thruster',
    'crew': 'crew',
    'contract': 'contract',
    'spaceborn': 'spaceborn',
    'exodus': 'exodus',
  };
  return typeMap[lower] || 'unknown';
}

function normalizeSide(raw: string): CardSide {
  const lower = raw.toLowerCase();
  const sideMap: Record<string, CardSide> = {
    'white': 'white',
    'black': 'black',
    'purple': 'purple',
    'blue': 'blue',
    'yellow': 'yellow',
    'green': 'green',
    'red': 'red',
    'grey': 'grey',
    'gray': 'grey',
  };
  return sideMap[lower] || 'unknown';
}

function cleanName(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // CamelCase to spaces
    .replace(/-/g, ' ')                     // Dashes to spaces
    .replace(/\s+/g, ' ')                   // Multiple spaces to single
    .trim();
}

function parseFilename(entry: ManifestEntry): ParsedCard | null {
  const { filename, directory } = entry;

  // Skip non-card images (miscellany, race, etc.)
  if (directory.includes('miscellany') || directory.includes('race')) {
    return null;
  }

  // Try standard pattern: Type##-Side-Name.png
  let match = filename.match(STANDARD_PATTERN);
  if (match) {
    const [, typeRaw, number, sideRaw, nameRaw] = match;
    const type = normalizeType(typeRaw);
    const side = normalizeSide(sideRaw);

    return {
      id: `${type}-${number.padStart(2, '0')}`,
      type,
      typeRaw,
      number: number.padStart(2, '0'),
      side,
      sideRaw,
      name: cleanName(nameRaw),
      nameRaw,
      filename,
      relativePath: entry.relativePath,
      directory,
      size: entry.size,
      checksum: entry.checksum,
    };
  }

  // Try crew pattern: CrewX-Color-Name.png
  match = filename.match(CREW_PATTERN);
  if (match) {
    const [, letter, colorRaw, nameRaw] = match;
    const side = normalizeSide(colorRaw);

    return {
      id: `crew-${letter}`,
      type: 'crew',
      typeRaw: 'Crew',
      number: letter,
      side,
      sideRaw: colorRaw,
      name: cleanName(nameRaw),
      nameRaw,
      filename,
      relativePath: entry.relativePath,
      directory,
      size: entry.size,
      checksum: entry.checksum,
    };
  }

  // Try contract pattern: Contract##-Side-Name.png
  match = filename.match(CONTRACT_PATTERN);
  if (match) {
    const [, number, sideRaw, nameRaw] = match;
    const side = normalizeSide(sideRaw);

    // Extract ideology from directory
    const ideologyMatch = directory.match(/(\d)-(\w+)/);
    const ideology = ideologyMatch ? ideologyMatch[2].toLowerCase() : 'unknown';

    return {
      id: `contract-${ideology}-${number.padStart(2, '0')}`,
      type: 'contract',
      typeRaw: 'Contract',
      number: number.padStart(2, '0'),
      side,
      sideRaw,
      name: cleanName(nameRaw),
      nameRaw,
      filename,
      relativePath: entry.relativePath,
      directory,
      size: entry.size,
      checksum: entry.checksum,
    };
  }

  // Special case: Colonist94-SelfDesigningHeuristics.png (missing side)
  const noSideMatch = filename.match(/^(\w+?)(\d+)-(.+)\.png$/);
  if (noSideMatch && !filename.includes('-White-') && !filename.includes('-Black-') && !filename.includes('-Purple-')) {
    const [, typeRaw, number, nameRaw] = noSideMatch;
    const type = normalizeType(typeRaw);

    // Infer side from context or mark unknown
    return {
      id: `${type}-${number.padStart(2, '0')}`,
      type,
      typeRaw,
      number: number.padStart(2, '0'),
      side: 'unknown',
      sideRaw: 'unknown',
      name: cleanName(nameRaw),
      nameRaw,
      filename,
      relativePath: entry.relativePath,
      directory,
      size: entry.size,
      checksum: entry.checksum,
    };
  }

  console.warn(`Could not parse: ${filename}`);
  return null;
}

async function main() {
  const manifestPath = path.join(process.cwd(), 'data', 'manifest.json');

  console.log('Reading manifest...');
  const manifest: ManifestEntry[] = JSON.parse(
    await fs.readFile(manifestPath, 'utf-8')
  );

  console.log(`Parsing ${manifest.length} entries...`);

  const parsed: ParsedCard[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const entry of manifest) {
    const result = parseFilename(entry);
    if (result) {
      parsed.push(result);
    } else if (entry.directory.includes('miscellany') || entry.directory.includes('race')) {
      skipped.push(entry.filename);
    } else {
      failed.push(entry.filename);
    }
  }

  // Sort by type, then number, then side
  parsed.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.number !== b.number) return a.number.localeCompare(b.number);
    return a.side.localeCompare(b.side);
  });

  const outputPath = path.join(process.cwd(), 'data', 'parsed-cards.json');
  await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2));

  console.log(`\nParsed cards written to ${outputPath}`);
  console.log(`Successfully parsed: ${parsed.length}`);
  console.log(`Skipped (non-cards): ${skipped.length}`);
  console.log(`Failed to parse: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach(f => console.log(`  - ${f}`));
  }

  // Summary by type
  const byType = parsed.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nCards by type:');
  Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  // Summary by side
  const bySide = parsed.reduce((acc, p) => {
    acc[p.side] = (acc[p.side] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nCards by side:');
  Object.entries(bySide)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([side, count]) => {
      console.log(`  ${side}: ${count}`);
    });
}

main().catch(console.error);
