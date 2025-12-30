import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Clock, Check, Copy, Info, X } from "lucide-react";

interface PreviewShareBarProps {
  previewId: string;
  expiresAt: string;
  brandName: string;
}

function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) return "Expired";
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

export function PreviewShareBar({ previewId, expiresAt, brandName }: PreviewShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  const shareUrl = `${window.location.origin}/preview/${previewId}`;
  const timeRemaining = formatTimeRemaining(expiresAt);
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 to-transparent"
      >
        <div className="max-w-4xl mx-auto px-3 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Clock className="w-2.5 h-2.5" />
                <span className="text-[10px] font-medium">{timeRemaining}</span>
              </div>
              
              <button
                onClick={() => setShowInfo(true)}
                className="text-[10px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-0.5"
                data-testid="button-preview-info"
              >
                <Info className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Info</span>
              </button>
            </div>
            
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0"
              data-testid="button-share-preview"
            >
              {copied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-green-400" />
                  <span className="text-green-400">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-2.5 h-2.5" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Preview Details</h3>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  data-testid="button-close-info"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">Time remaining</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{timeRemaining}</p>
                  <p className="text-xs text-white/50 mt-1">
                    This preview will expire if not claimed
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-white/70 leading-relaxed">
                    Share this link with your team to review the {brandName} Orbit before claiming.
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Anyone with the link can view and interact with the preview during this time.
                  </p>
                </div>
                
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <Copy className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="text-xs text-white/60 truncate flex-1">{shareUrl}</span>
                  </div>
                  
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
                    data-testid="button-copy-link-modal"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        Link copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        Copy share link
                      </>
                    )}
                  </button>
                </div>
                
                <p className="text-xs text-white/40 text-center pt-2">
                  Claim within {timeRemaining} to keep your Orbit permanently
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
