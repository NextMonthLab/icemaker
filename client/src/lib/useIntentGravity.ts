/**
 * useIntentGravity - Intent-based tile reordering hook
 * 
 * When the user clicks a tile or submits a question, this hook:
 * 1. Determines an "intent vector" from the interaction
 * 2. Computes relevance scores for all tiles
 * 3. Returns a new ordering with relevant tiles first
 * 4. Provides animation state for smooth transitions
 * 
 * The reordering feels like "gravity" pulling relevant content closer,
 * not like sorting a list. Non-relevant tiles drift slightly outward
 * but never disappear.
 */

import { useState, useCallback, useRef } from 'react';
import { computeRelevanceScore, extractIntentFromQuestion } from './orbitConfig';

export interface TileWithIntent {
  id: string;
  intentTags: string[];
  [key: string]: any;
}

export interface GravityState {
  orderedTiles: TileWithIntent[];
  activeIntent: string[];
  relevanceScores: Map<string, number>;
  isAnimating: boolean;
}

interface UseIntentGravityOptions {
  tiles: TileWithIntent[];
  disabled?: boolean;
  relaxTimeout?: number;
}

export function useIntentGravity({
  tiles,
  disabled = false,
  relaxTimeout = 20000,
}: UseIntentGravityOptions) {
  const [activeIntent, setActiveIntent] = useState<string[]>([]);
  const [relevanceScores, setRelevanceScores] = useState<Map<string, number>>(new Map());
  const [isAnimating, setIsAnimating] = useState(false);
  const relaxTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const computeOrderedTiles = useCallback((
    tiles: TileWithIntent[],
    intent: string[]
  ): TileWithIntent[] => {
    if (intent.length === 0) {
      return tiles;
    }
    
    const scores = new Map<string, number>();
    tiles.forEach(tile => {
      const score = computeRelevanceScore(intent, tile.intentTags || []);
      scores.set(tile.id, score);
    });
    
    setRelevanceScores(scores);
    
    const sorted = [...tiles].sort((a, b) => {
      const scoreA = scores.get(a.id) || 0;
      const scoreB = scores.get(b.id) || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return 0;
    });
    
    return sorted;
  }, []);
  
  const triggerGravity = useCallback((intent: string[]) => {
    if (disabled) return;
    
    if (relaxTimerRef.current) {
      clearTimeout(relaxTimerRef.current);
    }
    
    setActiveIntent(intent);
    setIsAnimating(true);
    
    setTimeout(() => setIsAnimating(false), 500);
    
    relaxTimerRef.current = setTimeout(() => {
      setActiveIntent([]);
      setRelevanceScores(new Map());
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500);
    }, relaxTimeout);
  }, [disabled, relaxTimeout]);
  
  const handleTileClick = useCallback((tile: TileWithIntent) => {
    if (disabled) return;
    triggerGravity(tile.intentTags || []);
  }, [disabled, triggerGravity]);
  
  const handleQuestionSubmit = useCallback((question: string) => {
    if (disabled) return;
    const intent = extractIntentFromQuestion(question);
    if (intent.length > 0) {
      triggerGravity(intent);
    }
  }, [disabled, triggerGravity]);
  
  const orderedTiles = computeOrderedTiles(tiles, activeIntent);
  
  const getGravityOffset = useCallback((tileId: string): { x: number; y: number } => {
    if (activeIntent.length === 0) {
      return { x: 0, y: 0 };
    }
    
    const score = relevanceScores.get(tileId) || 0;
    
    if (score > 0.5) {
      return { x: 0, y: -20 * score };
    } else if (score > 0) {
      return { x: 0, y: -10 * score };
    } else {
      return { x: 0, y: 10 };
    }
  }, [activeIntent, relevanceScores]);
  
  return {
    orderedTiles,
    activeIntent,
    relevanceScores,
    isAnimating,
    handleTileClick,
    handleQuestionSubmit,
    getGravityOffset,
    triggerGravity,
  };
}
