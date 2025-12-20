import { useState, useEffect, useRef } from 'react';
import { useCards } from '../hooks/useCards';
import { CardThumbnail } from './CardThumbnail';
import { useFilterStore } from '../store/filterStore';

export function CardGrid() {
  const { cards: filteredCards, isLoading, error } = useCards();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevCardsRef = useRef<string[]>([]);

  // Get filter state to detect changes
  const { cardTypes, spectralTypes, specialties, reactorTypes, generatorTypes, searchQuery } = useFilterStore();

  // Brief transition when filters change to smooth the visual update
  useEffect(() => {
    const currentIds = filteredCards.map(c => c.filename).sort().join(',');
    const prevIds = prevCardsRef.current.join(',');

    if (prevIds && currentIds !== prevIds) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 150);
      return () => clearTimeout(timer);
    }

    prevCardsRef.current = filteredCards.map(c => c.filename).sort();
  }, [filteredCards, cardTypes, spectralTypes, specialties, reactorTypes, generatorTypes, searchQuery]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-lg bg-space-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-red-400 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-white mb-1">Error loading cards</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  if (filteredCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-gray-500 mb-2">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-white mb-1">No cards found</h2>
        <p className="text-gray-400">Try adjusting your filters or search query</p>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 transition-opacity duration-150 ${
        isTransitioning ? 'opacity-70' : 'opacity-100'
      }`}
    >
      {filteredCards.map((card: import('../types/card').Card) => (
        <CardThumbnail key={card.filename} card={card} />
      ))}
    </div>
  );
}
