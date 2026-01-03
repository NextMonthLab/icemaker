import puppeteer, { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';

// Resolve chromium path dynamically for Nix environments
function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  try {
    const path = execSync('which chromium || which chromium-browser', { encoding: 'utf8' }).trim();
    if (path) return path;
  } catch {}
  return undefined;
}

const chromiumPath = getChromiumPath();

// Explicit crawl status for deterministic handling
export type CrawlStatus = 'ok' | 'blocked' | 'not_found' | 'server_error' | 'timeout' | 'no_content';

// Standardized page result - every consumer works off this structure
export interface DeepScrapeResult {
  url: string;
  finalUrl: string; // After redirects
  html: string;
  title: string | null;
  text?: string; // Optional plain text extraction
  schemaBlocks?: any[]; // JSON-LD structured data
  squarespaceData?: { items: any[]; context: any }; // Squarespace-specific embedded data
  screenshotBase64?: string;
  crawlStatus: CrawlStatus; // Explicit outcome for routing
  error?: string;
}

export interface DeepScraperOptions {
  timeout?: number;
  waitForSelector?: string;
  scrollPage?: boolean;
  captureScreenshot?: boolean;
}

// Crawl budget configuration
export interface CrawlBudget {
  maxPages: number;
  stopAfterEmptyPages?: number; // Stop if N pages yield no new content
  sameDomainOnly?: boolean;
  rateLimitMs?: number; // Delay between requests
}

// Multi-page crawl options
export interface MultiPageCrawlOptions extends CrawlBudget {
  candidates?: string[]; // Explicit URLs to crawl (skips discovery)
  linkPatterns?: RegExp[]; // Patterns for link discovery
  timeout?: number;
  scrollPage?: boolean;
}

// Multi-page crawl result
export interface MultiPageCrawlResult {
  pages: DeepScrapeResult[];
  pagesVisited: string[];
  candidatesDiscovered: string[];
  stoppedReason: 'max_pages' | 'no_candidates' | 'empty_pages' | 'completed';
}

const DEFAULT_OPTIONS: DeepScraperOptions = {
  timeout: 45000,
  scrollPage: true,
  captureScreenshot: false,
};

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    try {
      const isConnected = browserInstance.isConnected();
      if (isConnected) {
        return browserInstance;
      }
      console.log('[DeepScraper] Browser disconnected, closing stale instance...');
      await browserInstance.close().catch(() => {});
    } catch {
      console.log('[DeepScraper] Browser instance invalid, will relaunch...');
      browserInstance = null;
    }
  }
  
  console.log('[DeepScraper] Launching headless browser...');
  
  browserInstance = await puppeteer.launch({
    headless: true,
    ...(chromiumPath && { executablePath: chromiumPath }),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });
  
  return browserInstance;
}

