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
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(1);

  const allItems = useMemo(() => getAllItems(knowledge), [knowledge]);
  
  const rankedItems = useMemo(() => {
    const query = conversationKeywords.join(' ');
    return rankByRelevance(allItems, query);
  }, [allItems, conversationKeywords]);

  const positionMap = useMemo(() => {
    const viewportRadius = Math.min(window.innerWidth, window.innerHeight) / 2;
    const tileWidth = 95;
    const tileHalfWidth = tileWidth / 2;
    const tileSpacing = 8;
    const effectiveTileArc = tileWidth + tileSpacing;
    const maxVisibleEdge = viewportRadius - 15;
    const priorityOrbitRadius = 52;
    const priorityOrbitCapacity = 3;
    const relevanceThreshold = 12;
    const ring1Radius = 95;
    const ring2Radius = 135;
    const map = new Map<string, { x: number; y: number; distance: number }>();
    
    const query = conversationKeywords.join(' ');
    const scoredItems = rankedItems.map(item => ({
      item,
      score: scoreRelevance(item, query)
    }));
    
    const priorityItems = scoredItems
      .filter(s => s.score >= relevanceThreshold)
      .slice(0, priorityOrbitCapacity);
    const priorityIds = new Set(priorityItems.map(p => p.item.id));
    const regularItems = scoredItems.filter(s => !priorityIds.has(s.item.id));
    
    priorityItems.forEach((p, i) => {
      const angle = (i / priorityOrbitCapacity) * 2 * Math.PI - Math.PI / 2;
      map.set(p.item.id, {
        x: Math.cos(angle) * priorityOrbitRadius,
        y: Math.sin(angle) * priorityOrbitRadius,
        distance: priorityOrbitRadius,
      });
    });
    
    let placed = 0;
    const ringConfigs = [
      { radius: ring1Radius },
      { radius: ring2Radius },
    ];
    
    for (let r = 0; r < ringConfigs.length && placed < regularItems.length; r++) {
      const rawRadius = ringConfigs[r].radius;
      const ringRadius = Math.min(rawRadius, maxVisibleEdge - tileHalfWidth);
      const circumference = 2 * Math.PI * ringRadius;
      const tilesInRing = Math.min(Math.floor(circumference / effectiveTileArc), regularItems.length - placed);
      const angleOffset = (r + 1) * 0.35;
      
      for (let i = 0; i < tilesInRing && placed < regularItems.length; i++) {
        const { item } = regularItems[placed];
        const angle = (i / tilesInRing) * 2 * Math.PI - Math.PI / 2 + angleOffset;
        
        map.set(item.id, {
          x: Math.cos(angle) * ringRadius,
          y: Math.sin(angle) * ringRadius,
          distance: ringRadius,
        });
        placed++;
      }
    }
    
    let ring = 3;
    while (placed < regularItems.length) {
      const rawRadius = ring2Radius + (ring - 2) * 65;
      const circumference = 2 * Math.PI * rawRadius;
      const tilesInRing = Math.min(Math.floor(circumference / effectiveTileArc), regularItems.length - placed);
      const angleOffset = ring * 0.4;
      
      for (let i = 0; i < tilesInRing && placed < regularItems.length; i++) {
        const { item } = regularItems[placed];
        const angle = (i / tilesInRing) * 2 * Math.PI - Math.PI / 2 + angleOffset;
        
        map.set(item.id, {
          x: Math.cos(angle) * rawRadius,
          y: Math.sin(angle) * rawRadius,
          distance: rawRadius,
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
    if (!selectedItem) return undefined;
    
    const itemName = getItemLabel(selectedItem);
    const summary = getItemSummary(selectedItem);
    
    switch (selectedItem.type) {
      case 'page': {
        const page = selectedItem as import('@/lib/siteKnowledge').Page;
        const hasWeatherKeywords = page.keywords.some(k => 
          ['weather', 'forecast', 'temperature', 'climate'].includes(k.toLowerCase())
        );
        if (hasWeatherKeywords) {
          return `Here's the ${itemName} page.\n\n${summary}\n\nTell me your town or location and I can help you understand the forecast. Or tap here to visit the page directly: ${page.url}`;
        }
        return `Here's the ${itemName} page.\n\n${summary}\n\nI can answer questions about this, or you can visit the page directly: ${page.url}\n\nWhat would you like to do?`;
      }
      case 'topic': {
        const topic = selectedItem as import('@/lib/siteKnowledge').Topic;
        const hasLocationContext = topic.keywords.some(k => 
          ['location', 'local', 'area', 'region', 'weather'].includes(k.toLowerCase())
        );
        if (hasLocationContext) {
          return `${itemName}: ${summary}\n\nTell me your location and I can give you more specific information. Or ask me anything about this topic.`;
        }
        return `${itemName}: ${summary}\n\nI can dive deeper into any aspect of this. What interests you most?`;
      }
      case 'action': {
        const action = selectedItem as import('@/lib/siteKnowledge').Action;
        const actionPrompts: Record<string, string> = {
          'video_reply': `Want to send a video message? ${summary}\n\nJust say "record" to get started, or ask me anything else.`,
          'call': `Ready to schedule a call? ${summary}\n\nTell me when works best for you, or ask me anything else.`,
          'email': `Want to send us a message? ${summary}\n\nYou can type your question here and I'll help you compose it, or ask me anything else.`,
          'quote': `Looking for a quote? ${summary}\n\nTell me what you need and I'll help you get started, or ask me anything else.`
        };
        return actionPrompts[action.actionType] || `${itemName}: ${summary}\n\nHow can I help you with this?`;
      }
      case 'person': {
        const person = selectedItem as import('@/lib/siteKnowledge').Person;
        const contactOptions = [];
        if (person.email) contactOptions.push(`email at ${person.email}`);
        if (person.phone) contactOptions.push(`call at ${person.phone}`);
        const contactInfo = contactOptions.length > 0 
          ? `\n\nYou can reach ${person.name.split(' ')[0]} by ${contactOptions.join(' or ')}.`
          : '';
        return `Meet ${person.name}, ${person.role}.${contactInfo}\n\nWould you like me to help you get in touch, or do you have questions I can answer?`;
      }
      case 'proof': {
        return `${itemName}\n\n${summary}\n\nWant to see more examples of our work, or do you have questions about what we can do for you?`;
      }
      default:
        return `${itemName}: ${summary}\n\nHow can I help you with this?`;
    }
  }, [selectedItem]);

  const nearbyTileLabels = useMemo(() => {
    return rankedItems.slice(0, 5).map(item => getItemLabel(item));
  }, [rankedItems]);

  const getPinchDistance = useCallback(() => {
    const pointers = Array.from(activePointers.current.values());
    if (pointers.length < 2) return null;
    const dx = pointers[1].x - pointers[0].x;
    const dy = pointers[1].y - pointers[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-tile]') || target.closest('[data-chat-hub]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (activePointers.current.size === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetStart.current = { ...canvasOffset };
    } else if (activePointers.current.size === 2) {
      setIsDragging(false);
      initialPinchDistance.current = getPinchDistance();
      initialZoom.current = zoomLevel;
    }
    
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [canvasOffset, zoomLevel, getPinchDistance]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (activePointers.current.size === 2 && initialPinchDistance.current) {
      const currentDistance = getPinchDistance();
      if (currentDistance) {
        const scale = currentDistance / initialPinchDistance.current;
        const newZoom = Math.max(0.4, Math.min(2.5, initialZoom.current * scale));
        setZoomLevel(newZoom);
      }
    } else if (isDragging && activePointers.current.size === 1) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setCanvasOffset({
        x: offsetStart.current.x + dx,
        y: offsetStart.current.y + dy,
      });
    }
  }, [isDragging, getPinchDistance]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      initialPinchDistance.current = null;
    }
    if (activePointers.current.size === 0) {
      setIsDragging(false);
    }
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
      onPointerCancel={handlePointerUp}
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
