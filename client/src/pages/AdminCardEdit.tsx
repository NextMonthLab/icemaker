import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, X, Plus, Trash2, Loader2 } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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
  });

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
        </div>
      </div>
    </Layout>
  );
}
