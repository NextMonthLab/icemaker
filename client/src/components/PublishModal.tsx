import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Globe, 
  Link2, 
  Lock, 
  Copy, 
  Check,
  Loader2,
  ExternalLink,
  Eye,
  Users,
  Shield,
  Mail,
  AlertCircle,
  QrCode,
  Download,
  Code,
  Share2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentVisibility, IceCategory } from "@shared/schema";
import { ICE_CATEGORIES } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import QRCode from "qrcode";
import { ICE_CATEGORY_LABELS } from "@/lib/categoryLabels";

// Media asset from cards for thumbnail selection
interface MediaOption {
  id: string;
  url: string;
  cardIndex: number;
  cardTitle: string;
}

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewId: string;
  currentVisibility: ContentVisibility;
  shareSlug?: string | null;
  leadGateEnabled?: boolean;
  leadGatePrompt?: string | null;
  totalCards?: number;
  cardsWithMedia?: number;
  // New publishing metadata
  currentTitle?: string;
  currentDescription?: string | null;
  currentThumbnailUrl?: string | null;
  currentCategory?: IceCategory | null;
  availableMedia?: MediaOption[];
  onPublishComplete?: (data: {
    visibility: ContentVisibility;
    shareSlug: string | null;
    shareUrl: string | null;
    leadGateEnabled?: boolean;
    leadGatePrompt?: string | null;
    title?: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    category?: IceCategory | null;
  }) => void;
}

type VisibilityOption = {
  value: ContentVisibility;
  label: string;
  description: string;
  icon: typeof Lock;
  color: string;
};

const visibilityOptions: VisibilityOption[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you can view this ICE. Perfect for drafts and work in progress.",
    icon: Lock,
    color: "text-slate-400",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    description: "Anyone with the link can view. Not discoverable in search or gallery.",
    icon: Link2,
    color: "text-cyan-400",
  },
  {
    value: "public",
    label: "Public",
    description: "Visible to everyone. Can be discovered in the public gallery.",
    icon: Globe,
    color: "text-green-400",
  },
];

