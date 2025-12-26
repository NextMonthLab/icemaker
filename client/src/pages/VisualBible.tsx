import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Save, Trash2, Plus, Image as ImageIcon, User, MapPin, Palette, Settings, Eye, Loader2 } from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ReferenceAsset } from "@/lib/api";
import type { DesignGuide, Character, Location } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

type QualityLevel = "draft" | "standard" | "high" | "ultra";
type ConsistencyPriority = "speed" | "balanced" | "consistency";

const DEFAULT_DESIGN_GUIDE = {
  basePrompt: "",
  artStyle: "",
  colorPalette: "",
  moodTone: "",
  cameraStyle: "",
  lightingNotes: "",
  qualityLevel: "standard" as QualityLevel,
  consistencyPriority: "balanced" as ConsistencyPriority,
  defaultAspectRatio: "9:16",
  styleKeywords: [] as string[],
  requiredElements: [] as string[],
  avoidList: [] as string[],
  negativePrompt: "",
};

type LocalDesignGuide = typeof DEFAULT_DESIGN_GUIDE;

export default function VisualBible() {
  const { id } = useParams<{ id: string }>();
  const universeId = parseInt(id || "0");
  const queryClient = useQueryClient();
  
  const [designGuide, setDesignGuide] = useState<LocalDesignGuide>(DEFAULT_DESIGN_GUIDE);
  const [hasChanges, setHasChanges] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newRequired, setNewRequired] = useState("");
  const [newAvoid, setNewAvoid] = useState("");

  const { data: universe, isLoading: universeLoading } = useQuery({
    queryKey: ["universe", universeId],
    queryFn: () => api.getUniverse(universeId),
    enabled: universeId > 0,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", universeId],
    queryFn: () => api.getCharacters(universeId),
    enabled: universeId > 0,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", universeId],
    queryFn: () => api.getLocations(universeId),
    enabled: universeId > 0,
  });

  const { data: referenceAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ["referenceAssets", universeId],
    queryFn: () => api.getReferenceAssets(universeId),
    enabled: universeId > 0,
  });

  useEffect(() => {
    if (universe) {
      if (universe.designGuide) {
        const dg = universe.designGuide as Partial<LocalDesignGuide>;
        setDesignGuide({
          ...DEFAULT_DESIGN_GUIDE,
          ...dg,
          styleKeywords: dg.styleKeywords || [],
          requiredElements: dg.requiredElements || [],
          avoidList: dg.avoidList || [],
        });
      } else {
        setDesignGuide(DEFAULT_DESIGN_GUIDE);
        setHasChanges(true);
      }
    }
  }, [universe]);

  const saveDesignGuideMutation = useMutation({
    mutationFn: (guide: DesignGuide) => api.updateDesignGuide(universeId, guide),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universe", universeId] });
      setHasChanges(false);
      toast({ title: "Design guide saved" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadAssetMutation = useMutation({
    mutationFn: (formData: FormData) => api.createReferenceAsset(universeId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referenceAssets", universeId] });
      toast({ title: "Reference asset uploaded" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: number) => api.deleteReferenceAsset(assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referenceAssets", universeId] });
      toast({ title: "Reference asset deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof LocalDesignGuide>(field: K, value: LocalDesignGuide[K]) => {
    setDesignGuide(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const addToArray = (field: "styleKeywords" | "requiredElements" | "avoidList", value: string) => {
    if (!value.trim()) return;
    const current = designGuide[field];
    if (!current.includes(value.trim())) {
      setDesignGuide(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }));
      setHasChanges(true);
    }
  };

  const removeFromArray = (field: "styleKeywords" | "requiredElements" | "avoidList", value: string) => {
    setDesignGuide(prev => ({ ...prev, [field]: prev[field].filter(v => v !== value) }));
    setHasChanges(true);
  };

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetType: string, linkedId?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("assetType", assetType);
    formData.append("name", file.name.replace(/\.[^/.]+$/, ""));
    if (linkedId) {
      if (assetType === "character") {
        formData.append("characterId", linkedId.toString());
      } else if (assetType === "location") {
        formData.append("locationId", linkedId.toString());
      }
    }

    uploadAssetMutation.mutate(formData);
    e.target.value = "";
  };

  if (universeLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!universe) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Universe not found</p>
          <Link href="/admin">
            <Button variant="link">Back to Admin</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const groupedAssets = {
    style: (referenceAssets || []).filter(a => a.assetType === "style"),
    character: (referenceAssets || []).filter(a => a.assetType === "character"),
    location: (referenceAssets || []).filter(a => a.assetType === "location"),
    prop: (referenceAssets || []).filter(a => a.assetType === "prop"),
    color_palette: (referenceAssets || []).filter(a => a.assetType === "color_palette"),
  };

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Visual Bible</h1>
              <p className="text-muted-foreground">{universe.name}</p>
            </div>
          </div>
          <Button
            onClick={() => saveDesignGuideMutation.mutate(designGuide)}
            disabled={!hasChanges || saveDesignGuideMutation.isPending}
            data-testid="button-save-design-guide"
          >
            {saveDesignGuideMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="style" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="style" data-testid="tab-style">
              <Palette className="h-4 w-4 mr-2" />
              Style Guide
            </TabsTrigger>
            <TabsTrigger value="characters" data-testid="tab-characters">
              <User className="h-4 w-4 mr-2" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="locations" data-testid="tab-locations">
              <MapPin className="h-4 w-4 mr-2" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="assets" data-testid="tab-assets">
              <ImageIcon className="h-4 w-4 mr-2" />
              Reference Library
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="style" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Design Foundation</CardTitle>
                <CardDescription>Core visual settings that apply to all generated images and videos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="basePrompt">Base Prompt</Label>
                  <Textarea
                    id="basePrompt"
                    placeholder="Foundation prompt included in all generations (e.g., 'cinematic scene, dramatic lighting, 4K quality')"
                    value={designGuide.basePrompt || ""}
                    onChange={(e) => updateField("basePrompt", e.target.value)}
                    rows={3}
                    data-testid="input-base-prompt"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="artStyle">Art Style</Label>
                    <Input
                      id="artStyle"
                      placeholder="e.g., cinematic realism, stylized illustration"
                      value={designGuide.artStyle || ""}
                      onChange={(e) => updateField("artStyle", e.target.value)}
                      data-testid="input-art-style"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="colorPalette">Color Palette</Label>
                    <Input
                      id="colorPalette"
                      placeholder="e.g., warm earth tones, cool blues and grays"
                      value={designGuide.colorPalette || ""}
                      onChange={(e) => updateField("colorPalette", e.target.value)}
                      data-testid="input-color-palette"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="moodTone">Mood/Tone</Label>
                    <Input
                      id="moodTone"
                      placeholder="e.g., mysterious, hopeful, tense"
                      value={designGuide.moodTone || ""}
                      onChange={(e) => updateField("moodTone", e.target.value)}
                      data-testid="input-mood-tone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cameraStyle">Camera Style</Label>
                    <Input
                      id="cameraStyle"
                      placeholder="e.g., close-up portraits, wide establishing shots"
                      value={designGuide.cameraStyle || ""}
                      onChange={(e) => updateField("cameraStyle", e.target.value)}
                      data-testid="input-camera-style"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lightingNotes">Lighting Notes</Label>
                  <Textarea
                    id="lightingNotes"
                    placeholder="e.g., soft natural light during day scenes, harsh overhead lighting for tension"
                    value={designGuide.lightingNotes || ""}
                    onChange={(e) => updateField("lightingNotes", e.target.value)}
                    rows={2}
                    data-testid="input-lighting-notes"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualityLevel">Quality Level</Label>
                  <Select
                    value={designGuide.qualityLevel || "standard"}
                    onValueChange={(v) => updateField("qualityLevel", v as "draft" | "standard" | "high" | "ultra")}
                  >
                    <SelectTrigger data-testid="select-quality-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Fast)</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="high">High Quality</SelectItem>
                      <SelectItem value="ultra">Ultra (Slow)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Style Keywords</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add keyword"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addToArray("styleKeywords", newKeyword);
                          setNewKeyword("");
                        }
                      }}
                      data-testid="input-new-keyword"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        addToArray("styleKeywords", newKeyword);
                        setNewKeyword("");
                      }}
                      data-testid="button-add-keyword"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(designGuide.styleKeywords || []).map((kw) => (
                      <Badge
                        key={kw}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeFromArray("styleKeywords", kw)}
                      >
                        {kw} ×
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Required Elements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add element"
                      value={newRequired}
                      onChange={(e) => setNewRequired(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addToArray("requiredElements", newRequired);
                          setNewRequired("");
                        }
                      }}
                      data-testid="input-new-required"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        addToArray("requiredElements", newRequired);
                        setNewRequired("");
                      }}
                      data-testid="button-add-required"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(designGuide.requiredElements || []).map((el) => (
                      <Badge
                        key={el}
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => removeFromArray("requiredElements", el)}
                      >
                        {el} ×
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avoid List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add item to avoid"
                      value={newAvoid}
                      onChange={(e) => setNewAvoid(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addToArray("avoidList", newAvoid);
                          setNewAvoid("");
                        }
                      }}
                      data-testid="input-new-avoid"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        addToArray("avoidList", newAvoid);
                        setNewAvoid("");
                      }}
                      data-testid="button-add-avoid"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(designGuide.avoidList || []).map((item) => (
                      <Badge
                        key={item}
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => removeFromArray("avoidList", item)}
                      >
                        {item} ×
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Negative Prompt</CardTitle>
                <CardDescription>Elements to always exclude from generated images</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="e.g., blurry, low quality, distorted, ugly, deformed, text, watermark"
                  value={designGuide.negativePrompt || ""}
                  onChange={(e) => updateField("negativePrompt", e.target.value)}
                  rows={2}
                  data-testid="input-negative-prompt"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="characters" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Character Reference Images</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAssetUpload(e, "character")}
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Reference
                  </span>
                </Button>
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedAssets.character.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  characters={characters}
                  locations={locations}
                  onDelete={() => deleteAssetMutation.mutate(asset.id)}
                />
              ))}
              {groupedAssets.character.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No character references yet. Upload images to maintain visual consistency.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="locations" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Location Reference Images</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAssetUpload(e, "location")}
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Reference
                  </span>
                </Button>
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groupedAssets.location.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  characters={characters}
                  locations={locations}
                  onDelete={() => deleteAssetMutation.mutate(asset.id)}
                />
              ))}
              {groupedAssets.location.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No location references yet. Upload images to maintain consistent environments.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-6 mt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Reference Asset Library</h2>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAssetUpload(e, "style")}
                  />
                  <Button variant="outline" asChild>
                    <span>
                      <Palette className="h-4 w-4 mr-2" />
                      Style Reference
                    </span>
                  </Button>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAssetUpload(e, "prop")}
                  />
                  <Button variant="outline" asChild>
                    <span>
                      <Settings className="h-4 w-4 mr-2" />
                      Prop
                    </span>
                  </Button>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAssetUpload(e, "color_palette")}
                  />
                  <Button variant="outline" asChild>
                    <span>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Palette
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {assetsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedAssets).map(([type, assets]) => (
                  assets.length > 0 && (
                    <div key={type} className="space-y-4">
                      <h3 className="text-lg font-medium capitalize">{type.replace("_", " ")} References</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {assets.map((asset) => (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            characters={characters}
                            locations={locations}
                            onDelete={() => deleteAssetMutation.mutate(asset.id)}
                            compact
                          />
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {(referenceAssets || []).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No reference assets yet. Upload images to build your visual library.
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Generated Prompt Preview</CardTitle>
                <CardDescription>
                  This is how your design guide translates into generation prompts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Positive Prompt</Label>
                  <div className="mt-1 p-4 bg-muted rounded-lg text-sm">
                    {[
                      designGuide.basePrompt,
                      designGuide.artStyle && `Style: ${designGuide.artStyle}`,
                      designGuide.colorPalette && `Colors: ${designGuide.colorPalette}`,
                      designGuide.moodTone && `Mood: ${designGuide.moodTone}`,
                      designGuide.cameraStyle && `Camera: ${designGuide.cameraStyle}`,
                      designGuide.lightingNotes && `Lighting: ${designGuide.lightingNotes}`,
                      designGuide.styleKeywords?.length && designGuide.styleKeywords.join(", "),
                      designGuide.requiredElements?.length && `Include: ${designGuide.requiredElements.join(", ")}`,
                    ].filter(Boolean).join(". ") || "No design guide configured yet."}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Negative Prompt</Label>
                  <div className="mt-1 p-4 bg-muted rounded-lg text-sm">
                    {[
                      designGuide.negativePrompt,
                      ...(designGuide.avoidList || []),
                    ].filter(Boolean).join(", ") || "blurry, low quality, distorted, ugly, deformed"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function AssetCard({
  asset,
  characters,
  locations,
  onDelete,
  compact = false,
}: {
  asset: ReferenceAsset;
  characters?: Character[];
  locations?: Location[];
  onDelete: () => void;
  compact?: boolean;
}) {
  const linkedCharacter = characters?.find(c => c.id === asset.characterId);
  const linkedLocation = locations?.find(l => l.id === asset.locationId);

  if (compact) {
    return (
      <div className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
        <img
          src={asset.imagePath || ""}
          alt={asset.name || "Reference"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={onDelete}
            data-testid={`button-delete-asset-${asset.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs truncate">
          {asset.name}
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden group">
      <div className="aspect-square relative bg-muted">
        <img
          src={asset.imagePath || ""}
          alt={asset.name || "Reference"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            size="icon"
            variant="destructive"
            onClick={onDelete}
            data-testid={`button-delete-asset-${asset.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-3 space-y-1">
        <p className="font-medium text-sm truncate">{asset.name || "Untitled"}</p>
        {linkedCharacter && (
          <Badge variant="outline" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            {linkedCharacter.name}
          </Badge>
        )}
        {linkedLocation && (
          <Badge variant="outline" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            {linkedLocation.name}
          </Badge>
        )}
        {asset.promptNotes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{asset.promptNotes}</p>
        )}
      </CardContent>
    </Card>
  );
}
