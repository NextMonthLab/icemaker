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
