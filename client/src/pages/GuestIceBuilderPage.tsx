import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Sparkles, Globe, FileText, ArrowRight, Loader2, GripVertical, Lock, Play, Image, Mic, Upload, Check, Circle, Eye, Pencil, Film, X, ChevronLeft, ChevronRight, MessageCircle, Wand2, Video, Volume2, VolumeX, Music } from "lucide-react";
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
import { TITLE_PACKS, DEFAULT_TITLE_PACK_ID, getTitlePackById } from "@shared/titlePacks";
import type { Card } from "@/lib/mockData";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import previewCardBackground from "@assets/generated_images/minimal_sunset_with_top_silhouettes.png";
import { InteractivityNode, AddInteractivityButton, StoryCharacter } from "@/components/InteractivityNode";
import { GuidedWalkthrough } from "@/components/GuidedWalkthrough";
import { MediaGenerationPanel } from "@/components/MediaGenerationPanel";
import { UpgradeModal } from "@/components/UpgradeModal";
import { IceCardEditor } from "@/components/IceCardEditor";
import { ContinuityPanel } from "@/components/ContinuityPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BookOpen } from "lucide-react";
import type { ProjectBible } from "@shared/schema";

const CREATION_STAGES = [
  { id: "fetch", label: "Fetching your content", duration: 1500 },
  { id: "analyze", label: "Analyzing structure and themes", duration: 2000 },
  { id: "extract", label: "Extracting key moments", duration: 2500 },
  { id: "craft", label: "Crafting your story cards", duration: 2000 },
  { id: "polish", label: "Adding the finishing touches", duration: 1500 },
];

