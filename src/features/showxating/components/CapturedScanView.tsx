/**
 * CapturedScanView - Displays a captured scan with card overlays
 *
 * Gestures:
 * - Single tap: flip card (FRONT/BACK)
 * - Double-tap: open card detail modal
 *
 * The card detail modal includes a [RESCAN] button for correction flow.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import Tesseract from 'tesseract.js';
import { useShowxatingStore, IdentifiedCard } from '../store/showxatingStore';
import { useCorrectionsStore, ManualCorrection } from '../store/correctionsStore';
import { useCardStore } from '../../../store/cardStore';
import { useSettingsStore, ALL_CARD_TYPES, CARD_TYPE_LABELS } from '../../../store/settingsStore';
import { log } from '../../../store/logsStore';
import Fuse from 'fuse.js';
import type { Card, CardType } from '../../../types/card';

// Card region definitions (as percentage of card dimensions)
// HF4A cards have consistent layouts: type at top, title at bottom
const CARD_REGIONS = {
  // Title region: bottom of card, usually contains the card name in readable font
  // Expanded from y:82 h:15 to capture more of the title area
  title: { x: 2, y: 78, w: 96, h: 20 },
  // Type region: top-left of card, contains type icon and name
  type: { x: 0, y: 0, w: 40, h: 15 },
};

// Swipe gesture thresholds
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

interface CapturedScanViewProps {
  slotId: 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';
}

export function CapturedScanView({ slotId }: CapturedScanViewProps) {
  const { scanSlots, updateCardFlip } = useShowxatingStore();
  const { cards } = useCardStore();
  const scan = scanSlots[slotId];

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [detailData, setDetailData] = useState<{
    card: Card;
    identifiedCard: IdentifiedCard;
    cardIndex: number;
  } | null>(null);
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
              setDetailData({ card: catalogCard, identifiedCard: card, cardIndex: index });
            }
          }}
          onOpenCorrection={() => {
            // Open correction flow for this card
            setCorrectionData({ card, cardIndex: index });
          }}
        />
      ))}

      {/* Card Detail Modal */}
      {detailData && (
        <CardDetailModal
          card={detailData.card}
          onClose={() => setDetailData(null)}
          onRescan={() => {
            // Open correction flow for this card
            setCorrectionData({
              card: detailData.identifiedCard,
              cardIndex: detailData.cardIndex,
            });
            setDetailData(null);
          }}
        />
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
  imageRef: React.RefObject<HTMLImageElement | null>;
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
  const lastTapRef = useRef<number>(0);

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
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to avoid browser's save image dialog on long touch
    e.preventDefault();

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
  }, [onFlip, onOpenDetail]);

  const style = getOverlayStyle();
  const displayFilename = getDisplayFilename();

  if (card.cardId === 'unknown' || !catalogCard) {
    // Unknown card - show placeholder, tap opens correction modal
    return (
      <div
        style={style}
        className="border-2 border-[var(--showxating-gold)] bg-black/50 rounded-lg flex items-center justify-center touch-none select-none cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onOpenCorrection();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onOpenCorrection();
        }}
      >
        <div className="scan-animation" />
        <div className="flex flex-col items-center gap-1">
          <span className="hud-text text-sm">UNIDENTIFIED</span>
          <span className="hud-text hud-text-dim text-[10px]">TAP TO ID</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`
        cursor-pointer overflow-hidden rounded-lg
        border-2 transition-all touch-none select-none
        ${card.showingOpposite ? 'border-[var(--showxating-cyan)]' : 'border-[var(--showxating-gold)]'}
      `}
      onClick={handleTap}
      onTouchEnd={handleTap}
    >
      {/* Card image - opposite side has its own correctly-oriented image */}
      <img
        src={`${import.meta.env.BASE_URL}cards/full/${displayFilename}`}
        alt={catalogCard.ocr?.name || card.cardId}
        className="w-full h-full object-cover"
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
 *
 * Gestures:
 * - Swipe left/right: flip card
 * - Swipe up: show metadata (future)
 * - Swipe down: dismiss
 */
interface CardDetailModalProps {
  card: Card;
  onClose: () => void;
  onRescan: () => void;
}

