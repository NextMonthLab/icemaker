import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Share2, PlayCircle } from "lucide-react";

interface CardPlayerProps {
  card: Card;
  autoplay?: boolean;
}

export default function CardPlayer({ card, autoplay = true }: CardPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [captionIndex, setCaptionIndex] = useState(0);

  // Simulation of "Video" playing
  useEffect(() => {
    if (!isPlaying) return;

    const captionInterval = setInterval(() => {
      setCaptionIndex((prev) => (prev + 1) % (card.captions.length + 1));
    }, 3000); // Change caption every 3 seconds

    return () => clearInterval(captionInterval);
  }, [isPlaying, card.captions.length]);

  return (
    <div className="relative w-full aspect-[9/16] overflow-hidden rounded-lg bg-black shadow-2xl group border border-border/50">
      {/* Background Image with Ken Burns Effect */}
      <div className={`absolute inset-0 w-full h-full transition-transform duration-[20s] ease-linear ${isPlaying ? 'scale-125' : 'scale-100'}`}>
         {card.image ? (
           <img
              src={card.image}
              alt={card.title}
              className="w-full h-full object-cover opacity-80"
            />
         ) : (
           <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-primary/10" />
         )}
      </div>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90 pointer-events-none" />

      {/* Captions Layer */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 pb-24 text-center pointer-events-none">
        <motion.div
            key={captionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-[100px] flex items-center justify-center"
        >
          {captionIndex < card.captions.length ? (
            <p className="text-2xl md:text-3xl font-bold font-display text-white drop-shadow-lg leading-tight">
              {card.captions[captionIndex]}
            </p>
          ) : (
             <div className="flex flex-col items-center gap-2">
                 <h2 className="text-3xl font-display font-bold text-primary mb-2">{card.title}</h2>
                 <p className="text-sm text-gray-300">Tap to replay</p>
             </div>
          )}
        </motion.div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 backdrop-blur-md border-white/10 hover:bg-white/20">
            <Share2 className="w-4 h-4 text-white" />
        </Button>
      </div>

       {/* Play/Pause Overlay (if needed) */}
       {!isPlaying && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer" onClick={() => setIsPlaying(true)}>
               <PlayCircle className="w-16 h-16 text-white/80" />
           </div>
       )}
    </div>
  );
}
