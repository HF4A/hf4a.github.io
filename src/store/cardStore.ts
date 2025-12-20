import { create } from 'zustand';
import type { Card } from '../types/card';

interface CardStore {
  cards: Card[];
  selectedCard: Card | null;
  isLoading: boolean;
  error: string | null;
  setCards: (cards: Card[]) => void;
  setSelectedCard: (card: Card | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCardStore = create<CardStore>((set) => ({
  cards: [],
  selectedCard: null,
  isLoading: true,
  error: null,

  setCards: (cards) => set({ cards, isLoading: false }),
  setSelectedCard: (card) => set({ selectedCard: card }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}));
