/**
 * useCardIdentification Hook
 *
 * Provides card identification capabilities using dHash perceptual matching.
 * Integrates with the card detection system to identify detected cards.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCardMatcher, MatchResult } from '../services/cardMatcher';
import type { Point } from '../store/showxatingStore';

export interface DetectedCard {
  corners: Point[];
  confidence: number;
}

export interface IdentifiedCard extends DetectedCard {
  matchResult: MatchResult | null;
  isIdentifying: boolean;
}

interface UseCardIdentificationResult {
  // State
  isIndexLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  indexSize: number;

  // Methods
  loadIndex: () => Promise<void>;
  identifyFromCanvas: (
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ) => MatchResult[];
  identifyFromVideo: (
    video: HTMLVideoElement,
    region?: { x: number; y: number; width: number; height: number }
  ) => MatchResult[];
  identifyDetectedCards: (
    canvas: HTMLCanvasElement,
    detectedCards: DetectedCard[]
  ) => IdentifiedCard[];
  getBestMatch: (
    canvas: HTMLCanvasElement,
    region?: { x: number; y: number; width: number; height: number }
  ) => MatchResult | null;
}

export function useCardIdentification(): UseCardIdentificationResult {
  const [isIndexLoaded, setIsIndexLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexSize, setIndexSize] = useState(0);

  const matcherRef = useRef(getCardMatcher());

  // Load the card index
  const loadIndex = useCallback(async () => {
    if (isIndexLoaded || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await matcherRef.current.loadIndex();
      setIsIndexLoaded(true);
      setIndexSize(matcherRef.current.getIndexSize());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card index');
    } finally {
      setIsLoading(false);
    }
  }, [isIndexLoaded, isLoading]);

  // Auto-load index on mount
  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  // Identify cards from a canvas region
  const identifyFromCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      region?: { x: number; y: number; width: number; height: number }
    ): MatchResult[] => {
      if (!isIndexLoaded) {
        console.warn('[useCardIdentification] Index not loaded yet');
        return [];
      }

      try {
        return matcherRef.current.matchFromCanvas(canvas, region);
      } catch (err) {
        console.error('[useCardIdentification] Match error:', err);
        return [];
      }
    },
    [isIndexLoaded]
  );

  // Identify cards from a video frame
  const identifyFromVideo = useCallback(
    (
      video: HTMLVideoElement,
      region?: { x: number; y: number; width: number; height: number }
    ): MatchResult[] => {
      if (!isIndexLoaded) {
        console.warn('[useCardIdentification] Index not loaded yet');
        return [];
      }

      try {
        return matcherRef.current.matchFromVideo(video, region);
      } catch (err) {
        console.error('[useCardIdentification] Match error:', err);
        return [];
      }
    },
    [isIndexLoaded]
  );

  // Identify multiple detected cards
  const identifyDetectedCards = useCallback(
    (canvas: HTMLCanvasElement, detectedCards: DetectedCard[]): IdentifiedCard[] => {
      if (!isIndexLoaded) {
        return detectedCards.map((card) => ({
          ...card,
          matchResult: null,
          isIdentifying: true,
        }));
      }

      return detectedCards.map((card) => {
        try {
          // Get bounding box from corners
          const minX = Math.min(...card.corners.map((c: Point) => c.x));
          const maxX = Math.max(...card.corners.map((c: Point) => c.x));
          const minY = Math.min(...card.corners.map((c: Point) => c.y));
          const maxY = Math.max(...card.corners.map((c: Point) => c.y));

          const region = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };

          const matches = matcherRef.current.matchFromCanvas(canvas, region);

          return {
            ...card,
            matchResult: matches.length > 0 ? matches[0] : null,
            isIdentifying: false,
          };
        } catch (err) {
          console.error('[useCardIdentification] Error identifying card:', err);
          return {
            ...card,
            matchResult: null,
            isIdentifying: false,
          };
        }
      });
    },
    [isIndexLoaded]
  );

  // Get the single best match
  const getBestMatch = useCallback(
    (
      canvas: HTMLCanvasElement,
      region?: { x: number; y: number; width: number; height: number }
    ): MatchResult | null => {
      if (!isIndexLoaded) {
        return null;
      }

      try {
        return matcherRef.current.getBestMatch(canvas, region);
      } catch (err) {
        console.error('[useCardIdentification] Match error:', err);
        return null;
      }
    },
    [isIndexLoaded]
  );

  return {
    isIndexLoaded,
    isLoading,
    error,
    indexSize,
    loadIndex,
    identifyFromCanvas,
    identifyFromVideo,
    identifyDetectedCards,
    getBestMatch,
  };
}
