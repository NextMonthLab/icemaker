export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  primaryColor: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'topic' | 'page' | 'person' | 'proof' | 'action' | 'blog' | 'social';
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

export type AnyKnowledgeItem = Topic | Page | Person | Proof | Action | Blog | Social;

export interface SiteKnowledge {
  brand: Brand;
  topics: Topic[];
  pages: Page[];
  people: Person[];
  proof: Proof[];
  actions: Action[];
  blogs: Blog[];
  socials: Social[];
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
    
    if ('summary' in item && item.summary.toLowerCase().includes(word)) score += 5;
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
