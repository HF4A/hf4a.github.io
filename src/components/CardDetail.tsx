import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardStore } from '../store/cardStore';
import { useFilterStore } from '../store/filterStore';
import { CARD_TYPE_LABELS, SPECTRAL_TYPE_LABELS } from '../types/card';
import type { Card, CardStats } from '../types/card';

// Touch gesture configuration
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for fast swipes

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isTracking: boolean;
  direction: 'horizontal' | 'vertical' | null;
}

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
  const [showDetails, setShowDetails] = useState(true);

  // Touch gesture state
  const touchRef = useRef<TouchState | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement>(null);

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
        // Normalize extension (.png in relatedCards, .webp in actual data)
        const normalizedFilename = filename.replace('.png', '.webp');
        const related = cards.find((c) => c.filename === normalizedFilename);
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
      .map((filename) => {
        // Normalize extension (.png in relatedCards, .webp in actual data)
        const normalizedFilename = filename.replace('.png', '.webp');
        return cards.find((c) => c.filename === normalizedFilename);
      })
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

  // Touch gesture handlers for card image area
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isTracking: true,
      direction: null,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current?.isTracking) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Determine direction on first significant movement
    if (!touchRef.current.direction && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      touchRef.current.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    // Prevent scrolling for any swipe on card image
    if (touchRef.current.direction) {
      e.preventDefault();
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current?.isTracking) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    const deltaTime = Date.now() - touchRef.current.startTime;
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    const direction = touchRef.current.direction;

    if (direction === 'horizontal') {
      // Swipe left or right to close
      if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD) {
        navigate('/');
      }
    } else if (direction === 'vertical') {
      // Swipe up to show details, down to hide
      if (Math.abs(deltaY) > SWIPE_THRESHOLD || velocityY > SWIPE_VELOCITY_THRESHOLD) {
        if (deltaY < 0) {
          // Swipe up - show details
          setShowDetails(true);
        } else {
          // Swipe down - hide details or close
          if (!showDetails) {
            navigate('/');
          } else {
            setShowDetails(false);
          }
        }
      }
    }

    touchRef.current = null;
  }, [navigate, showDetails]);

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

          {/* Card Image with Flip Animation - touch-none to capture all gestures */}
          <div
            className="flex-shrink-0 w-full lg:w-auto touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
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
          <motion.div
            ref={detailsPanelRef}
            className="flex-1 min-w-0"
            initial={{ opacity: 1, y: 0 }}
            animate={{
              opacity: showDetails ? 1 : 0,
              y: showDetails ? 0 : 50,
              height: showDetails ? 'auto' : 0,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
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
                  {displayCard.spreadsheet?.cardSubtype && (
                    <span className="chip bg-teal-900/50 text-teal-300">
                      {displayCard.spreadsheet.cardSubtype}
                    </span>
                  )}
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

              {/* Radiator Dual-Side Stats */}
              {displayCard.type === 'radiator' && displayCard.ocr?.stats?.lightSideMass !== undefined && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Radiator Sides</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-space-700 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium">Light Side</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-gray-500">Mass</div>
                          <div className="text-sm font-bold text-white">{displayCard.ocr.stats.lightSideMass}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Rad</div>
                          <div className="text-sm font-bold text-white">{displayCard.ocr.stats.lightSideRadHard}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Therms</div>
                          <div className="text-sm font-bold text-cyan-400">{displayCard.ocr.stats.lightSideTherms}</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-space-700 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium">Heavy Side</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-gray-500">Mass</div>
                          <div className="text-sm font-bold text-white">{displayCard.ocr.stats.heavySideMass}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Rad</div>
                          <div className="text-sm font-bold text-white">{displayCard.ocr.stats.heavySideRadHard}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Therms</div>
                          <div className="text-sm font-bold text-orange-400">{displayCard.ocr.stats.heavySideTherms}</div>
                        </div>
                      </div>
                    </div>
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

              {/* Promotion Colony */}
              {displayCard.spreadsheet?.promotionColony && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Promotion</h2>
                  <span className="chip bg-blue-900/50 text-blue-300">
                    {displayCard.spreadsheet.promotionColony}
                  </span>
                </div>
              )}

              {/* Colonist Info (Type, Specialty, Ideology) */}
              {(displayCard.spreadsheet?.colonistType || displayCard.spreadsheet?.specialty || displayCard.spreadsheet?.ideology) && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Colonist Info</h2>
                  <div className="flex flex-wrap gap-2">
                    {displayCard.spreadsheet?.colonistType && (
                      <span className={`chip ${displayCard.spreadsheet.colonistType === 'Robot' ? 'bg-cyan-900/50 text-cyan-300' : 'bg-amber-900/50 text-amber-300'}`}>
                        {displayCard.spreadsheet.colonistType}
                      </span>
                    )}
                    {displayCard.spreadsheet?.specialty && (
                      <span className="chip bg-indigo-900/50 text-indigo-300">
                        {displayCard.spreadsheet.specialty}
                      </span>
                    )}
                    {displayCard.spreadsheet?.ideology && (
                      <span className={`chip ${
                        displayCard.spreadsheet.ideology === 'Green' ? 'bg-green-900/50 text-green-300' :
                        displayCard.spreadsheet.ideology === 'Yellow' ? 'bg-yellow-900/50 text-yellow-300' :
                        displayCard.spreadsheet.ideology === 'Blue' ? 'bg-blue-900/50 text-blue-300' :
                        displayCard.spreadsheet.ideology === 'Red' ? 'bg-red-900/50 text-red-300' :
                        displayCard.spreadsheet.ideology === 'Purple' ? 'bg-purple-900/50 text-purple-300' :
                        displayCard.spreadsheet.ideology === 'Grey' ? 'bg-gray-700/50 text-gray-300' :
                        displayCard.spreadsheet.ideology === 'White' ? 'bg-gray-200/50 text-gray-800' :
                        'bg-gray-900/50 text-gray-300'
                      }`}>
                        {displayCard.spreadsheet.ideology}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Generator Type */}
              {displayCard.ocr?.stats?.generatorType && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Generator Type</h2>
                  <span className="chip bg-yellow-900/50 text-yellow-300">
                    {displayCard.ocr.stats.generatorType === 'push' ? '⟛ Push Generator' : 'e Electric Generator'}
                  </span>
                </div>
              )}

              {/* Reactor Type */}
              {displayCard.ocr?.stats?.reactorType && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Reactor Type</h2>
                  <span className={`chip ${
                    displayCard.ocr.stats.reactorType === 'X' ? 'bg-orange-900/50 text-orange-300' :
                    displayCard.ocr.stats.reactorType === 'wave' ? 'bg-cyan-900/50 text-cyan-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {displayCard.ocr.stats.reactorType === 'X' ? 'X Fission' :
                     displayCard.ocr.stats.reactorType === 'wave' ? '∿ Fusion' :
                     '💣 Antimatter'}
                  </span>
                </div>
              )}

              {/* Future (expansion content) */}
              {displayCard.spreadsheet?.future && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Future</h2>
                  <p className="text-gray-200 leading-relaxed bg-purple-900/30 border border-purple-700/50 rounded-lg p-3 text-sm">
                    {displayCard.spreadsheet.future}
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

              {/* Keyboard/gesture hints and Report Issue */}
              <div className="mt-6 pt-4 border-t border-space-700 text-xs text-gray-500 flex items-center justify-between">
                <div>
                  <span className="mr-4">
                    <kbd className="px-1.5 py-0.5 bg-space-700 rounded">Esc</kbd> Close
                  </span>
                  {upgradedSide && (
                    <span>
                      <kbd className="px-1.5 py-0.5 bg-space-700 rounded">Space</kbd> Flip
                    </span>
                  )}
                  <span className="hidden sm:inline ml-4 text-gray-600">
                    Swipe to navigate
                  </span>
                </div>
                <a
                  href={`https://docs.google.com/forms/d/e/1FAIpQLSfG1ylpJXQVvn2Q3yEQQzEgD6e1nX-Tsgf6WxNVmaow1p2_kw/viewform?usp=pp_url&entry.325757878=${encodeURIComponent(displayName)}&entry.93108582=${encodeURIComponent(window.location.href)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Report Issue
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
