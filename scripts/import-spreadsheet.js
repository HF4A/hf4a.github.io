#!/usr/bin/env node
/**
 * Import card metadata from the HF4A Google Spreadsheet
 *
 * Usage:
 *   1. Export each sheet as CSV from Google Sheets
 *   2. Place them in data/spreadsheet/ directory
 *   3. Run: node scripts/import-spreadsheet.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const spreadsheetDir = path.join(dataDir, 'spreadsheet');
// Read from existing cards data, write to public folder
const cardsInputPath = path.join(dataDir, 'cards.json');
const cardsOutputPath = path.join(__dirname, '..', 'public', 'data', 'cards.json');

// Name aliases: spreadsheet name -> OCR name (for cases where OCR differs from official names)
const NAME_ALIASES = {
  'monoatomic plug nozzle': 'monatomic plug nozzle',  // Missing 'o' in OCR
  'levitated dipole 6li-h fusion': 'levitated dipole li-h fusion',  // 6Li vs Li
  'spheromak 3he-d magnetic fusion': 'spheromak he-d magnetic fusion',  // 3He vs He
  'colliding frc 3he-d fusion': 'colliding frc he-d fusion',  // 3He vs He
  'daedalus 3he-d inertial fusion': 'daedalus he-d inertial fusion',  // 3He vs He
  'd-d fusion inertial': 'd-d inertial fusion',  // Word order
  'jtec h2 thermoelectric': 'jtech h2 thermoelectric',  // JTEC vs JTECH
};

// Sheet configurations: filename -> card type and column mappings
const SHEET_CONFIGS = {
  'thrusters.csv': {
    cardType: 'thruster',
    columns: {
      'Name': 'name',
      'Spectral Type': 'spectralType',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Thrust': 'thrust',
      'Fuel Consumption': 'fuelConsumption',
      'Fuel Type': 'fuelType',
      'Bonus Pivots': 'bonusPivots',
      'Afterburn': 'afterburn',
      'Push': 'push',
      'Solar': 'solar',
      '⟛ Generator': 'generatorPush',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      '💣 Reactor': 'reactorAntimatter',
      'Therms': 'therms',
      'Ability': 'ability',
    },
  },
  'gw-thrusters.csv': {
    cardType: 'gw-thruster',
    columns: {
      'Name': 'name',
      'Type': 'cardSubtype',  // e.g., "GW Thruster" vs "GW Thruster Fleet"
      'Spectral Type': 'spectralType',
      'Promotion Colony': 'promotionColony',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Thrust': 'thrust',
      'Fuel Consumption': 'fuelConsumption',
      'Afterburn': 'afterburn',
      '⟛ Generator': 'generatorPush',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      'Any Reactor': 'reactorAny',
      'Therms': 'therms',
      'Future': 'future',
    },
  },
  'robonauts.csv': {
    cardType: 'robonaut',
    columns: {
      'Name': 'name',
      'Spectral Type': 'spectralType',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Thrust': 'thrust',
      'Fuel Consumption': 'fuelConsumption',
      'Fuel Type': 'fuelType',
      'Afterburn': 'afterburn',
      'Push': 'push',
      'Solar': 'solar',
      'ISRU': 'isru',
      'Missile': 'missile',
      'Raygun': 'raygun',
      'Buggy': 'buggy',
      '⟛ Generator': 'generatorPush',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      '💣 Reactor': 'reactorAntimatter',
      'Therms': 'therms',
      'Ability': 'ability',
    },
  },
  'refineries.csv': {
    cardType: 'refinery',
    columns: {
      'Name': 'name',
      'Spectral Type': 'spectralType',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Air Eater': 'airEater',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      '💣 Reactor': 'reactorAntimatter',
      'Ability': 'ability',
    },
  },
  'reactors.csv': {
    cardType: 'reactor',
    columns: {
      'Name': 'name',
      'Spectral Type': 'spectralType',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'X': 'isReactorX',
      '∿': 'isReactorWave',
      '💣': 'isReactorBomb',
      'Thrust Modifier': 'thrustModifier',
      'Fuel Consumption Modifier': 'fuelConsumptionModifier',
      'Air Eater': 'airEater',
      '⟛ Generator': 'generatorPush',
      'X Reactor': 'reactorFission',
      'Therms': 'therms',
      'Ability': 'ability',
    },
  },
  'radiators.csv': {
    cardType: 'radiator',
    // Use column indices for radiators since headers repeat (Light Side vs Heavy Side)
    useColumnIndices: true,
    columnIndices: {
      0: 'name',
      1: 'spectralType',
      2: 'lightSideMass',
      3: 'lightSideRadHard',
      4: 'lightSideTherms',
      5: 'heavySideMass',
      6: 'heavySideRadHard',
      7: 'heavySideTherms',
      8: 'generatorElectric',
      9: 'ability',
    },
    columns: {}, // Not used when useColumnIndices is true
  },
  'generators.csv': {
    cardType: 'generator',
    columns: {
      'Name': 'name',
      'Spectral Type': 'spectralType',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      '⟛': 'isPushGenerator',
      'e': 'isElectricGenerator',
      'Thrust Modifier': 'thrustModifier',
      'Fuel Consumption Modifier': 'fuelConsumptionModifier',
      'Air Eater': 'airEater',
      'Solar': 'solar',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      '💣 Reactor': 'reactorAntimatter',
      'Therms': 'therms',
      'Ability': 'ability',
    },
  },
  'freighters.csv': {
    cardType: 'freighter',
    columns: {
      'Name': 'name',
      'Type': 'cardSubtype',  // e.g., "Freighter" vs "Freighter Fleet"
      'Spectral Type': 'spectralType',
      'Promotion Colony': 'promotionColony',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Load-Limit': 'loadLimit',
      'Factory Loading Only': 'factoryLoadingOnly',
      'Bonus Pivots': 'bonusPivots',
      '⟛ Generator': 'generatorPush',
      'e Generator': 'generatorElectric',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      'Ability': 'ability',
      'Future': 'future',
    },
  },
  'bernals.csv': {
    cardType: 'bernal',
    columns: {
      'Name': 'name',
      'Promotion Colony': 'promotionColony',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Thrust': 'thrust',
      'Fuel Consumption': 'fuelConsumption',
      'Powersat': 'powersat',
      'Generator': 'hasGenerator',
      'Therms': 'therms',
      'Ability': 'ability',
    },
  },
  'colonists.csv': {
    cardType: 'colonist',
    columns: {
      'Name': 'name',
      'Type': 'colonistType',
      'Specialty': 'specialty',
      'Spectral Type': 'spectralType',
      'Promotion Colony': 'promotionColony',
      'Ideology': 'ideology',
      'Mass': 'mass',
      'Rad-Hard': 'radHard',
      'Thrust': 'thrust',
      'Fuel Consumption': 'fuelConsumption',
      'Fuel Type': 'fuelType',
      'Afterburn': 'afterburn',
      'Push': 'push',
      'Solar': 'solar',
      'Air Eater': 'airEater',
      'Bonus Pivots': 'bonusPivots',
      'ISRU': 'isru',
      'Missile': 'missile',
      'Raygun': 'raygun',
      'Buggy': 'buggy',
      'X Reactor': 'reactorFission',
      '∿ Reactor': 'reactorFusion',
      '💣 Reactor': 'reactorAntimatter',
      'Ability': 'ability',
      'Future': 'future',
    },
  },
};

// Simple CSV parser (handles quoted fields with commas and multi-line values)
function parseCSV(content) {
  // First, normalize the content - handle quoted multi-line fields
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      if (current.trim() || fields.length > 0) {
        fields.push(current);
        current = '';
      }
      // Mark row boundary
      fields.push('\n');
      // Skip \r\n as single newline
      if (char === '\r' && content[i + 1] === '\n') i++;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else if (inQuotes && (char === '\n' || char === '\r')) {
      // Replace newlines in quoted strings with space
      current += ' ';
      if (char === '\r' && content[i + 1] === '\n') i++;
    } else {
      current += char;
    }
  }
  if (current) fields.push(current);

  // Now split into rows
  const rows = [];
  let currentRow = [];
  for (const field of fields) {
    if (field === '\n') {
      if (currentRow.length > 0) {
        rows.push(currentRow.map(f => f.trim()));
      }
      currentRow = [];
    } else {
      currentRow.push(field);
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow.map(f => f.trim()));
  }

  if (rows.length < 2) return [];

  // Skip the first row if it looks like a category header (mostly empty)
  let headerRowIndex = 0;
  const firstRowNonEmpty = rows[0].filter(f => f).length;
  const secondRowNonEmpty = rows[1] ? rows[1].filter(f => f).length : 0;
  if (firstRowNonEmpty < secondRowNonEmpty / 2) {
    headerRowIndex = 1;
  }

  const headers = rows[headerRowIndex];
  const result = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const rowData = rows[i];
    if (rowData.every(f => !f)) continue; // Skip empty rows

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        row[headers[j]] = rowData[j] || '';
      }
    }
    // Store raw values for index-based access (needed for sheets with duplicate headers like radiators)
    row._rawValues = rowData;
    result.push(row);
  }

  return result;
}

// Normalize name for matching
function normalizeName(name, applyAliases = false) {
  if (!name) return '';
  let normalized = name.toLowerCase().trim();

  // Apply name aliases if requested (for spreadsheet names)
  if (applyAliases && NAME_ALIASES[normalized]) {
    normalized = NAME_ALIASES[normalized];
  }

  return normalized.replace(/[^a-z0-9]/g, '');
}

// Parse boolean values
function parseBoolean(value) {
  if (!value) return undefined;
  const v = value.toString().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

// Parse numeric values
function parseNumber(value) {
  if (!value || value === '' || value === '—' || value === '-') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

// Parse a spreadsheet row into card data
function parseRow(row, config) {
  const data = {
    stats: {},
    supportRequirements: {},
    spreadsheet: {},
  };

  // Determine which column mapping to use
  const columnEntries = config.useColumnIndices
    ? Object.entries(config.columnIndices).map(([idx, fieldName]) => [parseInt(idx), fieldName])
    : Object.entries(config.columns);

  for (const [csvCol, fieldName] of columnEntries) {
    // Get value either by index (for radiators) or by header name
    const value = config.useColumnIndices
      ? (row._rawValues ? row._rawValues[csvCol] : undefined)
      : row[csvCol];
    if (!value || value === '' || value === '—' || value === '-') continue;

    // Categorize fields
    const statsFields = [
      'mass', 'radHard', 'thrust', 'fuelConsumption', 'fuelType', 'bonusPivots',
      'afterburn', 'push', 'therms', 'thrustModifier', 'fuelConsumptionModifier',
      'isru', 'missile', 'raygun', 'buggy', 'loadLimit', 'factoryLoadingOnly',
      'powersat', 'hasGenerator', 'airEater', 'solar',
      'lightSideMass', 'lightSideRadHard', 'lightSideTherms',
      'heavySideMass', 'heavySideRadHard', 'heavySideTherms',
      'isPushGenerator', 'isElectricGenerator',
      'isReactorX', 'isReactorWave', 'isReactorBomb',
    ];
    const supportFields = [
      'generatorPush', 'generatorElectric', 'reactorFission',
      'reactorFusion', 'reactorAntimatter', 'reactorAny',
    ];
    const spreadsheetFields = [
      'promotionColony', 'future', 'colonistType', 'specialty', 'ideology', 'cardSubtype',
    ];

    if (fieldName === 'name') {
      data.name = value;
    } else if (fieldName === 'spectralType') {
      data.spectralType = value;
    } else if (fieldName === 'ability') {
      data.ability = value;
    } else if (statsFields.includes(fieldName)) {
      // Boolean stats
      if (['push', 'missile', 'raygun', 'buggy', 'factoryLoadingOnly',
           'powersat', 'hasGenerator', 'airEater', 'solar',
           'isPushGenerator', 'isElectricGenerator',
           'isReactorX', 'isReactorWave', 'isReactorBomb'].includes(fieldName)) {
        const boolVal = parseBoolean(value);
        if (boolVal !== undefined) data.stats[fieldName] = boolVal;
      }
      // String stats (fuel consumption is often a fraction like "1/2")
      else if (['fuelConsumption', 'fuelConsumptionModifier', 'fuelType'].includes(fieldName)) {
        data.stats[fieldName] = value;
      }
      // Numeric stats
      else {
        const numVal = parseNumber(value);
        if (numVal !== undefined) data.stats[fieldName] = numVal;
      }
    } else if (supportFields.includes(fieldName)) {
      const boolVal = parseBoolean(value);
      if (boolVal !== undefined) data.supportRequirements[fieldName] = boolVal;
    } else if (spreadsheetFields.includes(fieldName)) {
      data.spreadsheet[fieldName] = value;
    }
  }

  // Derive generator type
  if (data.stats.isPushGenerator) {
    data.stats.generatorType = 'push';
    delete data.stats.isPushGenerator;
  }
  if (data.stats.isElectricGenerator) {
    data.stats.generatorType = 'electric';
    delete data.stats.isElectricGenerator;
  }

  // Derive reactor type
  if (data.stats.isReactorX) {
    data.stats.reactorType = 'X';
    delete data.stats.isReactorX;
  }
  if (data.stats.isReactorWave) {
    data.stats.reactorType = 'wave';
    delete data.stats.isReactorWave;
  }
  if (data.stats.isReactorBomb) {
    data.stats.reactorType = 'bomb';
    delete data.stats.isReactorBomb;
  }

  return data;
}

// Main function
async function main() {
  // Check if spreadsheet directory exists
  if (!fs.existsSync(spreadsheetDir)) {
    console.log(`Creating spreadsheet directory: ${spreadsheetDir}`);
    fs.mkdirSync(spreadsheetDir, { recursive: true });
    console.log('\nPlease download CSV files from the Google Spreadsheet:');
    console.log('https://docs.google.com/spreadsheets/d/1DItaALEldFCHqnehydBHAWEeCI3wNpSu1pEdZ3DSHLM/');
    console.log('\nFor each tab, use File -> Download -> Comma Separated Values (.csv)');
    console.log('Save them to:', spreadsheetDir);
    console.log('\nExpected files:');
    for (const filename of Object.keys(SHEET_CONFIGS)) {
      console.log(`  - ${filename}`);
    }
    return;
  }

  // Load cards from data
  console.log('Loading cards...');
  const cards = JSON.parse(fs.readFileSync(cardsInputPath, 'utf-8'));
  console.log(`Loaded ${cards.length} cards`);

  // Fix exodus cards that were typed as 'unknown'
  let exodusFixed = 0;
  for (const card of cards) {
    if (card.type === 'unknown' && card.filename.toLowerCase().startsWith('exodus')) {
      card.type = 'exodus';
      exodusFixed++;
    }
  }
  if (exodusFixed > 0) {
    console.log(`Fixed ${exodusFixed} Exodus cards from 'unknown' to 'exodus'`);
  }

  // Build name lookup map
  const cardsByName = new Map();
  for (const card of cards) {
    const normalizedName = normalizeName(card.ocr?.name || card.name);
    if (normalizedName) {
      if (!cardsByName.has(normalizedName)) {
        cardsByName.set(normalizedName, []);
      }
      cardsByName.get(normalizedName).push(card);
    }
  }

  // Process each spreadsheet
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const [filename, config] of Object.entries(SHEET_CONFIGS)) {
    const csvPath = path.join(spreadsheetDir, filename);

    if (!fs.existsSync(csvPath)) {
      console.log(`\nSkipping ${filename} (not found)`);
      continue;
    }

    console.log(`\nProcessing ${filename}...`);
    const content = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(content);
    console.log(`  Found ${rows.length} rows`);

    let matched = 0;
    let unmatched = 0;

    for (const row of rows) {
      const data = parseRow(row, config);
      if (!data.name) continue;

      // Apply aliases when normalizing spreadsheet names to match OCR names
      const normalizedName = normalizeName(data.name, true);
      const matchingCards = cardsByName.get(normalizedName) || [];

      if (matchingCards.length === 0) {
        unmatched++;
        // Try fuzzy match
        let found = false;
        for (const [key, cards] of cardsByName) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) {
            for (const card of cards) {
              if (card.type === config.cardType) {
                mergeCardData(card, data);
                matched++;
                found = true;
              }
            }
          }
        }
        if (!found) {
          console.log(`    No match for: "${data.name}"`);
        }
      } else {
        for (const card of matchingCards) {
          mergeCardData(card, data);
        }
        matched++;
      }
    }

    console.log(`  Matched: ${matched}, Unmatched: ${unmatched}`);
    totalMatched += matched;
    totalUnmatched += unmatched;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total matched: ${totalMatched}`);
  console.log(`Total unmatched: ${totalUnmatched}`);

  // Save updated cards
  const outputPath = path.join(dataDir, 'cards-enriched.json');
  fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2));
  console.log(`\nSaved enriched data to: ${outputPath}`);

  // Update the public cards.json for the web app
  fs.writeFileSync(cardsOutputPath, JSON.stringify(cards, null, 2));
  console.log(`Updated: ${cardsOutputPath}`);
}

// Merge spreadsheet data into card
function mergeCardData(card, data) {
  if (!card.ocr) card.ocr = {};

  // Merge stats
  if (data.stats && Object.keys(data.stats).length > 0) {
    if (!card.ocr.stats) card.ocr.stats = {};
    Object.assign(card.ocr.stats, data.stats);
  }

  // Merge support requirements
  if (data.supportRequirements && Object.keys(data.supportRequirements).length > 0) {
    if (!card.ocr.supportRequirements) card.ocr.supportRequirements = {};
    Object.assign(card.ocr.supportRequirements, data.supportRequirements);
  }

  // Merge ability
  if (data.ability) {
    card.ocr.ability = data.ability;
  }

  // Merge spectral type if not already set
  if (data.spectralType && !card.ocr.spectralType) {
    card.ocr.spectralType = data.spectralType;
  }

  // Merge spreadsheet-specific data
  if (data.spreadsheet && Object.keys(data.spreadsheet).length > 0) {
    if (!card.spreadsheet) card.spreadsheet = {};
    Object.assign(card.spreadsheet, data.spreadsheet);
  }
}

main().catch(console.error);
