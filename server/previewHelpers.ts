import dns from "dns/promises";
import { randomUUID } from "crypto";
import type { SiteIdentity } from "@shared/schema";

// SSRF protection: validate URL safety
export async function validateUrlSafety(url: string): Promise<{ safe: boolean; error?: string; domain?: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { safe: false, error: "Invalid URL format" };
  }

  // Only allow http/https
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return { safe: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  // Block internal/private hostnames and IPs
  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./,
    /^0\./,
    /\.local$/i,
    /\.internal$/i,
    /\.localhost$/i,
    /^metadata\./i,
    /^169\.254\.169\.254$/,
  ];

  if (blockedPatterns.some(pattern => pattern.test(hostname))) {
    return { safe: false, error: "URLs to internal or private networks are not allowed" };
  }

  // Block IPv4 address literals
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return { safe: false, error: "Direct IP addresses are not allowed" };
  }

  // Block IPv6 address literals
  if (hostname.startsWith('[') || /^[0-9a-f:]+$/i.test(hostname)) {
    return { safe: false, error: "IPv6 addresses are not allowed" };
  }

  // DNS resolution check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      const ip = addr.address;
      if (addr.family === 4) {
        if (
          ip.startsWith('127.') ||
          ip.startsWith('10.') ||
          ip.startsWith('192.168.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
          ip.startsWith('169.254.') ||
          ip.startsWith('0.')
        ) {
          return { safe: false, error: "URL resolves to a private network address" };
        }
      }
    }
  } catch (dnsError) {
    console.error("DNS lookup error:", dnsError);
    return { safe: false, error: "Could not resolve URL hostname" };
  }

  // Extract domain (remove www. if present)
  const domain = hostname.replace(/^www\./, '');

  return { safe: true, domain };
}

// Extract favicon URL using proper hierarchy
function extractFaviconUrl(html: string, baseUrl: string): string | null {
  const parsedBase = new URL(baseUrl);
  
  // 1. Check for apple-touch-icon (high quality)
  const appleTouchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
  if (appleTouchMatch) {
    return resolveUrl(appleTouchMatch[1], baseUrl);
  }
  
  // 2. Check for icon link tags
  const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
  if (iconMatch) {
    return resolveUrl(iconMatch[1], baseUrl);
  }
  
  // 3. Fallback to /favicon.ico
  return `${parsedBase.origin}/favicon.ico`;
}

// Extract logo URL from header/nav with "logo" in class/id/alt/src
function extractLogoUrl(html: string, baseUrl: string): string | null {
  // Look for images with "logo" in class, id, alt, or src within header/nav
  const headerNavPattern = /<(?:header|nav)[^>]*>[\s\S]*?<\/(?:header|nav)>/gi;
  const headerNavMatches = html.match(headerNavPattern) || [];
  
  for (const section of headerNavMatches) {
    // Find img tags with "logo" in attributes
    const imgPattern = /<img[^>]*(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/gi;
    const imgMatches = section.match(imgPattern) || [];
    
    for (const img of imgMatches) {
      const srcMatch = img.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1];
        // Skip tiny icons (data URIs or very short paths likely to be icons)
        if (!src.startsWith('data:') && src.length > 10) {
          return resolveUrl(src, baseUrl);
        }
      }
    }
  }
  
  // Broader search: any img with "logo" anywhere on the page
  const allLogoImgs = html.match(/<img[^>]*(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi) || [];
  for (const match of allLogoImgs) {
    const srcMatch = match.match(/src=["']([^"']+)["']/i);
    if (srcMatch && !srcMatch[1].startsWith('data:')) {
      return resolveUrl(srcMatch[1], baseUrl);
    }
  }
  
  return null;
}

// Extract hero headline (first h1)
function extractHeroHeadline(html: string): string | null {
  // First h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return cleanText(h1Match[1]);
  }
  
  // Fallback to og:title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    return cleanText(ogTitleMatch[1]);
  }
  
  // Fallback to title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return cleanText(titleMatch[1]);
  }
  
  return null;
}

