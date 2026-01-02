import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Sparkles, Globe, FileText, ArrowRight, Loader2, GripVertical, Lock, Play, Image, Mic, Upload, Check, Circle, Eye, Pencil, Film, X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card as UiCard, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import GlobalNav from "@/components/GlobalNav";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import CardPlayer, { CARD_FONTS, CARD_COLORS, type CardFont } from "@/components/CardPlayer";
import type { Card } from "@/lib/mockData";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import previewCardBackground from "@assets/generated_images/minimal_sunset_with_top_silhouettes.png";
import { InteractivityNode, AddInteractivityButton, StoryCharacter } from "@/components/InteractivityNode";
import { GuidedWalkthrough } from "@/components/GuidedWalkthrough";

const CREATION_STAGES = [
  { id: "fetch", label: "Fetching your content", duration: 1500 },
  { id: "analyze", label: "Analyzing structure and themes", duration: 2000 },
  { id: "extract", label: "Extracting key moments", duration: 2500 },
  { id: "craft", label: "Crafting your story cards", duration: 2000 },
  { id: "polish", label: "Adding the finishing touches", duration: 1500 },
];

interface PreviewCard {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface PreviewData {
  id: string;
  title: string;
  cards: PreviewCard[];
  characters?: StoryCharacter[];
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewCardIndex, setPreviewCardIndex] = useState(0);
  const [interactivityNodes, setInteractivityNodes] = useState<InteractivityNodeData[]>([]);
  const [previewAccessToken, setPreviewAccessToken] = useState<string | undefined>();
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [cardPace, setCardPace] = useState<"slow" | "normal" | "fast">("normal");
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [cardFont, setCardFont] = useState<CardFont>("cinzel");
  const [cardFontColor, setCardFontColor] = useState("#ffffff");
  
  const paceDelays = { slow: 12000, normal: 5000, fast: 3000 };
  
  const [lastManualNav, setLastManualNav] = useState(0);
  
  useEffect(() => {
    if (!showPreviewModal || !autoAdvanceEnabled) return;
    if (previewCardIndex >= cards.length - 1) return;
    
    const timer = setTimeout(() => {
      setPreviewCardIndex(prev => Math.min(cards.length - 1, prev + 1));
    }, paceDelays[cardPace]);
    
    return () => clearTimeout(timer);
  }, [showPreviewModal, previewCardIndex, cardPace, autoAdvanceEnabled, cards.length, lastManualNav]);
  
