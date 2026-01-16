import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { Sparkles, Globe, FileText, ArrowRight, Loader2, GripVertical, Lock, Play, Image, Mic, Upload, Check, Circle, Eye, Pencil, Film, X, ChevronLeft, ChevronRight, MessageCircle, Wand2, Video, Volume2, VolumeX, Music, Download, Send, GraduationCap, ScrollText, Lightbulb, Plus, User, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card as UiCard, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import GlobalNav from "@/components/GlobalNav";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import CardPlayer from "@/components/CardPlayer";
import type { Card } from "@/lib/mockData";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import previewCardBackground from "@assets/generated_images/icy_mountain_landscape_placeholder.png";
import { InteractivityNode, AddInteractivityButton, StoryCharacter } from "@/components/InteractivityNode";
import { GuidedWalkthrough } from "@/components/GuidedWalkthrough";
import { StoryStructureOverlay } from "@/components/StoryStructureOverlay";
import { MediaGenerationPanel } from "@/components/MediaGenerationPanel";
import { UpgradeModal } from "@/components/UpgradeModal";
import { IceCardEditor } from "@/components/IceCardEditor";
import { ContinuityPanel } from "@/components/ContinuityPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BookOpen } from "lucide-react";
import type { ProjectBible } from "@shared/schema";
import { CaptionStylePicker } from "@/components/ice-maker/CaptionStylePicker";
import { createDefaultCaptionState, type CaptionState } from "@/caption-engine/schemas";
import { EnterpriseBrandingUpsell } from "@/components/EnterpriseBrandingUpsell";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Share2, Copy } from "lucide-react";
import { PublishModal } from "@/components/PublishModal";
import type { ContentVisibility } from "@shared/schema";
import { BuilderActionsSidebar } from "@/components/ice-maker/BuilderActionsSidebar";
import { BuilderPreviewDrawer } from "@/components/ice-maker/BuilderPreviewDrawer";
import { FreePassBanner } from "@/components/FreePassBanner";
import crownOfTheFallingStar from "@assets/Crown_of_the_Falling_Star_1768503662594.mp3";
import orbitalDrift from "@assets/Orbital_Drift_1768503662592.mp3";
import vanishingFootsteps from "@assets/Vanishing_Footsteps_1768503662595.mp3";
import midnightCoffeeCup from "@assets/Midnight_Coffee_Cup_1768503662592.mp3";
import softStepsClearSteps from "@assets/Soft_Steps,_Clear_Steps_1768503662595.mp3";
import sundayOnRepeat from "@assets/Sunday_On_Repeat_1768503662596.mp3";
import midnightSideQuest from "@assets/Midnight_Side_Quest_1768503662593.mp3";
import quarterlySunrise from "@assets/Quarterly_Sunrise_1768503662596.mp3";
import everydayFeelsSoGood from "@assets/Everyday_Feels_So_Good_1768503662596.mp3";
import runwayToNowhere from "@assets/Runway_to_Nowhere_1768503662596.mp3";

const CREATION_STAGES = [
  { id: "fetch", label: "Fetching your content", duration: 1500 },
  { id: "analyze", label: "Analyzing structure and themes", duration: 2000 },
  { id: "extract", label: "Extracting key moments", duration: 2500 },
  { id: "craft", label: "Crafting your story cards", duration: 2000 },
  { id: "polish", label: "Adding the finishing touches", duration: 1500 },
];

const MUSIC_TRACKS = [
  { id: "none", name: "No Music", url: null, category: null },
  // Cinematic & Epic
  { id: "crown-falling-star", name: "Crown of the Falling Star", url: crownOfTheFallingStar, category: "cinematic" },
  { id: "vanishing-footsteps", name: "Vanishing Footsteps", url: vanishingFootsteps, category: "cinematic" },
  // Chill & Ambient
  { id: "orbital-drift", name: "Orbital Drift", url: orbitalDrift, category: "chill" },
  { id: "midnight-coffee", name: "Midnight Coffee Cup", url: midnightCoffeeCup, category: "chill" },
  { id: "soft-steps", name: "Soft Steps, Clear Steps", url: softStepsClearSteps, category: "chill" },
  { id: "sunday-repeat", name: "Sunday On Repeat", url: sundayOnRepeat, category: "chill" },
  // Vlog & Upbeat
  { id: "quarterly-sunrise", name: "Quarterly Sunrise", url: quarterlySunrise, category: "vlog" },
  { id: "everyday-good", name: "Everyday Feels So Good", url: everydayFeelsSoGood, category: "vlog" },
  // Pop & Modern
  { id: "midnight-quest", name: "Midnight Side Quest", url: midnightSideQuest, category: "pop" },
  { id: "runway-nowhere", name: "Runway to Nowhere", url: runwayToNowhere, category: "pop" },
];

type GuestCategory = 'testimonial' | 'expert' | 'engineer' | 'interviewee' | 'founder' | 'customer' | 'other';
type GuestStatus = 'idle' | 'generating' | 'ready' | 'failed';
type GuestProvider = 'heygen' | 'did';

interface PreviewCard {
  id: string;
  title: string;
  content: string;
  order: number;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  narrationAudioUrl?: string;
  videoGenerated?: boolean;
  videoGenerationStatus?: string;
  cardType?: 'standard' | 'guest' | 'cta';
  // CTA card fields
  ctaHeadline?: string;
  ctaButtonLabel?: string;
  ctaUrl?: string;
  ctaSubtext?: string;
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

interface InsightOrigin {
  insightId: string;
  insightTitle: string;
  insightMeaning: string;
  businessSlug: string;
}

interface PreviewData {
  id: string;
  title: string;
  cards: PreviewCard[];
  characters?: StoryCharacter[];
  interactivityNodes?: InteractivityNodeData[];
  sourceType: string;
  sourceValue: string;
  status?: string;
  createdAt: string;
  previewAccessToken?: string;
}

interface InteractivityNodeData {
  id: string;
  afterCardIndex: number;
  isActive: boolean;
  selectedCharacterId?: string;
}

interface Entitlements {
  canUseCloudLlm: boolean;
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  canUploadAudio: boolean;
  canExport: boolean;
  canUseCharacterChat: boolean;
  maxCardsPerStory: number;
  storageDays: number;
  planName: string;
  tier: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function PreviewChatPanel({
  previewId,
  previewAccessToken,
  character,
  onContinue,
}: {
  previewId: string;
  previewAccessToken?: string;
  character?: StoryCharacter;
  onContinue: () => void;
}) {
  const characterName = character?.name || "Story Character";
  const openingMessage = character?.openingMessage || `Hello! I'm ${characterName}. What would you like to know?`;
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isReady = !!previewId;
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const sendMessage = async () => {
    if (!input.trim() || isLoading || !isReady) return;
    
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/ice/preview/${previewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userMessage,
          characterId: character?.id,
          previewAccessToken,
        }),
      });
      
      const data = await response.json();
      
