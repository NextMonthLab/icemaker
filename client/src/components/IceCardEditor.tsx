import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Image, Video, Mic, Upload, Loader2, Play, Pause, RefreshCw, 
  Save, Trash2, Lock, Sparkles, Crown, Wand2, Volume2, X,
  ChevronDown, ChevronUp, Check, AlertCircle, ImagePlus, ArrowUp, ArrowDown, GripVertical,
  User, ExternalLink, Link as LinkIcon, Clock, CheckCircle, Plus
} from "lucide-react";
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
}

interface MediaSegment {
  id: string;
  assetId?: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  durationSec: number;
  startTimeSec: number;
  order: number;
  renderMode?: RenderMode;
  sourceAspectRatio?: number;
}

interface ClipSuggestion {
  id: string;
  prompt: string;
  rationale: string;
  arcPhase: 'setup' | 'build' | 'peak' | 'resolve';
  continuityHints: string[];
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
}: IceCardEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const canGenerateImages = entitlements?.canGenerateImages ?? false;
  const canGenerateVideos = entitlements?.canGenerateVideos ?? false;
  const canGenerateVoiceover = entitlements?.canUploadAudio ?? false;
  const isPro = entitlements && entitlements.tier !== "free";
  
  const [activeTab, setActiveTab] = useState<"content" | "image" | "video" | "narration" | "upload" | "stock">("content");
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
  
  const [clipSuggestions, setClipSuggestions] = useState<ClipSuggestion[]>([]);
  const [clipSuggestionsLoading, setClipSuggestionsLoading] = useState(false);
  const [showClipSuggestions, setShowClipSuggestions] = useState(false);
  
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

  const handleGenerateImage = async () => {
    if (!canGenerateImages) {
      onUpgradeClick();
      return;
    }
    
    setImageLoading(true);
    try {
      const prompt = enhancePromptEnabled && enhancedPrompt 
        ? enhancedPrompt 
        : (imagePrompt || `${card.title}. ${card.content}`);
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
      toast({ title: "Image generated!", description: "AI image has been created for this card." });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setImageLoading(false);
    }
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
  
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
        return;
      }
      handleUploadMedia(file, "image");
    }
    e.target.value = "";
  };
  
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        toast({ title: "Invalid file", description: "Please select a video file.", variant: "destructive" });
        return;
      }
      handleUploadMedia(file, "video");
    }
    e.target.value = "";
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
                  
                  {/* Media Library - shows all assets */}
                  {(card.mediaAssets?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Media Library</Label>
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
                      <p className="text-xs text-slate-500">
                        Click an image to select it as active. {card.mediaAssets?.filter(a => a.kind === 'image').length} image(s) available.
                      </p>
                    </div>
                  )}
                  
                  {/* Currently Selected Preview */}
                  {card.generatedImageUrl && (
                    <div className="rounded-lg overflow-hidden border border-green-500/30 bg-green-500/5">
                      <div className="p-2 bg-green-500/10 flex items-center justify-between">
                        <span className="text-sm font-medium text-green-400">Active Image</span>
                      </div>
                      <img 
                        src={card.generatedImageUrl} 
                        alt={card.title}
                        className="w-full max-h-48 object-contain bg-black"
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
                  
                  {/* Enhance Prompt Toggle */}
                  <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
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
                    
                    // If no segments exist, fall back to current video asset duration
                    // This handles uploaded videos that may be longer than narration
                    if (segments.length === 0) {
                      const selectedVideoAsset = card.mediaAssets?.find(a => 
                        a.kind === 'video' && (a.id === card.selectedMediaAssetId || a.url === card.generatedVideoUrl)
                      );
                      // Use asset duration, or videoDurationSec from card, or default 5s for AI video
                      const videoDuration = selectedVideoAsset?.durationSec || card.videoDurationSec || 
                        (card.generatedVideoUrl ? 5 : 0);
                      totalFilledTime = videoDuration;
                    }
                    
                    // If we have no narration duration but have videos, still show filled time
                    const displayNarrationDuration = narrationDuration > 0 ? narrationDuration : totalFilledTime;
                    const remainingTime = narrationDuration > 0 ? Math.max(0, narrationDuration - totalFilledTime) : 0;
                    const percentFilled = displayNarrationDuration > 0 ? Math.min(100, (totalFilledTime / displayNarrationDuration) * 100) : 100;
                    
                    return (
                      <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-cyan-400 font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Media Timeline
                          </span>
                          <span className="text-slate-400">
                            {totalFilledTime.toFixed(1)}s{narrationDuration > 0 ? ` / ${narrationDuration.toFixed(1)}s` : ''}
                            {!hasNarration && hasVideo && ' (no narration)'}
                          </span>
                        </div>
                        
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              percentFilled >= 100 
                                ? 'bg-green-500' 
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                            }`}
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                        
                        {remainingTime > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-amber-400">
                              {remainingTime.toFixed(1)}s remaining to fill
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Add more media below
                            </span>
                          </div>
                        )}
                        
                        {percentFilled >= 100 && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Timeline filled - no gaps during playback
                          </div>
                        )}
                        
                        {/* Segment list with navigation */}
                        {segments.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {/* Navigation header */}
                            {segments.length > 1 && (
                              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Segments ({segments.length})</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedSegmentIndex(prev => 
                                      prev === null || prev <= 0 ? segments.length - 1 : prev - 1
                                    )}
                                    data-testid="button-prev-segment"
                                  >
                                    ← Prev
                                  </Button>
                                  <span className="text-xs text-slate-400 min-w-[3ch] text-center">
                                    {selectedSegmentIndex !== null ? selectedSegmentIndex + 1 : '-'}/{segments.length}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedSegmentIndex(prev => 
                                      prev === null || prev >= segments.length - 1 ? 0 : prev + 1
                                    )}
                                    data-testid="button-next-segment"
                                  >
                                    Next →
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* Segment items */}
                            <div className="space-y-1">
                              {segments.sort((a, b) => a.order - b.order).map((seg, idx) => (
                                <div 
                                  key={seg.id}
                                  className={`flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer hover-elevate ${
                                    selectedSegmentIndex === idx 
                                      ? 'bg-cyan-500/20 border border-cyan-500/40' 
                                      : 'bg-slate-800/50'
                                  }`}
                                  onClick={() => setSelectedSegmentIndex(selectedSegmentIndex === idx ? null : idx)}
                                  data-testid={`segment-item-${idx}`}
                                >
                                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium ${
                                    selectedSegmentIndex === idx
                                      ? 'bg-cyan-500 text-white'
                                      : 'bg-cyan-500/20 text-cyan-400'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <span className="text-slate-300 flex-1 truncate">
                                    {seg.kind === 'video' ? 'Video' : 'Image'}: {seg.durationSec}s
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updatedSegments = segments.filter(s => s.id !== seg.id)
                                        .map((s, i) => ({ ...s, order: i, startTimeSec: 0 }));
                                      // Recalculate start times
                                      let time = 0;
                                      for (const s of updatedSegments) {
                                        s.startTimeSec = time;
                                        time += s.durationSec;
                                      }
                                      if (selectedSegmentIndex !== null && selectedSegmentIndex >= updatedSegments.length) {
                                        setSelectedSegmentIndex(updatedSegments.length > 0 ? updatedSegments.length - 1 : null);
                                      }
                                      onCardUpdate(card.id, { mediaSegments: updatedSegments });
                                      onCardSave(card.id, { mediaSegments: updatedSegments });
                                    }}
                                    data-testid={`button-remove-segment-${idx}`}
                                  >
                                    <X className="w-3 h-3 text-slate-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            
                            {/* Selected segment preview */}
                            {selectedSegmentIndex !== null && segments[selectedSegmentIndex] && (
                              <div className="mt-2 p-2 rounded-lg bg-slate-800/70 border border-slate-700">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preview: Segment {selectedSegmentIndex + 1}</div>
                                <div className="aspect-video rounded overflow-hidden bg-slate-900">
                                  {segments[selectedSegmentIndex].kind === 'video' ? (
                                    <video 
                                      src={segments[selectedSegmentIndex].url} 
                                      className="w-full h-full object-cover"
                                      controls
                                      data-testid="video-segment-preview"
                                    />
                                  ) : (
                                    <img 
                                      src={segments[selectedSegmentIndex].url} 
                                      alt={`Segment ${selectedSegmentIndex + 1}`}
                                      className="w-full h-full object-cover"
                                      data-testid="image-segment-preview"
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Video Assets list - show when no segments but multiple videos */}
                        {segments.length === 0 && videoAssets.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700">
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                                Videos ({videoAssets.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {videoAssets.map((asset, idx) => {
                                const isSelected = asset.id === card.selectedMediaAssetId || 
                                  asset.url === card.generatedVideoUrl;
                                return (
                                  <div 
                                    key={asset.id}
                                    className={`group flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer hover-elevate ${
                                      isSelected 
                                        ? 'bg-cyan-500/20 border border-cyan-500/40' 
                                        : 'bg-slate-800/50'
                                    }`}
                                    onClick={() => {
                                      onCardUpdate(card.id, { 
                                        selectedMediaAssetId: asset.id,
                                        generatedVideoUrl: asset.url 
                                      });
                                      onCardSave(card.id, { 
                                        selectedMediaAssetId: asset.id,
                                        generatedVideoUrl: asset.url 
                                      });
                                    }}
                                    data-testid={`video-asset-item-${idx}`}
                                  >
                                    <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium ${
                                      isSelected
                                        ? 'bg-cyan-500 text-white'
                                        : 'bg-cyan-500/20 text-cyan-400'
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <Video className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-300 flex-1 truncate">
                                      {asset.durationSec ? `${asset.durationSec}s` : '5s'}
                                      {isSelected && ' (active)'}
                                    </span>
                                    {/* Action buttons for video assets */}
                                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                      {asset.source === 'ai' && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 bg-cyan-500/80 hover:bg-cyan-600 text-white"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRegenerateAsset(asset.id);
                                          }}
                                          disabled={regeneratingAsset === asset.id}
                                          data-testid={`regenerate-video-${asset.id}`}
                                        >
                                          {regeneratingAsset === asset.id ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                          ) : (
                                            <RefreshCw className="w-2.5 h-2.5" />
                                          )}
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 bg-red-500/80 hover:bg-red-600 text-white"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAsset(asset.id);
                                        }}
                                        disabled={deletingAsset === asset.id}
                                        data-testid={`delete-video-${asset.id}`}
                                      >
                                        {deletingAsset === asset.id ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-2.5 h-2.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Click a video to set it as active. Only one video plays at a time.
                            </p>
                          </div>
                        )}
                        
                        {/* AI Clip Suggestions - show when remaining time allows 4+ segments (20s+) */}
                        {remainingTime >= 20 && (
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
                              <div className="space-y-2" data-testid="clip-suggestions-list">
                                {clipSuggestions.map((suggestion) => (
                                  <div 
                                    key={suggestion.id}
                                    className="p-2 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1.5"
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
                      {/* Clip Tabs - shows sequence of video clips (persisted + drafts) */}
                      {unifiedClips.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            {unifiedClips.map((clip, idx) => {
                              const isActive = activeClipId === clip.id || 
                                (clip.isPersistedAsset && (card.selectedMediaAssetId === clip.id || card.generatedVideoUrl === clip.videoUrl));
                              const isDraft = clip.status === 'draft';
                              const isGenerating = clip.status === 'generating';
                              
                              return (
                                <button
                                  key={clip.id}
                                  onClick={() => {
                                    setActiveClipId(clip.id);
                                    if (clip.isPersistedAsset && clip.videoUrl) {
                                      onCardUpdate(card.id, { 
                                        selectedMediaAssetId: clip.id,
                                        generatedVideoUrl: clip.videoUrl 
                                      });
                                    }
                                    if (!clip.isPersistedAsset) {
                                      setVideoPrompt(clip.prompt);
                                    }
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                                    isActive
                                      ? 'bg-cyan-500 text-white'
                                      : isGenerating
                                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50 animate-pulse'
                                        : isDraft
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                  data-testid={`clip-tab-${idx}`}
                                >
                                  {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
                                  {isDraft && <span className="text-amber-400">●</span>}
                                  <span>Clip {idx + 1}</span>
                                  {clip.durationSec && <span className="text-[10px] opacity-70">({clip.durationSec}s)</span>}
                                  {isDraft && <span className="text-[10px] opacity-70">(draft)</span>}
                                </button>
                              );
                            })}
                            {/* Add new clip button - only show if no draft exists */}
                            {!draftClips.some(d => d.status === 'draft') && (
                              <button
                                onClick={() => {
                                  addDraftClip('');
                                  setShowClipSuggestions(true);
                                  toast({
                                    title: `Clip ${unifiedClips.length + 1} created`,
                                    description: "Enter a prompt or pick a suggestion below.",
                                  });
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-cyan-400 border border-dashed border-cyan-500/50 hover:border-cyan-500 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                                data-testid="button-add-clip"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Clip</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {draftClips.some(d => d.status === 'draft') 
                              ? `Working on Clip ${unifiedClips.length}. Enter a prompt and generate.`
                              : "Click a clip tab to preview it. Clips play in sequence during playback."
                            }
                          </p>
                        </div>
                      )}
                      
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
                          className="flex-1 gap-2"
                          data-testid="button-generate-narration"
                        >
                          {narrationLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                          {narrationLoading ? "Generating..." : "Generate Narration"}
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
                      Add your own images or videos to this card instead of using AI-generated content.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Button
                          onClick={() => imageInputRef.current?.click()}
                          disabled={imageUploading}
                          className="w-full gap-2"
                          data-testid="button-upload-own-image"
                        >
                          {imageUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Image className="w-4 h-4" />
                          )}
                          {imageUploading ? "Uploading..." : "Upload Image"}
                        </Button>
                        <p className="text-xs text-slate-500 text-center">JPG, PNG, WebP</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Button
                          onClick={() => videoInputRef.current?.click()}
                          disabled={videoUploading}
                          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                          data-testid="button-upload-own-video"
                        >
                          {videoUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Video className="w-4 h-4" />
                          )}
                          {videoUploading ? "Uploading..." : "Upload Video"}
                        </Button>
                        <p className="text-xs text-slate-500 text-center">MP4, WebM, MOV</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show current media */}
                  {(card.generatedImageUrl || card.generatedVideoUrl) && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Current Card Media</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {card.generatedImageUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video">
                            <img 
                              src={card.generatedImageUrl} 
                              alt="Card image" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-cyan-600/90 rounded text-xs text-white">
                              Image
                            </div>
                          </div>
                        )}
                        {card.generatedVideoUrl && (
                          <div className="relative rounded-lg overflow-hidden border border-slate-700 aspect-video">
                            <video 
                              src={card.generatedVideoUrl} 
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-blue-600/90 rounded text-xs text-white">
                              Video
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                          source: 'upload',
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
                      }}
                      onSelectVideo={async (url, thumbnailUrl, photographer) => {
                        // Detect video duration
                        let videoDuration: number | undefined;
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
                className="hidden"
                onChange={handleImageFileChange}
                data-testid="input-upload-image"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoFileChange}
                data-testid="input-upload-video"
              />
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
