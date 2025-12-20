import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardStore } from '../store/cardStore';
import { CARD_TYPE_LABELS, SPECTRAL_TYPE_LABELS } from '../types/card';
import type { Card } from '../types/card';

export function CardDetail() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, isLoading } = useCardStore();
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const card = cards.find((c) => c.id === cardId);

  // Find related cards (other side, upgrade chain, etc.)
  const relatedCards = card?.relatedCards
    ? Object.values(card.relatedCards)
        .map((filename) => cards.find((c) => c.filename === filename))
        .filter((c): c is Card => c !== undefined)
    : undefined;

  // Find the other side of this card
  const otherSide = relatedCards?.find(
    (c) => c.cardGroupId === card?.cardGroupId && c.side !== card?.side
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          navigate('/');
          break;
        case ' ':
        case 'f':
          if (otherSide) {
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
    [navigate, otherSide, isFlipped]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setImageLoaded(false);
  }, [cardId]);

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

  const displayCard = isFlipped && otherSide ? otherSide : card;
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
                  key={displayCard.id}
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
              {otherSide && (
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

              {/* Stats */}
              {displayCard.ocr?.stats && Object.keys(displayCard.ocr.stats).length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Stats</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(displayCard.ocr.stats).map(([key, value]) => (
                      <div key={key} className="bg-space-700 rounded-lg p-3">
                        <div className="text-xs text-gray-400 uppercase">{key}</div>
                        <div className="text-lg font-bold text-white">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support Icons */}
              {displayCard.ocr?.supportIcons && displayCard.ocr.supportIcons.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-400 mb-2">Support</h2>
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
                {otherSide && (
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
