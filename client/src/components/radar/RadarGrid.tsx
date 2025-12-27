import { useState, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { ChatHub } from "./ChatHub";
import { KnowledgeTile } from "./KnowledgeTile";
import type { SiteKnowledge, AnyKnowledgeItem } from "@/lib/siteKnowledge";
import { getAllItems, rankByRelevance, scoreRelevance } from "@/lib/siteKnowledge";

interface RadarGridProps {
  knowledge: SiteKnowledge;
  onSendMessage: (message: string) => Promise<string>;
  accentColor?: string;
}

function generateTilePositions(count: number, ringSpacing: number = 180): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  let ring = 1;
  let placed = 0;
  
  while (placed < count) {
    const radius = ring * ringSpacing;
    const tilesInRing = Math.max(6, Math.floor(ring * 6));
    const angleStep = (2 * Math.PI) / tilesInRing;
    
    for (let i = 0; i < tilesInRing && placed < count; i++) {
      const angle = angleStep * i - Math.PI / 2;
      const jitter = (Math.random() - 0.5) * 30;
      positions.push({
        x: Math.cos(angle) * radius + jitter,
        y: Math.sin(angle) * radius + jitter,
      });
      placed++;
    }
    ring++;
  }
  
  return positions;
}

export function RadarGrid({ knowledge, onSendMessage, accentColor = '#3b82f6' }: RadarGridProps) {
  const [isHubMinimized, setIsHubMinimized] = useState(false);
  const [conversationKeywords, setConversationKeywords] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<AnyKnowledgeItem | null>(null);

  const allItems = useMemo(() => getAllItems(knowledge), [knowledge]);
  
  const rankedItems = useMemo(() => {
    const query = conversationKeywords.join(' ');
    return rankByRelevance(allItems, query);
  }, [allItems, conversationKeywords]);

  const positions = useMemo(() => {
    return generateTilePositions(rankedItems.length, 170);
  }, [rankedItems.length]);

  const handleIntentChange = useCallback((keywords: string[]) => {
    setConversationKeywords(prev => {
      const combined = [...prev, ...keywords];
      return combined.slice(-20);
    });
  }, []);

  const handleTileClick = useCallback((item: AnyKnowledgeItem) => {
    setSelectedItem(item);
    setIsHubMinimized(false);
    
    const itemKeywords = item.keywords.slice(0, 3);
    handleIntentChange(itemKeywords);
  }, [handleIntentChange]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (selectedItem) {
      const context = `[User clicked on: ${selectedItem.type} - ${
        'label' in selectedItem ? selectedItem.label : 
        'title' in selectedItem ? selectedItem.title : 
        'name' in selectedItem ? selectedItem.name : selectedItem.id
      }] ${message}`;
      setSelectedItem(null);
      return onSendMessage(context);
    }
    return onSendMessage(message);
  }, [onSendMessage, selectedItem]);

  const getInitialMessage = useCallback(() => {
    if (selectedItem) {
      const itemName = 'label' in selectedItem ? selectedItem.label : 
                       'title' in selectedItem ? selectedItem.title : 
                       'name' in selectedItem ? selectedItem.name : '';
      const summary = 'summary' in selectedItem ? selectedItem.summary : 
                      'role' in selectedItem ? selectedItem.role : '';
      return `You selected "${itemName}". ${summary} What would you like to know about this?`;
    }
    return undefined;
  }, [selectedItem]);

  return (
    <InfiniteCanvas>
      {/* Tiles */}
      {rankedItems.map((item, index) => {
        const query = conversationKeywords.join(' ');
        const relevance = scoreRelevance(item, query);
        
        return (
          <KnowledgeTile
            key={item.id}
            item={item}
            relevanceScore={relevance}
            position={positions[index] || { x: 0, y: 0 }}
            onClick={handleTileClick}
            accentColor={relevance > 10 ? accentColor : undefined}
          />
        );
      })}

      {/* Central Chat Hub */}
      <AnimatePresence mode="wait">
        <ChatHub
          key={selectedItem?.id || 'default'}
          brandName={knowledge.brand.name}
          accentColor={accentColor}
          onSendMessage={handleSendMessage}
          onIntentChange={handleIntentChange}
          initialMessage={getInitialMessage()}
          isMinimized={isHubMinimized}
          onMinimize={() => setIsHubMinimized(true)}
          onExpand={() => setIsHubMinimized(false)}
        />
      </AnimatePresence>
    </InfiniteCanvas>
  );
}
