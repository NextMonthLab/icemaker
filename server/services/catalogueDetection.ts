import { Page } from 'puppeteer';
import { withPage, deepScrapeMultiplePages, LINK_PATTERNS, MultiPageCrawlResult } from './deepScraper';
import OpenAI from 'openai';
import { 
  extractBusinessData, 
  extractionResultToBoxes,
  type BusinessDataExtractionResult 
} from './businessDataExtractor';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface DetectionSignals {
  structuredData: StructuredDataSignal[];
  platform: PlatformSignal[];
  urlPatterns: UrlPatternSignal[];
  domHeuristics: DomHeuristicSignal[];
}

export interface StructuredDataSignal {
  type: 'Product' | 'Offer' | 'ItemList' | 'Restaurant' | 'FoodEstablishment' | 'Menu' | 'MenuItem' | 'Organization' | 'LocalBusiness';
  count: number;
  confidence: number;
  source: 'json-ld' | 'microdata' | 'rdfa';
}

export interface PlatformSignal {
  platform: string;
  type: 'ecommerce' | 'food_ordering' | 'delivery' | 'cms';
  confidence: number;
  indicators: string[];
}

export interface UrlPatternSignal {
  pattern: string;
  type: 'catalogue' | 'menu' | 'service' | 'hybrid';
  confidence: number;
  url: string;
}

export interface DomHeuristicSignal {
  type: 'product_card' | 'menu_item' | 'price_grid' | 'category_nav';
  count: number;
  confidence: number;
  indicators: string[];
}

export interface DetectionScores {
  scoreCatalogue: number;
  scoreMenu: number;
  scoreService: number;
  confidence: number;
  primaryType: 'catalogue' | 'menu' | 'service' | 'hybrid' | 'none';
  signals: DetectionSignals;
}

export interface ExtractionPlan {
  type: 'catalogue' | 'menu' | 'service' | 'hybrid' | 'none';
  priority: 'catalogue_first' | 'menu_first' | 'service_first' | 'parallel';
  confidence: number;
  rationale: string;
  estimatedItems: number;
}

export interface ExtractedProduct {
  title: string;
  description: string | null;
  price: string | null;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  availability: 'available' | 'limited' | 'unavailable';
  variants: string[];
  sourceUrl: string | null;
  tags: { key: string; value: string }[];
}

export interface ExtractedMenuItem {
  name: string;
  description: string | null;
  price: string | null;
  currency: string;
  section: string;
  dietaryTags: string[];
  options: string[];
  sourceUrl: string | null;
}

export interface ExtractedServiceConcept {
  name: string;
  description: string | null;
  category: string;
  features: string[];
  imageUrl: string | null;
  sourceUrl: string | null;
}

const PLATFORM_FINGERPRINTS = {
  ecommerce: [
    { platform: 'Shopify', indicators: ['Shopify.shop', 'cdn.shopify.com', 'shopify-section', '/collections/', '/products/'] },
    { platform: 'WooCommerce', indicators: ['woocommerce', 'wc-block', 'add_to_cart', '/product-category/', '/product/'] },
    { platform: 'Magento', indicators: ['Magento', 'mage/', '/catalog/product/'] },
    { platform: 'Wix Stores', indicators: ['wix-stores', 'wixstores', '_api/wix-ecommerce'] },
    { platform: 'Squarespace Commerce', indicators: ['squarespace', 'sqsp', '/store/'] },
    { platform: 'BigCommerce', indicators: ['bigcommerce', '/cart.php'] },
    { platform: 'PrestaShop', indicators: ['prestashop', '/modules/'] },
  ],
  food_ordering: [
    { platform: 'Square Online', indicators: ['squareup.com', 'square-menu', 'weeblysite.com'] },
    { platform: 'GloriaFood', indicators: ['gloriafood', 'gloria.food'] },
    { platform: 'Toast', indicators: ['toasttab.com', 'toast-menu'] },
    { platform: 'Flipdish', indicators: ['flipdish', 'order.flipdish'] },
    { platform: 'ChowNow', indicators: ['chownow', 'direct.chownow'] },
    { platform: 'OpenTable', indicators: ['opentable.com', 'ot-widget'] },
  ],
  delivery: [
    { platform: 'Deliveroo', indicators: ['deliveroo.co', 'deliveroo.com'] },
    { platform: 'Just Eat', indicators: ['just-eat', 'justeat.co'] },
    { platform: 'Uber Eats', indicators: ['ubereats.com', 'uber.com/eats'] },
    { platform: 'DoorDash', indicators: ['doordash.com'] },
  ],
  cms: [
    { platform: 'WordPress', indicators: ['wp-content', 'wp-includes', 'wordpress'] },
    { platform: 'Elementor', indicators: ['elementor', 'elementor-widget'] },
    { platform: 'Webflow', indicators: ['webflow.io', 'wf-section'] },
    { platform: 'Wix', indicators: ['wix.com', 'wixsite.com', 'wix-code'] },
  ],
};

const CATALOGUE_URL_PATTERNS = [
  { pattern: '/shop', weight: 0.8 },
  { pattern: '/products', weight: 0.9 },
  { pattern: '/collections', weight: 0.85 },
  { pattern: '/category', weight: 0.7 },
  { pattern: '/store', weight: 0.75 },
  { pattern: '/catalog', weight: 0.8 },
  { pattern: '/buy', weight: 0.6 },
];

const MENU_URL_PATTERNS = [
  { pattern: '/menu', weight: 0.95 },
  { pattern: '/food', weight: 0.8 },
  { pattern: '/drinks', weight: 0.8 },
  { pattern: '/takeaway', weight: 0.85 },
  { pattern: '/order', weight: 0.7 },
  { pattern: '/our-menu', weight: 0.95 },
  { pattern: '/food-menu', weight: 0.95 },
];

const SERVICE_URL_PATTERNS = [
  { pattern: '/food-concepts', weight: 0.95 },
  { pattern: '/food-solutions', weight: 0.95 },
  { pattern: '/contract-catering', weight: 0.95 },
  { pattern: '/sectors', weight: 0.8 },
  { pattern: '/workplace-dining', weight: 0.9 },
  { pattern: '/hospitality-solutions', weight: 0.9 },
  { pattern: '/catering-services', weight: 0.85 },
];

export async function detectSiteType(url: string): Promise<DetectionScores> {
  return withPage(url, async (page, html) => {
    const pageUrl = page.url();

    const signals: DetectionSignals = {
      structuredData: await detectStructuredData(page),
      platform: detectPlatformFingerprints(html, pageUrl),
      urlPatterns: await detectUrlPatterns(page, pageUrl),
      domHeuristics: await detectDomHeuristics(page),
    };

    return calculateScores(signals);
  }, { timeout: 30000 });
}