export async function deepScrapeUrl(url: string, options: DeepScraperOptions = {}): Promise<DeepScrapeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let page: Page | null = null;
  
  console.log(`[DeepScraper] Starting deep scrape for: ${url}`);
  
  try {
    console.log('[DeepScraper] Getting browser instance...');
    const browser = await getBrowser();
    console.log('[DeepScraper] Browser obtained, creating page...');
    page = await browser.newPage();
    console.log('[DeepScraper] Page created successfully');
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`[DeepScraper] Navigating to ${url}...`);
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: opts.timeout,
    });
    
    // Check HTTP status - detect blocked/error responses early
    const httpStatus = response?.status() || 200;
    if (httpStatus === 403 || httpStatus === 401) {
      console.log(`[DeepScraper] Access blocked (HTTP ${httpStatus}) for ${url}`);
      await page.close();
      return {
        url,
        finalUrl: url,
        html: '',
        title: `${httpStatus} - Access Blocked`,
        text: `This website uses bot protection. You can still import your content using paste, CSV, or a platform connection.`,
        crawlStatus: 'blocked',
        error: `HTTP ${httpStatus}: Website blocked automated access`,
      };
    }
    if (httpStatus === 404) {
      console.log(`[DeepScraper] Page not found (HTTP 404) for ${url}`);
      await page.close();
      return {
        url,
        finalUrl: url,
        html: '',
        title: '404 - Not Found',
        text: 'The requested page was not found.',
        crawlStatus: 'not_found',
        error: 'HTTP 404: Page not found',
      };
    }
    if (httpStatus >= 500) {
      console.log(`[DeepScraper] Server error (HTTP ${httpStatus}) for ${url}`);
      await page.close();
      return {
        url,
        finalUrl: url,
        html: '',
        title: `${httpStatus} - Server Error`,
        text: 'The website returned a server error.',
        crawlStatus: 'server_error',
        error: `HTTP ${httpStatus}: Server error`,
      };
    }
    
    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 10000 }).catch(() => {
        console.log('[DeepScraper] Selector wait timeout, continuing...');
      });
    }
    
    await delay(2000);
    
    if (opts.scrollPage) {
      await autoScroll(page);
    }
    
    await delay(1000);
    
    const html = await page.content();
    const title = await page.title();
    
    // Extract full page text (decoded entities) - critical for menu extraction
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const imgCount = await page.evaluate(() => document.querySelectorAll('img').length);
    console.log(`[DeepScraper] Page rendered - Title: "${title}", Images found: ${imgCount}`);
    console.log(`[DeepScraper] Body text preview: ${bodyText.substring(0, 200)}...`);
    
    let screenshotBase64: string | undefined;
    if (opts.captureScreenshot) {
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      screenshotBase64 = screenshot as string;
    }
    
    // Extract JSON-LD schema blocks (Menu, MenuItem, Product, etc.)
    const schemaBlocks = await page.evaluate(() => {
      const blocks: any[] = [];
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          blocks.push(data);
        } catch {}
      });
      return blocks;
    });
    
    // Extract Squarespace-specific data (menu items are often embedded as JSON)
    const squarespaceData = await page.evaluate(() => {
      const result: any = { items: [], context: null };
      try {
        // Try to find Squarespace context with menu/product data
        if ((window as any).Static?.SQUARESPACE_CONTEXT) {
          result.context = (window as any).Static.SQUARESPACE_CONTEXT;
        }
        // Look for store items
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
          const text = script.textContent || '';
          // Squarespace stores items in various embedded JSON formats
          const itemMatch = text.match(/StoreItemJson\s*=\s*(\{[\s\S]*?\});/);
          if (itemMatch) {
            try {
              result.items.push(JSON.parse(itemMatch[1]));
            } catch {}
          }
        });
      } catch {}
      return result;
    });
    
    // Get final URL after any redirects
    const finalUrl = page.url();
    
    console.log(`[DeepScraper] Successfully scraped ${url} (${html.length} chars, ${bodyText.length} text chars, ${imgCount} images, ${schemaBlocks.length} schema blocks)`);
    
    // Check if page returned minimal content (might be bot protection page)
    const hasContent = html.length > 1000;
    
    return {
      url,
      finalUrl,
      html,
      title: title || null,
      text: bodyText, // Full decoded text content
      schemaBlocks: schemaBlocks.length > 0 ? schemaBlocks : undefined,
      squarespaceData: (squarespaceData.items.length > 0 || squarespaceData.context) ? squarespaceData : undefined,
      screenshotBase64,
      crawlStatus: hasContent ? 'ok' : 'no_content',
    };
  } catch (error: any) {
    console.error(`[DeepScraper] Error scraping ${url}:`, error.message);
    const isTimeout = error.message?.includes('timeout') || error.message?.includes('Timeout');
    return {
      url,
      finalUrl: url,
      html: '',
      title: null,
      crawlStatus: isTimeout ? 'timeout' : 'server_error',
      error: error.message,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a callback function with a Puppeteer page object.
 * This is the canonical way for other modules to use the shared browser.
 * The page is automatically closed after the callback completes.
 * 
 * @param url - URL to navigate to
 * @param callback - Function to execute with the page
 * @param options - Scraper options (timeout, scroll, etc.)
 */
export async function withPage<T>(
  url: string,
  callback: (page: Page, html: string) => Promise<T>,
  options: DeepScraperOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let page: Page | null = null;
  
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: opts.timeout,
    });
    
    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 10000 }).catch(() => {});
    }
    
    await delay(2000);
    
    if (opts.scrollPage) {
      await autoScroll(page);
    }
    
    await delay(1000);
    
    const html = await page.content();
    
    return await callback(page, html);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

