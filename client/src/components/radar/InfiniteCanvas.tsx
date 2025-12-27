import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

interface InfiniteCanvasProps {
  children: ReactNode;
  gridSize?: number;
  onPan?: (x: number, y: number) => void;
}

export function InfiniteCanvas({ children, gridSize = 60, onPan }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-tile]')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newOffset = {
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    };
    setOffset(newOffset);
    onPan?.(newOffset.x, newOffset.y);
  }, [isDragging, onPan]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const gridOffsetX = offset.x % gridSize;
  const gridOffsetY = offset.y % gridSize;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: '#0a0a0a',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      data-testid="infinite-canvas"
    >
      {/* Grid pattern */}
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
      
      {/* Radial gradient glow from center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
        }}
      />

      {/* Content layer */}
      <motion.div
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        data-testid="canvas-content"
      >
        {children}
      </motion.div>

      {/* Drag hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none">
        Drag to explore
      </div>
    </div>
  );
}