async function detectStructuredData(page: Page): Promise<StructuredDataSignal[]> {
  const signals: StructuredDataSignal[] = [];

  const jsonLdData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const results: any[] = [];
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
      } catch {}
    });
    return results;
  });

  const typeCounts: Record<string, number> = {};
  
  const processItem = (item: any) => {
    if (!item) return;
    const type = item['@type'];
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      types.forEach((t: string) => {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
    }
    if (item.itemListElement) {
      item.itemListElement.forEach(processItem);
    }
    if (item.hasMenu) {
      processItem(item.hasMenu);
    }
    if (item.hasMenuSection) {
      (Array.isArray(item.hasMenuSection) ? item.hasMenuSection : [item.hasMenuSection]).forEach(processItem);
    }
    if (item.hasMenuItem) {
      (Array.isArray(item.hasMenuItem) ? item.hasMenuItem : [item.hasMenuItem]).forEach(processItem);
    }
  };

  jsonLdData.forEach(processItem);

  const relevantTypes: StructuredDataSignal['type'][] = ['Product', 'Offer', 'ItemList', 'Restaurant', 'FoodEstablishment', 'Menu', 'MenuItem', 'Organization', 'LocalBusiness'];
  
  for (const type of relevantTypes) {
    if (typeCounts[type] > 0) {
      signals.push({
        type,
        count: typeCounts[type],
        confidence: Math.min(0.9, 0.5 + (typeCounts[type] * 0.1)),
        source: 'json-ld',
      });
    }
  }

  return signals;
}

function detectPlatformFingerprints(html: string, url: string): PlatformSignal[] {
  const signals: PlatformSignal[] = [];
  const htmlLower = html.toLowerCase();
  const urlLower = url.toLowerCase();

  for (const [category, platforms] of Object.entries(PLATFORM_FINGERPRINTS)) {
    for (const { platform, indicators } of platforms) {
      const matchedIndicators = indicators.filter(indicator => 
        htmlLower.includes(indicator.toLowerCase()) || urlLower.includes(indicator.toLowerCase())
      );

      if (matchedIndicators.length > 0) {
        signals.push({
          platform,
          type: category as 'ecommerce' | 'food_ordering' | 'delivery',
          confidence: Math.min(0.95, 0.4 + (matchedIndicators.length * 0.2)),
          indicators: matchedIndicators,
        });
      }
    }
  }

  return signals;
}

async function detectUrlPatterns(page: Page, baseUrl: string): Promise<UrlPatternSignal[]> {
  const signals: UrlPatternSignal[] = [];
  const urlLower = baseUrl.toLowerCase();

  for (const { pattern, weight } of CATALOGUE_URL_PATTERNS) {
    if (urlLower.includes(pattern)) {
      signals.push({
        pattern,
        type: 'catalogue',
        confidence: weight,
        url: baseUrl,
      });
    }
  }

  for (const { pattern, weight } of MENU_URL_PATTERNS) {
    if (urlLower.includes(pattern)) {
      signals.push({
        pattern,
        type: 'menu',
        confidence: weight,
        url: baseUrl,
      });
    }
  }

  for (const { pattern, weight } of SERVICE_URL_PATTERNS) {
    if (urlLower.includes(pattern)) {
      signals.push({
        pattern,
        type: 'service',
        confidence: weight,
        url: baseUrl,
      });
    }
  }

  const internalLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.map(a => a.getAttribute('href') || '').filter(href => 
      href.startsWith('/') || href.includes(window.location.hostname)
    ).slice(0, 50);
  });

  for (const link of internalLinks) {
    const linkLower = link.toLowerCase();
    
    for (const { pattern, weight } of CATALOGUE_URL_PATTERNS) {
      if (linkLower.includes(pattern) && !signals.some(s => s.pattern === pattern && s.type === 'catalogue')) {
        signals.push({
          pattern,
          type: 'catalogue',
          confidence: weight * 0.8,
          url: link,
        });
      }
    }

    for (const { pattern, weight } of MENU_URL_PATTERNS) {
      if (linkLower.includes(pattern) && !signals.some(s => s.pattern === pattern && s.type === 'menu')) {
        signals.push({
          pattern,
          type: 'menu',
          confidence: weight * 0.8,
          url: link,
        });
      }
    }

    for (const { pattern, weight } of SERVICE_URL_PATTERNS) {
      if (linkLower.includes(pattern) && !signals.some(s => s.pattern === pattern && s.type === 'service')) {
        signals.push({
          pattern,
          type: 'service',
          confidence: weight * 0.8,
          url: link,
        });
      }
    }
  }

  return signals;
}

async function detectDomHeuristics(page: Page): Promise<DomHeuristicSignal[]> {
  const signals: DomHeuristicSignal[] = [];

  const domAnalysis = await page.evaluate(() => {
    const results = {
      productCards: { count: 0, indicators: [] as string[] },
      menuItems: { count: 0, indicators: [] as string[] },
      priceElements: { count: 0, indicators: [] as string[] },
      categoryNav: { count: 0, indicators: [] as string[] },
    };

    const priceRegex = /[£$€]\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*[£$€]/;
    const addToCartTexts = ['add to cart', 'add to bag', 'buy now', 'add to basket', 'shop now'];
    const menuSectionTexts = ['starters', 'mains', 'desserts', 'drinks', 'sides', 'appetizers', 'entrees', 'beverages'];
    const dietaryMarkers = ['(v)', '(vg)', '(ve)', '(gf)', 'vegetarian', 'vegan', 'gluten-free', 'gluten free'];

    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const text = (el.textContent || '').toLowerCase();
      const className = (el.className || '').toString().toLowerCase();
      
      if (className.includes('product') || className.includes('item-card') || className.includes('shop-item')) {
        if (priceRegex.test(el.textContent || '')) {
          results.productCards.count++;
          results.productCards.indicators.push('product-class-with-price');
        }
      }

      addToCartTexts.forEach(cartText => {
        if (text.includes(cartText)) {
          results.productCards.count++;
          results.productCards.indicators.push(`cart-text: ${cartText}`);
        }
      });

      menuSectionTexts.forEach(section => {
        if (text.includes(section) && el.tagName.match(/^H[1-6]$/)) {
          results.menuItems.count++;
          results.menuItems.indicators.push(`menu-section: ${section}`);
        }
      });

      dietaryMarkers.forEach(marker => {
        if (text.includes(marker)) {
          results.menuItems.count++;
          results.menuItems.indicators.push(`dietary: ${marker}`);
        }
      });
    });

    const priceMatches = document.body.innerHTML.match(/[£$€]\s*\d+(?:[.,]\d{2})?/g);
    results.priceElements.count = priceMatches?.length || 0;

    return results;
  });

  if (domAnalysis.productCards.count > 0) {
    signals.push({
      type: 'product_card',
      count: domAnalysis.productCards.count,
      confidence: Math.min(0.85, 0.3 + (domAnalysis.productCards.count * 0.05)),
      indicators: domAnalysis.productCards.indicators.slice(0, 5),
    });
  }

  if (domAnalysis.menuItems.count > 0) {
    signals.push({
      type: 'menu_item',
      count: domAnalysis.menuItems.count,
      confidence: Math.min(0.85, 0.3 + (domAnalysis.menuItems.count * 0.05)),
      indicators: domAnalysis.menuItems.indicators.slice(0, 5),
    });
  }

  if (domAnalysis.priceElements.count > 5) {
    signals.push({
      type: 'price_grid',
      count: domAnalysis.priceElements.count,
      confidence: Math.min(0.7, 0.2 + (domAnalysis.priceElements.count * 0.02)),
      indicators: [`${domAnalysis.priceElements.count} price elements found`],
    });
  }

  return signals;
}

