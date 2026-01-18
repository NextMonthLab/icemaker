import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Image, Video, Mic, Upload, Loader2, Play, Pause, RefreshCw, 
  Save, Trash2, Lock, Sparkles, Crown, Wand2, Volume2, X,
  ChevronDown, ChevronUp, Check, AlertCircle, ImagePlus, ArrowUp, ArrowDown, GripVertical,
  User, ExternalLink, Link as LinkIcon, Clock, CheckCircle, Plus, Maximize, Minimize, FileText,
  Undo, Redo, Scissors
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PexelsMediaPicker } from "@/components/PexelsMediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { VideoEngineSelector, type VideoEngineConfig, type VideoEngine, type VideoModel } from "@/components/ui/VideoEngineSelector";
import { VideoUpsellModal } from "@/components/ui/VideoUpsellModal";

type RenderMode = 'auto' | 'fill' | 'fit';

interface MediaAsset {
  id: string;
  kind: 'image' | 'video';
  source: 'upload' | 'ai' | 'stock';
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
  prompt?: string;
  enhancedPrompt?: string;
  negativePrompt?: string;
  status: 'ready' | 'generating' | 'failed';
  predictionId?: string;
  model?: string;
  // Video framing controls
  renderMode?: RenderMode;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceAspectRatio?: number;
  durationSec?: number; // Video duration in seconds
  muteAudio?: boolean; // Whether to mute video's original audio (default true)
}

interface MediaSegment {
  id: string;
  assetId?: string;
  kind: 'image' | 'video';
  source?: 'upload' | 'ai' | 'stock';
  url: string;
  thumbnailUrl?: string;
  durationSec: number;
  startTimeSec: number;
  order: number;
  renderMode?: RenderMode;
  sourceAspectRatio?: number;
  muteAudio?: boolean; // Whether to mute video's original audio (default true)
  // Trim controls (for video clips)
  trimStartSec?: number; // Seconds trimmed from start (default 0)
  trimEndSec?: number; // Seconds trimmed from end (default 0)
  originalDurationSec?: number; // Full video duration before trimming
}

