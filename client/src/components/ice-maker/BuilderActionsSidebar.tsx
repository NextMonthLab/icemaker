import { useState } from "react";
import { ChevronLeft, ChevronRight, Music, Mic, Image, Upload, Wand2, Video, Download, Loader2, Globe, Lock, Share2, Lightbulb, BookOpen, X, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { CaptionStylePicker } from "@/components/ice-maker/CaptionStylePicker";
import { EnterpriseBrandingUpsell } from "@/components/EnterpriseBrandingUpsell";
import type { CaptionState } from "@/caption-engine/schemas";

interface MusicTrack {
  id: string;
  name: string;
  url: string | null;
  category: string | null;
}

interface BuilderActionsSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isProfessionalMode: boolean;
  musicTracks: MusicTrack[];
  musicTrackUrl: string | null;
  setMusicTrackUrl: (url: string | null) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  musicVolume: number;
  setMusicVolume: (volume: number) => void;
  isPreviewingMusic: boolean;
  toggleMusicPreview: () => void;
  narrationVolume: number;
  setNarrationVolume: (volume: number) => void;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  logoEnabled: boolean;
  setLogoEnabled: (enabled: boolean) => void;
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  setLogoPosition: (position: "top-left" | "top-right" | "bottom-left" | "bottom-right") => void;
  isUploadingLogo: boolean;
  handleLogoUpload: (file: File) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  user: any;
  captionState: CaptionState;
  setCaptionState: (state: CaptionState) => void;
  cardsNeedingImages: any[];
  cardsNeedingVideos: any[];
  entitlements: any;
  bulkGeneratingImages: boolean;
  bulkGeneratingVideos: boolean;
  bulkProgress: { current: number; total: number };
  setShowBulkImageConfirm: (show: boolean) => void;
  setShowBulkVideoConfirm: (show: boolean) => void;
  exportStatus: any;
  exportMutation: any;
  cardsLength: number;
  iceVisibility: "private" | "unlisted" | "public";
  setShowPublishModal: (show: boolean) => void;
  setShowStoryStructure: (show: boolean) => void;
  showBiblePanel: boolean;
  setShowBiblePanel: (show: boolean) => void;
  projectBible: any;
}

