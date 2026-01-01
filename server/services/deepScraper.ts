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

export interface DeepScrapeResult {
  html: string;
  title: string | null;
  url: string;
  screenshotBase64?: string;
  error?: string;
}

export interface DeepScraperOptions {
  timeout?: number;
  waitForSelector?: string;
  scrollPage?: boolean;
  captureScreenshot?: boolean;
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
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: opts.timeout,
    });
    
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
    
    // Debug: Check if content was actually rendered
    const bodyContent = await page.evaluate(() => document.body.innerText?.substring(0, 500) || '');
    const imgCount = await page.evaluate(() => document.querySelectorAll('img').length);
    console.log(`[DeepScraper] Page rendered - Title: "${title}", Images found: ${imgCount}`);
    console.log(`[DeepScraper] Body text preview: ${bodyContent.substring(0, 200)}...`);
    
    let screenshotBase64: string | undefined;
    if (opts.captureScreenshot) {
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      screenshotBase64 = screenshot as string;
    }
    
    console.log(`[DeepScraper] Successfully scraped ${url} (${html.length} chars, ${imgCount} images)`);
    
    return {
      html,
      title: title || null,
      url,
      screenshotBase64,
    };
  } catch (error: any) {
    console.error(`[DeepScraper] Error scraping ${url}:`, error.message);
    return {
      html: '',
      title: null,
      url,
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

/**
 * Execute a callback on multiple pages, using the shared browser.
 * Uses configurable link patterns for discovery.
 * 
 * @param baseUrl - Starting URL
 * @param callback - Function to extract data from each page
 * @param options - Configuration for link discovery
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
  const maxPages = options.maxPages || 10;
  const allItems: T[] = [];
  const visited = new Set<string>();
  const toVisit: string[] = [baseUrl];
  const pagesVisited: string[] = [];
  
  const parsedBase = new URL(baseUrl);
  const baseDomain = parsedBase.hostname;
  
  while (toVisit.length > 0 && pagesVisited.length < maxPages) {
    const url = toVisit.shift()!;
    const normalizedUrl = normalizeUrl(url);
    
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);
    
    try {
      const items = await withPage(url, async (page, html) => {
        const extractedItems = await callback(page, html, url);
        
        // Extract links for further crawling using provided patterns or defaults
        const linkPatterns = options.linkPatterns || [
          /menu/i, /burgers?/i, /chicken/i, /sides?/i, /drinks?/i, /desserts?/i,
          /meals?/i, /pizzas?/i, /salads?/i, /breakfast/i, /lunch/i, /dinner/i,
          /products?/i, /collections?/i, /categories?/i, /shop/i
        ];
        
        const links = extractNavigationLinksWithPatterns(html, url, baseDomain, linkPatterns);
        for (const link of links) {
          const normalizedLink = normalizeUrl(link);
          if (!visited.has(normalizedLink) && !toVisit.includes(link)) {
            toVisit.push(link);
          }
        }
        
        return extractedItems;
      }, { timeout: options.timeout || 45000, scrollPage: true });
      
      allItems.push(...items);
      pagesVisited.push(url);
    } catch (error: any) {
      console.error(`[DeepScraper] Error visiting ${url}:`, error.message);
    }
  }
  
  return { items: allItems, pagesVisited };
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

export async function deepScrapeMultiplePages(
  baseUrl: string,
  maxPages: number = 5
): Promise<{ pages: DeepScrapeResult[]; navigationLinks: string[] }> {
  const pages: DeepScrapeResult[] = [];
  const visited = new Set<string>();
  const toVisit: string[] = [baseUrl];
  
  const parsedBase = new URL(baseUrl);
  const baseDomain = parsedBase.hostname;
  
  while (toVisit.length > 0 && pages.length < maxPages) {
    const url = toVisit.shift()!;
    const normalizedUrl = normalizeUrl(url);
    
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);
    
    const result = await deepScrapeUrl(url);
    if (result.html) {
      pages.push(result);
      
      const links = extractNavigationLinks(result.html, url, baseDomain);
      for (const link of links) {
        const normalizedLink = normalizeUrl(link);
        if (!visited.has(normalizedLink) && !toVisit.includes(link)) {
          toVisit.push(link);
        }
      }
    }
  }
  
  const allLinks = pages.flatMap(p => extractNavigationLinks(p.html, p.url, baseDomain));
  const uniqueLinks = Array.from(new Set(allLinks));
  
  return { pages, navigationLinks: uniqueLinks };
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
