/**
 * Topic Tile Generator
 * 
 * Generates insight-based topic tiles from crawled website content.
 * Uses AI to extract topics and enforce grounding rules (citations required).
 */

import OpenAI from 'openai';
import type { 
  OrbitTile, 
  OrbitCrawlPage, 
  OrbitCrawlReport,
  OrbitIngestResult,
  TileCategory,
  TileConfidence,
  TileStatus,
  TileSource,
  ALWAYS_ON_BUCKETS
} from '../../shared/orbitTileTypes';
import { 
  MINIMUM_TILES, 
  MAX_PAGES_PER_CRAWL,
  ALWAYS_ON_BUCKETS as BUCKETS 
} from '../../shared/orbitTileTypes';
import { deepScrapeUrl, type DeepScrapeResult } from './deepScraper';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ 
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

const CANDIDATE_PATHS = [
  '/',
  '/about', '/about-us',
  '/services', '/what-we-do',
  '/pricing', '/fees', '/prices',
  '/contact', '/contact-us',
  '/faq', '/faqs',
  '/testimonials', '/reviews',
  '/team', '/our-team',
  '/blog',
];

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.origin;
  } catch {
    return url;
  }
}

function generateCandidateUrls(baseUrl: string): string[] {
  const origin = normalizeUrl(baseUrl);
  const candidates: string[] = [];
  
  for (const path of CANDIDATE_PATHS) {
    candidates.push(`${origin}${path}`);
  }
  
  return Array.from(new Set(candidates));
}

function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).hostname;
    const baseHost = new URL(baseUrl).hostname;
    return urlHost === baseHost || urlHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${urlHost}`);
  } catch {
    return false;
  }
}

function classifyPageType(url: string, title: string | null, text: string): string {
  const urlLower = url.toLowerCase();
  const titleLower = (title || '').toLowerCase();
  
  if (urlLower.includes('/about') || titleLower.includes('about')) return 'about';
  if (urlLower.includes('/team') || titleLower.includes('team')) return 'team';
  if (urlLower.includes('/faq') || titleLower.includes('faq')) return 'faq';
  if (urlLower.includes('/contact') || titleLower.includes('contact')) return 'contact';
  if (urlLower.includes('/testimonial') || urlLower.includes('/review')) return 'testimonials';
  if (urlLower.includes('/service') || urlLower.includes('/what-we-do')) return 'services';
  if (urlLower.includes('/pricing') || urlLower.includes('/price') || urlLower.includes('/fee')) return 'pricing';
  if (urlLower === normalizeUrl(url) + '/' || urlLower.endsWith('/')) return 'home';
  return 'other';
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text.length > 2 && text.length < 200) {
      headings.push(text);
    }
  }
  return headings;
}

function extractBullets(html: string): string[] {
  const bullets: string[] = [];
  const regex = /<li[^>]*>([^<]+)<\/li>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text.length > 5 && text.length < 300) {
      bullets.push(text);
    }
  }
  return bullets.slice(0, 50);
}

function extractExcerpts(text: string): Array<{ text: string; selectorHint?: string }> {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 50 && s.trim().length < 250);
  return sentences.slice(0, 20).map(s => ({ text: s.trim() + '.' }));
}

function extractKeyPhrases(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const phrases: string[] = [];
  
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    if (bigram.length > 5 && bigram.length < 50) {
      phrases.push(bigram);
    }
  }
  
  const freq: Record<string, number> = {};
  for (const p of phrases) {
    freq[p] = (freq[p] || 0) + 1;
  }
  
  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase]) => phrase);
}

async function crawlPages(baseUrl: string): Promise<{ pages: OrbitCrawlPage[]; report: OrbitCrawlReport }> {
  const startTime = Date.now();
  const candidates = generateCandidateUrls(baseUrl);
  const pages: OrbitCrawlPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const visitedUrls = new Set<string>();
  
  console.log(`[TopicTileGenerator] Starting crawl for ${baseUrl} with ${candidates.length} candidates`);
  
  for (const url of candidates) {
    if (pages.length >= MAX_PAGES_PER_CRAWL) break;
    if (visitedUrls.has(url)) continue;
    
    visitedUrls.add(url);
    
    try {
      console.log(`[TopicTileGenerator] Crawling ${url}...`);
      const result = await deepScrapeUrl(url, { timeout: 30000, scrollPage: true });
      
      if (result.crawlStatus === 'ok' && result.html.length > 500) {
        const text = result.text || '';
        pages.push({
          url: result.url,
          finalUrl: result.finalUrl,
          title: result.title,
          pageType: classifyPageType(result.url, result.title, text),
          headings: extractHeadings(result.html),
          bullets: extractBullets(result.html),
          keyPhrases: extractKeyPhrases(text),
          excerpts: extractExcerpts(text),
          crawlStatus: result.crawlStatus,
          scannedAt: new Date().toISOString(),
        });
        console.log(`[TopicTileGenerator] Successfully crawled ${url} (${text.length} chars)`);
      } else {
        errors.push({ url, error: result.error || result.crawlStatus });
      }
    } catch (error: any) {
      console.error(`[TopicTileGenerator] Error crawling ${url}:`, error.message);
      errors.push({ url, error: error.message });
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  const report: OrbitCrawlReport = {
    pagesAttempted: visitedUrls.size,
    pagesSucceeded: pages.length,
    errors,
    scanTimestamp: new Date().toISOString(),
    coverageScore: visitedUrls.size > 0 ? pages.length / visitedUrls.size : 0,
    crawlDurationMs: Date.now() - startTime,
  };
  
  console.log(`[TopicTileGenerator] Crawl complete: ${pages.length}/${visitedUrls.size} pages, ${report.crawlDurationMs}ms`);
  
  return { pages, report };
}

async function generateTilesFromContent(pages: OrbitCrawlPage[], inputUrl: string): Promise<OrbitTile[]> {
  if (pages.length === 0) {
    return generateDraftTiles(inputUrl, 'No pages were successfully crawled.');
  }
  
  const allHeadings = pages.flatMap(p => p.headings);
  const allBullets = pages.flatMap(p => p.bullets);
  const allExcerpts = pages.flatMap(p => p.excerpts.map(e => ({ ...e, url: p.url, title: p.title })));
  const allPhrases = pages.flatMap(p => p.keyPhrases);
  
  const contentSummary = {
    headings: allHeadings.slice(0, 30),
    bullets: allBullets.slice(0, 40),
    keyPhrases: Array.from(new Set(allPhrases)).slice(0, 30),
    excerpts: allExcerpts.slice(0, 25),
    pageTypes: pages.map(p => ({ url: p.url, type: p.pageType, title: p.title })),
  };
  
  const openai = getOpenAI();
  
  const prompt = `Analyze this website content and generate topic tiles (insights) for a business intelligence dashboard.

