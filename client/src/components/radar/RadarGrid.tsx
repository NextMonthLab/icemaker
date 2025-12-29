import { useState, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatHub } from "./ChatHub";
import { KnowledgeTile } from "./KnowledgeTile";
import type { SiteKnowledge, AnyKnowledgeItem } from "@/lib/siteKnowledge";
import { getAllItems, rankByRelevance, scoreRelevance } from "@/lib/siteKnowledge";

const TAP_THRESHOLD_MS = 200;
const TAP_MOVE_THRESHOLD = 8;

function getItemLabel(item: AnyKnowledgeItem): string {
  switch (item.type) {
    case 'topic': return item.label;
    case 'page': return item.title;
    case 'person': return item.name;
    case 'proof': return item.label;
    case 'action': return item.label;
    case 'blog': return item.title;
    case 'social': return item.connected ? `@${item.handle}` : item.platform.charAt(0).toUpperCase() + item.platform.slice(1);
  }
}

function getItemSummary(item: AnyKnowledgeItem): string {
  switch (item.type) {
    case 'topic': return item.summary;
    case 'page': return item.summary;
    case 'person': return item.role;
    case 'proof': return item.summary;
    case 'action': return item.summary;
    case 'blog': return item.summary;
    case 'social': return item.connected ? (item.followerCount ? `${item.followerCount.toLocaleString()} followers` : 'View feed') : 'Connect to show feed';
  }
}

interface RadarGridProps {
  knowledge: SiteKnowledge;
  onSendMessage: (message: string) => Promise<string>;
  accentColor?: string;
  onInteraction?: () => void;
  lightMode?: boolean;
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

export function RadarGrid({ knowledge, onSendMessage, accentColor = '#3b82f6', onInteraction, lightMode = false }: RadarGridProps) {
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
  const tapStartTime = useRef<number>(0);
  const tapStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingTileClick = useRef<AnyKnowledgeItem | null>(null);
  const hasMoved = useRef<boolean>(false);

  const allItems = useMemo(() => getAllItems(knowledge), [knowledge]);
  
  const rankedItems = useMemo(() => {
    const query = conversationKeywords.join(' ');
    return rankByRelevance(allItems, query);
  }, [allItems, conversationKeywords]);

  // Calculate intent level from conversation (0 = ambient, higher = more focused)
  const intentLevel = useMemo(() => {
    return Math.min(conversationKeywords.length / 5, 1); // 0-1 scale
  }, [conversationKeywords]);

  // Elastic zones: high intent = fewer visible tiles, more space
  const visibleItems = useMemo(() => {
    const query = conversationKeywords.join(' ');
    const scoredItems = rankedItems.map(item => ({
      item,
      score: scoreRelevance(item, query)
    }));
    
    // Always show minimum 50 tiles for infinite universe feel
    // Even at high intent, maintain 50+ tiles for density
    const maxVisible = Math.round(60 - intentLevel * 10); // 60 at ambient, 50 at focused
    
    // Sort by score descending, take top N (always at least 50)
    return scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(50, maxVisible));
  }, [rankedItems, conversationKeywords, intentLevel]);

