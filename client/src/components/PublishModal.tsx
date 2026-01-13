import { useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentVisibility } from "@shared/schema";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewId: string;
  currentVisibility: ContentVisibility;
  shareSlug?: string | null;
  onPublishComplete?: (data: {
    visibility: ContentVisibility;
    shareSlug: string | null;
    shareUrl: string | null;
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
  onPublishComplete,
}: PublishModalProps) {
  const { toast } = useToast();
  const [selectedVisibility, setSelectedVisibility] = useState<ContentVisibility>(currentVisibility);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    shareSlug ? `${window.location.origin}/ice/${shareSlug}` : null
  );

  const publishMutation = useMutation({
    mutationFn: async (visibility: ContentVisibility) => {
      const response = await apiRequest("PUT", `/api/ice/preview/${previewId}/publish`, { visibility });
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

  const hasChanges = selectedVisibility !== currentVisibility;
  const isPublished = currentVisibility !== "private" && shareUrl;

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
          <div className="space-y-2">
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedVisibility === option.value;
              
              return (
                <motion.button
                  key={option.value}
                  onClick={() => setSelectedVisibility(option.value)}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/50"
                      : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                  }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  data-testid={`button-visibility-${option.value}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${option.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{option.label}</span>
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 rounded-full bg-cyan-400"
                          />
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{option.description}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

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