Website: ${inputUrl}
Pages crawled: ${pages.length}

CONTENT EXTRACTED:
Headings: ${JSON.stringify(contentSummary.headings)}
Bullet points: ${JSON.stringify(contentSummary.bullets)}
Key phrases: ${JSON.stringify(contentSummary.keyPhrases)}

EXCERPTS WITH SOURCES:
${contentSummary.excerpts.map((e, i) => `[${i}] From ${e.url}: "${e.text}"`).join('\n')}

Generate 12-18 topic tiles following these rules:

TILE CATEGORIES (distribute across all):
1. "Top Insights" - What the business does, who it serves, key promises
2. "Services & Offers" - Products, services, CTAs
3. "FAQs & Objections" - Common questions, concerns addressed
4. "Proof & Trust" - Testimonials, certifications, case studies
5. "Recommendations" - Suggestions and alternatives (always draft)

GROUNDING RULES:
- A tile is "confirmed" ONLY if you can cite a specific excerpt from the content
- A tile is "draft" if you're inferring or the info is missing
- Draft tiles MUST include "missingSignals" explaining what's lacking

OUTPUT JSON array of tiles with this schema:
{
  "topicSlug": "string (kebab-case)",
  "title": "string (short, 3-6 words)",
  "summary": "string (1-2 sentences)",
  "category": "Top Insights" | "Services & Offers" | "FAQs & Objections" | "Proof & Trust" | "Recommendations",
  "confidence": "high" | "medium" | "low",
  "status": "confirmed" | "draft",
  "sources": [{ "url": "string", "title": "string or null", "excerpt": "exact quote from content" }],
  "missingSignals": ["string"] // only for draft tiles
}

