import { motion } from "framer-motion";
import { FileText, User, Star, Video, Phone, Mail, Quote, Lightbulb, ExternalLink } from "lucide-react";
import type { AnyKnowledgeItem, Topic, Page, Person, Proof, Action } from "@/lib/siteKnowledge";

interface KnowledgeTileProps {
  item: AnyKnowledgeItem;
  relevanceScore: number;
  position: { x: number; y: number };
  onClick: (item: AnyKnowledgeItem) => void;
  accentColor?: string;
}

const typeIcons = {
  topic: Lightbulb,
  page: FileText,
  person: User,
  proof: Star,
  action: Video,
};

const typeColors = {
  topic: '#8b5cf6',
  page: '#3b82f6',
  person: '#22c55e',
  proof: '#eab308',
  action: '#ec4899',
};

function getActionIcon(actionType: string) {
  switch (actionType) {
    case 'video_reply': return Video;
    case 'call': return Phone;
    case 'email': return Mail;
    default: return ExternalLink;
  }
}

export function KnowledgeTile({ item, relevanceScore, position, onClick, accentColor }: KnowledgeTileProps) {
  const Icon = item.type === 'action' 
    ? getActionIcon((item as Action).actionType)
    : typeIcons[item.type];
  
  const color = accentColor || typeColors[item.type];
  const glowIntensity = Math.min(relevanceScore / 30, 1);
  
  const getLabel = () => {
    switch (item.type) {
      case 'topic': return (item as Topic).label;
      case 'page': return (item as Page).title;
      case 'person': return (item as Person).name;
      case 'proof': return (item as Proof).label;
      case 'action': return (item as Action).label;
    }
  };

  const getSummary = () => {
    switch (item.type) {
      case 'topic': return (item as Topic).summary;
      case 'page': return (item as Page).summary;
      case 'person': return (item as Person).role;
      case 'proof': return (item as Proof).summary;
      case 'action': return (item as Action).summary;
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: position.x,
        y: position.y,
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 200, 
        damping: 25,
        opacity: { duration: 0.2 }
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(item)}
      className="absolute w-[140px] p-3 rounded-xl text-left transition-all"
      style={{
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        border: `1px solid ${color}${Math.floor(20 + glowIntensity * 40).toString(16)}`,
        boxShadow: glowIntensity > 0.2 
          ? `0 0 ${20 + glowIntensity * 30}px ${color}${Math.floor(glowIntensity * 40).toString(16)}`
          : 'none',
        left: '50%',
        top: '50%',
        marginLeft: '-70px',
        marginTop: '-50px',
      }}
      data-tile
      data-testid={`tile-${item.id}`}
    >
      {/* Relevance indicator */}
      {relevanceScore > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ 
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
      
      <div className="flex items-start gap-2">
        <div 
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate leading-tight">
            {getLabel()}
          </p>
          <p className="text-white/50 text-[10px] line-clamp-2 mt-0.5 leading-tight">
            {getSummary()}
          </p>
        </div>
      </div>
      
      {/* Type badge */}
      <div 
        className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {item.type}
      </div>
    </motion.button>
  );
}
