import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Image,
  Video,
  Loader2,
  Lock,
  Sparkles,
  Wand2,
  Music,
  Mic,
  ChevronRight,
  Settings2
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MediaGenerationPanelProps {
  previewId: string;
  cardId: string;
  cardTitle: string;
  cardContent: string;
  currentImageUrl?: string;
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  canGenerateVoiceover: boolean;
  onUpgradeClick: () => void;
  onMediaGenerated?: () => void;
}

interface LockedFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onUpgrade: () => void;
}

function LockedFeature({ icon, title, description, onUpgrade }: LockedFeatureProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center gap-3 opacity-100 transition-opacity">
        <Lock className="w-8 h-8 text-cyan-400" />
        <p className="text-sm text-slate-300 text-center px-4">{description}</p>
        <Button 
          size="sm" 
          onClick={onUpgrade}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          data-testid="button-upgrade-feature"
        >
          Upgrade to Unlock
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="opacity-30 pointer-events-none">
        <div className="p-4 border border-slate-700 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            {icon}
            <span className="font-medium text-white">{title}</span>
          </div>
          <div className="h-20 bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function MediaGenerationPanel({
  previewId,
  cardId,
  cardTitle,
  cardContent,
  currentImageUrl,
  canGenerateImages,
  canGenerateVideos,
  canGenerateVoiceover,
  onUpgradeClick,
  onMediaGenerated,
}: MediaGenerationPanelProps) {
  const [videoMode, setVideoMode] = useState<"text-to-video" | "image-to-video">("text-to-video");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(currentImageUrl || null);

  // Video engine selection state
  const [selectedEngine, setSelectedEngine] = useState<string>("auto");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | undefined>();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeDialogInfo, setUpgradeDialogInfo] = useState<{
    title: string;
    message: string;
    suggestedTier?: string;
  } | null>(null);

  // Fetch video configuration to get available engines and models
  const { data: videoConfig } = useQuery({
    queryKey: ["video-config"],
    queryFn: async () => {
      const res = await fetch("/api/video/config", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch video config");
      return res.json();
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingImage(true);
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${cardId}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: `${cardTitle}. ${cardContent}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate image");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedImageUrl(data.imageUrl);
      onMediaGenerated?.();
    },
    onSettled: () => {
      setIsGeneratingImage(false);
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingVideo(true);
      const res = await fetch(`/api/ice/preview/${previewId}/cards/${cardId}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: videoMode,
          prompt: `${cardTitle}. ${cardContent}`,
          sourceImageUrl: generatedImageUrl,
          engine: selectedEngine,
          model: showAdvanced ? selectedModel : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle VIDEO_MODEL_NOT_ALLOWED error with upgrade dialog
        if (data.error === "VIDEO_MODEL_NOT_ALLOWED") {
          setUpgradeDialogInfo({
            title: "Unlock Studio-grade Video",
            message: data.message || "This video engine requires a higher plan tier.",
            suggestedTier: data.suggestedTier,
          });
          setShowUpgradeDialog(true);
          throw new Error(data.message || "Model not allowed");
        }
        throw new Error(data.message || "Failed to generate video");
      }
      return data;
    },
    onSuccess: () => {
      onMediaGenerated?.();
    },
    onSettled: () => {
      setIsGeneratingVideo(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">AI Media Generation</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canGenerateImages ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Image className="w-4 h-4 text-cyan-400" />
                AI Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {generatedImageUrl ? (
                <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-slate-900">
                  <img 
                    src={generatedImageUrl} 
                    alt="Generated" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[9/16] rounded-lg bg-slate-900 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No image yet</p>
                  </div>
                </div>
              )}
              <Button
                onClick={() => generateImageMutation.mutate()}
                disabled={isGeneratingImage}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-generate-image"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {generatedImageUrl ? "Regenerate Image" : "Generate Image"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <LockedFeature
            icon={<Image className="w-5 h-5 text-cyan-400" />}
            title="AI Image Generation"
            description="Generate unique AI images for each card"
            onUpgrade={onUpgradeClick}
          />
        )}

        {canGenerateVideos ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Video className="w-4 h-4 text-blue-400" />
                AI Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Mode</Label>
                <Select value={videoMode} onValueChange={(v) => setVideoMode(v as any)}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="select-video-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-to-video">Text to Video</SelectItem>
                    <SelectItem value="image-to-video" disabled={!generatedImageUrl}>
                      Image to Video {!generatedImageUrl && "(generate image first)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Quality</Label>
                <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="select-video-engine">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoConfig?.engines?.map((engine: any) => (
                      <SelectItem
                        key={engine.engine}
                        value={engine.engine}
                        disabled={engine.locked}
                      >
                        <div className="flex items-center gap-2">
                          {engine.locked && <Lock className="w-3 h-3" />}
                          {engine.displayName}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEngine === "auto" && (
                  <p className="text-xs text-slate-500">Best for your plan</p>
                )}
                {selectedEngine !== "auto" && videoConfig?.videoModels && (
                  <p className="text-xs text-slate-500">
                    Powered by{" "}
                    {videoConfig.videoModels.find(
                      (m: any) =>
                        videoConfig.engines
                          .find((e: any) => e.engine === selectedEngine)
                          ?.models?.includes(m.model)
                    )?.displayName || "quality model"}
                  </p>
                )}
              </div>

              {videoConfig?.allowedModels && videoConfig.allowedModels.length > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="advanced-mode"
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                    className="data-[state=checked]:bg-cyan-600"
                  />
                  <Label htmlFor="advanced-mode" className="text-xs text-slate-400 cursor-pointer">
                    <div className="flex items-center gap-1">
                      <Settings2 className="w-3 h-3" />
                      Advanced
                    </div>
                  </Label>
                </div>
              )}

              {showAdvanced && videoConfig?.videoModels && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Provider Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="select-video-model">
                      <SelectValue placeholder="Auto-select" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoConfig.videoModels.map((model: any) => (
                        <SelectItem
                          key={model.model}
                          value={model.model}
                          disabled={model.locked}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2">
                              {model.locked && <Lock className="w-3 h-3" />}
                              {model.displayName}
                            </div>
                            <span className="text-xs text-slate-500">
                              ${model.costPer5s}/5s
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={() => generateVideoMutation.mutate()}
                disabled={isGeneratingVideo || (videoMode === "image-to-video" && !generatedImageUrl)}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="button-generate-video"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Generate Video
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <LockedFeature
            icon={<Video className="w-5 h-5 text-blue-400" />}
            title="AI Video Generation"
            description="Create cinematic video clips from your cards"
            onUpgrade={onUpgradeClick}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canGenerateVoiceover ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-white">
                <Mic className="w-4 h-4 text-cyan-400" />
                AI Voiceover
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-700"
                data-testid="button-generate-voiceover"
              >
                <Mic className="w-4 h-4 mr-2" />
                Generate Voiceover
              </Button>
            </CardContent>
          </Card>
        ) : (
          <LockedFeature
            icon={<Mic className="w-5 h-5 text-cyan-400" />}
            title="AI Voiceover"
            description="Add professional narration to your cards"
            onUpgrade={onUpgradeClick}
          />
        )}

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-white">
              <Music className="w-4 h-4 text-emerald-400" />
              Background Music
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-700"
              data-testid="button-add-music"
            >
              <Music className="w-4 h-4 mr-2" />
              Add Music
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Dialog for Locked Engines */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              {upgradeDialogInfo?.title || "Upgrade Required"}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {upgradeDialogInfo?.message ||
                "This feature requires a higher plan tier."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-800 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm text-slate-200">Upgrade Benefits:</h4>
              <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                <li>Higher realism and quality</li>
                <li>Smoother motion and transitions</li>
                <li>Priority rendering</li>
                <li>Access to all video models</li>
              </ul>
            </div>
            {upgradeDialogInfo?.suggestedTier && (
              <p className="text-sm text-slate-400">
                Suggested plan:{" "}
                <span className="font-medium text-cyan-400 capitalize">
                  {upgradeDialogInfo.suggestedTier}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Not now
            </Button>
            <Button
              onClick={() => {
                setShowUpgradeDialog(false);
                onUpgradeClick();
              }}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            >
              Upgrade Now
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CompactMediaControls({
  canGenerate,
  onUpgradeClick,
  onGenerateImage,
  onGenerateVideo,
  isGeneratingImage,
  isGeneratingVideo,
  hasImage,
}: {
  canGenerate: boolean;
  onUpgradeClick: () => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  hasImage: boolean;
}) {
  if (!canGenerate) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onUpgradeClick}
        className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20"
        data-testid="button-upgrade-media"
      >
        <Lock className="w-3 h-3 mr-1" />
        Upgrade for AI Media
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onGenerateImage}
        disabled={isGeneratingImage}
        className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20"
        data-testid="button-quick-generate-image"
      >
        {isGeneratingImage ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <Image className="w-3 h-3 mr-1" />
            Image
          </>
        )}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onGenerateVideo}
        disabled={isGeneratingVideo || !hasImage}
        className="border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
        data-testid="button-quick-generate-video"
      >
        {isGeneratingVideo ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <Video className="w-3 h-3 mr-1" />
            Video
          </>
        )}
      </Button>
    </div>
  );
}
