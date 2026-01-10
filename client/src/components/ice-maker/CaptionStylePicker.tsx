import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Type,
  Sparkles,
  Monitor,
  Play,
  Bold,
  Sun,
  Underline,
  Palette,
  ZoomIn,
  Lightbulb,
} from "lucide-react";
import type {
  CaptionState,
  CaptionPresetId,
  AnimationId,
  SafeAreaProfile,
  KaraokeStyleId,
} from "@/caption-engine/schemas";
import { captionPresets } from "@/caption-engine/presets/captionPresets";

interface CaptionStylePickerProps {
  captionState: CaptionState;
  onStateChange: (state: CaptionState) => void;
  className?: string;
}

const animationOptions: { id: AnimationId; name: string; icon: React.ReactNode }[] = [
  { id: "none", name: "None", icon: null },
  { id: "fade", name: "Fade", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "slide_up", name: "Slide Up", icon: <Play className="w-3.5 h-3.5 rotate-[-90deg]" /> },
  { id: "pop", name: "Pop", icon: <ZoomIn className="w-3.5 h-3.5" /> },
  { id: "typewriter", name: "Typewriter", icon: <Type className="w-3.5 h-3.5" /> },
];

const safeAreaOptions: { id: SafeAreaProfile; name: string; description: string }[] = [
  { id: "universal", name: "Universal", description: "Standard safe margins" },
  { id: "tiktok", name: "TikTok", description: "Avoids TikTok UI elements" },
  { id: "instagram_reels", name: "Instagram", description: "Avoids Reels overlays" },
  { id: "youtube_shorts", name: "YouTube", description: "Avoids Shorts UI" },
];

const karaokeStyleOptions: { id: KaraokeStyleId; name: string; icon: React.ReactNode; description: string }[] = [
  { id: "weight", name: "Bold", icon: <Bold className="w-3.5 h-3.5" />, description: "Words become bold" },
  { id: "brightness", name: "Glow", icon: <Sun className="w-3.5 h-3.5" />, description: "Words light up" },
  { id: "underline", name: "Underline", icon: <Underline className="w-3.5 h-3.5" />, description: "Words get underlined" },
  { id: "color", name: "Color", icon: <Palette className="w-3.5 h-3.5" />, description: "Words change color" },
  { id: "scale", name: "Scale", icon: <ZoomIn className="w-3.5 h-3.5" />, description: "Words grow larger" },
  { id: "glow", name: "Neon", icon: <Lightbulb className="w-3.5 h-3.5" />, description: "Neon glow effect" },
];

const presetGroups = {
  clean: ["clean_white", "clean_black", "minimal_shadow"],
  boxed: ["boxed_white", "boxed_black"],
  highlight: ["highlight_yellow", "highlight_pink"],
  stylized: ["typewriter", "gradient_purple", "neon_blue", "bold_impact", "elegant_serif"],
} as const;

function PresetCard({
  presetId,
  isSelected,
  onClick,
}: {
  presetId: CaptionPresetId;
  isSelected: boolean;
  onClick: () => void;
}) {
  const preset = captionPresets[presetId];
  
  const previewStyle = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      fontSize: "10px",
      fontWeight: preset.typography === "impact" ? 800 : 500,
      fontFamily: preset.typography === "mono" ? "monospace" : 
                  preset.typography === "serif" ? "serif" : "sans-serif",
      textTransform: preset.typography === "impact" ? "uppercase" : "none",
    };
    
    if (preset.colors === "shadowWhite" || preset.colors === "white") {
      baseStyle.color = "#ffffff";
      baseStyle.textShadow = "0 1px 3px rgba(0,0,0,0.5)";
    } else if (preset.colors === "black" || preset.colors === "blackOnLight") {
      baseStyle.color = "#000000";
    } else if (preset.colors === "highlightYellow") {
      baseStyle.color = "#000000";
      baseStyle.backgroundColor = "#fde047";
      baseStyle.padding = "2px 6px";
      baseStyle.borderRadius = "4px";
    } else if (preset.colors === "highlightPink") {
      baseStyle.color = "#ffffff";
      baseStyle.backgroundColor = "#ec4899";
      baseStyle.padding = "2px 6px";
      baseStyle.borderRadius = "4px";
    } else if (preset.colors === "neonBlue") {
      baseStyle.color = "#60a5fa";
      baseStyle.textShadow = "0 0 10px #3b82f6, 0 0 20px #3b82f6";
    } else if (preset.colors === "gradientPurple") {
      baseStyle.color = "#ffffff";
      baseStyle.background = "linear-gradient(135deg, #8b5cf6, #d946ef)";
      baseStyle.padding = "2px 6px";
      baseStyle.borderRadius = "4px";
    } else if (preset.colors === "whiteOnDark") {
      baseStyle.color = "#ffffff";
      baseStyle.backgroundColor = "rgba(0,0,0,0.7)";
      baseStyle.padding = "2px 6px";
      baseStyle.borderRadius = "4px";
    } else {
      baseStyle.color = "#ffffff";
    }
    
    return baseStyle;
  }, [preset]);
  
  return (
    <button
      onClick={onClick}
      data-testid={`preset-${presetId}`}
      className={cn(
        "relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
        "bg-zinc-900/50 hover:bg-zinc-800/50",
        isSelected 
          ? "border-pink-500 ring-1 ring-pink-500/50" 
          : "border-zinc-700 hover:border-zinc-600"
      )}
    >
      <div className="w-full h-8 flex items-center justify-center bg-zinc-950 rounded mb-2 overflow-hidden">
        <span style={previewStyle} className="truncate max-w-full">
          Sample
        </span>
      </div>
      <span className="text-xs text-zinc-400 truncate max-w-full">
        {preset.name}
      </span>
    </button>
  );
}

