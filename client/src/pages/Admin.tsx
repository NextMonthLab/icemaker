import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BarChart3, Calendar, Plus, Users, Video, Upload, ChevronDown, PenSquare, Loader2, Eye, ImageIcon, CheckCircle, Trash2, Settings, Image as PhotoIcon, Clapperboard, ExternalLink, Music, Wand2, User, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Universe } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedUniverseId, setSelectedUniverseId] = useState<number | null>(null);
  const [showNewUniverseDialog, setShowNewUniverseDialog] = useState(false);
  const [newUniverseName, setNewUniverseName] = useState("");
  const [newUniverseDescription, setNewUniverseDescription] = useState("");
  const [previewCard, setPreviewCard] = useState<any>(null);
  const [generatingCardId, setGeneratingCardId] = useState<number | null>(null);
  const [generatingVideoCardId, setGeneratingVideoCardId] = useState<number | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeleteUniverseDialog, setShowDeleteUniverseDialog] = useState(false);
  const [showEditUniverseDialog, setShowEditUniverseDialog] = useState(false);
  const [editUniverseName, setEditUniverseName] = useState("");
  const [editUniverseDescription, setEditUniverseDescription] = useState("");
  const [editReleaseMode, setEditReleaseMode] = useState<string>("daily");
  const [editIntroCardsCount, setEditIntroCardsCount] = useState(3);
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [generatingAllVideos, setGeneratingAllVideos] = useState(false);
  const [editAudioMode, setEditAudioMode] = useState<string>("off");
  const [editDefaultTrackId, setEditDefaultTrackId] = useState<number | null>(null);
  const [editFadeInMs, setEditFadeInMs] = useState(500);
  const [editFadeOutMs, setEditFadeOutMs] = useState(500);

  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ["universes"],
    queryFn: () => api.getUniverses(),
  });

  const selectedUniverse = universes?.find(u => u.id === selectedUniverseId) || universes?.[0];

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", selectedUniverse?.id],
    queryFn: () => api.getCards(selectedUniverse!.id),
    enabled: !!selectedUniverse,
  });

  const { data: audioTracks } = useQuery({
    queryKey: ["audioTracks"],
    queryFn: () => api.getAudioTracks(),
  });

  const createUniverseMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => 
      api.createUniverse(data),
    onSuccess: (newUniverse) => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setSelectedUniverseId(newUniverse.id);
      setShowNewUniverseDialog(false);
      setNewUniverseName("");
      setNewUniverseDescription("");
      toast({
        title: "Universe created",
        description: `"${newUniverse.name}" is now ready for cards!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create universe",
        variant: "destructive",
      });
    },
  });

  const deleteAllCardsMutation = useMutation({
    mutationFn: (universeId: number) => api.deleteAllCards(universeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setShowDeleteAllDialog(false);
      toast({
        title: "Cards deleted",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete cards",
        variant: "destructive",
      });
    },
  });

  const deleteUniverseMutation = useMutation({
    mutationFn: (universeId: number) => api.deleteUniverse(universeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setSelectedUniverseId(null);
      setShowDeleteUniverseDialog(false);
      toast({
        title: "Universe deleted",
        description: "The universe and all its content have been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete universe",
        variant: "destructive",
      });
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: (cardId: number) => api.generateCardImage(cardId),
    onMutate: (cardId) => {
      setGeneratingCardId(cardId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setGeneratingCardId(null);
      toast({
        title: "Image Generated",
        description: `Image created for "${result.cardTitle}"`,
      });
    },
    onError: (error: any, cardId) => {
      setGeneratingCardId(null);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image",
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: (cardId: number) => api.generateCardVideo(cardId),
    onMutate: (cardId) => {
      setGeneratingVideoCardId(cardId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setGeneratingVideoCardId(null);
      toast({
        title: "Video Generated",
        description: `Video created for "${result.cardTitle}"`,
      });
    },
    onError: (error: any, cardId) => {
      setGeneratingVideoCardId(null);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate video",
        variant: "destructive",
      });
    },
  });

  const updateUniverseMutation = useMutation({
    mutationFn: (data: { id: number } & Partial<Universe>) => 
      api.updateUniverse(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setShowEditUniverseDialog(false);
      toast({
        title: "Universe updated",
        description: "Changes saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update universe",
        variant: "destructive",
      });
    },
  });

  const handleGenerateAllImages = async () => {
    if (!cards || !selectedUniverse) return;
    
    const pendingCards = cards.filter(c => {
      const hasPrompt = !!(c.sceneDescription || c.imageGeneration?.prompt);
      return hasPrompt && !c.imageGenerated;
    });
    
    if (pendingCards.length === 0) {
      toast({
        title: "No images to generate",
        description: "All cards with prompts already have images.",
      });
      return;
    }
    
    setGeneratingAllImages(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const card of pendingCards) {
      try {
        await api.generateCardImage(card.id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse.id] });
    setGeneratingAllImages(false);
    
    toast({
      title: "Bulk generation complete",
      description: `Generated ${successCount} images${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  const handleGenerateAllVideos = async () => {
    if (!cards || !selectedUniverse) return;
    
    const pendingCards = cards.filter(c => {
      const hasImage = !!(c.generatedImageUrl || c.imagePath);
      return hasImage && !c.videoGenerated;
    });
    
    if (pendingCards.length === 0) {
      toast({
        title: "No videos to generate",
        description: "All cards with images already have videos, or no images are available.",
      });
      return;
    }
    
    setGeneratingAllVideos(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const card of pendingCards) {
      try {
        await api.generateCardVideo(card.id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse.id] });
    setGeneratingAllVideos(false);
    
    toast({
      title: "Video generation complete",
      description: `Generated ${successCount} videos${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  const handleEditUniverse = async () => {
    if (selectedUniverse) {
      setEditUniverseName(selectedUniverse.name);
      setEditUniverseDescription(selectedUniverse.description || "");
      setEditReleaseMode(selectedUniverse.releaseMode || "daily");
      setEditIntroCardsCount(selectedUniverse.introCardsCount ?? 3);
      setEditTimezone(selectedUniverse.timezone || "UTC");
      
      try {
        const audioSettings = await api.getUniverseAudioSettings(selectedUniverse.id);
        setEditAudioMode(audioSettings.audioMode || "off");
        setEditDefaultTrackId(audioSettings.defaultTrackId);
        setEditFadeInMs(audioSettings.fadeInMs ?? 500);
        setEditFadeOutMs(audioSettings.fadeOutMs ?? 500);
      } catch {
        setEditAudioMode("off");
        setEditDefaultTrackId(null);
        setEditFadeInMs(500);
        setEditFadeOutMs(500);
      }
      
      setShowEditUniverseDialog(true);
    }
  };

  const handleSaveUniverse = async () => {
    if (!editUniverseName.trim() || !selectedUniverse) return;
    const dailyStartsAt = editIntroCardsCount + 1;
    updateUniverseMutation.mutate({
      id: selectedUniverse.id,
      name: editUniverseName,
      description: editUniverseDescription,
      releaseMode: editReleaseMode as any,
      introCardsCount: editIntroCardsCount,
      dailyReleaseStartsAtDayIndex: dailyStartsAt,
      timezone: editTimezone,
    });
    
    try {
      await api.updateUniverseAudioSettings(selectedUniverse.id, {
        audioMode: editAudioMode,
        defaultTrackId: editDefaultTrackId,
        fadeInMs: editFadeInMs,
        fadeOutMs: editFadeOutMs,
      });
    } catch (error: any) {
      toast({
        title: "Audio settings update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateUniverse = () => {
    if (!newUniverseName.trim()) {
      toast({
        title: "Error",
        description: "Universe name is required",
        variant: "destructive",
      });
      return;
    }
    createUniverseMutation.mutate({
      name: newUniverseName,
      description: newUniverseDescription,
    });
  };

  const isEngineGenerated = selectedUniverse?.visualMode === 'engine_generated';
  const isCreatorOrAdmin = user?.isAdmin || user?.role === 'admin' || user?.role === 'creator';

  if (!isCreatorOrAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Creator Access Required</h2>
          <p className="text-muted-foreground mb-6">
            Become a creator to start building your own stories and universes.
          </p>
          <Link href="/become-creator">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              Become a Creator
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (universesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in">
        
        {/* Header Section - Mobile Optimized */}
        <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Showrunner Dashboard</h1>
            
            {/* Universe Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="justify-between w-full sm:w-auto min-w-[200px]" data-testid="button-universe-dropdown">
                            <span className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs uppercase">Universe:</span>
                                <span className="font-semibold truncate max-w-[150px]">{selectedUniverse?.name || "Select..."}</span>
                            </span>
                            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[280px]">
                        <DropdownMenuLabel>Select Universe</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {universes?.map(u => (
                          <DropdownMenuItem 
                            key={u.id}
                            className={`cursor-pointer ${u.id === selectedUniverse?.id ? 'font-bold bg-accent/50' : ''}`}
                            onClick={() => setSelectedUniverseId(u.id)}
                            data-testid={`menu-universe-${u.id}`}
                          >
                            {u.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          onClick={() => setShowNewUniverseDialog(true)}
                          data-testid="menu-create-universe"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Universe...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <span className="hidden sm:inline text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Season 1</span>
            </div>

            {/* Action Buttons - Mobile Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Link href="/admin/transformations" className="contents">
                    <Button className="gap-2 h-12 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white col-span-2 sm:col-span-1" data-testid="button-create-story">
                        <Wand2 className="w-4 h-4" /> 
                        <span>Create Story</span>
                    </Button>
                </Link>
                <Link href="/admin/characters/new" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="outline" data-testid="button-create-character">
                        <User className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Create Character</span>
                        <span className="sm:hidden">Character</span>
                    </Button>
                </Link>
                <Link href="/admin/create" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="outline" data-testid="button-create-card" disabled={!selectedUniverse}>
                        <Plus className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Add Card</span>
                        <span className="sm:hidden">Card</span>
                    </Button>
                </Link>
                <Link href="/admin/audio" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="secondary" data-testid="button-audio-library">
                        <Music className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Audio Library</span>
                        <span className="sm:hidden">Audio</span>
                    </Button>
                </Link>
            </div>
        </div>
        
        {!selectedUniverse ? (
          <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Welcome to NextScene</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Transform your script, story, or ideas into an interactive narrative experience. 
                Upload any text and our AI will create characters, scenes, and daily story drops.
              </p>
              <Link href="/admin/transformations">
                <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" data-testid="button-get-started">
                  <Wand2 className="w-4 h-4" /> Create Your First Story
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Universe Actions Bar */}
            <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{selectedUniverse.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUniverse.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/universes/${selectedUniverse.id}/visual-bible`} className="contents">
                    <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-visual-bible">
                      <PhotoIcon className="w-3.5 h-3.5" /> Visual Bible
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEditUniverse} data-testid="button-edit-universe">
                    <Settings className="w-3.5 h-3.5" /> Edit Universe
                  </Button>
                </div>
              </div>
              
              {/* Generate AI Content - Prominent actions for engine-generated universes */}
              {isEngineGenerated && (
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-purple-500" />
                        Generate AI Content
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Generate missing images and videos for cards using AI.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="gap-1.5 border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
                        onClick={handleGenerateAllImages}
                        disabled={generatingAllImages || generatingAllVideos}
                        data-testid="button-generate-all-images"
                      >
                        {generatingAllImages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PhotoIcon className="w-3.5 h-3.5" />
                        )}
                        {generatingAllImages ? 'Generating...' : 'Generate Images'}
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="gap-1.5 border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                        onClick={handleGenerateAllVideos}
                        disabled={generatingAllVideos || generatingAllImages}
                        data-testid="button-generate-all-videos"
                      >
                        {generatingAllVideos ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Video className="w-3.5 h-3.5" />
                        )}
                        {generatingAllVideos ? 'Generating...' : 'Generate Videos'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
                        <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-card-count">{cards?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">in this universe</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Published</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-published-count">
                          {cards?.filter(c => c.status === 'published').length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Content Calendar */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/20">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Scheduled Drops
                    </h3>
                </div>
                <div className="divide-y divide-border">
                    {cardsLoading ? (
                      <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : cards?.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No cards yet. Create your first card to get started!
                      </div>
                    ) : (
                      cards?.map((card) => {
                        const hasPrompt = !!(card.sceneDescription || card.imageGeneration?.prompt);
                        const displayImage = card.generatedImageUrl || card.imagePath;
                        const needsGeneration = isEngineGenerated && hasPrompt && !card.imageGenerated;
                        const isGenerating = generatingCardId === card.id;
                        
                        return (
                        <div key={card.id} className="p-3 sm:p-4 hover:bg-muted/10" data-testid={`card-row-${card.id}`}>
                            {/* Mobile-first layout */}
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded overflow-hidden relative flex-shrink-0">
                                    {displayImage ? (
                                      <img src={displayImage} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/50" />
                                      </div>
                                    )}
                                    {card.imageGenerated && (
                                      <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                                        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                      </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm sm:text-base truncate">Day {card.dayIndex}: {card.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {card.publishAt ? new Date(card.publishAt).toLocaleDateString() : 'Not scheduled'}
                                      {isEngineGenerated && (
                                        <span className="ml-1.5">
                                          {card.imageGenerated ? (
                                            <span className="text-green-500">• Ready</span>
                                          ) : hasPrompt ? (
                                            <span className="text-yellow-500">• Needs image</span>
                                          ) : (
                                            <span className="text-muted-foreground/50">• No prompt</span>
                                          )}
                                        </span>
                                      )}
                                    </p>
                                    {/* Actions row - consolidated */}
                                    <div className="flex items-center gap-2 mt-2">
                                         {/* Status badges */}
                                         <span className={`px-1.5 py-0.5 text-xs rounded border ${
                                           card.status === 'published' 
                                             ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                             : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                         }`}>
                                           {card.status === 'published' ? 'Published' : 'Draft'}
                                         </span>
                                         
                                         {/* Media status icons */}
                                         <div className="flex items-center gap-1">
                                           <PhotoIcon className={`w-4 h-4 ${card.imageGenerated || card.generatedImageUrl || card.imagePath ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                                           <Video className={`w-4 h-4 ${card.videoGenerated ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                                         </div>
                                         
                                         {/* More actions dropdown */}
                                         <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                             <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-more-${card.id}`}>
                                               <MoreHorizontal className="w-4 h-4" />
                                             </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end" className="w-48">
                                             <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                             <DropdownMenuSeparator />
                                             <Link href={`/admin/cards/${card.id}/edit`}>
                                               <DropdownMenuItem data-testid={`menu-edit-${card.id}`}>
                                                 <PenSquare className="w-4 h-4 mr-2" /> Edit Card
                                               </DropdownMenuItem>
                                             </Link>
                                             <Link href={`/admin/cards/${card.id}`}>
                                               <DropdownMenuItem data-testid={`menu-admin-${card.id}`}>
                                                 <ExternalLink className="w-4 h-4 mr-2" /> Admin View
                                               </DropdownMenuItem>
                                             </Link>
                                             <Link href={`/card/${card.id}`}>
                                               <DropdownMenuItem data-testid={`menu-preview-${card.id}`}>
                                                 <Eye className="w-4 h-4 mr-2" /> Preview
                                               </DropdownMenuItem>
                                             </Link>
                                             {isEngineGenerated && hasPrompt && (
                                               <>
                                                 <DropdownMenuSeparator />
                                                 <DropdownMenuItem 
                                                   onClick={() => generateImageMutation.mutate(card.id)}
                                                   disabled={isGenerating}
                                                   data-testid={`menu-generate-image-${card.id}`}
                                                 >
                                                   {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhotoIcon className="w-4 h-4 mr-2" />}
                                                   {card.imageGenerated ? 'Regenerate Image' : 'Generate Image'}
                                                 </DropdownMenuItem>
                                               </>
                                             )}
                                             {isEngineGenerated && displayImage && (
                                               <DropdownMenuItem 
                                                 onClick={() => generateVideoMutation.mutate(card.id)}
                                                 disabled={generatingVideoCardId === card.id}
                                                 data-testid={`menu-generate-video-${card.id}`}
                                               >
                                                 {generatingVideoCardId === card.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                                                 {card.videoGenerated ? 'Regenerate Video' : 'Generate Video'}
                                               </DropdownMenuItem>
                                             )}
                                           </DropdownMenuContent>
                                         </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                      );})
                    )}
                </div>
            </div>

            {/* Danger Zone - At bottom for sensitive actions */}
            <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-destructive">Danger Zone</span>
                  <p className="text-muted-foreground text-xs mt-0.5">Destructive actions for "{selectedUniverse.name}"</p>
                </div>
                <div className="flex gap-2">
                  <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground flex-1 sm:flex-initial"
                        data-testid="button-delete-all-cards" 
                        disabled={!cards?.length}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Cards
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Cards?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {cards?.length || 0} cards from "{selectedUniverse?.name}". 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => selectedUniverse && deleteAllCardsMutation.mutate(selectedUniverse.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteAllCardsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Delete All Cards
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog open={showDeleteUniverseDialog} onOpenChange={setShowDeleteUniverseDialog}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        variant="destructive" 
                        className="gap-1.5 flex-1 sm:flex-initial"
                        data-testid="button-delete-universe"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Universe
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Universe?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{selectedUniverse?.name}" and all its content including cards, characters, and locations. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => selectedUniverse && deleteUniverseMutation.mutate(selectedUniverse.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteUniverseMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Delete Universe
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Create Universe Dialog */}
        <Dialog open={showNewUniverseDialog} onOpenChange={setShowNewUniverseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Universe</DialogTitle>
              <DialogDescription>
                A universe is a story world that contains characters and cards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="universe-name">Universe Name</Label>
                <Input
                  id="universe-name"
                  placeholder="e.g., Neon Rain"
                  value={newUniverseName}
                  onChange={(e) => setNewUniverseName(e.target.value)}
                  data-testid="input-universe-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="universe-description">Description</Label>
                <Textarea
                  id="universe-description"
                  placeholder="A brief description of your story world..."
                  value={newUniverseDescription}
                  onChange={(e) => setNewUniverseDescription(e.target.value)}
                  data-testid="input-universe-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewUniverseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUniverse}
                disabled={createUniverseMutation.isPending}
                data-testid="button-submit-universe"
              >
                {createUniverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create Universe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Universe Dialog */}
        <Dialog open={showEditUniverseDialog} onOpenChange={setShowEditUniverseDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Universe</DialogTitle>
              <DialogDescription>
                Update the details and release settings for this story world.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-universe-name">Universe Name</Label>
                <Input
                  id="edit-universe-name"
                  placeholder="e.g., Neon Rain"
                  value={editUniverseName}
                  onChange={(e) => setEditUniverseName(e.target.value)}
                  data-testid="input-edit-universe-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-universe-description">Description</Label>
                <Textarea
                  id="edit-universe-description"
                  placeholder="A brief description of your story world..."
                  value={editUniverseDescription}
                  onChange={(e) => setEditUniverseDescription(e.target.value)}
                  data-testid="input-edit-universe-description"
                />
              </div>
              
              {/* Release Settings Section */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3">Release Settings</h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-release-mode">Release Mode</Label>
                    <select
                      id="edit-release-mode"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editReleaseMode}
                      onChange={(e) => setEditReleaseMode(e.target.value)}
                      data-testid="select-release-mode"
                    >
                      <option value="daily">Daily - All cards follow publish date</option>
                      <option value="hybrid_intro_then_daily">Hybrid - First cards instant, then daily</option>
                      <option value="all_at_once">All at Once - Release everything immediately</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {editReleaseMode === 'hybrid_intro_then_daily' 
                        ? `First ${editIntroCardsCount} cards unlock instantly, then daily from Day ${editIntroCardsCount + 1}.`
                        : editReleaseMode === 'all_at_once'
                        ? 'All published cards are visible immediately.'
                        : 'All cards follow their scheduled publish dates.'}
                    </p>
                  </div>
                  
                  {editReleaseMode === 'hybrid_intro_then_daily' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-intro-count">Intro Cards Count</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          id="edit-intro-count"
                          min={1}
                          max={5}
                          value={editIntroCardsCount}
                          onChange={(e) => setEditIntroCardsCount(parseInt(e.target.value))}
                          className="flex-1"
                          data-testid="slider-intro-count"
                        />
                        <span className="w-8 text-center font-mono font-bold">{editIntroCardsCount}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Number of cards to unlock immediately for new viewers.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-timezone">Timezone</Label>
                    <select
                      id="edit-timezone"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      data-testid="select-timezone"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (US)</option>
                      <option value="America/Los_Angeles">Pacific Time (US)</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Timezone used for publish date comparisons.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Soundtrack Settings Section */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4" /> Soundtrack Settings
                </h4>
                
                {/* Quick Auto-Select Option */}
                {editAudioMode === 'off' && audioTracks && audioTracks.length > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Add background music instantly</p>
                        <p className="text-xs text-muted-foreground">We'll pick a track for you - you can change it later</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditAudioMode('continuous');
                          if (audioTracks.length > 0) {
                            const randomTrack = audioTracks[Math.floor(Math.random() * audioTracks.length)];
                            setEditDefaultTrackId(randomTrack.id);
                          }
                        }}
                        data-testid="button-auto-select-music"
                      >
                        <Music className="w-4 h-4 mr-2" />
                        Auto-select
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-audio-mode">Audio Mode</Label>
                    <select
                      id="edit-audio-mode"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editAudioMode}
                      onChange={(e) => setEditAudioMode(e.target.value)}
                      data-testid="select-audio-mode"
                    >
                      <option value="off">Off - No background music</option>
                      <option value="continuous">Continuous - Same track plays throughout</option>
                      <option value="per_card">Per Card - Each card can have its own track</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {editAudioMode === 'continuous' 
                        ? 'One track plays throughout the story viewing experience.'
                        : editAudioMode === 'per_card'
                        ? 'Different tracks can play for different story cards.'
                        : 'Background music is disabled for this universe.'}
                    </p>
                  </div>
                  
                  {editAudioMode !== 'off' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="edit-default-track">Default Track</Label>
                        <select
                          id="edit-default-track"
                          className="w-full p-2 border rounded-md bg-background text-foreground"
                          value={editDefaultTrackId ?? ""}
                          onChange={(e) => setEditDefaultTrackId(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="select-default-track"
                        >
                          <option value="">No default track</option>
                          {audioTracks?.map(track => (
                            <option key={track.id} value={track.id}>
                              {track.title}{track.artist ? ` - ${track.artist}` : ''}
                            </option>
                          ))}
                        </select>
                        {!audioTracks?.length && (
                          <p className="text-xs text-muted-foreground">
                            <Link href="/admin/audio" className="text-primary hover:underline">
                              Add tracks to your Audio Library
                            </Link> to enable background music.
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-fade-in">Fade In (ms)</Label>
                          <Input
                            id="edit-fade-in"
                            type="number"
                            min={0}
                            max={5000}
                            step={100}
                            value={editFadeInMs}
                            onChange={(e) => setEditFadeInMs(parseInt(e.target.value) || 500)}
                            data-testid="input-fade-in"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-fade-out">Fade Out (ms)</Label>
                          <Input
                            id="edit-fade-out"
                            type="number"
                            min={0}
                            max={5000}
                            step={100}
                            value={editFadeOutMs}
                            onChange={(e) => setEditFadeOutMs(parseInt(e.target.value) || 500)}
                            data-testid="input-fade-out"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditUniverseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUniverse}
                disabled={updateUniverseMutation.isPending}
                data-testid="button-save-universe"
              >
                {updateUniverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Card Preview Dialog */}
        <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-primary">Day {previewCard?.dayIndex}:</span> {previewCard?.title}
              </DialogTitle>
              <DialogDescription>
                {previewCard?.status === 'published' ? 'Published' : 'Draft'} 
                {previewCard?.publishAt && ` • Scheduled: ${new Date(previewCard.publishAt).toLocaleDateString()}`}
              </DialogDescription>
            </DialogHeader>
            
            {previewCard && (
              <div className="space-y-6 py-4">
                {/* Card Image Preview */}
                {(previewCard.generatedImageUrl || previewCard.imagePath) && (
                  <div className="aspect-[9/16] max-h-[300px] w-auto mx-auto bg-muted rounded-lg overflow-hidden border">
                    <img 
                      src={previewCard.generatedImageUrl || previewCard.imagePath} 
                      alt={previewCard.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Captions */}
                {previewCard.captionsJson && previewCard.captionsJson.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Captions</h4>
                    <div className="bg-black/50 p-4 rounded-lg space-y-2">
                      {previewCard.captionsJson.map((caption: string, i: number) => (
                        <p key={i} className="text-white/90 italic text-center">"{caption}"</p>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Scene Text */}
                {previewCard.sceneText && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Scene Text</h4>
                    <p className="text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-lg">
                      {previewCard.sceneText}
                    </p>
                  </div>
                )}
                
                {/* Recap */}
                {previewCard.recapText && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Journal Recap</h4>
                    <p className="text-muted-foreground text-sm">{previewCard.recapText}</p>
                  </div>
                )}
                
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                  <div>
                    <span className="text-muted-foreground">Effect:</span>{' '}
                    <span className="font-medium">{previewCard.effectTemplate || 'ken-burns'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Season:</span>{' '}
                    <span className="font-medium">{previewCard.season || 1}</span>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewCard(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
}
