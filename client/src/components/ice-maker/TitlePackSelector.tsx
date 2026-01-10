import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles, ChevronDown } from "lucide-react";
import { TITLE_PACKS, type TitlePack } from "@shared/titlePacks";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TitlePackSelectorProps {
  value: string;
  onChange: (packId: string) => void;
  className?: string;
  compact?: boolean;
}

function TitlePackThumbnail({ pack, isSelected }: { pack: TitlePack; isSelected: boolean }) {
  const headlineStyle = {
    fontFamily: pack.headline.fontFamily,
    fontWeight: pack.headline.fontWeight,
    color: pack.headline.color,
    textTransform: pack.headline.textTransform as React.CSSProperties['textTransform'],
    letterSpacing: pack.headline.letterSpacing || 'normal',
    textShadow: pack.headline.glow 
      ? `0 0 ${pack.headline.glow.blur}px ${pack.headline.glow.color}` 
      : pack.headline.shadow 
        ? `${pack.headline.shadow.x}px ${pack.headline.shadow.y}px ${pack.headline.shadow.blur}px ${pack.headline.shadow.color}`
        : undefined,
    WebkitTextStroke: pack.headline.stroke 
      ? `${pack.headline.stroke.width}px ${pack.headline.stroke.color}` 
      : undefined,
  } as React.CSSProperties;

  return (
    <div 
      className={cn(
        "relative w-full aspect-[9/16] rounded-lg overflow-hidden",
        "bg-gradient-to-b from-slate-800 to-slate-900",
        "border-2 transition-all",
        isSelected 
          ? "border-pink-500 ring-2 ring-pink-500/30" 
          : "border-white/10 hover:border-white/30"
      )}
    >
      {pack.accentShape?.type === 'letterbox' && (
        <>
          <div 
            className="absolute top-0 left-0 right-0 h-[15%]"
            style={{ backgroundColor: pack.accentShape.color, opacity: pack.accentShape.opacity }}
          />
          <div 
            className="absolute bottom-0 left-0 right-0 h-[15%]"
            style={{ backgroundColor: pack.accentShape.color, opacity: pack.accentShape.opacity }}
          />
        </>
      )}
      
      {pack.accentShape?.type === 'tape' && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-6 -rotate-2"
          style={{ backgroundColor: pack.accentShape.color, opacity: pack.accentShape.opacity }}
        />
      )}
      
      <div className="absolute inset-0 flex items-end justify-center pb-[20%] px-2">
        <span 
          className="text-[10px] text-center leading-tight"
          style={headlineStyle}
        >
          SAMPLE
        </span>
      </div>
      
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

export function TitlePackSelector({ value, onChange, className, compact = false }: TitlePackSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedPack = TITLE_PACKS.find(p => p.id === value) || TITLE_PACKS[0];

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 w-full",
              "hover:bg-black/40 transition-colors",
              className
            )}
            data-testid="button-title-pack-selector"
          >
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="flex-1 text-left text-sm text-white">{selectedPack.name}</span>
            <ChevronDown className="w-4 h-4 text-white/60" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-slate-900 border-white/10" 
          align="start"
          sideOffset={4}
        >
          <div className="p-3 border-b border-white/10">
            <h4 className="text-sm font-medium text-white">Title Style</h4>
            <p className="text-xs text-white/50 mt-0.5">Choose a visual style for your captions</p>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2 space-y-1">
              {TITLE_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => {
                    onChange(pack.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                    value === pack.id 
                      ? "bg-pink-500/20 border border-pink-500/30" 
                      : "hover:bg-white/5 border border-transparent"
                  )}
                  data-testid={`button-title-pack-${pack.id}`}
                >
                  <div className="w-10 shrink-0">
                    <TitlePackThumbnail pack={pack} isSelected={value === pack.id} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">{pack.name}</div>
                    <div className="text-xs text-white/50 line-clamp-1">{pack.description}</div>
                  </div>
                  {value === pack.id && (
                    <Check className="w-4 h-4 text-pink-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn("space-y-3", className)} data-testid="title-pack-selector">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">Title Style</h4>
          <p className="text-xs text-white/50">Choose a visual style for your captions</p>
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-2">
        {TITLE_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => onChange(pack.id)}
            className="group space-y-1.5 text-center"
            data-testid={`button-title-pack-${pack.id}`}
          >
            <TitlePackThumbnail pack={pack} isSelected={value === pack.id} />
            <span className={cn(
              "text-[10px] block truncate transition-colors",
              value === pack.id ? "text-pink-400" : "text-white/60 group-hover:text-white"
            )}>
              {pack.name}
            </span>
          </button>
        ))}
      </div>
      
      <p className="text-xs text-white/40 italic">
        {selectedPack.description}
      </p>
    </div>
  );
}
