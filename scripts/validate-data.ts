/**
 * Validate card data integrity
 * Checks: relationships, OCR results, image files
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {},
  };

  const dataDir = path.join(process.cwd(), 'data');
  const contentDir = path.join(process.cwd(), 'content');

  console.log('Validating card data...\n');

  // 1. Check required files exist
  const requiredFiles = ['manifest.json', 'parsed-cards.json', 'relationships.json'];
  for (const file of requiredFiles) {
    const filePath = path.join(dataDir, file);
    if (await fileExists(filePath)) {
      console.log(`✓ ${file} exists`);
    } else {
      result.errors.push(`Missing required file: ${file}`);
      console.log(`✗ ${file} MISSING`);
    }
  }

  // 2. Load and validate relationships
  let relationships: any[] = [];
  try {
    const relPath = path.join(dataDir, 'relationships.json');
    relationships = JSON.parse(await fs.readFile(relPath, 'utf-8'));
    result.stats.cardGroups = relationships.length;
    console.log(`\n✓ Loaded ${relationships.length} card groups`);

    // Check for cards with no sides
    const noSides = relationships.filter((r: any) => Object.keys(r.sides).length === 0);
    if (noSides.length > 0) {
      result.errors.push(`${noSides.length} cards have no sides`);
      noSides.forEach((r: any) => result.errors.push(`  - ${r.cardId}`));
    }

    // Count by type
    const byType: Record<string, number> = {};
    for (const rel of relationships) {
      byType[rel.type] = (byType[rel.type] || 0) + 1;
    }
    result.stats.byType = byType as any;

    console.log('\nCards by type:');
    Object.entries(byType)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

  } catch (err) {
    result.errors.push(`Failed to load relationships: ${err}`);
  }

  // 3. Validate image files exist
  console.log('\nValidating image files...');
  let missingImages = 0;
  let totalImages = 0;

  for (const rel of relationships) {
    for (const [side, info] of Object.entries(rel.sides)) {
      if (info && typeof info === 'object' && 'relativePath' in info) {
        totalImages++;
        const imagePath = path.join(contentDir, (info as any).relativePath);
        if (!(await fileExists(imagePath))) {
          missingImages++;
          result.errors.push(`Missing image: ${(info as any).relativePath}`);
        }
      }
    }
  }

  result.stats.totalImages = totalImages;
  result.stats.missingImages = missingImages;

  if (missingImages === 0) {
    console.log(`✓ All ${totalImages} image files exist`);
  } else {
    console.log(`✗ ${missingImages}/${totalImages} images missing`);
  }

  // 4. Check OCR results if available
  const ocrPath = path.join(dataDir, 'ocr-results.json');
  if (await fileExists(ocrPath)) {
    try {
      const ocrResults = JSON.parse(await fs.readFile(ocrPath, 'utf-8'));
      const successes = ocrResults.filter((r: any) => r.success).length;
      const failures = ocrResults.filter((r: any) => !r.success).length;

      result.stats.ocrTotal = ocrResults.length;
      result.stats.ocrSuccesses = successes;
      result.stats.ocrFailures = failures;

      console.log(`\nOCR Results:`);
      console.log(`  Total: ${ocrResults.length}`);
      console.log(`  Successes: ${successes}`);
      console.log(`  Failures: ${failures}`);

      if (failures > 0) {
        result.warnings.push(`${failures} OCR failures`);
        const failedCards = ocrResults.filter((r: any) => !r.success);
        console.log('\nFailed OCR cards:');
        failedCards.slice(0, 5).forEach((r: any) => {
          console.log(`  - ${r.filename}: ${r.error}`);
        });
        if (failedCards.length > 5) {
          console.log(`  ... and ${failedCards.length - 5} more`);
        }
      }

      // Check for missing OCR
      const ocrFilenames = new Set(ocrResults.map((r: any) => r.filename));
      let missingOcr = 0;
      for (const rel of relationships) {
        for (const [side, info] of Object.entries(rel.sides)) {
          if (info && typeof info === 'object' && 'filename' in info) {
            if (!ocrFilenames.has((info as any).filename)) {
              missingOcr++;
            }
          }
        }
      }

      if (missingOcr > 0) {
        result.warnings.push(`${missingOcr} cards missing OCR data`);
        console.log(`\n⚠ ${missingOcr} cards missing OCR data`);
      }

    } catch (err) {
      result.warnings.push(`Failed to load OCR results: ${err}`);
    }
  } else {
    console.log('\n⚠ No OCR results found (ocr-results.json)');
    result.warnings.push('OCR not yet run');
  }

  // 5. Check for duplicate card IDs
  const cardIds = relationships.map((r: any) => r.cardId);
  const duplicates = cardIds.filter((id: string, i: number) => cardIds.indexOf(id) !== i);
  if (duplicates.length > 0) {
    result.errors.push(`Duplicate card IDs: ${[...new Set(duplicates)].join(', ')}`);
    console.log(`\n✗ Duplicate card IDs found: ${duplicates.length}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Validation Summary');
  console.log('='.repeat(50));

  result.valid = result.errors.length === 0;

  if (result.valid) {
    console.log('✓ Data is valid!');
  } else {
    console.log('✗ Validation failed!');
    console.log('\nErrors:');
    result.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }

  // Write validation report
  const reportPath = path.join(dataDir, 'validation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);

  // Exit with error code if validation failed
  if (!result.valid) {
    process.exit(1);
  }
}

main().catch(console.error);