function CardDetailModal({ card, onClose, onRescan }: CardDetailModalProps) {
  const { cards } = useCardStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

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

  // Handle drag gestures on the card
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;

      // Horizontal swipe = flip
      if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > VELOCITY_THRESHOLD) {
        if (canFlip) {
          setIsFlipped(!isFlipped);
        }
      }
      // Vertical swipe down = dismiss
      else if (offset.y > SWIPE_THRESHOLD || velocity.y > VELOCITY_THRESHOLD) {
        onClose();
      }
      // Vertical swipe up could show metadata (future)

      setDragX(0);
      setDragY(0);
    },
    [canFlip, isFlipped, onClose]
  );

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
          ← CLOSE
        </button>
        <button
          onClick={onRescan}
          className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
          style={{
            borderColor: 'var(--showxating-cyan)',
            color: 'var(--showxating-cyan)',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          RESCAN
        </button>
      </header>

      {/* Card image with swipe gestures */}
      <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <motion.div
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDrag={(_, info) => {
            setDragX(info.offset.x);
            setDragY(info.offset.y);
          }}
          onDragEnd={handleDragEnd}
          animate={{
            x: dragX,
            y: dragY,
            rotateY: isFlipped ? 180 : 0,
            opacity: 1 - Math.abs(dragY) / 400,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative cursor-grab active:cursor-grabbing"
          style={{
            width: 'min(85vw, 400px)',
            aspectRatio: '2/3',
            transformStyle: 'preserve-3d',
            perspective: '1000px',
          }}
        >
          <img
            src={imagePath}
            alt={displayCard.ocr?.name || displayCard.name}
            className="w-full h-full object-contain"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(212, 168, 75, 0.3))',
              transform: isFlipped ? 'rotateY(180deg)' : 'none',
            }}
            draggable={false}
          />
        </motion.div>
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
        {canFlip && (
          <p
            className="text-[10px] tracking-wider uppercase mt-2"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            ← SWIPE TO FLIP →
          </p>
        )}
      </footer>
    </div>
  );
}

