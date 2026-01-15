import { X, Play, Image as ImageIcon, Video, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface PreviewCard {
  id: string;
  title: string;
  content: string;
  order: number;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  narrationAudioUrl?: string;
  videoGenerated?: boolean;
  videoGenerationStatus?: string;
}

interface BuilderPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCard: PreviewCard | null;
  cardIndex: number;
  totalCards: number;
  onPlayPreview: () => void;
}

export function BuilderPreviewDrawer({
  isOpen,
  onClose,
  selectedCard,
  cardIndex,
  totalCards,
  onPlayPreview,
}: BuilderPreviewDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-zinc-950 border-l border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-cyan-400" />
                <h3 className="font-medium text-white">Card Preview</h3>
                {selectedCard && (
                  <span className="text-xs text-white/50 ml-2">
                    {cardIndex + 1} of {totalCards}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                data-testid="button-close-preview-drawer"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedCard ? (
                <div className="space-y-4">
                  <div className="aspect-[9/16] bg-black/50 rounded-lg overflow-hidden relative">
                    {selectedCard.generatedVideoUrl ? (
                      <video
                        src={selectedCard.generatedVideoUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : selectedCard.generatedImageUrl ? (
                      <img
                        src={selectedCard.generatedImageUrl}
                        alt={selectedCard.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <p className="text-sm">No media generated yet</p>
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2 flex gap-1">
                      {selectedCard.generatedVideoUrl && (
                        <span className="px-2 py-0.5 bg-blue-500/80 text-white text-xs rounded-full flex items-center gap-1">
                          <Video className="w-3 h-3" /> Video
                        </span>
                      )}
                      {selectedCard.generatedImageUrl && !selectedCard.generatedVideoUrl && (
                        <span className="px-2 py-0.5 bg-cyan-500/80 text-white text-xs rounded-full flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Image
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                      <h4 className="text-white font-semibold text-lg leading-tight mb-1">
                        {selectedCard.title}
                      </h4>
                      <p className="text-white/70 text-sm line-clamp-3">
                        {selectedCard.content}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                    <h5 className="text-xs text-white/50 uppercase tracking-wider mb-2">Full Caption</h5>
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {selectedCard.content || "No caption content"}
                    </p>
                  </div>

                  {selectedCard.narrationAudioUrl && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                      <h5 className="text-xs text-white/50 uppercase tracking-wider mb-2">Narration Audio</h5>
                      <audio
                        src={selectedCard.narrationAudioUrl}
                        controls
                        className="w-full h-8"
                      />
                    </div>
                  )}

                  <Button
                    onClick={onPlayPreview}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
                    data-testid="button-play-from-drawer"
                  >
                    <Play className="w-4 h-4" />
                    Play from this card
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white/40">
                  <Film className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1">No card selected</p>
                  <p className="text-sm">Click on a card in the list to preview it here</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
