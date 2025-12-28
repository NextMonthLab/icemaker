import { motion } from "framer-motion";
import { FileText, User, Star, Video, Phone, Mail, Quote, Lightbulb, ExternalLink, Cloud, Sun, Calendar, MapPin, Globe, Briefcase, Award, MessageCircle, Zap, Book, TrendingUp, Shield, Heart, HelpCircle, Settings, Home, DollarSign, Clock, Users, Target, Sparkles, Rss, Twitter, Facebook, Instagram, Linkedin, Youtube, type LucideIcon } from "lucide-react";
import type { AnyKnowledgeItem, Topic, Page, Person, Proof, Action, Blog, Social } from "@/lib/siteKnowledge";

interface KnowledgeTileProps {
  item: AnyKnowledgeItem;
  relevanceScore: number;
  position: { x: number; y: number };
  accentColor?: string;
  zoomLevel?: number;
}

const typeIcons: Record<string, LucideIcon> = {
  topic: Lightbulb,
  page: FileText,
  person: User,
  proof: Star,
  action: Video,
  blog: Rss,
  social: Globe,
};

const typeColors: Record<string, string> = {
  topic: '#8b5cf6',
  page: '#3b82f6',
  person: '#22c55e',
  proof: '#eab308',
  action: '#ec4899',
  blog: '#f97316',
  social: '#06b6d4',
};

const socialIcons: Record<string, LucideIcon> = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Zap,
  pinterest: Target,
  threads: MessageCircle,
};

const socialColors: Record<string, string> = {
  twitter: '#1DA1F2',
  facebook: '#4267B2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  tiktok: '#000000',
  pinterest: '#E60023',
  threads: '#000000',
};

const categoryIcons: Record<string, LucideIcon> = {
  weather: Cloud,
  forecast: Sun,
  schedule: Calendar,
  location: MapPin,
  web: Globe,
  business: Briefcase,
  success: Award,
  contact: MessageCircle,
  action: Zap,
  learn: Book,
  growth: TrendingUp,
  security: Shield,
  health: Heart,
  help: HelpCircle,
  settings: Settings,
  home: Home,
  finance: DollarSign,
  time: Clock,
  team: Users,
  goal: Target,
  feature: Sparkles,
  call: Phone,
  email: Mail,
  video: Video,
  quote: Quote,
};

const typeImageQueries: Record<string, string[]> = {
  topic: ['abstract gradient', 'technology pattern', 'digital network', 'data visualization', 'modern design', 'innovation concept', 'futuristic interface', 'geometric shapes', 'creative pattern', 'minimal abstract'],
  page: ['website design', 'document layout', 'content interface', 'digital screen', 'modern webpage', 'information display', 'clean interface', 'web application', 'dashboard design', 'article layout'],
  person: ['professional headshot', 'business portrait', 'team collaboration', 'office meeting', 'consultant expert', 'corporate professional', 'leadership portrait', 'business handshake', 'workplace team', 'executive portrait'],
  proof: ['success celebration', 'achievement trophy', 'growth chart', 'business results', 'milestone award', 'analytics dashboard', 'performance metrics', 'victory celebration', 'quality certification', 'excellence badge'],
  action: ['action button', 'call to action', 'contact form', 'schedule calendar', 'video conference', 'phone call', 'email inbox', 'booking appointment', 'quick response', 'instant message'],
  blog: ['blog article', 'writing desk', 'content creation', 'news article', 'publishing media', 'editorial content', 'newsletter design', 'journal writing', 'story telling', 'media content'],
  social: ['social media', 'digital marketing', 'online community', 'social network', 'viral content', 'engagement metrics', 'follower growth', 'influencer marketing', 'brand presence', 'social sharing'],
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateUniqueImageUrl(item: AnyKnowledgeItem): string {
  const queries = typeImageQueries[item.type];
  const itemHash = hashString(item.id);
  const keywordHash = item.keywords.length > 0 ? hashString(item.keywords[0]) : 0;
  const combinedHash = itemHash + keywordHash;
  
  const queryIndex = combinedHash % queries.length;
  const baseQuery = queries[queryIndex];
  
  const primaryKeyword = item.keywords[0] || item.type;
  const uniqueQuery = encodeURIComponent(`${primaryKeyword} ${baseQuery}`);
  
  const uniqueSeed = combinedHash % 10000;
  
  return `https://source.unsplash.com/200x120/?${uniqueQuery}&sig=${item.id}-${uniqueSeed}`;
}

function getCategoryIcon(item: AnyKnowledgeItem): LucideIcon {
  const keywords = item.keywords.map(k => k.toLowerCase());
  for (const keyword of keywords) {
    for (const [category, icon] of Object.entries(categoryIcons)) {
      if (keyword.includes(category) || category.includes(keyword)) {
        return icon;
      }
    }
  }
  if (item.type === 'action') {
    const action = item as Action;
    if (action.actionType === 'call') return Phone;
    if (action.actionType === 'email') return Mail;
    if (action.actionType === 'video_reply') return Video;
  }
  return typeIcons[item.type];
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case 'video_reply': return Video;
    case 'call': return Phone;
    case 'email': return Mail;
    default: return ExternalLink;
  }
}

