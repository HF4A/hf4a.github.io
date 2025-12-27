import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import { CardInfoPanel } from './CardInfoPanel';
import { CARD_TYPE_LABELS } from '../types/card';
import type { Card } from '../types/card';

// Gesture thresholds
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

export function CardDetailView() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, isLoading } = useCardStore();
  const { showFlipped } = useFilterStore();
  const [isFlipped, setIsFlipped] = useState(showFlipped);
  const [baseImageLoaded, setBaseImageLoaded] = useState(false);
  const [promotedImageLoaded, setPromotedImageLoaded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Find all cards with this ID
  const cardVariants = useMemo(() => {
    return cards.filter((c) => c.id === cardId);
  }, [cards, cardId]);

  // Find the white (base) side and upgraded side
  const { baseSide, promotedSide } = useMemo(() => {
    let base: Card | undefined;
    let promoted: Card | undefined;

    for (const c of cardVariants) {
      // Determine base from upgradeChain if available
      if (c.upgradeChain && c.upgradeChain.length > 0) {
        const baseSideColor = c.upgradeChain[0].toLowerCase();
        if (c.side?.toLowerCase() === baseSideColor) {
          base = c;
        } else if (c.side) {
          promoted = c;
        }
      } else if (c.side?.toLowerCase() === 'white') {
        base = c;
      } else if (c.side) {
        promoted = c;
      }
    }

    // If we only found one card and it has relatedCards, look those up
    if (cardVariants.length === 1 && cardVariants[0].relatedCards) {
      const relatedFilenames = Object.values(cardVariants[0].relatedCards);
      for (const filename of relatedFilenames) {
        const related = cards.find((c) => c.filename === filename);
        if (related) {
          if (related.upgradeChain && related.upgradeChain.length > 0) {
            const baseSideColor = related.upgradeChain[0].toLowerCase();
            if (related.side?.toLowerCase() === baseSideColor) {
              base = related;
            } else if (related.side) {
              promoted = related;
            }
          } else if (related.side?.toLowerCase() === 'white') {
            base = related;
          } else if (related.side) {
            promoted = related;
          }
        }
      }
    }

    return { baseSide: base, promotedSide: promoted };
  }, [cardVariants, cards]);

  const card = baseSide || cardVariants[0];
  const canFlip = !!promotedSide;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (showInfo) {
            setShowInfo(false);
          } else {
            navigate('/catalog');
          }
          break;
        case ' ':
        case 'f':
          if (canFlip) {
            e.preventDefault();
            setIsFlipped(!isFlipped);
          }
          break;
        case 'i':
          e.preventDefault();
          setShowInfo(!showInfo);
          break;
      }
    },
    [navigate, canFlip, isFlipped, showInfo]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sync flip state with global showFlipped when card changes
  useEffect(() => {
    setIsFlipped(showFlipped);
    setBaseImageLoaded(false);
    setPromotedImageLoaded(false);
    setShowInfo(false);
  }, [cardId, showFlipped]);

  // Preload both images
  useEffect(() => {
    if (card) {
      const baseImg = new Image();
      baseImg.src = `${import.meta.env.BASE_URL}cards/full/${card.filename.replace(/\.(png|jpg)$/i, '.webp')}`;
      baseImg.onload = () => setBaseImageLoaded(true);
    }
    if (promotedSide) {
      const promotedImg = new Image();
      promotedImg.src = `${import.meta.env.BASE_URL}cards/full/${promotedSide.filename.replace(/\.(png|jpg)$/i, '.webp')}`;
      promotedImg.onload = () => setPromotedImageLoaded(true);
    }
  }, [card, promotedSide]);

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
        navigate('/catalog');
      }
      // Vertical swipe up = show info
      else if (offset.y < -SWIPE_THRESHOLD || velocity.y < -VELOCITY_THRESHOLD) {
        setShowInfo(true);
      }

      setDragX(0);
      setDragY(0);
    },
    [canFlip, isFlipped, navigate]
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]">
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderColor: '#d4a84b' }}
        />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0f]">
        <h2
          className="text-xl mb-4 tracking-wider uppercase"
          style={{ color: '#d4a84b', fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
        >
          Card not found
        </h2>
        <Link
          to="/catalog"
          className="px-4 py-2 border tracking-wider uppercase text-sm"
          style={{
            borderColor: '#d4a84b',
            color: '#d4a84b',
            fontFamily: "'Eurostile', 'Bank Gothic', sans-serif",
          }}
        >
          Back to Catalog
        </Link>
      </div>
    );
  }

  const displayCard = isFlipped && promotedSide ? promotedSide : card;
  const displayName = displayCard.ocr?.name || displayCard.name || 'Unknown Card';
  const imagePath = `${import.meta.env.BASE_URL}cards/full/${displayCard.filename.replace(/\.(png|jpg)$/i, '.webp')}`;
  const imageLoaded = isFlipped ? promotedImageLoaded : baseImageLoaded;

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col"
      style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
    >
      {/* Header with back and info buttons */}
      <header className="flex items-center justify-between px-4 py-3 z-10">
        <button
          onClick={() => navigate('/catalog')}
          className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
          style={{ borderColor: '#d4a84b50', color: '#a08040' }}
        >
          ← BACK
        </button>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`px-3 py-1 text-xs tracking-wider uppercase border transition-colors ${
            showInfo ? 'bg-[#d4a84b] text-[#0a0a0f]' : ''
          }`}
          style={{
            borderColor: showInfo ? '#d4a84b' : '#d4a84b50',
            color: showInfo ? '#0a0a0f' : '#a08040',
          }}
        >
          INFO
        </button>
      </header>

      {/* Main card area */}
      <main className="flex-1 flex items-center justify-center px-4 overflow-hidden">
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
          {/* Card image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={displayCard.filename}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
              style={{
                backfaceVisibility: 'hidden',
                transform: isFlipped ? 'rotateY(180deg)' : 'none',
              }}
            >
              {/* Loading skeleton */}
              {!imageLoaded && (
                <div
                  className="absolute inset-0 animate-pulse"
                  style={{ backgroundColor: '#1a1a2f' }}
                />
              )}

              <img
                src={imagePath}
                alt={displayName}
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: isFlipped ? 'rotateY(180deg)' : 'none',
                  filter: 'drop-shadow(0 0 20px rgba(212, 168, 75, 0.3))',
                }}
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>

          {/* Side indicator */}
          {displayCard.side && (
            <div
              className="absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor:
                  displayCard.side.toLowerCase() === 'white'
                    ? '#fff'
                    : displayCard.side.toLowerCase() === 'black'
                    ? '#1a1a2f'
                    : displayCard.side.toLowerCase() === 'purple'
                    ? '#8b5cf6'
                    : '#4a4a5f',
                borderColor: '#d4a84b50',
                color:
                  displayCard.side.toLowerCase() === 'white' ? '#0a0a0f' : '#fff',
                transform: isFlipped ? 'rotateY(180deg)' : 'none',
              }}
            >
              {displayCard.side.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Flip indicator */}
          {canFlip && (
            <div
              className="absolute bottom-3 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs tracking-wider uppercase"
              style={{
                color: '#a08040',
                backgroundColor: '#0a0a0f80',
              }}
            >
              ← SWIPE TO FLIP →
            </div>
          )}
        </motion.div>
      </main>

      {/* Card name footer */}
      <footer className="px-4 py-4 text-center">
        <h1
          className="text-lg tracking-wider uppercase truncate"
          style={{ color: '#d4a84b' }}
        >
          {displayName}
        </h1>
        <p
          className="text-xs tracking-wider uppercase mt-1"
          style={{ color: '#707080' }}
        >
          {CARD_TYPE_LABELS[displayCard.type] || displayCard.type}
          {displayCard.ocr?.spectralType && ` • ${displayCard.ocr.spectralType}`}
        </p>
      </footer>

      {/* Info Panel Overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-60 bg-[#0a0a0f] overflow-y-auto"
          >
            <InfoPanel card={displayCard} cards={cards} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Info Panel Component - uses shared CardInfoPanel
interface InfoPanelProps {
  card: Card;
  cards: Card[];
}

function InfoPanel({ card, cards }: InfoPanelProps) {
  const displayName = card.ocr?.name || card.name || 'Unknown Card';

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
    >
      {/* Header - just title, no close button (INFO button in parent toggles) */}
      <header className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-[#d4a84b]/30">
        <div className="px-4 py-3">
          <h1
            className="text-lg tracking-wider uppercase"
            style={{ color: '#d4a84b' }}
          >
            {displayName}
          </h1>
        </div>
      </header>

      {/* Content - uses shared component */}
      <div className="p-4">
        <CardInfoPanel card={card} cards={cards} showCardLinks />
      </div>
    </div>
  );
}