// Default link patterns for different content types
export const LINK_PATTERNS = {
  menu: [
    /burgers?/i, /chicken/i, /sides?/i, /drinks?/i, /desserts?/i,
    /meals?/i, /buckets?/i, /wraps?/i, /salads?/i, /breakfast/i,
    /lunch/i, /dinner/i, /appetizers?/i, /starters?/i, /mains?/i,
    /pizzas?/i, /pasta/i, /sandwiches?/i, /sharing/i, /vegan/i,
    /vegetarian/i, /kids/i, /combos?/i, /value/i, /specials?/i,
    /rice/i, /bowls/i, /twisters?/i, /box/i, /savers/i, /classic/i, /dips/i,
    /menu/i, /food/i, /order/i, /takeaway/i
  ],
  ecommerce: [
    /products?/i, /collections?/i, /categories?/i, /shop/i,
    /catalog/i, /store/i, /items?/i, /buy/i
  ],
  general: [
    /about/i, /services/i, /products?/i, /team/i, /contact/i,
    /pricing/i, /features/i, /solutions/i
  ],
  // High-signal pages for richer business data extraction
  highSignal: [
    // About & Identity
    /about/i, /our-story/i, /story/i, /company/i, /mission/i, /values/i, /who-we-are/i,
    // Team & People
    /team/i, /people/i, /meet-the-team/i, /leadership/i, /staff/i, /our-team/i,
    // Trust & Proof
    /testimonials?/i, /reviews?/i, /case-stud/i, /work/i, /portfolio/i, /clients?/i, /success/i,
    // Help & Support
    /faq/i, /faqs/i, /help/i, /support/i, /shipping/i, /returns/i, /delivery/i,
    // Contact & Location
    /contact/i, /locations?/i, /find-us/i, /visit/i, /hours/i, /opening/i,
    // Services & Pricing
    /services/i, /what-we-do/i, /industries/i, /pricing/i, /packages/i
  ]
};

/**
 * @deprecated Use deepScrapeMultiplePages instead - it returns raw pages for separate parsing.
 * This function mixes crawling and parsing which violates single-responsibility.
 */
export async function withMultiplePages<T>(
  baseUrl: string,
  callback: (page: Page, html: string, pageUrl: string) => Promise<T[]>,
  options: {
    maxPages?: number;
    linkPatterns?: RegExp[];
    timeout?: number;
  } = {}
): Promise<{ items: T[]; pagesVisited: string[] }> {
  // Delegate to canonical crawler then apply callback
  const result = await deepScrapeMultiplePages(baseUrl, {
    maxPages: options.maxPages || 10,
    linkPatterns: options.linkPatterns || LINK_PATTERNS.menu,
    timeout: options.timeout || 45000,
    sameDomainOnly: true
  });
  
  // Apply callback to each page (for backwards compatibility)
  const allItems: T[] = [];
  for (const pageResult of result.pages) {
    try {
      // Create a minimal page-like parsing context from the result
      const items = await parsePageWithCallback(pageResult, callback);
      allItems.push(...items);
    } catch (error: any) {
      console.error(`[DeepScraper] Error parsing ${pageResult.url}:`, error.message);
    }
  }
  
  return { items: allItems, pagesVisited: result.pagesVisited };
}

// Helper to parse a scraped page using a callback (for backwards compatibility)
async function parsePageWithCallback<T>(
  pageResult: DeepScrapeResult,
  callback: (page: Page, html: string, pageUrl: string) => Promise<T[]>
): Promise<T[]> {
  // For backwards compat, we need to create a temporary page
  // This is inefficient but maintains API compatibility during migration
  return withPage(pageResult.url, async (page, html) => {
    return callback(page, html, pageResult.url);
  });
}

function extractNavigationLinksWithPatterns(
  html: string,
  baseUrl: string,
  baseDomain: string,
  patterns: RegExp[]
): string[] {
  const links: string[] = [];
  const linkPattern = /<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const href = match[1];
      const absoluteUrl = new URL(href, baseUrl).href;
      const parsed = new URL(absoluteUrl);
      
      if (parsed.hostname === baseDomain || parsed.hostname === `www.${baseDomain}` || `www.${parsed.hostname}` === baseDomain) {
        if (patterns.some(pattern => pattern.test(parsed.pathname))) {
          links.push(absoluteUrl);
        }
      }
    } catch {}
  }
  
  return Array.from(new Set(links)).slice(0, 15);
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const maxScrolls = 10;
      let scrollCount = 0;
      
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;
        
        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });
}

/**
 * THE CANONICAL MULTI-PAGE CRAWLER
 * This is the ONLY multi-page crawling mechanism in the codebase.
 * All other code must use this function and parse the returned pages.
 * 
 * @param baseUrl - Starting URL for crawling
 * @param options - Crawl configuration (maxPages, linkPatterns, etc.)
 * @returns Standardized result with pages, visited URLs, and stop reason
 */
