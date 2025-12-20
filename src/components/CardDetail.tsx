import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import { CARD_TYPE_LABELS, SPECTRAL_TYPE_LABELS } from '../types/card';
import type { Card, CardStats } from '../types/card';

// Stat display labels
const STAT_LABELS: Record<string, string> = {
  mass: 'Mass',
  radHard: 'Rad-Hard',
  thrust: 'Thrust',
  fuelConsumption: 'Fuel',
  fuelType: 'Fuel Type',
  afterburn: 'Afterburn',
  bonusPivots: 'Pivots',
  therms: 'Therms',
  isru: 'ISRU',
  loadLimit: 'Load Limit',
  thrustModifier: 'Thrust Mod',
  fuelConsumptionModifier: 'Fuel Mod',
};

// Stats to display as primary (in order)
const PRIMARY_STATS = ['mass', 'radHard', 'thrust', 'fuelConsumption', 'therms', 'isru', 'loadLimit'];

// Boolean stats that should be shown as badges
const BOOLEAN_STATS = ['push', 'solar', 'airEater', 'missile', 'raygun', 'buggy', 'powersat', 'hasGenerator', 'factoryLoadingOnly'];

// Format a stat value for display
function formatStatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '—';
  return String(value);
}

// Support requirement labels
const SUPPORT_LABELS: Record<string, string> = {
  generatorPush: '⟛ Gen',
  generatorElectric: 'e Gen',
  reactorFission: 'X Reactor',
  reactorFusion: '∿ Reactor',
  reactorAntimatter: '💣 Reactor',
  reactorAny: 'Any Reactor',
  solar: 'Solar',
};

