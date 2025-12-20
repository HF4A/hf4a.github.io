/**
 * OCR card images using Claude Vision
 * Input: data/parsed-cards.json (for file list)
 * Output: data/ocr-results.json
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 * Cost estimate: ~$2.25 for 742 images
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

const anthropic = new Anthropic();

// Rate limiting: ~50 requests/minute for Claude
const DELAY_MS = 1200;
const BATCH_SIZE = 10;

interface ParsedCard {
  id: string;
  type: string;
  number: string;
  side: string;
  name: string;
  filename: string;
  relativePath: string;
  directory: string;
}

interface CardOCRResult {
  filename: string;
  parsedId: string;
  success: boolean;
  error?: string;
  data?: {
    name: string;
    cardId: string;
    description: string;
    stats: {
      mass?: number;
      radHard?: number;
      thrust?: number;
      isru?: number;
      powerOutput?: string;
      efficiency?: string;
      loadLimit?: number;
      fuelEfficiency?: number;
      afterburn?: number;
    };
    spectralType?: string;
    supportIcons: string[];
    rawText: string;
  };
}

const OCR_PROMPT = `Extract all text and data from this High Frontier 4 All game card.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "name": "card name from bottom of card",
  "cardId": "ID code from bottom right corner (e.g., CT052F, CX090F)",
  "description": "flavor/technical description text",
  "stats": {
    "mass": <number or null>,
    "radHard": <number or null - the Rad-Hard value>,
    "thrust": <number or null - yellow burst number>,
    "isru": <number or null - ISRU rating, often shown with buggy/raygun icon>,
    "powerOutput": "<string like '550 MWth' or null>",
    "efficiency": "<string like '70%' or null>",
    "loadLimit": <number or null - for freighters>,
    "fuelEfficiency": <number or null - blue water drop number>,
    "afterburn": <number or null - magenta/pink number>
  },
  "spectralType": "<letter in hexagon: C, D, H, M, S, V, or 'any', or null if not visible>",
  "supportIcons": ["array of support types shown: radiator, generator, reactor, crew, robonaut, refinery"],
  "rawText": "all readable text on the card concatenated for search indexing"
}

Important:
- Return ONLY the JSON object, nothing else
- Use null for missing/not-applicable values
- For supportIcons, look for small icons indicating requirements (wavy lines=radiator, circles=generator, etc.)
- The cardId is typically in small text at the bottom right corner`;

async function ocrCard(imagePath: string, parsedId: string): Promise<CardOCRResult> {
  const filename = path.basename(imagePath);

  try {
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64,
            },
          },
          {
            type: 'text',
            text: OCR_PROMPT,
          },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    let jsonText = content.text.trim();

    // Handle potential markdown code blocks
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    const data = JSON.parse(jsonText);

    return {
      filename,
      parsedId,
      success: true,
      data,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  Error processing ${filename}: ${error}`);

    return {
      filename,
      parsedId,
      success: false,
      error,
    };
  }
}

async function main() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable not set');
    console.error('Set it with: export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  const parsedPath = path.join(process.cwd(), 'data', 'parsed-cards.json');
  const outputPath = path.join(process.cwd(), 'data', 'ocr-results.json');
  const contentDir = path.join(process.cwd(), 'content');

  // Check for existing progress
  let existingResults: CardOCRResult[] = [];
  try {
    const existing = await fs.readFile(outputPath, 'utf-8');
    existingResults = JSON.parse(existing);
    console.log(`Found ${existingResults.length} existing OCR results`);
  } catch {
    console.log('No existing OCR results found, starting fresh');
  }

  const processedFilenames = new Set(existingResults.map(r => r.filename));

  console.log('Reading parsed cards...');
  const parsed: ParsedCard[] = JSON.parse(
    await fs.readFile(parsedPath, 'utf-8')
  );

  // Filter to unprocessed cards
  const toProcess = parsed.filter(p => !processedFilenames.has(p.filename));

  console.log(`Total cards: ${parsed.length}`);
  console.log(`Already processed: ${existingResults.length}`);
  console.log(`Remaining: ${toProcess.length}`);

  if (toProcess.length === 0) {
    console.log('All cards already processed!');
    return;
  }

  // Estimate cost
  const estimatedCost = toProcess.length * 0.003;
  console.log(`\nEstimated cost: ~$${estimatedCost.toFixed(2)}`);
  console.log(`Estimated time: ~${Math.ceil(toProcess.length * DELAY_MS / 1000 / 60)} minutes`);
  console.log('\nStarting OCR...\n');

  const results: CardOCRResult[] = [...existingResults];
  let processed = 0;
  let successes = 0;
  let failures = 0;
  const startTime = Date.now();

  for (const card of toProcess) {
    const imagePath = path.join(contentDir, card.relativePath);

    process.stdout.write(`[${processed + 1}/${toProcess.length}] ${card.filename}... `);

    const result = await ocrCard(imagePath, card.id);
    results.push(result);

    if (result.success) {
      successes++;
      console.log('OK');
    } else {
      failures++;
      console.log('FAILED');
    }

    processed++;

    // Save progress every 50 cards
    if (processed % 50 === 0) {
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      console.log(`  [Progress saved. ${processed} done in ${elapsed.toFixed(1)} min]`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // Final save
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

  const elapsed = (Date.now() - startTime) / 1000 / 60;

  console.log(`\n${'='.repeat(50)}`);
  console.log('OCR Complete!');
  console.log(`${'='.repeat(50)}`);
  console.log(`Time: ${elapsed.toFixed(1)} minutes`);
  console.log(`Processed: ${processed}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures: ${failures}`);
  console.log(`Results saved to: ${outputPath}`);
}

main().catch(console.error);