      if (data.capped) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.message || "This preview has reached its chat limit." },
        ]);
      } else if (data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.error || "Sorry, something went wrong." },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full max-h-[100dvh] pb-safe">
      {/* Character header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/50 to-blue-500/50 flex items-center justify-center ring-2 ring-cyan-400/30">
          <MessageCircle className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{characterName}</h3>
          <p className="text-xs text-white/50">AI Character</p>
        </div>
        <button
          onClick={onContinue}
          className="text-xs text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30"
          data-testid="button-skip-chat"
        >
          Skip
        </button>
      </div>
      
      {/* Messages area - scrollable */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto space-y-4 min-h-0 pb-4 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-lg ${
              msg.role === "user" 
                ? "bg-gradient-to-br from-blue-500 to-blue-600" 
                : "bg-gradient-to-br from-cyan-500 to-blue-500"
            }`}>
              {msg.role === "user" ? (
                <span className="text-xs font-medium text-white">You</span>
              ) : (
                <MessageCircle className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`flex-1 max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block px-4 py-3 rounded-2xl shadow-md ${
                msg.role === "user" 
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md" 
                  : "bg-white/10 backdrop-blur-sm text-white/90 rounded-bl-md border border-white/5"
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 animate-in fade-in duration-200">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex-shrink-0 flex items-center justify-center shadow-lg">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="flex-1">
              <div className="inline-block px-4 py-3 rounded-2xl rounded-bl-md bg-white/10 backdrop-blur-sm border border-white/5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input area - fixed at bottom */}
      <div className="flex-shrink-0 pt-3 border-t border-white/10 bg-black/20 backdrop-blur-sm -mx-4 px-4 pb-2">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={isReady ? "Ask me anything..." : "Loading..."}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full px-4 h-11 focus:ring-2 focus:ring-cyan-500/50"
            disabled={isLoading || !isReady}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !isReady}
            size="icon"
            className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Send className="w-5 h-5 text-white" />}
          </Button>
        </div>
        
        {/* Continue button - subtle, secondary action */}
        <button
          onClick={onContinue}
          className="w-full mt-3 py-2 text-sm text-white/50 hover:text-white/80 transition-colors flex items-center justify-center gap-1"
          data-testid="button-continue-from-interactivity"
        >
          Continue to next card
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function GuestIceBuilderPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const previewIdFromUrl = params.id;
  const { toast } = useToast();
  
  // Check for view mode from URL query parameter
  const searchParams = new URLSearchParams(window.location.search);
  const isViewMode = searchParams.get("view") === "true";
  const { user } = useAuth();
  const [inputType, setInputType] = useState<"url" | "text" | "file">("url");
  
  const { data: entitlements } = useQuery({
    queryKey: ["/api/me/entitlements"],
    queryFn: async () => {
      const res = await fetch("/api/me/entitlements", { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<Entitlements>;
    },
    enabled: !!user,
    staleTime: 60000,
  });
  
  const isProfessionalMode = entitlements && entitlements.tier !== "free";
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [contentContext, setContentContext] = useState<"ld_framework" | "case_study" | "program_notes" | "auto">("auto");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState(-1);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewCardIndex, setPreviewCardIndex] = useState(0);
  const [interactivityNodes, setInteractivityNodes] = useState<InteractivityNodeData[]>([]);
  const [previewAccessToken, setPreviewAccessToken] = useState<string | undefined>();
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showStoryStructure, setShowStoryStructure] = useState(false);
  const [captionState, setCaptionState] = useState<CaptionState>(() => createDefaultCaptionState());
  const [showCaptionSettings, setShowCaptionSettings] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showBulkImageConfirm, setShowBulkImageConfirm] = useState(false);
  const [showBulkVideoConfirm, setShowBulkVideoConfirm] = useState(false);
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false);
  const [bulkGeneratingVideos, setBulkGeneratingVideos] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [narrationMuted, setNarrationMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicTrackUrl, setMusicTrackUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(50);
  const [narrationVolume, setNarrationVolume] = useState(100);
  const [isPreviewingMusic, setIsPreviewingMusic] = useState(false);
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [showBiblePanel, setShowBiblePanel] = useState(false);
  const [projectBible, setProjectBible] = useState<ProjectBible | null>(null);
  const [bibleGenerating, setBibleGenerating] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{
    status: string;
    progress: number;
    currentStep: string;
    outputUrl?: string;
  } | null>(null);
  const exportPollingRef = useRef<NodeJS.Timeout | null>(null);
  const [activePreviewNodeIndex, setActivePreviewNodeIndex] = useState<number | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showExportComingSoon, setShowExportComingSoon] = useState(false);
  const [iceVisibility, setIceVisibility] = useState<ContentVisibility>("unlisted");
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  
  // Logo branding settings
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPosition, setLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-right");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  
  // Desktop sidebar and preview drawer state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [previewDrawerCardIndex, setPreviewDrawerCardIndex] = useState<number | null>(null);
  
  const handleManualNav = (newIndex: number) => {
    // When navigating forward, check if we need to stop at an AI character checkpoint
    if (newIndex > previewCardIndex) {
      // Find any interactivity nodes between current position and target
      const checkpointInRange = interactivityNodes.find(
        node => node.isActive && 
               node.afterCardIndex >= previewCardIndex && 
               node.afterCardIndex < newIndex
      );
      
      if (checkpointInRange) {
        // Stop at the checkpoint instead of skipping past it
        setPreviewCardIndex(checkpointInRange.afterCardIndex);
        setActivePreviewNodeIndex(checkpointInRange.afterCardIndex);
        return;
      }
    }
    
    // No checkpoint in the way, navigate directly
    setActivePreviewNodeIndex(null);
    setPreviewCardIndex(newIndex);
  };
  
  const handleCardPhaseComplete = () => {
    const nodeAtCurrentCard = interactivityNodes.find(n => n.afterCardIndex === previewCardIndex);
    if (nodeAtCurrentCard) {
      setActivePreviewNodeIndex(previewCardIndex);
    } else if (previewCardIndex < cards.length - 1) {
      setPreviewCardIndex(prev => prev + 1);
    }
  };
  
  const handleContinueFromInteractivity = () => {
    setActivePreviewNodeIndex(null);
    if (previewCardIndex < cards.length - 1) {
      setPreviewCardIndex(prev => prev + 1);
    }
  };
  
  // Create/destroy audio element only when modal opens/closes
  useEffect(() => {
    if (showPreviewModal && !musicAudioRef.current) {
      musicAudioRef.current = new Audio();
      musicAudioRef.current.loop = true;
      musicAudioRef.current.volume = musicVolume / 100;
    }
    
    if (!showPreviewModal && musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
  }, [showPreviewModal]);
  
  // Handle track changes - reuse same audio element, just update src
  useEffect(() => {
    if (!musicAudioRef.current) return;
    
    // Update track if changed
    if (musicTrackUrl) {
      const currentSrc = musicAudioRef.current.src;
      const trackFilename = musicTrackUrl.split('/').pop() || '';
      if (!currentSrc || !currentSrc.includes(trackFilename)) {
        musicAudioRef.current.src = musicTrackUrl;
        musicAudioRef.current.load();
      }
    }
    
    // Play/pause based on enabled state
    if (showPreviewModal && musicEnabled && musicTrackUrl) {
      musicAudioRef.current.play().catch(() => {});
    } else {
      musicAudioRef.current.pause();
    }
  }, [showPreviewModal, musicEnabled, musicTrackUrl]);
  
  // Separate effect for volume - always apply volume immediately
  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume]);
  
  // Cleanup music audio on component unmount
  useEffect(() => {
    return () => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      if (musicPreviewRef.current) {
        musicPreviewRef.current.pause();
        musicPreviewRef.current = null;
      }
    };
  }, []);
  
  // Track previous music URL to detect changes
  const prevMusicTrackUrlRef = useRef<string | null>(null);
  
  // Toggle music preview playback
  const toggleMusicPreview = () => {
    const selectedUrl = musicTrackUrl;
    if (!selectedUrl) return;
    
    if (isPreviewingMusic && musicPreviewRef.current) {
      musicPreviewRef.current.pause();
      setIsPreviewingMusic(false);
    } else {
      // Stop any existing playback first
      if (musicPreviewRef.current) {
        musicPreviewRef.current.pause();
      }
      // Create new audio element for the selected track
      musicPreviewRef.current = new Audio(selectedUrl);
      musicPreviewRef.current.volume = musicVolume / 100;
      musicPreviewRef.current.onended = () => setIsPreviewingMusic(false);
      musicPreviewRef.current.onerror = () => {
        console.error("Error loading music preview");
        setIsPreviewingMusic(false);
      };
      musicPreviewRef.current.play()
        .then(() => setIsPreviewingMusic(true))
        .catch((err) => {
          console.error("Failed to play music preview:", err);
          setIsPreviewingMusic(false);
        });
    }
  };
  
  // Stop preview when track changes (only if actually changed)
  useEffect(() => {
    if (prevMusicTrackUrlRef.current !== null && 
        prevMusicTrackUrlRef.current !== musicTrackUrl && 
        isPreviewingMusic && 
        musicPreviewRef.current) {
      musicPreviewRef.current.pause();
      setIsPreviewingMusic(false);
    }
    prevMusicTrackUrlRef.current = musicTrackUrl;
  }, [musicTrackUrl, isPreviewingMusic]);
  
  // Update preview volume when volume changes
  useEffect(() => {
    if (musicPreviewRef.current && isPreviewingMusic) {
      musicPreviewRef.current.volume = musicVolume / 100;
    }
  }, [musicVolume, isPreviewingMusic]);
  
  // Save music and style settings when they change (debounced)
  const settingsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(true); // Skip until preview data is loaded
  
  useEffect(() => {
    // Skip saving until preview data has been loaded and hydrated
    if (skipNextSaveRef.current) {
      return;
    }
    
    // Only save if we have a preview
    if (!preview?.id) return;
    
    // Debounce the save
    if (settingsSaveTimeoutRef.current) {
      clearTimeout(settingsSaveTimeoutRef.current);
    }
    
    settingsSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/ice/preview/${preview.id}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            musicTrackUrl,
            musicVolume,
            musicEnabled,
            narrationVolume,
            logoEnabled,
            logoUrl,
            logoPosition,
            captionSettings: {
              presetId: captionState.presetId,
              animationId: captionState.animationId,
              safeAreaProfileId: captionState.safeAreaProfileId,
              karaokeEnabled: captionState.karaokeEnabled,
              karaokeStyle: captionState.karaokeStyle,
            },
          }),
        });
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    }, 500);
    
    return () => {
      if (settingsSaveTimeoutRef.current) {
        clearTimeout(settingsSaveTimeoutRef.current);
      }
    };
  }, [preview?.id, musicTrackUrl, musicVolume, musicEnabled, narrationVolume, logoEnabled, logoUrl, logoPosition, captionState.presetId, captionState.animationId, captionState.karaokeEnabled, captionState.karaokeStyle, captionState.safeAreaProfileId]);
  
  const hasSeenWalkthrough = () => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ice_walkthrough_seen") === "true";
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasSeenUpgradeWelcome = localStorage.getItem("ice_upgrade_welcomed") === "true";
    if (urlParams.get("upgraded") === "true" && !hasSeenUpgradeWelcome) {
      localStorage.setItem("ice_upgrade_welcomed", "true");
      toast({
        title: "You're in the Professional Editor",
        description: "Everything you created is here. This is where you refine, publish, and manage your experience.",
        duration: 6000,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  
  const markWalkthroughSeen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ice_walkthrough_seen", "true");
    }
    setShowWalkthrough(false);
  };
  
  // Auto-advance through visual stages during creation
  useEffect(() => {
    if (currentStage >= 0 && currentStage < CREATION_STAGES.length - 1) {
      stageTimerRef.current = setTimeout(() => {
        setCurrentStage(prev => prev + 1);
      }, CREATION_STAGES[currentStage].duration);
    }
    return () => {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, [currentStage]);
  
  const { data: existingPreview, isLoading: loadingExisting } = useQuery({
    queryKey: ["/api/ice/preview", previewIdFromUrl],
    queryFn: async () => {
      if (!previewIdFromUrl) return null;
      const res = await fetch(`/api/ice/preview/${previewIdFromUrl}`);
      if (!res.ok) {
        if (res.status === 410) throw new Error("This preview has expired");
        if (res.status === 404) throw new Error("Preview not found");
        throw new Error("Failed to load preview");
      }
      return res.json();
    },
    enabled: !!previewIdFromUrl,
    retry: false,
  });
  
  useEffect(() => {
    if (existingPreview) {
      setPreview(existingPreview);
      setCards(existingPreview.cards);
      if (existingPreview.interactivityNodes) {
        setInteractivityNodes(existingPreview.interactivityNodes);
      }
      if (existingPreview.previewAccessToken) {
        setPreviewAccessToken(existingPreview.previewAccessToken);
      }
      if (existingPreview.projectBible) {
        setProjectBible(existingPreview.projectBible);
      }
      // Load music settings
      if (existingPreview.musicTrackUrl) {
        setMusicTrackUrl(existingPreview.musicTrackUrl);
      }
      if (existingPreview.musicVolume !== undefined) {
        setMusicVolume(existingPreview.musicVolume);
      }
      if (existingPreview.musicEnabled !== undefined) {
        setMusicEnabled(existingPreview.musicEnabled);
      }
      // Load narration volume
      if (existingPreview.narrationVolume !== undefined) {
        setNarrationVolume(existingPreview.narrationVolume);
      }
      // Load caption settings from server
      if (existingPreview.captionSettings) {
        setCaptionState(prev => ({
          ...prev,
          presetId: existingPreview.captionSettings.presetId || prev.presetId,
          animationId: existingPreview.captionSettings.animationId || prev.animationId,
          safeAreaProfileId: existingPreview.captionSettings.safeAreaProfileId || prev.safeAreaProfileId,
          karaokeEnabled: existingPreview.captionSettings.karaokeEnabled ?? prev.karaokeEnabled,
          karaokeStyle: existingPreview.captionSettings.karaokeStyle || prev.karaokeStyle,
        }));
      }
      // Load logo branding settings
      if (existingPreview.logoEnabled !== undefined) {
        setLogoEnabled(existingPreview.logoEnabled);
      }
      if (existingPreview.logoUrl) {
        setLogoUrl(existingPreview.logoUrl);
      }
      if (existingPreview.logoPosition) {
        setLogoPosition(existingPreview.logoPosition);
      }
      
      // Enable saving after a short delay to ensure all state is hydrated
      setTimeout(() => {
        skipNextSaveRef.current = false;
      }, 1000);
      
      // Load publish state
      if (existingPreview.visibility) {
        setIceVisibility(existingPreview.visibility);
      }
      if (existingPreview.shareSlug) {
        setShareSlug(existingPreview.shareSlug);
      }
      // If in view mode, automatically open the preview modal
      if (isViewMode) {
        setShowPreviewModal(true);
      } else if (!hasSeenWalkthrough()) {
        setShowWalkthrough(true);
      }
    }
  }, [existingPreview, isViewMode]);

  const handleGenerateBible = async () => {
    if (!preview?.id || !user) return;
    setBibleGenerating(true);
    try {
      const res = await fetch(`/api/ice/preview/${preview.id}/bible/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ regenerate: !!projectBible }),
      });
      if (!res.ok) throw new Error("Failed to generate bible");
      const data = await res.json();
      setProjectBible(data.bible);
      toast({ 
        title: "Project Bible Generated", 
        description: `Found ${data.bible.characters?.length || 0} characters and world details.` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate bible", variant: "destructive" });
    } finally {
      setBibleGenerating(false);
    }
  };

  const handleBibleChange = async (updatedBible: ProjectBible) => {
    setProjectBible(updatedBible);
    if (!preview?.id || !user) return;
    try {
      await fetch(`/api/ice/preview/${preview.id}/bible`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bible: updatedBible }),
      });
    } catch (error) {
      console.error("Failed to save bible:", error);
    }
  };

  // Handle logo file upload
  const handleLogoUpload = async (file: File) => {
    if (!file || !user) return;
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file (PNG, JPG, etc.)", variant: "destructive" });
      return;
    }
    
    // Validate file size (2MB max for logos)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingLogo(true);
    try {
      // Get presigned upload URL
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
      
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      
      // Upload file to object storage
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      
      if (!uploadRes.ok) throw new Error("Failed to upload logo");
      
      // Set the logo URL and enable
      setLogoUrl(objectPath);
      setLogoEnabled(true);
      
      toast({ title: "Logo uploaded", description: "Your logo will appear on all cards" });
    } catch (error) {
      console.error("Logo upload failed:", error);
      toast({ title: "Upload failed", description: "Failed to upload logo. Please try again.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const createPreviewMutation = useMutation({
    mutationFn: async (data: { type: string; value: string; context?: string }) => {
      setCurrentStage(0); // Start the visual stages
      const res = await apiRequest("POST", "/api/ice/preview", data);
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentStage(-1); // Reset stages
      setPreview(data);
      setCards(data.cards);
      if (data.previewAccessToken) {
        setPreviewAccessToken(data.previewAccessToken);
      }
      toast({ title: "Preview created!", description: "You can now edit and reorder your story cards." });
      navigate(`/ice/preview/${data.id}`, { replace: true });
      if (!hasSeenWalkthrough()) {
        setShowWalkthrough(true);
      }
      
      // Auto-generate Project Bible for logged-in users (fire-and-forget)
      if (user && data.id && data.cards?.length > 0) {
        setBibleGenerating(true);
        fetch(`/api/ice/preview/${data.id}/bible/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ regenerate: false }),
        })
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(bibleData => setProjectBible(bibleData.bible))
          .catch(error => console.error("Auto-generate bible failed:", error))
          .finally(() => setBibleGenerating(false));
      }
    },
    onError: (error: Error) => {
      setCurrentStage(-1); // Reset stages on error
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveCardsMutation = useMutation({
    mutationFn: async ({ updatedCards, nodes }: { updatedCards: PreviewCard[], nodes?: InteractivityNodeData[] }) => {
      if (!preview) return;
      const res = await apiRequest("PUT", `/api/ice/preview/${preview.id}/cards`, { 
        cards: updatedCards,
        interactivityNodes: nodes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Progress saved", description: "Your changes have been saved." });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview to save");
      const res = await apiRequest("POST", "/api/transformations/from-preview", { previewId: preview.id });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Experience saved!", description: "Your experience has been saved to your account." });
      navigate(`/admin/transformations/${data.jobId}`);
    },
    onError: (error: Error) => {
      if (error.message.includes("Authentication required")) {
        toast({ 
          title: "Sign in to save", 
          description: "Create a free account to save your experience and unlock premium features.",
        });
        // Include preview ID in return URL so user can resume after login
        const returnUrl = preview ? `/ice/preview/${preview.id}` : "/try";
        navigate(`/login?return=${encodeURIComponent(returnUrl)}`);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview to export");
      const res = await apiRequest("POST", `/api/ice/preview/${preview.id}/export`, {
        quality: "standard",
        includeNarration: true,
        includeMusic: musicEnabled,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setExportJobId(data.jobId);
      setExportStatus({ status: "queued", progress: 0, currentStep: "Starting export..." });
      toast({ title: "Export started", description: "Your video is being created. This may take a few minutes." });
      
      const pollExportStatus = async () => {
        if (!data.jobId) return;
        try {
          const res = await fetch(`/api/ice/export/${data.jobId}`, { credentials: "include" });
          if (res.ok) {
            const status = await res.json();
            setExportStatus(status);
            
            if (status.status === "completed") {
              if (exportPollingRef.current) clearInterval(exportPollingRef.current);
              toast({ title: "Export complete!", description: "Your video is ready for download." });
            } else if (status.status === "failed") {
              if (exportPollingRef.current) clearInterval(exportPollingRef.current);
              toast({ title: "Export failed", description: status.errorMessage || "An error occurred", variant: "destructive" });
            }
          }
        } catch (err) {
          console.error("Error polling export status:", err);
        }
      };
      
      exportPollingRef.current = setInterval(pollExportStatus, 3000);
      pollExportStatus();
    },
    onError: (error: Error) => {
      if (error.message.includes("upgradeRequired")) {
        setShowUpgradeModal(true);
      } else {
        toast({ title: "Export failed", description: error.message, variant: "destructive" });
      }
    },
  });

  useEffect(() => {
    return () => {
      if (exportPollingRef.current) {
        clearInterval(exportPollingRef.current);
      }
    };
  }, []);

  const [isFileUploading, setIsFileUploading] = useState(false);
  
  const handleSubmit = async () => {
    if (inputType === "file") {
      if (!selectedFile) {
        toast({ title: "File required", description: "Please select a file to upload.", variant: "destructive" });
        return;
      }
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      try {
        setIsFileUploading(true);
        setCurrentStage(0); // Start the visual stages
        const res = await fetch("/api/ice/preview/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: "Upload failed" }));
          throw new Error(error.message || "Upload failed");
        }
        const data = await res.json();
        setCurrentStage(-1); // Reset stages
        setPreview(data);
        setCards(data.cards);
        navigate(`/ice/preview/${data.id}`);
        toast({ title: "Preview created!", description: "Your story cards are ready to edit." });
      } catch (error: any) {
        setCurrentStage(-1); // Reset stages on error
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } finally {
        setIsFileUploading(false);
      }
      return;
    }
    
    let value = inputType === "url" ? urlValue.trim() : textValue.trim();
    if (!value) {
      toast({ title: "Input required", description: "Please enter a URL or paste your content.", variant: "destructive" });
      return;
    }
    
    // Normalize URL: add https:// if no protocol specified
    if (inputType === "url" && !value.match(/^https?:\/\//i)) {
      value = `https://${value}`;
    }
    
    createPreviewMutation.mutate({ 
      type: inputType, 
      value,
      context: inputType === "url" ? contentContext : undefined 
    });
  };

  // Use refs to track pending save operations and serialize mutations
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardsRef = useRef(cards);
  const nodesRef = useRef(interactivityNodes);
  const saveQueuedRef = useRef(false);
  const savingRef = useRef(false);
  
  // Keep cardsRef in sync with cards state
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  
  // Keep nodesRef in sync with interactivity nodes state and trigger save
  const nodesInitializedRef = useRef(false);
  useEffect(() => {
    nodesRef.current = interactivityNodes;
    
    // Don't save on initial load, only on user changes
    if (!nodesInitializedRef.current) {
      nodesInitializedRef.current = true;
      return;
    }
    
    // Debounce save when nodes change
    if (preview && cardsRef.current.length > 0) {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
      pendingSaveRef.current = setTimeout(() => {
        pendingSaveRef.current = null;
        performSave();
      }, 500);
    }
  }, [interactivityNodes]);
  
  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, []);
  
  // Perform the actual save, serializing mutations to prevent race conditions
  const performSave = async () => {
    if (savingRef.current || !preview) {
      // If already saving, mark that another save is needed after current completes
      saveQueuedRef.current = true;
      return;
    }
    
    savingRef.current = true;
    saveQueuedRef.current = false;
    
    try {
      await saveCardsMutation.mutateAsync({ 
        updatedCards: cardsRef.current,
        nodes: nodesRef.current,
      });
    } finally {
      savingRef.current = false;
      
      // If another save was queued while we were saving, perform it now
      if (saveQueuedRef.current && cardsRef.current.length > 0) {
        saveQueuedRef.current = false;
        performSave();
      }
    }
  };
  
  // Save cards with current updates - debounced to handle rapid edits
  const saveCardsWithUpdates = (cardId: string, updates: Partial<PreviewCard>) => {
    // Clear any pending save
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }
    
    // Update state immediately
    setCards(currentCards => {
      const newCards = currentCards.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      );
      // Store the new cards in ref for the debounced save
      cardsRef.current = newCards;
      return newCards;
    });
    
    // Debounce the save by 500ms to batch rapid edits
    if (preview) {
      pendingSaveRef.current = setTimeout(() => {
        pendingSaveRef.current = null;
        performSave();
      }, 500);
    }
  };

  const handleCardUpdate = (cardId: string, updates: Partial<PreviewCard>) => {
    setCards(currentCards => {
      const newCards = currentCards.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      );
      cardsRef.current = newCards;
      return newCards;
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newCards = [...cards];
    const [removed] = newCards.splice(draggedIndex, 1);
    newCards.splice(index, 0, removed);
    newCards.forEach((card, i) => card.order = i);
    setCards(newCards);
    cardsRef.current = newCards;
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // Trigger serialized save - cardsRef is already up to date from handleDragOver
    performSave();
  };

  const handleCardEdit = (index: number, field: "title" | "content", value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
    cardsRef.current = newCards;
  };

  const handleCardBlur = () => {
    // Legacy handler - no longer used directly
  };

  // Add a new blank card
  const handleAddCard = () => {
    const newCardId = `card_${Date.now()}`;
    const newCard: PreviewCard = {
      id: newCardId,
      title: `Card ${cards.length + 1}`,
      content: "Add your content here...",
      order: cards.length,
      cardType: 'standard',
      generatedImageUrl: undefined,
      generatedVideoUrl: undefined,
    };
    const newCards = [...cards, newCard];
    setCards(newCards);
    cardsRef.current = newCards;
    performSave();
    toast({ title: "Card added", description: "New card added to your experience." });
  };
  
  // Add a new guest cameo card
  const handleAddGuestCard = () => {
    const newCardId = `guest_${Date.now()}`;
    const newCard: PreviewCard = {
      id: newCardId,
      title: `Guest Cameo ${cards.filter(c => c.cardType === 'guest').length + 1}`,
      content: "",
      order: cards.length,
      cardType: 'guest',
      guestCategory: 'expert',
      guestName: "",
      guestRole: "",
      guestCompany: "",
      guestScript: "",
      guestProvider: 'heygen',
      guestStatus: 'idle',
    };
    const newCards = [...cards, newCard];
    setCards(newCards);
    cardsRef.current = newCards;
    performSave();
    toast({ 
      title: "Guest Cameo added", 
      description: "Add a short cameo from an expert, customer, or testimonial. Not your narrator." 
    });
  };
  
  // Add a CTA (Call to Action) card
  const handleAddCtaCard = () => {
    // Check if there's already a CTA card
    const existingCta = cards.find(c => c.cardType === 'cta');
    if (existingCta) {
      toast({ 
        title: "CTA card already exists", 
        description: "You can only have one Call to Action card per experience.", 
        variant: "destructive" 
      });
      return;
    }
    
    const newCardId = `cta_${Date.now()}`;
    const newCard: PreviewCard = {
      id: newCardId,
      title: "Call to Action",
      content: "",
      order: cards.length,
      cardType: 'cta',
      ctaHeadline: "Ready to learn more?",
      ctaButtonLabel: "Visit Website",
      ctaUrl: "https://",
      ctaSubtext: "",
    };
    const newCards = [...cards, newCard];
    setCards(newCards);
    cardsRef.current = newCards;
    performSave();
    toast({ 
      title: "CTA card added", 
      description: "Configure your call-to-action button to drive viewers to your website." 
    });
  };

  // Delete a card
  const handleDeleteCard = (cardId: string) => {
    if (cards.length <= 1) {
      toast({ title: "Cannot delete", description: "You must have at least one card.", variant: "destructive" });
      return;
    }
    const newCards = cards.filter(c => c.id !== cardId);
    newCards.forEach((card, i) => card.order = i);
    setCards(newCards);
    cardsRef.current = newCards;
    
    // Also update interactivity nodes to adjust indices
    setInteractivityNodes(nodes => 
      nodes.filter(n => n.afterCardIndex < newCards.length - 1)
           .map(n => ({ ...n, afterCardIndex: Math.min(n.afterCardIndex, newCards.length - 2) }))
    );
    
    performSave();
    toast({ title: "Card deleted", description: "Card removed from your experience." });
  };

  // Move a card up in the order
  const handleMoveCardUp = (cardIndex: number) => {
    if (cardIndex <= 0) return;
    const newCards = [...cards];
    [newCards[cardIndex - 1], newCards[cardIndex]] = [newCards[cardIndex], newCards[cardIndex - 1]];
    newCards.forEach((card, i) => card.order = i);
    setCards(newCards);
    cardsRef.current = newCards;
    performSave();
  };

  // Move a card down in the order
  const handleMoveCardDown = (cardIndex: number) => {
    if (cardIndex >= cards.length - 1) return;
    const newCards = [...cards];
    [newCards[cardIndex], newCards[cardIndex + 1]] = [newCards[cardIndex + 1], newCards[cardIndex]];
    newCards.forEach((card, i) => card.order = i);
    setCards(newCards);
    cardsRef.current = newCards;
    performSave();
  };

  // Get cards that need images (have content but no image)
  const cardsNeedingImages = cards.filter(card => !card.generatedImageUrl);
  
  // Get cards that need videos (have image but no video)
  const cardsNeedingVideos = cards.filter(card => card.generatedImageUrl && !card.generatedVideoUrl);
  
  // Bulk generate all images
  const handleBulkGenerateImages = async () => {
    if (!preview || !entitlements?.canGenerateImages) return;
    
    // Capture the list of cards needing images at the start
    const cardsToProcess = [...cardsNeedingImages];
    const totalCards = cardsToProcess.length;
    
    if (totalCards === 0) return;
    
    setShowBulkImageConfirm(false);
    setBulkGeneratingImages(true);
    setBulkProgress({ current: 0, total: totalCards });
    
    let successCount = 0;
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i];
      setBulkProgress({ current: i + 1, total: totalCards });
      
      try {
        const res = await fetch(`/api/ice/preview/${preview.id}/cards/${card.id}/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt: card.content }),
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.imageUrl) {
            // Only call saveCardsWithUpdates (which also updates state) - avoid double update
            saveCardsWithUpdates(card.id, { generatedImageUrl: data.imageUrl });
            successCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to generate image for card ${card.id}:`, error);
      }
    }
    
    setBulkGeneratingImages(false);
    toast({
      title: "Bulk image generation complete",
      description: `Generated ${successCount} of ${totalCards} images.`,
    });
  };
  
  // Bulk generate all videos
  const handleBulkGenerateVideos = async () => {
    if (!preview || !entitlements?.canGenerateVideos) return;
    
    // Capture the list of cards needing videos at the start
    const cardsToProcess = [...cardsNeedingVideos];
    const totalCards = cardsToProcess.length;
    
    if (totalCards === 0) return;
    
    setShowBulkVideoConfirm(false);
    setBulkGeneratingVideos(true);
    setBulkProgress({ current: 0, total: totalCards });
    
    let successCount = 0;
    for (let i = 0; i < cardsToProcess.length; i++) {
      const card = cardsToProcess[i];
      setBulkProgress({ current: i + 1, total: totalCards });
      
      try {
        const res = await fetch(`/api/ice/preview/${preview.id}/cards/${card.id}/generate-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            mode: "image-to-video",
            sourceImageUrl: card.generatedImageUrl,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          // Update card with video status immediately
          if (data.status) {
            saveCardsWithUpdates(card.id, { videoGenerationStatus: data.status });
          }
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to start video for card ${card.id}:`, error);
      }
    }
    
    setBulkGeneratingVideos(false);
    toast({
      title: "Video generation started",
      description: `Started generating ${successCount} videos. Check back in a few minutes.`,
    });
  };

  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <GlobalNav context="ice" showBreadcrumb breadcrumbLabel="ICE Maker" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white/50">Loading your preview...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <GlobalNav context="ice" showBreadcrumb breadcrumbLabel="ICE Maker" />
      
      {/* Free Pass Banner */}
      {user?.freePassExpiresAt && new Date(user.freePassExpiresAt) > new Date() && (
        <div className="container mx-auto px-4 pt-4 max-w-4xl">
          <FreePassBanner expiresAt={user.freePassExpiresAt} />
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        {/* Compact header - only show for creation mode */}
        {!preview && (
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Turn material into a <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">thinking experience</span>
            </h1>
            <p className="text-white/50 text-sm max-w-xl mx-auto">
              Upload your framework, model, or case study. IceMaker builds a guided experience that challenges, prompts, and remembers.
            </p>
          </div>
        )}

        {!preview ? (
          <UiCard className="bg-white/[0.03] border-white/10">
            <CardContent className="p-6">
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as "url" | "text" | "file")}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="url" className="flex items-center gap-2" data-testid="tab-url">
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">Website</span> URL
                  </TabsTrigger>
                  <TabsTrigger value="file" className="flex items-center gap-2" data-testid="tab-file">
                    <Upload className="w-4 h-4" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2" data-testid="tab-text">
                    <FileText className="w-4 h-4" />
                    Paste
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url">
                  <div className="space-y-4">
                    <Input
                      placeholder="example.com or https://example.com/about"
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      className="bg-white/5 border-white/10"
                      data-testid="input-url"
                    />
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-white/50 self-center mr-2">Context:</span>
                      {[
                        { id: "auto", label: "Auto-detect", icon: Sparkles },
                        { id: "ld_framework", label: "L&D Framework", icon: GraduationCap },
                        { id: "case_study", label: "Case Study", icon: FileText },
                        { id: "program_notes", label: "Program Notes", icon: ScrollText },
                      ].map((ctx) => (
                        <button
                          key={ctx.id}
                          type="button"
                          onClick={() => setContentContext(ctx.id as any)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                            contentContext === ctx.id
                              ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300"
                              : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                          }`}
                          data-testid={`context-${ctx.id}`}
                        >
                          <ctx.icon className="w-3.5 h-3.5" />
                          {ctx.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-white/40">
                      Enter a website URL and we'll extract key content. Choose a content type for best results.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="file">
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-blue-500/50 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.pptx,.ppt,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        data-testid="input-file"
                      />
                      <Upload className="w-10 h-10 text-white/40 mx-auto mb-3" />
                      {selectedFile ? (
                        <p className="text-white font-medium">{selectedFile.name}</p>
                      ) : (
                        <>
                          <p className="text-white/70 mb-1">Click to upload a file</p>
                          <p className="text-sm text-white/40">PDF, PowerPoint, Word, or Text files</p>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-white/40">
                      Upload a PDF, presentation, or document. We'll extract the content to create your story.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="text">
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Paste your script, story outline, or any content here..."
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      rows={8}
                      className="bg-white/5 border-white/10"
                      data-testid="input-text"
                    />
                    <p className="text-sm text-white/40">
                      Paste a script, article, or story outline. We'll break it into story cards.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {(createPreviewMutation.isPending || isFileUploading) && currentStage >= 0 ? (
                <div className="mt-6 space-y-4" data-testid="creation-stages">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-white mb-1">Creating Your Experience</h3>
                    <p className="text-sm text-white/50">This usually takes 10-15 seconds</p>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {CREATION_STAGES.map((stage, index) => {
                        const status = index < currentStage ? "done" : index === currentStage ? "running" : "pending";
                        return (
                          <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                              status === "done" ? "bg-green-500/10" :
                              status === "running" ? "bg-blue-500/20" : "bg-white/5"
                            }`}
                            data-testid={`stage-${stage.id}`}
                          >
                            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                              status === "done" ? "bg-green-500" :
                              status === "running" ? "bg-blue-500" : "bg-white/20"
                            }`}>
                              {status === "done" ? (
                                <Check className="w-4 h-4 text-white" />
                              ) : status === "running" ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              ) : (
                                <Circle className="w-3 h-3 text-white/30" />
                              )}
                            </div>
                            <span className={`text-sm ${
                              status === "done" ? "text-green-400" :
                              status === "running" ? "text-blue-300 font-medium" : "text-white/40"
                            }`}>
                              {stage.label}
                            </span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleSubmit}
                    disabled={createPreviewMutation.isPending || isFileUploading}
                    className="w-full mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                    data-testid="button-create-preview"
                  >
                    Create Preview
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <div className="mt-4 pt-4 border-t border-white/10 text-center space-y-3">
                    <div>
                      <p className="text-xs text-white/40 mb-1">Want to design from scratch?</p>
                      <Link 
                        href="/create" 
                        className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        data-testid="link-creation-wizard"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Use the ICE Wizard
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs text-white/40 mb-1">Have a producer brief or spec document?</p>
                      <Link 
                        href="/create" 
                        className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/80 transition-colors"
                        data-testid="link-producer-brief"
                      >
                        <ScrollText className="w-3.5 h-3.5" />
                        Upload Producer Brief
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </UiCard>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6">
            {/* Main content column */}
            <div className="space-y-4 sm:space-y-6">
            {/* Mobile-optimized header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-semibold text-white truncate">{preview.title}</h2>
                  <VisibilityBadge visibility={((existingPreview as any)?.visibility as "private" | "unlisted" | "public") || "unlisted"} size="sm" />
                </div>
                <p className="text-xs sm:text-sm text-white/50 mt-1">
                  <Film className="w-3 h-3 inline mr-1" />
                  {cards.length} story cards
                  {preview.sourceType === "insight" && (() => {
                    try {
                      const origin: InsightOrigin = JSON.parse(preview.sourceValue);
                      return (
                        <span className="ml-2">
                          <span className="text-white/30">•</span>
                          <button
                            onClick={() => navigate(`/launchpad?orbit=${origin.businessSlug}&insight=${origin.insightId}`)}
                            className="ml-2 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                            data-testid="link-origin-insight"
                          >
                            Made from insight
                          </button>
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    document.getElementById('story-cards-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex-1 sm:flex-none gap-1.5 border-white/20 text-white/80 hover:bg-white/5"
                  data-testid="button-jump-to-cards"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden xs:inline">Edit Cards</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreviewCardIndex(0);
                    setShowPreviewModal(true);
                  }}
                  className="flex-1 sm:flex-none gap-1.5 bg-cyan-600 hover:bg-cyan-700 border-cyan-500 text-white"
                  data-testid="button-preview-experience"
                >
                  <Play className="w-4 h-4" />
                  <span className="hidden xs:inline">Play</span>
                </Button>
                {/* Desktop-only quick preview button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviewDrawerCardIndex(0);
                    setShowPreviewDrawer(true);
                  }}
                  className="hidden lg:flex gap-1.5"
                  data-testid="button-preview-drawer"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPreview(null);
                    setCards([]);
                    setUrlValue("");
                    setTextValue("");
                    setSelectedFile(null);
                  }}
                  className="flex-1 sm:flex-none"
                  data-testid="button-start-over"
                >
                  Start Over
                </Button>
              </div>
            </div>
            
            {/* Upgrade prompt banner - only for free users */}
            {!isProfessionalMode && (
              <div className="bg-white/[0.03] border border-cyan-500/30 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="font-semibold text-white text-sm">Ready to bring this to life?</span>
                    </div>
                    <p className="text-xs text-white/50">
                      Add AI-generated visuals, video, music, and interactive character conversations.
                    </p>
                  </div>
                <Link href={`/ice/preview/${preview.id}/checkout`}>
                  <Button
                    className="bg-cyan-600 hover:bg-cyan-700 text-sm whitespace-nowrap"
                    size="sm"
                    data-testid="button-upgrade-preview"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    Upgrade
                  </Button>
                </Link>
                </div>
              </div>
            )}

            {/* Edit hint banner */}
            <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-white/60">
                <span className="font-medium text-white/80">Tap any card</span> to edit content and generate AI media.
              </p>
            </div>

            {/* Professional Tools Bar - always visible for professional users */}
            {isProfessionalMode && (
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 border-b border-white/10 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Video Export Button - Coming Soon */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportComingSoon(true)}
                  className="gap-1.5 border-white/20 text-white/70 hover:bg-white/5 shrink-0 whitespace-nowrap"
                  data-testid="button-export-video"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Video
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPublishModal(true)}
                  disabled={cards.length === 0}
                  className={`gap-1.5 shrink-0 whitespace-nowrap ${
                    iceVisibility === "public" 
                      ? "border-green-500/40 text-green-400 hover:bg-green-500/10" 
                      : iceVisibility === "unlisted"
                      ? "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                      : "border-white/20 text-white/70 hover:bg-white/5"
                  }`}
                  data-testid="button-publish"
                >
                  {iceVisibility === "public" ? (
                    <Globe className="w-3.5 h-3.5" />
                  ) : iceVisibility === "unlisted" ? (
                    <Share2 className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  {iceVisibility === "public" ? "Public" : iceVisibility === "unlisted" ? "Shared" : "Publish"}
                </Button>
                
                {/* Share button - only shows when ICE is published */}
                {(iceVisibility === "public" || iceVisibility === "unlisted") && shareSlug && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/ice/${shareSlug}`;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Link copied!", description: shareUrl });
                      } catch {
                        toast({ title: "Share link", description: shareUrl });
                      }
                    }}
                    className="gap-1.5 shrink-0 whitespace-nowrap bg-cyan-600 hover:bg-cyan-500 text-white border-none"
                    data-testid="button-copy-share-link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStoryStructure(true)}
                  className="gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 shrink-0 whitespace-nowrap"
                  data-testid="button-story-structure"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Story Tips
                </Button>

                <Sheet open={showBiblePanel} onOpenChange={setShowBiblePanel}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-white/20 text-white/70 hover:bg-white/5 shrink-0 whitespace-nowrap"
                      data-testid="button-open-bible"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Project Bible
                      {projectBible && (
                        <span className="ml-1 bg-cyan-500/30 text-cyan-200 px-1.5 rounded text-xs">v{projectBible.version}</span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[450px] bg-zinc-950 border-zinc-800 overflow-hidden flex flex-col">
                    <SheetHeader>
                      <SheetTitle className="text-white">Project Bible</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden">
                      <ContinuityPanel
                        previewId={preview?.id || ""}
                        bible={projectBible}
                        onBibleChange={handleBibleChange}
                        onGenerate={handleGenerateBible}
                        isGenerating={bibleGenerating}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}

            {/* Bulk AI Image Generation - clearly separated section */}
            {isProfessionalMode && entitlements && cardsNeedingImages.length > 0 && entitlements.canGenerateImages && (
              <div className="lg:hidden bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Image className="w-4 h-4 text-cyan-400" />
                      Generate All Images
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      {cardsNeedingImages.length} cards need images
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowBulkImageConfirm(true)}
                    disabled={bulkGeneratingImages}
                    size="sm"
                    className="gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white"
                    data-testid="button-bulk-generate-images"
                  >
                    {bulkGeneratingImages ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating {bulkProgress.current}/{bulkProgress.total}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate {cardsNeedingImages.length} Images
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Bulk AI Video Generation - clearly separated section */}
            {isProfessionalMode && entitlements && cardsNeedingVideos.length > 0 && entitlements.canGenerateVideos && (
              <div className="lg:hidden bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-purple-400" />
                      Generate All Videos
                    </h3>
                    <p className="text-xs text-white/50 mt-0.5">
                      {cardsNeedingVideos.length} cards ready for video
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowBulkVideoConfirm(true)}
                    disabled={bulkGeneratingVideos}
                    size="sm"
                    className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
                    data-testid="button-bulk-generate-videos"
                  >
                    {bulkGeneratingVideos ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Starting {bulkProgress.current}/{bulkProgress.total}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        Generate {cardsNeedingVideos.length} Videos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Music Panel - hidden on desktop (in sidebar) */}
            <div className="lg:hidden bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Music Selector */}
                <div className="flex-1">
                  <label className="text-xs text-white/60 mb-1.5 block">Background Music</label>
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                    <Music className="w-4 h-4 text-blue-400 shrink-0" />
                    <select
                      value={musicTrackUrl || "none"}
                      onChange={(e) => {
                        const track = MUSIC_TRACKS.find(t => (t.url || "none") === e.target.value);
                        setMusicTrackUrl(track?.url || null);
                        setMusicEnabled(!!track?.url);
                      }}
                      className="flex-1 bg-transparent text-sm text-white border-none outline-none cursor-pointer"
                      data-testid="select-music-track-editor"
                    >
                      <option value="none" className="bg-slate-900 text-white">No Music</option>
                      <optgroup label="Chill & Ambient" className="bg-slate-900 text-white">
                        {MUSIC_TRACKS.filter(t => t.category === "chill").map((track) => (
                          <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                            {track.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Vlog & Upbeat" className="bg-slate-900 text-white">
                        {MUSIC_TRACKS.filter(t => t.category === "vlog").map((track) => (
                          <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                            {track.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Pop & Modern" className="bg-slate-900 text-white">
                        {MUSIC_TRACKS.filter(t => t.category === "pop").map((track) => (
                          <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                            {track.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Cinematic & Epic" className="bg-slate-900 text-white">
                        {MUSIC_TRACKS.filter(t => t.category === "cinematic").map((track) => (
                          <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                            {track.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {musicTrackUrl && (
                      <button
                        onClick={toggleMusicPreview}
                        className={`p-1.5 rounded-full transition-all ${
                          isPreviewingMusic 
                            ? "bg-blue-500/30 text-blue-300" 
                            : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                        }`}
                        title={isPreviewingMusic ? "Stop preview" : "Preview music"}
                        data-testid="button-preview-music"
                      >
                        {isPreviewingMusic ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">
                    {isPreviewingMusic 
                      ? "Playing preview..." 
                      : musicEnabled 
                        ? "Click play to preview before applying" 
                        : "No background music"}
                  </p>
                </div>

                {/* Music Volume (when music enabled) */}
                {musicEnabled && (
                  <div className="sm:w-28">
                    <label className="text-xs text-white/60 mb-1.5 block flex items-center gap-1">
                      <Music className="w-3 h-3" /> Music
                    </label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[musicVolume]}
                        onValueChange={([v]) => setMusicVolume(v)}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                        data-testid="slider-music-volume-editor"
                      />
                      <span className="text-xs text-white/50 w-8">{musicVolume}%</span>
                    </div>
                  </div>
                )}
                
                {/* Narration Volume */}
                <div className="sm:w-28">
                  <label className="text-xs text-white/60 mb-1.5 block flex items-center gap-1">
                    <Mic className="w-3 h-3" /> Narration
                  </label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[narrationVolume]}
                      onValueChange={([v]) => setNarrationVolume(v)}
                      min={0}
                      max={100}
                      step={5}
                      className="flex-1"
                      data-testid="slider-narration-volume-editor"
                    />
                    <span className="text-xs text-white/50 w-8">{narrationVolume}%</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <EnterpriseBrandingUpsell context="audio" variant="compact" />
              </div>
            </div>

            {/* Logo Branding Panel - hidden on desktop (in sidebar) */}
            <div className="lg:hidden bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Logo Upload Section */}
                <div className="flex-1">
                  <label className="text-xs text-white/60 mb-1.5 block">Logo Branding</label>
                  <div className="flex items-center gap-3">
                    {/* Logo Preview / Upload Button */}
                    {logoUrl ? (
                      <div className="relative group">
                        <div className="w-12 h-12 rounded-lg bg-black/30 border border-white/10 overflow-hidden flex items-center justify-center">
                          <img 
                            src={logoUrl} 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          onClick={() => {
                            setLogoUrl(null);
                            setLogoEnabled(false);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid="button-remove-logo"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo || !user}
                        className="w-12 h-12 rounded-lg bg-black/30 border border-dashed border-white/20 flex items-center justify-center hover:border-cyan-500/50 transition-colors disabled:opacity-50"
                        data-testid="button-upload-logo"
                      >
                        {isUploadingLogo ? (
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 text-white/40" />
                        )}
                      </button>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                    
                    {/* Enable/Disable Toggle */}
                    {logoUrl && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={logoEnabled}
                          onChange={(e) => setLogoEnabled(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-9 h-5 rounded-full transition-colors ${logoEnabled ? "bg-cyan-500" : "bg-white/20"}`}>
                          <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${logoEnabled ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-xs text-white/60">{logoEnabled ? "Showing" : "Hidden"}</span>
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">
                    {logoUrl ? (logoEnabled ? "Logo appears on all cards" : "Logo hidden") : "Upload your logo to brand your content"}
                  </p>
                </div>

                {/* Logo Position Selector */}
                {logoUrl && logoEnabled && (
                  <div className="sm:w-32">
                    <label className="text-xs text-white/60 mb-1.5 block flex items-center gap-1">
                      <Image className="w-3 h-3" /> Position
                    </label>
                    <select
                      value={logoPosition}
                      onChange={(e) => setLogoPosition(e.target.value as typeof logoPosition)}
                      className="w-full bg-black/30 text-sm text-white border border-white/10 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                      data-testid="select-logo-position"
                    >
                      <option value="top-left" className="bg-slate-900">Top Left</option>
                      <option value="top-right" className="bg-slate-900">Top Right</option>
                      <option value="bottom-left" className="bg-slate-900">Bottom Left</option>
                      <option value="bottom-right" className="bg-slate-900">Bottom Right</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <EnterpriseBrandingUpsell context="assets" variant="compact" />
              </div>
            </div>

            {/* Advanced Caption Settings - hidden on desktop (in sidebar) */}
            <Collapsible open={showCaptionSettings} onOpenChange={setShowCaptionSettings} className="lg:hidden mb-4">
              <CollapsibleTrigger asChild>
                <button 
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.05] transition-colors"
                  data-testid="button-toggle-caption-settings"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Advanced Caption Settings</span>
                    <span className="text-xs text-white/50 ml-2">
                      {captionState.karaokeEnabled ? "Karaoke On" : ""} 
                      {captionState.animationId !== "none" ? ` • ${captionState.animationId}` : ""}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showCaptionSettings ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
                  <CaptionStylePicker
                    captionState={captionState}
                    onStateChange={setCaptionState}
                  />
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <EnterpriseBrandingUpsell context="captions" variant="compact" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Story Cards Section Header */}
            <div id="story-cards-section" className="scroll-mt-24">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Film className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Story Cards</h3>
                    <p className="text-xs text-white/50">{cards.length} cards to edit</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedCardIndex(expandedCardIndex === null ? 0 : null)}
                  className="text-white/60 hover:text-white"
                  data-testid="button-expand-collapse-all"
                >
                  {expandedCardIndex !== null ? "Collapse" : "Expand First"}
                </Button>
              </div>
            </div>

            {/* Professional ICE Editor cards */}
            <div className="space-y-3">
              {cards.map((card, index) => {
                const nodeAtPosition = interactivityNodes.find(n => n.afterCardIndex === index);
                
                return (
                  <div key={card.id}>
                    <IceCardEditor
                      previewId={preview?.id || ""}
                      card={card}
                      cardIndex={index}
                      totalCards={cards.length}
                      entitlements={entitlements || null}
                      isExpanded={expandedCardIndex === index}
                      onToggleExpand={() => setExpandedCardIndex(expandedCardIndex === index ? null : index)}
                      onCardUpdate={handleCardUpdate}
                      onCardSave={saveCardsWithUpdates}
                      onUpgradeClick={() => setShowUpgradeModal(true)}
                      onMoveUp={() => handleMoveCardUp(index)}
                      onMoveDown={() => handleMoveCardDown(index)}
                      onDelete={() => handleDeleteCard(card.id)}
                      hasLockedScene={projectBible?.scene?.enabled || false}
                    />
                    
                    {/* Interactivity node slot between cards */}
                    {index < cards.length - 1 && (
                      <div className="py-1">
                        {nodeAtPosition ? (
                          <InteractivityNode
                            nodeId={nodeAtPosition.id}
                            afterCardIndex={index}
                            previewId={preview?.id || ""}
                            previewAccessToken={previewAccessToken}
                            isActive={nodeAtPosition.isActive}
                            characters={preview?.characters || []}
                            selectedCharacterId={nodeAtPosition.selectedCharacterId}
                            onCharacterSelect={(charId) => {
                              setInteractivityNodes(nodes =>
                                nodes.map(n =>
                                  n.id === nodeAtPosition.id
                                    ? { ...n, selectedCharacterId: charId }
                                    : n
                                )
                              );
                            }}
                            onActivate={() => {
                              setInteractivityNodes(nodes =>
                                nodes.map(n =>
                                  n.id === nodeAtPosition.id
                                    ? { ...n, isActive: !n.isActive }
                                    : n
                                )
                              );
                            }}
                            onRemove={() => {
                              setInteractivityNodes(nodes =>
                                nodes.filter(n => n.id !== nodeAtPosition.id)
                              );
                            }}
                          />
                        ) : (
                          <AddInteractivityButton
                            afterCardIndex={index}
                            characters={preview?.characters || []}
                            previewId={preview?.id}
                            onCharacterSelect={(charId) => {
                              const newNode: InteractivityNodeData = {
                                id: `node-${Date.now()}-${index}`,
                                afterCardIndex: index,
                                isActive: false,
                                selectedCharacterId: charId,
                              };
                              setInteractivityNodes(nodes => [...nodes, newNode]);
                            }}
                            onCharacterCreated={(newChar) => {
                              if (preview) {
                                setPreview({
                                  ...preview,
                                  characters: [...(preview.characters || []), newChar],
                                });
                              }
                            }}
                            onAdd={() => {
                              const chars = preview?.characters || [];
                              const newNode: InteractivityNodeData = {
                                id: `node-${Date.now()}-${index}`,
                                afterCardIndex: index,
                                isActive: false,
                                selectedCharacterId: chars.length > 0 ? chars[0].id : undefined,
                              };
                              setInteractivityNodes(nodes => [...nodes, newNode]);
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Add New Card buttons */}
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={handleAddCard}
                  className="flex-1 border-dashed border-cyan-500/30 text-cyan-300"
                  data-testid="button-add-new-card"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddGuestCard}
                  className="flex-1 border-dashed border-amber-500/30 text-amber-300"
                  data-testid="button-add-guest-cameo"
                >
                  <User className="w-4 h-4 mr-2" />
                  Guest Cameo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddCtaCard}
                  className="flex-1 border-dashed border-green-500/30 text-green-300"
                  data-testid="button-add-cta-card"
                  disabled={cards.some(c => c.cardType === 'cta')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Call to Action
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Guest cameos are short cutaway clips. CTA cards display a clickable button to drive traffic.
              </p>
            </div>

            {/* Unlock Premium Features - only show for non-Pro users */}
            {!isProfessionalMode && (
              <UiCard className="bg-white/[0.03] border-white/10 border-dashed">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 lg:hidden">Unlock Premium Features</h3>
                  <h3 className="text-lg font-semibold text-white mb-4 hidden lg:block">Unlock Premium</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                      <Image className="w-6 h-6 text-cyan-400 mb-2" />
                      <span className="text-sm text-white/70">AI Images</span>
                      <Lock className="w-3 h-3 text-white/40 mt-1" />
                    </div>
                    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                      <Play className="w-6 h-6 text-cyan-400 mb-2" />
                      <span className="text-sm text-white/70">Video</span>
                      <Lock className="w-3 h-3 text-white/40 mt-1" />
                    </div>
                    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                      <Mic className="w-6 h-6 text-cyan-400 mb-2" />
                      <span className="text-sm text-white/70">Narration</span>
                      <Lock className="w-3 h-3 text-white/40 mt-1" />
                    </div>
                    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                      <Sparkles className="w-6 h-6 text-cyan-400 mb-2" />
                      <span className="text-sm text-white/70">Export</span>
                      <Lock className="w-3 h-3 text-white/40 mt-1" />
                    </div>
                  </div>

                  {user ? (
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          navigate(`/ice/preview/${preview?.id}/checkout`);
                        }}
                        className="w-full bg-cyan-600 hover:bg-cyan-700"
                        data-testid="button-upgrade-to-pro"
                      >
                        Upgrade to Unlock
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <p className="text-xs text-center text-white/40">
                        Your progress is saved. Pay to unlock AI media and publishing.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          const returnUrl = preview ? `/ice/preview/${preview.id}` : "/try";
                          navigate(`/login?return=${encodeURIComponent(returnUrl)}`);
                        }}
                        className="w-full bg-cyan-600 hover:bg-cyan-700"
                        data-testid="button-sign-in-to-save"
                      >
                        Sign In to Save Progress
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <p className="text-xs text-center text-white/40">
                        Create an account to save your work. Payment unlocks premium features.
                      </p>
                    </div>
                  )}
                </CardContent>
              </UiCard>
            )}
            </div>
            
            {/* Desktop sidebar - hidden on mobile, visible on lg+ */}
            <div className="hidden lg:block">
              <BuilderActionsSidebar
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                isProfessionalMode={isProfessionalMode || false}
                musicTracks={MUSIC_TRACKS}
                musicTrackUrl={musicTrackUrl}
                setMusicTrackUrl={setMusicTrackUrl}
                musicEnabled={musicEnabled}
                setMusicEnabled={setMusicEnabled}
                musicVolume={musicVolume}
                setMusicVolume={setMusicVolume}
                isPreviewingMusic={isPreviewingMusic}
                toggleMusicPreview={toggleMusicPreview}
                narrationVolume={narrationVolume}
                setNarrationVolume={setNarrationVolume}
                logoUrl={logoUrl}
                setLogoUrl={setLogoUrl}
                logoEnabled={logoEnabled}
                setLogoEnabled={setLogoEnabled}
                logoPosition={logoPosition}
                setLogoPosition={setLogoPosition}
                isUploadingLogo={isUploadingLogo}
                handleLogoUpload={handleLogoUpload}
                logoInputRef={logoInputRef}
                user={user}
                captionState={captionState}
                setCaptionState={setCaptionState}
                cardsNeedingImages={cardsNeedingImages}
                cardsNeedingVideos={cardsNeedingVideos}
                entitlements={entitlements}
                bulkGeneratingImages={bulkGeneratingImages}
                bulkGeneratingVideos={bulkGeneratingVideos}
                bulkProgress={bulkProgress}
                setShowBulkImageConfirm={setShowBulkImageConfirm}
                setShowBulkVideoConfirm={setShowBulkVideoConfirm}
                exportStatus={exportStatus}
                exportMutation={exportMutation}
                cardsLength={cards.length}
                iceVisibility={iceVisibility}
                setShowPublishModal={setShowPublishModal}
                setShowStoryStructure={setShowStoryStructure}
                showBiblePanel={showBiblePanel}
                setShowBiblePanel={setShowBiblePanel}
                projectBible={projectBible}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Desktop Preview Drawer */}
      <BuilderPreviewDrawer
        isOpen={showPreviewDrawer}
        onClose={() => setShowPreviewDrawer(false)}
        selectedCard={previewDrawerCardIndex !== null ? cards[previewDrawerCardIndex] : null}
        cardIndex={previewDrawerCardIndex || 0}
        totalCards={cards.length}
        onPlayPreview={() => {
          if (previewDrawerCardIndex !== null) {
            setPreviewCardIndex(previewDrawerCardIndex);
            setShowPreviewModal(true);
            setShowPreviewDrawer(false);
          }
        }}
      />

      {/* Full-screen Preview Modal - Uses real CardPlayer */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPreviewModal(false)}
            className="absolute top-4 right-4 z-[60] text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur"
            data-testid="button-close-preview"
          >
            <X className="w-5 h-5" />
          </Button>
          
          {/* Card navigation */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-black/50 backdrop-blur rounded-full px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleManualNav(Math.max(0, previewCardIndex - 1))}
              disabled={previewCardIndex === 0}
              className="text-white/60 hover:text-white h-8 px-2"
              data-testid="button-preview-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            {/* Card counter with dropdown for quick navigation */}
            <div className="relative group">
              <button 
                className="text-white/80 hover:text-white text-sm font-medium px-3 py-1 rounded hover:bg-white/10 transition-colors min-w-[80px]"
                data-testid="button-card-counter"
              >
                {previewCardIndex + 1} / {cards.length}
              </button>
              
              {/* Dropdown for jumping to any card */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                <div className="bg-black/90 backdrop-blur rounded-lg p-2 max-h-64 overflow-y-auto shadow-xl border border-white/10">
                  <div className="grid gap-1" style={{ gridTemplateColumns: cards.length > 20 ? 'repeat(5, 1fr)' : cards.length > 10 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)' }}>
                    {cards.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleManualNav(idx)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                          idx === previewCardIndex
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        }`}
                        title={card.title || `Card ${idx + 1}`}
                        data-testid={`button-jump-card-${idx}`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleManualNav(Math.min(cards.length - 1, previewCardIndex + 1))}
              disabled={previewCardIndex === cards.length - 1}
              className="text-white/60 hover:text-white h-8 px-2"
              data-testid="button-preview-next"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Actual CardPlayer - the real cinematic experience */}
          <AnimatePresence mode="wait">
            {cards[previewCardIndex] && (
              <motion.div
                key={previewCardIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full"
              >
                <CardPlayer
                  card={{
                    id: cards[previewCardIndex].id,
                    title: cards[previewCardIndex].title,
                    image: cards[previewCardIndex].generatedImageUrl || previewCardBackground,
                    generatedVideoUrl: cards[previewCardIndex].generatedVideoUrl,
                    videoGenerated: !!cards[previewCardIndex].generatedVideoUrl,
                    videoGenerationStatus: cards[previewCardIndex].videoGenerationStatus || (cards[previewCardIndex].generatedVideoUrl ? "completed" : undefined),
                    mediaAssets: (cards[previewCardIndex] as any).mediaAssets,
                    selectedMediaAssetId: (cards[previewCardIndex] as any).selectedMediaAssetId,
                    captions: cards[previewCardIndex].content.split('. ').filter(s => s.trim()),
                    captionTimings: (cards[previewCardIndex] as any).captionTimings,
                    sceneText: cards[previewCardIndex].content,
                    recapText: cards[previewCardIndex].title,
                    publishDate: new Date().toISOString(),
                    narrationEnabled: !!cards[previewCardIndex].narrationAudioUrl,
                    narrationStatus: cards[previewCardIndex].narrationAudioUrl ? "ready" : undefined,
                    narrationAudioUrl: cards[previewCardIndex].narrationAudioUrl,
                  }}
                  autoplay={true}
                  fullScreen={true}
                  captionState={captionState}
                  narrationVolume={narrationVolume}
                  narrationMuted={narrationMuted}
                  showPlaceholderOverlay={!cards[previewCardIndex].generatedImageUrl && !cards[previewCardIndex].generatedVideoUrl}
                  icePreviewId={preview?.id}
                  logoEnabled={logoEnabled}
                  logoUrl={logoUrl}
                  logoPosition={logoPosition}
                  onPhaseChange={(phase) => {
                    if (phase === 'context') {
                      handleCardPhaseComplete();
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Interactivity Chat Overlay - appears when AI character interaction is active */}
          <AnimatePresence>
            {activePreviewNodeIndex !== null && (() => {
              const activeNode = interactivityNodes.find(n => n.afterCardIndex === activePreviewNodeIndex);
              // Prefer selected character, then primary/brief character, then first character
              let character = preview?.characters?.find(c => c.id === activeNode?.selectedCharacterId);
              if (!character && preview?.characters) {
                character = preview.characters.find(c => (c as any).isPrimary)
                  || preview.characters.find(c => (c as any).source === 'brief')
                  || preview.characters[0];
              }
              
              return (
                <motion.div
                  key="interactivity-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[65] bg-gradient-to-b from-black/95 via-black/90 to-slate-950/90 backdrop-blur-md flex flex-col"
                >
                  {/* Safe area padding for mobile */}
                  <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pt-12 pb-4 h-full overflow-hidden">
                    <PreviewChatPanel
                      previewId={preview?.id || ""}
                      previewAccessToken={previewAccessToken}
                      character={character}
                      onContinue={handleContinueFromInteractivity}
                    />
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
          
          {/* Top controls bar - mobile optimized (volume only during preview) */}
          <div className="absolute top-4 left-4 right-14 z-[60] flex items-center gap-2">
            {/* Volume controls - only show when music enabled or narration exists */}
            {(musicEnabled || cards.some(c => c.narrationAudioUrl)) && (
              <div className="bg-black/50 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-3 w-fit">
                {/* Music volume */}
                {musicEnabled && (
                  <div className="flex items-center gap-2">
                    <Music className="w-3 h-3 text-blue-400" />
                    <Slider
                      value={[musicVolume]}
                      onValueChange={([v]) => setMusicVolume(v)}
                      min={0}
                      max={100}
                      step={5}
                      className="w-16"
                      data-testid="slider-music-volume"
                    />
                    <span className="text-[9px] text-white/40 w-6">{musicVolume}%</span>
                  </div>
                )}
                
                {/* Narration volume */}
                {cards.some(c => c.narrationAudioUrl) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNarrationMuted(prev => !prev)}
                      className={`transition-all ${narrationMuted ? "text-white/40" : "text-cyan-400"}`}
                      title={narrationMuted ? "Unmute narration" : "Mute narration"}
                      data-testid="button-toggle-narration"
                    >
                      {narrationMuted ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                    <Slider
                      value={[narrationMuted ? 0 : narrationVolume]}
                      onValueChange={([v]) => {
                        setNarrationVolume(v);
                        if (v > 0) setNarrationMuted(false);
                      }}
                      min={0}
                      max={100}
                      step={5}
                      className="w-16"
                      data-testid="slider-narration-volume"
                    />
                    <span className="text-[9px] text-white/40 w-6">{narrationMuted ? 0 : narrationVolume}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Guided first-run walkthrough */}
      <AnimatePresence>
        {showWalkthrough && (
          <GuidedWalkthrough
            onComplete={markWalkthroughSeen}
            onSkip={markWalkthroughSeen}
          />
        )}
      </AnimatePresence>
      
      {/* Story Structure Overlay */}
      <AnimatePresence>
        {showStoryStructure && (
          <StoryStructureOverlay
            onClose={() => setShowStoryStructure(false)}
            totalCards={cards.length}
          />
        )}
      </AnimatePresence>
      
      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="AI Media Generation"
        reason="Unlock AI-powered image and video generation, character interactions, voiceover narration, and more."
      />
      
      {/* Export Coming Soon Modal */}
      <Dialog open={showExportComingSoon} onOpenChange={setShowExportComingSoon}>
        <DialogContent className="max-w-md bg-slate-900 border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Download className="w-5 h-5 text-cyan-400" />
              Video Export Coming Soon
            </DialogTitle>
            <DialogDescription className="text-white/60">
              We're working on video export so you can download your ICE and post directly to TikTok, Instagram Reels, YouTube Shorts, and more.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">What's coming:</h4>
              <ul className="text-sm text-white/70 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Export your ICE as a shareable video file
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Optimized for TikTok, Instagram Reels, YouTube Shorts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  AI narration and captions included
                </li>
              </ul>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">Want viewers to experience AI interactions?</h4>
              <p className="text-sm text-white/60 mb-3">
                Publish and share your ICE link so viewers can enjoy the full interactive experience with AI character conversations.
              </p>
              <Button
                onClick={() => {
                  setShowExportComingSoon(false);
                  setShowPublishModal(true);
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                data-testid="button-goto-publish"
              >
                <Globe className="w-4 h-4 mr-2" />
                Publish & Share Instead
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setShowExportComingSoon(false)} 
              className="text-white/70"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Publish Modal */}
      {preview && (
        <PublishModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          previewId={preview.id}
          currentVisibility={iceVisibility}
          shareSlug={shareSlug}
          totalCards={cards.length}
          cardsWithMedia={cards.filter(c => c.generatedImageUrl || c.generatedVideoUrl || (c.mediaAssets && c.mediaAssets.length > 0)).length}
          onPublishComplete={(data) => {
            setIceVisibility(data.visibility);
            setShareSlug(data.shareSlug);
          }}
        />
      )}
      
      {/* Bulk Image Generation Confirmation Dialog */}
      <Dialog open={showBulkImageConfirm} onOpenChange={setShowBulkImageConfirm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Image className="w-5 h-5 text-cyan-400" />
              Review Prompts Before Generation
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {cardsNeedingImages.length} cards will have AI images generated. Review the prompts below:
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {cardsNeedingImages.map((card, index) => (
              <div key={card.id} className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-slate-400 bg-slate-700 px-2 py-1 rounded shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate">{card.title}</p>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-3">
                      {card.content || 'No content - will use default visual'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="ghost" onClick={() => setShowBulkImageConfirm(false)} className="text-white/70">
              Cancel
            </Button>
            <Button 
              onClick={handleBulkGenerateImages}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              data-testid="button-confirm-bulk-images"
            >
              <Image className="w-4 h-4 mr-2" />
              Generate {cardsNeedingImages.length} Images
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Video Generation Confirmation Dialog */}
      <Dialog open={showBulkVideoConfirm} onOpenChange={setShowBulkVideoConfirm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-blue-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Video className="w-5 h-5 text-blue-400" />
              Review Cards Before Video Generation
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {cardsNeedingVideos.length} cards will have AI videos generated from their images:
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {cardsNeedingVideos.map((card, index) => (
              <div key={card.id} className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-slate-400 bg-slate-700 px-2 py-1 rounded shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate">{card.title}</p>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                      {card.content || 'Cinematic motion from image'}
                    </p>
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Has source image
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="ghost" onClick={() => setShowBulkVideoConfirm(false)} className="text-white/70">
              Cancel
            </Button>
            <Button 
              onClick={handleBulkGenerateVideos}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-confirm-bulk-videos"
            >
              <Video className="w-4 h-4 mr-2" />
              Generate {cardsNeedingVideos.length} Videos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