export function KnowledgeTile({ item, relevanceScore, position, accentColor, zoomLevel = 1 }: KnowledgeTileProps) {
  const CategoryIcon = getCategoryIcon(item);
  
  const getTypeIcon = (): LucideIcon => {
    if (item.type === 'action') return getActionIcon((item as Action).actionType);
    if (item.type === 'social') return socialIcons[(item as Social).platform] || Globe;
    return typeIcons[item.type] || Globe;
  };
  const TypeIcon = getTypeIcon();
  
  const getColor = (): string => {
    if (item.type === 'social') return socialColors[(item as Social).platform] || typeColors.social;
    return accentColor || typeColors[item.type] || '#3b82f6';
  };
  const color = getColor();
  const glowIntensity = Math.min(relevanceScore / 30, 1);
  
  const rawImageUrl = 'imageUrl' in item ? (item as any).imageUrl : undefined;
  const imageUrl = rawImageUrl && typeof rawImageUrl === 'string' && rawImageUrl.length > 0 
    ? rawImageUrl 
    : generateUniqueImageUrl(item);
  
  const getLabel = () => {
    switch (item.type) {
      case 'topic': return (item as Topic).label;
      case 'page': return (item as Page).title;
      case 'person': return (item as Person).name;
      case 'proof': return (item as Proof).label;
      case 'action': return (item as Action).label;
      case 'blog': return (item as Blog).title;
      case 'social': {
        const social = item as Social;
        return social.connected ? `@${social.handle}` : social.platform.charAt(0).toUpperCase() + social.platform.slice(1);
      }
    }
  };

  const getSummary = () => {
    switch (item.type) {
      case 'topic': return (item as Topic).summary;
      case 'page': return (item as Page).summary;
      case 'person': return (item as Person).role;
      case 'proof': return (item as Proof).summary;
      case 'action': return (item as Action).summary;
      case 'blog': return (item as Blog).summary;
      case 'social': {
        const social = item as Social;
        if (!social.connected) return 'Connect to show feed';
        return social.followerCount ? `${social.followerCount.toLocaleString()} followers` : 'View feed';
      }
    }
  };

  const tileWidth = 115;
  const tileHeight = 95;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: position.x,
        y: position.y,
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 120, 
        damping: 20,
        opacity: { duration: 0.3 }
      }}
      className="absolute rounded-lg text-left overflow-hidden"
      style={{
        width: tileWidth,
        height: tileHeight,
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}${Math.floor(30 + glowIntensity * 40).toString(16)}`,
        boxShadow: glowIntensity > 0.2 
          ? `0 0 ${20 + glowIntensity * 40}px ${color}${Math.floor(glowIntensity * 50).toString(16)}, 0 4px 20px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.3)',
        left: '50%',
        top: '50%',
        marginLeft: -tileWidth / 2,
        marginTop: -tileHeight / 2,
        cursor: 'pointer',
      }}
      data-tile-id={item.id}
      data-testid={`tile-${item.id}`}
    >
      {/* Image header with category icon overlay */}
      <div 
        className="w-full h-10 relative bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${imageUrl})`,
          borderBottom: `1px solid ${color}30`,
        }}
      >
        {/* Gradient overlay for icon visibility */}
        <div 
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${color}60 0%, transparent 50%)` }}
        >
          <CategoryIcon className="w-4 h-4 absolute top-1 left-1" style={{ color: 'white', opacity: 0.9 }} />
        </div>
        {/* Relevance indicator */}
        {relevanceScore > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
            style={{ 
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        )}
      </div>
      
      {/* Content - compact layout */}
      <div className="p-1.5 flex items-start gap-1.5">
        <div 
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <TypeIcon className="w-3 h-3" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[10px] font-medium leading-tight line-clamp-2">
            {getLabel()}
          </p>
          <p className="text-white/50 text-[8px] line-clamp-1 mt-0.5 leading-tight">
            {getSummary()}
          </p>
        </div>
      </div>
      
      {/* Type badge - smaller */}
      <div 
        className="absolute bottom-1 left-1.5 inline-flex items-center px-1 py-0.5 rounded text-[7px] uppercase tracking-wide font-semibold"
        style={{ backgroundColor: `${color}30`, color }}
      >
        {item.type}
      </div>
    </motion.div>
  );
}
