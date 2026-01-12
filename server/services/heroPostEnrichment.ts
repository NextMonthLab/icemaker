import OpenAI from "openai";
import type { HeroPost, HeroPostPlatform } from "@shared/schema";
import { validateUrlForSSRF, sanitizeUrl } from "./ssrfProtection";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function detectPlatform(url: string): HeroPostPlatform {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'x';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) return 'facebook';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    
    return 'other';
  } catch {
    return 'other';
  }
}

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
}

export async function fetchOpenGraphData(url: string): Promise<OpenGraphData> {
  try {
    // SSRF protection: validate URL before fetching
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      console.warn('[HeroPost] Invalid URL format:', url);
      return {};
    }
    
    const validation = await validateUrlForSSRF(sanitizedUrl);
    if (!validation.safe) {
      console.warn('[HeroPost] SSRF blocked:', validation.error, url);
      return {};
    }
    
    const response = await fetch(sanitizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OrbitBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return {};
    
    const html = await response.text();
    
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
    const ogDescription = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1];
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
    
    const title = ogTitle || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    
    return {
      title: title?.slice(0, 500),
      description: ogDescription?.slice(0, 1000),
      image: ogImage,
    };
  } catch (error) {
    console.error('[HeroPost] OpenGraph fetch error:', error);
    return {};
  }
}

interface ExtractionResult {
  topics: string[];
  hookType: string;
  intent: 'educate' | 'sell' | 'recruit' | 'culture' | 'proof';
  offers: string[];
  proofPoints: string[];
  entities: string[];
  riskFlags: string[];
  followUpIdeas: Array<{ title: string; hook: string; linkBack: string }>;
}

export async function extractInsights(text: string, url: string): Promise<ExtractionResult> {
  if (!text || text.length < 20) {
    return {
      topics: [],
      hookType: 'unknown',
      intent: 'educate',
      offers: [],
      proofPoints: [],
      entities: [],
      riskFlags: [],
      followUpIdeas: [],
    };
  }

  const systemPrompt = `You are an expert at analyzing high-performing social media posts to extract patterns and insights.

Analyze the provided post and extract:
1. topics: Main themes/subjects discussed (2-5 keywords)
2. hookType: How the post opens - one of: question, contrarian, story, list, statistic, personal, client_win, announcement
3. intent: Primary goal - one of: educate, sell, recruit, culture, proof
4. offers: Any products, services, or calls-to-action mentioned
5. proofPoints: Numbers, testimonials, results, case studies, before/after claims
6. entities: Companies, people, products mentioned
7. riskFlags: Any potentially controversial or risky claims
8. followUpIdeas: 3 suggested follow-up posts, each with a title, hook, and a "linkBack" phrase that references the original post

Return valid JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Post URL: ${url}\n\nPost text:\n${text}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    
    return {
      topics: parsed.topics || [],
      hookType: parsed.hookType || 'unknown',
      intent: parsed.intent || 'educate',
      offers: parsed.offers || [],
      proofPoints: parsed.proofPoints || [],
      entities: parsed.entities || [],
      riskFlags: parsed.riskFlags || [],
      followUpIdeas: parsed.followUpIdeas || [],
    };
  } catch (error) {
    console.error('[HeroPost] AI extraction error:', error);
    return {
      topics: [],
      hookType: 'unknown',
      intent: 'educate',
      offers: [],
      proofPoints: [],
      entities: [],
      riskFlags: [],
      followUpIdeas: [],
    };
  }
}

interface InsightAggregation {
  topThemes: Array<{ theme: string; count: number }>;
  topHooks: Array<{ hookType: string; count: number }>;
  topProofTypes: Array<{ proofType: string; count: number }>;
  suggestions: Array<{
    title: string;
    hook: string;
    theme: string;
    basedOnPostId: number;
    linkBackSuggestion: string;
  }>;
  summary: string;
}

export function aggregateInsights(posts: HeroPost[]): InsightAggregation {
  const readyPosts = posts.filter(p => p.status === 'ready' && p.extracted);
  
  if (readyPosts.length === 0) {
    return {
      topThemes: [],
      topHooks: [],
      topProofTypes: [],
      suggestions: [],
      summary: "Add more Hero Posts to see insights.",
    };
  }

  const themeCounts: Record<string, number> = {};
  const hookCounts: Record<string, number> = {};
  const proofTypeCounts: Record<string, number> = {};
  const allSuggestions: InsightAggregation['suggestions'] = [];

  for (const post of readyPosts) {
    const extracted = post.extracted as ExtractionResult | undefined;
    if (!extracted) continue;

    for (const topic of extracted.topics || []) {
      themeCounts[topic] = (themeCounts[topic] || 0) + 1;
    }

    if (extracted.hookType) {
      hookCounts[extracted.hookType] = (hookCounts[extracted.hookType] || 0) + 1;
    }

    for (const proof of extracted.proofPoints || []) {
      const proofType = proof.length > 50 ? 'case_study' : proof.match(/\d/) ? 'statistic' : 'testimonial';
      proofTypeCounts[proofType] = (proofTypeCounts[proofType] || 0) + 1;
    }

    for (const idea of extracted.followUpIdeas || []) {
      allSuggestions.push({
        title: idea.title,
        hook: idea.hook,
        theme: extracted.topics?.[0] || 'general',
        basedOnPostId: post.id,
        linkBackSuggestion: idea.linkBack,
      });
    }
  }

  const topThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([theme, count]) => ({ theme, count }));

  const topHooks = Object.entries(hookCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([hookType, count]) => ({ hookType, count }));

  const topProofTypes = Object.entries(proofTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([proofType, count]) => ({ proofType, count }));

  const topThemesList = topThemes.slice(0, 3).map(t => t.theme).join(', ');
  const topHookType = topHooks[0]?.hookType || 'varied';
  
  const summary = readyPosts.length >= 5
    ? `Based on ${readyPosts.length} Hero Posts, your top themes are ${topThemesList}. You tend to use ${topHookType} hooks most effectively.`
    : `You have ${readyPosts.length} Hero Post${readyPosts.length > 1 ? 's' : ''}. Add ${5 - readyPosts.length} more to unlock deeper insights.`;

  return {
    topThemes,
    topHooks,
    topProofTypes,
    suggestions: allSuggestions.slice(0, 5),
    summary,
  };
}
