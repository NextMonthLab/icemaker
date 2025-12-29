import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Sparkles, Globe, FileText, ArrowRight, Loader2, GripVertical, Lock, Play, Image, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

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
  sourceType: string;
  sourceValue: string;
  status?: string;
  createdAt: string;
}

export default function GuestIceBuilderPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const previewIdFromUrl = params.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
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
    }
  }, [existingPreview]);

  const createPreviewMutation = useMutation({
    mutationFn: async (data: { type: string; value: string }) => {
      const res = await apiRequest("POST", "/api/ice/preview", data);
      return res.json();
    },
    onSuccess: (data) => {
      setPreview(data);
      setCards(data.cards);
      toast({ title: "Preview created!", description: "You can now edit and reorder your story cards." });
      navigate(`/ice/preview/${data.id}`, { replace: true });
    },
    onError: (error: Error) => {
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

  const handleSubmit = () => {
    const value = inputType === "url" ? urlValue.trim() : textValue.trim();
    if (!value) {
      toast({ title: "Input required", description: "Please enter a URL or paste your content.", variant: "destructive" });
      return;
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Try ICE Free</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Create Your Cinematic Experience
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Transform any content into an interactive story. Paste a URL or your script, and we'll generate story cards you can edit and reorder.
          </p>
        </div>

        {!preview ? (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="p-6">
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as "url" | "text")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="url" className="flex items-center gap-2" data-testid="tab-url">
                    <Globe className="w-4 h-4" />
                    Website URL
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2" data-testid="tab-text">
                    <FileText className="w-4 h-4" />
                    Paste Content
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url">
                  <div className="space-y-4">
                    <Input
                      placeholder="https://example.com/about"
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      className="bg-slate-800 border-slate-700"
                      data-testid="input-url"
                    />
                    <p className="text-sm text-slate-500">
                      Enter a website URL and we'll extract the key content to create your story.
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

              <Button
                onClick={handleSubmit}
                disabled={createPreviewMutation.isPending}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                data-testid="button-create-preview"
              >
                {createPreviewMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating preview...
                  </>
                ) : (
                  <>
                    Create Preview
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{preview.title}</h2>
                <p className="text-sm text-slate-400">{cards.length} story cards</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setCards([]);
                  setUrlValue("");
                  setTextValue("");
                }}
                data-testid="button-start-over"
              >
                Start Over
              </Button>
            </div>

            <div className="space-y-3">
              {cards.map((card, index) => (
                <Card
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-slate-900/80 border-slate-800 cursor-move transition-all ${
                    draggedIndex === index ? "opacity-50 scale-105" : ""
                  }`}
                  data-testid={`card-preview-${index}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 text-slate-500">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-sm font-medium">{index + 1}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={card.title}
                          onChange={(e) => handleCardEdit(index, "title", e.target.value)}
                          onBlur={handleCardBlur}
                          className="bg-transparent border-transparent hover:border-slate-700 focus:border-purple-500 font-semibold text-white"
                          data-testid={`input-card-title-${index}`}
                        />
                        <Textarea
                          value={card.content}
                          onChange={(e) => handleCardEdit(index, "content", e.target.value)}
                          onBlur={handleCardBlur}
                          rows={2}
                          className="bg-transparent border-transparent hover:border-slate-700 focus:border-purple-500 text-slate-300 resize-none"
                          data-testid={`input-card-content-${index}`}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-slate-900/50 border-slate-800 border-dashed">
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
                  <Button
                    onClick={() => promoteMutation.mutate()}
                    disabled={promoteMutation.isPending}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="button-save-experience"
                  >
                    {promoteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save Experience
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const returnUrl = preview ? `/ice/preview/${preview.id}` : "/try";
                      navigate(`/login?return=${encodeURIComponent(returnUrl)}`);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="button-sign-in-to-save"
                  >
                    Sign In to Save & Unlock Features
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