function calculateScores(signals: DetectionSignals): DetectionScores {
  let rawCatalogue = 0;
  let rawMenu = 0;
  let rawService = 0;

  // Accumulate raw scores from all signals
  for (const signal of signals.structuredData) {
    if (['Product', 'Offer', 'ItemList'].includes(signal.type)) {
      rawCatalogue += signal.confidence * (signal.count > 5 ? 1.5 : 1);
    }
    if (['Restaurant', 'FoodEstablishment', 'Menu', 'MenuItem'].includes(signal.type)) {
      rawMenu += signal.confidence * (signal.count > 5 ? 1.5 : 1);
    }
    if (['Organization', 'LocalBusiness'].includes(signal.type)) {
      rawService += signal.confidence * 0.5;
    }
  }

  for (const signal of signals.platform) {
    if (signal.type === 'ecommerce') {
      rawCatalogue += signal.confidence * 1.2;
    }
    if (signal.type === 'food_ordering') {
      rawMenu += signal.confidence * 1.2;
    }
    if (signal.type === 'delivery') {
      rawMenu += signal.confidence * 0.5;
    }
    if (signal.type === 'cms') {
      rawService += signal.confidence * 0.3;
    }
  }

  for (const signal of signals.urlPatterns) {
    if (signal.type === 'catalogue') {
      rawCatalogue += signal.confidence * 0.8;
    }
    if (signal.type === 'menu') {
      rawMenu += signal.confidence * 0.8;
    }
    if (signal.type === 'service') {
      rawService += signal.confidence * 1.0;
    }
  }

  for (const signal of signals.domHeuristics) {
    if (signal.type === 'product_card') {
      rawCatalogue += signal.confidence * 0.7;
    }
    if (signal.type === 'menu_item') {
      rawMenu += signal.confidence * 0.7;
    }
    if (signal.type === 'price_grid') {
      const boost = 0.3;
      rawCatalogue += boost;
      rawMenu += boost;
    }
  }

  // Use sigmoid-like clamping for confidence (higher raw scores = higher confidence)
  // Raw score of 3.0 = ~0.9 confidence, 1.0 = ~0.5 confidence
  const clampToConfidence = (raw: number) => Math.min(0.99, raw / (raw + 2.0));
  
  const scoreCatalogue = clampToConfidence(rawCatalogue);
  const scoreMenu = clampToConfidence(rawMenu);
  const scoreService = clampToConfidence(rawService);

  // Determine primary type based on normalized comparison
  // Priority: catalogue/menu/hybrid ALWAYS take precedence over service
  // Service is used when there's low/no menu/catalogue evidence AND CMS signals
  let primaryType: 'catalogue' | 'menu' | 'service' | 'hybrid' | 'none';
  const threshold = 0.3;
  const hybridThreshold = 0.6;
  const serviceThreshold = 0.2;

  // Check if CMS platform detected (suggests B2B/corporate site)
  const hasCmsPlatform = signals.platform.some(p => p.type === 'cms');

  if (scoreCatalogue > hybridThreshold && scoreMenu > hybridThreshold) {
    primaryType = 'hybrid';
  } else if (scoreCatalogue > threshold && rawCatalogue > rawMenu * 1.3) {
    primaryType = 'catalogue';
  } else if (scoreMenu > threshold && rawMenu > rawCatalogue * 1.3) {
    primaryType = 'menu';
  } else if (scoreCatalogue > threshold || scoreMenu > threshold) {
    primaryType = rawCatalogue > rawMenu ? 'catalogue' : 'menu';
  } else if (scoreService > serviceThreshold && 
             scoreCatalogue < 0.2 && 
             scoreMenu < 0.2) {
    // Service when: service signals AND low menu/catalogue evidence
    primaryType = 'service';
  } else if (hasCmsPlatform && scoreCatalogue < 0.15 && scoreMenu < 0.15) {
    // CMS platform with no menu/catalogue evidence - likely B2B service site
    primaryType = 'service';
  } else {
    primaryType = 'none';
  }

  // Confidence is the max score, reflecting how certain we are about the classification
  const confidence = Math.max(scoreCatalogue, scoreMenu, scoreService);

  return {
    scoreCatalogue,
    scoreMenu,
    scoreService,
    confidence,
    primaryType,
    signals,
  };
}

export function deriveExtractionPlan(scores: DetectionScores): ExtractionPlan {
  const { primaryType, scoreCatalogue, scoreMenu, scoreService, confidence, signals } = scores;

  let estimatedItems = 0;
  
  for (const signal of signals.structuredData) {
    if (['Product', 'MenuItem'].includes(signal.type)) {
      estimatedItems += signal.count;
    }
  }
  
  for (const signal of signals.domHeuristics) {
    if (['product_card', 'menu_item'].includes(signal.type)) {
      estimatedItems = Math.max(estimatedItems, signal.count);
    }
  }

  let rationale = '';
  const signalSummary: string[] = [];
  
  if (signals.structuredData.length > 0) {
    signalSummary.push(`Structured data: ${signals.structuredData.map(s => `${s.type}(${s.count})`).join(', ')}`);
  }
  if (signals.platform.length > 0) {
    signalSummary.push(`Platforms: ${signals.platform.map(s => s.platform).join(', ')}`);
  }
  if (signals.urlPatterns.length > 0) {
    signalSummary.push(`URL patterns: ${signals.urlPatterns.map(s => s.pattern).join(', ')}`);
  }

  rationale = signalSummary.join('; ') || 'No strong signals detected';

  let priority: 'catalogue_first' | 'menu_first' | 'service_first' | 'parallel';
  if (primaryType === 'hybrid') {
    priority = scoreCatalogue > scoreMenu ? 'catalogue_first' : 'menu_first';
  } else if (primaryType === 'service') {
    priority = 'service_first';
  } else {
    priority = 'parallel';
  }

  if (primaryType === 'service') {
    estimatedItems = Math.max(estimatedItems, 5);
    rationale += '; B2B/service site detected - will extract concepts/solutions';
  }

  return {
    type: primaryType,
    priority,
    confidence,
    rationale,
    estimatedItems: Math.max(estimatedItems, primaryType === 'service' ? 5 : 10),
  };
}

