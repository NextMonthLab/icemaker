import { useCallback, useMemo } from "react";

const STORAGE_KEY = "storyflix_progress";

interface ProgressData {
  [universeId: number]: {
    watchedCardIds: number[];
    lastWatchedAt: string;
  };
}

function getStoredProgress(): ProgressData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setStoredProgress(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function useLocalProgress() {
  const getWatchedCards = useCallback((universeId: number): number[] => {
    const progress = getStoredProgress();
    return progress[universeId]?.watchedCardIds || [];
  }, []);

  const markCardWatched = useCallback((universeId: number, cardId: number): void => {
    const progress = getStoredProgress();
    const universeProgress = progress[universeId] || { watchedCardIds: [], lastWatchedAt: "" };
    
    if (!universeProgress.watchedCardIds.includes(cardId)) {
      universeProgress.watchedCardIds.push(cardId);
      universeProgress.lastWatchedAt = new Date().toISOString();
      progress[universeId] = universeProgress;
      setStoredProgress(progress);
    }
  }, []);

  const getNextUnwatchedIndex = useCallback((universeId: number, cards: { id: number }[]): number => {
    const watchedIds = getWatchedCards(universeId);
    
    // Find the first unwatched card
    for (let i = 0; i < cards.length; i++) {
      if (!watchedIds.includes(cards[i].id)) {
        return i;
      }
    }
    
    // All watched - return the last card
    return cards.length > 0 ? cards.length - 1 : 0;
  }, [getWatchedCards]);

  const hasWatchedCard = useCallback((universeId: number, cardId: number): boolean => {
    const watchedIds = getWatchedCards(universeId);
    return watchedIds.includes(cardId);
  }, [getWatchedCards]);

  const clearProgress = useCallback((universeId?: number): void => {
    if (universeId) {
      const progress = getStoredProgress();
      delete progress[universeId];
      setStoredProgress(progress);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    getWatchedCards,
    markCardWatched,
    getNextUnwatchedIndex,
    hasWatchedCard,
    clearProgress,
  };
}