export function CardDetail() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, isLoading } = useCardStore();
  const { showFlipped } = useFilterStore();
  const [isFlipped, setIsFlipped] = useState(showFlipped);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Find all cards with this ID (both sides have the same ID)
  const cardVariants = useMemo(() => {
    return cards.filter((c) => c.id === cardId);
  }, [cards, cardId]);

  // Find the white (base) side and upgraded side
  const { whiteSide, upgradedSide } = useMemo(() => {
    let white: Card | undefined;
    let upgraded: Card | undefined;

    for (const c of cardVariants) {
      if (c.side?.toLowerCase() === 'white') {
        white = c;
      } else if (c.side) {
        upgraded = c;
      }
    }

    // If we only found one card and it has relatedCards, look those up too
    if (cardVariants.length === 1 && cardVariants[0].relatedCards) {
      const relatedFilenames = Object.values(cardVariants[0].relatedCards);
      for (const filename of relatedFilenames) {
        const related = cards.find((c) => c.filename === filename);
        if (related?.side?.toLowerCase() === 'white') {
          white = related;
        } else if (related?.side) {
          upgraded = related;
        }
      }
    }

    return { whiteSide: white, upgradedSide: upgraded };
  }, [cardVariants, cards]);

  // The base card to use (prefer white side, fallback to first variant)
  const card = whiteSide || cardVariants[0];

  // Find all related cards for display
  const relatedCards = useMemo(() => {
    if (!card?.relatedCards) return undefined;
    return Object.values(card.relatedCards)
      .map((filename) => cards.find((c) => c.filename === filename))
      .filter((c): c is Card => c !== undefined);
  }, [card, cards]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          navigate('/');
          break;
        case ' ':
        case 'f':
          if (upgradedSide) {
            e.preventDefault();
            setIsFlipped(!isFlipped);
          }
          break;
        case 'ArrowLeft':
          // Navigate to previous card in filtered list
          break;
        case 'ArrowRight':
          // Navigate to next card in filtered list
          break;
      }
    },
    [navigate, upgradedSide, isFlipped]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sync flip state with global showFlipped when card changes
  useEffect(() => {
    setIsFlipped(showFlipped);
    setImageLoaded(false);
  }, [cardId, showFlipped]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
        <h2 className="text-xl text-white mb-4">Card not found</h2>
        <Link to="/" className="btn-primary">
          Back to Gallery
        </Link>
      </div>
    );
  }

  const displayCard = isFlipped && upgradedSide ? upgradedSide : card;
  const displayName = displayCard.ocr?.name || displayCard.name || 'Unknown Card';
  const imagePath = `${import.meta.env.BASE_URL}cards/full/${displayCard.filename.replace(/\.(png|jpg)$/i, '.webp')}`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm"
      onClick={() => navigate('/')}
    >
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div
          className="relative max-w-5xl w-full flex flex-col lg:flex-row gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => navigate('/')}
            className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-space-700 text-gray-400 hover:text-white hover:bg-space-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Card Image with Flip Animation */}
          <div className="flex-shrink-0 w-full lg:w-auto">
            <div
              className="relative mx-auto perspective-1000"
              style={{ width: 'min(100%, 400px)', aspectRatio: '2/3' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={displayCard.filename}
                  initial={{ rotateY: isFlipped ? -180 : 0, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: isFlipped ? 180 : -180, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="w-full h-full preserve-3d"
                >
                  {/* Loading skeleton */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-space-700 rounded-xl animate-pulse" />
                  )}

                  <img
                    src={imagePath}
                    alt={displayName}
                    onLoad={() => setImageLoaded(true)}
                    className={`w-full h-full object-contain rounded-xl card-shadow transition-opacity duration-300 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Flip button */}
              {upgradedSide && (
                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="absolute bottom-4 right-4 p-3 rounded-full bg-space-700/90 text-white hover:bg-space-600 transition-colors"
                  title="Flip card (F or Space)"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}

              {/* Side indicator */}
              <div className="absolute top-4 right-4 flex gap-2">
                {card.side && (
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      displayCard.side === 'white'
                        ? 'bg-white border-gray-300 text-black'
                        : 'bg-gray-900 border-gray-600 text-white'
                    }`}
                  >
                    <span className="text-xs font-bold">
                      {displayCard.side === 'white' ? 'W' : 'B'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="flex-1 min-w-0">
            <div className="bg-space-800 rounded-xl p-6">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                  {displayCard.ocr?.cardId && (
                    <span className="text-sm text-gray-500 font-mono">
                      {displayCard.ocr.cardId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="chip chip-active">
                    {CARD_TYPE_LABELS[displayCard.type] || displayCard.type}
                  </span>
                  {displayCard.ocr?.spectralType && (
                    <span className="chip">
                      {(SPECTRAL_TYPE_LABELS as Record<string, string>)[displayCard.ocr.spectralType] || displayCard.ocr.spectralType}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {displayCard.ocr?.description && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Description</h2>
                  <p className="text-gray-200 leading-relaxed">
                    {displayCard.ocr.description}
                  </p>
                </div>
              )}

              {/* Primary Stats */}
              {displayCard.ocr?.stats && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Stats</h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {PRIMARY_STATS.map((key) => {
                      const value = (displayCard.ocr?.stats as CardStats)?.[key as keyof CardStats];
                      if (value === undefined || value === null) return null;
                      return (
                        <div key={key} className="bg-space-700 rounded-lg p-3 text-center">
                          <div className="text-xs text-gray-400">{STAT_LABELS[key] || key}</div>
                          <div className="text-lg font-bold text-white">{formatStatValue(value)}</div>
                        </div>
                      );
                    })}
                    {/* Show afterburn and pivots as smaller stats */}
                    {displayCard.ocr?.stats?.afterburn !== undefined && displayCard.ocr.stats.afterburn > 0 && (
                      <div className="bg-space-700 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Afterburn</div>
                        <div className="text-lg font-bold text-orange-400">+{displayCard.ocr.stats.afterburn}</div>
                      </div>
                    )}
                    {displayCard.ocr?.stats?.bonusPivots !== undefined && displayCard.ocr.stats.bonusPivots > 0 && (
                      <div className="bg-space-700 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-400">Pivots</div>
                        <div className="text-lg font-bold text-blue-400">+{displayCard.ocr.stats.bonusPivots}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Boolean Capabilities */}
              {displayCard.ocr?.stats && (
                (() => {
                  const capabilities = BOOLEAN_STATS
                    .filter((key) => (displayCard.ocr?.stats as CardStats)?.[key as keyof CardStats] === true)
                    .map((key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()));
                  if (capabilities.length === 0) return null;
                  return (
                    <div className="mb-6">
                      <h2 className="text-sm font-medium text-gray-400 mb-2">Capabilities</h2>
                      <div className="flex flex-wrap gap-2">
                        {capabilities.map((cap) => (
                          <span key={cap} className="chip bg-green-900/50 text-green-300">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Support Requirements */}
              {displayCard.ocr?.supportRequirements && (
                (() => {
                  const reqs = Object.entries(displayCard.ocr.supportRequirements)
                    .filter(([, value]) => value === true)
                    .map(([key]) => SUPPORT_LABELS[key] || key);
                  if (reqs.length === 0) return null;
                  return (
                    <div className="mb-6">
                      <h2 className="text-sm font-medium text-gray-400 mb-2">Requires</h2>
                      <div className="flex flex-wrap gap-2">
                        {reqs.map((req) => (
                          <span key={req} className="chip bg-yellow-900/50 text-yellow-300">
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Ability */}
              {displayCard.ocr?.ability && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Ability</h2>
                  <p className="text-gray-200 leading-relaxed bg-space-700 rounded-lg p-3">
                    {displayCard.ocr.ability}
                  </p>
                </div>
              )}

              {/* Support Icons (from OCR) */}
              {displayCard.ocr?.supportIcons && displayCard.ocr.supportIcons.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Support Icons</h2>
                  <div className="flex flex-wrap gap-2">
                    {displayCard.ocr.supportIcons.map((icon, i) => (
                      <span key={i} className="chip">
                        {icon}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Cards */}
              {relatedCards && relatedCards.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Related Cards</h2>
                  <div className="flex flex-wrap gap-2">
                    {relatedCards.map((related) => (
                      <Link
                        key={related.id}
                        to={`/card/${related.id}`}
                        className={`chip hover:chip-active ${
                          related.id === displayCard.id ? 'chip-active' : ''
                        }`}
                      >
                        {related.ocr?.name || related.name || related.id}
                        {related.side && (
                          <span className={`ml-1 w-3 h-3 rounded-full inline-block ${
                            related.side === 'white' ? 'bg-white' : 'bg-gray-900 border border-gray-600'
                          }`} />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Keyboard hints */}
              <div className="mt-6 pt-4 border-t border-space-700 text-xs text-gray-500">
                <span className="mr-4">
                  <kbd className="px-1.5 py-0.5 bg-space-700 rounded">Esc</kbd> Close
                </span>
                {upgradedSide && (
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-space-700 rounded">Space</kbd> Flip
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