export async function extractCatalogueItems(url: string): Promise<ExtractedProduct[]> {
  return withPage(url, async (page, html) => {
    const products = await page.evaluate(() => {
      const items: any[] = [];
      
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          const processItem = (item: any) => {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer') {
              items.push({
                title: item.name || 'Unknown Product',
                description: item.description || null,
                price: item.offers?.price || item.price || null,
                currency: item.offers?.priceCurrency || item.priceCurrency || 'GBP',
                imageUrl: item.image || item.offers?.image || null,
                category: item.category || null,
                availability: item.offers?.availability?.includes('InStock') ? 'available' : 'unavailable',
              });
            }
            if (item.itemListElement) {
              item.itemListElement.forEach((el: any) => processItem(el.item || el));
            }
          };
          if (Array.isArray(data)) {
            data.forEach(processItem);
          } else {
            processItem(data);
          }
        } catch {}
      });

      return items;
    });

    return products.map(p => ({
      title: p.title,
      description: p.description,
      price: p.price ? String(p.price) : null,
      currency: p.currency || 'GBP',
      category: p.category,
      imageUrl: Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl,
      availability: p.availability || 'available',
      variants: [],
      sourceUrl: url,
      tags: [],
    }));
  }, { timeout: 30000 });
}

export async function extractMenuItems(url: string): Promise<ExtractedMenuItem[]> {
  return withPage(url, async (page, html) => {
    const menuItems = await page.evaluate(() => {
      const items: any[] = [];
      
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent || '');
          const processMenu = (item: any, section = 'Menu') => {
            if (item['@type'] === 'MenuItem') {
              items.push({
                name: item.name || 'Unknown Item',
                description: item.description || null,
                price: item.offers?.price || item.price || null,
                currency: item.offers?.priceCurrency || 'GBP',
                section,
                dietaryTags: item.suitableForDiet?.map((d: string) => d.replace('https://schema.org/', '')) || [],
              });
            }
            if (item['@type'] === 'MenuSection') {
              const sectionName = item.name || section;
              if (item.hasMenuItem) {
                const menuItems = Array.isArray(item.hasMenuItem) ? item.hasMenuItem : [item.hasMenuItem];
                menuItems.forEach((mi: any) => processMenu(mi, sectionName));
              }
            }
            if (item['@type'] === 'Menu') {
              if (item.hasMenuSection) {
                const sections = Array.isArray(item.hasMenuSection) ? item.hasMenuSection : [item.hasMenuSection];
                sections.forEach((s: any) => processMenu(s, 'Menu'));
              }
            }
            if (item.hasMenu) {
              processMenu(item.hasMenu, 'Menu');
            }
          };
          if (Array.isArray(data)) {
            data.forEach((d: any) => processMenu(d));
          } else {
            processMenu(data);
          }
        } catch {}
      });

      return items;
    });

    return menuItems.map(m => ({
      name: m.name,
      description: m.description,
      price: m.price ? String(m.price) : null,
      currency: m.currency || 'GBP',
      section: m.section || 'Menu',
      dietaryTags: m.dietaryTags || [],
      options: [],
      sourceUrl: url,
    }));
  }, { timeout: 30000 });
}

// Multi-page menu extraction - follows category links to get actual items
export interface MultiPageMenuItem {
  name: string;
  description: string | null;
  price: string | null;
  currency: string;
  category: string;
  imageUrl: string | null;
  sourceUrl: string;
}

/**
 * Multi-page menu extraction using the CANONICAL CRAWLER pattern:
 * 1. Candidate selection (menu link patterns)
 * 2. deepScrapeMultiplePages (crawl)
 * 3. Parse results into menu items
 */
export async function extractMenuItemsMultiPage(baseUrl: string, maxPages: number = 10): Promise<MultiPageMenuItem[]> {
  console.log(`[MultiPage] Starting extraction for: ${baseUrl}`);
  
  // STEP 1: Crawl using the canonical crawler with menu link patterns
  const crawlResult = await deepScrapeMultiplePages(baseUrl, {
    maxPages,
    linkPatterns: LINK_PATTERNS.menu,
    timeout: 45000,
    sameDomainOnly: true,
    rateLimitMs: 300,
    stopAfterEmptyPages: 3
  });
  
  console.log(`[MultiPage] Crawled ${crawlResult.pages.length} pages (${crawlResult.stoppedReason})`);
  
  // STEP 2: Parse each page's results
  const allItems: MultiPageMenuItem[] = [];
  
  for (const pageResult of crawlResult.pages) {
    // Derive category from URL path
    const categoryName = deriveCategoryFromUrl(pageResult.url);
    
    // STEP 2a: Try schema blocks first (most reliable, no DOM needed)
    if (pageResult.schemaBlocks && pageResult.schemaBlocks.length > 0) {
      const schemaItems = parseSchemaBlocksForMenuItems(pageResult.schemaBlocks, categoryName, pageResult.url);
      if (schemaItems.length > 0) {
        allItems.push(...schemaItems);
        continue; // Schema blocks succeeded, skip DOM parsing
      }
    }
    
    // STEP 2b: Fall back to DOM parsing (requires re-fetch, but rare)
    try {
      const domItems = await extractItemsFromPage_withPage(pageResult.url, categoryName);
      allItems.push(...domItems);
    } catch (err) {
      console.log(`[MultiPage] DOM parse failed for ${pageResult.url}: ${(err as Error).message}`);
    }
  }
  
  console.log(`[MultiPage] Visited ${crawlResult.pagesVisited.length} pages, extracted ${allItems.length} items`);
  return allItems;
}

// Helper: derive category name from URL path
function deriveCategoryFromUrl(url: string): string {
  try {
    const urlPath = new URL(url).pathname;
    const pathParts = urlPath.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1]
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
    }
  } catch {}
  return 'Menu';
}

