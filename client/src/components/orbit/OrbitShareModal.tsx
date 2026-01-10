import { useState, useEffect } from "react";
import { Copy, Check, Code, Link2, ExternalLink, QrCode, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("link");

  const shareUrl = `${window.location.origin}/o/${businessSlug}`;
  
  const embedCode = `<iframe 
  src="${shareUrl}?embed=true" 
  width="100%" 
  height="600" 
  frameborder="0"
  allow="clipboard-write; fullscreen"
  title="${brandName || 'Orbit Experience'}"
></iframe>`;

  useEffect(() => {
    if (open && shareUrl) {
      import('qrcode').then(QRCode => {
        QRCode.toDataURL(shareUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#ffffff',
            light: '#00000000'
          }
        }).then((url: string) => {
          setQrCodeUrl(url);
        }).catch(console.error);
      }).catch(console.error);
    }
  }, [open, shareUrl]);

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

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `${businessSlug}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg bg-black border border-white/10 mx-2" data-testid="orbit-share-modal">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-semibold text-white">
            Share & Embed
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="link" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-share-link">
              <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-share-embed">
              <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
              Embed
            </TabsTrigger>
            <TabsTrigger value="qr" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-share-qr">
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
              QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 overflow-hidden">
                <div className="text-xs sm:text-sm text-zinc-300 font-mono break-all">
                  {shareUrl}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
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
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Share this link to let anyone visit your Orbit.
            </p>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 pt-4">
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all">
                  {embedCode}
                </pre>
              </div>
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
            <p className="text-xs text-zinc-500">
              Add this code to your website to embed your Orbit experience.
            </p>
          </TabsContent>

          <TabsContent value="qr" className="space-y-4 pt-4">
            <div className="flex flex-col items-center gap-4">
              {qrCodeUrl ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code for Orbit"
                    className="w-48 h-48"
                    data-testid="img-qr-code"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                </div>
              )}
              <Button
                onClick={handleDownloadQR}
                variant="outline"
                size="sm"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                disabled={!qrCodeUrl}
                data-testid="button-download-qr"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download QR Code
              </Button>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Print this QR code for menus, storefronts, or marketing materials. Customers scan to open your Orbit.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default OrbitShareModal;