// Extract hero description (meta description or first meaningful paragraph)
function extractHeroDescription(html: string): string | null {
  // Meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaDescMatch) {
    return cleanText(metaDescMatch[1]);
  }
  
  // og:description fallback
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) {
    return cleanText(ogDescMatch[1]);
  }
  
  // First meaningful paragraph (skip navigation/footer areas)
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  const pMatches = mainContent.match(/<p[^>]*>([^<]{50,300})<\/p>/gi) || [];
  for (const p of pMatches) {
    const textMatch = p.match(/<p[^>]*>([^<]+)<\/p>/i);
    if (textMatch) {
      const text = cleanText(textMatch[1]);
      if (text.length > 50 && !text.toLowerCase().includes('cookie') && !text.toLowerCase().includes('privacy')) {
        return text;
      }
    }
  }
  
  return null;
}

// Extract hero image (og:image or first large image)
function extractHeroImageUrl(html: string, baseUrl: string): string | null {
  // og:image first
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    return resolveUrl(ogImageMatch[1], baseUrl);
  }
  
  // twitter:image fallback
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterImageMatch) {
    return resolveUrl(twitterImageMatch[1], baseUrl);
  }
  
  // First large image in main content (skip header/nav/footer)
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  const imgMatches = mainContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  for (const img of imgMatches) {
    const srcMatch = img.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1];
      // Skip small images, icons, data URIs
      if (!src.startsWith('data:') && 
          !src.includes('icon') && 
          !src.includes('logo') &&
          !src.includes('avatar') &&
          src.length > 20) {
        return resolveUrl(src, baseUrl);
      }
    }
  }
  
  return null;
}

