/**
 * CapturedScanView - Displays a captured scan with card overlays
 *
 * Gestures:
 * - Single tap: flip card (FRONT/BACK)
 * - Double-tap: open card detail modal
 * - Long-press: open correction modal (manual card selection)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useShowxatingStore, IdentifiedCard } from '../store/showxatingStore';
import { useCorrectionsStore, ManualCorrection } from '../store/correctionsStore';
import { useCardStore } from '../../../store/cardStore';
import Fuse from 'fuse.js';
import type { Card } from '../../../types/card';

interface CapturedScanViewProps {
  slotId: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';
}

export function CapturedScanView({ slotId }: CapturedScanViewProps) {
  const { scanSlots, updateCardFlip } = useShowxatingStore();
  const { cards } = useCardStore();
  const scan = scanSlots[slotId];

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [correctionData, setCorrectionData] = useState<{
    card: IdentifiedCard;
    cardIndex: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Track container and image sizes for overlay positioning
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handle correction selection
  const handleCorrectionSelect = useCallback(
    (selectedCardId: string, cardIndex: number, identifiedCard: IdentifiedCard) => {
      if (!scan) return;

      // Save the correction to the corrections store
      if (identifiedCard.computedHash) {
        const correction: ManualCorrection = {
          timestamp: Date.now(),
          computedHash: identifiedCard.computedHash,
          originalCardId: identifiedCard.cardId === 'unknown' ? null : identifiedCard.cardId,
          originalConfidence: identifiedCard.confidence,
          correctedCardId: selectedCardId,
          scanId: scan.id,
          cardIndex,
        };
        useCorrectionsStore.getState().addCorrection(correction);
      }

      // Update the card in the scan slot
      const catalogCard = cards.find((c) => c.id === selectedCardId);
      if (catalogCard) {
        // Update the identified card with the correction
        const updatedCards = [...scan.cards];
        updatedCards[cardIndex] = {
          ...identifiedCard,
          cardId: selectedCardId,
          filename: catalogCard.filename,
          side: catalogCard.side ?? null,
          confidence: 1.0, // User-verified
        };

        // Update the scan slot
        useShowxatingStore.getState().scanSlots[slotId] = {
          ...scan,
          cards: updatedCards,
        };
        // Force re-render by calling updateCardFlip with current state
        updateCardFlip(slotId, cardIndex, identifiedCard.showingOpposite);
      }

      setCorrectionData(null);
    },
    [scan, slotId, cards, updateCardFlip]
  );

  if (!scan) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="hud-text hud-text-dim">NO SCAN DATA</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Captured image */}
      <img
        ref={imageRef}
        src={scan.imageDataUrl}
        alt="Captured scan"
        className="absolute inset-0 w-full h-full object-cover"
        onLoad={() => {
          if (containerRef.current) {
            setContainerSize({
              width: containerRef.current.clientWidth,
              height: containerRef.current.clientHeight,
            });
          }
        }}
      />

      {/* Card overlays */}
      {scan.cards.map((card, index) => (
        <CardOverlay
          key={index}
          card={card}
          cardIndex={index}
          containerSize={containerSize}
          imageRef={imageRef}
          onFlip={() => updateCardFlip(slotId, index, !card.showingOpposite)}
          onOpenDetail={() => {
            // Find the card in the catalog and open detail modal
            const catalogCard = cards.find((c) => c.id === card.cardId);
            if (catalogCard) {
              setDetailCard(catalogCard);
            }
          }}
          onOpenCorrection={() => {
            setCorrectionData({ card, cardIndex: index });
          }}
        />
      ))}

      {/* Card Detail Modal */}
      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}

      {/* Correction Modal */}
      {correctionData && scan && (
        <CorrectionModal
          identifiedCard={correctionData.card}
          scanImageDataUrl={scan.imageDataUrl}
          onSelect={(cardId) =>
            handleCorrectionSelect(cardId, correctionData.cardIndex, correctionData.card)
          }
          onClose={() => setCorrectionData(null)}
        />
      )}

      {/* Scanline effect on top */}
      <div className="scanline-overlay" />

      {/* Info badge */}
      <div className="absolute top-4 left-4 bg-black/70 px-3 py-1 rounded">
        <span className="hud-text text-xs">
          {scan.cards.length > 0
            ? `${scan.cards.length} CARD${scan.cards.length > 1 ? 'S' : ''} DETECTED`
            : 'NO CARDS DETECTED'}
        </span>
      </div>
    </div>
  );
}