const MUSIC_TRACKS = [
  { id: "none", name: "No Music", url: null },
  { id: "cinematic", name: "Cinematic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "emotional", name: "Emotional", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "epic", name: "Epic", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "ambient", name: "Ambient", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
];

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

export default function GuestIceBuilderPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const previewIdFromUrl = params.id;
  const { toast } = useToast();
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
  const [titlePackId, setTitlePackId] = useState(DEFAULT_TITLE_PACK_ID);
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
  
  const handleManualNav = (newIndex: number) => {
    setPreviewCardIndex(newIndex);
  };
  
  // Create/destroy audio element only when modal opens/closes
  useEffect(() => {
    if (showPreviewModal && !musicAudioRef.current) {
      musicAudioRef.current = new Audio();
      musicAudioRef.current.loop = true;
    }
    
    if (!showPreviewModal && musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
  }, [showPreviewModal]);
  
  // Handle track changes, play/pause, and volume updates
  useEffect(() => {
    if (!musicAudioRef.current) return;
    
    // Update track if changed
    if (musicTrackUrl && (!musicAudioRef.current.src || !musicAudioRef.current.src.includes(musicTrackUrl.split('/').pop() || ''))) {
      musicAudioRef.current.src = musicTrackUrl;
    }
    
    // Update volume
    musicAudioRef.current.volume = musicVolume / 100;
    
    // Play/pause based on enabled state
    if (showPreviewModal && musicEnabled && musicTrackUrl) {
      musicAudioRef.current.play().catch(() => {});
    } else {
      musicAudioRef.current.pause();
    }
  }, [showPreviewModal, musicEnabled, musicTrackUrl, musicVolume]);
  
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
      if (!hasSeenWalkthrough()) {
        setShowWalkthrough(true);
      }
    }
  }, [existingPreview]);

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

  const createPreviewMutation = useMutation({
    mutationFn: async (data: { type: string; value: string }) => {
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
    
    createPreviewMutation.mutate({ type: inputType, value });
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

  // Get cards that need images (have content but no image)
  const cardsNeedingImages = cards.filter(card => !card.generatedImageUrl);
  
  // Get cards that need videos (have image but no video)
  const cardsNeedingVideos = cards.filter(card => card.generatedImageUrl && !card.generatedVideoUrl);
  
  // Bulk generate all images
  const handleBulkGenerateImages = async () => {
    if (!preview || !entitlements?.canGenerateImages) return;
    
    setShowBulkImageConfirm(false);
    setBulkGeneratingImages(true);
    setBulkProgress({ current: 0, total: cardsNeedingImages.length });
    
    let successCount = 0;
    for (let i = 0; i < cardsNeedingImages.length; i++) {
      const card = cardsNeedingImages[i];
      setBulkProgress({ current: i + 1, total: cardsNeedingImages.length });
      
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
            handleCardUpdate(card.id, { generatedImageUrl: data.imageUrl });
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
      description: `Generated ${successCount} of ${cardsNeedingImages.length} images.`,
    });
  };
  
  // Bulk generate all videos
  const handleBulkGenerateVideos = async () => {
    if (!preview || !entitlements?.canGenerateVideos) return;
    
    setShowBulkVideoConfirm(false);
    setBulkGeneratingVideos(true);
    setBulkProgress({ current: 0, total: cardsNeedingVideos.length });
    
    let successCount = 0;
    for (let i = 0; i < cardsNeedingVideos.length; i++) {
      const card = cardsNeedingVideos[i];
      setBulkProgress({ current: i + 1, total: cardsNeedingVideos.length });
      
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
          successCount++;
          // Video generation is async, just count as started
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
      <div className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="text-center mb-8">
          {isProfessionalMode ? (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-4" data-testid="badge-professional">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Professional Editor</span>
              <span className="text-xs text-emerald-400/70 ml-1">• {entitlements?.planName}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 mb-4" data-testid="badge-preview">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">Preview Mode</span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isProfessionalMode ? "Professional ICE Editor" : "Create Your Interactive Cinematic Experience"}
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto">
            {isProfessionalMode 
              ? "Full access unlocked. Generate media, add AI characters, and publish your interactive experience."
              : "Transform any content into an interactive story. Paste a URL or your script, and we'll generate story cards you can edit and reorder."}
          </p>
        </div>

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
                    <p className="text-sm text-white/40">
                      Enter a website URL and we'll extract the key content to create your story. No need to type https://
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
                <Button
                  onClick={handleSubmit}
                  disabled={createPreviewMutation.isPending || isFileUploading}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  data-testid="button-create-preview"
                >
                  Create Preview
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </UiCard>
        ) : (
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
                    setPreviewCardIndex(0);
                    setShowPreviewModal(true);
                  }}
                  className="flex-1 sm:flex-none gap-1.5 border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                  data-testid="button-preview-experience"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden xs:inline">Preview</span>
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
              <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-indigo-500/10 border border-blue-500/40 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-white text-sm">Ready to bring this to life?</span>
                    </div>
                    <p className="text-xs text-white/50">
                      Add AI-generated visuals, video, music, and interactive character conversations.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate(`/ice/preview/${preview.id}/checkout`)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-sm whitespace-nowrap"
                    size="sm"
                    data-testid="button-upgrade-preview"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    Upgrade Experience
                  </Button>
                </div>
              </div>
            )}

            {/* Edit hint banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-blue-200">
                <span className="font-medium">Tap any card</span> to edit content and generate AI media. <span className="hidden sm:inline">Click ➕ between cards to add AI interactions.</span>
              </p>
            </div>

            {/* Professional Tools Bar - always visible for professional users */}
            {isProfessionalMode && (
              <div className="flex items-center justify-end gap-2">
                <Sheet open={showBiblePanel} onOpenChange={setShowBiblePanel}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                      data-testid="button-open-bible"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Project Bible
                      {projectBible && (
                        <span className="ml-1 bg-amber-500/30 px-1.5 rounded text-xs">v{projectBible.version}</span>
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

            {/* Bulk AI Generation Panel - only for professional users */}
            {isProfessionalMode && entitlements && (cardsNeedingImages.length > 0 || cardsNeedingVideos.length > 0) && (
              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400" />
                      Generate All AI Media
                    </h3>
                    <p className="text-xs text-white/50 mt-1">
                      Review prompts before generating images or videos for all cards at once.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {cardsNeedingImages.length > 0 && entitlements.canGenerateImages && (
                      <Button
                        onClick={() => setShowBulkImageConfirm(true)}
                        disabled={bulkGeneratingImages || bulkGeneratingVideos}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
                        data-testid="button-bulk-generate-images"
                      >
                        {bulkGeneratingImages ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {bulkProgress.current}/{bulkProgress.total}
                          </>
                        ) : (
                          <>
                            <Image className="w-3.5 h-3.5" />
                            Images ({cardsNeedingImages.length})
                          </>
                        )}
                      </Button>
                    )}
                    {cardsNeedingVideos.length > 0 && entitlements.canGenerateVideos && (
                      <Button
                        onClick={() => setShowBulkVideoConfirm(true)}
                        disabled={bulkGeneratingVideos || bulkGeneratingImages}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
                        data-testid="button-bulk-generate-videos"
                      >
                        {bulkGeneratingVideos ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {bulkProgress.current}/{bulkProgress.total}
                          </>
                        ) : (
                          <>
                            <Video className="w-3.5 h-3.5" />
                            Videos ({cardsNeedingVideos.length})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Style & Music Panel */}
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Title Pack Selector */}
                <div className="flex-1">
                  <label className="text-xs text-white/60 mb-1.5 block">Style</label>
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <select
                      value={titlePackId}
                      onChange={(e) => setTitlePackId(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white border-none outline-none cursor-pointer"
                      data-testid="select-title-pack-editor"
                    >
                      {TITLE_PACKS.map((pack) => (
                        <option key={pack.id} value={pack.id} className="bg-slate-900 text-white">
                          {pack.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">
                    {TITLE_PACKS.find(p => p.id === titlePackId)?.description}
                  </p>
                </div>

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
                      {MUSIC_TRACKS.map((track) => (
                        <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                          {track.name}
                        </option>
                      ))}
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

                {/* Volume Controls (when music enabled) */}
                {musicEnabled && (
                  <div className="sm:w-32">
                    <label className="text-xs text-white/60 mb-1.5 block">Volume</label>
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
                      entitlements={entitlements || null}
                      isExpanded={expandedCardIndex === index}
                      onToggleExpand={() => setExpandedCardIndex(expandedCardIndex === index ? null : index)}
                      onCardUpdate={handleCardUpdate}
                      onCardSave={saveCardsWithUpdates}
                      onUpgradeClick={() => setShowUpgradeModal(true)}
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
            </div>

            <UiCard className="bg-white/[0.03] border-white/10 border-dashed">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Unlock Premium Features</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                    <Image className="w-6 h-6 text-blue-400 mb-2" />
                    <span className="text-sm text-white/70">AI Images</span>
                    <Lock className="w-3 h-3 text-white/40 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                    <Play className="w-6 h-6 text-blue-400 mb-2" />
                    <span className="text-sm text-white/70">Video</span>
                    <Lock className="w-3 h-3 text-white/40 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                    <Mic className="w-6 h-6 text-blue-400 mb-2" />
                    <span className="text-sm text-white/70">Narration</span>
                    <Lock className="w-3 h-3 text-white/40 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-white/5">
                    <Sparkles className="w-6 h-6 text-blue-400 mb-2" />
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
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
          </div>
        )}
      </div>

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
            
            <div className="flex gap-1.5">
              {cards.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => handleManualNav(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === previewCardIndex
                      ? 'bg-blue-500 w-4'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  data-testid={`button-preview-dot-${idx}`}
                />
              ))}
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
                    captions: cards[previewCardIndex].content.split('. ').filter(s => s.trim()).slice(0, 3),
                    sceneText: cards[previewCardIndex].content,
                    recapText: cards[previewCardIndex].title,
                    publishDate: new Date().toISOString(),
                    narrationEnabled: !narrationMuted && !!cards[previewCardIndex].narrationAudioUrl,
                    narrationStatus: cards[previewCardIndex].narrationAudioUrl ? "ready" : undefined,
                    narrationAudioUrl: cards[previewCardIndex].narrationAudioUrl,
                  }}
                  autoplay={true}
                  fullScreen={true}
                  titlePackId={titlePackId}
                  narrationVolume={narrationVolume}
                  narrationMuted={narrationMuted}
                  onPhaseChange={(phase) => {
                    if (phase === 'context' && previewCardIndex < cards.length - 1) {
                      setPreviewCardIndex(prev => prev + 1);
                    }
                  }}
                />
              </motion.div>
            )}
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
                      className={`transition-all ${narrationMuted ? "text-white/40" : "text-purple-400"}`}
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
      
      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="AI Media Generation"
        reason="Unlock AI-powered image and video generation, character interactions, voiceover narration, and more."
      />
      
      {/* Bulk Image Generation Confirmation Dialog */}
      <Dialog open={showBulkImageConfirm} onOpenChange={setShowBulkImageConfirm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-purple-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Image className="w-5 h-5 text-purple-400" />
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
              className="bg-purple-600 hover:bg-purple-700 text-white"
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