export async function deepScrapeMultiplePages(
  baseUrl: string,
  options: MultiPageCrawlOptions = { maxPages: 10 }
): Promise<MultiPageCrawlResult> {
  const maxPages = options.maxPages || 10;
  const sameDomainOnly = options.sameDomainOnly !== false; // Default true
  const rateLimitMs = options.rateLimitMs || 500;
  const stopAfterEmpty = options.stopAfterEmptyPages || 5;
  const linkPatterns = options.linkPatterns || LINK_PATTERNS.general;
  
  const pages: DeepScrapeResult[] = [];
  const visited = new Set<string>();
  const pagesVisited: string[] = [];
  const candidatesDiscovered: string[] = [];
  let emptyPageCount = 0;
  let stoppedReason: MultiPageCrawlResult['stoppedReason'] = 'completed';
  
  // Use explicit candidates if provided, otherwise start with baseUrl
  const toVisit: string[] = options.candidates?.length 
    ? [...options.candidates] 
    : [baseUrl];
  
  const parsedBase = new URL(baseUrl);
  const baseDomain = parsedBase.hostname.replace(/^www\./, '');
  
  console.log(`[DeepScraper] Starting multi-page crawl: ${baseUrl}, maxPages=${maxPages}, patterns=${linkPatterns.length}`);
  
  while (toVisit.length > 0 && pages.length < maxPages) {
    const url = toVisit.shift()!;
    const normalizedUrl = normalizeUrl(url);
    
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);
    
    // Rate limiting
    if (pages.length > 0 && rateLimitMs > 0) {
      await delay(rateLimitMs);
    }
    
    const result = await deepScrapeUrl(url, { 
      timeout: options.timeout || 45000,
      scrollPage: options.scrollPage !== false 
    });
    
    if (result.html && result.html.length > 500) {
      pages.push(result);
      pagesVisited.push(url);
      emptyPageCount = 0;
      
      // Discover links for further crawling (only if not using explicit candidates)
      if (!options.candidates?.length) {
        const links = extractNavigationLinksWithPatterns(result.html, url, baseDomain, linkPatterns);
        for (const link of links) {
          const normalizedLink = normalizeUrl(link);
          if (!visited.has(normalizedLink) && !toVisit.includes(link)) {
            // Same domain check
            if (sameDomainOnly) {
              try {
                const linkDomain = new URL(link).hostname.replace(/^www\./, '');
                if (linkDomain !== baseDomain) continue;
              } catch { continue; }
            }
            toVisit.push(link);
            candidatesDiscovered.push(link);
          }
        }
      }
    } else {
      emptyPageCount++;
      if (emptyPageCount >= stopAfterEmpty) {
        console.log(`[DeepScraper] Stopping: ${emptyPageCount} empty pages in a row`);
        stoppedReason = 'empty_pages';
        break;
      }
    }
  }
  
  if (pages.length >= maxPages) {
    stoppedReason = 'max_pages';
  } else if (toVisit.length === 0 && stoppedReason === 'completed') {
    stoppedReason = pages.length > 0 ? 'completed' : 'no_candidates';
  }
  
  console.log(`[DeepScraper] Crawl complete: ${pages.length} pages, ${candidatesDiscovered.length} candidates discovered, stopped=${stoppedReason}`);
  
  return { pages, pagesVisited, candidatesDiscovered, stoppedReason };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function extractNavigationLinks(html: string, baseUrl: string, baseDomain: string): string[] {
  const links: string[] = [];
  const linkPattern = /<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  
  const navPatterns = [
    /about/i,
    /services/i,
    /products/i,
    /team/i,
    /contact/i,
    /pricing/i,
    /features/i,
    /solutions/i,
    /articles/i,
    /blog/i,
    /series/i,
    /creators/i,
    /organisations/i,
    /portfolio/i,
    /work/i,
    /case-stud/i,
  ];
  
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const href = match[1];
      const absoluteUrl = new URL(href, baseUrl).href;
      const parsed = new URL(absoluteUrl);
      
      if (parsed.hostname === baseDomain || parsed.hostname === `www.${baseDomain}` || `www.${parsed.hostname}` === baseDomain) {
        if (navPatterns.some(pattern => pattern.test(parsed.pathname))) {
          links.push(absoluteUrl);
        }
      }
    } catch {
    }
  }
  
  return Array.from(new Set(links)).slice(0, 10);
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
    console.log('[DeepScraper] Browser closed');
  }
}

process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);