interface CardOverlayProps {
  card: IdentifiedCard;
  cardIndex: number;
  containerSize: { width: number; height: number };
  imageRef: React.RefObject<HTMLImageElement>;
  onFlip: () => void;
  onOpenDetail: () => void;
  onOpenCorrection: () => void;
}

function CardOverlay({
  card,
  containerSize,
  imageRef,
  onFlip,
  onOpenDetail,
  onOpenCorrection,
}: CardOverlayProps) {
  const { cards: catalogCards } = useCardStore();
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const [isLongPress, setIsLongPress] = useState(false);

  // Find the catalog card to get the image
  const catalogCard = catalogCards.find((c) => c.id === card.cardId);

  // Get the image to display based on flip state
  // Note: cards.json has .png extensions but actual files are .webp
  const getDisplayFilename = useCallback(() => {
    const ensureWebp = (filename: string) => filename.replace('.png', '.webp');

    if (!catalogCard) return card.filename; // Scanner filename already has .webp

    if (card.showingOpposite) {
      // Show opposite side - find related card
      const relatedCard = catalogCards.find(
        (c) =>
          c.relatedCards?.promotedSide === catalogCard.id ||
          catalogCard.relatedCards?.promotedSide === c.id
      );
      const filename = relatedCard?.filename || catalogCard.filename;
      return ensureWebp(filename);
    }
    // Show visible side - use scanner's filename (has correct .webp) over catalog
    return card.filename || ensureWebp(catalogCard.filename);
  }, [catalogCard, catalogCards, card.showingOpposite, card.filename]);

  // Calculate overlay position based on detected corners
  const getOverlayStyle = useCallback((): React.CSSProperties => {
    if (!imageRef.current || containerSize.width === 0) return { display: 'none' };

    const img = imageRef.current;
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;

    // Calculate object-cover scaling
    const imgAR = naturalW / naturalH;
    const containerAR = containerSize.width / containerSize.height;

    let scale: number;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAR > containerAR) {
      // Image is wider - scale by height
      scale = containerSize.height / naturalH;
      const displayedWidth = naturalW * scale;
      offsetX = (displayedWidth - containerSize.width) / 2;
    } else {
      // Image is taller - scale by width
      scale = containerSize.width / naturalW;
      const displayedHeight = naturalH * scale;
      offsetY = (displayedHeight - containerSize.height) / 2;
    }

    // Transform corners to display coordinates
    const displayCorners = card.corners.map((p) => ({
      x: p.x * scale - offsetX,
      y: p.y * scale - offsetY,
    }));

    // Get bounding box
    const minX = Math.min(...displayCorners.map((c) => c.x));
    const maxX = Math.max(...displayCorners.map((c) => c.x));
    const minY = Math.min(...displayCorners.map((c) => c.y));
    const maxY = Math.max(...displayCorners.map((c) => c.y));

    return {
      position: 'absolute',
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [card.corners, containerSize, imageRef]);

  // Handle tap events
  // Single tap = flip, double tap = open detail modal
  const handleTouchStart = () => {
    setIsLongPress(false);
    longPressRef.current = setTimeout(() => {
      setIsLongPress(true);
      onOpenCorrection();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
    if (!isLongPress) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < 300) {
        // Double tap - open detail modal
        lastTapRef.current = 0; // Reset to prevent triple-tap issues
        onOpenDetail();
      } else {
        // Single tap - flip
        lastTapRef.current = now;
        onFlip();
      }
    }
    setIsLongPress(false);
  };

  const handleTouchCancel = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
    setIsLongPress(false);
  };

  const style = getOverlayStyle();
  const displayFilename = getDisplayFilename();

  if (card.cardId === 'unknown' || !catalogCard) {
    // Unknown card - show placeholder with animation
    return (
      <div
        style={style}
        className="border-2 border-[var(--showxating-gold)] bg-black/50 rounded-lg flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchCancel}
      >
        <div className="scan-animation" />
        <div className="flex flex-col items-center gap-1">
          <span className="hud-text text-sm">UNIDENTIFIED</span>
          <span className="hud-text hud-text-dim text-[10px]">LONG-PRESS TO ID</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`
        cursor-pointer overflow-hidden rounded-lg
        border-2 transition-all
        ${card.showingOpposite ? 'border-[var(--showxating-cyan)]' : 'border-[var(--showxating-gold)]'}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchCancel}
    >
      {/* Card image - mirrored horizontally when showing opposite side (like physically flipping a card) */}
      <img
        src={`${import.meta.env.BASE_URL}cards/full/${displayFilename}`}
        alt={catalogCard.ocr?.name || card.cardId}
        className="w-full h-full object-cover"
        style={card.showingOpposite ? { transform: 'scaleX(-1)' } : undefined}
        draggable={false}
      />

      {/* Confidence indicator */}
      <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px]">
        <span
          className={`hud-text ${
            card.confidence > 0.8
              ? 'text-[var(--showxating-cyan)]'
              : 'text-[var(--showxating-gold)]'
          }`}
        >
          {Math.round(card.confidence * 100)}%
        </span>
      </div>

      {/* Side indicator */}
      <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px]">
        <span className="hud-text hud-text-dim">
          {card.showingOpposite ? 'BACK' : 'FRONT'}
        </span>
      </div>
    </div>
  );
}

/**
 * CardDetailModal - Full-screen modal for viewing card details
 */
interface CardDetailModalProps {
  card: Card;
  onClose: () => void;
}

function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  const { cards } = useCardStore();
  const [isFlipped, setIsFlipped] = useState(false);

  // Find the related card (opposite side)
  const relatedCard = cards.find(
    (c) =>
      c.relatedCards?.promotedSide === card.id ||
      card.relatedCards?.promotedSide === c.id ||
      (c.cardGroupId === card.cardGroupId && c.id !== card.id)
  );

  const displayCard = isFlipped && relatedCard ? relatedCard : card;
  const canFlip = !!relatedCard;

  // Convert .png to .webp for actual file
  const imagePath = `${import.meta.env.BASE_URL}cards/full/${displayCard.filename.replace('.png', '.webp')}`;

  // Handle tap to flip
  const handleTap = () => {
    if (canFlip) {
      setIsFlipped(!isFlipped);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.key === 'f') {
        if (canFlip) {
          e.preventDefault();
          setIsFlipped(!isFlipped);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, canFlip, isFlipped]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
          style={{
            borderColor: 'var(--showxating-gold-dim)',
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          CLOSE
        </button>
        {canFlip && (
          <span
            className="text-xs tracking-wider uppercase"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            TAP TO FLIP
          </span>
        )}
      </header>

      {/* Card image */}
      <main
        className="flex-1 flex items-center justify-center p-4"
        onClick={handleTap}
      >
        <div
          className="relative max-w-[85vw] max-h-[70vh] aspect-[2/3]"
          style={{
            transform: isFlipped ? 'scaleX(-1)' : 'none',
            transition: 'transform 0.3s ease',
          }}
        >
          <img
            src={imagePath}
            alt={displayCard.ocr?.name || displayCard.name}
            className="w-full h-full object-contain"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(212, 168, 75, 0.3))',
            }}
            draggable={false}
          />
        </div>
      </main>

      {/* Footer with card info */}
      <footer className="px-4 py-4 text-center">
        <h1
          className="text-lg tracking-wider uppercase truncate"
          style={{
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          {displayCard.ocr?.name || displayCard.name}
        </h1>
        <p
          className="text-xs tracking-wider uppercase mt-1"
          style={{ color: 'var(--showxating-gold-dim)' }}
        >
          {displayCard.type.toUpperCase()}
          {displayCard.side && ` • ${displayCard.side.toUpperCase()}`}
        </p>
      </footer>
    </div>
  );
}

/**
 * CorrectionModal - Manual card identification correction
 *
 * Shows the original scanned region and a list of candidate cards
 * for the user to select the correct identification.
 */
interface CorrectionModalProps {
  identifiedCard: IdentifiedCard;
  scanImageDataUrl: string;
  onSelect: (cardId: string) => void;
  onClose: () => void;
}

function CorrectionModal({
  identifiedCard,
  scanImageDataUrl,
  onSelect,
  onClose,
}: CorrectionModalProps) {
  const { cards: catalogCards } = useCardStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Array<{ card: Card; distance?: number }>>([]);

  // Initialize candidates based on dHash matches and search
  useEffect(() => {
    const topMatchIds = identifiedCard.topMatches?.map((m) => m.cardId) || [];

    // Get top hash-matched cards
    const hashMatches = topMatchIds
      .map((id) => {
        const card = catalogCards.find((c) => c.id === id);
        const matchInfo = identifiedCard.topMatches?.find((m) => m.cardId === id);
        return card ? { card, distance: matchInfo?.distance } : null;
      })
      .filter(Boolean) as Array<{ card: Card; distance?: number }>;

    // If we have search query, use Fuse.js
    if (searchQuery.trim()) {
      const fuse = new Fuse(catalogCards, {
        keys: ['name', 'ocr.name', 'id', 'type'],
        threshold: 0.4,
        includeScore: true,
      });
      const results = fuse.search(searchQuery).slice(0, 20);
      setCandidates(results.map((r) => ({ card: r.item })));
    } else {
      // Show hash matches first, then some popular card types
      setCandidates(hashMatches.slice(0, 10));
    }
  }, [searchQuery, catalogCards, identifiedCard.topMatches]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--showxating-gold-dim)]">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
          style={{
            borderColor: 'var(--showxating-gold-dim)',
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          CANCEL
        </button>
        <span
          className="text-xs tracking-wider uppercase"
          style={{
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          IDENTIFY CARD
        </span>
        <div style={{ width: 70 }} /> {/* Spacer for centering */}
      </header>

      {/* Search input */}
      <div className="px-4 py-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-black/50 border rounded text-sm"
          style={{
            borderColor: 'var(--showxating-gold-dim)',
            color: 'var(--showxating-gold)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
          autoFocus
        />
      </div>

      {/* Original card region preview (if we have bounding box) */}
      {identifiedCard.boundingBox && (
        <div className="px-4 pb-2">
          <p
            className="text-[10px] tracking-wider uppercase mb-2"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            SCANNED REGION:
          </p>
          <div className="h-24 w-24 bg-black/50 rounded overflow-hidden">
            {/* This would show a cropped version of the scan - simplified for now */}
            <img
              src={scanImageDataUrl}
              alt="Scanned region"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Candidate list */}
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        <p
          className="text-[10px] tracking-wider uppercase mb-2 sticky top-0 bg-black py-2"
          style={{ color: 'var(--showxating-gold-dim)' }}
        >
          {searchQuery ? 'SEARCH RESULTS' : 'LIKELY MATCHES'}:
        </p>

        <div className="grid grid-cols-2 gap-3">
          {candidates.map(({ card, distance }) => (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className="flex flex-col items-center p-2 rounded border transition-all hover:bg-[var(--showxating-gold)]/10"
              style={{
                borderColor:
                  card.id === identifiedCard.cardId
                    ? 'var(--showxating-cyan)'
                    : 'var(--showxating-gold-dim)',
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}cards/full/${card.filename.replace('.png', '.webp')}`}
                alt={card.ocr?.name || card.name}
                className="w-full aspect-[2/3] object-cover rounded mb-2"
              />
              <span
                className="text-[10px] tracking-wider uppercase text-center truncate w-full"
                style={{
                  color: 'var(--showxating-gold)',
                  fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                }}
              >
                {card.ocr?.name || card.name}
              </span>
              {distance !== undefined && (
                <span
                  className="text-[9px] tracking-wider"
                  style={{ color: 'var(--showxating-gold-dim)' }}
                >
                  d={distance}
                </span>
              )}
            </button>
          ))}
        </div>

        {candidates.length === 0 && (
          <div className="text-center py-8">
            <span className="hud-text hud-text-dim text-sm">
              {searchQuery ? 'NO MATCHES FOUND' : 'NO CANDIDATES AVAILABLE'}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
