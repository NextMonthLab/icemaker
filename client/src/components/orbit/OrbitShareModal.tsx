import { useState } from "react";
import { Copy, Check, Code, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrbitShareModalProps {
  open: boolean;
  onClose: () => void;
  businessSlug: string;
  brandName?: string;
}

export function OrbitShareModal({
  open,
  onClose,
  businessSlug,
  brandName,
}: OrbitShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const shareUrl = `${window.location.origin}/o/${businessSlug}`;
  
  const embedCode = `<iframe 
  src="${shareUrl}?embed=true" 
  width="100%" 
  height="600" 
  frameborder="0"
  allow="clipboard-write; fullscreen"
  title="${brandName || 'Orbit Experience'}"
></iframe>`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = embedCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg bg-black border border-white/10" data-testid="orbit-share-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Share & Embed Orbit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-medium text-white">Share Link</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-300 font-mono truncate">
                {shareUrl}
              </div>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white shrink-0"
                data-testid="button-copy-orbit-link"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              data-testid="link-open-orbit"
            >
              <ExternalLink className="w-3 h-3" />
              Open in new tab
            </a>
          </div>

          <div className="h-px bg-white/10" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-medium text-white">Embed Code</h3>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 overflow-x-auto">
              <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
            </div>
            <div className="flex items-center justify-between">
              <Button
                onClick={handleCopyEmbed}
                variant="outline"
                size="sm"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                data-testid="button-copy-orbit-embed"
              >
                {embedCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy Embed Code
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            Embedded Orbits are public. Anyone with the link can view and interact.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OrbitShareModal;
