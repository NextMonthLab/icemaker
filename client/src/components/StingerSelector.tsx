import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Music2, 
  Play, 
  Pause, 
  Loader2, 
  Volume2,
  Zap,
  Bell,
  Waves,
  Wind,
  Sparkles,
  Trash2
} from "lucide-react";

interface StingerLibraryItem {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: 'whoosh' | 'impact' | 'rise' | 'notification' | 'ambient' | 'musical';
  durationSeconds: number;
  previewUrl?: string;
}

interface StingerSelectorProps {
  selectedStingerId?: string;
  stingerUrl?: string;
  stingerVolume?: number;
  onStingerChange: (stingerId: string | undefined, stingerUrl?: string) => void;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
}

const categoryIcons: Record<string, typeof Zap> = {
  whoosh: Wind,
  impact: Zap,
  rise: Waves,
  notification: Bell,
  ambient: Sparkles,
  musical: Music2,
};

const categoryColors: Record<string, string> = {
  whoosh: 'text-sky-400',
  impact: 'text-orange-400',
  rise: 'text-purple-400',
  notification: 'text-green-400',
  ambient: 'text-cyan-400',
  musical: 'text-pink-400',
};

export function StingerSelector({
  selectedStingerId,
  stingerUrl,
  stingerVolume = 50,
  onStingerChange,
  onVolumeChange,
  disabled = false,
}: StingerSelectorProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewingStingerId, setPreviewingStingerId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: libraryData } = useQuery<{ stingers: StingerLibraryItem[] }>({
    queryKey: ['/api/stingers/library'],
  });

  const previewMutation = useMutation({
    mutationFn: async (stingerId: string) => {
      const response = await fetch('/api/stingers/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stingerId }),
      });
      if (!response.ok) throw new Error('Failed to preview stinger');
      return response.json() as Promise<{
        stingerId: string;
        name: string;
        audio: string;
        contentType: string;
        durationSeconds: number;
      }>;
    },
    onSuccess: (data) => {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: data.contentType }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audio.volume = stingerVolume / 100;
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        setPreviewingStingerId(null);
      };
      
      audio.play();
      setIsPlaying(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Preview failed",
        description: error.message,
        variant: "destructive",
      });
      setPreviewingStingerId(null);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (stingerId: string) => {
      const response = await fetch('/api/stingers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stingerId }),
      });
      if (!response.ok) throw new Error('Failed to generate stinger');
      return response.json() as Promise<{
        stingerId: string;
        audio: string;
        contentType: string;
        durationSeconds: number;
      }>;
    },
    onSuccess: (data) => {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: data.contentType }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      onStingerChange(data.stingerId, audioUrl);
      toast({
        title: "Stinger applied!",
        description: "Transition audio will play when this card starts.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePreview = (stingerId: string) => {
    if (isPlaying && previewingStingerId === stingerId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setPreviewingStingerId(null);
    } else {
      setPreviewingStingerId(stingerId);
      previewMutation.mutate(stingerId);
    }
  };

  const handleSelect = (stingerId: string) => {
    if (stingerId === selectedStingerId) {
      onStingerChange(undefined, undefined);
    } else {
      generateMutation.mutate(stingerId);
    }
  };

  const handleRemove = () => {
    onStingerChange(undefined, undefined);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = stingerVolume / 100;
    }
  }, [stingerVolume]);

  const stingers = libraryData?.stingers || [];
  const selectedStinger = stingers.find(s => s.id === selectedStingerId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Music2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <Label className="text-slate-300 text-sm font-semibold">Transition Stinger</Label>
            <p className="text-[10px] text-slate-500">Audio effect when this card starts</p>
          </div>
        </div>
        {selectedStingerId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleRemove}
            disabled={disabled}
            data-testid="button-remove-stinger"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {selectedStingerId && selectedStinger && (
        <div className="rounded-lg border border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent p-3">
          <div className="flex items-center gap-3">
            {(() => {
              const Icon = categoryIcons[selectedStinger.category] || Music2;
              const colorClass = categoryColors[selectedStinger.category] || 'text-purple-400';
              return <Icon className={`w-5 h-5 ${colorClass}`} />;
            })()}
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{selectedStinger.name}</p>
              <p className="text-xs text-slate-400">{selectedStinger.description}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => handlePreview(selectedStinger.id)}
              disabled={previewMutation.isPending}
              data-testid="button-play-current-stinger"
            >
              {previewMutation.isPending && previewingStingerId === selectedStinger.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying && previewingStingerId === selectedStinger.id ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-slate-400 text-xs">Choose a stinger</Label>
        <div className="grid grid-cols-2 gap-2">
          {stingers.map((stinger) => {
            const Icon = categoryIcons[stinger.category] || Music2;
            const colorClass = categoryColors[stinger.category] || 'text-purple-400';
            const isSelected = selectedStingerId === stinger.id;
            const isPreviewing = previewingStingerId === stinger.id;
            
            return (
              <div
                key={stinger.id}
                className={`
                  relative rounded-lg border p-3 cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }
                  ${disabled ? 'opacity-50 pointer-events-none' : ''}
                `}
                onClick={() => !disabled && handleSelect(stinger.id)}
                data-testid={`stinger-option-${stinger.id}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 ${colorClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stinger.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{stinger.description}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{stinger.durationSeconds}s</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(stinger.id);
                    }}
                    disabled={previewMutation.isPending && isPreviewing}
                    data-testid={`button-preview-stinger-${stinger.id}`}
                  >
                    {previewMutation.isPending && isPreviewing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPlaying && isPreviewing ? (
                      <Pause className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                {generateMutation.isPending && generateMutation.variables === stinger.id && (
                  <div className="absolute inset-0 bg-slate-900/60 rounded-lg flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedStingerId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Stinger Volume
            </Label>
            <span className="text-xs text-slate-500">{stingerVolume}%</span>
          </div>
          <Slider
            value={[stingerVolume]}
            onValueChange={([v]) => onVolumeChange(v)}
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            data-testid="slider-stinger-volume"
          />
        </div>
      )}
    </div>
  );
}
