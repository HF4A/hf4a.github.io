import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Card } from '../types/card';
import { CARD_TYPE_LABELS } from '../types/card';
import { useFilterStore } from '../store/filterStore';
import { useCardStore } from '../store/cardStore';

interface CardThumbnailProps {
  card: Card;
}

export function CardThumbnail({ card }: CardThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { showFlipped } = useFilterStore();
  const { cards } = useCardStore();

  // Find the upgraded (non-white) version of this card
  const upgradedCard = useMemo(() => {
    if (!card.relatedCards || !showFlipped) return null;

    // Look for a related card that's not white (upgraded side)
    const relatedFilenames = Object.values(card.relatedCards);
    for (const filename of relatedFilenames) {
      const related = cards.find((c) => c.filename === filename);
      if (related && related.side && related.side.toLowerCase() !== 'white') {
        return related;
      }
    }
    return null;
  }, [card, cards, showFlipped]);

  // The card to display (either base or upgraded)
  const displayCard = showFlipped && upgradedCard ? upgradedCard : card;

  // Reset loaded state when card changes
  useEffect(() => {
    setIsLoaded(false);
  }, [displayCard.id]);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const displayName = displayCard.ocr?.name || displayCard.name || 'Unknown Card';
  const spectralType = displayCard.ocr?.spectralType;
  const typeLabel = CARD_TYPE_LABELS[displayCard.type] || displayCard.type;

  // Build thumbnail path
  const thumbPath = `${import.meta.env.BASE_URL}cards/thumbs/${displayCard.filename.replace(/\.(png|jpg)$/i, '.webp')}`;

  return (
    <Link
      to={`/card/${card.id}`}
      className="group block"
    >
      <motion.div
        className="relative aspect-[2/3] rounded-lg overflow-hidden bg-space-800 card-shadow group-hover:card-shadow-hover transition-all duration-200 group-hover:scale-[1.02]"
        animate={{ rotateY: showFlipped && upgradedCard ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card face */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: 'hidden',
            transform: showFlipped && upgradedCard ? 'rotateY(180deg)' : 'none'
          }}
        >
          {/* Placeholder skeleton */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-space-700 animate-pulse" />
          )}

          {/* Image */}
          <img
            ref={imgRef}
            src={isVisible ? thumbPath : undefined}
            alt={displayName}
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: showFlipped && upgradedCard ? 'rotateY(180deg)' : 'none' }}
          />

          {/* Overlay on hover */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ transform: showFlipped && upgradedCard ? 'rotateY(180deg)' : 'none' }}
          >
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="text-white font-medium text-sm truncate">
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-300">{typeLabel}</span>
                {spectralType && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{spectralType}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Side indicator */}
          {displayCard.side && (
            <div
              className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white/50 ${
                displayCard.side.toLowerCase() === 'white' ? 'bg-white' :
                displayCard.side.toLowerCase() === 'black' ? 'bg-gray-900' :
                displayCard.side.toLowerCase() === 'purple' ? 'bg-purple-500' :
                'bg-gray-500'
              }`}
              style={{ transform: showFlipped && upgradedCard ? 'rotateY(180deg)' : 'none' }}
              title={`${displayCard.side} side`}
            />
          )}
        </div>
      </motion.div>
    </Link>
  );
}
