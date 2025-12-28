import { useState, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatHub } from "./ChatHub";
import { KnowledgeTile } from "./KnowledgeTile";
import type { SiteKnowledge, AnyKnowledgeItem } from "@/lib/siteKnowledge";
import { getAllItems, rankByRelevance, scoreRelevance } from "@/lib/siteKnowledge";

function getItemLabel(item: AnyKnowledgeItem): string {
  switch (item.type) {
    case 'topic': return item.label;
    case 'page': return item.title;
    case 'person': return item.name;
    case 'proof': return item.label;
    case 'action': return item.label;
  }
}

function getItemSummary(item: AnyKnowledgeItem): string {
  switch (item.type) {
    case 'topic': return item.summary;
    case 'page': return item.summary;
    case 'person': return item.role;
    case 'proof': return item.summary;
    case 'action': return item.summary;
  }
}

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
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => getAllItems(knowledge), [knowledge]);
  
  const rankedItems = useMemo(() => {
    const query = conversationKeywords.join(' ');
    return rankByRelevance(allItems, query);
  }, [allItems, conversationKeywords]);

  const positionMap = useMemo(() => {
    const viewportRadius = Math.min(window.innerWidth, window.innerHeight) / 2;
    const tileHalfWidth = 55;
    const maxEdge = viewportRadius - 15;
    const ring1Radius = 75;
    const ring2Radius = 115;
    const map = new Map<string, { x: number; y: number; distance: number }>();
    
    let placed = 0;
    const rings = [
      { count: 6, radius: ring1Radius },
      { count: 7, radius: ring2Radius },
    ];
    
    for (let r = 0; r < rings.length && placed < rankedItems.length; r++) {
      const { count, radius } = rings[r];
      const effectiveRadius = Math.min(radius, maxEdge - tileHalfWidth);
      for (let i = 0; i < count && placed < rankedItems.length; i++) {
        const item = rankedItems[placed];
        const query = conversationKeywords.join(' ');
        const relevance = scoreRelevance(item, query);
        const pullFactor = relevance > 0 ? Math.max(0.9, 1 - relevance / 20) : 1;
        const adjustedRadius = effectiveRadius * pullFactor;
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2 + (r * 0.55);
        
        map.set(item.id, {
          x: Math.cos(angle) * adjustedRadius,
          y: Math.sin(angle) * adjustedRadius,
          distance: adjustedRadius,
        });
        placed++;
      }
    }
    
    let ring = 3;
    while (placed < rankedItems.length) {
      const tilesInRing = 5 + ring * 2;
      const rawRadius = ring2Radius + (ring - 2) * (tileHalfWidth * 1.1);
      
      for (let i = 0; i < tilesInRing && placed < rankedItems.length; i++) {
        const item = rankedItems[placed];
        const query = conversationKeywords.join(' ');
        const relevance = scoreRelevance(item, query);
        const pullFactor = relevance > 0 ? Math.max(0.9, 1 - relevance / 20) : 1;
        const adjustedRadius = rawRadius * pullFactor;
        const angle = (i / tilesInRing) * 2 * Math.PI - Math.PI / 2 + (ring * 0.45);
        
        map.set(item.id, {
          x: Math.cos(angle) * adjustedRadius,
          y: Math.sin(angle) * adjustedRadius,
          distance: adjustedRadius,
        });
        placed++;
      }
      ring++;
    }
    return map;
  }, [rankedItems, conversationKeywords]);

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
      const context = `[User clicked on: ${selectedItem.type} - ${getItemLabel(selectedItem)}] ${message}`;
      setSelectedItem(null);
      return onSendMessage(context);
    }
    return onSendMessage(message);
  }, [onSendMessage, selectedItem]);

  const getInitialMessage = useCallback(() => {
    if (selectedItem) {
      const itemName = getItemLabel(selectedItem);
      const summary = getItemSummary(selectedItem);
      return `You selected "${itemName}". ${summary} What would you like to know about this?`;
    }
    return undefined;
  }, [selectedItem]);

  const nearbyTileLabels = useMemo(() => {
    return rankedItems.slice(0, 5).map(item => getItemLabel(item));
  }, [rankedItems]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-tile]') || target.closest('[data-chat-hub]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...canvasOffset };
    target.setPointerCapture(e.pointerId);
  }, [canvasOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setCanvasOffset({
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoomLevel(prev => Math.max(0.5, Math.min(2, prev + delta)));
  }, []);

  const gridSize = 60;
  const gridOffsetX = canvasOffset.x % gridSize;
  const gridOffsetY = canvasOffset.y % gridSize;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: '#0a0a0a',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      data-testid="radar-grid"
    >
      {/* Grid pattern - moves with canvas */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        }}
      />
      
      {/* Radial glow from center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColor}15 0%, transparent 40%)`,
        }}
      />

      {/* Pannable tile layer - moves with canvas offset */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoomLevel})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
        data-testid="tile-layer"
      >
        {rankedItems.map((item) => {
          const query = conversationKeywords.join(' ');
          const relevance = scoreRelevance(item, query);
          const pos = positionMap.get(item.id) || { x: 0, y: 0, distance: 200 };
          
          return (
            <KnowledgeTile
              key={item.id}
              item={item}
              relevanceScore={relevance}
              position={{ x: pos.x, y: pos.y }}
              onClick={handleTileClick}
              accentColor={relevance > 10 ? accentColor : undefined}
              zoomLevel={zoomLevel}
            />
          );
        })}
      </div>

      {/* Fixed ChatHub - NEVER moves with canvas */}
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
          nearbyTiles={nearbyTileLabels}
        />
      </AnimatePresence>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 text-white/30 text-xs pointer-events-none">
        {Math.round(zoomLevel * 100)}%
      </div>

      {/* Drag hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none">
        Drag to explore • Scroll to zoom
      </div>
    </div>
  );
}
