/**
 * AmbientMotion - Subtle tile drift animation
 * 
 * Provides a gentle "alive" feeling to tiles without being distracting.
 * Uses CSS transforms for GPU acceleration and respects prefers-reduced-motion.
 * 
 * Motion parameters (tuned for subtlety):
 * - Drift amplitude: 1-3px (barely noticeable)
 * - Cycle duration: 8-18 seconds (slow, calming)
 * - Each tile has randomized phase/offset for organic feel
 * 
 * Performance safeguards:
 * - Uses transform only (no layout thrash)
 * - Pauses when prefers-reduced-motion is enabled
 * - Can be disabled via prop
 */

import { ReactNode, useEffect, useState, useMemo } from 'react';

interface AmbientMotionProps {
  children: ReactNode;
  index: number;
  disabled?: boolean;
  className?: string;
}

function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReducedMotion;
}

export function AmbientMotion({ 
  children, 
  index, 
  disabled = false,
  className = ''
}: AmbientMotionProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const motionParams = useMemo(() => {
    const seed = index * 7919;
    const amplitude = 1 + (seed % 3);
    const duration = 8 + (seed % 11);
    const delay = (seed % 5000) / 1000;
    const phaseX = seed % 360;
    const phaseY = (seed * 3) % 360;
    
    return { amplitude, duration, delay, phaseX, phaseY };
  }, [index]);
  
  if (disabled || prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  const { amplitude, duration, delay, phaseX, phaseY } = motionParams;
  
  const animationStyle = {
    animation: `ambientDrift-${index} ${duration}s ease-in-out ${delay}s infinite`,
    willChange: 'transform',
  };
  
  const keyframes = `
    @keyframes ambientDrift-${index} {
      0%, 100% {
        transform: translate(0px, 0px);
      }
      25% {
        transform: translate(${amplitude * Math.cos(phaseX * Math.PI / 180)}px, ${amplitude * Math.sin(phaseY * Math.PI / 180)}px);
      }
      50% {
        transform: translate(${-amplitude * Math.sin(phaseX * Math.PI / 180)}px, ${amplitude * Math.cos(phaseY * Math.PI / 180)}px);
      }
      75% {
        transform: translate(${-amplitude * Math.cos(phaseX * Math.PI / 180)}px, ${-amplitude * Math.sin(phaseY * Math.PI / 180)}px);
      }
    }
  `;
  
  return (
    <>
      <style>{keyframes}</style>
      <div className={`orbit-tile-ambient ${className}`} style={animationStyle}>
        {children}
      </div>
    </>
  );
}

export function useAmbientMotionStyles() {
  return `
    .orbit-tile-ambient {
      transform-style: preserve-3d;
      backface-visibility: hidden;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .orbit-tile-ambient {
        animation: none !important;
      }
    }
  `;
}
