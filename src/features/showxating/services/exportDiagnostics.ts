/**
 * Diagnostics Export Service
 *
 * Packages all scan data into a ZIP file for troubleshooting:
 * - Captured scan images
 * - Detected bounding boxes and corners
 * - OpenCV detection metadata
 * - Card identification results
 * - Device info and app version
 */

import JSZip from 'jszip';
import { useScanSlotsStore, CapturedScan, IdentifiedCard } from '../store/showxatingStore';
import { APP_VERSION, BUILD_DATE } from '../../../version';

export interface DiagnosticsMetadata {
  exportedAt: string;
  appVersion: string;
  buildDate: string;
  userAgent: string;
  platform: string;
  screenSize: { width: number; height: number };
  devicePixelRatio: number;
  scansCount: number;
  totalCardsDetected: number;
  totalCardsIdentified: number;
}

export interface ScanDiagnostics {
  id: string;
  timestamp: string;
  cardsCount: number;
  cards: CardDiagnostics[];
}

export interface CardDiagnostics {
  cardId: string;
  filename: string;
  side: string | null;
  confidence: number;
  corners: { x: number; y: number }[];
  showingOpposite: boolean;
  identified: boolean;
  // Debug info for troubleshooting (Phase 9.1)
  boundingBox?: { x: number; y: number; width: number; height: number };
  computedHash?: string;
  matchDistance?: number;
  topMatches?: { cardId: string; distance: number }[];
}

function formatCardDiagnostics(card: IdentifiedCard): CardDiagnostics {
  return {
    cardId: card.cardId,
    filename: card.filename,
    side: card.side,
    confidence: card.confidence,
    corners: card.corners,
    showingOpposite: card.showingOpposite,
    identified: card.cardId !== 'unknown' && card.cardId !== '',
    // Debug info
    boundingBox: card.boundingBox,
    computedHash: card.computedHash,
    matchDistance: card.matchDistance,
    topMatches: card.topMatches,
  };
}

function formatScanDiagnostics(scan: CapturedScan): ScanDiagnostics {
  return {
    id: scan.id,
    timestamp: new Date(scan.timestamp).toISOString(),
    cardsCount: scan.cards.length,
    cards: scan.cards.map(formatCardDiagnostics),
  };
}

function getMetadata(scans: CapturedScan[]): DiagnosticsMetadata {
  const totalCards = scans.reduce((sum, s) => sum + s.cards.length, 0);
  const identifiedCards = scans.reduce(
    (sum, s) => sum + s.cards.filter(c => c.cardId !== 'unknown' && c.cardId !== '').length,
    0
  );

  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildDate: BUILD_DATE,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenSize: {
      width: window.screen.width,
      height: window.screen.height,
    },
    devicePixelRatio: window.devicePixelRatio,
    scansCount: scans.length,
    totalCardsDetected: totalCards,
    totalCardsIdentified: identifiedCards,
  };
}

/**
 * Convert data URL to blob for ZIP inclusion
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Export all scan data as a ZIP file
 */
export async function exportDiagnosticsZip(): Promise<Blob> {
  const zip = new JSZip();

  // Get all scans from persisted store
  const { scanSlots } = useScanSlotsStore.getState();
  const slotOrder = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] as const;

  const scans: CapturedScan[] = [];
  slotOrder.forEach(slotId => {
    const scan = scanSlots[slotId];
    if (scan) {
      scans.push(scan);
    }
  });

  if (scans.length === 0) {
    // Create empty diagnostics if no scans
    const metadata = getMetadata([]);
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    zip.file('scans.json', JSON.stringify([], null, 2));
    return zip.generateAsync({ type: 'blob' });
  }

  // Add metadata
  const metadata = getMetadata(scans);
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Add scan diagnostics (without images)
  const scanDiagnostics = scans.map(formatScanDiagnostics);
  zip.file('scans.json', JSON.stringify(scanDiagnostics, null, 2));

  // Create images folder and add scan images
  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    scans.forEach((scan, index) => {
      const imageBlob = dataUrlToBlob(scan.imageDataUrl);
      const extension = scan.imageDataUrl.includes('image/png') ? 'png' : 'jpg';
      imagesFolder.file(`scan-${index + 1}-${scan.id}.${extension}`, imageBlob);
    });
  }

  // Generate the ZIP
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Download the diagnostics ZIP file
 */
export async function downloadDiagnostics(): Promise<void> {
  const blob = await exportDiagnosticsZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `hf4a-diagnostics-${timestamp}.zip`;

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share the diagnostics ZIP file (for mobile)
 */
export async function shareDiagnostics(): Promise<boolean> {
  const blob = await exportDiagnosticsZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `hf4a-diagnostics-${timestamp}.zip`;

  // Check if Web Share API is available
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'application/zip' });
    const shareData = {
      files: [file],
      title: 'HF4A Diagnostics',
      text: 'HF4A card scanner diagnostics export',
    };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        // User cancelled or share failed, fall back to download
        console.log('[exportDiagnostics] Share cancelled or failed:', err);
      }
    }
  }

  // Fall back to download
  await downloadDiagnostics();
  return false;
}
