import { useState, useRef, useEffect, useMemo } from "react";
import { Image, Video, Upload, Loader2, Check, Trash2, Plus, FolderOpen, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface MediaAsset {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  source: "upload" | "ai";
  createdAt: string;
  prompt?: string;
  cardId?: string;
}

interface CardData {
  id: string;
  title?: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
}

interface MediaLibraryPanelProps {
  previewId: string;
  selectedCardId: string | null;
  onApplyToCard: (cardId: string, mediaType: "image" | "video", url: string) => void;
  cards?: CardData[];
}

export function MediaLibraryPanel({
  previewId,
  selectedCardId,
  onApplyToCard,
  cards = [],
}: MediaLibraryPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAssets, setUploadedAssets] = useState<MediaAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const aiGeneratedAssets = useMemo(() => {
    const assets: MediaAsset[] = [];
    cards.forEach((card) => {
      if (card.generatedImageUrl) {
        assets.push({
          id: `ai-img-${card.id}`,
          type: "image",
          url: card.generatedImageUrl,
          source: "ai",
          createdAt: new Date().toISOString(),
          cardId: card.id,
        });
      }
      if (card.generatedVideoUrl) {
        assets.push({
          id: `ai-vid-${card.id}`,
          type: "video",
          url: card.generatedVideoUrl,
          source: "ai",
          createdAt: new Date().toISOString(),
          cardId: card.id,
        });
      }
    });
    return assets;
  }, [cards]);

  const mediaAssets = useMemo(() => {
    return [...uploadedAssets, ...aiGeneratedAssets];
  }, [uploadedAssets, aiGeneratedAssets]);

  const handleUpload = async (file: File, type: "image" | "video") => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          context: "media-library",
        }),
      });

      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadURL, true);
        xhr.setRequestHeader("Content-Type", file.type);
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      const publicUrl = `/api/object-storage/${objectPath}`;
      
      const newAsset: MediaAsset = {
        id: `asset_${Date.now()}`,
        type,
        url: publicUrl,
        source: "upload",
        createdAt: new Date().toISOString(),
      };

      setMediaAssets((prev) => [newAsset, ...prev]);
      
      toast({
        title: `${type === "image" ? "Image" : "Video"} uploaded!`,
        description: "Your media has been added to the library.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file, "image");
    }
    e.target.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file, "video");
    }
    e.target.value = "";
  };

  const handleApplyToCard = (asset: MediaAsset) => {
    if (!selectedCardId) {
      toast({
        title: "No card selected",
        description: "Click on a card first, then apply media to it.",
        variant: "destructive",
      });
      return;
    }
    
    onApplyToCard(selectedCardId, asset.type, asset.url);
    setSelectedAssetId(asset.id);
    
    toast({
      title: "Media applied!",
      description: `${asset.type === "image" ? "Image" : "Video"} has been added to your card.`,
    });
  };

  const handleDeleteAsset = (assetId: string) => {
    setMediaAssets((prev) => prev.filter((a) => a.id !== assetId));
    if (selectedAssetId === assetId) {
      setSelectedAssetId(null);
    }
    toast({
      title: "Media removed",
      description: "The media has been removed from your library.",
    });
  };

  const images = mediaAssets.filter((a) => a.type === "image");
  const videos = mediaAssets.filter((a) => a.type === "video");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg hover:from-cyan-500/15 hover:to-blue-500/15 transition-colors"
          data-testid="button-toggle-media-library"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Your Media</span>
            <span className="text-xs text-white/50 ml-2">
              {mediaAssets.length} {mediaAssets.length === 1 ? "item" : "items"}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-4">
          {/* Upload buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              variant="outline"
              className="flex-1 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 gap-2"
              data-testid="button-upload-library-image"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              Upload Image
            </Button>
            <Button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploading}
              variant="outline"
              className="flex-1 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 gap-2"
              data-testid="button-upload-library-video"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Video className="w-4 h-4" />
              )}
              Upload Video
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              data-testid="input-library-image"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoSelect}
              data-testid="input-library-video"
            />
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Uploading...</span>
                <span className="text-cyan-400">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {mediaAssets.length === 0 && !uploading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-cyan-400/60" />
              </div>
              <p className="text-white/60 text-sm">No media uploaded yet</p>
              <p className="text-white/40 text-xs mt-1">
                Upload images or videos to use across your cards
              </p>
            </div>
          )}

          {/* Images section */}
          {images.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white/80">Images</span>
                <span className="text-xs text-white/40">({images.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {images.map((asset) => (
                  <div
                    key={asset.id}
                    className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedAssetId === asset.id
                        ? "border-cyan-400 ring-2 ring-cyan-400/30"
                        : "border-transparent hover:border-cyan-500/50"
                    }`}
                    onClick={() => handleApplyToCard(asset)}
                    data-testid={`media-library-image-${asset.id}`}
                  >
                    <img
                      src={asset.url}
                      alt="Uploaded media"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyToCard(asset);
                        }}
                        className="p-2 bg-cyan-500 rounded-full hover:bg-cyan-400"
                        title="Apply to card"
                        data-testid={`button-apply-image-${asset.id}`}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset.id);
                        }}
                        className="p-2 bg-red-500 rounded-full hover:bg-red-400"
                        title="Delete"
                        data-testid={`button-delete-image-${asset.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {asset.source === "ai" && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-purple-500/80 rounded text-[10px] text-white font-medium">
                        AI
                      </div>
                    )}
                    {selectedAssetId === asset.id && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos section */}
          {videos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-white/80">Videos</span>
                <span className="text-xs text-white/40">({videos.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {videos.map((asset) => (
                  <div
                    key={asset.id}
                    className={`relative group aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedAssetId === asset.id
                        ? "border-blue-400 ring-2 ring-blue-400/30"
                        : "border-transparent hover:border-blue-500/50"
                    }`}
                    onClick={() => handleApplyToCard(asset)}
                    data-testid={`media-library-video-${asset.id}`}
                  >
                    <video
                      src={asset.url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Video className="w-6 h-6 text-white/60" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyToCard(asset);
                        }}
                        className="p-2 bg-blue-500 rounded-full hover:bg-blue-400"
                        title="Apply to card"
                        data-testid={`button-apply-video-${asset.id}`}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAsset(asset.id);
                        }}
                        className="p-2 bg-red-500 rounded-full hover:bg-red-400"
                        title="Delete"
                        data-testid={`button-delete-video-${asset.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {asset.source === "ai" && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-purple-500/80 rounded text-[10px] text-white font-medium">
                        AI
                      </div>
                    )}
                    {selectedAssetId === asset.id && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint for applying media */}
          {mediaAssets.length > 0 && !selectedCardId && (
            <div className="text-center py-2 px-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-300 text-xs">
                Click on a card above to select it, then click any media to apply it
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
