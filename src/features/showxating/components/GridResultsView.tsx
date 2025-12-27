/**
 * GridResultsView - Displays scan results as an NxM grid of card images
 *
 * Replaces the photo+overlay view after API processing completes.
 * Shows identified cards as catalog images, unidentified as cropped regions.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShowxatingStore, IdentifiedCard, CapturedScan } from '../store/showxatingStore';
import { useCardStore } from '../../../store/cardStore';
import type { Card } from '../../../types/card';
import {
  determineGridDimensions,
  buildGridCellMap,
  getAllCellKeys,
  parseKey,
  getBounds,
} from '../utils/gridDetection';

export interface GridCell {
  key: string;
  row: number;
  col: number;
  type: 'identified' | 'unidentified' | 'empty';
  card?: IdentifiedCard;
  catalogCard?: Card;
  cropDataUrl?: string;
}

interface GridResultsViewProps {
  scan: CapturedScan;
  slotId: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';
  onCardFlip: (cardIndex: number, showingOpposite: boolean) => void;
  onOpenDetail: (card: Card, identifiedCard: IdentifiedCard, cardIndex: number) => void;
  onOpenCorrection: (card: IdentifiedCard, cardIndex: number) => void;
  onOpenEmptyCorrection?: (estimatedCard: IdentifiedCard) => void;
}

export function GridResultsView({
  scan,
  slotId,
  onCardFlip,
  onOpenDetail,
  onOpenCorrection,
  onOpenEmptyCorrection,
}: GridResultsViewProps) {
  const { cards: catalogCards } = useCardStore();
  const { setGridDimensions } = useShowxatingStore();
  const [cropCache, setCropCache] = useState<Map<string, string>>(new Map());

  // Determine grid dimensions
  const gridDims = useMemo(() => {
    // Use stored dimensions if available (from API)
    if (scan.gridRows && scan.gridCols) {
      console.log('[GridResultsView] Using API grid dimensions:', scan.gridRows, 'x', scan.gridCols);
      return { rows: scan.gridRows, cols: scan.gridCols };
    }

    // Fallback: infer from API card count (more accurate than merged cards)
    if (scan.apiCardCount && scan.apiCardCount > 0) {
      const count = scan.apiCardCount;
      // Try to make a reasonable grid (prefer squarish)
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      console.log('[GridResultsView] Inferred grid from API count:', rows, 'x', cols, 'for', count, 'cards');
      return { rows, cols };
    }

    // Last resort: infer from merged card bboxes
    const bboxes = scan.cards.map(c => c.corners);
    const dims = determineGridDimensions(undefined, undefined, bboxes, bboxes);
    console.log('[GridResultsView] Inferred grid from bboxes:', dims.rows, 'x', dims.cols);

    return dims;
  }, [scan.gridRows, scan.gridCols, scan.apiCardCount, scan.cards]);

  // Store inferred dimensions
  useEffect(() => {
    if (!scan.gridRows || !scan.gridCols) {
      setGridDimensions(slotId, gridDims.rows, gridDims.cols);
    }
  }, [scan.gridRows, scan.gridCols, gridDims, slotId, setGridDimensions]);

  // Build grid cells
  const gridCells = useMemo((): GridCell[] => {
    const { rows, cols } = gridDims;
    const allKeys = getAllCellKeys(rows, cols);

    // Build map of cell key -> card index using explicit dimensions
    const bboxes = scan.cards.map(c => c.corners);
    const cellToCardIndex = buildGridCellMap(bboxes, rows, cols);
    console.log('[GridResultsView] Grid mapping:', {
      rows, cols,
      cardCount: scan.cards.length,
      mappedCells: Array.from(cellToCardIndex.entries())
    });

    // Create reverse map: cardIndex -> cellKey
    const cardIndexToCell = new Map<number, string>();
    cellToCardIndex.forEach((cardIndex, cellKey) => {
      cardIndexToCell.set(cardIndex, cellKey);
    });

    // Build cells in grid order
    return allKeys.map(key => {
      const { row, col } = parseKey(key);
      const cardIndex = cellToCardIndex.get(key);

      if (cardIndex === undefined) {
        // Empty cell - no card detected here
        return { key, row, col, type: 'empty' as const };
      }

      const card = scan.cards[cardIndex];
      if (!card) {
        return { key, row, col, type: 'empty' as const };
      }

      const catalogCard = catalogCards.find(c => c.id === card.cardId);

      if (card.cardId === 'unknown' || !catalogCard) {
        // Unidentified - will show cropped region
        return {
          key,
          row,
          col,
          type: 'unidentified' as const,
          card,
          cropDataUrl: cropCache.get(key),
        };
      }

      // Identified card
      return {
        key,
        row,
        col,
        type: 'identified' as const,
        card,
        catalogCard,
      };
    });
  }, [gridDims, scan.cards, catalogCards, cropCache]);

  // Generate crop images for unidentified cells
  useEffect(() => {
    const unidentifiedCells = gridCells.filter(
      c => c.type === 'unidentified' && c.card && !cropCache.has(c.key)
    );

    if (unidentifiedCells.length === 0) return;

    const img = new Image();
    img.onload = () => {
      const newCrops = new Map(cropCache);

      unidentifiedCells.forEach(cell => {
        if (!cell.card) return;

        const corners = cell.card.corners;
        const bounds = getBounds(corners);
        const padding = 5;

        const cropX = Math.max(0, bounds.minX - padding);
        const cropY = Math.max(0, bounds.minY - padding);
        const cropW = Math.min(img.width - cropX, bounds.maxX - bounds.minX + padding * 2);
        const cropH = Math.min(img.height - cropY, bounds.maxY - bounds.minY + padding * 2);

        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          newCrops.set(cell.key, canvas.toDataURL('image/jpeg', 0.8));
        }
      });

      setCropCache(newCrops);
    };
    img.src = scan.imageDataUrl;
  }, [gridCells, scan.imageDataUrl, cropCache]);

  // Find card index from cell
  const getCardIndex = useCallback((cell: GridCell): number => {
    if (!cell.card) return -1;
    return scan.cards.findIndex(c => c === cell.card);
  }, [scan.cards]);

  return (
    <div className="w-full h-full bg-black p-2 overflow-auto">
      <motion.div
        className="grid gap-2 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${gridDims.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridDims.rows}, 1fr)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {gridCells.map((cell, index) => (
            <motion.div
              key={cell.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
            >
              <GridCellView
                cell={cell}
                gridDims={gridDims}
                imageSize={{ width: scan.imageWidth || 720, height: scan.imageHeight || 1280 }}
                onFlip={() => {
                  const cardIndex = getCardIndex(cell);
                  if (cardIndex >= 0 && cell.card) {
                    onCardFlip(cardIndex, !cell.card.showingOpposite);
                  }
                }}
                onOpenDetail={() => {
                  const cardIndex = getCardIndex(cell);
                  if (cardIndex >= 0 && cell.card && cell.catalogCard) {
                    onOpenDetail(cell.catalogCard, cell.card, cardIndex);
                  }
                }}
                onOpenCorrection={() => {
                  const cardIndex = getCardIndex(cell);
                  if (cardIndex >= 0 && cell.card) {
                    onOpenCorrection(cell.card, cardIndex);
                  }
                }}
                onOpenEmptyCorrection={onOpenEmptyCorrection ? () => {
                  // Create a placeholder card with estimated corners based on grid position
                  const { rows, cols } = gridDims;
                  const cellWidth = (scan.imageWidth || 720) / cols;
                  const cellHeight = (scan.imageHeight || 1280) / rows;
                  const x = cell.col * cellWidth;
                  const y = cell.row * cellHeight;

                  const estimatedCard: IdentifiedCard = {
                    cardId: 'unknown',
                    filename: '',
                    side: null,
                    confidence: 0,
                    corners: [
                      { x, y },
                      { x: x + cellWidth, y },
                      { x: x + cellWidth, y: y + cellHeight },
                      { x, y: y + cellHeight },
                    ],
                    showingOpposite: false,
                    extractedText: `Empty cell at row ${cell.row + 1}, col ${cell.col + 1}`,
                  };
                  onOpenEmptyCorrection(estimatedCard);
                } : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface GridCellViewProps {
  cell: GridCell;
  gridDims: { rows: number; cols: number };
  imageSize: { width: number; height: number };
  onFlip: () => void;
  onOpenDetail: () => void;
  onOpenCorrection: () => void;
  onOpenEmptyCorrection?: () => void;
}

function GridCellView({
  cell,
  // gridDims and imageSize passed for potential future use (e.g., calculating estimated corners)
  gridDims: _gridDims,
  imageSize: _imageSize,
  onFlip,
  onOpenDetail,
  onOpenCorrection,
  onOpenEmptyCorrection,
}: GridCellViewProps) {
  // Note: gridDims and imageSize are used by the parent component to calculate
  // estimated corners for empty cells - they're passed here for interface consistency
  void _gridDims;
  void _imageSize;
  const lastTapRef = useRef<number>(0);

  // Handle tap - single tap flips, double tap opens detail
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    if (cell.type === 'empty') {
      onOpenEmptyCorrection?.();
      return;
    }
    if (cell.type === 'unidentified') {
      onOpenCorrection();
      return;
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      lastTapRef.current = 0;
      onOpenDetail();
    } else {
      lastTapRef.current = now;
      onFlip();
    }
  }, [cell.type, onFlip, onOpenDetail, onOpenCorrection, onOpenEmptyCorrection]);

  // Empty cell - clickable if handler provided
  if (cell.type === 'empty') {
    return (
      <div
        className={`w-full h-full rounded-lg border border-dashed flex flex-col items-center justify-center ${
          onOpenEmptyCorrection ? 'cursor-pointer hover:border-[var(--showxating-gold)]' : ''
        }`}
        style={{
          aspectRatio: '2/3',
          borderColor: 'var(--showxating-gold-dim)',
          opacity: onOpenEmptyCorrection ? 0.5 : 0.3,
        }}
        onClick={handleTap}
        onTouchEnd={handleTap}
      >
        <span className="hud-text hud-text-dim text-[10px]">EMPTY</span>
        {onOpenEmptyCorrection && (
          <span className="hud-text text-[8px] mt-1" style={{ color: 'var(--showxating-gold)' }}>
            TAP TO ADD
          </span>
        )}
      </div>
    );
  }

  // Unidentified cell - show cropped region with type label if available
  if (cell.type === 'unidentified') {
    // API type is 100% accurate - display it prominently
    const apiType = cell.card?.apiReturnedType;
    const typeLabel = apiType
      ? `UNKNOWN ${apiType.toUpperCase()}`
      : 'UNIDENTIFIED';

    return (
      <div
        className="w-full h-full rounded-lg border-2 overflow-hidden cursor-pointer flex flex-col items-center justify-center bg-black/50 relative"
        style={{
          aspectRatio: '2/3',
          borderColor: 'var(--showxating-gold)',
        }}
        onClick={handleTap}
        onTouchEnd={handleTap}
      >
        {cell.cropDataUrl ? (
          <img
            src={cell.cropDataUrl}
            alt={typeLabel}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-black/50" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
          <span className="hud-text text-xs text-[var(--showxating-gold)]">{typeLabel}</span>
          <span className="hud-text hud-text-dim text-[10px] mt-1">TAP TO ID</span>
        </div>
      </div>
    );
  }

  // Identified cell - show catalog image
  const { card, catalogCard } = cell;
  if (!card || !catalogCard) return null;

  // Get display filename based on flip state
  const getDisplayFilename = () => {
    const ensureWebp = (filename: string) => filename.replace('.png', '.webp');

    if (card.showingOpposite && catalogCard.relatedCards) {
      const otherSides = Object.entries(catalogCard.relatedCards)
        .filter(([side]) => side !== catalogCard.side);

      if (otherSides.length > 0) {
        const [, oppositeFilename] = otherSides[0];
        return ensureWebp(oppositeFilename);
      }
    }

    return ensureWebp(card.filename || catalogCard.filename);
  };

  const displayFilename = getDisplayFilename();
  const showConfidence = card.confidence < 0.7;

  return (
    <div
      className="relative w-full h-full rounded-lg border-2 overflow-hidden cursor-pointer"
      style={{
        aspectRatio: '2/3',
        borderColor: card.showingOpposite ? 'var(--showxating-cyan)' : 'var(--showxating-gold)',
      }}
      onClick={handleTap}
      onTouchEnd={handleTap}
    >
      <img
        src={`${import.meta.env.BASE_URL}cards/full/${displayFilename}`}
        alt={catalogCard.ocr?.name || catalogCard.name}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Confidence badge - only if < 70% */}
      {showConfidence && (
        <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px]">
          <span className="hud-text text-[var(--showxating-gold)]">
            {Math.round(card.confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