export function BuilderActionsSidebar({
  isCollapsed,
  onToggleCollapse,
  isProfessionalMode,
  musicTracks,
  musicTrackUrl,
  setMusicTrackUrl,
  musicEnabled,
  setMusicEnabled,
  musicVolume,
  setMusicVolume,
  isPreviewingMusic,
  toggleMusicPreview,
  narrationVolume,
  setNarrationVolume,
  logoUrl,
  setLogoUrl,
  logoEnabled,
  setLogoEnabled,
  logoPosition,
  setLogoPosition,
  isUploadingLogo,
  handleLogoUpload,
  logoInputRef,
  user,
  captionState,
  setCaptionState,
  cardsNeedingImages,
  cardsNeedingVideos,
  entitlements,
  bulkGeneratingImages,
  bulkGeneratingVideos,
  bulkProgress,
  setShowBulkImageConfirm,
  setShowBulkVideoConfirm,
  exportStatus,
  exportMutation,
  cardsLength,
  iceVisibility,
  setShowPublishModal,
  setShowStoryStructure,
  showBiblePanel,
  setShowBiblePanel,
  projectBible,
}: BuilderActionsSidebarProps) {
  const [showCaptionSettings, setShowCaptionSettings] = useState(false);

  if (isCollapsed) {
    return (
      <div className="sticky top-20 h-fit">
        <button
          onClick={onToggleCollapse}
          className="p-2 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.05] transition-colors"
          data-testid="button-expand-sidebar"
          title="Expand sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
        </button>
      </div>
    );
  }

  return (
    <div className="sticky top-20 h-fit space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white/70">Actions</h3>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          data-testid="button-collapse-sidebar"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {isProfessionalMode && (
        <>
          {(cardsNeedingImages.length > 0 || cardsNeedingVideos.length > 0) && entitlements && (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-medium text-white">Generate AI Media</h4>
              </div>
              <div className="flex flex-col gap-2">
                {cardsNeedingImages.length > 0 && entitlements.canGenerateImages && (
                  <Button
                    onClick={() => setShowBulkImageConfirm(true)}
                    disabled={bulkGeneratingImages || bulkGeneratingVideos}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-1.5"
                    data-testid="sidebar-bulk-generate-images"
                  >
                    {bulkGeneratingImages ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {bulkProgress.current}/{bulkProgress.total}
                      </>
                    ) : (
                      <>
                        <Image className="w-3.5 h-3.5" />
                        Generate Images ({cardsNeedingImages.length})
                      </>
                    )}
                  </Button>
                )}
                {cardsNeedingVideos.length > 0 && entitlements.canGenerateVideos && (
                  <Button
                    onClick={() => setShowBulkVideoConfirm(true)}
                    disabled={bulkGeneratingVideos || bulkGeneratingImages}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-1.5"
                    data-testid="sidebar-bulk-generate-videos"
                  >
                    {bulkGeneratingVideos ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {bulkProgress.current}/{bulkProgress.total}
                      </>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5" />
                        Generate Videos ({cardsNeedingVideos.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {exportStatus?.status === "completed" && exportStatus.outputUrl ? (
              <a
                href={exportStatus.outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors"
                data-testid="sidebar-download-video"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            ) : exportStatus && exportStatus.status !== "failed" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 rounded-md">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span className="text-xs text-white">{exportStatus.progress}%</span>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || cardsLength === 0}
                className="gap-1.5"
                data-testid="sidebar-export-video"
              >
                {exportMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export
              </Button>
            )}

            <Button
              variant={iceVisibility === "public" ? "default" : iceVisibility === "unlisted" ? "outline" : "ghost"}
              size="sm"
              onClick={() => setShowPublishModal(true)}
              disabled={cardsLength === 0}
              className={`gap-1.5 ${
                iceVisibility === "public" 
                  ? "bg-green-600 text-white" 
                  : iceVisibility === "unlisted"
                  ? "border-cyan-500/40 text-cyan-400"
                  : ""
              }`}
              data-testid="sidebar-publish"
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

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStoryStructure(true)}
              className="gap-1.5 text-cyan-400"
              data-testid="sidebar-story-tips"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Tips
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBiblePanel(true)}
              className="gap-1.5"
              data-testid="sidebar-project-bible"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Bible
              {projectBible && (
                <span className="ml-1 bg-cyan-500/30 text-cyan-200 px-1 rounded text-xs">v{projectBible.version}</span>
              )}
            </Button>
          </div>
        </>
      )}

      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Music className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-medium text-white">Background Music</h4>
        </div>
        <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 mb-2">
          <select
            value={musicTrackUrl || "none"}
            onChange={(e) => {
              const track = musicTracks.find(t => (t.url || "none") === e.target.value);
              setMusicTrackUrl(track?.url || null);
              setMusicEnabled(!!track?.url);
            }}
            className="flex-1 bg-transparent text-sm text-white border-none outline-none cursor-pointer"
            data-testid="sidebar-select-music"
          >
            <option value="none" className="bg-slate-900 text-white">No Music</option>
            <optgroup label="Chill & Ambient" className="bg-slate-900 text-white">
              {musicTracks.filter(t => t.category === "chill").map((track) => (
                <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                  {track.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Vlog & Upbeat" className="bg-slate-900 text-white">
              {musicTracks.filter(t => t.category === "vlog").map((track) => (
                <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                  {track.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pop & Modern" className="bg-slate-900 text-white">
              {musicTracks.filter(t => t.category === "pop").map((track) => (
                <option key={track.id} value={track.url || "none"} className="bg-slate-900 text-white">
                  {track.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cinematic & Epic" className="bg-slate-900 text-white">
              {musicTracks.filter(t => t.category === "cinematic").map((track) => (
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
              data-testid="sidebar-preview-music"
            >
              {isPreviewingMusic ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
        {musicEnabled && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/60 w-12">Volume</span>
            <Slider
              value={[musicVolume]}
              onValueChange={([v]) => setMusicVolume(v)}
              min={0}
              max={100}
              step={5}
              className="flex-1"
              data-testid="sidebar-music-volume"
            />
            <span className="text-xs text-white/50 w-8">{musicVolume}%</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 w-12 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Voice
          </span>
          <Slider
            value={[narrationVolume]}
            onValueChange={([v]) => setNarrationVolume(v)}
            min={0}
            max={100}
            step={5}
            className="flex-1"
            data-testid="sidebar-narration-volume"
          />
          <span className="text-xs text-white/50 w-8">{narrationVolume}%</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5">
          <EnterpriseBrandingUpsell context="audio" variant="compact" />
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Image className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-medium text-white">Logo Branding</h4>
        </div>
        <div className="flex items-center gap-3 mb-2">
          {logoUrl ? (
            <div className="relative group">
              <div className="w-10 h-10 rounded-lg bg-black/30 border border-white/10 overflow-hidden flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <button
                onClick={() => {
                  setLogoUrl(null);
                  setLogoEnabled(false);
                }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid="sidebar-remove-logo"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo || !user}
              className="w-10 h-10 rounded-lg bg-black/30 border border-dashed border-white/20 flex items-center justify-center hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              data-testid="sidebar-upload-logo"
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
            data-testid="sidebar-logo-file"
          />
          {logoUrl && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={logoEnabled}
                onChange={(e) => setLogoEnabled(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-8 h-4 rounded-full transition-colors ${logoEnabled ? "bg-cyan-500" : "bg-white/20"}`}>
                <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${logoEnabled ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-xs text-white/60">{logoEnabled ? "On" : "Off"}</span>
            </label>
          )}
        </div>
        {logoUrl && logoEnabled && (
          <select
            value={logoPosition}
            onChange={(e) => setLogoPosition(e.target.value as typeof logoPosition)}
            className="w-full bg-black/30 text-sm text-white border border-white/10 rounded-lg px-2 py-1.5 outline-none cursor-pointer mb-2"
            data-testid="sidebar-logo-position"
          >
            <option value="top-left" className="bg-slate-900">Top Left</option>
            <option value="top-right" className="bg-slate-900">Top Right</option>
            <option value="bottom-left" className="bg-slate-900">Bottom Left</option>
            <option value="bottom-right" className="bg-slate-900">Bottom Right</option>
          </select>
        )}
        <div className="mt-2 pt-2 border-t border-white/5">
          <EnterpriseBrandingUpsell context="assets" variant="compact" />
        </div>
      </div>

      <Collapsible open={showCaptionSettings} onOpenChange={setShowCaptionSettings}>
        <CollapsibleTrigger asChild>
          <button 
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.05] transition-colors"
            data-testid="sidebar-toggle-captions"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">Caption Settings</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showCaptionSettings ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
            <CaptionStylePicker
              captionState={captionState}
              onStateChange={setCaptionState}
            />
            <div className="mt-3 pt-2 border-t border-white/5">
              <EnterpriseBrandingUpsell context="captions" variant="compact" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
