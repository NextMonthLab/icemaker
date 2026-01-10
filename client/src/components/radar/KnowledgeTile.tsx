import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, User, Star, Video, Phone, Mail, Quote, Lightbulb, ExternalLink, Cloud, Sun, Calendar, MapPin, Globe, Briefcase, Award, MessageCircle, Zap, Book, TrendingUp, Shield, Heart, HelpCircle, Settings, Home, DollarSign, Clock, Users, Target, Sparkles, Rss, Twitter, Facebook, Instagram, Linkedin, Youtube, type LucideIcon } from "lucide-react";
import type { AnyKnowledgeItem, Topic, Page, Person, Proof, Action, Blog, Social } from "@/lib/siteKnowledge";
import { orbitTokens } from "@/lib/designTokens";

interface KnowledgeTileProps {
  item: AnyKnowledgeItem;
  relevanceScore: number;
  position: { x: number; y: number };
  accentColor?: string;
  zoomLevel?: number;
  lightMode?: boolean;
}

const typeIcons: Record<string, LucideIcon> = {
  topic: Lightbulb,
  page: FileText,
  person: User,
  proof: Star,
  action: Video,
  blog: Rss,
  social: Globe,
  manufacturer: Briefcase,
  product: Sparkles,
  concept: Book,
  qa: HelpCircle,
  community: Users,
  cta: Zap,
  sponsored: Award,
};

const typeColors: Record<string, string> = orbitTokens.typeAccents;

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
  manufacturer: ['brand logo', 'company headquarters', 'tech company', 'corporate building', 'innovation lab', 'manufacturing facility', 'product design', 'technology campus', 'enterprise office', 'brand identity'],
  product: ['smart glasses', 'wearable tech', 'AR device', 'tech gadget', 'electronic device', 'consumer electronics', 'product photography', 'tech hardware', 'digital accessory', 'modern device'],
  concept: ['concept design', 'idea lightbulb', 'innovation thinking', 'creative process', 'abstract concept', 'knowledge learning', 'education diagram', 'understanding visualization', 'conceptual art', 'idea sketch'],
  qa: ['question answer', 'help desk', 'FAQ support', 'customer service', 'knowledge base', 'information guide', 'help center', 'support ticket', 'assistance request', 'inquiry response'],
  community: ['online community', 'user group', 'forum discussion', 'social gathering', 'community members', 'group collaboration', 'networking event', 'team meeting', 'user conference', 'community engagement'],
  cta: ['call to action', 'button click', 'sign up form', 'action prompt', 'engagement button', 'subscribe now', 'get started', 'join community', 'take action', 'click here'],
  sponsored: ['advertisement', 'sponsored content', 'promotional banner', 'marketing campaign', 'brand promotion', 'advertising media', 'commercial content', 'featured product', 'promotional offer', 'brand partnership'],
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

function getDeterministicGradient(id: string, baseColor: string): string {
  const hash = hashString(id);
  const hueShift = (hash % 30) - 15;
  const satShift = (hash % 20) - 10;
  
  const hexToHsl = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s * 100, l * 100];
  };
  
  const [h, s, l] = hexToHsl(baseColor);
  const h1 = (h + hueShift + 360) % 360;
  const h2 = (h + hueShift + 30 + 360) % 360;
  const s1 = Math.max(20, Math.min(80, s + satShift));
  
  return `linear-gradient(135deg, hsl(${h1}, ${s1}%, ${l + 10}%) 0%, hsl(${h2}, ${s1 - 10}%, ${l - 5}%) 100%)`;
}

