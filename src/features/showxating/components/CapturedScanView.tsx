/**
 * CapturedScanView - Displays a captured scan with card overlays
 *
 * Shows the captured image with identified cards overlaid.
 * Tap card to flip, long-press to open detail view.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShowxatingStore, IdentifiedCard } from '../store/showxatingStore';
import { useCardStore } from '../../../store/cardStore';

interface CapturedScanViewProps {
  slotId: 's1' | 's2' | 's3';
}

export function CapturedScanView({ slotId }: CapturedScanViewProps) {
  const navigate = useNavigate();
  const { scanSlots, updateCardFlip } = useShowxatingStore();
  const { cards } = useCardStore();
  const scan = scanSlots[slotId];

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
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
          containerSize={containerSize}
          imageRef={imageRef}
          onFlip={() => updateCardFlip(slotId, index, !card.showingOpposite)}
          onOpenDetail={() => {
            // Find the card in the catalog and navigate to detail
            const catalogCard = cards.find((c) => c.id === card.cardId);
            if (catalogCard) {
              navigate(`/catalog/${catalogCard.id}`);
            }
          }}
        />
      ))}

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
  containerSize: { width: number; height: number };
  imageRef: React.RefObject<HTMLImageElement>;
  onFlip: () => void;
  onOpenDetail: () => void;
}

function CardOverlay({
  card,
  containerSize,
  imageRef,
  onFlip,
  onOpenDetail,
}: CardOverlayProps) {
  const { cards: catalogCards } = useCardStore();
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // Find the catalog card to get the image
  const catalogCard = catalogCards.find((c) => c.id === card.cardId);

  // Get the image to display based on flip state
  const getDisplayFilename = useCallback(() => {
    if (!catalogCard) return card.filename;

    if (card.showingOpposite) {
      // Show opposite side
      const relatedCard = catalogCards.find(
        (c) => c.relatedCards?.promotedSide === catalogCard.id ||
               catalogCard.relatedCards?.promotedSide === c.id
      );
      return relatedCard?.filename || catalogCard.filename;
    }
    return catalogCard.filename;
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

  const handleTouchStart = () => {
    setIsLongPress(false);
    longPressRef.current = setTimeout(() => {
      setIsLongPress(true);
      onOpenDetail();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
    if (!isLongPress) {
      onFlip();
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
      >
        <div className="scan-animation" />
        <span className="hud-text text-sm">UNIDENTIFIED</span>
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
      {/* Card image */}
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
          {card.showingOpposite ? 'OPP' : 'VIS'}
        </span>
      </div>
    </div>
  );
}