// Extract primary colour from theme-color, CSS variables, or computed sources
function extractPrimaryColour(html: string): string {
  // 1. theme-color meta tag (highest priority)
  const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i);
  if (themeColorMatch && isValidColour(themeColorMatch[1])) {
    return themeColorMatch[1];
  }
  
  // 2. msapplication-TileColor
  const tileColorMatch = html.match(/<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i);
  if (tileColorMatch && isValidColour(tileColorMatch[1])) {
    return tileColorMatch[1];
  }
  
  // 3. CSS variables in :root (common naming patterns)
  const cssVarPatterns = [
    /--primary[^:]*:\s*([#][0-9a-fA-F]{3,8})/i,
    /--brand[^:]*:\s*([#][0-9a-fA-F]{3,8})/i,
    /--accent[^:]*:\s*([#][0-9a-fA-F]{3,8})/i,
    /--color-primary[^:]*:\s*([#][0-9a-fA-F]{3,8})/i,
    /--main[^:]*:\s*([#][0-9a-fA-F]{3,8})/i,
  ];
  
  for (const pattern of cssVarPatterns) {
    const match = html.match(pattern);
    if (match && isValidColour(match[1])) {
      return match[1];
    }
  }
  
  // 4. Look for inline styles on buttons/links with explicit colours
  const buttonColorMatch = html.match(/<(?:button|a)[^>]*style=["'][^"']*background(?:-color)?:\s*([#][0-9a-fA-F]{3,8})/i);
  if (buttonColorMatch && isValidColour(buttonColorMatch[1])) {
    return buttonColorMatch[1];
  }
  
  // 5. Default fallback
  return '#7c3aed';
}

// Validate colour format
function isValidColour(colour: string): boolean {
  if (!colour) return false;
  // Check hex format
  if (/^#[0-9a-fA-F]{3,8}$/.test(colour)) return true;
  // Check rgb/rgba format
  if (/^rgba?\s*\(/.test(colour)) return true;
  // Check named colours (basic)
  const namedColours = ['blue', 'red', 'green', 'purple', 'orange', 'yellow', 'pink', 'teal', 'navy', 'black', 'white'];
  if (namedColours.includes(colour.toLowerCase())) return true;
  return false;
}

// Extract image pool for variety across cards
function extractImagePool(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const seenUrls = new Set<string>();
  
  // 1. og:image first
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (ogImageMatch) {
    const url = resolveUrl(ogImageMatch[1], baseUrl);
    if (!seenUrls.has(url)) {
      images.push(url);
      seenUrls.add(url);
    }
  }
  
  // 2. twitter:image
  const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (twitterImageMatch) {
    const url = resolveUrl(twitterImageMatch[1], baseUrl);
    if (!seenUrls.has(url)) {
      images.push(url);
      seenUrls.add(url);
    }
  }
  
  // 3. Main content images (skip nav/header/footer)
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  const imgMatches = mainContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  for (const img of imgMatches) {
    if (images.length >= 20) break;
    
    const srcMatch = img.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    
    const src = srcMatch[1];
    
    // Skip unsuitable images
    if (src.startsWith('data:')) continue;
    if (src.includes('icon')) continue;
    if (src.includes('logo')) continue;
    if (src.includes('avatar')) continue;
    if (src.includes('sprite')) continue;
    if (src.includes('1x1')) continue;
    if (src.length < 20) continue;
    
    // Check for size hints in attributes
    const widthMatch = img.match(/width=["']?(\d+)/i);
    const heightMatch = img.match(/height=["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 200) continue;
    if (heightMatch && parseInt(heightMatch[1]) < 150) continue;
    
    const url = resolveUrl(src, baseUrl);
    if (!seenUrls.has(url)) {
      images.push(url);
      seenUrls.add(url);
    }
  }
  
  return images;
}

// Extract service headings (h2/h3 elements)
function extractServiceHeadings(html: string): string[] {
  const headings: string[] = [];
  
  // Remove nav, header, footer to focus on main content
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  // Extract h2 and h3 headings
  const h2Matches = mainContent.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
  const h3Matches = mainContent.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
  
  for (const h of [...h2Matches, ...h3Matches]) {
    const textMatch = h.match(/>([^<]+)</);
    if (textMatch) {
      const text = cleanText(textMatch[1]);
      if (text.length > 3 && text.length < 100 && !headings.includes(text)) {
        headings.push(text);
        if (headings.length >= 8) break;
      }
    }
  }
  
  return headings;
}

// Extract service bullets (li elements near service headings)
function extractServiceBullets(html: string): string[] {
  const bullets: string[] = [];
  
  // Remove nav, header, footer
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  // Extract li items
  const liMatches = mainContent.match(/<li[^>]*>([^<]{10,100})<\/li>/gi) || [];
  
  for (const li of liMatches) {
    const textMatch = li.match(/>([^<]+)</);
    if (textMatch) {
      const text = cleanText(textMatch[1]);
      if (text.length > 10 && text.length < 100 && !bullets.includes(text)) {
        bullets.push(text);
        if (bullets.length >= 10) break;
      }
    }
  }
  
  return bullets;
}

// Extract FAQ candidates (headings with ? or FAQ patterns)
function extractFaqCandidates(html: string): string[] {
  const faqs: string[] = [];
  
  // Remove nav, header, footer
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  // Find headings with question marks
  const headingMatches = mainContent.match(/<h[1-6][^>]*>[^<]*\?[^<]*<\/h[1-6]>/gi) || [];
  
  for (const h of headingMatches) {
    const textMatch = h.match(/>([^<]+)</);
    if (textMatch) {
      const text = cleanText(textMatch[1]);
      if (text.length > 10 && text.length < 150 && !faqs.includes(text)) {
        faqs.push(text);
        if (faqs.length >= 6) break;
      }
    }
  }
  
  // If no questions found, generate from service headings
  if (faqs.length === 0) {
    const serviceHeadings = extractServiceHeadings(html);
    for (const heading of serviceHeadings.slice(0, 3)) {
      faqs.push(`What is ${heading}?`);
    }
  }
  
  return faqs;
}

// Extract JSON-LD structured data
interface StructuredDataResult {
  organization: {
    name: string | null;
    description: string | null;
    url: string | null;
    logo: string | null;
    sameAs: string[];
  } | null;
  products: Array<{
    name: string;
    description: string | null;
    price: string | null;
    imageUrl: string | null;
  }>;
  faqs: Array<{ question: string; answer: string }>;
  events: Array<{
    name: string;
    description: string | null;
    startDate: string | null;
    location: string | null;
  }>;
  people: Array<{
    name: string;
    jobTitle: string | null;
    description: string | null;
    imageUrl: string | null;
  }>;
}

function extractJsonLd(html: string, baseUrl: string): StructuredDataResult {
  const result: StructuredDataResult = {
    organization: null,
    products: [],
    faqs: [],
    events: [],
    people: [],
  };
  
  // Find all JSON-LD script tags
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (const match of jsonLdMatches) {
    const contentMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!contentMatch) continue;
    
    try {
      const data = JSON.parse(contentMatch[1]);
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        const type = item['@type'];
        
        // Handle Organization/LocalBusiness
        if (type === 'Organization' || type === 'LocalBusiness' || type === 'Corporation') {
          result.organization = {
            name: item.name || null,
            description: item.description || null,
            url: item.url || null,
            logo: typeof item.logo === 'string' ? item.logo : item.logo?.url || null,
            sameAs: Array.isArray(item.sameAs) ? item.sameAs : (item.sameAs ? [item.sameAs] : []),
          };
        }
        
        // Handle Products
        if (type === 'Product') {
          result.products.push({
            name: item.name || 'Product',
            description: item.description || null,
            price: item.offers?.price ? `${item.offers.priceCurrency || '£'}${item.offers.price}` : null,
            imageUrl: typeof item.image === 'string' ? resolveUrl(item.image, baseUrl) : null,
          });
        }
        
        // Handle FAQPage
        if (type === 'FAQPage' && item.mainEntity) {
          const entities = Array.isArray(item.mainEntity) ? item.mainEntity : [item.mainEntity];
          for (const entity of entities) {
            if (entity['@type'] === 'Question' && entity.acceptedAnswer) {
              result.faqs.push({
                question: cleanText(entity.name || ''),
                answer: cleanText(entity.acceptedAnswer?.text || ''),
              });
            }
          }
        }
        
        // Handle Event
        if (type === 'Event') {
          result.events.push({
            name: item.name || 'Event',
            description: item.description || null,
            startDate: item.startDate || null,
            location: typeof item.location === 'string' ? item.location : item.location?.name || null,
          });
        }
        
        // Handle Person
        if (type === 'Person') {
          result.people.push({
            name: item.name || 'Person',
            jobTitle: item.jobTitle || null,
            description: item.description || null,
            imageUrl: typeof item.image === 'string' ? resolveUrl(item.image, baseUrl) : null,
          });
        }
      }
    } catch (e) {
      // JSON parse failed, skip this block
    }
  }
  
  return result;
}

// Enhanced FAQ extraction with Q&A pairs
interface FaqPair {
  question: string;
  answer: string;
}

function extractEnhancedFaqs(html: string): FaqPair[] {
  const faqs: FaqPair[] = [];
  const seenQuestions = new Set<string>();
  
  // Remove nav, header, footer
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  // 1. Look for <details><summary> patterns (common accordion FAQ)
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([^<]+)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  let detailsMatch;
  while ((detailsMatch = detailsPattern.exec(mainContent)) !== null) {
    const question = cleanText(detailsMatch[1]);
    const answerHtml = detailsMatch[2];
    const answer = cleanText(answerHtml.replace(/<[^>]+>/g, ' '));
    
    if (question.length > 10 && answer.length > 20 && !seenQuestions.has(question.toLowerCase())) {
      faqs.push({ question, answer: answer.substring(0, 500) });
      seenQuestions.add(question.toLowerCase());
    }
    if (faqs.length >= 10) break;
  }
  
  // 2. Look for common FAQ accordion patterns (divs with question/answer classes)
  const accordionPatterns = [
    /<div[^>]*class="[^"]*(?:faq|accordion)[^"]*"[^>]*>[\s\S]*?<(?:h[2-4]|button|div)[^>]*class="[^"]*(?:question|title|header)[^"]*"[^>]*>([^<]+)<\/(?:h[2-4]|button|div)>[\s\S]*?<(?:div|p)[^>]*class="[^"]*(?:answer|content|body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p)>/gi,
    /<div[^>]*class="[^"]*faq-item[^"]*"[^>]*>[\s\S]*?>([^<]*\?[^<]*)<[\s\S]*?<(?:div|p)[^>]*>([\s\S]*?)<\/(?:div|p)>/gi,
  ];
  
  for (const pattern of accordionPatterns) {
    let match;
    while ((match = pattern.exec(mainContent)) !== null && faqs.length < 10) {
      const question = cleanText(match[1]);
      const answer = cleanText(match[2].replace(/<[^>]+>/g, ' '));
      
      if (question.length > 10 && answer.length > 20 && !seenQuestions.has(question.toLowerCase())) {
        faqs.push({ question, answer: answer.substring(0, 500) });
        seenQuestions.add(question.toLowerCase());
      }
    }
  }
  
  // 3. Look for heading followed by paragraph (H3/H4 with ? followed by p)
  const headingAnswerPattern = /<h[3-4][^>]*>([^<]*\?)<\/h[3-4]>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let headingMatch;
  while ((headingMatch = headingAnswerPattern.exec(mainContent)) !== null && faqs.length < 10) {
    const question = cleanText(headingMatch[1]);
    const answer = cleanText(headingMatch[2].replace(/<[^>]+>/g, ' '));
    
    if (question.length > 10 && answer.length > 20 && !seenQuestions.has(question.toLowerCase())) {
      faqs.push({ question, answer: answer.substring(0, 500) });
      seenQuestions.add(question.toLowerCase());
    }
  }
  
  return faqs;
}

// Extract testimonials and reviews
interface Testimonial {
  quote: string;
  author: string | null;
  role: string | null;
  company: string | null;
  rating: number | null;
  imageUrl: string | null;
}

function extractTestimonials(html: string, baseUrl: string): Testimonial[] {
  const testimonials: Testimonial[] = [];
  const seenQuotes = new Set<string>();
  
  // Remove nav, header, footer
  const mainContent = html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  // 1. Look for blockquote elements (classic testimonial pattern)
  const blockquotePattern = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  let blockquoteMatch;
  while ((blockquoteMatch = blockquotePattern.exec(mainContent)) !== null && testimonials.length < 8) {
    const content = blockquoteMatch[1];
    const quoteText = cleanText(content.replace(/<[^>]+>/g, ' '));
    
    // Skip if too short or already seen
    if (quoteText.length < 30 || seenQuotes.has(quoteText.substring(0, 50).toLowerCase())) continue;
    
    // Try to find author nearby
    const citeMatch = content.match(/<cite[^>]*>([^<]+)<\/cite>/i);
    const authorMatch = content.match(/[-–—]\s*([^<,]+)/);
    
    testimonials.push({
      quote: quoteText.substring(0, 400),
      author: citeMatch ? cleanText(citeMatch[1]) : (authorMatch ? cleanText(authorMatch[1]) : null),
      role: null,
      company: null,
      rating: null,
      imageUrl: null,
    });
    seenQuotes.add(quoteText.substring(0, 50).toLowerCase());
  }
  
  // 2. Look for testimonial/review classes
  const testimonialPatterns = [
    /<div[^>]*class="[^"]*(?:testimonial|review|quote)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*class="[^"]*(?:testimonial|review)[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
  ];
  
  for (const pattern of testimonialPatterns) {
    let match;
    while ((match = pattern.exec(mainContent)) !== null && testimonials.length < 8) {
      const content = match[1];
      
      // Extract quote (look for p tag or text content)
      const quoteMatch = content.match(/<p[^>]*class="[^"]*(?:quote|text|content)[^"]*"[^>]*>([^<]+)/i) ||
                         content.match(/<p[^>]*>([^<]{30,})/i);
      if (!quoteMatch) continue;
      
      const quoteText = cleanText(quoteMatch[1]);
      if (quoteText.length < 30 || seenQuotes.has(quoteText.substring(0, 50).toLowerCase())) continue;
      
      // Try to find author
      const authorMatch = content.match(/<(?:span|p|cite)[^>]*class="[^"]*(?:author|name)[^"]*"[^>]*>([^<]+)/i);
      const roleMatch = content.match(/<(?:span|p)[^>]*class="[^"]*(?:role|title|position)[^"]*"[^>]*>([^<]+)/i);
      const companyMatch = content.match(/<(?:span|p)[^>]*class="[^"]*(?:company|org)[^"]*"[^>]*>([^<]+)/i);
      
      // Look for star ratings (count star characters or look for rating class)
      let rating: number | null = null;
      const starsMatch = content.match(/[★⭐]{1,5}/);
      if (starsMatch) {
        rating = starsMatch[0].length;
      }
      const ratingClassMatch = content.match(/rating[^>]*>(\d)/i);
      if (ratingClassMatch) {
        rating = parseInt(ratingClassMatch[1]);
      }
      
      // Look for avatar image
      const imgMatch = content.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
      
      testimonials.push({
        quote: quoteText.substring(0, 400),
        author: authorMatch ? cleanText(authorMatch[1]) : null,
        role: roleMatch ? cleanText(roleMatch[1]) : null,
        company: companyMatch ? cleanText(companyMatch[1]) : null,
        rating,
        imageUrl: imgMatch ? resolveUrl(imgMatch[1], baseUrl) : null,
      });
      seenQuotes.add(quoteText.substring(0, 50).toLowerCase());
    }
  }
  
  // 3. Look for Schema.org Review markup in JSON-LD (already handled in extractJsonLd)
  // 4. Look for inline review patterns
  const inlineReviewPattern = /"([^"]{50,300})"\s*[-–—]\s*([^<,\n]+)/g;
  let inlineMatch;
  while ((inlineMatch = inlineReviewPattern.exec(mainContent)) !== null && testimonials.length < 8) {
    const quoteText = cleanText(inlineMatch[1]);
    const author = cleanText(inlineMatch[2]);
    
    if (quoteText.length >= 30 && !seenQuotes.has(quoteText.substring(0, 50).toLowerCase())) {
      testimonials.push({
        quote: quoteText.substring(0, 400),
        author,
        role: null,
        company: null,
        rating: null,
        imageUrl: null,
      });
      seenQuotes.add(quoteText.substring(0, 50).toLowerCase());
    }
  }
  
  return testimonials;
}

// Helper: resolve relative URLs to absolute
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// Helper: clean extracted text
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Full site identity extraction
export async function extractSiteIdentity(url: string, html: string): Promise<SiteIdentity> {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? cleanText(titleMatch[1]) : null;
  
  // Extract structured data from JSON-LD
  const structuredData = extractJsonLd(html, url);
  
  // Extract enhanced FAQs (Q&A pairs)
  const enhancedFaqs = extractEnhancedFaqs(html);
  
  // Merge JSON-LD FAQs with HTML-extracted FAQs
  const allEnhancedFaqs = [...structuredData.faqs, ...enhancedFaqs].slice(0, 10);
  
  // Extract testimonials
  const testimonials = extractTestimonials(html, url);
  
  // Use organization name from structured data if available
  const orgName = structuredData.organization?.name;
  
  return {
    sourceDomain: domain,
    title: orgName || title,
    heroHeadline: extractHeroHeadline(html),
    heroDescription: structuredData.organization?.description || extractHeroDescription(html),
    logoUrl: structuredData.organization?.logo || extractLogoUrl(html, url),
    faviconUrl: extractFaviconUrl(html, url),
    heroImageUrl: extractHeroImageUrl(html, url),
    primaryColour: extractPrimaryColour(html),
    serviceHeadings: extractServiceHeadings(html),
    serviceBullets: extractServiceBullets(html),
    faqCandidates: extractFaqCandidates(html),
    imagePool: extractImagePool(html, url),
    extractedAt: new Date().toISOString(),
    structuredData,
    testimonials,
    enhancedFaqs: allEnhancedFaqs,
  };
}

// Lightweight site ingestion (max 4 pages, 80k chars total)
export async function ingestSitePreview(url: string): Promise<{
  title: string;
  summary: string;
  keyServices: string[];
  totalChars: number;
  pagesIngested: number;
  siteIdentity: SiteIdentity;
}> {
  const maxCharsPerPage = 20000;

  let totalChars = 0;
  let pagesIngested = 0;
  let allText = '';
  let title = '';
  let siteIdentity: SiteIdentity;

  try {
    // Fetch main page
    const response = await fetch(url, {
      headers: { "User-Agent": "NextMonth-Preview/1.0" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract site identity (for brand continuity)
    siteIdentity = await extractSiteIdentity(url, html);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Basic HTML to text
    const pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, maxCharsPerPage);

    allText += pageText + "\n\n";
    totalChars += pageText.length;
    pagesIngested = 1;

    // Run SmartSite pipeline for validated content
    try {
      const { runSmartSitePipeline } = await import("./smartSitePipeline");
      const pipelineResult = await runSmartSitePipeline(url, html);
      
      // Attach validated content to site identity
      siteIdentity.validatedContent = pipelineResult.validatedContent;
      
      console.log('[Pipeline] Completed:', pipelineResult.pipelineLog.join('\n'));
    } catch (pipelineError) {
      console.error('[Pipeline] Error, validation failed:', pipelineError);
      const brandName = siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || siteIdentity.sourceDomain;
      // Hard gate: no content when validation fails - only mark failure
      siteIdentity.validatedContent = {
        overview: '',
        whatWeDo: [],
        commonQuestions: [],
        brandName,
        passed: false,
        issues: ['Validation pipeline failed - content cannot be displayed until validated'],
      };
    }

    // Extract key services from service headings and bullets
    const keyServices = [...siteIdentity.serviceHeadings.slice(0, 3), ...siteIdentity.serviceBullets.slice(0, 2)];

    // Generate summary (first 3 paragraphs or 500 chars)
    const summary = siteIdentity.heroDescription || allText.substring(0, 500).split('\n').slice(0, 3).join('\n').trim();

    return {
      title: title || new URL(url).hostname,
      summary: summary || "Business website",
      keyServices: keyServices.slice(0, 5),
      totalChars,
      pagesIngested,
      siteIdentity,
    };
  } catch (error: any) {
    console.error("Site ingestion error:", error);
    throw new Error(`Failed to ingest site: ${error.message}`);
  }
}

export function generatePreviewId(): string {
  return randomUUID();
}

export function calculateExpiresAt(): Date {
  const now = new Date();
  return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
}

// Generate contextual prompts based on extracted content
export function generateContextualPrompts(siteIdentity: SiteIdentity): string[] {
  const prompts: string[] = [];
  
  // Use service headings for contextual questions
  for (const heading of siteIdentity.serviceHeadings.slice(0, 2)) {
    prompts.push(`What does ${heading} include?`);
  }
  
  // Add general prompts
  if (siteIdentity.title) {
    prompts.push(`How do I get started with ${siteIdentity.title?.split(' - ')[0] || siteIdentity.sourceDomain}?`);
  }
  
  prompts.push("What's the best next step for someone like me?");
  
  // Use FAQ candidates if available
  for (const faq of siteIdentity.faqCandidates.slice(0, 2)) {
    if (!prompts.includes(faq)) {
      prompts.push(faq);
    }
  }
  
  return prompts.slice(0, 5);
}
