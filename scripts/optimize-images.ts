// Optimize images: Convert PNG to WebP, generate thumbnails
// Input: content (all PNG files)
// Output: public/cards/full and thumbs directories

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { glob } from 'glob';

const FULL_QUALITY = 85;
const THUMB_WIDTH = 200;
const THUMB_QUALITY = 80;

interface ProcessResult {
  filename: string;
  originalSize: number;
  fullSize: number;
  thumbSize: number;
  saved: number;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function processImage(
  inputPath: string,
  fullOutputDir: string,
  thumbOutputDir: string
): Promise<ProcessResult> {
  const filename = path.basename(inputPath, '.png');
  const fullOutputPath = path.join(fullOutputDir, `${filename}.webp`);
  const thumbOutputPath = path.join(thumbOutputDir, `${filename}.webp`);

  const originalStats = await fs.stat(inputPath);

  // Convert to full-size WebP
  await sharp(inputPath)
    .webp({ quality: FULL_QUALITY })
    .toFile(fullOutputPath);

  // Generate thumbnail
  await sharp(inputPath)
    .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbOutputPath);

  const fullStats = await fs.stat(fullOutputPath);
  const thumbStats = await fs.stat(thumbOutputPath);

  return {
    filename,
    originalSize: originalStats.size,
    fullSize: fullStats.size,
    thumbSize: thumbStats.size,
    saved: originalStats.size - fullStats.size,
  };
}

async function main() {
  const contentDir = path.join(process.cwd(), 'content');
  const fullOutputDir = path.join(process.cwd(), 'public', 'cards', 'full');
  const thumbOutputDir = path.join(process.cwd(), 'public', 'cards', 'thumbs');

  // Create output directories
  await ensureDir(fullOutputDir);
  await ensureDir(thumbOutputDir);

  console.log('Scanning for PNG files...');

  // Find all card images (exclude miscellany, race)
  const allFiles = await glob('**/*.png', { cwd: contentDir, nodir: true });
  const cardFiles = allFiles.filter(f =>
    !f.includes('miscellany') &&
    !f.includes('race') &&
    !f.includes("'hf4a content'")  // Skip loose files in hf4a content folder
  );

  console.log(`Found ${cardFiles.length} card images to process`);
  console.log(`Output: ${fullOutputDir}`);
  console.log(`Thumbnails: ${thumbOutputDir}`);

  const results: ProcessResult[] = [];
  let processed = 0;
  const startTime = Date.now();

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 20;

  for (let i = 0; i < cardFiles.length; i += BATCH_SIZE) {
    const batch = cardFiles.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const inputPath = path.join(contentDir, file);
        try {
          const result = await processImage(inputPath, fullOutputDir, thumbOutputDir);
          processed++;

          if (processed % 50 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processed / elapsed;
            const remaining = (cardFiles.length - processed) / rate;
            console.log(`Processed ${processed}/${cardFiles.length} (${rate.toFixed(1)}/s, ~${remaining.toFixed(0)}s remaining)`);
          }

          return result;
        } catch (err) {
          console.error(`Error processing ${file}:`, err);
          return null;
        }
      })
    );

    results.push(...batchResults.filter((r): r is ProcessResult => r !== null));
  }

  const elapsed = (Date.now() - startTime) / 1000;

  // Calculate totals
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalFull = results.reduce((sum, r) => sum + r.fullSize, 0);
  const totalThumb = results.reduce((sum, r) => sum + r.thumbSize, 0);
  const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Optimization complete!`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Time: ${elapsed.toFixed(1)}s`);
  console.log(`Processed: ${results.length} images`);
  console.log(`\nSize breakdown:`);
  console.log(`  Original PNGs:  ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Full WebPs:     ${(totalFull / 1024 / 1024).toFixed(2)} MB (${((1 - totalFull/totalOriginal) * 100).toFixed(1)}% smaller)`);
  console.log(`  Thumbnails:     ${(totalThumb / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Total saved:    ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);

  // Write optimization report
  const reportPath = path.join(process.cwd(), 'data', 'optimization-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    duration: elapsed,
    counts: {
      processed: results.length,
      total: cardFiles.length,
    },
    sizes: {
      originalTotal: totalOriginal,
      fullTotal: totalFull,
      thumbTotal: totalThumb,
      saved: totalSaved,
    },
    files: results,
  }, null, 2));

  console.log(`\nReport written to ${reportPath}`);
}

main().catch(console.error);
