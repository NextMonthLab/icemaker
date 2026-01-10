/**
 * Orbit Topic Tiles - Types
 * 
 * Topic tiles are insights derived from crawled website content.
 * Each tile represents a topic (not a page) with citations to source content.
 */

export type TileCategory = 
  | 'Top Insights'
  | 'Services & Offers'
  | 'FAQs & Objections'
  | 'Proof & Trust'
  | 'Recommendations';

export type TileConfidence = 'high' | 'medium' | 'low';

export type TileStatus = 'confirmed' | 'draft';

export type TileAction = 'Ask Orbit' | 'Generate ICE' | 'Save' | 'Share';

export interface TileSource {
  url: string;
  title?: string;
  excerpt: string;
  selectorHint?: string;
}

export interface OrbitTile {
  id: string;
  topicSlug: string;
  title: string;
  summary: string;
  category: TileCategory;
  confidence: TileConfidence;
  status: TileStatus;
  freshness: {
    scannedAt: string;
  };
  sources: TileSource[];
  actions: TileAction[];
  missingSignals?: string[];
}

export interface OrbitCrawlPage {
  url: string;
  finalUrl: string;
  title: string | null;
  pageType: string;
  headings: string[];
  bullets: string[];
  keyPhrases: string[];
  excerpts: Array<{
    text: string;
    selectorHint?: string;
  }>;
  crawlStatus: 'ok' | 'blocked' | 'not_found' | 'server_error' | 'timeout' | 'no_content';
  error?: string;
  scannedAt: string;
}

export interface OrbitCrawlReport {
  pagesAttempted: number;
  pagesSucceeded: number;
  errors: Array<{
    url: string;
    error: string;
  }>;
  scanTimestamp: string;
  coverageScore: number;
  crawlDurationMs: number;
}

export interface OrbitIngestResult {
  orbitId: string;
  inputUrl: string;
  scannedAt: string;
  pages: OrbitCrawlPage[];
  tiles: OrbitTile[];
  crawlReport: OrbitCrawlReport;
}

export interface OrbitIngestResponse {
  success: boolean;
  orbitId: string;
  tiles: OrbitTile[];
  crawlReport: OrbitCrawlReport;
  message?: string;
}

export const ALWAYS_ON_BUCKETS = [
  { slug: 'what-they-do', title: 'What They Do', category: 'Top Insights' as TileCategory },
  { slug: 'who-its-for', title: 'Who It\'s For', category: 'Top Insights' as TileCategory },
  { slug: 'key-promises', title: 'Key Promises', category: 'Top Insights' as TileCategory },
  { slug: 'process-overview', title: 'How It Works', category: 'Top Insights' as TileCategory },
  { slug: 'pricing-signals', title: 'Pricing Signals', category: 'Top Insights' as TileCategory },
  { slug: 'proof-trust', title: 'Proof & Trust', category: 'Proof & Trust' as TileCategory },
  { slug: 'locations-served', title: 'Areas Served', category: 'Top Insights' as TileCategory },
  { slug: 'faqs', title: 'Common Questions', category: 'FAQs & Objections' as TileCategory },
  { slug: 'ctas', title: 'Calls to Action', category: 'Services & Offers' as TileCategory },
  { slug: 'brand-voice', title: 'Brand Voice', category: 'Top Insights' as TileCategory },
  { slug: 'competitors', title: 'Alternatives', category: 'Recommendations' as TileCategory, alwaysDraft: true },
  { slug: 'quick-wins', title: 'Quick Wins', category: 'Recommendations' as TileCategory, alwaysDraft: true },
] as const;

export const MINIMUM_TILES = 12;
export const PREFERRED_TILES = 18;
export const MAX_PAGES_PER_CRAWL = 5;