// Pure function: parse JSON-LD schema blocks into menu items (no DOM needed)
function parseSchemaBlocksForMenuItems(schemaBlocks: any[], category: string, sourceUrl: string): MultiPageMenuItem[] {
  const results: MultiPageMenuItem[] = [];
  
  const processItem = (item: any, section: string) => {
    if (item['@type'] === 'MenuItem' || item['@type'] === 'Product') {
      let imageUrl = item.image;
      if (Array.isArray(imageUrl)) imageUrl = imageUrl[0];
      if (typeof imageUrl === 'object' && imageUrl?.url) imageUrl = imageUrl.url;
      
      results.push({
        name: item.name || 'Unknown',
        description: item.description || null,
        price: item.offers?.price || item.price || null,
        currency: item.offers?.priceCurrency || item.priceCurrency || 'GBP',
        category: section,
        imageUrl: imageUrl || null,
        sourceUrl
      });
    }
    if (item.hasMenuItem) {
      (Array.isArray(item.hasMenuItem) ? item.hasMenuItem : [item.hasMenuItem])
        .forEach((mi: any) => processItem(mi, item.name || section));
    }
    if (item.hasMenuSection) {
      (Array.isArray(item.hasMenuSection) ? item.hasMenuSection : [item.hasMenuSection])
        .forEach((ms: any) => processItem(ms, ms.name || section));
    }
    if (item.itemListElement) {
      item.itemListElement.forEach((el: any) => processItem(el.item || el, section));
    }
  };
  
  for (const block of schemaBlocks) {
    try {
      if (Array.isArray(block)) {
        block.forEach(d => processItem(d, category));
      } else {
        processItem(block, category);
      }
    } catch {}
  }
  
  return results;
}

// DOM extraction fallback (requires browser page)
async function extractItemsFromPage_withPage(url: string, categoryName: string): Promise<MultiPageMenuItem[]> {
  return withPage(url, async (page, html) => {
    return extractItemsFromPage(page, categoryName);
  }, { timeout: 30000 });
}

async function extractItemsFromPage(page: Page, categoryName: string): Promise<MultiPageMenuItem[]> {
  const pageUrl = page.url();
  
  // Scroll to trigger lazy loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const items = await page.evaluate((category) => {
    const results: any[] = [];
    
    // Try structured data first
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        const processItem = (item: any, section: string) => {
          if (item['@type'] === 'MenuItem' || item['@type'] === 'Product') {
            let imageUrl = item.image;
            if (Array.isArray(imageUrl)) imageUrl = imageUrl[0];
            if (typeof imageUrl === 'object' && imageUrl?.url) imageUrl = imageUrl.url;
            
            results.push({
              name: item.name || 'Unknown',
              description: item.description || null,
              price: item.offers?.price || item.price || null,
              currency: item.offers?.priceCurrency || item.priceCurrency || 'GBP',
              category: section,
              imageUrl: imageUrl || null,
            });
          }
          if (item.hasMenuItem) {
            (Array.isArray(item.hasMenuItem) ? item.hasMenuItem : [item.hasMenuItem])
              .forEach((mi: any) => processItem(mi, item.name || section));
          }
          if (item.hasMenuSection) {
            (Array.isArray(item.hasMenuSection) ? item.hasMenuSection : [item.hasMenuSection])
              .forEach((ms: any) => processItem(ms, ms.name || section));
          }
          if (item.itemListElement) {
            item.itemListElement.forEach((el: any) => processItem(el.item || el, section));
          }
        };
        if (Array.isArray(data)) {
          data.forEach(d => processItem(d, category));
        } else {
          processItem(data, category);
        }
      } catch {}
    });

    // If no structured data, try DOM extraction with structural heuristics
    if (results.length === 0) {
      const processedNames = new Set<string>();
      const priceRegex = /[£$€]\s*(\d+(?:\.\d{2})?)/;
      
      // Strategy 1: Look for microdata/schema.org attributes
      const microdataItems = document.querySelectorAll('[itemprop="name"], [itemtype*="Product"], [itemtype*="MenuItem"]');
      microdataItems.forEach(el => {
        const name = el.textContent?.trim();
        if (!name || name.length < 2 || name.length > 80) return;
        if (processedNames.has(name.toLowerCase())) return;
        
        // Find nearby price and image
        const parent = el.closest('[itemscope]') || el.parentElement?.parentElement;
        const priceEl = parent?.querySelector('[itemprop="price"]');
        const price = priceEl?.textContent?.match(priceRegex)?.[1] || null;
        const img = parent?.querySelector('img');
        let imageUrl = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
        if (imageUrl && !imageUrl.startsWith('http')) {
          try { imageUrl = new URL(imageUrl, window.location.origin).href; } catch {}
        }
        
        processedNames.add(name.toLowerCase());
        results.push({ name, description: null, price, currency: 'GBP', category, imageUrl });
      });
      
      // Strategy 2: Find repeating sibling structures (product grids/lists)
      if (results.length === 0) {
        // Look for containers with multiple similar children (grid patterns)
        const containers = Array.from(document.querySelectorAll('ul, ol, [role="list"], main, section, article'));
        
        for (let ci = 0; ci < containers.length; ci++) {
          const container = containers[ci];
          const children = Array.from(container.children) as Element[];
          if (children.length < 3) continue;
          
          // Check if children have similar structure (likely a product grid)
          const childSignatures = children.slice(0, 5).map((child: Element) => {
            const hasImg = child.querySelector('img') !== null;
            const hasPrice = priceRegex.test(child.textContent || '');
            const hasHeading = child.querySelector('h1, h2, h3, h4, h5, h6') !== null;
            return `${hasImg}-${hasPrice}-${hasHeading}`;
          });
          
          // If most children have the same pattern, it's likely a product grid
          const mostCommon = childSignatures.sort((a, b) => 
            childSignatures.filter(s => s === b).length - childSignatures.filter(s => s === a).length
          )[0];
          const matchCount = childSignatures.filter(s => s === mostCommon).length;
          
          if (matchCount >= 3 && mostCommon.includes('true')) {
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              // Extract name from heading or first strong text
              const heading = child.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
              const name = heading?.textContent?.trim();
              if (!name || name.length < 2 || name.length > 80) continue;
              if (processedNames.has(name.toLowerCase())) continue;
              if (/^(add|buy|order|view|see)/i.test(name)) continue; // Skip CTAs
              
              // Extract price
              const priceMatch = child.textContent?.match(priceRegex);
              const price = priceMatch ? priceMatch[1] : null;
              
              // Extract image
              const img = child.querySelector('img') as HTMLImageElement | null;
              let imageUrl = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
              if (imageUrl && !imageUrl.startsWith('http')) {
                try { imageUrl = new URL(imageUrl, window.location.origin).href; } catch {}
              }
              // Skip tiny images (icons)
              if (img && (img.width < 50 || img.height < 50)) imageUrl = null;
              
              // Extract description
              const desc = child.querySelector('p')?.textContent?.trim() || null;
              
              processedNames.add(name.toLowerCase());
              results.push({ name, description: desc, price, currency: 'GBP', category, imageUrl });
            }
            
            if (results.length > 0) break;
          }
        }
      }
      
      // Strategy 3: Find images with adjacent text (card patterns)
      if (results.length === 0) {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (!src || src.includes('icon') || src.includes('logo') || src.includes('avatar')) return;
          if (img.width > 0 && img.width < 80) return; // Skip small images
          
          // Find the card container (walk up max 4 levels)
          let card: Element | null = img.parentElement;
          for (let i = 0; i < 4 && card; i++) {
            const text = card.textContent || '';
            if (text.length > 10 && text.length < 500) {
              // Check for price indicator (strong signal for product)
              if (priceRegex.test(text)) {
                const heading = card.querySelector('h1, h2, h3, h4, h5, h6, strong, b, [role="heading"]');
                const name = heading?.textContent?.trim();
                if (name && name.length > 2 && name.length < 80 && !processedNames.has(name.toLowerCase())) {
                  if (/^(add|buy|order|view|menu|sign|login)/i.test(name)) return;
                  
                  const priceMatch = text.match(priceRegex);
                  let imageUrl = src;
                  if (!imageUrl.startsWith('http')) {
                    try { imageUrl = new URL(imageUrl, window.location.origin).href; } catch {}
                  }
                  
                  processedNames.add(name.toLowerCase());
                  results.push({
                    name,
                    description: null,
                    price: priceMatch ? priceMatch[1] : null,
                    currency: 'GBP',
                    category,
                    imageUrl
                  });
                }
                break;
              }
            }
            card = card.parentElement;
          }
        });
      }
    }

    return results;
  }, categoryName);

  return items.map(item => ({
    ...item,
    sourceUrl: pageUrl,
  }));
}

