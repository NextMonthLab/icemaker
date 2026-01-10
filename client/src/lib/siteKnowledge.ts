export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  primaryColor: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'topic' | 'page' | 'person' | 'proof' | 'action' | 'blog' | 'social' | 'manufacturer' | 'product' | 'concept' | 'qa' | 'community' | 'cta' | 'sponsored';
  keywords: string[];
}

export interface Topic extends KnowledgeItem {
  type: 'topic';
  label: string;
  summary: string;
  imageUrl?: string;
}

export interface Page extends KnowledgeItem {
  type: 'page';
  title: string;
  url: string;
  summary: string;
  imageUrl?: string;
}

export interface Person extends KnowledgeItem {
  type: 'person';
  name: string;
  role: string;
  email: string;
  phone: string | null;
  avatar: string | null;
}

export interface Proof extends KnowledgeItem {
  type: 'proof';
  label: string;
  summary: string;
  imageUrl?: string;
}

export interface Action extends KnowledgeItem {
  type: 'action';
  label: string;
  summary: string;
  actionType: 'video_reply' | 'call' | 'email' | 'quote';
  imageUrl?: string;
}

export interface Blog extends KnowledgeItem {
  type: 'blog';
  title: string;
  url: string;
  summary: string;
  publishDate?: string;
  imageUrl?: string;
}

export type SocialPlatform = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest' | 'threads';

export interface Social extends KnowledgeItem {
  type: 'social';
  platform: SocialPlatform;
  handle: string;
  url: string;
  followerCount?: number;
  connected: boolean;
  imageUrl?: string;
}

export interface Manufacturer extends KnowledgeItem {
  type: 'manufacturer';
  name: string;
  initials: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  productCount: number;
  trustLevel: string;
  entityId: number;
}

export interface Product extends KnowledgeItem {
  type: 'product';
  name: string;
  summary: string | null;
  status: string | null;
  category: string | null;
  manufacturerName: string | null;
  manufacturerInitials: string;
  primarySpec: { key: string; value: string } | null;
  specCount: number;
  productId: number;
  referenceUrls: string[];
  intentTags: string[];
  imageUrl?: string | null;
  manufacturerLogoUrl?: string | null;
  releaseDate?: string | null; // ISO date string for announcement/release date
}

export interface Concept extends KnowledgeItem {
  type: 'concept';
  label: string;
  whyItMatters: string | null;
  starterQuestions: string[];
  conceptId: number;
}

export interface QA extends KnowledgeItem {
  type: 'qa';
  question: string;
  answer: string;
  tileId: number;
  sublabel: string | null;
  priority: number;
}

export interface Community extends KnowledgeItem {
  type: 'community';
  name: string;
  url: string;
  communityType: string | null;
  regionTags: string[];
  communityId: number;
  notes?: string; // Rich context about what this community is and why it matters
}

export interface CTA extends KnowledgeItem {
  type: 'cta';
  label: string;
  summary: string;
  ctaType: 'friend' | 'upgrade' | 'sponsor';
  actionUrl?: string;
}

export interface Sponsored extends KnowledgeItem {
  type: 'sponsored';
  name: string;
  summary: string | null;
  imageUrl: string | null;
  sponsorUrl: string;
  productId?: number;
}

export type AnyKnowledgeItem = Topic | Page | Person | Proof | Action | Blog | Social | Manufacturer | Product | Concept | QA | Community | CTA | Sponsored;

export interface SiteKnowledge {
  brand: Brand;
  topics: Topic[];
  pages: Page[];
  people: Person[];
  proof: Proof[];
  actions: Action[];
  blogs: Blog[];
  socials: Social[];
  manufacturers?: Manufacturer[];
  products?: Product[];
  concepts?: Concept[];
  qas?: QA[];
  communities?: Community[];
  ctas?: CTA[];
  sponsored?: Sponsored[];
}

export function getAllItems(knowledge: SiteKnowledge): AnyKnowledgeItem[] {
  return [
    ...knowledge.topics,
    ...knowledge.pages,
    ...knowledge.people,
    ...knowledge.proof,
    ...knowledge.actions,
    ...(knowledge.blogs || []),
    ...(knowledge.socials || []),
    ...(knowledge.manufacturers || []),
    ...(knowledge.products || []),
    ...(knowledge.concepts || []),
    ...(knowledge.qas || []),
    ...(knowledge.communities || []),
    ...(knowledge.ctas || []),
    ...(knowledge.sponsored || []),
  ];
}

export function scoreRelevance(item: AnyKnowledgeItem, query: string): number {
  if (!query.trim()) return 0;
  const words = query.toLowerCase().split(/\s+/);
  let score = 0;
  
  for (const word of words) {
    if (word.length < 2) continue;
    for (const keyword of item.keywords) {
      if (keyword.toLowerCase().includes(word)) {
        score += 10;
      }
    }
    
    if (item.type === 'topic' && item.label.toLowerCase().includes(word)) score += 15;
    if (item.type === 'page' && item.title.toLowerCase().includes(word)) score += 15;
    if (item.type === 'person' && item.name.toLowerCase().includes(word)) score += 20;
    if (item.type === 'proof' && item.label.toLowerCase().includes(word)) score += 10;
    if (item.type === 'action' && item.label.toLowerCase().includes(word)) score += 10;
    if (item.type === 'blog' && item.title.toLowerCase().includes(word)) score += 15;
    if (item.type === 'social' && (item.platform.toLowerCase().includes(word) || item.handle.toLowerCase().includes(word))) score += 12;
    if (item.type === 'manufacturer' && item.name.toLowerCase().includes(word)) score += 20;
    if (item.type === 'product' && item.name.toLowerCase().includes(word)) score += 18;
    if (item.type === 'concept' && item.label.toLowerCase().includes(word)) score += 15;
    if (item.type === 'qa' && item.question.toLowerCase().includes(word)) score += 15;
    if (item.type === 'community' && item.name.toLowerCase().includes(word)) score += 12;
    if (item.type === 'cta' && item.label.toLowerCase().includes(word)) score += 8;
    if (item.type === 'sponsored' && item.name.toLowerCase().includes(word)) score += 10;
    
    if ('summary' in item && typeof item.summary === 'string' && item.summary.toLowerCase().includes(word)) score += 5;
    if ('answer' in item && typeof item.answer === 'string' && item.answer.toLowerCase().includes(word)) score += 5;
    if ('whyItMatters' in item && typeof item.whyItMatters === 'string' && item.whyItMatters?.toLowerCase().includes(word)) score += 5;
  }
  
  return score;
}

export function rankByRelevance(items: AnyKnowledgeItem[], query: string): AnyKnowledgeItem[] {
  if (!query.trim()) return items;
  
  return [...items].sort((a, b) => {
    const scoreA = scoreRelevance(a, query);
    const scoreB = scoreRelevance(b, query);
    return scoreB - scoreA;
  });
}