// Sortable media clip component for drag-and-drop timeline with trim handles
function SortableMediaClip({ 
  segment, 
  onRemove, 
  onDurationChange,
  onTrimChange,
  onDurationDetected,
  isSelected,
  onSelect 
}: { 
  segment: MediaSegment; 
  onRemove: (id: string) => void;
  onDurationChange?: (id: string, duration: number) => void;
  onTrimChange?: (id: string, trimStart: number, trimEnd: number) => void;
  onDurationDetected?: (id: string, duration: number) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id });
  
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimDragSide, setTrimDragSide] = useState<'start' | 'end' | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const trimBarRef = useRef<HTMLDivElement>(null);
  const trimCleanupRef = useRef<(() => void) | null>(null);
  
  // Auto-detect video duration if not set
  useEffect(() => {
    if (segment.kind !== 'video' || segment.originalDurationSec) return;
    
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = segment.url;
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (duration && duration > 0 && isFinite(duration)) {
        setDetectedDuration(duration);
        onDurationDetected?.(segment.id, duration);
      }
    };
    
    return () => {
      video.src = '';
    };
  }, [segment.id, segment.kind, segment.url, segment.originalDurationSec, onDurationDetected]);
  
  // Cleanup trim event listeners on unmount
  useEffect(() => {
    return () => {
      if (trimCleanupRef.current) {
        trimCleanupRef.current();
        trimCleanupRef.current = null;
      }
    };
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sourceLabel = segment.source === 'ai' ? 'AI' : segment.source === 'stock' ? 'Stock' : 'Upload';
  const sourceColor = segment.source === 'ai' ? 'bg-purple-500' : segment.source === 'stock' ? 'bg-blue-500' : 'bg-green-500';
  
  const isVideo = segment.kind === 'video';
  const effectiveOriginalDuration = segment.originalDurationSec || detectedDuration;
  const canTrim = isVideo && effectiveOriginalDuration && effectiveOriginalDuration > 1;
  const trimStart = segment.trimStartSec || 0;
  const trimEnd = segment.trimEndSec || 0;
  const originalDuration = effectiveOriginalDuration || segment.durationSec;
  const effectiveDuration = originalDuration - trimStart - trimEnd;
  
  const trimStartPercent = (trimStart / originalDuration) * 100;
  const trimEndPercent = (trimEnd / originalDuration) * 100;
  const activePercent = 100 - trimStartPercent - trimEndPercent;
  
  const handleTrimDrag = (side: 'start' | 'end', clientX: number) => {
    if (!trimBarRef.current || !onTrimChange) return;
    
    const rect = trimBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const timeAtPosition = (percent / 100) * originalDuration;
    
    if (side === 'start') {
      const maxTrimStart = originalDuration - trimEnd - 0.5;
      const newTrimStart = Math.max(0, Math.min(maxTrimStart, timeAtPosition));
      onTrimChange(segment.id, newTrimStart, trimEnd);
    } else {
      const timeFromEnd = originalDuration - timeAtPosition;
      const maxTrimEnd = originalDuration - trimStart - 0.5;
      const newTrimEnd = Math.max(0, Math.min(maxTrimEnd, timeFromEnd));
      onTrimChange(segment.id, trimStart, newTrimEnd);
    }
  };
  
  const handleTrimMouseDown = (side: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canTrim || !onTrimChange) return;
    
    setIsTrimming(true);
    setTrimDragSide(side);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleTrimDrag(side, moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      setIsTrimming(false);
      setTrimDragSide(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      trimCleanupRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    trimCleanupRef.current = handleMouseUp;
  };
  
  const handleTrimTouchStart = (side: 'start' | 'end', e: React.TouchEvent) => {
    e.stopPropagation();
    if (!canTrim || !onTrimChange) return;
    
    setIsTrimming(true);
    setTrimDragSide(side);
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        handleTrimDrag(side, moveEvent.touches[0].clientX);
      }
    };
    
    const handleTouchEnd = () => {
      setIsTrimming(false);
      setTrimDragSide(null);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      trimCleanupRef.current = null;
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    trimCleanupRef.current = handleTouchEnd;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-colors cursor-pointer ${
        isSelected 
          ? 'bg-cyan-500/20 border-cyan-500/50' 
          : 'bg-slate-800/70 border-slate-700 hover:border-slate-600'
      } ${isDragging ? 'z-50 shadow-lg' : ''}`}
      onClick={() => onSelect?.(segment.id)}
      data-testid={`timeline-clip-${segment.id}`}
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 touch-none"
          data-testid={`drag-handle-${segment.id}`}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        
        {/* Thumbnail */}
        <div className="w-12 h-8 rounded overflow-hidden bg-slate-900 flex-shrink-0">
          {segment.kind === 'video' ? (
            <video 
              src={segment.url} 
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <img 
              src={segment.thumbnailUrl || segment.url} 
              alt="Media clip"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {segment.kind === 'video' ? (
              <Video className="w-3 h-3 text-cyan-400" />
            ) : (
              <Image className="w-3 h-3 text-purple-400" />
            )}
            <span className="text-xs text-slate-300 truncate">
              {segment.kind === 'video' ? 'Video' : 'Image'}
            </span>
            <span className={`text-[9px] px-1 py-0.5 rounded ${sourceColor} text-white`}>
              {sourceLabel}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {effectiveDuration.toFixed(1)}s
            {canTrim && (trimStart > 0 || trimEnd > 0) && (
              <span className="text-cyan-400 ml-1">
                (trimmed from {originalDuration.toFixed(1)}s)
              </span>
            )}
          </div>
        </div>
        
        {/* Duration adjustment for images */}
        {segment.kind === 'image' && onDurationChange && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onDurationChange(segment.id, Math.max(1, segment.durationSec - 1));
              }}
              data-testid={`decrease-duration-${segment.id}`}
            >
              <span className="text-xs">-</span>
            </Button>
            <span className="text-xs text-slate-400 w-6 text-center">{segment.durationSec}s</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onDurationChange(segment.id, Math.min(30, segment.durationSec + 1));
              }}
              data-testid={`increase-duration-${segment.id}`}
            >
              <span className="text-xs">+</span>
            </Button>
          </div>
        )}
        
        {/* Remove button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(segment.id);
          }}
          data-testid={`remove-clip-${segment.id}`}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      {/* Video Trim Bar - Only for videos with known duration */}
      {canTrim && isSelected && (
        <div 
          ref={trimBarRef}
          className="relative h-6 bg-slate-900 rounded overflow-visible mx-1"
          data-testid={`trim-bar-${segment.id}`}
        >
          {/* Trimmed start region (grayed out) */}
          {trimStartPercent > 0 && (
            <div 
              className="absolute top-0 left-0 h-full bg-slate-700/80 z-10"
              style={{ width: `${trimStartPercent}%` }}
            />
          )}
          
          {/* Trimmed end region (grayed out) */}
          {trimEndPercent > 0 && (
            <div 
              className="absolute top-0 right-0 h-full bg-slate-700/80 z-10"
              style={{ width: `${trimEndPercent}%` }}
            />
          )}
          
          {/* Active region */}
          <div 
            className="absolute top-0 h-full bg-gradient-to-r from-cyan-600/40 to-cyan-400/40 border-y border-cyan-500/50"
            style={{ 
              left: `${trimStartPercent}%`, 
              width: `${activePercent}%` 
            }}
          />
          
          {/* Left trim handle */}
          <div
            className={`absolute top-0 h-full w-3 cursor-ew-resize z-20 flex items-center justify-center transition-colors touch-none ${
              trimDragSide === 'start' ? 'bg-cyan-500' : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
            style={{ left: `calc(${trimStartPercent}% - 6px)` }}
            onMouseDown={(e) => handleTrimMouseDown('start', e)}
            onTouchStart={(e) => handleTrimTouchStart('start', e)}
            data-testid={`trim-handle-start-${segment.id}`}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
          </div>
          
          {/* Right trim handle */}
          <div
            className={`absolute top-0 h-full w-3 cursor-ew-resize z-20 flex items-center justify-center transition-colors touch-none ${
              trimDragSide === 'end' ? 'bg-cyan-500' : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
            style={{ right: `calc(${trimEndPercent}% - 6px)` }}
            onMouseDown={(e) => handleTrimMouseDown('end', e)}
            onTouchStart={(e) => handleTrimTouchStart('end', e)}
            data-testid={`trim-handle-end-${segment.id}`}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
          </div>
          
          {/* Time markers */}
          <div className="absolute bottom-0 left-1 text-[8px] text-slate-400 z-30">
            {trimStart.toFixed(1)}s
          </div>
          <div className="absolute bottom-0 right-1 text-[8px] text-slate-400 z-30">
            {(originalDuration - trimEnd).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}

// Timeline Scrubber with playhead and time ruler
function TimelineScrubber({
  totalDuration,
  playheadTime,
  onPlayheadChange,
  segments,
}: {
  totalDuration: number;
  playheadTime: number;
  onPlayheadChange: (time: number) => void;
  segments: MediaSegment[];
}) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}.${ms}` : `${secs}.${ms}s`;
  };
  
  const playheadPercent = totalDuration > 0 ? (playheadTime / totalDuration) * 100 : 0;
  
  const handleScrub = useCallback((clientX: number) => {
    if (!rulerRef.current || totalDuration <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const time = (percent / 100) * totalDuration;
    onPlayheadChange(time);
  }, [totalDuration, onPlayheadChange]);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleScrub(e.clientX);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleScrub(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    if (e.touches.length > 0) {
      handleScrub(e.touches[0].clientX);
    }
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        handleScrub(moveEvent.touches[0].clientX);
      }
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };
  
  // Generate time ruler ticks
  const ticks = useMemo(() => {
    if (totalDuration <= 0) return [];
    const tickInterval = totalDuration <= 10 ? 1 : totalDuration <= 30 ? 5 : 10;
    const result = [];
    for (let t = 0; t <= totalDuration; t += tickInterval) {
      result.push({ time: t, percent: (t / totalDuration) * 100 });
    }
    return result;
  }, [totalDuration]);
  
  // Segment boundaries for visual reference
  const segmentBoundaries = useMemo(() => {
    const sorted = [...segments].sort((a, b) => a.order - b.order);
    let time = 0;
    return sorted.map(seg => {
      const start = time;
      time += seg.durationSec;
      return {
        id: seg.id,
        startPercent: totalDuration > 0 ? (start / totalDuration) * 100 : 0,
        widthPercent: totalDuration > 0 ? (seg.durationSec / totalDuration) * 100 : 0,
        kind: seg.kind,
      };
    });
  }, [segments, totalDuration]);
  
  return (
    <div className="space-y-1" data-testid="timeline-scrubber">
      {/* Time display */}
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-cyan-400">{formatTime(playheadTime)}</span>
        <span className="text-slate-500">{formatTime(totalDuration)}</span>
      </div>
      
      {/* Time ruler with ticks */}
      <div 
        ref={rulerRef}
        className={`relative h-8 bg-slate-800/50 rounded-md border cursor-pointer select-none touch-none ${
          isDragging ? 'border-cyan-400' : 'border-slate-700'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        data-testid="timeline-ruler"
      >
        {/* Segment visualization */}
        <div className="absolute inset-0 flex rounded-md overflow-hidden">
          {segmentBoundaries.map((seg, idx) => (
            <div
              key={seg.id}
              className={`h-full ${seg.kind === 'video' ? 'bg-purple-600/40' : 'bg-cyan-600/40'} ${
                idx > 0 ? 'border-l border-slate-600' : ''
              }`}
              style={{ width: `${seg.widthPercent}%` }}
            />
          ))}
        </div>
        
        {/* Tick marks */}
        {ticks.map(tick => (
          <div
            key={tick.time}
            className="absolute top-0 h-2 border-l border-slate-500"
            style={{ left: `${tick.percent}%` }}
          >
            <span className="absolute top-2 left-0.5 text-[8px] text-slate-500 whitespace-nowrap">
              {tick.time > 0 ? `${tick.time}s` : ''}
            </span>
          </div>
        ))}
        
        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-cyan-400 z-10 pointer-events-none"
          style={{ left: `${playheadPercent}%`, transform: 'translateX(-50%)' }}
        >
          {/* Playhead handle */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
        </div>
      </div>
    </div>
  );
}

// Drag-and-drop timeline wrapper component (proper hooks usage)
function DraggableMediaTimeline({
  segments,
  selectedIndex,
  onReorder,
  onRemove,
  onDurationChange,
  onTrimChange,
  onDurationDetected,
  onSplit,
  onSelect,
}: {
  segments: MediaSegment[];
  selectedIndex: number | null;
  onReorder: (reordered: MediaSegment[]) => void;
  onRemove: (id: string) => void;
  onDurationChange: (id: string, duration: number) => void;
  onTrimChange?: (id: string, trimStart: number, trimEnd: number) => void;
  onDurationDetected?: (id: string, duration: number) => void;
  onSplit?: (id: string, splitTime: number) => void;
  onSelect: (index: number | null) => void;
}) {
  const [history, setHistory] = useState<MediaSegment[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  // Track history for undo/redo
  const pushToHistory = useCallback((newSegments: MediaSegment[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newSegments)));
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 19));
  }, [historyIndex]);
  
  // Initialize history with current segments
  useEffect(() => {
    if (history.length === 0 && segments.length > 0) {
      setHistory([JSON.parse(JSON.stringify(segments))]);
      setHistoryIndex(0);
    }
  }, [segments, history.length]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onReorder(prevState);
    }
  }, [history, historyIndex, onReorder]);
  
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onReorder(nextState);
    }
  }, [history, historyIndex, onReorder]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && 
          document.activeElement?.tagName !== 'BODY') return;
      
      const sortedSegs = [...segments].sort((a, b) => a.order - b.order);
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndex !== null && sortedSegs[selectedIndex]) {
          e.preventDefault();
          pushToHistory(segments);
          onRemove(sortedSegs[selectedIndex].id);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedIndex === null) {
          onSelect(sortedSegs.length - 1);
        } else if (selectedIndex > 0) {
          onSelect(selectedIndex - 1);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedIndex === null) {
          onSelect(0);
        } else if (selectedIndex < sortedSegs.length - 1) {
          onSelect(selectedIndex + 1);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [segments, selectedIndex, onRemove, onSelect, handleUndo, handleRedo, pushToHistory]);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = segments.findIndex(s => s.id === active.id);
    const newIndex = segments.findIndex(s => s.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(segments, oldIndex, newIndex);
      let time = 0;
      const updated = reordered.map((s, i) => {
        const seg = { ...s, order: i, startTimeSec: time };
        time += s.durationSec;
        return seg;
      });
      pushToHistory(updated);
      onReorder(updated);
    }
  };
  
  const sortedSegments = [...segments].sort((a, b) => a.order - b.order);
  const selectedSegment = selectedIndex !== null ? sortedSegments[selectedIndex] : null;
  
  // Calculate total duration for the scrubber
  const totalDuration = useMemo(() => {
    return sortedSegments.reduce((sum, seg) => sum + seg.durationSec, 0);
  }, [sortedSegments]);
  
  // Find which segment the playhead is in
  const playheadSegmentInfo = useMemo(() => {
    let accumulatedTime = 0;
    for (const seg of sortedSegments) {
      if (playheadTime >= accumulatedTime && playheadTime < accumulatedTime + seg.durationSec) {
        return {
          segment: seg,
          localTime: playheadTime - accumulatedTime, // time within this segment
        };
      }
      accumulatedTime += seg.durationSec;
    }
    return null;
  }, [sortedSegments, playheadTime]);
  
  const canSplitAtPlayhead = playheadSegmentInfo?.segment?.kind === 'video' && 
    playheadSegmentInfo.localTime > 0.5 && 
    (playheadSegmentInfo.segment.durationSec - playheadSegmentInfo.localTime) > 0.5;
  
  return (
    <div className="space-y-3" ref={containerRef} tabIndex={-1}>
      {/* Timeline Scrubber */}
      {sortedSegments.length > 0 && (
        <TimelineScrubber
          totalDuration={totalDuration}
          playheadTime={playheadTime}
          onPlayheadChange={setPlayheadTime}
          segments={sortedSegments}
        />
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedSegments.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" data-testid="timeline-clips-container">
            {sortedSegments.map((seg, idx) => (
              <SortableMediaClip
                key={seg.id}
                segment={seg}
                onRemove={(id) => {
                  pushToHistory(segments);
                  onRemove(id);
                }}
                onDurationChange={seg.kind === 'image' ? (id, dur) => {
                  pushToHistory(segments);
                  onDurationChange(id, dur);
                } : undefined}
                onTrimChange={seg.kind === 'video' ? (id, start, end) => {
                  pushToHistory(segments);
                  onTrimChange?.(id, start, end);
                } : undefined}
                onDurationDetected={seg.kind === 'video' ? onDurationDetected : undefined}
                isSelected={selectedIndex === idx}
                onSelect={() => onSelect(idx)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500 flex-1">
          Scrub to position playhead. Split at playhead on video clips.
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
            data-testid="timeline-undo"
          >
            <Undo className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
            data-testid="timeline-redo"
          >
            <Redo className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {selectedIndex !== null && sortedSegments[selectedIndex] && (
        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-cyan-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-medium">
              Preview: Clip {selectedIndex + 1}
            </div>
            {canSplitAtPlayhead && onSplit && playheadSegmentInfo && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] border-cyan-500/30 text-cyan-400"
                onClick={() => {
                  pushToHistory(segments);
                  onSplit(playheadSegmentInfo.segment.id, playheadSegmentInfo.localTime);
                }}
                data-testid="split-clip-button"
              >
                <Scissors className="w-3 h-3 mr-1" />
                Split at {playheadSegmentInfo.localTime.toFixed(1)}s
              </Button>
            )}
          </div>
          <div className="aspect-video rounded-lg overflow-hidden bg-black shadow-lg shadow-cyan-500/10">
            {sortedSegments[selectedIndex].kind === 'video' ? (
              <video 
                src={sortedSegments[selectedIndex].url} 
                className="w-full h-full object-cover"
                controls
                data-testid="video-segment-preview"
              />
            ) : (
              <img 
                src={sortedSegments[selectedIndex].url} 
                alt={`Clip ${selectedIndex + 1}`}
                className="w-full h-full object-cover"
                data-testid="image-segment-preview"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ClipSuggestion {
  id: string;
  prompt: string;
  rationale: string;
  arcPhase: 'setup' | 'build' | 'peak' | 'resolve';
  continuityHints: string[];
}

// Visual Block - unified view model for all visual content in a card
type VisualBlockType = 'ai-video' | 'ai-image' | 'upload-video' | 'upload-image' | 'stock-video' | 'stock-image' | 'continuation';
type VisualBlockStatus = 'ready' | 'generating' | 'draft' | 'failed';

interface VisualBlock {
  id: string;
  type: VisualBlockType;
  assetId?: string;
  url?: string;
  thumbnailUrl?: string;
  durationSec: number;
  status: VisualBlockStatus;
  prompt?: string;
  order: number;
  renderMode?: RenderMode;
}

// Derive visual blocks from existing card data
function deriveVisualBlocks(
  card: PreviewCard, 
  draftClips: Array<{ id: string; prompt: string; status: 'draft' | 'generating' }>,
  draftImages: Array<{ id: string; prompt: string; status: 'generating' }> = []
): VisualBlock[] {
  const blocks: VisualBlock[] = [];
  const allAssets = (card.mediaAssets || []).filter(a => a.status === 'ready');
  
  // Sort assets by createdAt to maintain order
  const sortedAssets = [...allAssets].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  // Build from all persisted assets (videos and images)
  sortedAssets.forEach((asset, index) => {
    let type: VisualBlockType;
    if (asset.kind === 'video') {
      type = asset.source === 'upload' ? 'upload-video' : 
             asset.source === 'stock' ? 'stock-video' : 'ai-video';
    } else {
      type = asset.source === 'upload' ? 'upload-image' : 
             asset.source === 'stock' ? 'stock-image' : 'ai-image';
    }
    
    // Default duration: videos use their duration, images default to 5s
    const defaultDuration = asset.kind === 'video' ? (asset.durationSec || 5) : 5;
    
    blocks.push({
      id: asset.id,
      type,
      assetId: asset.id,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl || asset.url,
      durationSec: defaultDuration,
      status: 'ready',
      prompt: asset.prompt,
      order: index,
      renderMode: asset.renderMode,
    });
  });
  
  // Add draft video clips that are being generated
  draftClips.forEach((draft, index) => {
    blocks.push({
      id: draft.id,
      type: 'ai-video',
      durationSec: 5,
      status: draft.status === 'generating' ? 'generating' : 'draft',
      prompt: draft.prompt,
      order: blocks.length + index,
    });
  });
  
  // Add draft image clips that are being generated
  draftImages.forEach((draft, index) => {
    blocks.push({
      id: draft.id,
      type: 'ai-image',
      durationSec: 5,
      status: 'generating',
      prompt: draft.prompt,
      order: blocks.length + index,
    });
  });
  
  // Legacy fallback: Include generatedVideoUrl if not already in mediaAssets
  if (card.generatedVideoUrl) {
    const videoAlreadyInAssets = allAssets.some(a => a.kind === 'video' && a.url === card.generatedVideoUrl);
    if (!videoAlreadyInAssets) {
      blocks.push({
        id: 'legacy-video',
        type: 'ai-video',
        url: card.generatedVideoUrl,
        thumbnailUrl: card.generatedVideoUrl,
        durationSec: 10, // Default for legacy videos
        status: 'ready',
        order: 0, // Put at start
      });
    }
  }
  
  // Legacy fallback: Include generatedImageUrl if not already in mediaAssets
  if (card.generatedImageUrl) {
    const imageAlreadyInAssets = allAssets.some(a => a.kind === 'image' && a.url === card.generatedImageUrl);
    if (!imageAlreadyInAssets && blocks.length === 0) {
      // Only add legacy image if no other assets exist (to avoid duplicates)
      blocks.push({
        id: 'legacy-image',
        type: 'ai-image',
        url: card.generatedImageUrl,
        thumbnailUrl: card.generatedImageUrl,
        durationSec: card.narrationDurationSec || 10,
        status: 'ready',
        order: 0,
      });
    }
  }
  
  // Add continuation as virtual block if enabled and generated
  if (card.cinematicContinuationEnabled && card.continuationImageUrl) {
    const narrationDur = card.narrationDurationSec || 0;
    const videoDur = blocks.reduce((sum, b) => sum + b.durationSec, 0);
    const continuationDur = Math.max(0, narrationDur - videoDur);
    
    if (continuationDur > 0) {
      blocks.push({
        id: 'continuation-still',
        type: 'continuation',
        url: card.continuationImageUrl,
        thumbnailUrl: card.continuationImageUrl,
        durationSec: continuationDur,
        status: 'ready',
        order: blocks.length,
      });
    }
  }
  
  return blocks.sort((a, b) => a.order - b.order);
}

type GuestCategory = 'testimonial' | 'expert' | 'engineer' | 'interviewee' | 'founder' | 'customer' | 'other';
type GuestStatus = 'idle' | 'generating' | 'ready' | 'failed';
type GuestProvider = 'heygen' | 'did';

const GUEST_CATEGORY_LABELS: Record<GuestCategory, string> = {
  testimonial: 'Testimonial',
  expert: 'Expert',
  engineer: 'Engineer',
  interviewee: 'Interviewee',
  founder: 'Founder',
  customer: 'Customer',
  other: 'Other',
};

interface PreviewCard {
  id: string;
  title: string;
  content: string;
  order: number;
  mediaAssets?: MediaAsset[];
  selectedMediaAssetId?: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  videoGenerated?: boolean;
  videoGenerationStatus?: string;
  narrationAudioUrl?: string;
  enhancePromptEnabled?: boolean;
  basePrompt?: string;
  enhancedPrompt?: string;
  preferredMediaType?: 'image' | 'video';
  // Producer Brief prompts
  visualPrompt?: string;
  videoPrompt?: string;
  // Scene continuity controls
  sceneMode?: 'USE_LOCKED_SCENE' | 'OVERRIDE_SCENE' | 'NO_SCENE';
  overrideSceneDescription?: string;
  overrideCameraAngle?: string;
  overrideLighting?: string;
  // Card type and CTA fields
  cardType?: 'standard' | 'guest' | 'cta';
  ctaHeadline?: string;
  ctaButtonLabel?: string;
  ctaUrl?: string;
  ctaSubtext?: string;
  // Cinematic Continuation fields
  cinematicContinuationEnabled?: boolean;
  continuationImageUrl?: string;
  continuationGenerationStatus?: 'pending' | 'completed' | 'failed';
  narrationDurationSec?: number;
  videoDurationSec?: number;
  // Multi-segment timeline
  mediaSegments?: MediaSegment[];
  // Guest card fields
  guestCategory?: GuestCategory;
  guestName?: string;
  guestRole?: string;
  guestCompany?: string;
  guestHeadshotUrl?: string;
  guestScript?: string;
  guestVoiceId?: string;
  guestAudioUrl?: string;
  guestVideoUrl?: string;
  guestProvider?: GuestProvider;
  guestProviderJobId?: string;
  guestStatus?: GuestStatus;
  guestError?: string;
  guestDurationSeconds?: number;
}

interface Entitlements {
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  canUseCloudLlm: boolean;
  canUploadAudio: boolean;
  planName: string;
  tier: string;
}

interface IceCardEditorProps {
  previewId: string;
  card: PreviewCard;
  cardIndex: number;
  totalCards: number;
  entitlements: Entitlements | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCardUpdate: (cardId: string, updates: Partial<PreviewCard>) => void;
  onCardSave: (cardId: string, updates: Partial<PreviewCard>) => void;
  onUpgradeClick: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  hasLockedScene?: boolean; // Whether Project Bible has a locked scene defined
  hasBible?: boolean; // Whether Project Bible is configured
  onShowBibleWarning?: (pendingAction: () => void) => void;
}

function LockedOverlay({ 
  feature, 
  description, 
  onUpgrade 
}: { 
  feature: string; 
  description: string; 
  onUpgrade: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center p-4 z-10">
      <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full p-3 mb-3">
        <Lock className="w-6 h-6 text-cyan-400" />
      </div>
      <h4 className="text-white font-semibold mb-1">{feature}</h4>
      <p className="text-slate-400 text-sm text-center mb-4 max-w-xs">{description}</p>
      <Button
        onClick={onUpgrade}
        className="gap-2"
        size="sm"
      >
        <Crown className="w-4 h-4" />
        Upgrade to Unlock
      </Button>
    </div>
  );
}

interface CinematicContinuationProps {
  previewId: string;
  card: PreviewCard;
  onCardUpdate: (cardId: string, updates: Partial<PreviewCard>) => void;
  onCardSave: (cardId: string, updates: Partial<PreviewCard>) => void;
}

function CinematicContinuationSection({ previewId, card, onCardUpdate, onCardSave }: CinematicContinuationProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Check if continuation still is needed (narration longer than video)
  const videoDuration = card.videoDurationSec || 5; // Default 5s video cap
  const narrationDuration = card.narrationDurationSec || 0;
  const needsContinuation = narrationDuration > videoDuration;
  const hasContinuationImage = !!card.continuationImageUrl;
  const isEnabled = card.cinematicContinuationEnabled !== false; // Default true
  
  const handleToggle = (enabled: boolean) => {
    onCardUpdate(card.id, { cinematicContinuationEnabled: enabled });
    onCardSave(card.id, { cinematicContinuationEnabled: enabled });
  };
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/generate-continuation-still`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate continuation still");
      }
      
      const data = await res.json();
      
      const updates = { 
        continuationImageUrl: data.continuationImageUrl,
        continuationGenerationStatus: 'completed' as const,
      };
      onCardUpdate(card.id, updates);
      onCardSave(card.id, updates);
      
      if (data.alreadyExists) {
        toast({ title: "Already generated", description: "Continuation still already exists for this card." });
      } else {
        toast({ title: "Continuation still created!", description: "Smooth visual transition will now appear when narration extends beyond video." });
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
      const errorUpdate = { continuationGenerationStatus: 'failed' as const };
      onCardUpdate(card.id, errorUpdate);
      onCardSave(card.id, errorUpdate);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Don't show section if video/narration not present
  if (!card.generatedVideoUrl || !card.narrationAudioUrl) return null;
  
  return (
    <div className="mt-4 p-3 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Cinematic Continuation</span>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          data-testid="switch-cinematic-continuation"
        />
      </div>
      
      <p className="text-xs text-slate-400 mb-3">
        When narration extends beyond the 5-second video, show a smooth transition to a context-aware still image.
      </p>
      
      {isEnabled && (
        <>
          {needsContinuation ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-purple-300">
                <AlertCircle className="w-3 h-3" />
                <span>Narration ({narrationDuration.toFixed(1)}s) exceeds video ({videoDuration}s)</span>
              </div>
              
              {hasContinuationImage ? (
                <div className="flex items-center gap-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <img 
                    src={card.continuationImageUrl!} 
                    alt="Continuation still" 
                    className="w-12 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-green-400 font-medium">Continuation still ready</p>
                    <p className="text-xs text-slate-400">Will transition smoothly after video ends</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="text-xs"
                    data-testid="button-regenerate-continuation"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="sm"
                  className="w-full gap-2"
                  data-testid="button-generate-continuation"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating (~$0.04)...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Generate Continuation Still (~$0.04)
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No continuation needed - narration fits within video duration.
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface GuestCardEditorProps {
  card: PreviewCard;
  previewId: string;
  onCardUpdate: (cardId: string, updates: Partial<PreviewCard>) => void;
  onCardSave: (cardId: string, updates: Partial<PreviewCard>) => void;
}

function GuestCardEditor({ card, previewId, onCardUpdate, onCardSave }: GuestCardEditorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingHeadshot, setIsUploadingHeadshot] = useState(false);
  
  const handleFieldChange = (field: keyof PreviewCard, value: string) => {
    onCardUpdate(card.id, { [field]: value });
  };
  
  const handleFieldBlur = (field: keyof PreviewCard, value: string) => {
    onCardSave(card.id, { [field]: value });
  };
  
  const handleCategoryChange = (category: GuestCategory) => {
    onCardUpdate(card.id, { guestCategory: category });
    onCardSave(card.id, { guestCategory: category });
  };
  
  const handleHeadshotUpload = async (file: File) => {
    setIsUploadingHeadshot(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("iceId", previewId);
      
      const res = await fetch("/api/ice/upload-media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      const url = data.url || data.fileUrl;
      
      onCardUpdate(card.id, { guestHeadshotUrl: url });
      onCardSave(card.id, { guestHeadshotUrl: url });
      
      toast({ title: "Headshot uploaded", description: "Your guest headshot is ready." });
    } catch (error) {
      toast({ title: "Upload failed", description: "Could not upload headshot.", variant: "destructive" });
    } finally {
      setIsUploadingHeadshot(false);
    }
  };
  
  const handleGenerateVideo = async () => {
    if (!card.guestScript?.trim()) {
      toast({ title: "Script required", description: "Please enter the text for your guest to say.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const res = await fetch("/api/guest-video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iceId: previewId, cardId: card.id }),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Generation failed");
      }
      
      toast({ title: "Generating cameo", description: "Your guest video is being created. This may take 1-2 minutes." });
      
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/guest-video/status?iceId=${previewId}&cardId=${card.id}`, {
            credentials: "include",
          });
          const statusData = await statusRes.json();
          
          if (statusData.status === 'ready') {
            clearInterval(interval);
            setPollInterval(null);
            setIsGenerating(false);
            onCardUpdate(card.id, { 
              guestStatus: 'ready', 
              guestVideoUrl: statusData.videoUrl,
              guestDurationSeconds: statusData.durationSeconds 
            });
            toast({ title: "Cameo ready!", description: "Your guest video has been generated." });
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setPollInterval(null);
            setIsGenerating(false);
            onCardUpdate(card.id, { guestStatus: 'failed', guestError: statusData.error });
            toast({ title: "Generation failed", description: statusData.error || "Could not generate video.", variant: "destructive" });
          }
        } catch {
          // Polling error, continue
        }
      }, 5000);
      
      setPollInterval(interval);
      
    } catch (error) {
      setIsGenerating(false);
      toast({ 
        title: "Generation failed", 
        description: error instanceof Error ? error.message : "Could not start video generation.", 
        variant: "destructive" 
      });
    }
  };
  
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);
  
  const guestStatus = card.guestStatus || 'idle';
  
  return (
    <div className="space-y-4">
      <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <User className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-200">Guest Appearance (Cameo)</p>
            <p className="text-xs text-amber-300/60 mt-0.5">
              Short cutaway from an expert, customer, engineer, testimonial, interviewee, founder. Not your narrator.
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300 text-sm">Category</Label>
            <Select 
              value={card.guestCategory || 'expert'} 
              onValueChange={(v) => handleCategoryChange(v as GuestCategory)}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 mt-1" data-testid="select-guest-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GUEST_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-slate-300 text-sm">Name</Label>
            <Input
              value={card.guestName || ''}
              onChange={(e) => handleFieldChange('guestName', e.target.value)}
              onBlur={(e) => handleFieldBlur('guestName', e.target.value)}
              placeholder="e.g., Sarah Chen"
              className="bg-slate-800 border-slate-700 mt-1"
              data-testid="input-guest-name"
            />
          </div>
          
          <div>
            <Label className="text-slate-300 text-sm">Role</Label>
            <Input
              value={card.guestRole || ''}
              onChange={(e) => handleFieldChange('guestRole', e.target.value)}
              onBlur={(e) => handleFieldBlur('guestRole', e.target.value)}
              placeholder="e.g., Head of Engineering"
              className="bg-slate-800 border-slate-700 mt-1"
              data-testid="input-guest-role"
            />
          </div>
          
          <div>
            <Label className="text-slate-300 text-sm">Company</Label>
            <Input
              value={card.guestCompany || ''}
              onChange={(e) => handleFieldChange('guestCompany', e.target.value)}
              onBlur={(e) => handleFieldBlur('guestCompany', e.target.value)}
              placeholder="e.g., Acme Corp"
              className="bg-slate-800 border-slate-700 mt-1"
              data-testid="input-guest-company"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label className="text-slate-300 text-sm">Headshot Photo</Label>
            <div className="mt-1 flex items-center gap-3">
              {card.guestHeadshotUrl ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
                  <img 
                    src={card.guestHeadshotUrl} 
                    alt="Guest headshot" 
                    className="w-full h-full object-cover" 
                  />
                  <button
                    onClick={() => {
                      onCardUpdate(card.id, { guestHeadshotUrl: undefined });
                      onCardSave(card.id, { guestHeadshotUrl: undefined });
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
                    data-testid="button-remove-headshot"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => headshotInputRef.current?.click()}
                  disabled={isUploadingHeadshot}
                  className="w-20 h-20 rounded-lg bg-slate-800 border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-1 hover:border-amber-500/50 transition-colors"
                  data-testid="button-upload-headshot"
                >
                  {isUploadingHeadshot ? (
                    <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-slate-500" />
                      <span className="text-[10px] text-slate-500">Upload</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={headshotInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleHeadshotUpload(file);
                  e.target.value = "";
                }}
                className="hidden"
                data-testid="input-headshot-file"
              />
              <div className="text-xs text-slate-500">
                <p>Upload a clear headshot</p>
                <p>for the AI avatar</p>
              </div>
            </div>
          </div>
          
          {/* AI Avatar Model - Coming Soon */}
          <div className="relative">
            <Label className="text-slate-300 text-sm flex items-center gap-2">
              Avatar Model
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse">
                Coming Soon
              </span>
            </Label>
            <div className="mt-2 p-4 rounded-lg bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-pink-900/30 border border-purple-500/30 relative overflow-hidden">
              {/* Sparkle decorations */}
              <div className="absolute top-2 right-3 text-yellow-400 animate-pulse">✨</div>
              <div className="absolute bottom-3 left-4 text-cyan-400 animate-pulse delay-150">✨</div>
              <div className="absolute top-1/2 right-8 text-pink-400 animate-pulse delay-300">⭐</div>
              
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Choose Your Avatar Style</h4>
                    <p className="text-xs text-purple-300/80">Pick from realistic, animated, or custom-trained models</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="p-2 rounded-md bg-slate-800/50 border border-slate-700/50 text-center opacity-60">
                    <div className="text-lg mb-1">🎭</div>
                    <span className="text-[10px] text-slate-400 block">Realistic</span>
                  </div>
                  <div className="p-2 rounded-md bg-slate-800/50 border border-slate-700/50 text-center opacity-60">
                    <div className="text-lg mb-1">✨</div>
                    <span className="text-[10px] text-slate-400 block">Stylized</span>
                  </div>
                  <div className="p-2 rounded-md bg-slate-800/50 border border-slate-700/50 text-center opacity-60">
                    <div className="text-lg mb-1">🚀</div>
                    <span className="text-[10px] text-slate-400 block">Custom</span>
                  </div>
                </div>
                
                <p className="text-xs text-center text-purple-200/70 pt-2 border-t border-purple-500/20">
                  🎬 Multiple avatar providers • Expressive animations • Your brand voice
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <Label className="text-slate-300 text-sm">Script (what they will say)</Label>
            <Textarea
              value={card.guestScript || ''}
              onChange={(e) => handleFieldChange('guestScript', e.target.value)}
              onBlur={(e) => handleFieldBlur('guestScript', e.target.value)}
              placeholder="Enter the text your guest will speak. Keep it short (6-10 seconds) for best results."
              className="bg-slate-800 border-slate-700 mt-1 min-h-[100px]"
              data-testid="textarea-guest-script"
            />
            <p className="text-xs text-slate-500 mt-1">
              Keep scripts short (6-10 seconds) for best impact and cost efficiency.
            </p>
          </div>
        </div>
      </div>
      
      <div className="border-t border-slate-700 pt-4">
        {guestStatus === 'ready' && card.guestVideoUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Guest cameo video ready</span>
              {card.guestDurationSeconds && (
                <span className="text-xs text-slate-500">({card.guestDurationSeconds}s)</span>
              )}
            </div>
            <div className="aspect-video bg-black rounded-lg overflow-hidden max-w-sm">
              <video 
                src={card.guestVideoUrl} 
                controls 
                className="w-full h-full"
                data-testid="video-guest-preview"
              />
            </div>
            <Button
              onClick={handleGenerateVideo}
              variant="outline"
              size="sm"
              disabled={isGenerating}
              className="border-amber-500/30 text-amber-300"
              data-testid="button-regenerate-guest"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          </div>
        ) : guestStatus === 'generating' || isGenerating ? (
          <div className="flex items-center gap-3 text-amber-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            <div>
              <p className="text-sm font-medium">Generating guest cameo...</p>
              <p className="text-xs text-slate-500">This typically takes 1-2 minutes</p>
            </div>
          </div>
        ) : guestStatus === 'failed' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Generation failed: {card.guestError || 'Unknown error'}</span>
            </div>
            <Button
              onClick={handleGenerateVideo}
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-300"
              data-testid="button-retry-guest"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleGenerateVideo}
            disabled={!card.guestScript?.trim() || isGenerating}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            data-testid="button-generate-guest"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Guest Cameo
          </Button>
        )}
      </div>
    </div>
  );
}

interface CtaCardEditorProps {
  card: PreviewCard;
  onCardUpdate: (cardId: string, updates: Partial<PreviewCard>) => void;
  onCardSave: (cardId: string, updates: Partial<PreviewCard>) => void;
}

function CtaCardEditor({ card, onCardUpdate, onCardSave }: CtaCardEditorProps) {
  const handleFieldChange = (field: keyof PreviewCard, value: string) => {
    onCardUpdate(card.id, { [field]: value });
  };
  
  const handleFieldBlur = (field: keyof PreviewCard, value: string) => {
    onCardSave(card.id, { [field]: value });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <ExternalLink className="w-5 h-5 text-green-400" />
        <div>
          <h4 className="text-sm font-medium text-green-300">Call to Action Card</h4>
          <p className="text-xs text-slate-400">
            This card displays a centered button to drive viewers to your website.
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-300 flex items-center gap-2">
            Headline
            <span className="text-xs text-slate-500">(displayed above the button)</span>
          </Label>
          <Input
            value={card.ctaHeadline || ""}
            onChange={(e) => handleFieldChange('ctaHeadline', e.target.value)}
            onBlur={(e) => handleFieldBlur('ctaHeadline', e.target.value)}
            placeholder="e.g., Ready to learn more?"
            className="bg-slate-800 border-slate-700 text-white"
            data-testid="input-cta-headline"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              Button Label
              <span className="text-xs text-slate-500">(button text)</span>
            </Label>
            <Input
              value={card.ctaButtonLabel || ""}
              onChange={(e) => handleFieldChange('ctaButtonLabel', e.target.value)}
              onBlur={(e) => handleFieldBlur('ctaButtonLabel', e.target.value)}
              placeholder="e.g., Visit Website"
              className="bg-slate-800 border-slate-700 text-white"
              data-testid="input-cta-button-label"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <LinkIcon className="w-3 h-3" />
              Button URL
            </Label>
            <Input
              type="url"
              value={card.ctaUrl || ""}
              onChange={(e) => handleFieldChange('ctaUrl', e.target.value)}
              onBlur={(e) => handleFieldBlur('ctaUrl', e.target.value)}
              placeholder="https://yourwebsite.com"
              className="bg-slate-800 border-slate-700 text-white"
              data-testid="input-cta-url"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-slate-300 flex items-center gap-2">
            Subtext
            <span className="text-xs text-slate-500">(optional, shown below the button)</span>
          </Label>
          <Input
            value={card.ctaSubtext || ""}
            onChange={(e) => handleFieldChange('ctaSubtext', e.target.value)}
            onBlur={(e) => handleFieldBlur('ctaSubtext', e.target.value)}
            placeholder="e.g., Free consultation available"
            className="bg-slate-800 border-slate-700 text-white"
            data-testid="input-cta-subtext"
          />
        </div>
      </div>
      
      <div className="p-3 bg-slate-800/50 rounded-lg">
        <p className="text-xs text-slate-400">
          The CTA button will appear centered on the card. You can still add a background image or video using the media tabs above the card list.
        </p>
      </div>
      
      {/* Preview of how the button will look */}
      {(card.ctaButtonLabel || card.ctaHeadline) && (
        <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
          <p className="text-xs text-slate-500 mb-3">Preview:</p>
          <div className="flex flex-col items-center gap-2 text-center">
            {card.ctaHeadline && (
              <h3 className="text-lg font-bold text-white">{card.ctaHeadline}</h3>
            )}
            {card.ctaButtonLabel && (
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-500 text-white font-semibold rounded-md">
                {card.ctaButtonLabel}
                <ExternalLink className="w-4 h-4" />
              </div>
            )}
            {card.ctaSubtext && (
              <p className="text-sm text-slate-400">{card.ctaSubtext}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function IceCardEditor({
  previewId,
  card,
  cardIndex,
  totalCards,
  entitlements,
  isExpanded,
  onToggleExpand,
  onCardUpdate,
  onCardSave,
  onUpgradeClick,
  onMoveUp,
  onMoveDown,
  onDelete,
  hasLockedScene = false,
  hasBible = false,
  onShowBibleWarning,
}: IceCardEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const canGenerateImages = entitlements?.canGenerateImages ?? false;
  const canGenerateVideos = entitlements?.canGenerateVideos ?? false;
  const canGenerateVoiceover = entitlements?.canUploadAudio ?? false;
  const isPro = entitlements && entitlements.tier !== "free";
  
  const [activeTab, setActiveTab] = useState<"content" | "image" | "video" | "narration" | "upload" | "stock">("content");
  const [editorMode, setEditorMode] = useState<"lanes" | "tabs">("lanes");
  const [showAddVisualModal, setShowAddVisualModal] = useState(false);
  const [continuationSuggestMode, setContinuationSuggestMode] = useState(false);
  const [continuationSuggestions, setContinuationSuggestions] = useState<{ prompt: string; rationale: string }[]>([]);
  const [continuationSuggestLoading, setContinuationSuggestLoading] = useState(false);
  const [activeLane, setActiveLane] = useState<"visuals" | "audio">("visuals");
  const [editedTitle, setEditedTitle] = useState(card.title);
  const [editedContent, setEditedContent] = useState(card.content);
  
  // Extract prompt text from visual/video prompts (strip IMAGE:/VIDEO: prefix if present)
  const extractPromptText = (prompt: string | undefined): string => {
    if (!prompt) return "";
    // Remove IMAGE: or VIDEO: prefix and any leading whitespace
    return prompt.replace(/^(IMAGE|VIDEO):\s*/i, "").trim();
  };
  
  useEffect(() => {
    setEditedTitle(card.title);
    setEditedContent(card.content);
    // Pre-populate prompts from Producer Brief if available
    if (card.visualPrompt) {
      setImagePrompt(extractPromptText(card.visualPrompt));
    }
    if (card.videoPrompt || card.visualPrompt) {
      setVideoPrompt(extractPromptText(card.videoPrompt) || extractPromptText(card.visualPrompt));
    }
  }, [card.id, card.title, card.content, card.visualPrompt, card.videoPrompt]);
  
  const [imagePrompt, setImagePrompt] = useState(extractPromptText(card.visualPrompt));
  const [imageLoading, setImageLoading] = useState(false);
  const [videoMode, setVideoMode] = useState<"text-to-video" | "image-to-video">("text-to-video");
  const [videoEngine, setVideoEngine] = useState("auto");
  const [videoModel, setVideoModel] = useState("");
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  const [videoPrompt, setVideoPrompt] = useState(extractPromptText(card.videoPrompt) || extractPromptText(card.visualPrompt));
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [muteUploadedVideo, setMuteUploadedVideo] = useState(true); // Default to mute for uploaded videos
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoGenElapsed, setVideoGenElapsed] = useState(0);
  const [videoGenStartTime, setVideoGenStartTime] = useState<number | null>(null);
  const [showVideoUpsell, setShowVideoUpsell] = useState(false);
  const [upsellTier, setUpsellTier] = useState("pro");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [narrationText, setNarrationText] = useState(card.content || "");
  const [narrationVoice, setNarrationVoice] = useState("alloy");
  const [narrationSpeed, setNarrationSpeed] = useState(1.0);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [enhancePromptEnabled, setEnhancePromptEnabled] = useState(card.enhancePromptEnabled ?? false);
  const [enhancedPrompt, setEnhancedPrompt] = useState(card.enhancedPrompt || "");
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhancedVideoPrompt, setEnhancedVideoPrompt] = useState("");
  const [videoEnhanceLoading, setVideoEnhanceLoading] = useState(false);
  const [targetAudience, setTargetAudience] = useState<string>("general");
  const [selectingAsset, setSelectingAsset] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);
  const [regeneratingAsset, setRegeneratingAsset] = useState<string | null>(null);
  const [deletingLibraryMedia, setDeletingLibraryMedia] = useState<string | null>(null);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ current: number; total: number } | null>(null);
  
  const [clipSuggestions, setClipSuggestions] = useState<ClipSuggestion[]>([]);
  const [clipSuggestionsLoading, setClipSuggestionsLoading] = useState(false);
  const [showClipSuggestions, setShowClipSuggestions] = useState(false);
  
  // Image suggestions for filler images when video exists but time remains
  interface ImageSuggestion {
    id: string;
    prompt: string;
    rationale: string;
    continuityElements: string[];
  }
  const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>([]);
  const [imageSuggestionsLoading, setImageSuggestionsLoading] = useState(false);
  const [showImageSuggestions, setShowImageSuggestions] = useState(false);
  
  // Fetch all user media assets across all ICEs for reuse (lazy load when upload tab opens)
  interface UserMediaAsset {
    id: number;
    iceId: string | null;
    url: string;
    fileKey: string;
    category: 'image' | 'video' | 'audio' | 'document' | 'other';
    sizeBytes: number;
    createdAt: string;
  }
  
  const { data: allUserMedia, isLoading: allMediaLoading } = useQuery<{ assets: UserMediaAsset[]; total: number }>({
    queryKey: ["/api/me/media"],
    enabled: activeTab === "upload", // Only fetch when viewing the upload tab
  });
  
  // Clip tabs for multi-video sequence editing
  // Draft clips are clips being created but not yet generated
  interface ClipDraft {
    id: string;
    prompt: string;
    status: 'draft' | 'generating';
    predictionId?: string;
  }
  const [draftClips, setDraftClips] = useState<ClipDraft[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  
  // Draft images being generated (for timeline loading state)
  interface ImageDraft {
    id: string;
    prompt: string;
    status: 'generating';
  }
  const [draftImages, setDraftImages] = useState<ImageDraft[]>([]);
  
  // Get persisted video assets
  const videoAssets = card.mediaAssets?.filter(a => a.kind === 'video') || [];
  
  // Unified clip list: persisted assets + draft clips
  interface UnifiedClip {
    id: string;
    prompt: string;
    status: 'ready' | 'generating' | 'draft' | 'failed';
    isPersistedAsset: boolean;
    videoUrl?: string;
    durationSec?: number;
    predictionId?: string;
  }
  
  const unifiedClips: UnifiedClip[] = [
    // First, all persisted video assets
    ...videoAssets.map(asset => ({
      id: asset.id,
      prompt: asset.prompt || '',
      status: asset.status as 'ready' | 'generating' | 'failed',
      isPersistedAsset: true,
      videoUrl: asset.url,
      durationSec: asset.durationSec,
      predictionId: asset.predictionId,
    })),
    // Then, draft clips that aren't already in assets (by predictionId match)
    ...draftClips.filter(draft => 
      !videoAssets.some(a => a.predictionId && a.predictionId === draft.predictionId)
    ).map(draft => ({
      id: draft.id,
      prompt: draft.prompt,
      status: draft.status as 'draft' | 'generating',
      isPersistedAsset: false,
      predictionId: draft.predictionId,
    })),
  ];
  
  // Helper to add a new draft clip immediately
  const addDraftClip = (prompt: string) => {
    const newDraft: ClipDraft = {
      id: `draft-${Date.now()}`,
      prompt,
      status: 'draft',
    };
    setDraftClips(prev => [...prev, newDraft]);
    setActiveClipId(newDraft.id);
    setVideoPrompt(prompt);
    return newDraft;
  };
  
  // Helper to mark a draft as generating
  const markDraftGenerating = (draftId: string, predictionId: string) => {
    setDraftClips(prev => prev.map(d => 
      d.id === draftId ? { ...d, status: 'generating' as const, predictionId } : d
    ));
  };
  
  // Helper to remove a draft (when asset is persisted)
  const removeDraft = (draftId: string) => {
    setDraftClips(prev => prev.filter(d => d.id !== draftId));
  };
  
  // Derive visual blocks for the lane-based UI
  const visualBlocks = deriveVisualBlocks(card, draftClips, draftImages);
  const totalVisualDuration = visualBlocks.reduce((sum, b) => sum + b.durationSec, 0);
  const narrationDuration = card.narrationDurationSec || 0;
  const remainingDuration = Math.max(0, narrationDuration - totalVisualDuration);
  const needsMoreVisuals = remainingDuration > 0 && narrationDuration > 0;
  
  const { data: videoConfig } = useQuery({
    queryKey: ["video-config"],
    queryFn: async () => {
      const res = await fetch("/api/video/config");
      if (!res.ok) return { configured: false, models: [] };
      return res.json();
    },
  });
  
  const { data: voicesData } = useQuery({
    queryKey: ["tts-voices"],
    queryFn: async () => {
      const res = await fetch("/api/tts/voices");
      if (!res.ok) return { configured: false, voices: [] };
      return res.json();
    },
  });
  
  useEffect(() => {
    if (videoConfig?.defaultEngine && !videoEngine) {
      setVideoEngine(videoConfig.defaultEngine);
    }
    if (videoConfig?.models?.length > 0 && !videoModel) {
      setVideoModel(videoConfig.models[0].id);
    }
  }, [videoConfig, videoEngine, videoModel]);
  
  const handleLockedEngineClick = (engine: VideoEngine) => {
    setUpsellTier(engine.requiredTier || 'pro');
    setShowVideoUpsell(true);
  };
  
  const handleLockedModelClick = (model: VideoModel) => {
    setUpsellTier(model.requiredTier || 'pro');
    setShowVideoUpsell(true);
  };
  
  useEffect(() => {
    if (videoStatus === "processing" || videoStatus === "pending") {
      if (!videoGenStartTime) {
        setVideoGenStartTime(Date.now());
      }
      const interval = setInterval(() => {
        setVideoGenElapsed(Math.floor((Date.now() - (videoGenStartTime || Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setVideoGenStartTime(null);
      setVideoGenElapsed(0);
    }
  }, [videoStatus, videoGenStartTime]);
  
  // Poll for video generation status
  useEffect(() => {
    if (videoStatus !== "processing") return;
    
    let cancelled = false;
    const pollInterval = setInterval(async () => {
      if (cancelled) return;
      
      try {
        const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/video/status`, {
          credentials: "include",
        });
        if (!res.ok) return;
        
        const data = await res.json();
        if (cancelled) return;
        
        if (data.status === "completed" && data.videoUrl) {
          setVideoStatus("completed");
          
          // Create new MediaAsset for the video
          const newAssetId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newAsset: MediaAsset = {
            id: newAssetId,
            kind: 'video',
            source: 'ai',
            url: data.videoUrl,
            thumbnailUrl: data.videoUrl,
            createdAt: new Date().toISOString(),
            prompt: videoPrompt || '',
            status: 'ready',
            durationSec: videoDuration,
          };
          
          // Calculate start time for new segment
          const existingSegments = card.mediaSegments || [];
          const totalFilledTime = existingSegments.reduce((sum, s) => sum + s.durationSec, 0);
          
          // Create new MediaSegment
          const newSegment: MediaSegment = {
            id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            assetId: newAssetId,
            kind: 'video',
            url: data.videoUrl,
            durationSec: videoDuration,
            startTimeSec: totalFilledTime,
            order: existingSegments.length,
          };
          
          onCardUpdate(card.id, { 
            generatedVideoUrl: data.videoUrl,
            videoGenerationStatus: "completed",
            videoGenerated: true,
            preferredMediaType: 'video',
            mediaAssets: [...(card.mediaAssets || []), newAsset],
            mediaSegments: [...existingSegments, newSegment],
            selectedMediaAssetId: newAssetId,
          });
          toast({ title: "Video ready!", description: "Your AI video has been generated and added to the timeline." });
        } else if (data.status === "failed") {
          setVideoStatus("failed");
          toast({ 
            title: "Video generation failed", 
            description: data.error || "Please try again", 
            variant: "destructive" 
          });
        }
      } catch (err) {
        console.error("Error polling video status:", err);
      }
    }, 10000); // Poll every 10 seconds
    
    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [videoStatus, previewId, card.id, onCardUpdate, toast]);
  
  // Initialize video status from card data
  useEffect(() => {
    if (card.videoGenerationStatus === "processing" && !videoStatus) {
      setVideoStatus("processing");
    } else if (card.generatedVideoUrl && videoStatus !== "completed") {
      setVideoStatus("completed");
    }
  }, [card.videoGenerationStatus, card.generatedVideoUrl, videoStatus]);
  
  const handleEnhancePrompt = async (mediaType: 'image' | 'video' = 'image') => {
    setEnhanceLoading(true);
    try {
      const res = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardTitle: card.title,
          cardContent: card.content,
          styleHints: 'cinematic, professional, high production value',
          mediaType,
          targetAudience,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to enhance prompt');
      
      const data = await res.json();
      setEnhancedPrompt(data.enhancedPrompt);
      onCardUpdate(card.id, { 
        enhancePromptEnabled: true, 
        enhancedPrompt: data.enhancedPrompt,
        basePrompt: data.basePrompt,
      });
      toast({ title: 'Prompt enhanced!', description: 'Your prompt has been optimized for better results.' });
    } catch (error: any) {
      toast({ title: 'Enhancement failed', description: error.message, variant: 'destructive' });
    } finally {
      setEnhanceLoading(false);
    }
  };

  const handleEnhanceVideoPrompt = async () => {
    setVideoEnhanceLoading(true);
    try {
      const res = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardTitle: card.title,
          cardContent: card.content,
          styleHints: 'cinematic motion, camera movement, professional video production, smooth transitions',
          mediaType: 'video',
        }),
      });
      
      if (!res.ok) throw new Error('Failed to enhance video prompt');
      
      const data = await res.json();
      setEnhancedVideoPrompt(data.enhancedPrompt);
      setVideoPrompt(data.enhancedPrompt);
      toast({ title: 'Video prompt enhanced!', description: 'Motion and camera directions optimized.' });
    } catch (error: any) {
      toast({ title: 'Enhancement failed', description: error.message, variant: 'destructive' });
    } finally {
      setVideoEnhanceLoading(false);
    }
  };

  const handleSelectAsset = async (assetId: string) => {
    setSelectingAsset(true);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/media/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assetId }),
      });
      
      if (!res.ok) throw new Error('Failed to select asset');
      
      const data = await res.json();
      const asset = data.asset;
      onCardUpdate(card.id, { 
        selectedMediaAssetId: assetId,
        generatedImageUrl: asset.kind === 'image' ? asset.url : card.generatedImageUrl,
        generatedVideoUrl: asset.kind === 'video' ? asset.url : card.generatedVideoUrl,
      });
      toast({ title: 'Asset selected', description: `${asset.kind === 'image' ? 'Image' : 'Video'} is now active for this card.` });
    } catch (error: any) {
      toast({ title: 'Selection failed', description: error.message, variant: 'destructive' });
    } finally {
      setSelectingAsset(false);
    }
  };

  const handleFetchContinuationSuggestions = async () => {
    setContinuationSuggestLoading(true);
    setContinuationSuggestMode(true);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/suggest-continuation-still`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ count: 3 }),
      });
      
      if (!res.ok) throw new Error('Failed to get suggestions');
      
      const data = await res.json();
      setContinuationSuggestions(data.suggestions || []);
    } catch (error: any) {
      toast({ title: 'Failed to get suggestions', description: error.message, variant: 'destructive' });
      setContinuationSuggestMode(false);
    } finally {
      setContinuationSuggestLoading(false);
    }
  };

  const handleLoadMoreSuggestions = async () => {
    setContinuationSuggestLoading(true);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/suggest-continuation-still`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ count: 3, offset: continuationSuggestions.length }),
      });
      
      if (!res.ok) throw new Error('Failed to get more suggestions');
      
      const data = await res.json();
      setContinuationSuggestions(prev => [...prev, ...(data.suggestions || [])]);
    } catch (error: any) {
      toast({ title: 'Failed to load more', description: error.message, variant: 'destructive' });
    } finally {
      setContinuationSuggestLoading(false);
    }
  };

  const handleSelectContinuationPrompt = async (prompt: string) => {
    setShowAddVisualModal(false);
    setContinuationSuggestMode(false);
    setImagePrompt(prompt);
    setActiveTab("image");
    setEditorMode("tabs");
    onCardUpdate(card.id, { cinematicContinuationEnabled: true });
  };

  const handleDeleteAsset = async (assetId: string) => {
    setDeletingAsset(assetId);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/media/${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to delete asset');
      
      const data = await res.json();
      const updatedAssets = (card.mediaAssets || []).filter(a => a.id !== assetId);
      
      // Use server's response for the new active URLs (already persisted)
      const updateData: Record<string, any> = { 
        mediaAssets: updatedAssets,
        selectedMediaAssetId: data.newSelectedAssetId || undefined,
        generatedImageUrl: data.newGeneratedImageUrl || undefined,
        generatedVideoUrl: data.newGeneratedVideoUrl || undefined,
      };
      
      onCardUpdate(card.id, updateData);
      toast({ title: 'Asset deleted' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingAsset(null);
    }
  };

  const handleRegenerateAsset = async (assetId: string) => {
    const asset = card.mediaAssets?.find(a => a.id === assetId);
    if (!asset) return;
    
    setRegeneratingAsset(assetId);
    try {
      if (asset.kind === 'image') {
        // Regenerate image using original prompt or current card content
        const prompt = asset.prompt || `${card.title}. ${card.content}`;
        const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/regenerate-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ assetId, prompt, kind: 'image' }),
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to regenerate image');
        }
        
        const data = await res.json();
        // Update the asset in place
        const updatedAssets = (card.mediaAssets || []).map(a => 
          a.id === assetId ? { ...a, url: data.newUrl, prompt: data.prompt } : a
        );
        const updateData: Record<string, any> = { mediaAssets: updatedAssets };
        if (card.selectedMediaAssetId === assetId || card.generatedImageUrl === asset.url) {
          updateData.generatedImageUrl = data.newUrl;
        }
        onCardUpdate(card.id, updateData);
        toast({ title: 'Image regenerated!' });
      } else if (asset.kind === 'video') {
        // Regenerate video using original prompt
        const prompt = asset.prompt || `Cinematic scene: ${card.title}. ${card.content}`;
        const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/regenerate-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ assetId, prompt, kind: 'video' }),
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to start video regeneration');
        }
        
        const data = await res.json();
        // Mark asset as regenerating
        const updatedAssets = (card.mediaAssets || []).map(a => 
          a.id === assetId ? { ...a, status: 'generating' as const, predictionId: data.predictionId } : a
        );
        onCardUpdate(card.id, { mediaAssets: updatedAssets });
        toast({ title: 'Video regenerating...', description: 'This may take 1-3 minutes.' });
        // Start polling for completion
        setVideoStatus('processing');
      }
    } catch (error: any) {
      toast({ title: 'Regeneration failed', description: error.message, variant: 'destructive' });
    } finally {
      setRegeneratingAsset(null);
    }
  };

  const doGenerateImage = async () => {
    setImageLoading(true);
    
    // Create draft image for timeline loading state
    const prompt = enhancePromptEnabled && enhancedPrompt 
      ? enhancedPrompt 
      : (imagePrompt || `${card.title}. ${card.content}`);
    const draftId = `draft-img-${Date.now()}`;
    setDraftImages(prev => [...prev, { id: draftId, prompt, status: 'generating' }]);
    
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        if (err.upgradeRequired) {
          onUpgradeClick();
          return;
        }
        throw new Error(err.message || "Failed to generate image");
      }
      
      const data = await res.json();
      const newAssets = [...(card.mediaAssets || []), data.asset];
      onCardUpdate(card.id, { 
        generatedImageUrl: data.imageUrl,
        mediaAssets: newAssets,
        selectedMediaAssetId: data.asset.id,
      });
      toast({ title: "Image generated!", description: "AI image added to your timeline." });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      // Remove the draft image - the real asset will now show in timeline
      setDraftImages(prev => prev.filter(d => d.id !== draftId));
      setImageLoading(false);
    }
  };
  
  const handleGenerateImage = () => {
    if (!canGenerateImages) {
      onUpgradeClick();
      return;
    }
    
    // Check if Bible is set - if not, show warning before generating
    if (!hasBible && onShowBibleWarning) {
      onShowBibleWarning(doGenerateImage);
      return;
    }
    
    doGenerateImage();
  };
  
  const handleGenerateVideo = async () => {
    if (!canGenerateVideos) {
      onUpgradeClick();
      return;
    }
    
    // Find active draft to mark as generating
    const activeDraft = draftClips.find(d => d.id === activeClipId && d.status === 'draft');
    
    setVideoLoading(true);
    setVideoStatus("pending");
    setVideoGenStartTime(Date.now());
    
    try {
      const effectivePrompt = videoPrompt || `Cinematic scene: ${card.title}. ${card.content}`;
      const effectiveImageUrl = videoMode === "image-to-video" 
        ? (referenceImageUrl || card.generatedImageUrl) 
        : undefined;
      
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: videoMode,
          engine: videoEngine,
          model: videoModel,
          duration: videoDuration,
          prompt: effectivePrompt,
          sourceImageUrl: effectiveImageUrl,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        if (err.errorCode === 'VIDEO_MODEL_NOT_ALLOWED' || err.upgradeRequired) {
          setUpsellTier(err.suggestedTier || 'pro');
          setShowVideoUpsell(true);
          setVideoLoading(false);
          setVideoStatus(null);
          return;
        }
        throw new Error(err.message || "Failed to generate video");
      }
      
      const data = await res.json();
      if (data.status === "completed") {
        setVideoStatus("completed");
        
        // Remove draft clip if it exists (video is now persisted as asset)
        if (activeDraft) {
          removeDraft(activeDraft.id);
        }
        
        // Create new MediaAsset for the video
        const newAssetId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newAsset: MediaAsset = {
          id: newAssetId,
          kind: 'video',
          source: 'ai',
          url: data.videoUrl,
          thumbnailUrl: data.videoUrl,
          createdAt: new Date().toISOString(),
          prompt: effectivePrompt,
          status: 'ready',
          durationSec: videoDuration,
        };
        
        // Calculate start time for new segment
        const existingSegments = card.mediaSegments || [];
        const totalFilledTime = existingSegments.reduce((sum, s) => sum + s.durationSec, 0);
        
        // Create new MediaSegment
        const newSegment: MediaSegment = {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          assetId: newAssetId,
          kind: 'video',
          url: data.videoUrl,
          durationSec: videoDuration,
          startTimeSec: totalFilledTime,
          order: existingSegments.length,
        };
        
        onCardUpdate(card.id, { 
          generatedVideoUrl: data.videoUrl, 
          videoGenerationStatus: "completed",
          videoGenerated: true,
          preferredMediaType: 'video',
          mediaAssets: [...(card.mediaAssets || []), newAsset],
          mediaSegments: [...existingSegments, newSegment],
          selectedMediaAssetId: newAssetId,
        });
        
        // Update active clip to the new asset
        setActiveClipId(newAssetId);
        
        const clipNumber = unifiedClips.length;
        toast({ title: `Clip ${clipNumber} ready!`, description: "AI video has been generated and added to timeline." });
      } else {
        setVideoStatus("processing");
        
        // Mark draft as generating if we have a prediction ID
        if (activeDraft && data.predictionId) {
          markDraftGenerating(activeDraft.id, data.predictionId);
        }
        
        const clipNumber = unifiedClips.length;
        toast({ title: `Generating Clip ${clipNumber}`, description: "This may take 1-3 minutes." });
      }
    } catch (error: any) {
      setVideoStatus("failed");
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setVideoLoading(false);
    }
  };
  
  const handlePreviewNarration = async () => {
    if (previewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(false);
      return;
    }
    
    const text = narrationText.slice(0, 300);
    if (!text.trim()) {
      toast({ title: "No text to preview", variant: "destructive" });
      return;
    }
    
    try {
      setPreviewPlaying(true);
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/narration/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text,
          voice: narrationVoice,
          speed: narrationSpeed,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Preview failed");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (error: any) {
      setPreviewPlaying(false);
      toast({ title: "Preview failed", description: error.message, variant: "destructive" });
    }
  };
  
  const handleGenerateNarration = async () => {
    if (!canGenerateVoiceover) {
      onUpgradeClick();
      return;
    }
    
    setNarrationLoading(true);
    try {
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/narration/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: narrationText,
          voice: narrationVoice,
          speed: narrationSpeed,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        if (err.upgradeRequired) {
          onUpgradeClick();
          return;
        }
        throw new Error(err.message || "Failed to generate narration");
      }
      
      const data = await res.json();
      const updates: Record<string, any> = { narrationAudioUrl: data.audioUrl };
      if (data.narrationDurationSec) {
        updates.narrationDurationSec = data.narrationDurationSec;
      }
      if (data.videoDurationSec) {
        updates.videoDurationSec = data.videoDurationSec;
      }
      onCardUpdate(card.id, updates);
      onCardSave(card.id, updates);
      
      // Show continuation still prompt if narration exceeds video duration
      if (data.needsContinuation && data.hasVideo) {
        toast({ 
          title: "Narration generated!", 
          description: `AI voiceover created (${data.narrationDurationSec?.toFixed(1) || '?'}s). Your narration extends beyond the video - consider generating a continuation still for smooth visual transition.`,
        });
      } else {
        toast({ title: "Narration generated!", description: "AI voiceover has been created." });
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setNarrationLoading(false);
    }
  };
  
  const handleUploadMedia = async (file: File, type: "image" | "video") => {
    const setUploading = type === "image" ? setImageUploading : setVideoUploading;
    setUploading(true);
    
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      
      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await urlRes.json();
      
      // Use XMLHttpRequest for Safari compatibility with presigned URLs
      await new Promise<void>((resolve, reject) => {
        try {
          const xhr = new XMLHttpRequest();
          // Safari can be strict about URL validation - ensure URL is properly formatted
          xhr.open("PUT", uploadURL, true);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.ontimeout = () => reject(new Error("Upload timed out"));
          xhr.send(file);
        } catch (e: any) {
          // Safari may throw during xhr.open() if URL is malformed
          console.error("XHR setup error:", e);
          reject(new Error(e?.message || "Failed to initiate upload"));
        }
      });
      
      const mediaUrl = objectPath;
      
      if (type === "image") {
        const newAsset: MediaAsset = {
          id: `upload-img-${Date.now()}`,
          kind: 'image',
          source: 'upload',
          url: mediaUrl,
          status: 'ready',
          createdAt: new Date().toISOString(),
          prompt: 'Uploaded image',
        };
        const updatedAssets = [...(card.mediaAssets || []), newAsset];
        onCardUpdate(card.id, { 
          generatedImageUrl: mediaUrl,
          mediaAssets: updatedAssets,
          selectedMediaAssetId: newAsset.id,
        });
        onCardSave(card.id, { 
          generatedImageUrl: mediaUrl,
          mediaAssets: updatedAssets,
          selectedMediaAssetId: newAsset.id,
        });
        toast({ title: "Image uploaded!", description: "Your image has been added to the card." });
      } else {
        // Get video duration from the file before creating asset
        let videoDuration: number | undefined;
        try {
          const videoUrl = URL.createObjectURL(file);
          const tempVideo = document.createElement('video');
          tempVideo.preload = 'metadata';
          videoDuration = await new Promise<number>((resolve) => {
            tempVideo.onloadedmetadata = () => {
              URL.revokeObjectURL(videoUrl);
              resolve(tempVideo.duration);
            };
            tempVideo.onerror = () => {
              URL.revokeObjectURL(videoUrl);
              resolve(5); // Default fallback
            };
            tempVideo.src = videoUrl;
          });
        } catch {
          videoDuration = undefined;
        }
        
        const newAsset: MediaAsset = {
          id: `upload-vid-${Date.now()}`,
          kind: 'video',
          source: 'upload',
          url: mediaUrl,
          status: 'ready',
          createdAt: new Date().toISOString(),
          prompt: 'Uploaded video',
          durationSec: videoDuration,
          muteAudio: muteUploadedVideo, // Apply user's mute preference
        };
        const updatedAssets = [...(card.mediaAssets || []), newAsset];
        onCardUpdate(card.id, { 
          generatedVideoUrl: mediaUrl, 
          videoGenerationStatus: "completed",
          videoGenerated: true,
          preferredMediaType: 'video',
          mediaAssets: updatedAssets,
          selectedMediaAssetId: newAsset.id,
          videoDurationSec: videoDuration,
        });
        onCardSave(card.id, { 
          generatedVideoUrl: mediaUrl, 
          videoGenerationStatus: "completed",
          videoGenerated: true,
          preferredMediaType: 'video',
          mediaAssets: updatedAssets,
          selectedMediaAssetId: newAsset.id,
          videoDurationSec: videoDuration,
        });
        toast({ 
          title: "Video uploaded!", 
          description: videoDuration 
            ? `Your video (${videoDuration.toFixed(1)}s) has been added to the card.` 
            : "Your video has been added to the card." 
        });
      }
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Filter to valid image files
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please select image files.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    
    // Bulk upload
    if (validFiles.length > 1) {
      setBulkUploadProgress({ current: 0, total: validFiles.length });
      for (let i = 0; i < validFiles.length; i++) {
        setBulkUploadProgress({ current: i + 1, total: validFiles.length });
        await handleUploadMedia(validFiles[i], "image");
      }
      setBulkUploadProgress(null);
      toast({ title: "Bulk upload complete", description: `${validFiles.length} images uploaded successfully.` });
    } else {
      await handleUploadMedia(validFiles[0], "image");
    }
    e.target.value = "";
  };
  
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Filter to valid video files
    const validFiles = files.filter(f => f.type.startsWith("video/"));
    if (validFiles.length === 0) {
      toast({ title: "Invalid files", description: "Please select video files.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    
    // Bulk upload
    if (validFiles.length > 1) {
      setBulkUploadProgress({ current: 0, total: validFiles.length });
      for (let i = 0; i < validFiles.length; i++) {
        setBulkUploadProgress({ current: i + 1, total: validFiles.length });
        await handleUploadMedia(validFiles[i], "video");
      }
      setBulkUploadProgress(null);
      toast({ title: "Bulk upload complete", description: `${validFiles.length} videos uploaded successfully.` });
    } else {
      await handleUploadMedia(validFiles[0], "video");
    }
    e.target.value = "";
  };
  
  // Delete media from user's library (removes from all cards)
  const handleDeleteLibraryMedia = async (url: string, iceId: string | null) => {
    setDeletingLibraryMedia(url);
    try {
      const res = await fetch("/api/me/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, iceId }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to delete media");
      }
      
      const data = await res.json();
      
      // Invalidate the media query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/me/media"] });
      
      toast({ 
        title: "Media deleted", 
        description: data.message || "Media has been removed from your library.",
      });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setDeletingLibraryMedia(null);
    }
  };
  
  const isGuestCard = card.cardType === 'guest';
  
  return (
    <div className={`border rounded-lg overflow-hidden ${
      isGuestCard 
        ? "border-amber-500/40 bg-amber-950/20" 
        : "border-slate-700 bg-slate-900/80"
    }`}>
      <div 
        className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
          isExpanded 
            ? isGuestCard 
              ? "bg-amber-900/30 border-b border-amber-500/30" 
              : "bg-cyan-900/30 border-b border-cyan-500/30"
            : "hover:bg-slate-800/50"
        }`}
        onClick={onToggleExpand}
        data-testid={`card-editor-header-${cardIndex}`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm ${
          isGuestCard
            ? isExpanded ? "bg-amber-600 text-white" : "bg-amber-800 text-amber-200"
            : isExpanded ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400"
        }`}>
          {isGuestCard ? <User className="w-5 h-5" /> : String(cardIndex + 1).padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{card.title || (isGuestCard ? "Guest Cameo" : "Untitled Card")}</h3>
            {isGuestCard && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 rounded">
                GUEST
              </span>
            )}
            {isGuestCard && card.guestCategory && (
              <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-slate-700 text-slate-300 rounded">
                {GUEST_CATEGORY_LABELS[card.guestCategory] || card.guestCategory}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">
            {isGuestCard 
              ? card.guestName 
                ? `${card.guestName}${card.guestRole ? `, ${card.guestRole}` : ''}${card.guestCompany ? ` • ${card.guestCompany}` : ''}`
                : "Short cutaway from an expert, customer, or testimonial"
              : `${card.content?.slice(0, 60) || "No content"}...`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {card.generatedImageUrl && (
            <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center relative" title="Has image">
              <Image className="w-3 h-3 text-green-400" />
              {(card.mediaAssets?.filter(a => a.kind === 'image').length || 0) > 1 && (
                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-green-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center" data-testid="badge-image-count">
                  ×{card.mediaAssets?.filter(a => a.kind === 'image').length}
                </span>
              )}
            </div>
          )}
          {card.generatedVideoUrl && (
            <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center relative" title="Has video">
              <Video className="w-3 h-3 text-blue-400" />
              {((card.mediaSegments?.length || 0) > 1 || (card.mediaAssets?.filter(a => a.kind === 'video').length || 0) > 1) && (
                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-blue-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center" data-testid="badge-video-count">
                  ×{card.mediaSegments?.length || card.mediaAssets?.filter(a => a.kind === 'video').length || 1}
                </span>
              )}
            </div>
          )}
          {card.narrationAudioUrl && (
            <div className="w-6 h-6 rounded bg-cyan-500/20 flex items-center justify-center" title="Has narration">
              <Mic className="w-3 h-3 text-cyan-400" />
            </div>
          )}
          {isGuestCard && card.guestStatus === 'ready' && card.guestVideoUrl && (
            <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center" title="Guest video ready">
              <Check className="w-3 h-3 text-amber-400" />
            </div>
          )}
          {isGuestCard && card.guestStatus === 'generating' && (
            <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center" title="Generating guest video">
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
            </div>
          )}
          {isGuestCard && card.guestStatus === 'failed' && (
            <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center" title={card.guestError || "Generation failed"}>
              <AlertCircle className="w-3 h-3 text-red-400" />
            </div>
          )}
          
          {/* Card reorder and delete controls */}
          <div className="flex items-center gap-1 ml-2 border-l border-slate-700 pl-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onMoveUp}
              disabled={cardIndex === 0}
              title="Move up"
              data-testid={`button-move-up-${cardIndex}`}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onMoveDown}
              disabled={cardIndex >= totalCards - 1}
              title="Move down"
              data-testid={`button-move-down-${cardIndex}`}
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              onClick={onDelete}
              disabled={totalCards <= 1}
              title="Delete card"
              data-testid={`button-delete-card-${cardIndex}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 space-y-4">
              {/* Guest Card Editor - Different UI for guest cameo cards */}
              {isGuestCard ? (
                <GuestCardEditor 
                  card={card} 
                  previewId={previewId}
                  onCardUpdate={onCardUpdate}
                  onCardSave={onCardSave}
                />
              ) : card.cardType === 'cta' ? (
                <CtaCardEditor
                  card={card}
                  onCardUpdate={onCardUpdate}
                  onCardSave={onCardSave}
                />
              ) : (
              <>
              {/* Lane-based Editor (new) */}
              {editorMode === "lanes" ? (
                <div className="space-y-4">
                  {/* Content Section - Title & Content always visible */}
                  <div className="space-y-3 pb-3 border-b border-slate-700/50">
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Card Title</Label>
                      <Input
                        value={editedTitle}
                        onChange={(e) => {
                          setEditedTitle(e.target.value);
                          onCardUpdate(card.id, { title: e.target.value });
                        }}
                        onBlur={() => onCardSave(card.id, { title: editedTitle, content: editedContent })}
                        placeholder="Enter card title..."
                        className="bg-slate-800 border-slate-700 text-white font-semibold h-9"
                        data-testid="input-card-title-lane"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300 text-sm">Card Content</Label>
                      <Textarea
                        value={editedContent}
                        onChange={(e) => {
                          setEditedContent(e.target.value);
                          onCardUpdate(card.id, { content: e.target.value });
                        }}
                        onBlur={() => onCardSave(card.id, { title: editedTitle, content: editedContent })}
                        placeholder="Enter card content..."
                        rows={3}
                        className="bg-slate-800 border-slate-700 text-white text-sm"
                        data-testid="input-card-content-lane"
                      />
                    </div>
                  </div>
                  
                  {/* Lane Tabs */}
                  <div className="flex gap-2 border-b border-slate-700 pb-2">
                    <button
                      onClick={() => setActiveLane("visuals")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeLane === "visuals" 
                          ? "bg-cyan-600 text-white" 
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                      data-testid="lane-visuals"
                    >
                      <Video className="w-4 h-4" />
                      Visuals
                      {needsMoreVisuals && (
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="More visuals needed" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveLane("audio")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeLane === "audio" 
                          ? "bg-cyan-600 text-white" 
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                      data-testid="lane-audio"
                    >
                      <Mic className="w-4 h-4" />
                      Audio
                      {card.narrationAudioUrl && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                    </button>
                  </div>
                  
                  {/* VISUALS LANE */}
                  {activeLane === "visuals" && (
                    <div className="space-y-4">
                      {/* Timeline Header */}
                      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-medium text-white">Media Timeline</span>
                          </div>
                          <span className="text-sm text-slate-400">
                            {totalVisualDuration.toFixed(1)}s / {narrationDuration.toFixed(1)}s
                          </span>
                        </div>
                        <Progress 
                          value={narrationDuration > 0 ? Math.min(100, (totalVisualDuration / narrationDuration) * 100) : 100} 
                          className="h-2"
                        />
                        {needsMoreVisuals && (
                          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {remainingDuration.toFixed(1)}s remaining to fill
                          </p>
                        )}
                      </div>
                      
                      {/* Visual Blocks List */}
                      <div className="space-y-2">
                        {visualBlocks.length === 0 ? (
                          <div className="p-6 border-2 border-dashed border-slate-700 rounded-lg text-center">
                            <Video className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">No visuals yet</p>
                            <p className="text-xs text-slate-500">Add a visual to bring this card to life</p>
                          </div>
                        ) : (
                          visualBlocks.map((block, index) => (
                            <div 
                              key={block.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                block.status === 'generating' 
                                  ? 'border-blue-500/50 bg-blue-500/10 animate-pulse'
                                  : block.status === 'draft'
                                    ? 'border-amber-500/50 bg-amber-500/10'
                                    : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                              }`}
                              data-testid={`visual-block-${index}`}
                            >
                              {/* Thumbnail */}
                              <div className="w-16 h-10 rounded bg-slate-700 overflow-hidden flex-shrink-0">
                                {block.thumbnailUrl ? (
                                  block.type.includes('video') ? (
                                    <video src={block.url} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <img src={block.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                  )
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    {block.status === 'generating' ? (
                                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                    ) : block.status === 'draft' ? (
                                      <Plus className="w-4 h-4 text-amber-400" />
                                    ) : (
                                      <Video className="w-4 h-4 text-slate-500" />
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-300">
                                    {block.type === 'ai-video' ? 'AI Video' :
                                     block.type === 'ai-image' ? 'AI Image' :
                                     block.type === 'upload-video' ? 'Uploaded' :
                                     block.type === 'stock-video' ? 'Stock' :
                                     block.type === 'continuation' ? 'Continuation Still' :
                                     'Visual'}
                                  </span>
                                  <span className="text-xs text-slate-500">{block.durationSec}s</span>
                                </div>
                                {block.prompt && (
                                  <p className="text-xs text-slate-500 truncate">{block.prompt}</p>
                                )}
                              </div>
                              
                              {/* Video scaling toggle for video blocks */}
                              {block.type.includes('video') && block.status === 'ready' && block.assetId && (() => {
                                const currentMode = card.mediaAssets?.find(a => a.id === block.assetId)?.renderMode || 'fill';
                                const isFit = currentMode === 'fit';
                                return (
                                  <div className="flex items-center gap-1 bg-slate-700 rounded-md p-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedAssets = card.mediaAssets?.map(a => 
                                          a.id === block.assetId ? { ...a, renderMode: 'fill' as RenderMode } : a
                                        );
                                        onCardUpdate(card.id, { mediaAssets: updatedAssets });
                                        onCardSave(card.id, { mediaAssets: updatedAssets });
                                      }}
                                      className={`p-1.5 rounded transition-colors ${
                                        !isFit ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                                      }`}
                                      title="Fill screen (may crop edges)"
                                      data-testid={`button-scale-fill-${block.id}`}
                                    >
                                      <Maximize className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedAssets = card.mediaAssets?.map(a => 
                                          a.id === block.assetId ? { ...a, renderMode: 'fit' as RenderMode } : a
                                        );
                                        onCardUpdate(card.id, { mediaAssets: updatedAssets });
                                        onCardSave(card.id, { mediaAssets: updatedAssets });
                                      }}
                                      className={`p-1.5 rounded transition-colors ${
                                        isFit ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                                      }`}
                                      title="Fit to screen (shows full video)"
                                      data-testid={`button-scale-fit-${block.id}`}
                                    >
                                      <Minimize className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })()}
                              
                              {/* Status indicator */}
                              <div className="flex-shrink-0">
                                {block.status === 'generating' && (
                                  <span className="text-xs text-blue-400">Generating...</span>
                                )}
                                {block.status === 'draft' && (
                                  <span className="text-xs text-amber-400">Draft</span>
                                )}
                                {block.status === 'ready' && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Add Visual Button */}
                      <Button
                        onClick={() => setShowAddVisualModal(true)}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-2"
                        data-testid="button-add-visual"
                      >
                        <Plus className="w-4 h-4" />
                        Add Visual
                      </Button>
                      
                      {/* Add Visual Modal */}
                      {showAddVisualModal && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                          <motion.div 
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="bg-slate-900 rounded-t-xl sm:rounded-xl w-full max-w-md border border-slate-700 shadow-xl"
                          >
                            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                              <h3 className="font-semibold text-white">Add Visual</h3>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setShowAddVisualModal(false);
                                  setContinuationSuggestMode(false);
                                  setContinuationSuggestions([]);
                                }}
                                className="h-8 w-8"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-3">
                              <button
                                onClick={() => {
                                  setShowAddVisualModal(false);
                                  setActiveTab("video");
                                  setEditorMode("tabs");
                                }}
                                className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500/50 transition-colors text-left"
                                data-testid="add-visual-ai-video"
                              >
                                <Video className="w-6 h-6 text-cyan-400 mb-2" />
                                <p className="text-sm font-medium text-white">AI Video</p>
                                <p className="text-xs text-slate-400">Generate with AI</p>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setShowAddVisualModal(false);
                                  setActiveTab("image");
                                  setEditorMode("tabs");
                                }}
                                className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500/50 transition-colors text-left"
                                data-testid="add-visual-ai-image"
                              >
                                <Image className="w-6 h-6 text-purple-400 mb-2" />
                                <p className="text-sm font-medium text-white">AI Image</p>
                                <p className="text-xs text-slate-400">Generate with AI</p>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setShowAddVisualModal(false);
                                  setActiveTab("upload");
                                  setEditorMode("tabs");
                                }}
                                className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500/50 transition-colors text-left"
                                data-testid="add-visual-upload"
                              >
                                <Upload className="w-6 h-6 text-green-400 mb-2" />
                                <p className="text-sm font-medium text-white">Upload</p>
                                <p className="text-xs text-slate-400">Your own media</p>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setShowAddVisualModal(false);
                                  setActiveTab("stock");
                                  setEditorMode("tabs");
                                }}
                                className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-cyan-500/50 transition-colors text-left"
                                data-testid="add-visual-stock"
                              >
                                <ImagePlus className="w-6 h-6 text-amber-400 mb-2" />
                                <p className="text-sm font-medium text-white">Stock</p>
                                <p className="text-xs text-slate-400">Pexels library</p>
                              </button>
                              
                              {needsMoreVisuals && !continuationSuggestMode && (
                                <button
                                  onClick={handleFetchContinuationSuggestions}
                                  disabled={continuationSuggestLoading}
                                  className="col-span-2 p-4 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/50 transition-colors text-left disabled:opacity-50"
                                  data-testid="add-visual-continuation"
                                >
                                  <div className="flex items-center gap-3">
                                    {continuationSuggestLoading ? (
                                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-6 h-6 text-purple-400" />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-white">Continuation Still</p>
                                      <p className="text-xs text-slate-400">Get AI image suggestions</p>
                                    </div>
                                  </div>
                                </button>
                              )}
                              
                              {/* Continuation Still Suggestions */}
                              {continuationSuggestMode && (
                                <div className="col-span-2 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-4 h-4 text-purple-400" />
                                      <span className="text-sm font-medium text-white">Suggested Prompts</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setContinuationSuggestMode(false);
                                        setContinuationSuggestions([]);
                                      }}
                                      className="h-7 text-slate-400"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Back
                                    </Button>
                                  </div>
                                  
                                  {continuationSuggestLoading && continuationSuggestions.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                                    </div>
                                  ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                      {continuationSuggestions.map((suggestion, index) => (
                                        <button
                                          key={index}
                                          onClick={() => handleSelectContinuationPrompt(suggestion.prompt)}
                                          className="w-full p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-purple-500/50 transition-colors text-left group"
                                          data-testid={`continuation-suggestion-${index}`}
                                        >
                                          <p className="text-sm text-white mb-1">{suggestion.prompt}</p>
                                          <p className="text-xs text-slate-400">{suggestion.rationale}</p>
                                          <div className="flex items-center gap-1 mt-2 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Image className="w-3 h-3" />
                                            Use this prompt
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {continuationSuggestions.length > 0 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleLoadMoreSuggestions}
                                      disabled={continuationSuggestLoading}
                                      className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                                      data-testid="button-load-more-suggestions"
                                    >
                                      {continuationSuggestLoading ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                          Loading...
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3 h-3 mr-2" />
                                          Load More Suggestions
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* AUDIO LANE */}
                  {activeLane === "audio" && (
                    <div className="space-y-4">
                      {/* Existing Narration */}
                      {card.narrationAudioUrl && (
                        <div className="rounded-lg overflow-hidden border border-cyan-500/30 bg-cyan-500/5">
                          <div className="p-2 bg-cyan-500/10 flex items-center justify-between">
                            <span className="text-sm font-medium text-cyan-400">Generated Narration</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => onCardUpdate(card.id, { narrationAudioUrl: undefined })}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                          <div className="p-3">
                            <audio 
                              src={card.narrationAudioUrl} 
                              controls 
                              className="w-full h-10"
                              data-testid="audio-preview-lane"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Narration Controls */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Narration Text</Label>
                          <Textarea
                            placeholder="Enter the text to be narrated..."
                            value={narrationText}
                            onChange={(e) => setNarrationText(e.target.value)}
                            rows={4}
                            className="bg-slate-800 border-slate-700 text-white"
                            data-testid="input-narration-text-lane"
                          />
                          <p className="text-xs text-slate-500">{narrationText.length} / 3000 characters</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">Voice</Label>
                            <Select value={narrationVoice} onValueChange={setNarrationVoice}>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(voicesData?.voices || []).map((v: { id: string; name: string }) => (
                                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-slate-300">Speed: {narrationSpeed.toFixed(1)}x</Label>
                            <Slider
                              value={[narrationSpeed]}
                              onValueChange={([v]) => setNarrationSpeed(v)}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                              className="mt-3"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={handlePreviewNarration}
                            disabled={!narrationText.trim()}
                            className="gap-2 border-slate-600"
                            data-testid="button-preview-narration-lane"
                          >
                            {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {previewPlaying ? "Stop" : "Preview"}
                          </Button>
                          
                          <Button
                            onClick={handleGenerateNarration}
                            disabled={narrationLoading || !narrationText.trim() || narrationText.length > 3000}
                            className={`flex-1 gap-2 ${card.narrationAudioUrl ? 'bg-green-600 hover:bg-green-700' : ''}`}
                            data-testid="button-generate-narration-lane"
                          >
                            {narrationLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : card.narrationAudioUrl ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                            {narrationLoading ? "Generating..." : card.narrationAudioUrl ? "Regenerate" : "Generate Narration"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Back to Tabs toggle (temporary during transition) */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setEditorMode("tabs")}
                      className="text-xs text-slate-500 hover:text-slate-400"
                    >
                      Switch to tab view
                    </button>
                  </div>
                </div>
              ) : (
              /* Old Tab-based Editor (fallback) */
              <>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setEditorMode("lanes")}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  ← Back to lane view
                </button>
              </div>
              <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("content")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === "content" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-content"
                >
                  <Wand2 className="w-4 h-4" />
                  Content
                </button>
                <button
                  onClick={() => setActiveTab("image")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === "image" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-image-gen"
                >
                  <Image className="w-4 h-4" />
                  AI Image
                  {!canGenerateImages && <Lock className="w-3 h-3 ml-1 text-yellow-400" />}
                </button>
                <button
                  onClick={() => setActiveTab("video")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === "video" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-video-gen"
                >
                  <Video className="w-4 h-4" />
                  AI Video
                  {!canGenerateVideos && <Lock className="w-3 h-3 ml-1 text-yellow-400" />}
                </button>
                <button
                  onClick={() => setActiveTab("narration")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === "narration" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-narration"
                >
                  <Mic className="w-4 h-4" />
                  Narration
                  {!canGenerateVoiceover && <Lock className="w-3 h-3 ml-1 text-yellow-400" />}
                </button>
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === "upload" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-upload"
                >
                  <Upload className="w-4 h-4" />
                  Your Media
                </button>
                <button
                  onClick={() => setActiveTab("stock")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === "stock" 
                      ? "bg-cyan-600 text-white" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid="tab-stock"
                >
                  <ImagePlus className="w-4 h-4" />
                  Stock
                </button>
              </div>
              
              {activeTab === "content" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Card Title</Label>
                    <Input
                      value={editedTitle}
                      onChange={(e) => {
                        setEditedTitle(e.target.value);
                        onCardUpdate(card.id, { title: e.target.value });
                      }}
                      onBlur={() => onCardSave(card.id, { title: editedTitle, content: editedContent })}
                      placeholder="Enter card title..."
                      className="bg-slate-800 border-slate-700 text-white font-semibold"
                      data-testid="input-card-title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300">Card Content</Label>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => {
                        setEditedContent(e.target.value);
                        onCardUpdate(card.id, { content: e.target.value });
                      }}
                      onBlur={() => onCardSave(card.id, { title: editedTitle, content: editedContent })}
                      placeholder="Enter card content..."
                      rows={5}
                      className="bg-slate-800 border-slate-700 text-white"
                      data-testid="input-card-content"
                    />
                  </div>
                  
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400">
                      This content will be used to generate AI images, videos, and narration for this card.
                    </p>
                  </div>
                </div>
              )}
              
              {activeTab === "image" && (
                <div className="relative space-y-4">
                  {!canGenerateImages && (
                    <LockedOverlay
                      feature="AI Image Generation"
                      description="Generate stunning AI images for your story cards with a Pro subscription."
                      onUpgrade={onUpgradeClick}
                    />
                  )}
                  
                  {/* Quick Add Section - one-click image generation */}
                  <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white">Quick Add</span>
                        <p className="text-[10px] text-slate-400">One-click image generation</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setEnhancePromptEnabled(true);
                        handleGenerateImage();
                      }}
                      disabled={imageLoading || imageUploading}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white gap-2 h-12"
                      data-testid="button-quick-image"
                    >
                      {imageLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <div className="text-left">
                        <div className="text-sm font-medium">Generate AI Image</div>
                        <div className="text-[10px] opacity-80">Auto-enhanced from card content</div>
                      </div>
                    </Button>
                    <p className="text-[10px] text-slate-500 mt-2 text-center">
                      Scroll down for advanced options or to browse your media library.
                    </p>
                  </div>
                  
                  {/* From Brief - Pre-prepared prompts from Producer Brief */}
                  {card.visualPrompt && (
                    <div className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                          <FileText className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-white">From Brief</span>
                        <span className="text-xs text-purple-300/70">Pre-prepared prompt</span>
                      </div>
                      <button
                        onClick={() => {
                          const promptText = extractPromptText(card.visualPrompt);
                          setImagePrompt(promptText);
                          toast({ title: "Prompt applied", description: "Brief prompt loaded - you can edit or generate directly." });
                        }}
                        className="w-full p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-colors text-left group"
                        data-testid="button-apply-brief-prompt"
                      >
                        <p className="text-sm text-white/90 line-clamp-2">{extractPromptText(card.visualPrompt)}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Wand2 className="w-3 h-3" />
                          Click to use this prompt
                        </div>
                      </button>
                    </div>
                  )}
                  
                  {/* Media Library - shows all assets */}
                  {(card.mediaAssets?.length || 0) > 0 && (
                    <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                          <Image className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-white">Media Library</span>
                        <span className="text-xs text-slate-400 ml-auto">{card.mediaAssets?.filter(a => a.kind === 'image').length} images</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {card.mediaAssets?.filter(a => a.kind === 'image').map((asset) => (
                          <div 
                            key={asset.id}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                              card.selectedMediaAssetId === asset.id 
                                ? 'border-green-500 ring-2 ring-green-500/30' 
                                : 'border-slate-700 hover:border-slate-500'
                            }`}
                            onClick={() => handleSelectAsset(asset.id)}
                            data-testid={`asset-image-${asset.id}`}
                          >
                            <img 
                              src={asset.url} 
                              alt="Media asset"
                              className="w-full h-20 object-cover"
                            />
                            <div className="absolute top-1 left-1 flex gap-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                asset.source === 'ai' 
                                  ? 'bg-cyan-500/80 text-white' 
                                  : 'bg-blue-500/80 text-white'
                              }`}>
                                {asset.source === 'ai' ? 'AI' : 'Upload'}
                              </span>
                            </div>
                            {card.selectedMediaAssetId === asset.id && (
                              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {/* Action buttons - visible on mobile, hover on desktop */}
                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                              {asset.source === 'ai' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 bg-cyan-500/80 hover:bg-cyan-600 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegenerateAsset(asset.id);
                                  }}
                                  disabled={regeneratingAsset === asset.id}
                                  data-testid={`regenerate-asset-${asset.id}`}
                                >
                                  {regeneratingAsset === asset.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 bg-red-500/80 hover:bg-red-600 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAsset(asset.id);
                                }}
                                disabled={deletingAsset === asset.id}
                                data-testid={`delete-asset-${asset.id}`}
                              >
                                {deletingAsset === asset.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Currently Selected Preview */}
                  {card.generatedImageUrl && (
                    <div className="rounded-xl overflow-hidden border border-green-500/40 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent">
                      <div className="p-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-green-400">Active Image</span>
                      </div>
                      <img 
                        src={card.generatedImageUrl} 
                        alt={card.title}
                        className="w-full max-h-48 object-contain bg-black/50"
                      />
                    </div>
                  )}
                  
                  {/* Scene Continuity Controls - Only show when there's a locked scene */}
                  {hasLockedScene && (
                    <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-400" />
                          <Label className="text-slate-300">Scene Continuity</Label>
                        </div>
                        <select
                          value={card.sceneMode || 'USE_LOCKED_SCENE'}
                          onChange={(e) => onCardUpdate(card.id, { 
                            sceneMode: e.target.value as 'USE_LOCKED_SCENE' | 'OVERRIDE_SCENE' | 'NO_SCENE' 
                          })}
                          className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-2 py-1"
                          data-testid="select-scene-mode"
                        >
                          <option value="USE_LOCKED_SCENE">Use Locked Scene</option>
                          <option value="OVERRIDE_SCENE">Override for this card</option>
                          <option value="NO_SCENE">No scene constraints</option>
                        </select>
                      </div>
                      
                      <p className="text-xs text-amber-400/70">
                        {card.sceneMode === 'OVERRIDE_SCENE' 
                          ? 'This card will use custom scene settings instead of the project scene lock.'
                          : card.sceneMode === 'NO_SCENE'
                          ? 'This card will have no scene constraints applied.'
                          : 'AI will maintain the locked scene from Project Bible.'
                        }
                      </p>
                      
                      {/* Override fields - only show when OVERRIDE_SCENE is selected */}
                      {card.sceneMode === 'OVERRIDE_SCENE' && (
                        <div className="space-y-3 pt-2 border-t border-amber-800/30">
                          <div>
                            <Label className="text-xs text-slate-400">Override Scene Description</Label>
                            <Textarea
                              value={card.overrideSceneDescription || ''}
                              onChange={(e) => onCardUpdate(card.id, { overrideSceneDescription: e.target.value })}
                              placeholder="Describe the scene for this specific card..."
                              rows={2}
                              className="bg-slate-900 border-slate-700 text-white text-sm mt-1"
                              data-testid="input-override-scene"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-slate-400">Camera Angle</Label>
                              <select
                                value={card.overrideCameraAngle || ''}
                                onChange={(e) => onCardUpdate(card.id, { overrideCameraAngle: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-2 py-1 mt-1"
                                data-testid="select-override-camera"
                              >
                                <option value="">Same as locked</option>
                                <option value="TOP_DOWN">Top Down</option>
                                <option value="FORTY_FIVE_DEGREE">45° Angle</option>
                                <option value="EYE_LEVEL">Eye Level</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400">Lighting</Label>
                              <Input
                                value={card.overrideLighting || ''}
                                onChange={(e) => onCardUpdate(card.id, { overrideLighting: e.target.value })}
                                placeholder="e.g., Dramatic spotlight"
                                className="bg-slate-900 border-slate-700 text-white text-sm mt-1"
                                data-testid="input-override-lighting"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Advanced Options - Collapsible */}
                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50"
                        data-testid="button-image-advanced"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm text-slate-300">Advanced Options</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-4">
                      {/* Enhance Prompt Toggle */}
                      <div className="p-3 bg-slate-800/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <Label className="text-slate-300 cursor-pointer">Enhance Prompt</Label>
                          </div>
                          <Switch
                            checked={enhancePromptEnabled}
                            onCheckedChange={(checked) => {
                              setEnhancePromptEnabled(checked);
                              onCardUpdate(card.id, { enhancePromptEnabled: checked });
                            }}
                            data-testid="toggle-enhance-prompt"
                          />
                        </div>
                        
                        {enhancePromptEnabled && (
                          <div className="space-y-3">
                            {/* Target Audience Selector */}
                            <div className="space-y-2">
                              <Label className="text-xs text-slate-400">Target Audience</Label>
                              <select
                                value={targetAudience}
                                onChange={(e) => setTargetAudience(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2"
                                data-testid="select-target-audience"
                              >
                                <option value="general">General Audience</option>
                                <option value="children">Children (Family-Friendly)</option>
                                <option value="technical">Technical / Professional</option>
                                <option value="entertainment">Entertainment / Pop Culture</option>
                                <option value="business">Business / Corporate</option>
                                <option value="educational">Educational / Academic</option>
                                <option value="luxury">Luxury / Premium</option>
                                <option value="youth">Youth / Gen-Z</option>
                              </select>
                              <p className="text-[10px] text-slate-500">
                                Tailors the visual style to resonate with your target viewers
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Textarea
                                value={enhancedPrompt}
                                onChange={(e) => {
                                  setEnhancedPrompt(e.target.value);
                                  onCardUpdate(card.id, { enhancedPrompt: e.target.value });
                                }}
                                placeholder="Enhanced prompt will appear here..."
                                rows={3}
                                className="bg-slate-900 border-slate-700 text-white text-sm flex-1"
                                data-testid="input-enhanced-prompt"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEnhancePrompt('image')}
                                disabled={enhanceLoading}
                                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                                data-testid="button-regenerate-enhanced"
                              >
                                {enhanceLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                {enhancedPrompt ? 'Regenerate' : 'Generate'} Enhanced Prompt
                              </Button>
                              <span className="text-xs text-slate-500">
                                Creates a production-grade prompt for better results
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {!enhancePromptEnabled && (
                          <p className="text-xs text-slate-500">
                            Enable to get AI-optimized prompts with cinematic direction and style.
                          </p>
                        )}
                      </div>
                      
                      {/* Manual Prompt Override (when enhance is off) */}
                      {!enhancePromptEnabled && (
                        <div className="space-y-2">
                          <Label className="text-slate-300">Image Prompt</Label>
                          <Textarea
                            placeholder={`Auto-generated from card content: "${card.title}. ${card.content?.slice(0, 100)}..."`}
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            rows={3}
                            className="bg-slate-800 border-slate-700 text-white"
                            data-testid="input-image-prompt"
                          />
                          <p className="text-xs text-slate-500">
                        Leave empty to auto-generate from card content
                      </p>
                    </div>
                  )}
                  
                  {/* Contextual Image Suggestions - show when video exists but time remains */}
                  {(() => {
                    const videoAssets = card.mediaAssets?.filter(a => a.kind === 'video' && a.status === 'ready') || [];
                    const hasVideo = !!(card.generatedVideoUrl || videoAssets.length > 0);
                    const hasNarration = !!card.narrationAudioUrl;
                    
                    // Calculate remaining time using same logic as timeline
                    let narrationDuration = card.narrationDurationSec || 0;
                    if (narrationDuration <= 0 && hasNarration && card.content) {
                      narrationDuration = Math.max(1, Math.round((card.content.length / 12.5) * 10) / 10);
                    }
                    
                    // Calculate filled time using segments or "video wins" logic
                    const segments = card.mediaSegments || [];
                    let totalFilledTime = segments.reduce((sum, s) => sum + s.durationSec, 0);
                    
                    if (segments.length === 0) {
                      // "Video wins" logic: prefer selected if video, otherwise latest ready video
                      const selectedAsset = card.mediaAssets?.find(a => a.id === card.selectedMediaAssetId);
                      const sortedVideos = [...videoAssets].sort((a, b) => 
                        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                      );
                      const latestReadyVideo = sortedVideos[0];
                      const primaryVideoAsset = (selectedAsset?.kind === 'video' && selectedAsset.status === 'ready') 
                        ? selectedAsset 
                        : latestReadyVideo;
                      totalFilledTime = primaryVideoAsset?.durationSec || card.videoDurationSec || 
                        (card.generatedVideoUrl ? 5 : 0);
                    }
                    
                    const remainingTime = narrationDuration > 0 ? Math.max(0, narrationDuration - totalFilledTime) : 0;
                    
                    // Show suggestions when video exists and there's remaining time to fill (at least 1s)
                    if (!hasVideo || remainingTime < 1) return null;
                    
                    // Get prompt from selected/primary video for context
                    const selectedAsset = card.mediaAssets?.find(a => a.id === card.selectedMediaAssetId);
                    const sortedVideos = [...videoAssets].sort((a, b) => 
                      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    );
                    const primaryVideoAsset = (selectedAsset?.kind === 'video' && selectedAsset.status === 'ready') 
                      ? selectedAsset 
                      : sortedVideos[0];
                    const existingVideoPrompt = primaryVideoAsset?.prompt || '';
                    
                    return (
                      <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-medium text-purple-300">
                              Fill Remaining Time ({remainingTime.toFixed(1)}s)
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-400">
                          Your video is {videoDuration.toFixed(1)}s but narration is {narrationDuration.toFixed(1)}s. 
                          Get AI suggestions for a filler image to continue the visual story.
                        </p>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-purple-500/30 text-purple-400"
                          onClick={async () => {
                            if (showImageSuggestions && imageSuggestions.length > 0) {
                              setShowImageSuggestions(false);
                              return;
                            }
                            setImageSuggestionsLoading(true);
                            setShowImageSuggestions(true);
                            try {
                              const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/suggest-filler-image`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  cardTitle: card.title,
                                  cardNarration: card.content,
                                  existingVideoPrompt,
                                  remainingSeconds: remainingTime,
                                }),
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setImageSuggestions(data.suggestions || []);
                              }
                            } catch (err) {
                              console.error('Failed to get image suggestions:', err);
                            } finally {
                              setImageSuggestionsLoading(false);
                            }
                          }}
                          disabled={imageSuggestionsLoading}
                          data-testid="button-suggest-filler-image"
                        >
                          {imageSuggestionsLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                          ) : (
                            <Sparkles className="w-3 h-3 mr-1.5" />
                          )}
                          {showImageSuggestions && imageSuggestions.length > 0 
                            ? 'Hide Suggestions' 
                            : imageSuggestionsLoading 
                              ? 'Finding ideas...' 
                              : 'Suggest Filler Image'}
                        </Button>
                        
                        {showImageSuggestions && imageSuggestions.length > 0 && (
                          <div className="space-y-2" data-testid="image-suggestions-list">
                            {imageSuggestions.map((suggestion) => (
                              <div 
                                key={suggestion.id}
                                className="p-2 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1.5"
                                data-testid={`image-suggestion-card-${suggestion.id}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 flex-1">
                                    {suggestion.prompt}
                                  </p>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1 shrink-0"
                                    onClick={() => {
                                      setImagePrompt(suggestion.prompt);
                                      setEnhancePromptEnabled(false);
                                      toast({
                                        title: "Prompt loaded",
                                        description: "Hit Generate to create the filler image.",
                                      });
                                      setShowImageSuggestions(false);
                                    }}
                                    data-testid={`button-use-image-suggestion-${suggestion.id}`}
                                  >
                                    <Wand2 className="w-3 h-3" />
                                    Use
                                  </Button>
                                </div>
                                <p className="text-[10px] text-slate-500 italic">
                                  {suggestion.rationale}
                                </p>
                                {suggestion.continuityElements?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.continuityElements.slice(0, 3).map((elem, i) => (
                                      <span 
                                        key={i}
                                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300"
                                      >
                                        {elem}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                      
                      <Button
                        onClick={handleGenerateImage}
                        disabled={imageLoading || imageUploading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-2"
                        data-testid="button-generate-image"
                      >
                        {imageLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4" />
                        )}
                        {imageLoading ? "Generating..." : "Generate AI Image"}
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
              
              {activeTab === "video" && (
                <div className="relative space-y-4">
                  {!canGenerateVideos && (
                    <LockedOverlay
                      feature="AI Video Generation"
                      description="Create cinematic AI videos from your story cards with a Business subscription."
                      onUpgrade={onUpgradeClick}
                    />
                  )}
                  
                  {/* Quick Add Section - one-click video generation */}
                  {videoConfig?.configured && (
                    <div className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-white">Quick Add</span>
                          <p className="text-[10px] text-slate-400">One-click video generation</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => {
                            setVideoDuration(5);
                            setVideoMode("text-to-video");
                            const autoPrompt = `${card.title}. ${card.content?.slice(0, 200) || ''}`;
                            setVideoPrompt(autoPrompt);
                            setTimeout(() => handleGenerateVideo(), 100);
                          }}
                          disabled={videoLoading || videoStatus === "processing"}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white gap-2 h-12"
                          data-testid="button-quick-video-5s"
                        >
                          {(videoLoading || videoStatus === "processing") && videoDuration === 5 ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Video className="w-4 h-4" />
                          )}
                          <div className="text-left">
                            <div className="text-sm font-medium">5s Video</div>
                            <div className="text-[10px] opacity-80">Fast & affordable</div>
                          </div>
                        </Button>
                        <Button
                          onClick={() => {
                            setVideoDuration(10);
                            setVideoMode("text-to-video");
                            const autoPrompt = `${card.title}. ${card.content?.slice(0, 200) || ''}`;
                            setVideoPrompt(autoPrompt);
                            setTimeout(() => handleGenerateVideo(), 100);
                          }}
                          disabled={videoLoading || videoStatus === "processing"}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white gap-2 h-12"
                          data-testid="button-quick-video-10s"
                        >
                          {(videoLoading || videoStatus === "processing") && videoDuration === 10 ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Video className="w-4 h-4" />
                          )}
                          <div className="text-left">
                            <div className="text-sm font-medium">10s Video</div>
                            <div className="text-[10px] opacity-80">More coverage</div>
                          </div>
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 text-center">
                        Auto-generates from card content. Scroll down for advanced options.
                      </p>
                    </div>
                  )}
                  
                  {/* Media Timeline - shows filled vs remaining time */}
                  {(() => {
                    const segments = card.mediaSegments || [];
                    const videoAssets = card.mediaAssets?.filter(a => a.kind === 'video') || [];
                    const hasVideo = !!(card.generatedVideoUrl || videoAssets.length > 0);
                    const hasNarration = !!card.narrationAudioUrl;
                    
                    // If no videos and no narration, don't show timeline
                    if (!hasVideo && !hasNarration) return null;
                    
                    // For narration duration: use stored value, or estimate from content
                    // Estimation: ~12.5 chars/second at normal speed (same as backend TTS)
                    let narrationDuration = card.narrationDurationSec || 0;
                    if (narrationDuration <= 0 && hasNarration && card.content) {
                      // Fallback estimation for cards where duration wasn't stored
                      narrationDuration = Math.max(1, Math.round((card.content.length / 12.5) * 10) / 10);
                    }
                    
                    // Calculate filled time from segments first
                    let totalFilledTime = segments.reduce((sum, s) => sum + s.durationSec, 0);
                    
                    // If no segments exist, use "video wins" logic:
                    // Always prefer video duration over image when calculating timeline
                    // This fixes the edge case where image is generated first, then video
                    if (segments.length === 0) {
                      // Find video assets - prefer selectedMediaAssetId if it's a video,
                      // otherwise use the most recently created ready video
                      const selectedAsset = card.mediaAssets?.find(a => a.id === card.selectedMediaAssetId);
                      const readyVideos = card.mediaAssets?.filter(a => 
                        a.kind === 'video' && a.status === 'ready'
                      ) || [];
                      // Sort by createdAt descending to get most recent first
                      const sortedVideos = [...readyVideos].sort((a, b) => 
                        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                      );
                      const latestReadyVideo = sortedVideos[0];
                      
                      // "Video wins": prefer selected if it's a video, otherwise use latest video
                      const primaryVideoAsset = (selectedAsset?.kind === 'video' && selectedAsset.status === 'ready') 
                        ? selectedAsset 
                        : latestReadyVideo;
                      
                      // Use video asset duration, or videoDurationSec from card, or default 5s for AI video
                      const videoDuration = primaryVideoAsset?.durationSec || card.videoDurationSec || 
                        (card.generatedVideoUrl ? 5 : 0);
                      totalFilledTime = videoDuration;
                    }
                    
                    // If we have no narration duration but have videos, still show filled time
                    const displayNarrationDuration = narrationDuration > 0 ? narrationDuration : totalFilledTime;
                    const remainingTime = narrationDuration > 0 ? Math.max(0, narrationDuration - totalFilledTime) : 0;
                    const percentFilled = displayNarrationDuration > 0 ? Math.min(100, (totalFilledTime / displayNarrationDuration) * 100) : 100;
                    
                    return (
                      <div className="p-4 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                              <Clock className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-white">Media Timeline</span>
                              <p className="text-[10px] text-slate-400">Drag to reorder clips</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-cyan-400">
                              {totalFilledTime.toFixed(1)}s
                            </span>
                            {narrationDuration > 0 && (
                              <span className="text-slate-500 text-sm"> / {narrationDuration.toFixed(1)}s</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percentFilled >= 100 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-lg shadow-green-500/30' 
                                : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 shadow-lg shadow-cyan-500/20'
                            }`}
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                        
                        {remainingTime > 0 && (
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs text-amber-400 font-medium">
                              {remainingTime.toFixed(1)}s remaining
                            </span>
                            <span className="text-[10px] text-cyan-400/70">
                              Add more media below
                            </span>
                          </div>
                        )}
                        
                        {percentFilled >= 100 && (
                          <div className="flex items-center gap-2 px-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400 font-medium">
                              Timeline complete - ready for playback
                            </span>
                          </div>
                        )}
                        
                        {/* Clips header */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                          <GripVertical className="w-4 h-4 text-slate-500" />
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                            Clips ({(card.mediaAssets?.filter(a => a.status === 'ready') || []).length})
                          </span>
                        </div>
                        
                        {/* Unified drag-and-drop media timeline */}
                        {(() => {
                          const allAssets = card.mediaAssets?.filter(a => a.status === 'ready') || [];
                          let displaySegments: MediaSegment[] = segments.length > 0 ? [...segments] : [];
                          
                          if (displaySegments.length === 0 && allAssets.length > 0) {
                            displaySegments = allAssets
                              .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
                              .map((asset, idx) => ({
                                id: `seg-${asset.id}`,
                                assetId: asset.id,
                                kind: asset.kind,
                                source: asset.source,
                                url: asset.url,
                                thumbnailUrl: asset.thumbnailUrl,
                                durationSec: asset.durationSec || 5,
                                startTimeSec: 0,
                                order: idx,
                                renderMode: asset.renderMode,
                                originalDurationSec: asset.kind === 'video' ? (asset.durationSec || 5) : undefined,
                              }));
                          }
                          
                          if (displaySegments.length === 0) return null;
                          
                          return (
                            <DraggableMediaTimeline
                              segments={displaySegments}
                              selectedIndex={selectedSegmentIndex}
                              onReorder={(reordered) => {
                                onCardUpdate(card.id, { mediaSegments: reordered });
                                onCardSave(card.id, { mediaSegments: reordered });
                              }}
                              onRemove={(segId) => {
                                const updated = displaySegments
                                  .filter(s => s.id !== segId)
                                  .map((s, i) => ({ ...s, order: i }));
                                let time = 0;
                                for (const s of updated) {
                                  s.startTimeSec = time;
                                  time += s.durationSec;
                                }
                                if (selectedSegmentIndex !== null && selectedSegmentIndex >= updated.length) {
                                  setSelectedSegmentIndex(updated.length > 0 ? updated.length - 1 : null);
                                }
                                onCardUpdate(card.id, { mediaSegments: updated });
                                onCardSave(card.id, { mediaSegments: updated });
                              }}
                              onDurationChange={(segId, duration) => {
                                const updated = displaySegments.map(s => 
                                  s.id === segId ? { ...s, durationSec: duration } : s
                                );
                                let time = 0;
                                for (const s of updated) {
                                  s.startTimeSec = time;
                                  time += s.durationSec;
                                }
                                onCardUpdate(card.id, { mediaSegments: updated });
                                onCardSave(card.id, { mediaSegments: updated });
                              }}
                              onTrimChange={(segId, trimStart, trimEnd) => {
                                const updated = displaySegments.map(s => {
                                  if (s.id !== segId) return s;
                                  const originalDur = s.originalDurationSec || s.durationSec;
                                  const newDuration = Math.max(0.5, originalDur - trimStart - trimEnd);
                                  return { 
                                    ...s, 
                                    trimStartSec: trimStart, 
                                    trimEndSec: trimEnd,
                                    durationSec: newDuration,
                                  };
                                });
                                let time = 0;
                                for (const s of updated) {
                                  s.startTimeSec = time;
                                  time += s.durationSec;
                                }
                                onCardUpdate(card.id, { mediaSegments: updated });
                                onCardSave(card.id, { mediaSegments: updated });
                              }}
                              onDurationDetected={(segId, duration) => {
                                const updated = displaySegments.map(s => 
                                  s.id === segId ? { ...s, originalDurationSec: duration } : s
                                );
                                onCardUpdate(card.id, { mediaSegments: updated });
                                onCardSave(card.id, { mediaSegments: updated });
                              }}
                              onSplit={(segId, splitTime) => {
                                const segIndex = displaySegments.findIndex(s => s.id === segId);
                                if (segIndex === -1) return;
                                const seg = displaySegments[segIndex];
                                const originalDur = seg.originalDurationSec || seg.durationSec;
                                
                                const firstHalf: MediaSegment = {
                                  ...seg,
                                  id: `${seg.id}-a`,
                                  trimEndSec: originalDur - splitTime + (seg.trimStartSec || 0),
                                  durationSec: splitTime - (seg.trimStartSec || 0),
                                };
                                
                                const secondHalf: MediaSegment = {
                                  ...seg,
                                  id: `${seg.id}-b`,
                                  trimStartSec: splitTime,
                                  trimEndSec: seg.trimEndSec || 0,
                                  durationSec: originalDur - splitTime - (seg.trimEndSec || 0),
                                };
                                
                                const updated = [
                                  ...displaySegments.slice(0, segIndex),
                                  firstHalf,
                                  secondHalf,
                                  ...displaySegments.slice(segIndex + 1)
                                ].map((s, i) => ({ ...s, order: i }));
                                
                                let time = 0;
                                for (const s of updated) {
                                  s.startTimeSec = time;
                                  time += s.durationSec;
                                }
                                
                                onCardUpdate(card.id, { mediaSegments: updated });
                                onCardSave(card.id, { mediaSegments: updated });
                              }}
                              onSelect={setSelectedSegmentIndex}
                            />
                          );
                        })()}
                        
                        {/* AI Clip Suggestions - show when remaining time allows at least 1 segment (5s+) */}
                        {remainingTime >= 5 && (
                          <div className="pt-2 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-cyan-500/30 text-cyan-400"
                              onClick={async () => {
                                if (showClipSuggestions && clipSuggestions.length > 0) {
                                  setShowClipSuggestions(false);
                                  return;
                                }
                                setClipSuggestionsLoading(true);
                                setShowClipSuggestions(true);
                                try {
                                  const priorPrompts = segments
                                    .filter(s => s.kind === 'video')
                                    .map(s => {
                                      const asset = card.mediaAssets?.find(a => a.id === s.assetId);
                                      return asset?.prompt || '';
                                    })
                                    .filter(Boolean);
                                  
                                  const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/suggest-next-clip`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      cardTitle: card.title,
                                      cardNarration: card.content,
                                      currentSegmentIndex: segments.length,
                                      totalSegmentsPlanned: Math.ceil(narrationDuration / 5),
                                      priorPrompts,
                                    }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setClipSuggestions(data.suggestions || []);
                                  }
                                } catch (err) {
                                  console.error('Failed to get clip suggestions:', err);
                                } finally {
                                  setClipSuggestionsLoading(false);
                                }
                              }}
                              disabled={clipSuggestionsLoading}
                              data-testid="button-suggest-clips"
                            >
                              {clipSuggestionsLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                              ) : (
                                <Sparkles className="w-3 h-3 mr-1.5" />
                              )}
                              {showClipSuggestions && clipSuggestions.length > 0 
                                ? 'Hide Suggestions' 
                                : clipSuggestionsLoading 
                                  ? 'Finding clips...' 
                                  : 'Suggest Next Clip'}
                            </Button>
                            
                            {showClipSuggestions && clipSuggestions.length > 0 && (
                              <div className="space-y-2 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 via-cyan-500/5 to-transparent border border-purple-500/20" data-testid="clip-suggestions-list">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
                                  <Sparkles className="w-4 h-4 text-purple-400" />
                                  <span className="text-xs font-medium text-purple-300">AI Suggestions</span>
                                </div>
                                {clipSuggestions.map((suggestion) => (
                                  <div 
                                    key={suggestion.id}
                                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-2 hover:border-cyan-500/30 transition-colors"
                                    data-testid={`suggestion-card-${suggestion.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span 
                                        className="text-[10px] uppercase tracking-wide text-cyan-400/70 font-medium"
                                        data-testid={`text-arc-phase-${suggestion.id}`}
                                      >
                                        {suggestion.arcPhase}
                                      </span>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1"
                                        onClick={() => {
                                          // Immediately create a draft clip with this prompt
                                          const clipNumber = unifiedClips.length + 1;
                                          addDraftClip(suggestion.prompt);
                                          toast({
                                            title: `Clip ${clipNumber} created`,
                                            description: "Your new clip is ready. Press Generate to create the video.",
                                          });
                                          // Scroll down to generate button
                                          document.querySelector('[data-testid="button-generate-video"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                        data-testid={`button-use-suggestion-${suggestion.id}`}
                                      >
                                        <Plus className="w-3 h-3" />
                                        {unifiedClips.length > 0 
                                          ? `Add as Clip ${unifiedClips.length + 1}`
                                          : "Create Clip 1"
                                        }
                                      </Button>
                                    </div>
                                    <p 
                                      className="text-xs text-slate-300 leading-relaxed line-clamp-3"
                                      data-testid={`text-prompt-${suggestion.id}`}
                                    >
                                      {suggestion.prompt}
                                    </p>
                                    <p className="text-[10px] text-slate-500 italic">
                                      {suggestion.rationale}
                                    </p>
                                    {suggestion.continuityHints?.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {suggestion.continuityHints.slice(0, 3).map((hint, i) => (
                                          <span 
                                            key={i}
                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400"
                                          >
                                            {hint}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                
                                {/* More Ideas Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2 border-cyan-500/20 text-cyan-400/70 hover:text-cyan-400"
                                  onClick={async () => {
                                    setClipSuggestionsLoading(true);
                                    try {
                                      const priorPrompts = [
                                        ...segments.filter(s => s.kind === 'video').map(s => {
                                          const asset = card.mediaAssets?.find(a => a.id === s.assetId);
                                          return asset?.prompt || '';
                                        }),
                                        ...clipSuggestions.map(s => s.prompt)
                                      ].filter(Boolean);
                                      
                                      const res = await fetch(`/api/ice/preview/${previewId}/cards/${card.id}/suggest-next-clip`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          cardTitle: card.title,
                                          cardNarration: card.content,
                                          currentSegmentIndex: segments.length + clipSuggestions.length,
                                          totalSegmentsPlanned: Math.ceil(narrationDuration / 5),
                                          priorPrompts,
                                          excludeIds: clipSuggestions.map(s => s.id),
                                        }),
                                      });
                                      if (res.ok) {
                                        const data = await res.json();
                                        // Append new suggestions to existing ones
                                        setClipSuggestions(prev => [...prev, ...(data.suggestions || [])]);
                                      }
                                    } catch (err) {
                                      console.error('Failed to get more clip suggestions:', err);
                                    } finally {
                                      setClipSuggestionsLoading(false);
                                    }
                                  }}
                                  disabled={clipSuggestionsLoading}
                                  data-testid="button-more-ideas"
                                >
                                  {clipSuggestionsLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                                  ) : (
                                    <Sparkles className="w-3 h-3 mr-1.5" />
                                  )}
                                  More Ideas
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Current Video Display - shows selected video asset or generatedVideoUrl */}
                  {(() => {
                    // Find the currently selected video asset (by selectedMediaAssetId or matching generatedVideoUrl)
                    const selectedVideoAsset = card.mediaAssets?.find(a => 
                      a.kind === 'video' && (a.id === card.selectedMediaAssetId || a.url === card.generatedVideoUrl)
                    );
                    const displayVideoUrl = selectedVideoAsset?.url || card.generatedVideoUrl;
                    
                    if (!displayVideoUrl) return null;
                    
                    const currentRenderMode: RenderMode = selectedVideoAsset?.renderMode || 'auto';
                    
                    const handleRenderModeChange = (mode: RenderMode) => {
                      if (!selectedVideoAsset) return;
                      const updatedAssets = card.mediaAssets?.map(a => 
                        a.id === selectedVideoAsset.id ? { ...a, renderMode: mode } : a
                      ) || [];
                      onCardUpdate(card.id, { mediaAssets: updatedAssets });
                      onCardSave(card.id, { mediaAssets: updatedAssets });
                    };
                    
                    const sourceLabel = selectedVideoAsset?.source === 'ai' ? 'AI Video' : 
                                       selectedVideoAsset?.source === 'stock' ? 'Stock Video' : 
                                       selectedVideoAsset?.source === 'upload' ? 'Uploaded Video' : 'Video';
                    
                    return (
                      <div className="rounded-lg overflow-hidden border border-blue-500/30 bg-blue-500/5">
                        <div className="p-2 bg-blue-500/10 flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-400">{sourceLabel}</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (selectedVideoAsset) {
                                // Remove from mediaAssets and clear generatedVideoUrl if it matches
                                const updatedAssets = card.mediaAssets?.filter(a => a.id !== selectedVideoAsset.id) || [];
                                const updates = { 
                                  mediaAssets: updatedAssets,
                                  generatedVideoUrl: card.generatedVideoUrl === selectedVideoAsset.url ? undefined : card.generatedVideoUrl,
                                  selectedMediaAssetId: undefined
                                };
                                onCardUpdate(card.id, updates);
                                onCardSave(card.id, updates);
                              } else {
                                const updates = { generatedVideoUrl: undefined };
                                onCardUpdate(card.id, updates);
                                onCardSave(card.id, updates);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                        <video 
                          src={displayVideoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full bg-black max-h-64"
                          data-testid="video-preview"
                          onError={(e) => console.error("Video load error:", e)}
                        />
                        {/* Video Framing Toggle - always show when we have a video asset */}
                        {selectedVideoAsset && (
                          <div className="p-2 bg-blue-500/5 border-t border-blue-500/20">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-slate-400 min-w-[50px]">Framing:</Label>
                              <div className="flex gap-1">
                                {(['auto', 'fill', 'fit'] as const).map((mode) => (
                                  <Button
                                    key={mode}
                                    variant={currentRenderMode === mode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleRenderModeChange(mode)}
                                    data-testid={`button-framing-${mode}`}
                                  >
                                    {mode === 'auto' ? 'Auto' : mode === 'fill' ? 'Fill' : 'Fit'}
                                  </Button>
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-500 ml-auto">
                                {currentRenderMode === 'auto' ? 'Smart detect' : 
                                 currentRenderMode === 'fill' ? 'Full-bleed crop' : 'Show full frame'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {!videoConfig?.configured ? (
                    <div className="p-4 bg-slate-800 rounded-lg text-sm text-slate-400">
                      Video generation is not configured. Contact support to enable AI video generation.
                    </div>
                  ) : (
                    <>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Mode</Label>
                          <Select value={videoMode} onValueChange={(v) => setVideoMode(v as any)}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text-to-video">Text to Video</SelectItem>
                              <SelectItem value="image-to-video">Image to Video</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-slate-300">Duration</Label>
                          <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(parseInt(v) as any)}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 seconds</SelectItem>
                              <SelectItem value="10">10 seconds</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <VideoEngineSelector
                        config={videoConfig as VideoEngineConfig}
                        selectedEngine={videoEngine}
                        selectedModel={videoModel}
                        onEngineChange={setVideoEngine}
                        onModelChange={setVideoModel}
                        onLockedEngineClick={handleLockedEngineClick}
                        onLockedModelClick={handleLockedModelClick}
                      />
                      
                      {videoMode === "image-to-video" && (
                        <div className="space-y-2">
                          <Label className="text-slate-300">Reference Image URL</Label>
                          <Input
                            placeholder={card.generatedImageUrl ? "Using generated image (or paste URL)" : "Paste image URL for animation"}
                            value={referenceImageUrl}
                            onChange={(e) => setReferenceImageUrl(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                            data-testid="input-reference-image-url"
                          />
                          {card.generatedImageUrl && !referenceImageUrl && (
                            <p className="text-xs text-green-400">Will use card's generated image</p>
                          )}
                          {!card.generatedImageUrl && !referenceImageUrl && (
                            <p className="text-xs text-yellow-400">Paste an image URL to animate</p>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-300">Video Prompt</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEnhanceVideoPrompt}
                            disabled={videoEnhanceLoading}
                            className="h-7 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 gap-1"
                            data-testid="button-enhance-video-prompt"
                          >
                            {videoEnhanceLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {videoEnhanceLoading ? "Enhancing..." : "Enhance Prompt"}
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Describe the video motion and scene (e.g., 'Slow zoom into the scene, gentle camera movement...')"
                          value={videoPrompt}
                          onChange={(e) => setVideoPrompt(e.target.value)}
                          rows={3}
                          className="bg-slate-800 border-slate-700 text-white"
                          data-testid="input-video-prompt"
                        />
                        <p className="text-xs text-slate-500">
                          {enhancedVideoPrompt ? "Prompt enhanced with motion & camera directions" : "Leave empty to auto-generate from card content"}
                        </p>
                      </div>
                      
                      {videoStatus === "processing" && (
                        <div className="p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-2 text-blue-300">
                              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                              🎬 Generating Clip {unifiedClips.length}...
                            </span>
                            <span className="text-lg font-mono text-cyan-400">
                              {Math.floor(videoGenElapsed / 60)}:{(videoGenElapsed % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <Progress value={Math.min(95, (videoGenElapsed / 180) * 100)} className="h-3" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-blue-300">Your video is being created by AI</span>
                            <span className="text-slate-400">Usually 1-3 minutes</span>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={handleGenerateVideo}
                        disabled={videoLoading || videoStatus === "processing" || videoUploading}
                        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 gap-2"
                        data-testid="button-generate-video"
                      >
                        {videoLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : videoStatus === "processing" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Video className="w-4 h-4" />
                        )}
                        {videoLoading 
                          ? "Starting generation..." 
                          : videoStatus === "processing"
                            ? `Generating Clip ${unifiedClips.length}...`
                            : unifiedClips.length > 0 
                              ? `Generate Clip ${unifiedClips.length}`
                              : "Generate AI Video"
                        }
                      </Button>
                      
                      {/* Cinematic Continuation - cheaper alternative to generating more clips */}
                      {card.generatedVideoUrl && card.narrationAudioUrl && (
                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-400">Or save money with:</span>
                          </div>
                          <CinematicContinuationSection
                            previewId={previewId}
                            card={card}
                            onCardUpdate={onCardUpdate}
                            onCardSave={onCardSave}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {activeTab === "narration" && (
                <div className="relative space-y-4">
                  {!canGenerateVoiceover && (
                    <LockedOverlay
                      feature="AI Narration"
                      description="Add professional AI voiceover to your story cards with a Pro subscription."
                      onUpgrade={onUpgradeClick}
                    />
                  )}
                  
                  {card.narrationAudioUrl && (
                    <div className="rounded-xl overflow-hidden border border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent">
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Volume2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-semibold text-cyan-400">Generated Narration</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => onCardUpdate(card.id, { narrationAudioUrl: undefined })}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                      <div className="p-3 pt-0">
                        <audio 
                          src={card.narrationAudioUrl} 
                          controls 
                          className="w-full h-10"
                          data-testid="audio-preview"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!voicesData?.configured ? (
                    <div className="p-4 bg-slate-800 rounded-lg text-sm text-slate-400">
                      TTS is not configured. Contact support to enable AI narration.
                    </div>
                  ) : (
                    <>
                      {/* Quick Add Section - one-click narration */}
                      {!card.narrationAudioUrl && (
                        <div className="p-4 rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                              <Mic className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-white">Quick Add</span>
                              <p className="text-[10px] text-slate-400">One-click narration from card content</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setNarrationText(card.content || '');
                              setTimeout(() => handleGenerateNarration(), 100);
                            }}
                            disabled={narrationLoading || !card.content}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white gap-2 h-12"
                            data-testid="button-quick-narration"
                          >
                            {narrationLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                            <div className="text-left">
                              <div className="text-sm font-medium">Generate Narration</div>
                              <div className="text-[10px] opacity-80">Uses card content as script</div>
                            </div>
                          </Button>
                          <p className="text-[10px] text-slate-500 mt-2 text-center">
                            Scroll down to customize voice, speed, or edit the script.
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label className="text-slate-300">Narration Text</Label>
                        <Textarea
                          placeholder="Enter the text to be narrated..."
                          value={narrationText}
                          onChange={(e) => setNarrationText(e.target.value)}
                          rows={4}
                          className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                          data-testid="input-narration-text"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{narrationText.length} / 3000 characters</span>
                          {narrationText.length > 3000 && (
                            <span className="text-red-400">Exceeds limit</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Voice</Label>
                          <Select value={narrationVoice} onValueChange={setNarrationVoice}>
                            <SelectTrigger className="bg-slate-800 border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {voicesData?.voices?.map((voice: any) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} - {voice.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-slate-300">Speed: {narrationSpeed.toFixed(1)}x</Label>
                          <Slider
                            value={[narrationSpeed]}
                            onValueChange={([v]) => setNarrationSpeed(v)}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            className="mt-3"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handlePreviewNarration}
                          disabled={!narrationText.trim()}
                          className="gap-2 border-slate-600"
                          data-testid="button-preview-narration"
                        >
                          {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {previewPlaying ? "Stop" : "Preview"}
                        </Button>
                        
                        <Button
                          onClick={handleGenerateNarration}
                          disabled={narrationLoading || !narrationText.trim() || narrationText.length > 3000}
                          className={`flex-1 gap-2 ${card.narrationAudioUrl ? 'bg-green-600 hover:bg-green-700' : ''}`}
                          data-testid="button-generate-narration"
                        >
                          {narrationLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : card.narrationAudioUrl ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                          {narrationLoading ? "Generating..." : card.narrationAudioUrl ? "Regenerate" : "Generate Narration"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {activeTab === "upload" && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-lg border border-cyan-500/20">
                    <h4 className="text-sm font-medium text-cyan-300 mb-3 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Your Own Media
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Add your own images or videos to this card. Select multiple files for bulk upload.
                    </p>
                    
                    {/* Bulk upload progress indicator */}
                    {bulkUploadProgress && (
                      <div className="mb-4 p-3 bg-cyan-900/40 rounded-lg border border-cyan-500/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span className="text-sm text-cyan-300">
                            Uploading {bulkUploadProgress.current} of {bulkUploadProgress.total}...
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-1.5">
                          <div 
                            className="bg-cyan-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(bulkUploadProgress.current / bulkUploadProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Button
                          onClick={() => imageInputRef.current?.click()}
                          disabled={imageUploading || !!bulkUploadProgress}
                          className="w-full gap-2"
                          data-testid="button-upload-own-image"
                        >
                          {imageUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Image className="w-4 h-4" />
                          )}
                          {imageUploading ? "Uploading..." : "Upload Images"}
                        </Button>
                        <p className="text-xs text-slate-500 text-center">JPG, PNG, WebP</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Button
                          onClick={() => videoInputRef.current?.click()}
                          disabled={videoUploading || !!bulkUploadProgress}
                          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                          data-testid="button-upload-own-video"
                        >
                          {videoUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Video className="w-4 h-4" />
                          )}
                          {videoUploading ? "Uploading..." : "Upload Videos"}
                        </Button>
                        <p className="text-xs text-slate-500 text-center">MP4, WebM, MOV</p>
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={muteUploadedVideo}
                            onChange={(e) => setMuteUploadedVideo(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/50"
                            data-testid="checkbox-mute-video-audio"
                          />
                          Mute video audio
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show current card media - handle both modern mediaAssets and legacy generatedImageUrl/generatedVideoUrl */}
                  {(card.generatedImageUrl || card.generatedVideoUrl || (card.mediaAssets?.length || 0) > 0) && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Current Card Media</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Modern: render from mediaAssets array */}
                        {card.mediaAssets?.map((asset) => (
                          <div 
                            key={asset.id}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                              card.selectedMediaAssetId === asset.id 
                                ? 'border-green-500 ring-2 ring-green-500/30' 
                                : 'border-slate-700 hover:border-slate-500'
                            }`}
                            onClick={() => handleSelectAsset(asset.id)}
                            data-testid={`current-media-${asset.id}`}
                          >
                            {asset.kind === 'image' ? (
                              <img 
                                src={asset.url} 
                                alt="Card media"
                                className="w-full h-16 object-cover"
                              />
                            ) : (
                              <video 
                                src={asset.url} 
                                className="w-full h-16 object-cover"
                                muted
                              />
                            )}
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] text-white">
                              {asset.kind === 'image' ? 'IMG' : 'VID'}
                            </div>
                            {card.selectedMediaAssetId === asset.id && (
                              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Legacy fallback: show generatedImageUrl if no mediaAssets with that URL */}
                        {card.generatedImageUrl && !card.mediaAssets?.some(a => a.url === card.generatedImageUrl) && (
                          <div className="relative rounded-lg overflow-hidden border-2 border-green-500 ring-2 ring-green-500/30">
                            <img 
                              src={card.generatedImageUrl} 
                              alt="Card image"
                              className="w-full h-16 object-cover"
                            />
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] text-white">
                              IMG
                            </div>
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                        )}
                        {/* Legacy fallback: show generatedVideoUrl if no mediaAssets with that URL */}
                        {card.generatedVideoUrl && !card.mediaAssets?.some(a => a.url === card.generatedVideoUrl) && (
                          <div className="relative rounded-lg overflow-hidden border-2 border-green-500 ring-2 ring-green-500/30">
                            <video 
                              src={card.generatedVideoUrl} 
                              className="w-full h-16 object-cover"
                              muted
                            />
                            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] text-white">
                              VID
                            </div>
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* All Media Library - media from all ICEs */}
                  <div className="space-y-2">
                    <Label className="text-slate-300 flex items-center gap-2">
                      All My Media
                      {allMediaLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {allUserMedia?.total ? (
                        <span className="text-xs text-slate-500">({allUserMedia.total} items)</span>
                      ) : null}
                    </Label>
                    
                    {allMediaLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                      </div>
                    ) : allUserMedia?.assets && allUserMedia.assets.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {allUserMedia.assets
                            .filter(asset => asset.category === 'image' || asset.category === 'video')
                            .map((asset) => {
                              const isCurrentIce = asset.iceId === previewId;
                              const isInCurrentCard = card.mediaAssets?.some(a => a.url === asset.url);
                              
                              return (
                                <div 
                                  key={asset.id}
                                  className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
                                    isInCurrentCard 
                                      ? 'border-cyan-500/50 opacity-60' 
                                      : 'border-slate-700 hover:border-cyan-400'
                                  }`}
                                  onClick={() => {
                                    if (isInCurrentCard) return;
                                    
                                    const newAsset: MediaAsset = {
                                      id: `reused-${asset.id}-${Date.now()}`,
                                      kind: asset.category as 'image' | 'video',
                                      source: 'upload',
                                      url: asset.url,
                                      status: 'ready',
                                      createdAt: new Date().toISOString(),
                                      prompt: 'Reused from media library',
                                    };
                                    
                                    const updatedAssets = [...(card.mediaAssets || []), newAsset];
                                    const updateData: Record<string, unknown> = { 
                                      mediaAssets: updatedAssets,
                                      selectedMediaAssetId: newAsset.id,
                                    };
                                    
                                    if (asset.category === 'image') {
                                      updateData.generatedImageUrl = asset.url;
                                    } else {
                                      updateData.generatedVideoUrl = asset.url;
                                    }
                                    
                                    onCardUpdate(card.id, updateData);
                                    onCardSave(card.id, updateData);
                                    setEditorMode("lanes");
                                    setActiveTab("content");
                                    toast({
                                      title: "Media added",
                                      description: `${asset.category === 'image' ? 'Image' : 'Video'} added to this card`,
                                    });
                                  }}
                                  data-testid={`all-media-${asset.id}`}
                                >
                                  {asset.category === 'image' ? (
                                    <img 
                                      src={asset.url} 
                                      alt="Library media"
                                      className="w-full h-16 object-cover"
                                    />
                                  ) : (
                                    <video 
                                      src={asset.url} 
                                      className="w-full h-16 object-cover"
                                      muted
                                    />
                                  )}
                                  <div className="absolute bottom-1 left-1 flex gap-1">
                                    <span className="px-1.5 py-0.5 bg-slate-900/80 rounded text-[10px] text-white">
                                      {asset.category === 'image' ? 'IMG' : 'VID'}
                                    </span>
                                    {!isCurrentIce && (
                                      <span className="px-1.5 py-0.5 bg-purple-600/80 rounded text-[10px] text-white">
                                        Other ICE
                                      </span>
                                    )}
                                  </div>
                                  {/* Delete button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLibraryMedia(asset.url, asset.iceId);
                                    }}
                                    disabled={deletingLibraryMedia === asset.url}
                                    className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                    data-testid={`delete-media-${asset.id}`}
                                  >
                                    {deletingLibraryMedia === asset.url ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                                    ) : (
                                      <X className="w-3 h-3 text-white" />
                                    )}
                                  </button>
                                  {isInCurrentCard && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                      <Check className="w-4 h-4 text-cyan-400" />
                                    </div>
                                  )}
                                  {!isInCurrentCard && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 pointer-events-none">
                                      <Plus className="w-5 h-5 text-white" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                        <p className="text-xs text-slate-500">
                          Click to add media from your other ICEs to this card.
                        </p>
                      </>
                    ) : (
                      <div className="p-4 bg-slate-800/30 rounded-lg text-center">
                        <p className="text-xs text-slate-500">
                          No media in your library yet. Upload or generate media to see it here.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400">
                      Uploaded media will replace any AI-generated content for this card.
                    </p>
                  </div>
                </div>
              )}
              
              {activeTab === "stock" && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-lg border border-cyan-500/20">
                    <h4 className="text-sm font-medium text-cyan-300 mb-3 flex items-center gap-2">
                      <ImagePlus className="w-4 h-4" />
                      Free Stock Media
                    </h4>
                    <p className="text-xs text-slate-400 mb-4">
                      Search and use free, high-quality stock photos and videos from Pexels.
                    </p>
                    
                    <PexelsMediaPicker
                      onSelectImage={(url, photographer) => {
                        const newAsset: MediaAsset = {
                          id: `stock-${Date.now()}`,
                          kind: 'image',
                          source: 'stock',
                          url,
                          status: 'ready',
                          createdAt: new Date().toISOString(),
                          prompt: photographer ? `Stock photo by ${photographer}` : 'Stock photo from Pexels',
                        };
                        const updatedAssets = [...(card.mediaAssets || []), newAsset];
                        onCardUpdate(card.id, { 
                          mediaAssets: updatedAssets,
                          selectedMediaAssetId: newAsset.id,
                          generatedImageUrl: url 
                        });
                        onCardSave(card.id, { 
                          mediaAssets: updatedAssets,
                          selectedMediaAssetId: newAsset.id,
                          generatedImageUrl: url 
                        });
                        // Return to lanes view after selection
                        setEditorMode("lanes");
                        setActiveTab("content");
                      }}
                      onSelectVideo={async (url, thumbnailUrl, photographer, width, height, duration) => {
                        // Use passed duration or detect from video element
                        let videoDuration = duration;
                        if (!videoDuration) {
                          try {
                            const tempVideo = document.createElement('video');
                            tempVideo.preload = 'metadata';
                            tempVideo.crossOrigin = 'anonymous';
                            videoDuration = await new Promise<number>((resolve) => {
                              tempVideo.onloadedmetadata = () => resolve(tempVideo.duration);
                              tempVideo.onerror = () => resolve(5); // Default fallback
                              setTimeout(() => resolve(5), 5000); // Timeout fallback
                              tempVideo.src = url;
                            });
                          } catch {
                            videoDuration = undefined;
                          }
                        }
                        
                        // Compute aspect ratio from dimensions for proper scaling
                        const aspectRatio = (width && height) ? width / height : undefined;
                        
                        const newAsset: MediaAsset = {
                          id: `stock-video-${Date.now()}`,
                          kind: 'video',
                          source: 'stock',
                          url,
                          thumbnailUrl,
                          status: 'ready',
                          createdAt: new Date().toISOString(),
                          prompt: photographer ? `Stock video by ${photographer}` : 'Stock video from Pexels',
                          durationSec: videoDuration,
                          sourceWidth: width,
                          sourceHeight: height,
                          sourceAspectRatio: aspectRatio,
                          renderMode: 'auto', // Let system auto-detect based on aspect ratio
                        };
                        const updatedAssets = [...(card.mediaAssets || []), newAsset];
                        onCardUpdate(card.id, { 
                          mediaAssets: updatedAssets,
                          selectedMediaAssetId: newAsset.id,
                          generatedVideoUrl: url,
                          videoDurationSec: videoDuration,
                        });
                        onCardSave(card.id, { 
                          mediaAssets: updatedAssets,
                          selectedMediaAssetId: newAsset.id,
                          generatedVideoUrl: url,
                          videoDurationSec: videoDuration,
                        });
                        // Return to lanes view after selection
                        setEditorMode("lanes");
                        setActiveTab("content");
                      }}
                      showVideos={true}
                    />
                  </div>
                </div>
              )}
              
              {/* Hidden file inputs - always mounted for all tabs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageFileChange}
                data-testid="input-upload-image"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={handleVideoFileChange}
                data-testid="input-upload-video"
              />
              </>
              )}
            </>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <VideoUpsellModal
        open={showVideoUpsell}
        onOpenChange={setShowVideoUpsell}
        requiredTier={upsellTier}
        featureName={upsellTier === 'business' ? "Studio-grade video" : "Advanced video"}
        onUpgrade={onUpgradeClick}
      />
    </div>
  );
}

export default IceCardEditor;