function getOfficialImageUrl(item: AnyKnowledgeItem): string | null {
  if ('imageUrl' in item && (item as any).imageUrl) {
    return (item as any).imageUrl;
  }
  if (item.type === 'product') {
    const product = item as import('@/lib/siteKnowledge').Product;
    if (product.manufacturerLogoUrl) {
      return product.manufacturerLogoUrl;
    }
  }
  if (item.type === 'manufacturer') {
    const manufacturer = item as import('@/lib/siteKnowledge').Manufacturer;
    if (manufacturer.logoUrl) {
      return manufacturer.logoUrl;
    }
  }
  return null;
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

export function KnowledgeTile({ item, relevanceScore, position, accentColor, zoomLevel = 1, lightMode = false }: KnowledgeTileProps) {
  const shouldReduceMotion = useReducedMotion();
  const [imageError, setImageError] = useState(false);
  const CategoryIcon = getCategoryIcon(item);
  
  const getTypeIcon = (): LucideIcon => {
    if (item.type === 'action') return getActionIcon((item as Action).actionType);
    if (item.type === 'social') return socialIcons[(item as Social).platform] || Globe;
    return typeIcons[item.type] || Globe;
  };
  const TypeIcon = getTypeIcon();
  
  const getColor = (): string => {
    // Industry orbit tiles always use type-specific colors for visual hierarchy
    const industryTypes = ['manufacturer', 'product', 'concept', 'qa', 'community', 'cta', 'sponsored'];
    if (industryTypes.includes(item.type)) {
      return typeColors[item.type] || '#3b82f6';
    }
    return accentColor || typeColors[item.type] || '#3b82f6';
  };
  const color = getColor();
  const glowIntensity = Math.min(relevanceScore / 30, 1);
  
  const officialImageUrl = getOfficialImageUrl(item);
  
  const enhanceImageUrl = (url: string): string => {
    if (!url) return url;
    const wpEnhanced = url.replace(/-\d+x\d+(_c)?(\.[a-z]+)$/i, '$2');
    if (wpEnhanced !== url) return wpEnhanced;
    const sqEnhanced = url.replace(/\/s\/\d+x\d+\//, '/s/');
    if (sqEnhanced !== url) return sqEnhanced;
    return url;
  };
  
  const imageUrl = officialImageUrl ? enhanceImageUrl(officialImageUrl) : null;
  const hasOfficialImage = !!imageUrl && !imageError;
  const placeholderGradient = getDeterministicGradient(item.id, color);
  
  const getInitials = (): string => {
    if (item.type === 'manufacturer') {
      return (item as import('@/lib/siteKnowledge').Manufacturer).initials;
    }
    if (item.type === 'product') {
      return (item as import('@/lib/siteKnowledge').Product).manufacturerInitials;
    }
    const label = getLabel() || item.type;
    return label?.split(/\s+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('') || item.type[0].toUpperCase();
  };
  
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
      case 'manufacturer': return (item as import('@/lib/siteKnowledge').Manufacturer).name;
      case 'product': return (item as import('@/lib/siteKnowledge').Product).name;
      case 'concept': return (item as import('@/lib/siteKnowledge').Concept).label;
      case 'qa': return (item as import('@/lib/siteKnowledge').QA).question;
      case 'community': return (item as import('@/lib/siteKnowledge').Community).name;
      case 'cta': return (item as import('@/lib/siteKnowledge').CTA).label;
      case 'sponsored': return (item as import('@/lib/siteKnowledge').Sponsored).name;
      default: return 'Unknown';
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
      case 'manufacturer': {
        const mfr = item as import('@/lib/siteKnowledge').Manufacturer;
        return mfr.productCount > 0 ? `${mfr.productCount} product${mfr.productCount === 1 ? '' : 's'}` : 'Manufacturer';
      }
      case 'product': {
        const prod = item as import('@/lib/siteKnowledge').Product;
        let summary = prod.summary || prod.category || 'Product';
        if (prod.releaseDate) {
          const date = new Date(prod.releaseDate);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          summary = `${dateStr} · ${summary}`;
        }
        return summary;
      }
      case 'concept': {
        const concept = item as import('@/lib/siteKnowledge').Concept;
        return concept.whyItMatters || 'Learn more';
      }
      case 'qa': {
        const qa = item as import('@/lib/siteKnowledge').QA;
        return qa.sublabel || 'Tap to see answer';
      }
      case 'community': {
        const community = item as import('@/lib/siteKnowledge').Community;
        if (community.notes) return community.notes;
        return community.communityType?.replace('_', ' ') || 'Community';
      }
      case 'cta': {
        const cta = item as import('@/lib/siteKnowledge').CTA;
        return cta.summary || 'Take action';
      }
      case 'sponsored': {
        const sponsored = item as import('@/lib/siteKnowledge').Sponsored;
        return sponsored.summary || 'Sponsored';
      }
      default: return '';
    }
  };

  const tileWidth = 200;
  const tileHeight = 90;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: position.x,
        y: position.y,
      }}
      transition={shouldReduceMotion ? { duration: 0 } : { 
        type: 'spring', 
        stiffness: 120, 
        damping: 20,
        opacity: { duration: 0.3 }
      }}
      whileHover={shouldReduceMotion ? {} : { 
        y: -3,
        scale: 1.02,
        transition: { duration: 0.15 }
      }}
      whileTap={shouldReduceMotion ? {} : { 
        scale: 0.98,
        transition: { duration: 0.08 }
      }}
      className="absolute rounded-xl text-left overflow-hidden group"
      style={{
        width: tileWidth,
        height: tileHeight,
        background: lightMode 
          ? `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)`
          : `linear-gradient(135deg, rgba(24,24,27,0.95) 0%, ${color}08 100%)`,
        backdropFilter: 'blur(12px)',
        borderLeft: `4px solid ${color}`,
        borderTop: `1px solid ${lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
        borderRight: `1px solid ${lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'}`,
        borderBottom: `1px solid ${lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)'}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.03) inset`,
        left: '50%',
        top: '50%',
        marginLeft: -tileWidth / 2,
        marginTop: -tileHeight / 2,
        cursor: 'pointer',
      }}
      data-tile-id={item.id}
      data-testid={`tile-${item.id}`}
    >
      {/* Content-first layout */}
      <div className="p-3 h-full flex flex-col justify-between">
        {/* Header: icon + title */}
        <div className="flex items-start gap-2.5">
          {/* Type icon with tooltip */}
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{ 
              backgroundColor: `${color}20`,
              border: `1px solid ${color}30`,
            }}
            title={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          >
            <TypeIcon className="w-4 h-4" style={{ color }} />
          </div>
          
          {/* Title + optional thumbnail */}
          <div className="flex-1 min-w-0 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug line-clamp-2 ${lightMode ? 'text-gray-900' : 'text-white'}`}>
                {getLabel()}
              </p>
            </div>
            
            {/* Small thumbnail for products/manufacturers with images */}
            {hasOfficialImage && imageUrl && (
              <div 
                className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border"
                style={{ borderColor: `${color}30` }}
              >
                <img
                  src={imageUrl}
                  alt=""
                  loading="lazy"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Summary - meaningful preview */}
        <p className={`text-xs leading-relaxed line-clamp-2 ${lightMode ? 'text-gray-600' : 'text-white/60'}`}>
          {getSummary()}
        </p>
      </div>
      
      {/* Subtle hover glow */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ 
          boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}05`,
        }}
      />
    </motion.div>
  );
}
