import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Card } from '../types/card';
import { CARD_TYPE_LABELS } from '../types/card';

interface CardThumbnailProps {
  card: Card;
}

export function CardThumbnail({ card }: CardThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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

  const displayName = card.ocr?.name || card.name || 'Unknown Card';
  const spectralType = card.ocr?.spectralType;
  const typeLabel = CARD_TYPE_LABELS[card.type] || card.type;

  // Build thumbnail path
  const thumbPath = `${import.meta.env.BASE_URL}cards/thumbs/${card.filename.replace(/\.(png|jpg)$/i, '.webp')}`;

  return (
    <Link
      to={`/card/${card.id}`}
      className="group block"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-space-800 card-shadow group-hover:card-shadow-hover transition-all duration-200 group-hover:scale-[1.02]">
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
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
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
        {card.side && (
          <div
            className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white/50 ${
              card.side === 'white' ? 'bg-white' : 'bg-gray-900'
            }`}
            title={`${card.side} side`}
          />
        )}

        {/* Related cards indicator */}
        {card.relatedCards && Object.keys(card.relatedCards).length > 0 && (
          <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs px-1.5 py-0.5 rounded">
            +{Object.keys(card.relatedCards).length}
          </div>
        )}
      </div>
    </Link>
  );
}
