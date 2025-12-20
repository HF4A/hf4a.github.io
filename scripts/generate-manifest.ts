/**
 * Generate manifest of all card images
 * Outputs: data/manifest.json
 */

import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface ImageEntry {
  filename: string;
  path: string;
  relativePath: string;
  size: number;
  checksum: string;
  directory: string;
}

async function generateChecksum(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

async function main() {
  const contentDir = path.join(process.cwd(), 'content');

  console.log('Scanning for PNG files...');

  // Find all PNG files
  const files = await glob('**/*.png', {
    cwd: contentDir,
    nodir: true
  });

  console.log(`Found ${files.length} PNG files`);

  const manifest: ImageEntry[] = [];

  for (const file of files) {
    const fullPath = path.join(contentDir, file);
    const stats = await fs.stat(fullPath);
    const checksum = await generateChecksum(fullPath);

    manifest.push({
      filename: path.basename(file),
      path: fullPath,
      relativePath: file,
      size: stats.size,
      checksum,
      directory: path.dirname(file),
    });
  }

  // Sort by filename for consistent output
  manifest.sort((a, b) => a.filename.localeCompare(b.filename));

  // Write manifest
  const outputPath = path.join(process.cwd(), 'data', 'manifest.json');
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`\nManifest written to ${outputPath}`);
  console.log(`Total images: ${manifest.length}`);
  console.log(`Total size: ${(manifest.reduce((sum, m) => sum + m.size, 0) / 1024 / 1024).toFixed(2)} MB`);

  // Summary by directory
  const byDir = manifest.reduce((acc, m) => {
    acc[m.directory] = (acc[m.directory] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nImages by directory:');
  Object.entries(byDir)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count}`);
    });
}

main().catch(console.error);