// Extraction quality validation
export interface ExtractionQuality {
  score: number; // 0-100
  passed: boolean;
  issues: string[];
  recommendations: string[];
}

export function validateExtractionQuality(items: MultiPageMenuItem[], expectedMinItems: number = 3): ExtractionQuality {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  // Check item count
  if (items.length === 0) {
    issues.push('No items extracted');
    score -= 50;
    recommendations.push('Try AI-assisted extraction');
  } else if (items.length < expectedMinItems) {
    issues.push(`Only ${items.length} items extracted (expected at least ${expectedMinItems})`);
    score -= 20;
    recommendations.push('Consider following more category links');
  }
  
  // Check for prices
  const itemsWithPrices = items.filter(i => i.price && parseFloat(i.price) > 0);
  const priceRatio = items.length > 0 ? itemsWithPrices.length / items.length : 0;
  if (priceRatio < 0.3) {
    issues.push(`Low price extraction rate: ${Math.round(priceRatio * 100)}%`);
    score -= 15;
  }
  
  // Check for images
  const itemsWithImages = items.filter(i => i.imageUrl && !isPaymentOrBadImage(i.imageUrl));
  const imageRatio = items.length > 0 ? itemsWithImages.length / items.length : 0;
  if (imageRatio < 0.2) {
    issues.push(`Low image extraction rate: ${Math.round(imageRatio * 100)}%`);
    score -= 15;
  }
  
  // Check for duplicate names
  const names = items.map(i => i.name.toLowerCase());
  const uniqueNames = new Set(names);
  if (names.length > 0 && uniqueNames.size < names.length * 0.8) {
    issues.push('High duplicate rate in item names');
    score -= 10;
  }
  
  // Check for suspicious patterns (e.g., navigation text extracted as items)
  const suspiciousPatterns = ['home', 'about', 'contact', 'menu', 'order', 'sign in', 'login', 'cart'];
  const suspiciousItems = items.filter(i => 
    suspiciousPatterns.some(p => i.name.toLowerCase() === p)
  );
  if (suspiciousItems.length > 0) {
    issues.push(`Found ${suspiciousItems.length} suspicious navigation items`);
    score -= 10;
  }
  
  return {
    score: Math.max(0, score),
    passed: score >= 50,
    issues,
    recommendations,
  };
}

// Helper to detect payment/bad images (delegates to shared mediaFilter)
function isPaymentOrBadImage(url: string): boolean {
  const { isBadImageUrl } = require('../utils/mediaFilter');
  return isBadImageUrl(url);
}

// Site fingerprinting for strategy selection
export interface SiteFingerprint {
  platform: string;
  type: 'ecommerce' | 'restaurant' | 'legacy_php' | 'spa' | 'static' | 'unknown';
  strategies: ('structured_data' | 'multi_page' | 'single_page' | 'api_intercept' | 'ai_fallback')[];
  confidence: number;
}

export function detectSiteFingerprint(url: string, html: string): SiteFingerprint {
  const urlLower = url.toLowerCase();
  const htmlLower = html.toLowerCase();
  
  // Check for known platforms
  const platformChecks = [
    { platform: 'Shopify', pattern: /shopify|cdn\.shopify|shop\.app/i, type: 'ecommerce' as const },
    { platform: 'WooCommerce', pattern: /woocommerce|wc-block|add_to_cart/i, type: 'ecommerce' as const },
    { platform: 'Toast', pattern: /toasttab\.com|toast-menu/i, type: 'restaurant' as const },
    { platform: 'Square', pattern: /squareup\.com|square-menu/i, type: 'restaurant' as const },
    { platform: 'GloriaFood', pattern: /gloriafood|gloria\.food/i, type: 'restaurant' as const },
    { platform: 'Wix', pattern: /wix\.com|wixsite|wixstatic/i, type: 'spa' as const },
    { platform: 'Squarespace', pattern: /squarespace|sqsp/i, type: 'spa' as const },
    { platform: 'WordPress', pattern: /wp-content|wordpress/i, type: 'static' as const },
    { platform: 'zen-cart', pattern: /zen-cart|main_page=index|cPath=/i, type: 'legacy_php' as const },
    { platform: 'osCommerce', pattern: /oscommerce|products_id=/i, type: 'legacy_php' as const },
  ];
  
  for (const check of platformChecks) {
    if (check.pattern.test(html) || check.pattern.test(url)) {
      return {
        platform: check.platform,
        type: check.type,
        strategies: getStrategiesForType(check.type),
        confidence: 0.8,
      };
    }
  }
  
  // Check for JS-heavy SPA indicators
  if (htmlLower.includes('react') || htmlLower.includes('angular') || htmlLower.includes('vue')) {
    return {
      platform: 'SPA',
      type: 'spa',
      strategies: ['api_intercept', 'multi_page', 'ai_fallback'],
      confidence: 0.6,
    };
  }
  
  // Check for legacy PHP patterns
  if (urlLower.includes('.php') || urlLower.includes('?id=') || urlLower.includes('&cat=')) {
    return {
      platform: 'Legacy PHP',
      type: 'legacy_php',
      strategies: ['multi_page', 'single_page', 'ai_fallback'],
      confidence: 0.5,
    };
  }
  
  // Default: unknown, try everything
  return {
    platform: 'Unknown',
    type: 'unknown',
    strategies: ['structured_data', 'multi_page', 'single_page', 'ai_fallback'],
    confidence: 0.3,
  };
}

