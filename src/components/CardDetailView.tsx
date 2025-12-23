import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import { CARD_TYPE_LABELS, SPECTRAL_TYPE_LABELS, SPECIALTY_LABELS } from '../types/card';
import type { Card, CardStats } from '../types/card';

// Gesture thresholds
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

// Stat display labels
const STAT_LABELS: Record<string, string> = {
  mass: 'Mass',
  radHard: 'Rad-Hard',
  thrust: 'Thrust',
  fuelConsumption: 'Fuel',
  therms: 'Therms',
  isru: 'ISRU',
  loadLimit: 'Load Limit',
  afterburn: 'Afterburn',
  bonusPivots: 'Pivots',
};

const PRIMARY_STATS = ['mass', 'radHard', 'thrust', 'fuelConsumption', 'therms', 'isru', 'loadLimit'];
const BOOLEAN_STATS = ['push', 'solar', 'airEater', 'missile', 'raygun', 'buggy', 'powersat', 'hasGenerator', 'factoryLoadingOnly'];

function formatStatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '—';
  return String(value);
}

const SUPPORT_LABELS: Record<string, string> = {
  generatorPush: '⟛ Gen',
  generatorElectric: 'e Gen',
  reactorFission: 'X Reactor',
  reactorFusion: '∿ Reactor',
  reactorAntimatter: '💣 Reactor',
  reactorAny: 'Any Reactor',
  solar: 'Solar',
};

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
            <InfoPanel
              card={displayCard}
              onClose={() => setShowInfo(false)}
              cards={cards}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Info Panel Component
interface InfoPanelProps {
  card: Card;
  onClose: () => void;
  cards: Card[];
}

