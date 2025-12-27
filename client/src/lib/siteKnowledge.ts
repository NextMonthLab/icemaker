export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  primaryColor: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'topic' | 'page' | 'person' | 'proof' | 'action';
  keywords: string[];
}

export interface Topic extends KnowledgeItem {
  type: 'topic';
  label: string;
  summary: string;
}

export interface Page extends KnowledgeItem {
  type: 'page';
  title: string;
  url: string;
  summary: string;
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
}

export interface Action extends KnowledgeItem {
  type: 'action';
  label: string;
  summary: string;
  actionType: 'video_reply' | 'call' | 'email' | 'quote';
}

export type AnyKnowledgeItem = Topic | Page | Person | Proof | Action;

export interface SiteKnowledge {
  brand: Brand;
  topics: Topic[];
  pages: Page[];
  people: Person[];
  proof: Proof[];
  actions: Action[];
}

export function getAllItems(knowledge: SiteKnowledge): AnyKnowledgeItem[] {
  return [
    ...knowledge.topics,
    ...knowledge.pages,
    ...knowledge.people,
    ...knowledge.proof,
    ...knowledge.actions,
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
