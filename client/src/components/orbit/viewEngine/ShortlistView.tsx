import { motion } from "framer-motion";
import { MessageCircle, Award, AlertTriangle, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShortlistViewData, ShortlistItem } from "@shared/orbitViewEngine";
import { orbitTokens } from "@/lib/designTokens";

interface ShortlistViewProps {
  data: ShortlistViewData;
  onAskAbout?: (query: string) => void;
}

export function ShortlistView({ data, onAskAbout }: ShortlistViewProps) {
  return (
    <div className="flex flex-col p-4">
      {data.title && (
        <h3 className="text-sm font-medium text-white mb-1">{data.title}</h3>
      )}
      {data.criteria && (
        <p className="text-xs text-white/50 mb-4">{data.criteria}</p>
      )}

      <div className="space-y-3">
        {data.items.map((item, idx) => (
          <ShortlistCard 
            key={item.id} 
            item={item} 
            rank={idx + 1}
            onAskAbout={onAskAbout}
          />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/10">
        <button
          onClick={() => onAskAbout?.("Compare these options side by side")}
          className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
          data-testid="compare-shortlist"
        >
          <span>Compare these options</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ShortlistCard({ 
  item, 
  rank,
  onAskAbout 
}: { 
  item: ShortlistItem; 
  rank: number;
  onAskAbout?: (query: string) => void;
}) {
  const isTop = rank === 1;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="relative p-4 rounded-xl border transition-all bg-white/5 hover:border-white/20"
      style={{
        borderColor: isTop ? orbitTokens.winner.border : 'rgba(255,255,255,0.1)',
        backgroundColor: isTop ? orbitTokens.winner.bg : 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-black flex items-center justify-center border border-white/20">
        <span 
          className="text-xs font-bold"
          style={{ color: isTop ? orbitTokens.winner.text : 'rgba(255,255,255,0.6)' }}
        >
          {rank}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.name}
            className="w-14 h-14 rounded-lg object-cover bg-white/10 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm text-white/40">
              {item.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-white truncate">{item.name}</h4>
            {item.score && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10">
                <Award className="w-3 h-3" style={{ color: orbitTokens.winner.text }} />
                <span className="text-xs text-white/80">{item.score}</span>
              </div>
            )}
          </div>
          
          {item.brand && (
            <p className="text-xs text-white/40">{item.brand}</p>
          )}
          
          {item.price && (
            <p className="text-xs text-pink-400 mt-0.5">{item.price}</p>
          )}

          <p className="text-xs text-white/70 mt-2 line-clamp-2">{item.why}</p>

          {item.best_for && (
            <div className="flex items-center gap-1 mt-2">
              <Target className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">Best for: {item.best_for}</span>
            </div>
          )}

          {item.tradeoffs.length > 0 && (
            <div className="flex items-start gap-1 mt-2">
              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-amber-400/80">
                {item.tradeoffs[0]}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => onAskAbout?.(`Tell me more about ${item.name}`)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          title="Ask about this"
          data-testid={`ask-shortlist-${item.id}`}
        >
          <MessageCircle className="w-4 h-4 text-white/30 hover:text-pink-400 transition-colors" />
        </button>
      </div>
    </motion.div>
  );
}