/**
 * CorrectionModal - Manual card identification correction
 *
 * Two-panel layout:
 * - Left (1/3): Cropped bounding box image + extracted text
 * - Right (2/3): Scrollable candidate list
 *
 * Double-tap a candidate to select it as the correct match.
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
  const { activeCardTypes } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Array<{ card: Card; distance?: number }>>([]);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [selectedType, setSelectedType] = useState<CardType | 'all'>('all');
  const lastTapRef = useRef<{ cardId: string; time: number } | null>(null);

  // Crop the bounding box from the scan image
  useEffect(() => {
    if (!identifiedCard.corners || identifiedCard.corners.length < 4) return;

    const img = new Image();
    img.onload = () => {
      // Get bounding box from corners
      const xs = identifiedCard.corners.map((c) => c.x);
      const ys = identifiedCard.corners.map((c) => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Add small padding
      const padding = 10;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(img.width - cropX, maxX - minX + padding * 2);
      const cropH = Math.min(img.height - cropY, maxY - minY + padding * 2);

      // Create canvas and draw cropped region
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const dataUrl = canvas.toDataURL('image/png');
        setCroppedImage(dataUrl);

        // Run OCR on the title region of the card (bottom area)
        setIsOcrRunning(true);
        const ocrStartTime = performance.now();

        // Extract title region from the cropped card
        const titleRegion = CARD_REGIONS.title;
        const titleX = Math.round((titleRegion.x / 100) * cropW);
        const titleY = Math.round((titleRegion.y / 100) * cropH);
        const titleW = Math.round((titleRegion.w / 100) * cropW);
        const titleH = Math.round((titleRegion.h / 100) * cropH);

        // Create a canvas for the title region
        const titleCanvas = document.createElement('canvas');
        titleCanvas.width = titleW;
        titleCanvas.height = titleH;
        const titleCtx = titleCanvas.getContext('2d');

        if (titleCtx) {
          titleCtx.drawImage(canvas, titleX, titleY, titleW, titleH, 0, 0, titleW, titleH);
          const titleDataUrl = titleCanvas.toDataURL('image/png');

          log.debug(`OCR title region: ${titleW}x${titleH}px from card ${cropW}x${cropH}px`);

          Tesseract.recognize(titleDataUrl, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text' && m.progress) {
                log.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
              }
            },
          })
            .then(({ data: { text, confidence } }) => {
              const ocrDuration = Math.round(performance.now() - ocrStartTime);
              // Clean up OCR text - remove excessive whitespace
              const cleaned = text
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 100); // Title should be short
              setExtractedText(cleaned || '(no text detected)');
              log.info(`OCR extracted in ${ocrDuration}ms (conf: ${Math.round(confidence)}%): "${cleaned}"`);
            })
            .catch((err) => {
              const ocrDuration = Math.round(performance.now() - ocrStartTime);
              log.error(`OCR failed after ${ocrDuration}ms: ${err.message}`);
              setExtractedText('(OCR failed)');
            })
            .finally(() => {
              setIsOcrRunning(false);
            });
        } else {
          setIsOcrRunning(false);
          log.error('OCR: failed to create title canvas context');
          setExtractedText('(failed to create title canvas)');
        }
      }
    };
    img.src = scanImageDataUrl;
  }, [scanImageDataUrl, identifiedCard.corners]);

  // Initialize candidates based on dHash matches, search, and type filter
  useEffect(() => {
    // Create a map of hash distances for sorting
    const distanceMap = new Map<string, number>();
    identifiedCard.topMatches?.forEach((m) => {
      distanceMap.set(m.cardId, m.distance);
    });

    // If we have search query, use Fuse.js
    if (searchQuery.trim()) {
      let searchPool = catalogCards;
      // Filter search pool by type if selected
      if (selectedType !== 'all') {
        searchPool = catalogCards.filter((c) => c.type === selectedType);
      }
      const fuse = new Fuse(searchPool, {
        keys: ['name', 'ocr.name', 'id', 'type'],
        threshold: 0.4,
        includeScore: true,
      });
      const results = fuse.search(searchQuery).slice(0, 50);
      setCandidates(results.map((r) => ({ card: r.item, distance: distanceMap.get(r.item.id) })));
    } else if (selectedType !== 'all') {
      // Show ALL cards of the selected type, sorted by hash distance
      const typeCards = catalogCards
        .filter((c) => c.type === selectedType)
        .map((card) => ({ card, distance: distanceMap.get(card.id) }))
        .sort((a, b) => {
          // Cards with distance come first (sorted by distance ascending)
          // Cards without distance come last (sorted by name)
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          if (a.distance !== undefined) return -1;
          if (b.distance !== undefined) return 1;
          return (a.card.ocr?.name || a.card.name).localeCompare(b.card.ocr?.name || b.card.name);
        });
      setCandidates(typeCards);
    } else {
      // No filter selected - show top hash matches
      const topMatchIds = identifiedCard.topMatches?.map((m) => m.cardId) || [];
      const hashMatches = topMatchIds
        .map((id) => {
          const card = catalogCards.find((c) => c.id === id);
          return card ? { card, distance: distanceMap.get(id) } : null;
        })
        .filter(Boolean) as Array<{ card: Card; distance?: number }>;
      setCandidates(hashMatches);
    }
  }, [searchQuery, catalogCards, identifiedCard.topMatches, selectedType]);

  // Handle double-tap to select
  const handleCardTap = useCallback(
    (cardId: string) => {
      const now = Date.now();
      if (lastTapRef.current?.cardId === cardId && now - lastTapRef.current.time < 300) {
        // Double-tap - select this card
        log.correct(`Manual correction: selected ${cardId}`);
        onSelect(cardId);
      } else {
        lastTapRef.current = { cardId, time: now };
      }
    },
    [onSelect]
  );

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

  // Format hash for display (already hex, just truncate)
  const formatHash = (hash?: string) => {
    if (!hash) return 'N/A';
    return hash.length > 8 ? hash.substring(0, 8) + '...' : hash;
  };

  // Get available types (from active card types in settings)
  const availableTypes = ALL_CARD_TYPES.filter((t) => activeCardTypes.includes(t));

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      style={{ touchAction: 'pan-y' }}
    >
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
          ← CANCEL
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

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - cropped image + debug info */}
        <div className="w-2/5 border-r border-[var(--showxating-gold-dim)] p-3 flex flex-col overflow-y-auto">
          <p
            className="text-[10px] tracking-wider uppercase mb-2"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            SCANNED REGION:
          </p>
          <div
            className="w-full rounded overflow-hidden border mb-3"
            style={{ borderColor: 'var(--showxating-gold-dim)' }}
          >
            <img
              src={croppedImage || scanImageDataUrl}
              alt="Scanned region"
              className="w-full object-contain"
              style={{ maxHeight: '35vh' }}
            />
          </div>

          {/* Debug info section */}
          <div className="space-y-2">
            {/* OCR Extracted text */}
            <div>
              <p
                className="text-[10px] tracking-wider uppercase mb-1"
                style={{ color: 'var(--showxating-gold-dim)' }}
              >
                EXTRACTED TEXT:
              </p>
              <p
                className="text-[10px] p-1.5 rounded bg-black/50 border break-words leading-relaxed"
                style={{
                  borderColor: 'var(--showxating-gold-dim)',
                  color: 'var(--showxating-gold)',
                  minHeight: '3rem',
                }}
              >
                {isOcrRunning ? (
                  <span style={{ color: 'var(--showxating-cyan)' }}>⟳ Running OCR...</span>
                ) : extractedText ? (
                  extractedText
                ) : (
                  <span style={{ color: 'var(--showxating-gold-dim)' }}>(waiting for image)</span>
                )}
              </p>
            </div>

            {/* Type filter selector */}
            <div>
              <p
                className="text-[10px] tracking-wider uppercase mb-1"
                style={{ color: 'var(--showxating-gold-dim)' }}
              >
                FILTER BY TYPE:
              </p>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as CardType | 'all')}
                className="w-full px-2 py-1.5 rounded bg-black/50 border text-xs"
                style={{
                  borderColor: 'var(--showxating-gold-dim)',
                  color: 'var(--showxating-gold)',
                  fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                }}
              >
                <option value="all">ALL TYPES</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {CARD_TYPE_LABELS[type].toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Computed hash */}
            <div>
              <p
                className="text-[10px] tracking-wider uppercase mb-1"
                style={{ color: 'var(--showxating-gold-dim)' }}
              >
                COMPUTED HASH:
              </p>
              <p
                className="text-[10px] p-1.5 rounded bg-black/50 border font-mono"
                style={{
                  borderColor: 'var(--showxating-gold-dim)',
                  color: 'var(--showxating-cyan)',
                }}
              >
                {formatHash(identifiedCard.computedHash)}
              </p>
            </div>

            {/* Original match info */}
            {identifiedCard.cardId !== 'unknown' && (
              <div>
                <p
                  className="text-[10px] tracking-wider uppercase mb-1"
                  style={{ color: 'var(--showxating-gold-dim)' }}
                >
                  ORIGINAL MATCH:
                </p>
                <p
                  className="text-[10px] p-1.5 rounded bg-black/50 border"
                  style={{
                    borderColor: 'var(--showxating-gold-dim)',
                    color: 'var(--showxating-gold)',
                  }}
                >
                  {identifiedCard.cardId} ({Math.round(identifiedCard.confidence * 100)}%)
                </p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <p
            className="mt-auto pt-3 text-[10px] tracking-wider uppercase text-center"
            style={{ color: 'var(--showxating-gold-dim)' }}
          >
            DOUBLE-TAP A CARD TO SELECT
          </p>
        </div>

        {/* Right panel - candidate list */}
        <div className="w-3/5 flex flex-col overflow-hidden">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-[var(--showxating-gold-dim)]">
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
                fontSize: '16px', // Prevents iOS zoom on focus
              }}
            />
          </div>

          {/* Scrollable candidate list - single column */}
          <div className="flex-1 overflow-y-auto px-3 py-2" style={{ touchAction: 'pan-y' }}>
            <p
              className="text-[10px] tracking-wider uppercase mb-2"
              style={{ color: 'var(--showxating-gold-dim)' }}
            >
              {searchQuery ? 'SEARCH RESULTS' : 'LIKELY MATCHES'} ({candidates.length}):
            </p>

            <div className="flex flex-col gap-2">
              {candidates.map(({ card, distance }) => (
                <button
                  key={card.id}
                  onClick={() => handleCardTap(card.id)}
                  className="flex items-center gap-3 p-2 rounded border transition-all active:bg-[var(--showxating-cyan)]/20"
                  style={{
                    borderColor:
                      card.id === identifiedCard.cardId
                        ? 'var(--showxating-cyan)'
                        : 'var(--showxating-gold-dim)',
                    touchAction: 'manipulation',
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}cards/full/${card.filename.replace('.png', '.webp')}`}
                    alt={card.ocr?.name || card.name}
                    className="w-16 h-24 object-cover rounded flex-shrink-0"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <span
                      className="text-xs tracking-wider uppercase block truncate"
                      style={{
                        color: 'var(--showxating-gold)',
                        fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
                      }}
                    >
                      {card.ocr?.name || card.name}
                    </span>
                    <span
                      className="text-[10px] tracking-wider block"
                      style={{ color: 'var(--showxating-gold-dim)' }}
                    >
                      {card.type.toUpperCase()}
                      {card.side && ` • ${card.side.toUpperCase()}`}
                    </span>
                    {distance !== undefined && (
                      <span
                        className="text-[9px] tracking-wider"
                        style={{ color: 'var(--showxating-cyan)' }}
                      >
                        distance: {distance}
                      </span>
                    )}
                  </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