function InfoPanel({ card, onClose, cards }: InfoPanelProps) {
  const displayName = card.ocr?.name || card.name || 'Unknown Card';

  // Find related cards
  const relatedCards = useMemo(() => {
    if (!card.relatedCards) return undefined;
    return Object.values(card.relatedCards)
      .map((filename) => cards.find((c) => c.filename === filename))
      .filter((c): c is Card => c !== undefined);
  }, [card, cards]);

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "'Eurostile', 'Bank Gothic', sans-serif" }}
    >
      {/* Header - close button on LEFT */}
      <header className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-[#d4a84b]/30">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors"
            style={{ borderColor: '#d4a84b50', color: '#a08040' }}
          >
            ← CLOSE
          </button>
          {/* Empty space on right to balance layout */}
          <div />
        </div>
        {/* Card title below buttons */}
        <div className="px-4 pb-3">
          <h1
            className="text-lg tracking-wider uppercase"
            style={{ color: '#d4a84b' }}
          >
            {displayName}
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Type & Spectral */}
        <div className="flex flex-wrap gap-2">
          <span
            className="px-3 py-1 text-xs tracking-wider uppercase border"
            style={{ backgroundColor: '#d4a84b', color: '#0a0a0f', borderColor: '#d4a84b' }}
          >
            {CARD_TYPE_LABELS[card.type] || card.type}
          </span>
          {card.spreadsheet?.cardSubtype && (
            <span
              className="px-3 py-1 text-xs tracking-wider uppercase border"
              style={{ borderColor: '#00d4ff50', color: '#00d4ff' }}
            >
              {card.spreadsheet.cardSubtype}
            </span>
          )}
          {card.ocr?.spectralType && (
            <span
              className="px-3 py-1 text-xs tracking-wider uppercase border"
              style={{ borderColor: '#d4a84b50', color: '#a08040' }}
            >
              {(SPECTRAL_TYPE_LABELS as Record<string, string>)[card.ocr.spectralType] || card.ocr.spectralType}
            </span>
          )}
          {card.ocr?.cardId && (
            <span
              className="px-3 py-1 text-xs tracking-wider font-mono"
              style={{ color: '#707080' }}
            >
              {card.ocr.cardId}
            </span>
          )}
        </div>

        {/* Description */}
        {card.ocr?.description && (
          <Section title="Description">
            <p style={{ color: '#c0c0d0' }} className="leading-relaxed">
              {card.ocr.description}
            </p>
          </Section>
        )}

        {/* Primary Stats */}
        {card.ocr?.stats && (
          <Section title="Stats">
            <div className="grid grid-cols-3 gap-2">
              {PRIMARY_STATS.map((key) => {
                const value = (card.ocr?.stats as CardStats)?.[key as keyof CardStats];
                if (value === undefined || value === null) return null;
                return (
                  <div
                    key={key}
                    className="p-3 text-center border"
                    style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f' }}
                  >
                    <div className="text-xs" style={{ color: '#707080' }}>
                      {STAT_LABELS[key] || key}
                    </div>
                    <div className="text-lg font-bold" style={{ color: '#d4a84b' }}>
                      {formatStatValue(value)}
                    </div>
                  </div>
                );
              })}
              {card.ocr?.stats?.afterburn !== undefined && card.ocr.stats.afterburn > 0 && (
                <div
                  className="p-3 text-center border"
                  style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f' }}
                >
                  <div className="text-xs" style={{ color: '#707080' }}>
                    Afterburn
                  </div>
                  <div className="text-lg font-bold" style={{ color: '#ff8844' }}>
                    +{card.ocr.stats.afterburn}
                  </div>
                </div>
              )}
              {card.ocr?.stats?.bonusPivots !== undefined && card.ocr.stats.bonusPivots > 0 && (
                <div
                  className="p-3 text-center border"
                  style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f' }}
                >
                  <div className="text-xs" style={{ color: '#707080' }}>
                    Pivots
                  </div>
                  <div className="text-lg font-bold" style={{ color: '#00d4ff' }}>
                    +{card.ocr.stats.bonusPivots}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Radiator Dual-Side Stats */}
        {card.type === 'radiator' && card.ocr?.stats?.lightSideMass !== undefined && (
          <Section title="Radiator Sides">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border" style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f' }}>
                <div className="text-xs mb-2 font-medium" style={{ color: '#a08040' }}>Light Side</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Mass</div>
                    <div style={{ color: '#d4a84b' }}>{card.ocr.stats.lightSideMass}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Rad</div>
                    <div style={{ color: '#d4a84b' }}>{card.ocr.stats.lightSideRadHard}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Therms</div>
                    <div style={{ color: '#00d4ff' }}>{card.ocr.stats.lightSideTherms}</div>
                  </div>
                </div>
              </div>
              <div className="p-3 border" style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f' }}>
                <div className="text-xs mb-2 font-medium" style={{ color: '#a08040' }}>Heavy Side</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Mass</div>
                    <div style={{ color: '#d4a84b' }}>{card.ocr.stats.heavySideMass}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Rad</div>
                    <div style={{ color: '#d4a84b' }}>{card.ocr.stats.heavySideRadHard}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#707080' }}>Therms</div>
                    <div style={{ color: '#ff8844' }}>{card.ocr.stats.heavySideTherms}</div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Boolean Capabilities */}
        {card.ocr?.stats && (
          (() => {
            const capabilities = BOOLEAN_STATS
              .filter((key) => (card.ocr?.stats as CardStats)?.[key as keyof CardStats] === true)
              .map((key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()));
            if (capabilities.length === 0) return null;
            return (
              <Section title="Capabilities">
                <div className="flex flex-wrap gap-2">
                  {capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-3 py-1 text-xs tracking-wider uppercase border"
                      style={{ borderColor: '#22c55e50', color: '#22c55e' }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </Section>
            );
          })()
        )}

        {/* Support Requirements */}
        {card.ocr?.supportRequirements && (
          (() => {
            const reqs = Object.entries(card.ocr.supportRequirements)
              .filter(([, value]) => value === true)
              .map(([key]) => SUPPORT_LABELS[key] || key);
            if (reqs.length === 0) return null;
            return (
              <Section title="Requires">
                <div className="flex flex-wrap gap-2">
                  {reqs.map((req) => (
                    <span
                      key={req}
                      className="px-3 py-1 text-xs tracking-wider uppercase border"
                      style={{ borderColor: '#eab30850', color: '#eab308' }}
                    >
                      {req}
                    </span>
                  ))}
                </div>
              </Section>
            );
          })()
        )}

        {/* Ability */}
        {card.ocr?.ability && (
          <Section title="Ability">
            <p
              className="leading-relaxed p-3 border"
              style={{ borderColor: '#d4a84b30', backgroundColor: '#1a1a2f', color: '#c0c0d0' }}
            >
              {card.ocr.ability}
            </p>
          </Section>
        )}

        {/* Colonist Info */}
        {(card.spreadsheet?.colonistType || card.spreadsheet?.specialty || card.spreadsheet?.ideology) && (
          <Section title="Colonist">
            <div className="flex flex-wrap gap-2">
              {card.spreadsheet?.colonistType && (
                <span
                  className="px-3 py-1 text-xs tracking-wider uppercase border"
                  style={{
                    borderColor: card.spreadsheet.colonistType === 'Robot' ? '#00d4ff50' : '#f5920050',
                    color: card.spreadsheet.colonistType === 'Robot' ? '#00d4ff' : '#f59200',
                  }}
                >
                  {card.spreadsheet.colonistType}
                </span>
              )}
              {card.spreadsheet?.specialty && (
                <span
                  className="px-3 py-1 text-xs tracking-wider uppercase border"
                  style={{ borderColor: '#8b5cf650', color: '#8b5cf6' }}
                >
                  {SPECIALTY_LABELS[card.spreadsheet.specialty as keyof typeof SPECIALTY_LABELS] || card.spreadsheet.specialty}
                </span>
              )}
              {card.spreadsheet?.ideology && (
                <span
                  className="px-3 py-1 text-xs tracking-wider uppercase border"
                  style={{
                    borderColor: '#a0804050',
                    color: '#a08040',
                  }}
                >
                  {card.spreadsheet.ideology}
                </span>
              )}
            </div>
          </Section>
        )}

        {/* Promotion */}
        {card.spreadsheet?.promotionColony && (
          <Section title="Promotion">
            <span
              className="px-3 py-1 text-xs tracking-wider uppercase border"
              style={{ borderColor: '#3b82f650', color: '#3b82f6' }}
            >
              {card.spreadsheet.promotionColony}
            </span>
          </Section>
        )}

        {/* Generator Type */}
        {card.ocr?.stats?.generatorType && (
          <Section title="Generator Type">
            <span
              className="px-3 py-1 text-xs tracking-wider uppercase border"
              style={{ borderColor: '#eab30850', color: '#eab308' }}
            >
              {card.ocr.stats.generatorType === 'push' ? '⟛ Push Generator' : 'e Electric Generator'}
            </span>
          </Section>
        )}

        {/* Reactor Type */}
        {card.ocr?.stats?.reactorType && (
          <Section title="Reactor Type">
            <span
              className="px-3 py-1 text-xs tracking-wider uppercase border"
              style={{
                borderColor:
                  card.ocr.stats.reactorType === 'X' ? '#f9731650' :
                  card.ocr.stats.reactorType === 'wave' ? '#00d4ff50' :
                  '#ef444450',
                color:
                  card.ocr.stats.reactorType === 'X' ? '#f97316' :
                  card.ocr.stats.reactorType === 'wave' ? '#00d4ff' :
                  '#ef4444',
              }}
            >
              {card.ocr.stats.reactorType === 'X' ? 'X Fission' :
               card.ocr.stats.reactorType === 'wave' ? '∿ Fusion' :
               '💣 Antimatter'}
            </span>
          </Section>
        )}

        {/* Future */}
        {card.spreadsheet?.future && (
          <Section title="Future">
            <p
              className="leading-relaxed p-3 border text-sm"
              style={{ borderColor: '#8b5cf630', backgroundColor: '#1a1a2f', color: '#a08040' }}
            >
              {card.spreadsheet.future}
            </p>
          </Section>
        )}

        {/* Related Cards */}
        {relatedCards && relatedCards.length > 0 && (
          <Section title="Related Cards">
            <div className="flex flex-wrap gap-2">
              {relatedCards.map((related) => (
                <Link
                  key={related.id}
                  to={`/catalog/card/${related.id}`}
                  className="px-3 py-1 text-xs tracking-wider uppercase border transition-colors hover:bg-[#d4a84b]/10"
                  style={{ borderColor: '#d4a84b50', color: '#a08040' }}
                >
                  {related.ocr?.name || related.name || related.id}
                  {related.side && (
                    <span
                      className="ml-2 w-3 h-3 rounded-full inline-block"
                      style={{
                        backgroundColor:
                          related.side.toLowerCase() === 'white' ? '#fff' :
                          related.side.toLowerCase() === 'black' ? '#1a1a2f' :
                          '#4a4a5f',
                        border: '1px solid #d4a84b50',
                      }}
                    />
                  )}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Report Issue */}
        <div className="pt-4 border-t" style={{ borderColor: '#d4a84b20' }}>
          <a
            href={`https://docs.google.com/forms/d/e/1FAIpQLSfG1ylpJXQVvn2Q3yEQQzEgD6e1nX-Tsgf6WxNVmaow1p2_kw/viewform?usp=pp_url&entry.325757878=${encodeURIComponent(displayName)}&entry.93108582=${encodeURIComponent(window.location.href)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs tracking-wider uppercase transition-colors"
            style={{ color: '#707080' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Report Issue
          </a>
        </div>
      </div>
    </div>
  );
}

// Section helper component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-xs tracking-wider uppercase mb-2"
        style={{ color: '#a08040' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