  const positionMap = useMemo(() => {
    const tileWidth = 120;
    const tileHeight = 100;
    const tileSpacing = 10;
    const safeGap = tileHeight + tileSpacing; // minimum between zones
    
    // Ring spacing for compact but readable 50+ tile layout
    const ringSpacing = 95; // Compact packing, tiles can slightly overlap for density
    
    const map = new Map<string, { x: number; y: number; distance: number }>();
    
    // Priority zone: only 1-2 tiles at high intent, up to 3 at low intent
    const priorityCapacity = intentLevel > 0.5 ? 1 : (intentLevel > 0.2 ? 2 : 3);
    const priorityRadius = 90; // Fixed radius for priority items
    
    // Ring 1 must be far enough from priority zone to avoid overlap
    const ring1Radius = priorityRadius + safeGap; // 90 + 140 = 230px
    
    const priorityItems = visibleItems.slice(0, priorityCapacity);
    const regularItems = visibleItems.slice(priorityCapacity);
    
    // Place priority items with generous spacing
    priorityItems.forEach((p, i) => {
      const angle = (i / Math.max(priorityCapacity, 1)) * 2 * Math.PI - Math.PI / 2;
      map.set(p.item.id, {
        x: Math.cos(angle) * priorityRadius,
        y: Math.sin(angle) * priorityRadius,
        distance: priorityRadius,
      });
    });
    
    // Place remaining items in outer rings with staggered angles
    let placed = 0;
    let ringIndex = 0;
    
    while (placed < regularItems.length) {
      const ringRadius = ring1Radius + ringIndex * ringSpacing;
      
      // Calculate safe tile capacity for this ring
      const circumference = 2 * Math.PI * ringRadius;
      const tileFootprint = tileWidth + tileSpacing;
      const maxTilesInRing = Math.max(1, Math.floor(circumference / tileFootprint));
      
      // Limit to remaining items
      const tilesInRing = Math.min(maxTilesInRing, regularItems.length - placed);
      
      // Stagger angle offset between rings to prevent vertical stacking
      const staggerAngle = (ringIndex % 2 === 0) ? 0 : Math.PI / tilesInRing;
      
      for (let i = 0; i < tilesInRing && placed < regularItems.length; i++) {
        const { item } = regularItems[placed];
        const angle = (i / tilesInRing) * 2 * Math.PI - Math.PI / 2 + staggerAngle;
        
        map.set(item.id, {
          x: Math.cos(angle) * ringRadius,
          y: Math.sin(angle) * ringRadius,
          distance: ringRadius,
        });
        placed++;
      }
      ringIndex++;
    }
    return map;
  }, [visibleItems, intentLevel]);

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
    onInteraction?.();
  }, [handleIntentChange, onInteraction]);

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
        const summaryText = summary ? `\n\n${summary}` : '';
        if (hasLocationContext) {
          return `${itemName}${summaryText}\n\nTell me your location and I can give you more specific information about "${itemName}".`;
        }
        return `${itemName}${summaryText}\n\nWhat would you like to explore about "${itemName}"?`;
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
        const summaryText = summary ? `\n\n${summary}` : '';
        return `${itemName}${summaryText}\n\nWhat would you like to explore about "${itemName}"? I can share more details or find similar examples.`;
      }
      case 'blog': {
        const blog = selectedItem as import('@/lib/siteKnowledge').Blog;
        return `${itemName}\n\n${summary}\n\nWant to read the full article? Visit: ${blog.url}\n\nOr ask me any questions about this topic.`;
      }
      case 'social': {
        const social = selectedItem as import('@/lib/siteKnowledge').Social;
        const platformName = social.platform.charAt(0).toUpperCase() + social.platform.slice(1);
        if (social.connected) {
          const followerInfo = social.followerCount ? `${social.followerCount.toLocaleString()} followers\n\n` : '';
          return `Here's our ${platformName} feed (@${social.handle}).\n\n${followerInfo}Visit: ${social.url}\n\nAsk me about our latest posts or activity.`;
        }
        return `Connect your ${platformName} account to display your feed and engage with visitors.\n\nOnce connected, visitors will be able to see your latest posts right here.`;
      }
      default:
        return `${itemName}: ${summary}\n\nHow can I help you with this?`;
    }
  }, [selectedItem]);

  const nearbyTileLabels = useMemo(() => {
    return visibleItems.slice(0, 5).map(({ item }) => getItemLabel(item));
  }, [visibleItems]);

  const getPinchDistance = useCallback(() => {
    const pointers = Array.from(activePointers.current.values());
    if (pointers.length < 2) return null;
    const dx = pointers[1].x - pointers[0].x;
    const dy = pointers[1].y - pointers[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-chat-hub]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tapStartTime.current = Date.now();
    tapStartPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
    pendingTileClick.current = null;
    
    const tileEl = target.closest('[data-tile-id]');
    if (tileEl) {
      const tileId = tileEl.getAttribute('data-tile-id');
      pendingTileClick.current = allItems.find(item => item.id === tileId) || null;
    }
    
    if (activePointers.current.size === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetStart.current = { ...canvasOffset };
    } else if (activePointers.current.size === 2) {
      setIsDragging(false);
      initialPinchDistance.current = getPinchDistance();
      initialZoom.current = zoomLevel;
    }
    
    containerRef.current?.setPointerCapture?.(e.pointerId);
  }, [canvasOffset, zoomLevel, getPinchDistance, allItems]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    const dx = e.clientX - tapStartPos.current.x;
    const dy = e.clientY - tapStartPos.current.y;
    const movedDistance = Math.sqrt(dx * dx + dy * dy);
    if (movedDistance > TAP_MOVE_THRESHOLD) {
      hasMoved.current = true;
    }
    
    if (activePointers.current.size === 2 && initialPinchDistance.current) {
      const currentDistance = getPinchDistance();
      if (currentDistance) {
        const scale = currentDistance / initialPinchDistance.current;
        const newZoom = Math.max(0.4, Math.min(2.5, initialZoom.current * scale));
        setZoomLevel(newZoom);
      }
    } else if (isDragging && activePointers.current.size === 1) {
      const panDx = e.clientX - dragStart.current.x;
      const panDy = e.clientY - dragStart.current.y;
      setCanvasOffset({
        x: offsetStart.current.x + panDx,
        y: offsetStart.current.y + panDy,
      });
    }
  }, [isDragging, getPinchDistance]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const elapsed = Date.now() - tapStartTime.current;
    const wasTap = elapsed < TAP_THRESHOLD_MS && !hasMoved.current;
    
    if (wasTap && pendingTileClick.current && activePointers.current.size === 1) {
      handleTileClick(pendingTileClick.current);
    }
    
    activePointers.current.delete(e.pointerId);
    containerRef.current?.releasePointerCapture?.(e.pointerId);
    
    if (activePointers.current.size < 2) {
      initialPinchDistance.current = null;
    }
    if (activePointers.current.size === 0) {
      setIsDragging(false);
    }
    pendingTileClick.current = null;
  }, [handleTileClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoomLevel(prev => Math.max(0.5, Math.min(2, prev + delta)));
  }, []);

  const gridSize = 60;
  const gridOffsetX = canvasOffset.x % gridSize;
  const gridOffsetY = canvasOffset.y % gridSize;

  const bgColor = lightMode ? '#f8fafc' : '#0a0a0a';
  const gridLineColor = lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)';
  const edgeFadeColor = lightMode ? '#f8fafc' : '#0a0a0a';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: bgColor,
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
            linear-gradient(${gridLineColor} 1px, transparent 1px),
            linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)
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
        {visibleItems.map(({ item, score }) => {
          const pos = positionMap.get(item.id) || { x: 0, y: 0, distance: 200 };
          
          return (
            <KnowledgeTile
              key={item.id}
              item={item}
              relevanceScore={score}
              position={{ x: pos.x, y: pos.y }}
              accentColor={accentColor}
              lightMode={lightMode}
              zoomLevel={zoomLevel}
            />
          );
        })}
      </div>

      {/* Feather edge - fade at screen edges for infinite universe feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: lightMode
            ? `radial-gradient(ellipse 85% 75% at 50% 50%, transparent 35%, rgba(248,250,252,0.3) 55%, rgba(248,250,252,0.7) 75%, ${edgeFadeColor} 100%)`
            : `radial-gradient(ellipse 85% 75% at 50% 50%, transparent 35%, rgba(10,10,10,0.3) 55%, rgba(10,10,10,0.7) 75%, ${edgeFadeColor} 100%)`,
          zIndex: 10,
        }}
      />

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