function getStrategiesForType(type: SiteFingerprint['type']): SiteFingerprint['strategies'] {
  switch (type) {
    case 'ecommerce':
      return ['structured_data', 'multi_page', 'ai_fallback'];
    case 'restaurant':
      return ['structured_data', 'multi_page', 'single_page', 'ai_fallback'];
    case 'legacy_php':
      return ['multi_page', 'single_page', 'ai_fallback'];
    case 'spa':
      return ['api_intercept', 'multi_page', 'ai_fallback'];
    case 'static':
      return ['structured_data', 'single_page', 'ai_fallback'];
    default:
      return ['structured_data', 'multi_page', 'single_page', 'ai_fallback'];
  }
}

// Fetch page and run fingerprinting (for logging purposes)
export async function fingerprintSite(url: string): Promise<SiteFingerprint> {
  return withPage(url, async (page, html) => {
    return detectSiteFingerprint(url, html);
  });
}

// AI-based extraction fallback using OpenAI
export async function extractMenuItemsWithAI(crawlResult: MultiPageCrawlResult): Promise<MultiPageMenuItem[]> {
  console.log(`[AI-Extract] Starting AI extraction for ${crawlResult.pages.length} pages`);
  
  const allItems: MultiPageMenuItem[] = [];
  
  for (const pageResult of crawlResult.pages) {
    // Use text if available, otherwise fall back to html
    const pageContent = pageResult.text || pageResult.html;
    if (!pageContent || pageContent.length < 100) continue;
    
    const categoryName = deriveCategoryFromUrl(pageResult.url);
    
    // Extract menu-relevant content by finding price patterns and surrounding text
    // This helps skip navigation/headers and focus on actual menu content
    let contentForAI = pageContent;
    
    // Try to find content with prices (menu items usually have prices)
    const pricePattern = /(?:£|\$|€)\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:£|\$|€)/g;
    const lines = pageContent.split('\n');
    const relevantLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Include lines with prices or nearby lines for context
      if (pricePattern.test(line) || 
          (i > 0 && pricePattern.test(lines[i-1] || '')) ||
          (i < lines.length - 1 && pricePattern.test(lines[i+1] || ''))) {
        // Include some context around price lines
        if (i > 0 && !relevantLines.includes(lines[i-1])) relevantLines.push(lines[i-1]);
        relevantLines.push(line);
        if (i < lines.length - 1) relevantLines.push(lines[i+1]);
      }
    }
    
    // If we found price-related content, use it; otherwise use larger portion
    if (relevantLines.length > 20) {
      contentForAI = relevantLines.slice(0, 500).join('\n');
    } else {
      // Use middle portion of page (skip navigation at start, footer at end)
      const startOffset = Math.floor(pageContent.length * 0.1);
      contentForAI = pageContent.slice(startOffset, startOffset + 25000);
    }
    
    // Final truncation to avoid token limits (25000 chars max)
    const truncatedContent = contentForAI.slice(0, 25000);
    
    try {
      // Debug: Log content sample to see what AI receives
      console.log(`[AI-Extract] Processing ${pageResult.url} (${truncatedContent.length} chars, ${relevantLines.length} price-related lines found)`);
      console.log(`[AI-Extract] Content sample: ${truncatedContent.substring(0, 500).replace(/\n/g, ' | ')}...`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a menu/catalogue extraction expert. Extract all menu items or products from the provided website content.
Return a JSON array of items. Each item should have:
- name: string (required)
- description: string or null
- price: string or null (e.g., "12.95", "£15.00")
- category: string (use the provided category or infer from content)

Only extract actual menu items, products, or services with names. Skip navigation, headers, footers, addresses, etc.
If no items found, return an empty array [].
Return ONLY valid JSON array, no markdown or explanation.`
          },
          {
            role: 'user',
            content: `Category: ${categoryName}\n\nWebsite content:\n${truncatedContent}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000, // Increased to allow extracting 50+ menu items
      });
      
      const content = response.choices[0]?.message?.content?.trim() || '[]';
      
      // Parse JSON response
      let items: any[] = [];
      try {
        // Handle markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
        items = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.log(`[AI-Extract] JSON parse failed for ${pageResult.url}: ${(parseErr as Error).message}`);
        continue;
      }
      
      if (!Array.isArray(items)) {
        console.log(`[AI-Extract] Expected array, got ${typeof items}`);
        continue;
      }
      
      // Convert to MultiPageMenuItem format
      for (const item of items) {
        if (!item.name || typeof item.name !== 'string') continue;
        
        // Detect currency from price string
        const priceStr = item.price ? String(item.price) : '';
        let currency = 'GBP'; // Default for UK sites
        if (priceStr.includes('$') || priceStr.toLowerCase().includes('usd')) {
          currency = 'USD';
        } else if (priceStr.includes('€') || priceStr.toLowerCase().includes('eur')) {
          currency = 'EUR';
        } else if (priceStr.includes('£') || priceStr.toLowerCase().includes('gbp')) {
          currency = 'GBP';
        }
        
        allItems.push({
          name: item.name,
          description: item.description || null,
          price: priceStr || null,
          currency,
          category: item.category || categoryName,
          imageUrl: null,
          sourceUrl: pageResult.url,
        });
      }
      
      console.log(`[AI-Extract] Extracted ${items.length} items from ${pageResult.url}`);
      
    } catch (err) {
      console.log(`[AI-Extract] Failed for ${pageResult.url}: ${(err as Error).message}`);
    }
  }
  
  console.log(`[AI-Extract] Total extracted: ${allItems.length} items`);
  return allItems;
}

