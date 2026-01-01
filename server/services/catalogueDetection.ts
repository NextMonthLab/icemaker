import puppeteer, { Page } from 'puppeteer';
import { execSync } from 'child_process';

// Resolve chromium path dynamically for Nix environments
function getChromiumPath(): string | undefined {
  // Try environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Try to find chromium in PATH
  try {
    const path = execSync('which chromium || which chromium-browser', { encoding: 'utf8' }).trim();
    if (path) return path;
  } catch {}
  
  // Let puppeteer use its default
  return undefined;
}

const chromiumPath = getChromiumPath();

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
  type: 'ecommerce' | 'food_ordering' | 'cms' | 'delivery';
  confidence: number;
  indicators: string[];
}

export interface UrlPatternSignal {
  pattern: string;
  type: 'catalogue' | 'menu' | 'hybrid';
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
  confidence: number;
  primaryType: 'catalogue' | 'menu' | 'hybrid' | 'none';
  signals: DetectionSignals;
}

export interface ExtractionPlan {
  type: 'catalogue' | 'menu' | 'hybrid' | 'none';
  priority: 'catalogue_first' | 'menu_first' | 'parallel';
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

export async function detectSiteType(url: string): Promise<DetectionScores> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(chromiumPath && { executablePath: chromiumPath }),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const html = await page.content();
    const pageUrl = page.url();

    const signals: DetectionSignals = {
      structuredData: await detectStructuredData(page),
      platform: detectPlatformFingerprints(html, pageUrl),
      urlPatterns: await detectUrlPatterns(page, pageUrl),
      domHeuristics: await detectDomHeuristics(page),
    };

    return calculateScores(signals);
  } finally {
    await browser.close();
  }
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

  // Accumulate raw scores from all signals
  for (const signal of signals.structuredData) {
    if (['Product', 'Offer', 'ItemList'].includes(signal.type)) {
      rawCatalogue += signal.confidence * (signal.count > 5 ? 1.5 : 1);
    }
    if (['Restaurant', 'FoodEstablishment', 'Menu', 'MenuItem'].includes(signal.type)) {
      rawMenu += signal.confidence * (signal.count > 5 ? 1.5 : 1);
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
  }

  for (const signal of signals.urlPatterns) {
    if (signal.type === 'catalogue') {
      rawCatalogue += signal.confidence * 0.8;
    }
    if (signal.type === 'menu') {
      rawMenu += signal.confidence * 0.8;
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

  // Determine primary type based on normalized comparison
  let primaryType: 'catalogue' | 'menu' | 'hybrid' | 'none';
  const threshold = 0.3;
  const hybridThreshold = 0.6;

  if (scoreCatalogue > hybridThreshold && scoreMenu > hybridThreshold) {
    primaryType = 'hybrid';
  } else if (scoreCatalogue > threshold && rawCatalogue > rawMenu * 1.3) {
    primaryType = 'catalogue';
  } else if (scoreMenu > threshold && rawMenu > rawCatalogue * 1.3) {
    primaryType = 'menu';
  } else if (scoreCatalogue > threshold || scoreMenu > threshold) {
    primaryType = rawCatalogue > rawMenu ? 'catalogue' : 'menu';
  } else {
    primaryType = 'none';
  }

  // Confidence is the max score, reflecting how certain we are about the classification
  const confidence = Math.max(scoreCatalogue, scoreMenu);

  return {
    scoreCatalogue,
    scoreMenu,
    confidence,
    primaryType,
    signals,
  };
}

export function deriveExtractionPlan(scores: DetectionScores): ExtractionPlan {
  const { primaryType, scoreCatalogue, scoreMenu, confidence, signals } = scores;

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

  return {
    type: primaryType,
    priority: primaryType === 'hybrid' 
      ? (scoreCatalogue > scoreMenu ? 'catalogue_first' : 'menu_first')
      : 'parallel',
    confidence,
    rationale,
    estimatedItems: Math.max(estimatedItems, 10),
  };
}

export async function extractCatalogueItems(url: string): Promise<ExtractedProduct[]> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(chromiumPath && { executablePath: chromiumPath }),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

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
  } finally {
    await browser.close();
  }
}

export async function extractMenuItems(url: string): Promise<ExtractedMenuItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(chromiumPath && { executablePath: chromiumPath }),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

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
  } finally {
    await browser.close();
  }
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

