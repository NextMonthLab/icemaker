/**
 * Orbit Configuration System
 * 
 * Defines the contract for orbit-specific content and behavior.
 * All orbits share the same shell but can customize their appearance,
 * content, and interaction patterns through this config.
 * 
 * To add a new orbit:
 * 1. Create an entry in ORBIT_CONFIGS with your slug
 * 2. Define starterTiles with intentTags for gravity reordering
 * 3. Set any uiOverrides for motion/appearance customization
 */

export interface OrbitTile {
  id: string;
  label: string;
  sublabel?: string;
  intentTags: string[];
  priority?: number;
  type?: 'topic' | 'question' | 'trending' | 'new' | 'popular';
  badge?: 'trending' | 'new' | 'debated' | 'saved';
}

export interface OrbitCTA {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'ghost';
  href?: string;
  action?: string;
  intentTags?: string[];
}

export interface OrbitUIOverrides {
  accent?: string;
  disableMotion?: boolean;
  disableIntentGravity?: boolean;
  proofOfLifeEnabled?: boolean;
  proofOfLifeLabel?: string;
}

export interface OrbitConfig {
  slug: string;
  displayName: string;
  introTemplate?: string;
  starterTiles?: OrbitTile[];
  ctas?: OrbitCTA[];
  uiOverrides?: OrbitUIOverrides;
}

export const DEFAULT_UI_OVERRIDES: OrbitUIOverrides = {
  disableMotion: false,
  disableIntentGravity: false,
  proofOfLifeEnabled: true,
  proofOfLifeLabel: 'Popular questions',
};

export const DEFAULT_INTRO_TEMPLATE = 
  "This Orbit tracks what people are asking about {topic}. Tap a tile, or ask your own question.";

export const ORBIT_CONFIGS: Record<string, OrbitConfig> = {
  'smart-glasses': {
    slug: 'smart-glasses',
    displayName: 'Smart Glasses',
    introTemplate: "This Orbit tracks what people are asking about smart glasses and AR eyewear. Tap a tile, or ask your own question.",
    starterTiles: [
      { id: 'worth-it', label: 'Are smart glasses worth it?', intentTags: ['value', 'purchase', 'worth'], type: 'trending', badge: 'trending' },
      { id: 'camera', label: 'Best camera quality', intentTags: ['camera', 'photo', 'video', 'quality'], type: 'question' },
      { id: 'prescription', label: 'Prescription lens options', intentTags: ['prescription', 'lenses', 'vision'], type: 'topic' },
      { id: 'battery', label: 'Battery life expectations', intentTags: ['battery', 'power', 'charging'], type: 'question' },
      { id: 'ar-vs-smart', label: 'Smart vs AR glasses', intentTags: ['ar', 'difference', 'comparison'], type: 'topic', badge: 'debated' },
      { id: 'safety', label: 'Safety considerations', intentTags: ['safety', 'health', 'daily-use'], type: 'topic' },
      { id: 'platform', label: 'iPhone vs Android', intentTags: ['ios', 'android', 'compatibility', 'platform'], type: 'question' },
      { id: 'features', label: 'Key features to look for', intentTags: ['features', 'buying', 'guide'], type: 'topic', badge: 'saved' },
    ],
    ctas: [
      { id: 'friend', label: 'Become a Friend', type: 'secondary', href: '/smartglasses/partners' },
      { id: 'influencer', label: 'Become an Influencer', type: 'secondary', href: '/smartglasses/partners' },
      { id: 'advertise', label: 'Advertise', type: 'ghost', href: '/smartglasses/partners' },
    ],
    uiOverrides: {
      proofOfLifeEnabled: true,
      proofOfLifeLabel: 'Trending now',
    },
  },
};

export function getOrbitConfig(slug: string): OrbitConfig | null {
  return ORBIT_CONFIGS[slug] || null;
}

export function getIntroText(config: OrbitConfig | null, fallbackTopic: string): string {
  if (config?.introTemplate) {
    return config.introTemplate;
  }
  return DEFAULT_INTRO_TEMPLATE.replace('{topic}', fallbackTopic);
}

/**
 * Compute relevance score between user intent and tile intent tags
 * Returns 0-1 score based on keyword overlap
 */
export function computeRelevanceScore(
  userIntent: string[],
  tileIntentTags: string[]
): number {
  if (userIntent.length === 0 || tileIntentTags.length === 0) return 0;
  
  const userSet = new Set(userIntent.map(t => t.toLowerCase()));
  const matchCount = tileIntentTags.filter(tag => 
    userSet.has(tag.toLowerCase()) ||
    Array.from(userSet).some(u => tag.toLowerCase().includes(u) || u.includes(tag.toLowerCase()))
  ).length;
  
  return matchCount / Math.max(tileIntentTags.length, 1);
}

/**
 * Extract intent keywords from a user question
 * Lightweight heuristic without AI calls
 */
export function extractIntentFromQuestion(question: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'can', 'may', 'might', 'must', 'shall', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
    'she', 'it', 'we', 'they', 'their', 'my', 'your', 'his', 'her', 'its',
    'our', 'for', 'and', 'but', 'or', 'so', 'yet', 'to', 'of', 'in', 'on',
    'at', 'by', 'with', 'about', 'how', 'why', 'when', 'where', 'like',
  ]);
  
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}