export async function extractServiceConceptsWithAI(crawlResult: MultiPageCrawlResult): Promise<ExtractedServiceConcept[]> {
  console.log(`[Service-Extract] Starting AI extraction for ${crawlResult.pages.length} pages`);
  
  const allConcepts: ExtractedServiceConcept[] = [];
  
  for (const pageResult of crawlResult.pages) {
    const pageContent = pageResult.text || pageResult.html;
    if (!pageContent || pageContent.length < 100) continue;
    
    const categoryName = deriveCategoryFromUrl(pageResult.url);
    
    // For B2B sites, focus on finding service/concept descriptions
    // Look for headings, feature lists, and descriptive content
    const truncatedContent = pageContent.slice(0, 25000);
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting B2B food service concepts and solutions from company websites.
            
Extract all food concepts, service offerings, or solutions from the text. This might include:
- Food concepts (e.g., "Street Food", "Fine Dining", "Comfort Classics")
- Service categories (e.g., "Catering", "Contract Services", "Events")
- Brand partnerships or licensed concepts
- Cuisine types or food styles they offer

For each concept/service found, extract:
- name: The name of the concept or service
- description: A brief description (1-2 sentences)
- category: The category it belongs to (e.g., "Food Concepts", "Services", "Solutions")
- features: Key features or highlights (array of strings)

Return ONLY valid JSON array. Example:
[
  {"name": "Street Eats", "description": "Authentic street food from around the world", "category": "Food Concepts", "features": ["Asian fusion", "Mexican street food", "Global flavors"]},
  {"name": "Executive Catering", "description": "Premium catering for corporate events", "category": "Services", "features": ["White-glove service", "Custom menus", "Dietary accommodations"]}
]

If no service concepts are found, return an empty array: []`
          },
          {
            role: 'user',
            content: `Extract all B2B food service concepts and offerings from this page:\n\n${truncatedContent}`
          }
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });
      
      const content = response.choices[0]?.message?.content?.trim() || '[]';
      
      let concepts: any[] = [];
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
        concepts = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.log(`[Service-Extract] JSON parse failed for ${pageResult.url}: ${(parseErr as Error).message}`);
        continue;
      }
      
      if (!Array.isArray(concepts)) {
        console.log(`[Service-Extract] Expected array, got ${typeof concepts}`);
        continue;
      }
      
      for (const concept of concepts) {
        if (!concept.name || typeof concept.name !== 'string') continue;
        
        allConcepts.push({
          name: concept.name,
          description: concept.description || null,
          category: concept.category || categoryName,
          features: Array.isArray(concept.features) ? concept.features : [],
          imageUrl: null,
          sourceUrl: pageResult.url,
        });
      }
      
      console.log(`[Service-Extract] Extracted ${concepts.length} concepts from ${pageResult.url}`);
      
    } catch (err) {
      console.log(`[Service-Extract] Failed for ${pageResult.url}: ${(err as Error).message}`);
    }
  }
  
  console.log(`[Service-Extract] Total extracted: ${allConcepts.length} concepts`);
  return allConcepts;
}

export async function extractServiceConceptsMultiPage(baseUrl: string, maxPages: number = 10): Promise<ExtractedServiceConcept[]> {
  console.log(`[Service-MultiPage] Starting extraction for: ${baseUrl}`);
  
  // Crawl using service link patterns
  const serviceLinkPatterns = [
    /\/food-concepts?/i,
    /\/concepts?/i,
    /\/solutions?/i,
    /\/services?/i,
    /\/what-we-do/i,
    /\/our-work/i,
    /\/about/i,
  ];
  
  const crawlResult = await deepScrapeMultiplePages(baseUrl, {
    maxPages,
    linkPatterns: serviceLinkPatterns,
    timeout: 45000,
    sameDomainOnly: true,
    rateLimitMs: 300,
    stopAfterEmptyPages: 3
  });
  
  console.log(`[Service-MultiPage] Crawled ${crawlResult.pages.length} pages (${crawlResult.stoppedReason})`);
  
  // Use AI extraction for B2B content
  return extractServiceConceptsWithAI(crawlResult);
}

/**
 * High-Signal Page Extraction - crawls about/faq/contact/testimonial pages
 * and extracts rich business data beyond products/menu items.
 * 
 * Returns boxes ready to insert into orbit_boxes table.
 */
export interface HighSignalExtractionResult {
  pagesVisited: string[];
  extractionResults: BusinessDataExtractionResult[];
  boxes: Array<{
    businessSlug: string;
    boxType: string;
    title: string;
    description: string | null;
    content: string | null;
    sourceUrl: string | null;
    tags: Array<{ key: string; value: string }>;
  }>;
  stats: {
    totalPages: number;
    businessProfiles: number;
    contacts: number;
    openingHours: number;
    faqs: number;
    testimonials: number;
    teamMembers: number;
    trustSignals: number;
  };
}

export async function extractHighSignalPages(
  baseUrl: string, 
  businessSlug: string,
  maxPages: number = 15
): Promise<HighSignalExtractionResult> {
  console.log(`[HighSignal] Starting high-signal page extraction for: ${baseUrl}`);
  
  // Crawl using high-signal link patterns
  const crawlResult = await deepScrapeMultiplePages(baseUrl, {
    maxPages,
    linkPatterns: LINK_PATTERNS.highSignal,
    timeout: 45000,
    sameDomainOnly: true,
    rateLimitMs: 500,
    stopAfterEmptyPages: 5
  });
  
  console.log(`[HighSignal] Crawled ${crawlResult.pages.length} high-signal pages (${crawlResult.stoppedReason})`);
  
  const extractionResults: BusinessDataExtractionResult[] = [];
  const allBoxes: HighSignalExtractionResult['boxes'] = [];
  
  const stats = {
    totalPages: crawlResult.pages.length,
    businessProfiles: 0,
    contacts: 0,
    openingHours: 0,
    faqs: 0,
    testimonials: 0,
    teamMembers: 0,
    trustSignals: 0,
  };
  
  // Process each page
  for (const pageResult of crawlResult.pages) {
    if (!pageResult.text || pageResult.text.length < 200) {
      console.log(`[HighSignal] Skipping ${pageResult.url} - insufficient content`);
      continue;
    }
    
    try {
      const result = await extractBusinessData(pageResult);
      extractionResults.push(result);
      
      // Convert to boxes
      const boxes = extractionResultToBoxes(result, businessSlug);
      allBoxes.push(...boxes);
      
      // Update stats
      if (result.businessProfile) stats.businessProfiles++;
      if (result.contact) stats.contacts++;
      if (result.openingHours) stats.openingHours++;
      stats.faqs += result.faqs.length;
      stats.testimonials += result.testimonials.length;
      stats.teamMembers += result.teamMembers.length;
      stats.trustSignals += result.trustSignals.length;
      
      console.log(`[HighSignal] Extracted from ${pageResult.url}: type=${result.pageType}, confidence=${result.confidence.toFixed(2)}`);
      
    } catch (err) {
      console.log(`[HighSignal] Failed to extract ${pageResult.url}: ${(err as Error).message}`);
    }
  }
  
  // Deduplicate boxes by title + boxType
  const seenKeys = new Set<string>();
  const deduplicatedBoxes = allBoxes.filter(box => {
    const key = `${box.boxType}:${box.title.toLowerCase().trim()}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  
  console.log(`[HighSignal] Extraction complete: ${deduplicatedBoxes.length} boxes (${allBoxes.length - deduplicatedBoxes.length} duplicates removed)`);
  console.log(`[HighSignal] Stats: profiles=${stats.businessProfiles}, contacts=${stats.contacts}, hours=${stats.openingHours}, faqs=${stats.faqs}, testimonials=${stats.testimonials}, team=${stats.teamMembers}`);
  
  return {
    pagesVisited: crawlResult.pagesVisited,
    extractionResults,
    boxes: deduplicatedBoxes,
    stats,
  };
}
