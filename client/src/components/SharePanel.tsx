import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Copy, 
  Check,
  QrCode,
  Download,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function SharePanel({
  isOpen,
  onClose,
  shareUrl,
}: SharePanelProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 300,
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share URL has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy the link manually.",
      });
    }
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = 'share-qr-code.png';
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR code downloaded!",
      description: "The QR code image has been saved.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-cyan-400" />
            Share Your ICE
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Share your interactive content experience with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-slate-300 truncate flex-1">{shareUrl}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopyLink}
                variant="default"
                size="sm"
                className="flex-1 gap-2"
                data-testid="share-copy-link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-open-link"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </a>
              </Button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowQrCode(!showQrCode)}
              className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/10 text-left"
              data-testid="share-toggle-qr"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-medium text-white">QR Code</span>
              </div>
              <span className="text-xs text-slate-400">
                {showQrCode ? "Hide" : "View"}
              </span>
            </button>

            {showQrCode && qrCodeDataUrl && (
              <div className="mt-3 p-4 bg-white rounded-lg flex flex-col items-center gap-3">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Share QR Code" 
                  className="w-48 h-48"
                  data-testid="share-qr-image"
                />
                <Button
                  onClick={handleDownloadQr}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="share-download-qr"
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