export function PublishModal({
  isOpen,
  onClose,
  previewId,
  currentVisibility,
  shareSlug,
  leadGateEnabled: initialLeadGateEnabled = false,
  leadGatePrompt: initialLeadGatePrompt = null,
  totalCards = 0,
  cardsWithMedia = 0,
  currentTitle = "",
  currentDescription = null,
  currentThumbnailUrl = null,
  currentCategory = null,
  availableMedia = [],
  onPublishComplete,
}: PublishModalProps) {
  const { toast } = useToast();
  const [selectedVisibility, setSelectedVisibility] = useState<ContentVisibility>(currentVisibility);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    shareSlug ? `${window.location.origin}/ice/${shareSlug}` : null
  );
  const [leadGateEnabled, setLeadGateEnabled] = useState(initialLeadGateEnabled);
  const [leadGatePrompt, setLeadGatePrompt] = useState(initialLeadGatePrompt || "");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  
  // New publishing metadata state
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription || "");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(currentThumbnailUrl);
  const [category, setCategory] = useState<IceCategory | null>(currentCategory);
  
  const embedCode = shareUrl 
    ? `<iframe src="${shareUrl}?embed=true" width="360" height="640" frameborder="0" allow="autoplay; fullscreen" allowfullscreen style="border-radius: 16px; overflow: hidden;"></iframe>`
    : null;

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    } else {
      setQrCodeDataUrl(null);
    }
  }, [shareUrl]);

  const publishMutation = useMutation({
    mutationFn: async (visibility: ContentVisibility) => {
      const response = await apiRequest("PUT", `/api/ice/preview/${previewId}/publish`, { 
        visibility,
        leadGateEnabled,
        leadGatePrompt: leadGatePrompt || null,
        title: title.trim() || undefined,
        description: description.trim() || null,
        thumbnailUrl: thumbnailUrl || null,
        category: category || null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const newShareUrl = data.shareUrl || (data.shareSlug ? `${window.location.origin}/ice/${data.shareSlug}` : null);
      setShareUrl(newShareUrl);
      
      toast({
        title: selectedVisibility === "private" ? "ICE set to private" : "ICE published!",
        description: selectedVisibility === "private" 
          ? "Only you can view this ICE now."
          : `Your ICE is now ${selectedVisibility}. Share the link!`,
      });
      
      onPublishComplete?.({
        visibility: data.visibility,
        shareSlug: data.shareSlug,
        shareUrl: newShareUrl,
        leadGateEnabled,
        leadGatePrompt: leadGatePrompt || null,
        title: title.trim() || undefined,
        description: description.trim() || null,
        thumbnailUrl,
        category,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to publish",
        description: error.message || "Please try again.",
      });
    },
  });

  const handlePublish = () => {
    publishMutation.mutate(selectedVisibility);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy the link manually",
      });
    }
  };

  const handleCopyEmbed = async () => {
    if (!embedCode) return;
    
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
      toast({ title: "Embed code copied to clipboard" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy the code manually",
      });
    }
  };

  const hasChanges = selectedVisibility !== currentVisibility || 
    leadGateEnabled !== initialLeadGateEnabled || 
    leadGatePrompt !== (initialLeadGatePrompt || "");
  const isPublished = currentVisibility !== "private" && shareUrl;
  
  const minCardsForPublic = 3;
  const isReadyForPublic = totalCards >= minCardsForPublic && cardsWithMedia >= Math.min(minCardsForPublic, totalCards);
  const publicBlockedReason = !isReadyForPublic 
    ? totalCards < minCardsForPublic 
      ? `Need at least ${minCardsForPublic} cards (you have ${totalCards})`
      : `Add media to your cards (${cardsWithMedia}/${totalCards} have media)`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-cyan-500/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Publish ICE
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Control who can view and discover your ICE content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Share section - shown prominently at top when already published */}
          {isPublished && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-4">
              <label className="text-sm font-medium text-white mb-3 block flex items-center gap-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                Share Your ICE
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
                  <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-sm text-white truncate">{shareUrl}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0 border-cyan-500/50 bg-cyan-500/20 hover:bg-cyan-500/30"
                  data-testid="button-copy-share-link-top"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-cyan-400" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(shareUrl!, '_blank')}
                  className="shrink-0 border-cyan-500/50 hover:bg-cyan-500/20"
                  data-testid="button-open-share-link-top"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                </Button>
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  data-testid="button-toggle-qr-top"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR Code</span>
                </button>
                <button
                  onClick={() => setShowEmbedCode(!showEmbedCode)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  data-testid="button-toggle-embed-top"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Embed</span>
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedVisibility === option.value;
              const isPublicBlocked = option.value === "public" && !isReadyForPublic;
              
              return (
                <motion.button
                  key={option.value}
                  onClick={() => !isPublicBlocked && setSelectedVisibility(option.value)}
                  disabled={isPublicBlocked}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    isPublicBlocked
                      ? "bg-slate-800/30 border-slate-700/30 cursor-not-allowed opacity-60"
                      : isSelected
                      ? "bg-cyan-500/10 border-cyan-500/50"
                      : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                  }`}
                  whileHover={isPublicBlocked ? {} : { scale: 1.01 }}
                  whileTap={isPublicBlocked ? {} : { scale: 0.99 }}
                  data-testid={`button-visibility-${option.value}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${isPublicBlocked ? "text-slate-500" : option.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={isPublicBlocked ? "text-slate-500 font-medium" : "text-white font-medium"}>{option.label}</span>
                        {isSelected && !isPublicBlocked && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 rounded-full bg-cyan-400"
                          />
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 ${isPublicBlocked ? "text-slate-600" : "text-slate-400"}`}>{option.description}</p>
                      {isPublicBlocked && publicBlockedReason && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400/80">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{publicBlockedReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {selectedVisibility !== "private" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-2"
              >
                {/* Publishing Metadata Section */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 space-y-4">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    Listing Details
                  </h3>
                  
                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ice-title" className="text-xs text-slate-400">Title</Label>
                    <Input
                      id="ice-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Give your ICE a catchy title"
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                      data-testid="input-publish-title"
                    />
                  </div>
                  
                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ice-description" className="text-xs text-slate-400">Description</Label>
                    <Textarea
                      id="ice-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this ICE about? Help others discover it..."
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                      rows={2}
                      data-testid="input-publish-description"
                    />
                  </div>
                  
                  {/* Category */}
                  <div className="space-y-1.5">
                    <Label htmlFor="ice-category" className="text-xs text-slate-400">Category</Label>
                    <Select value={category || ""} onValueChange={(v) => setCategory(v as IceCategory || null)}>
                      <SelectTrigger 
                        className="bg-slate-900 border-slate-600 text-white"
                        data-testid="select-publish-category"
                      >
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {ICE_CATEGORIES.map((cat) => (
                          <SelectItem 
                            key={cat} 
                            value={cat}
                            className="text-white hover:bg-slate-700 focus:bg-slate-700"
                          >
                            {ICE_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Thumbnail Picker */}
                  {availableMedia.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Thumbnail</Label>
                      <ScrollArea className="w-full whitespace-nowrap pb-2">
                        <div className="flex gap-2">
                          {availableMedia.map((media) => (
                            <button
                              key={media.id}
                              onClick={() => setThumbnailUrl(media.url)}
                              className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                                thumbnailUrl === media.url
                                  ? "border-cyan-400 ring-2 ring-cyan-400/30"
                                  : "border-slate-600 hover:border-slate-500"
                              }`}
                              data-testid={`button-thumbnail-${media.id}`}
                            >
                              <img
                                src={media.url}
                                alt={`Card ${media.cardIndex + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {thumbnailUrl === media.url && (
                                <div className="absolute inset-0 bg-cyan-400/20 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-cyan-400" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-slate-500">
                        Select an image to use as the cover thumbnail
                      </p>
                    </div>
                  )}
                </div>

                {/* Lead Gate Section */}
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-cyan-400" />
                      <Label htmlFor="lead-gate" className="text-sm text-white cursor-pointer">
                        Require email to view
                      </Label>
                    </div>
                    <Switch
                      id="lead-gate"
                      checked={leadGateEnabled}
                      onCheckedChange={setLeadGateEnabled}
                      data-testid="switch-lead-gate"
                    />
                  </div>
                  <AnimatePresence>
                    {leadGateEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3"
                      >
                        <Input
                          placeholder="Custom prompt (optional)"
                          value={leadGatePrompt}
                          onChange={(e) => setLeadGatePrompt(e.target.value)}
                          className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                          data-testid="input-lead-gate-prompt"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Default: "Enter your email to continue watching"
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isPublished && selectedVisibility !== "private" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2"
              >
                <label className="text-xs text-slate-400 mb-2 block">Share Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
                    <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-sm text-white truncate">{shareUrl}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0 border-cyan-500/30 hover:bg-cyan-500/10"
                    data-testid="button-copy-share-link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-cyan-400" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(shareUrl!, '_blank')}
                    className="shrink-0 border-cyan-500/30 hover:bg-cyan-500/10"
                    data-testid="button-open-share-link"
                  >
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                  </Button>
                </div>
                
                <AnimatePresence>
                  {qrCodeDataUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3"
                    >
                      <button
                        onClick={() => setShowQrCode(!showQrCode)}
                        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        data-testid="button-toggle-qr"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{showQrCode ? "Hide QR Code" : "Show QR Code"}</span>
                      </button>
                      
                      <AnimatePresence>
                        {showQrCode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 flex flex-col items-center gap-3"
                          >
                            <div className="bg-white p-3 rounded-lg">
                              <img 
                                src={qrCodeDataUrl} 
                                alt="QR Code" 
                                className="w-40 h-40"
                                data-testid="img-qr-code"
                              />
                            </div>
                            <a
                              href={qrCodeDataUrl}
                              download="ice-qr-code.png"
                              className="flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                              data-testid="link-download-qr"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download QR Code</span>
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {embedCode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3"
                    >
                      <button
                        onClick={() => setShowEmbedCode(!showEmbedCode)}
                        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        data-testid="button-toggle-embed"
                      >
                        <Code className="w-4 h-4" />
                        <span>{showEmbedCode ? "Hide Embed Code" : "Embed on Website"}</span>
                      </button>
                      
                      <AnimatePresence>
                        {showEmbedCode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3"
                          >
                            <div className="relative">
                              <pre className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                                {embedCode}
                              </pre>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyEmbed}
                                className="absolute top-2 right-2 h-7 px-2 text-xs"
                                data-testid="button-copy-embed"
                              >
                                {embedCopied ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-green-400" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Paste this code into your website's HTML to embed your ICE.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-slate-500 mt-0.5" />
              <div className="text-xs text-slate-500">
                {selectedVisibility === "private" && (
                  <>Only you can access this ICE. Great for works in progress.</>
                )}
                {selectedVisibility === "unlisted" && (
                  <>Your ICE will be accessible via link only. Perfect for sharing with specific people.</>
                )}
                {selectedVisibility === "public" && (
                  <>Your ICE will be discoverable by anyone. It may appear in the public gallery.</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            data-testid="button-cancel-publish"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!hasChanges || publishMutation.isPending}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
            data-testid="button-confirm-publish"
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {selectedVisibility === "private" ? "Updating..." : "Publishing..."}
              </>
            ) : (
              <>
                {selectedVisibility === "private" ? (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Make Private
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    {currentVisibility === "private" ? "Publish" : "Update"}
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