export async function extractMenuItemsMultiPage(baseUrl: string, maxPages: number = 10): Promise<MultiPageMenuItem[]> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(chromiumPath && { executablePath: chromiumPath }),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const allItems: MultiPageMenuItem[] = [];
  const visitedUrls = new Set<string>();

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`[MultiPage] Loading main menu page: ${baseUrl}`);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to dismiss cookie consent banners
    try {
      const consentSelectors = [
        '[id*="cookie"] button',
        '[class*="cookie"] button',
        '[id*="consent"] button',
        '[class*="consent"] button',
        'button[aria-label*="Accept"]',
        'button[aria-label*="accept"]',
        '[data-testid*="accept"]',
        '#onetrust-accept-btn-handler',
        '.accept-cookies',
        'button:has-text("Accept")',
      ];
      for (const selector of consentSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            console.log(`[MultiPage] Clicked consent button: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        } catch {}
      }
    } catch {}
    
    // Scroll to load any lazy content
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find category/section links on the main page
    const categoryLinks = await page.evaluate((base) => {
      const links: { url: string; name: string }[] = [];
      const baseHost = new URL(base).hostname;
      const basePath = new URL(base).pathname;
      
      // Menu section patterns - these are sub-paths of the menu page
      const menuKeywords = [
        'burger', 'burgers', 'chicken', 'sides', 'side', 'drinks', 'drink',
        'dessert', 'desserts', 'meals', 'meal', 'bucket', 'buckets', 'wrap', 'wraps',
        'salad', 'salads', 'breakfast', 'lunch', 'dinner', 'appetizer', 'appetizers',
        'starter', 'starters', 'main', 'mains', 'pizza', 'pizzas', 'pasta',
        'sandwich', 'sandwiches', 'sharing', 'vegan', 'vegetarian', 'kids',
        'combo', 'combos', 'value', 'new', 'whats-new', 'special', 'specials',
        'rice', 'bowls', 'twisters', 'box', 'savers', 'classic', 'dips'
      ];

      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        
        try {
          const fullUrl = new URL(href, base).href;
          const urlObj = new URL(fullUrl);
          const urlHost = urlObj.hostname;
          const urlPath = urlObj.pathname;
          
          // Must be same domain
          if (urlHost !== baseHost) return;
          
          // Skip the exact same URL as base
          if (urlPath === basePath) return;
          
          // Check if this is a subpage of the menu page (e.g., /our-menu/burgers is child of /our-menu)
          const isSubPage = urlPath.startsWith(basePath) && urlPath !== basePath && urlPath.length > basePath.length;
          
          // Or matches menu keywords anywhere in the path
          const matchesKeyword = menuKeywords.some(kw => urlPath.toLowerCase().includes(kw));
          
          if (!isSubPage && !matchesKeyword) return;
          
          // Get link text for category name - try textContent, then title, then extract from URL
          let text = (a.textContent || '').trim();
          if (!text) text = (a.getAttribute('title') || '').trim();
          if (!text) text = (a.getAttribute('aria-label') || '').trim();
          if (!text) {
            // Extract category name from URL path (e.g., /our-menu/burgers -> Burgers)
            const pathParts = urlPath.split('/').filter(Boolean);
            const lastPart = pathParts[pathParts.length - 1] || '';
            text = lastPart.replace(/-/g, ' ').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
          }
          
          if (text && text.length > 0 && text.length < 50 && !links.some(l => l.url === fullUrl)) {
            links.push({ url: fullUrl, name: text });
          }
        } catch {}
      });

      return links;
    }, baseUrl);

    console.log(`[MultiPage] Found ${categoryLinks.length} category links`);
    if (categoryLinks.length > 0) {
      console.log(`[MultiPage] Categories:`, categoryLinks.slice(0, 5).map(c => c.name).join(', '));
    }
    
    // Also extract items from the main page first
    const mainPageItems = await extractItemsFromPage(page, 'Menu');
    allItems.push(...mainPageItems);
    visitedUrls.add(baseUrl);

    // Visit each category page (up to maxPages)
    const pagesToVisit = categoryLinks.slice(0, maxPages);
    
    for (const category of pagesToVisit) {
      if (visitedUrls.has(category.url)) continue;
      visitedUrls.add(category.url);

      try {
        console.log(`[MultiPage] Visiting category: ${category.name} (${category.url})`);
        await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const items = await extractItemsFromPage(page, category.name);
        console.log(`[MultiPage] Found ${items.length} items in ${category.name}`);
        allItems.push(...items);
      } catch (err: any) {
        console.error(`[MultiPage] Error visiting ${category.url}:`, err.message);
      }
    }

    console.log(`[MultiPage] Total items extracted: ${allItems.length}`);
    return allItems;
  } finally {
    await browser.close();
  }
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
        const containers = document.querySelectorAll('ul, ol, [role="list"], main, section, article');
        
        for (const container of containers) {
          const children = Array.from(container.children);
          if (children.length < 3) continue;
          
          // Check if children have similar structure (likely a product grid)
          const childSignatures = children.slice(0, 5).map(child => {
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
            children.forEach(child => {
              // Extract name from heading or first strong text
              const heading = child.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
              const name = heading?.textContent?.trim();
              if (!name || name.length < 2 || name.length > 80) return;
              if (processedNames.has(name.toLowerCase())) return;
              if (/^(add|buy|order|view|see)/i.test(name)) return; // Skip CTAs
              
              // Extract price
              const priceMatch = child.textContent?.match(priceRegex);
              const price = priceMatch ? priceMatch[1] : null;
              
              // Extract image
              const img = child.querySelector('img');
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
            });
            
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
