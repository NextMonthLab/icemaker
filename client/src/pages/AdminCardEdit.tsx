import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Save, X, Plus, Trash2, Loader2, Volume2, Play, Pause, RefreshCw, Video, Image } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

export default function AdminCardEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cardId = parseInt(id || "0");

  const [formData, setFormData] = useState({
    dayIndex: 1,
    title: "",
    status: "draft",
    publishAt: "",
    captions: [] as string[],
    sceneText: "",
    recapText: "",
    sceneDescription: "",
    imageGenPrompt: "",
    imageGenShotType: "",
    imageGenLighting: "",
    imageGenNegativePrompt: "",
    primaryCharacterIds: [] as number[],
    locationId: null as number | null,
    narrationEnabled: false,
    narrationText: "",
    narrationVoice: "alloy",
    narrationSpeed: 1.0,
  });
  
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data: card, isLoading: cardLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => api.getCard(cardId),
    enabled: cardId > 0,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", card?.universeId],
    queryFn: () => api.getCharacters(card!.universeId),
    enabled: !!card?.universeId,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", card?.universeId],
    queryFn: () => api.getLocations(card!.universeId),
    enabled: !!card?.universeId,
  });
  
  const { data: voicesData } = useQuery({
    queryKey: ["tts-voices"],
    queryFn: async () => {
      const res = await fetch("/api/tts/voices");
      if (!res.ok) return { configured: false, voices: [] };
      return res.json();
    },
  });
  
  const { data: videoConfig } = useQuery({
    queryKey: ["video-config"],
    queryFn: async () => {
      const res = await fetch("/api/video/config");
      if (!res.ok) return { configured: false, models: [] };
      return res.json();
    },
  });
  
  const [videoModel, setVideoModel] = useState("");
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  const [videoMode, setVideoMode] = useState<"text-to-video" | "image-to-video">("text-to-video");

  useEffect(() => {
    if (videoConfig?.models?.length > 0 && !videoModel) {
      setVideoModel(videoConfig.models[0].id);
    }
  }, [videoConfig, videoModel]);

  useEffect(() => {
    if (card) {
      setFormData({
        dayIndex: card.dayIndex,
        title: card.title,
        status: card.status,
        publishAt: card.publishAt ? new Date(card.publishAt).toISOString().slice(0, 16) : "",
        captions: (card.captionsJson as string[]) || [],
        sceneText: card.sceneText || "",
        recapText: card.recapText || "",
        sceneDescription: card.sceneDescription || "",
        imageGenPrompt: card.imageGeneration?.prompt || "",
        imageGenShotType: card.imageGeneration?.shotType || "",
        imageGenLighting: card.imageGeneration?.lighting || "",
        imageGenNegativePrompt: card.imageGeneration?.negativePrompt || "",
        primaryCharacterIds: card.primaryCharacterIds || [],
        locationId: card.locationId || null,
        narrationEnabled: card.narrationEnabled ?? false,
        narrationText: card.narrationText || "",
        narrationVoice: card.narrationVoice || "alloy",
        narrationSpeed: card.narrationSpeed ?? 1.0,
      });
    }
  }, [card]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateCard(cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast({ title: "Card saved successfully!" });
      setLocation(`/admin/cards/${cardId}`);
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const data = {
      dayIndex: formData.dayIndex,
      title: formData.title,
      status: formData.status,
      publishAt: formData.publishAt ? new Date(formData.publishAt).toISOString() : null,
      captionsJson: formData.captions,
      sceneText: formData.sceneText,
      recapText: formData.recapText,
      sceneDescription: formData.sceneDescription,
      imageGeneration: {
        prompt: formData.imageGenPrompt,
        shotType: formData.imageGenShotType,
        lighting: formData.imageGenLighting,
        negativePrompt: formData.imageGenNegativePrompt,
      },
      primaryCharacterIds: formData.primaryCharacterIds,
      locationId: formData.locationId,
    };
    updateMutation.mutate(data);
  };

  const addCaption = () => {
    setFormData(prev => ({ ...prev, captions: [...prev.captions, ""] }));
  };

  const updateCaption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      captions: prev.captions.map((c, i) => i === index ? value : c)
    }));
  };

  const removeCaption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      captions: prev.captions.filter((_, i) => i !== index)
    }));
  };

  const toggleCharacter = (charId: number) => {
    setFormData(prev => ({
      ...prev,
      primaryCharacterIds: prev.primaryCharacterIds.includes(charId)
        ? prev.primaryCharacterIds.filter(id => id !== charId)
        : [...prev.primaryCharacterIds, charId]
    }));
  };
  
  const saveNarrationMutation = useMutation({
    mutationFn: async (data: { narrationEnabled: boolean; narrationText: string; narrationVoice: string; narrationSpeed: number }) => {
      const res = await fetch(`/api/cards/${cardId}/narration/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save narration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Narration saved!" });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });
  
  const generateNarrationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/narration/generate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate narration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Narration generated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });
  
  const deleteNarrationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/narration`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete narration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Narration audio deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });
  
  const handlePreviewNarration = async () => {
    if (previewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(false);
      return;
    }
    
    const text = formData.narrationText.slice(0, 300);
    if (!text.trim()) {
      toast({ title: "No text to preview", variant: "destructive" });
      return;
    }
    
    try {
      setPreviewPlaying(true);
      const res = await fetch(`/api/cards/${cardId}/narration/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text,
          voice: formData.narrationVoice,
          speed: formData.narrationSpeed,
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
  
  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/video/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: videoMode,
          model: videoModel,
          duration: videoDuration,
          aspectRatio: "9:16",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to start video generation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      if (data.status === "completed") {
        toast({ title: "Video ready!", description: "Your video has been generated successfully." });
      } else {
        toast({ title: "Video generation started!", description: data.taskId ? `Task ID: ${data.taskId}` : "Processing..." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Video generation failed", description: error.message, variant: "destructive" });
    },
  });
  
  const checkVideoStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/video/status`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to check status");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      if (data.status === "completed") {
        toast({ title: "Video ready!", description: "Your video has been generated successfully." });
      } else if (data.status === "failed") {
        toast({ title: "Video failed", description: data.error || "Generation failed", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Status check failed", description: error.message, variant: "destructive" });
    },
  });
  
  const deleteVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${cardId}/video`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete video");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Video deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Access Denied</h2>
          <Link href="/"><Button>Go Home</Button></Link>
        </div>
      </Layout>
    );
  }

  if (cardLoading) {
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
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex items-center gap-4">
          <Link href={`/admin/cards/${cardId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-display font-bold">Edit Card</h1>
            <p className="text-sm text-muted-foreground">Day {card?.dayIndex}: {card?.title}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/cards/${cardId}`}>
              <Button variant="outline" className="gap-2">
                <X className="w-4 h-4" /> Cancel
              </Button>
            </Link>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2" data-testid="button-save">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dayIndex">Day Index</Label>
                  <Input 
                    id="dayIndex" 
                    type="number" 
                    value={formData.dayIndex}
                    onChange={(e) => setFormData(prev => ({ ...prev, dayIndex: parseInt(e.target.value) || 1 }))}
                    data-testid="input-day-index"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input 
                  id="title" 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishAt">Publish At (optional)</Label>
                <Input 
                  id="publishAt" 
                  type="datetime-local"
                  value={formData.publishAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, publishAt: e.target.value }))}
                  data-testid="input-publish-at"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">References</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Characters</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[60px]">
                  {characters?.map(char => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => toggleCharacter(char.id)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        formData.primaryCharacterIds.includes(char.id) 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select 
                  value={formData.locationId?.toString() || "none"} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, locationId: v === "none" ? null : parseInt(v) }))}
                >
                  <SelectTrigger data-testid="select-location">
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations?.map(loc => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sceneText">Scene Text</Label>
                <Textarea 
                  id="sceneText"
                  rows={3}
                  value={formData.sceneText}
                  onChange={(e) => setFormData(prev => ({ ...prev, sceneText: e.target.value }))}
                  data-testid="input-scene-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recapText">Recap Text</Label>
                <Textarea 
                  id="recapText"
                  rows={2}
                  value={formData.recapText}
                  onChange={(e) => setFormData(prev => ({ ...prev, recapText: e.target.value }))}
                  data-testid="input-recap-text"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Captions</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addCaption} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.captions.map((cap, i) => (
                    <div key={i} className="flex gap-2">
                      <Input 
                        value={cap}
                        onChange={(e) => updateCaption(i, e.target.value)}
                        placeholder={`Caption ${i + 1}`}
                      />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeCaption(i)} className="shrink-0">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Image Generation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sceneDescription">Scene Description</Label>
                <Textarea 
                  id="sceneDescription"
                  rows={2}
                  placeholder="Plain English description for image generation..."
                  value={formData.sceneDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, sceneDescription: e.target.value }))}
                  data-testid="input-scene-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageGenPrompt">Prompt</Label>
                <Textarea 
                  id="imageGenPrompt"
                  rows={3}
                  placeholder="Detailed prompt for image generation..."
                  value={formData.imageGenPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageGenPrompt: e.target.value }))}
                  data-testid="input-image-prompt"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shotType">Shot Type</Label>
                  <Input 
                    id="shotType"
                    placeholder="e.g., medium, close_up, wide"
                    value={formData.imageGenShotType}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageGenShotType: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lighting">Lighting</Label>
                  <Input 
                    id="lighting"
                    placeholder="e.g., soft daylight"
                    value={formData.imageGenLighting}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageGenLighting: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="negativePrompt">Negative Prompt</Label>
                <Textarea 
                  id="negativePrompt"
                  rows={2}
                  placeholder="Things to avoid in the generated image..."
                  value={formData.imageGenNegativePrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageGenNegativePrompt: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Narration (TTS)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!voicesData?.configured ? (
                <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  TTS is not configured. Set up OPENAI_API_KEY and R2 storage credentials to enable narration.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="narrationEnabled">Enable Narration</Label>
                      <p className="text-sm text-muted-foreground">Generate AI voice narration for this card</p>
                    </div>
                    <Switch
                      id="narrationEnabled"
                      checked={formData.narrationEnabled}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, narrationEnabled: checked }))}
                      data-testid="switch-narration-enabled"
                    />
                  </div>

                  {formData.narrationEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="narrationText">Narration Text</Label>
                        <Textarea 
                          id="narrationText"
                          rows={4}
                          placeholder="Enter the text that will be converted to speech..."
                          value={formData.narrationText}
                          onChange={(e) => setFormData(prev => ({ ...prev, narrationText: e.target.value }))}
                          className="font-mono text-sm"
                          data-testid="input-narration-text"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formData.narrationText.length} / 3000 characters</span>
                          {formData.narrationText.length > 3000 && (
                            <span className="text-destructive">Exceeds limit</span>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="narrationVoice">Voice</Label>
                          <Select 
                            value={formData.narrationVoice} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, narrationVoice: v }))}
                          >
                            <SelectTrigger data-testid="select-narration-voice">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {voicesData?.voices?.map((voice: { id: string; name: string; description: string }) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.name} - {voice.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Speed: {formData.narrationSpeed.toFixed(1)}x</Label>
                          <Slider
                            value={[formData.narrationSpeed]}
                            onValueChange={([v]) => setFormData(prev => ({ ...prev, narrationSpeed: v }))}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            className="mt-3"
                            data-testid="slider-narration-speed"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0.5x</span>
                            <span>2.0x</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handlePreviewNarration}
                          disabled={!formData.narrationText.trim()}
                          className="gap-2"
                          data-testid="button-preview-narration"
                        >
                          {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {previewPlaying ? "Stop" : "Preview (300 chars)"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => saveNarrationMutation.mutate({
                            narrationEnabled: formData.narrationEnabled,
                            narrationText: formData.narrationText,
                            narrationVoice: formData.narrationVoice,
                            narrationSpeed: formData.narrationSpeed,
                          })}
                          disabled={saveNarrationMutation.isPending}
                          className="gap-2"
                          data-testid="button-save-narration"
                        >
                          {saveNarrationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Text
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => generateNarrationMutation.mutate()}
                          disabled={generateNarrationMutation.isPending || !formData.narrationText.trim() || formData.narrationText.length > 3000}
                          className="gap-2"
                          data-testid="button-generate-narration"
                        >
                          {generateNarrationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Generate Audio
                        </Button>
                      </div>

                      {card?.narrationStatus && card.narrationStatus !== "none" && (
                        <div className="p-3 bg-muted rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Narration Status</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              card.narrationStatus === "ready" ? "bg-green-500/20 text-green-600" :
                              card.narrationStatus === "generating" ? "bg-yellow-500/20 text-yellow-600" :
                              card.narrationStatus === "failed" ? "bg-red-500/20 text-red-600" :
                              "bg-muted-foreground/20"
                            }`}>
                              {card.narrationStatus}
                            </span>
                          </div>
                          {card.narrationStatus === "ready" && card.narrationAudioUrl && (
                            <div className="space-y-2">
                              <audio controls className="w-full h-10" src={card.narrationAudioUrl} data-testid="audio-narration" />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteNarrationMutation.mutate()}
                                disabled={deleteNarrationMutation.isPending}
                                className="gap-2"
                                data-testid="button-delete-narration"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Audio
                              </Button>
                            </div>
                          )}
                          {card.narrationStatus === "failed" && card.narrationError && (
                            <p className="text-sm text-destructive">{card.narrationError}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="w-5 h-5" />
                Video Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!videoConfig?.configured ? (
                <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  Video generation is not configured. Set up REPLICATE_API_TOKEN or KLING_API_KEY to enable AI video generation.
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select value={videoMode} onValueChange={(v) => setVideoMode(v as "text-to-video" | "image-to-video")}>
                        <SelectTrigger data-testid="select-video-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text-to-video">
                            <div className="flex items-center gap-2">
                              Text to Video
                            </div>
                          </SelectItem>
                          <SelectItem value="image-to-video" disabled={!card?.generatedImageUrl}>
                            <div className="flex items-center gap-2">
                              <Image className="w-4 h-4" />
                              Image to Video
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {videoMode === "image-to-video" && !card?.generatedImageUrl && (
                        <p className="text-xs text-muted-foreground">Generate an image first</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Select value={videoModel} onValueChange={setVideoModel}>
                        <SelectTrigger data-testid="select-video-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {videoConfig?.models?.map((m: { id: string; name: string; description: string; provider?: string }) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex flex-col">
                                <span>{m.name}</span>
                                <span className="text-xs text-muted-foreground">{m.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(parseInt(v) as 5 | 10)}>
                        <SelectTrigger data-testid="select-video-duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 seconds</SelectItem>
                          <SelectItem value="10">10 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="font-medium mb-1">Prompt Preview:</p>
                    <p className="text-muted-foreground">
                      {card?.sceneDescription || `${card?.title}. ${card?.sceneText}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => generateVideoMutation.mutate()}
                      disabled={generateVideoMutation.isPending || (card?.videoGenerationStatus === "processing")}
                      className="gap-2"
                      data-testid="button-generate-video"
                    >
                      {generateVideoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                      Generate Video
                    </Button>

                    {(card?.videoGenerationStatus === "processing" || card?.videoGenerationStatus === "pending") && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => checkVideoStatusMutation.mutate()}
                        disabled={checkVideoStatusMutation.isPending}
                        className="gap-2"
                        data-testid="button-check-video-status"
                      >
                        {checkVideoStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Check Status
                      </Button>
                    )}
                  </div>

                  {card?.videoGenerationStatus && card.videoGenerationStatus !== "none" && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Video Status</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          card.videoGenerationStatus === "completed" ? "bg-green-500/20 text-green-600" :
                          card.videoGenerationStatus === "processing" ? "bg-yellow-500/20 text-yellow-600" :
                          card.videoGenerationStatus === "pending" ? "bg-blue-500/20 text-blue-600" :
                          card.videoGenerationStatus === "failed" ? "bg-red-500/20 text-red-600" :
                          "bg-muted-foreground/20"
                        }`}>
                          {card.videoGenerationStatus}
                        </span>
                      </div>

                      {card.videoGenerationModel && (
                        <p className="text-xs text-muted-foreground">Model: {card.videoGenerationModel}</p>
                      )}

                      {card.videoGenerationStatus === "completed" && card.generatedVideoUrl && (
                        <div className="space-y-2">
                          <video 
                            controls 
                            className="w-full max-w-md rounded-lg" 
                            src={card.generatedVideoUrl}
                            poster={card.videoThumbnailUrl || undefined}
                            data-testid="video-generated"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={card.generatedVideoUrl} download target="_blank" rel="noopener noreferrer">
                                Download
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteVideoMutation.mutate()}
                              disabled={deleteVideoMutation.isPending}
                              className="gap-2"
                              data-testid="button-delete-video"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}

                      {card.videoGenerationStatus === "failed" && card.videoGenerationError && (
                        <p className="text-sm text-destructive">{card.videoGenerationError}</p>
                      )}

                      {card.videoGenerationStatus === "processing" && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Video is being generated... This typically takes 5-14 minutes.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