  const handleManualNav = (newIndex: number) => {
    setPreviewCardIndex(newIndex);
    setLastManualNav(Date.now());
  };
  
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
      if (existingPreview.previewAccessToken) {
        setPreviewAccessToken(existingPreview.previewAccessToken);
      }
      if (!hasSeenWalkthrough()) {
        setShowWalkthrough(true);
      }
    }
  }, [existingPreview]);

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
    mutationFn: async (updatedCards: PreviewCard[]) => {
      if (!preview) return;
      const res = await apiRequest("PUT", `/api/ice/preview/${preview.id}/cards`, { cards: updatedCards });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cards saved", description: "Your changes have been saved." });
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
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    if (preview) {
      saveCardsMutation.mutate(cards);
    }
  };

  const handleCardEdit = (index: number, field: "title" | "content", value: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
  };

  const handleCardBlur = () => {
    if (preview) {
      saveCardsMutation.mutate(cards);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex flex-col">
        <GlobalNav context="ice" showBreadcrumb breadcrumbLabel="ICE Maker" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading your preview...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex flex-col">
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
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 mb-4" data-testid="badge-preview">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Preview Mode</span>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isProfessionalMode ? "Professional ICE Editor" : "Create Your Interactive Cinematic Experience"}
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            {isProfessionalMode 
              ? "Full access unlocked. Generate media, add AI characters, and publish your interactive experience."
              : "Transform any content into an interactive story. Paste a URL or your script, and we'll generate story cards you can edit and reorder."}
          </p>
        </div>

        {!preview ? (
          <UiCard className="bg-slate-900/80 border-slate-800">
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
                      className="bg-slate-800 border-slate-700"
                      data-testid="input-url"
                    />
                    <p className="text-sm text-slate-500">
                      Enter a website URL and we'll extract the key content to create your story. No need to type https://
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="file">
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
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
                      <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                      {selectedFile ? (
                        <p className="text-white font-medium">{selectedFile.name}</p>
                      ) : (
                        <>
                          <p className="text-slate-300 mb-1">Click to upload a file</p>
                          <p className="text-sm text-slate-500">PDF, PowerPoint, Word, or Text files</p>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
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
                      className="bg-slate-800 border-slate-700"
                      data-testid="input-text"
                    />
                    <p className="text-sm text-slate-500">
                      Paste a script, article, or story outline. We'll break it into story cards.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {(createPreviewMutation.isPending || isFileUploading) && currentStage >= 0 ? (
                <div className="mt-6 space-y-4" data-testid="creation-stages">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-semibold text-white mb-1">Creating Your Experience</h3>
                    <p className="text-sm text-slate-400">This usually takes 10-15 seconds</p>
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
                              status === "running" ? "bg-purple-500/20" : "bg-slate-800/50"
                            }`}
                            data-testid={`stage-${stage.id}`}
                          >
                            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                              status === "done" ? "bg-green-500" :
                              status === "running" ? "bg-purple-500" : "bg-slate-700"
                            }`}>
                              {status === "done" ? (
                                <Check className="w-4 h-4 text-white" />
                              ) : status === "running" ? (
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              ) : (
                                <Circle className="w-3 h-3 text-slate-500" />
                              )}
                            </div>
                            <span className={`text-sm ${
                              status === "done" ? "text-green-400" :
                              status === "running" ? "text-purple-300 font-medium" : "text-slate-500"
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
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  <Film className="w-3 h-3 inline mr-1" />
                  {cards.length} story cards
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
                  className="flex-1 sm:flex-none gap-1.5 border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
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
            
            {/* Upgrade prompt banner */}
            <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-indigo-500/10 border border-purple-500/40 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white text-sm">Ready to bring this to life?</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Add AI-generated visuals, video, music, and interactive character conversations.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/ice/preview/${preview.id}/checkout`)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-sm whitespace-nowrap"
                  size="sm"
                  data-testid="button-upgrade-preview"
                >
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  Upgrade Experience
                </Button>
              </div>
            </div>

            {/* Edit hint banner */}
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-purple-200">
                <span className="font-medium">Tap any card</span> to edit. <span className="hidden sm:inline">Click ➕ between cards to add AI interactions.</span>
              </p>
            </div>

            {/* Film strip style cards */}
            <div className="relative">
              {/* Film strip perforations - left side */}
              <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-slate-950/80 rounded-l-lg border-r border-slate-700 hidden sm:flex flex-col items-center justify-around py-4">
                {cards.slice(0, 8).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-600" />
                ))}
              </div>
              
              <div className="space-y-0 sm:pl-10">
                {cards.map((card, index) => {
                  const nodeAtPosition = interactivityNodes.find(n => n.afterCardIndex === index);
                  
                  return (
                    <div key={card.id}>
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`group relative bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-700 rounded-lg overflow-hidden cursor-move transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 ${
                          draggedIndex === index ? "opacity-50 scale-[1.02] shadow-xl" : ""
                        }`}
                        data-testid={`card-preview-${index}`}
                      >
                        {/* Card frame number - film style */}
                        <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-12 bg-slate-950/60 border-r border-slate-700/50 flex flex-col items-center justify-center">
                          <GripVertical className="w-4 h-4 text-slate-600 mb-1 group-hover:text-purple-400 transition-colors" />
                          <span className="text-xs font-mono text-slate-500 group-hover:text-purple-400 transition-colors">{String(index + 1).padStart(2, '0')}</span>
                        </div>
                        
                        <div className="pl-12 sm:pl-14 pr-3 py-3 sm:pr-4 sm:py-4">
                          <Input
                            value={card.title}
                            onChange={(e) => handleCardEdit(index, "title", e.target.value)}
                            onBlur={handleCardBlur}
                            placeholder="Card title..."
                            className="bg-transparent border-transparent hover:border-slate-600 focus:border-purple-500 focus:bg-slate-800/50 font-semibold text-white text-sm sm:text-base h-8 sm:h-9 px-2"
                            data-testid={`input-card-title-${index}`}
                          />
                          <Textarea
                            value={card.content}
                            onChange={(e) => handleCardEdit(index, "content", e.target.value)}
                            onBlur={handleCardBlur}
                            placeholder="Card content..."
                            rows={2}
                            className="bg-transparent border-transparent hover:border-slate-600 focus:border-purple-500 focus:bg-slate-800/50 text-slate-300 text-xs sm:text-sm resize-none mt-1 px-2"
                            data-testid={`input-card-content-${index}`}
                          />
                        </div>
                        
                        {/* Hover edit indicator */}
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-purple-500/20 rounded p-1">
                            <Pencil className="w-3 h-3 text-purple-400" />
                          </div>
                        </div>
                      </div>
                      
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
                              onCharacterSelect={(charId) => {
                                const newNode: InteractivityNodeData = {
                                  id: `node-${Date.now()}-${index}`,
                                  afterCardIndex: index,
                                  isActive: false,
                                  selectedCharacterId: charId,
                                };
                                setInteractivityNodes(nodes => [...nodes, newNode]);
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
              
              {/* Film strip perforations - right side */}
              <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-slate-950/80 rounded-r-lg border-l border-slate-700 hidden sm:flex flex-col items-center justify-around py-4">
                {cards.slice(0, 8).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-600" />
                ))}
              </div>
            </div>

            <UiCard className="bg-slate-900/50 border-slate-800 border-dashed">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Unlock Premium Features</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-800/50">
                    <Image className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-sm text-slate-300">AI Images</span>
                    <Lock className="w-3 h-3 text-slate-500 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-800/50">
                    <Play className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-sm text-slate-300">Video</span>
                    <Lock className="w-3 h-3 text-slate-500 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-800/50">
                    <Mic className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-sm text-slate-300">Narration</span>
                    <Lock className="w-3 h-3 text-slate-500 mt-1" />
                  </div>
                  <div className="flex flex-col items-center text-center p-3 rounded-lg bg-slate-800/50">
                    <Sparkles className="w-6 h-6 text-purple-400 mb-2" />
                    <span className="text-sm text-slate-300">Export</span>
                    <Lock className="w-3 h-3 text-slate-500 mt-1" />
                  </div>
                </div>

                {user ? (
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        navigate(`/ice/preview/${preview?.id}/checkout`);
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      data-testid="button-upgrade-to-pro"
                    >
                      Upgrade to Unlock
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-xs text-center text-slate-500">
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
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      data-testid="button-sign-in-to-save"
                    >
                      Sign In to Save Progress
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-xs text-center text-slate-500">
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
                      ? 'bg-purple-500 w-4'
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
                    dayIndex: previewCardIndex + 1,
                    title: cards[previewCardIndex].title,
                    image: previewCardBackground,
                    captions: cards[previewCardIndex].content.split('. ').filter(s => s.trim()).slice(0, 3),
                    sceneText: cards[previewCardIndex].content,
                    recapText: cards[previewCardIndex].title,
                    publishDate: new Date().toISOString(),
                  }}
                  autoplay={true}
                  fullScreen={true}
                  font={cardFont}
                  fontColor={cardFontColor}
                  onPhaseChange={(phase) => {
                    if (phase === 'context' && previewCardIndex < cards.length - 1) {
                      setPreviewCardIndex(prev => prev + 1);
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Top controls bar - mobile optimized */}
          <div className="absolute top-4 left-4 right-14 z-[60] flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Premium upsell - hidden on very small screens, shown abbreviated on mobile */}
            <div className="hidden sm:flex bg-black/50 backdrop-blur rounded-full px-3 py-1.5 items-center gap-2 shrink-0">
              <Lock className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-white/80 whitespace-nowrap">AI images & video with Pro</span>
            </div>
            
            {/* Pace controls */}
            <div className="bg-black/50 backdrop-blur rounded-full px-2 py-1.5 flex items-center gap-1 w-fit">
              <span className="text-[10px] text-white/60 mr-1">Pace:</span>
              {(["slow", "normal", "fast"] as const).map((pace) => (
                <button
                  key={pace}
                  onClick={() => setCardPace(pace)}
                  className={`px-2 py-0.5 text-[10px] rounded-full transition-all ${
                    cardPace === pace
                      ? "bg-purple-500 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid={`button-pace-${pace}`}
                >
                  {pace.charAt(0).toUpperCase() + pace.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Font selector */}
            <div className="bg-black/50 backdrop-blur rounded-full px-2 py-1.5 flex items-center gap-1 w-fit">
              <span className="text-[10px] text-white/60 mr-1">Font:</span>
              <select
                value={cardFont}
                onChange={(e) => setCardFont(e.target.value as CardFont)}
                className="bg-transparent text-[10px] text-white border-none outline-none cursor-pointer"
                data-testid="select-font"
              >
                {CARD_FONTS.map((font) => (
                  <option key={font.id} value={font.id} className="bg-slate-900 text-white">
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Color selector */}
            <div className="bg-black/50 backdrop-blur rounded-full px-2 py-1.5 flex items-center gap-1.5 w-fit">
              <span className="text-[10px] text-white/60">Color:</span>
              {CARD_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setCardFontColor(color.value)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    cardFontColor === color.value
                      ? "border-white scale-110"
                      : "border-transparent hover:border-white/50"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                  data-testid={`button-color-${color.id}`}
                />
              ))}
            </div>
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
    </div>
  );
}