Generate at least 12 tiles. Prioritize confirmed tiles with real citations.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a business analyst extracting insights from website content. Always cite specific excerpts. Output valid JSON array only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });
    
    const content = response.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const rawTiles = JSON.parse(jsonMatch[0]);
      const tiles: OrbitTile[] = rawTiles.map((t: any, idx: number) => ({
        id: `tile_${Date.now()}_${idx}`,
        topicSlug: t.topicSlug || `topic-${idx}`,
        title: t.title || 'Untitled',
        summary: t.summary || '',
        category: t.category || 'Top Insights',
        confidence: t.confidence || 'medium',
        status: t.status || 'draft',
        freshness: { scannedAt: new Date().toISOString() },
        sources: (t.sources || []).map((s: any) => ({
          url: s.url || inputUrl,
          title: s.title || null,
          excerpt: s.excerpt || '',
        })),
        actions: ['Ask Orbit', 'Generate ICE', 'Save', 'Share'] as const,
        missingSignals: t.missingSignals,
      }));
      
      return enforceTileMinimum(tiles, inputUrl, pages.length);
    }
  } catch (error: any) {
    console.error('[TopicTileGenerator] AI generation error:', error.message);
  }
  
  return generateDraftTiles(inputUrl, `AI extraction failed. ${pages.length} pages were crawled.`);
}

function generateDraftTiles(inputUrl: string, reason: string): OrbitTile[] {
  const now = new Date().toISOString();
  
  return BUCKETS.map((bucket, idx) => ({
    id: `tile_draft_${Date.now()}_${idx}`,
    topicSlug: bucket.slug,
    title: bucket.title,
    summary: `We're still gathering information about ${bucket.title.toLowerCase()}.`,
    category: bucket.category,
    confidence: 'low' as TileConfidence,
    status: 'draft' as TileStatus,
    freshness: { scannedAt: now },
    sources: [],
    actions: ['Ask Orbit', 'Generate ICE', 'Save', 'Share'] as const,
    missingSignals: [reason, `No specific content found for ${bucket.title.toLowerCase()}.`],
  }));
}

function enforceTileMinimum(tiles: OrbitTile[], inputUrl: string, pageCount: number): OrbitTile[] {
  if (tiles.length >= MINIMUM_TILES) return tiles;
  
  const existingSlugs = new Set(tiles.map(t => t.topicSlug));
  const now = new Date().toISOString();
  
  for (const bucket of BUCKETS) {
    if (tiles.length >= MINIMUM_TILES) break;
    if (existingSlugs.has(bucket.slug)) continue;
    
    tiles.push({
      id: `tile_fill_${Date.now()}_${tiles.length}`,
      topicSlug: bucket.slug,
      title: bucket.title,
      summary: `We're still gathering information about ${bucket.title.toLowerCase()}.`,
      category: bucket.category,
      confidence: 'low',
      status: 'draft',
      freshness: { scannedAt: now },
      sources: [],
      actions: ['Ask Orbit', 'Generate ICE', 'Save', 'Share'],
      missingSignals: [
        `Only ${pageCount} pages scanned successfully.`,
        `No specific content found for ${bucket.title.toLowerCase()}.`,
      ],
    });
  }
  
  return tiles;
}

export async function ingestUrlAndGenerateTiles(inputUrl: string, providedOrbitId?: string): Promise<OrbitIngestResult> {
  const orbitId = providedOrbitId || `orbit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  console.log(`[TopicTileGenerator] Starting ingestion for ${inputUrl} (orbitId: ${orbitId})`);
  
  const { pages, report } = await crawlPages(inputUrl);
  const tiles = await generateTilesFromContent(pages, inputUrl);
  
  const result: OrbitIngestResult = {
    orbitId,
    inputUrl,
    scannedAt: new Date().toISOString(),
    pages,
    tiles,
    crawlReport: report,
  };
  
  console.log(`[TopicTileGenerator] Ingestion complete: ${tiles.length} tiles generated`);
  
  return result;
}

export function groupTilesByCategory(tiles: OrbitTile[]): Record<TileCategory, OrbitTile[]> {
  const groups: Record<TileCategory, OrbitTile[]> = {
    'Top Insights': [],
    'Services & Offers': [],
    'FAQs & Objections': [],
    'Proof & Trust': [],
    'Recommendations': [],
  };
  
  for (const tile of tiles) {
    if (groups[tile.category]) {
      groups[tile.category].push(tile);
    } else {
      groups['Top Insights'].push(tile);
    }
  }
  
  return groups;
}