export function CaptionStylePicker({
  captionState,
  onStateChange,
  className,
}: CaptionStylePickerProps) {
  const [activeTab, setActiveTab] = useState("styles");
  
  const updateState = (updates: Partial<CaptionState>) => {
    onStateChange({ ...captionState, ...updates });
  };
  
  return (
    <div className={cn("flex flex-col", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-zinc-900/50">
          <TabsTrigger value="styles" className="text-xs" data-testid="tab-styles">
            <Type className="w-3.5 h-3.5 mr-1.5" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="effects" className="text-xs" data-testid="tab-effects">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Effects
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs" data-testid="tab-layout">
            <Monitor className="w-3.5 h-3.5 mr-1.5" />
            Layout
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="styles" className="mt-3">
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Clean</h4>
                <div className="grid grid-cols-3 gap-2">
                  {presetGroups.clean.map((id) => (
                    <PresetCard
                      key={id}
                      presetId={id}
                      isSelected={captionState.presetId === id}
                      onClick={() => updateState({ presetId: id })}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Boxed</h4>
                <div className="grid grid-cols-3 gap-2">
                  {presetGroups.boxed.map((id) => (
                    <PresetCard
                      key={id}
                      presetId={id}
                      isSelected={captionState.presetId === id}
                      onClick={() => updateState({ presetId: id })}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Highlight</h4>
                <div className="grid grid-cols-3 gap-2">
                  {presetGroups.highlight.map((id) => (
                    <PresetCard
                      key={id}
                      presetId={id}
                      isSelected={captionState.presetId === id}
                      onClick={() => updateState({ presetId: id })}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Stylized</h4>
                <div className="grid grid-cols-3 gap-2">
                  {presetGroups.stylized.map((id) => (
                    <PresetCard
                      key={id}
                      presetId={id}
                      isSelected={captionState.presetId === id}
                      onClick={() => updateState({ presetId: id })}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="effects" className="mt-3">
          <div className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <Label htmlFor="karaoke-toggle" className="text-sm font-medium">
                    Karaoke Mode
                  </Label>
                  <p className="text-xs text-zinc-500">Highlight words as they're spoken</p>
                </div>
              </div>
              <Switch
                id="karaoke-toggle"
                checked={captionState.karaokeEnabled}
                onCheckedChange={(checked) => updateState({ karaokeEnabled: checked })}
                data-testid="switch-karaoke"
              />
            </div>
            
            {captionState.karaokeEnabled && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Highlight Style
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {karaokeStyleOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => updateState({ karaokeStyle: option.id })}
                      data-testid={`karaoke-style-${option.id}`}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                        "bg-zinc-900/50 hover:bg-zinc-800/50",
                        captionState.karaokeStyle === option.id
                          ? "border-pink-500 ring-1 ring-pink-500/50"
                          : "border-zinc-700 hover:border-zinc-600"
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                        {option.icon}
                      </div>
                      <span className="text-xs font-medium">{option.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Animation
              </h4>
              <div className="flex flex-wrap gap-2">
                {animationOptions.map((option) => (
                  <Button
                    key={option.id}
                    variant={captionState.animationId === option.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateState({ animationId: option.id })}
                    data-testid={`animation-${option.id}`}
                    className={cn(
                      "text-xs",
                      captionState.animationId === option.id && "bg-pink-600 hover:bg-pink-700"
                    )}
                  >
                    {option.icon}
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="layout" className="mt-3">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
                Platform Safe Area
              </h4>
              <p className="text-xs text-zinc-500 mb-3">
                Adjust caption position to avoid platform UI elements
              </p>
              <div className="grid grid-cols-2 gap-2">
                {safeAreaOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => updateState({ safeAreaProfileId: option.id })}
                    data-testid={`safe-area-${option.id}`}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                      "bg-zinc-900/50 hover:bg-zinc-800/50",
                      captionState.safeAreaProfileId === option.id
                        ? "border-pink-500 ring-1 ring-pink-500/50"
                        : "border-zinc-700 hover:border-zinc-600"
                    )}
                  >
                    <span className="text-sm font-medium">{option.name}</span>
                    <span className="text-xs text-zinc-500">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
