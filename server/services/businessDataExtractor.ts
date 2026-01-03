/**
 * Business Data Extractor - Extracts rich business context from scraped pages
 * 
 * This service extracts "high-signal" data types beyond products/menu items:
 * - Business Profile (name, tagline, key claims)
 * - Contact Information (address, phone, email)
 * - Opening Hours
 * - FAQs
 * - Testimonials/Reviews
 * - Team Members
 * - Trust Signals (accreditations, badges)
 * 
 * Uses page type classification to route to specialist extractors.
 */

import OpenAI from 'openai';
import type { DeepScrapeResult } from './deepScraper';
import type { OrbitBoxType, ProductTag } from '@shared/schema';

// Lazy-initialized OpenAI client
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

// Page type classification
export type PageType = 
  | 'about' | 'team' | 'faq' | 'contact' | 'testimonials' 
  | 'case_study' | 'services' | 'pricing' | 'product' | 'menu' | 'other';

// Extracted data interfaces
export interface ExtractedBusinessProfile {
  businessName: string;
  tagline: string | null;
  description: string | null;
  keyClaims: string[];  // "family-run since 1998", "ISO certified", etc.
  industry: string | null;
  serviceAreas: string[];
}

export interface ExtractedContact {
  addresses: Array<{
    street: string | null;
    city: string | null;
    postcode: string | null;
    country: string | null;
    fullAddress: string;
  }>;
  phones: string[];
  emails: string[];
  socialLinks: Array<{ platform: string; url: string }>;
}

export interface ExtractedOpeningHours {
  hours: Array<{
    day: string;
    open: string | null;
    close: string | null;
    closed: boolean;
  }>;
  notes: string[];  // "Closed on bank holidays", etc.
}

export interface ExtractedFAQ {
  question: string;
  answer: string;
  category: string | null;
}

export interface ExtractedTestimonial {
  quote: string;
  author: string | null;
  role: string | null;
  company: string | null;
  rating: number | null;  // 1-5 if available
}

export interface ExtractedTeamMember {
  name: string;
  role: string | null;
  bio: string | null;
  imageUrl: string | null;
}

export interface ExtractedTrustSignal {
  type: 'accreditation' | 'badge' | 'membership' | 'award' | 'certification';
  name: string;
  description: string | null;
  imageUrl: string | null;
}

// Combined extraction result
export interface BusinessDataExtractionResult {
  pageType: PageType;
  sourceUrl: string;
  sourceTitle: string | null;
  confidence: number;
  
  // Extracted data by type
  businessProfile: ExtractedBusinessProfile | null;
  contact: ExtractedContact | null;
  openingHours: ExtractedOpeningHours | null;
  faqs: ExtractedFAQ[];
  testimonials: ExtractedTestimonial[];
  teamMembers: ExtractedTeamMember[];
  trustSignals: ExtractedTrustSignal[];
  
  // Raw snippet for debugging
  rawSnippet: string;
}

/**
 * Classify what type of page this is based on URL and content
 */
export function classifyPageType(url: string, title: string | null, text: string): PageType {
  const urlLower = url.toLowerCase();
  const titleLower = (title || '').toLowerCase();
  const textLower = text.toLowerCase().substring(0, 2000);
  
  // URL-based classification
  if (/\/(about|our-story|story|company|mission|values|who-we-are)/i.test(urlLower)) return 'about';
  if (/\/(team|people|meet-the-team|leadership|staff|our-team)/i.test(urlLower)) return 'team';
  if (/\/(faq|faqs|help|support)/i.test(urlLower)) return 'faq';
  if (/\/(contact|locations?|find-us|visit)/i.test(urlLower)) return 'contact';
  if (/\/(testimonials?|reviews?)/i.test(urlLower)) return 'testimonials';
  if (/\/(case-stud|portfolio|work|projects)/i.test(urlLower)) return 'case_study';
  if (/\/(services|what-we-do)/i.test(urlLower)) return 'services';
  if (/\/pricing/i.test(urlLower)) return 'pricing';
  if (/\/(menu|food|order)/i.test(urlLower)) return 'menu';
  if (/\/(products?|shop|store|collections?)/i.test(urlLower)) return 'product';
  
  // Title-based fallback
  if (/about|story|mission/i.test(titleLower)) return 'about';
  if (/team|people|staff/i.test(titleLower)) return 'team';
  if (/faq|frequently asked/i.test(titleLower)) return 'faq';
  if (/contact|get in touch/i.test(titleLower)) return 'contact';
  if (/testimonial|review|what.*say/i.test(titleLower)) return 'testimonials';
  
  // Content-based fallback
  const faqIndicators = (textLower.match(/\?/g) || []).length;
  if (faqIndicators > 5 && textLower.includes('frequently')) return 'faq';
  
  return 'other';
}

/**
 * Extract business profile from about/home page
 */
async function extractBusinessProfile(text: string, url: string): Promise<ExtractedBusinessProfile | null> {
  const openai = getOpenAI();
  
  const prompt = `Extract business profile from this page content. Return JSON only.

PAGE CONTENT:
${text.substring(0, 4000)}

Return this exact JSON structure (use null for missing fields, [] for empty arrays):
{
  "businessName": "string",
  "tagline": "string or null",
  "description": "1-2 sentence summary",
  "keyClaims": ["family-run since 1998", "ISO certified", etc.],
  "industry": "string or null",
  "serviceAreas": ["London", "UK-wide", etc.]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    return JSON.parse(content) as ExtractedBusinessProfile;
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting business profile:', error);
    return null;
  }
}

/**
 * Extract contact information from contact/footer sections
 */
async function extractContact(text: string, url: string): Promise<ExtractedContact | null> {
  const openai = getOpenAI();
  
  const prompt = `Extract contact information from this page. Return JSON only.

PAGE CONTENT:
${text.substring(0, 4000)}

Return this exact JSON structure:
{
  "addresses": [{"street": null, "city": null, "postcode": null, "country": null, "fullAddress": "complete address string"}],
  "phones": ["+44 123 456 7890"],
  "emails": ["hello@example.com"],
  "socialLinks": [{"platform": "instagram", "url": "https://..."}]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    return JSON.parse(content) as ExtractedContact;
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting contact:', error);
    return null;
  }
}

/**
 * Extract opening hours
 */
async function extractOpeningHours(text: string): Promise<ExtractedOpeningHours | null> {
  const openai = getOpenAI();
  
  const prompt = `Extract opening hours from this page. Return JSON only.

PAGE CONTENT:
${text.substring(0, 3000)}

Return this exact JSON structure:
{
  "hours": [
    {"day": "Monday", "open": "09:00", "close": "17:00", "closed": false},
    {"day": "Sunday", "open": null, "close": null, "closed": true}
  ],
  "notes": ["Closed on bank holidays"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const result = JSON.parse(content) as ExtractedOpeningHours;
    if (!result.hours || result.hours.length === 0) return null;
    return result;
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting hours:', error);
    return null;
  }
}

/**
 * Extract FAQs from FAQ page or embedded FAQ sections
 */
async function extractFAQs(text: string): Promise<ExtractedFAQ[]> {
  const openai = getOpenAI();
  
  const prompt = `Extract FAQ question-answer pairs from this page. Return JSON only.

PAGE CONTENT:
${text.substring(0, 5000)}

Return this exact JSON structure:
{
  "faqs": [
    {"question": "What are your opening hours?", "answer": "We are open...", "category": "General"}
  ]
}

Only include actual FAQs, not general content. Return empty array if none found.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    
    const result = JSON.parse(content);
    return result.faqs || [];
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting FAQs:', error);
    return [];
  }
}

/**
 * Extract testimonials/reviews
 */
async function extractTestimonials(text: string): Promise<ExtractedTestimonial[]> {
  const openai = getOpenAI();
  
  const prompt = `Extract customer testimonials or reviews from this page. Return JSON only.

PAGE CONTENT:
${text.substring(0, 5000)}

Return this exact JSON structure:
{
  "testimonials": [
    {"quote": "Great service...", "author": "John Smith", "role": "CEO", "company": "Acme Ltd", "rating": 5}
  ]
}

Only include actual testimonials with quotes. Use null for unknown fields.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    
    const result = JSON.parse(content);
    return result.testimonials || [];
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting testimonials:', error);
    return [];
  }
}

/**
 * Extract team members from team page
 */
async function extractTeamMembers(text: string): Promise<ExtractedTeamMember[]> {
  const openai = getOpenAI();
  
  const prompt = `Extract team member information from this page. Return JSON only.

PAGE CONTENT:
${text.substring(0, 5000)}

Return this exact JSON structure:
{
  "teamMembers": [
    {"name": "Jane Doe", "role": "Founder & CEO", "bio": "Jane has 20 years...", "imageUrl": null}
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    
    const result = JSON.parse(content);
    return result.teamMembers || [];
  } catch (error) {
    console.error('[BusinessDataExtractor] Error extracting team:', error);
    return [];
  }
}

/**
 * Main extraction function - routes page to appropriate extractors
 */
export async function extractBusinessData(page: DeepScrapeResult): Promise<BusinessDataExtractionResult> {
  const pageType = classifyPageType(page.url, page.title, page.text || '');
  const text = page.text || '';
  
  console.log(`[BusinessDataExtractor] Processing ${page.url} as type: ${pageType}`);
  
  const result: BusinessDataExtractionResult = {
    pageType,
    sourceUrl: page.url,
    sourceTitle: page.title,
    confidence: 0.7,
    businessProfile: null,
    contact: null,
    openingHours: null,
    faqs: [],
    testimonials: [],
    teamMembers: [],
    trustSignals: [],
    rawSnippet: text.substring(0, 500),
  };
  
  // Route to appropriate extractors based on page type
  try {
    switch (pageType) {
      case 'about':
        result.businessProfile = await extractBusinessProfile(text, page.url);
        // About pages sometimes have FAQs embedded
        result.faqs = await extractFAQs(text);
        break;
        
      case 'contact':
        result.contact = await extractContact(text, page.url);
        result.openingHours = await extractOpeningHours(text);
        break;
        
      case 'faq':
        result.faqs = await extractFAQs(text);
        break;
        
      case 'testimonials':
        result.testimonials = await extractTestimonials(text);
        break;
        
      case 'team':
        result.teamMembers = await extractTeamMembers(text);
        break;
        
      case 'other':
        // For general pages, try to extract commonly embedded content
        // Check for FAQ patterns
        if ((text.match(/\?/g) || []).length > 3) {
          result.faqs = await extractFAQs(text);
        }
        // Check for testimonial patterns
        if (/testimonial|review|what.*say|customer.*said/i.test(text)) {
          result.testimonials = await extractTestimonials(text);
        }
        // Check for contact patterns
        if (/contact|email|phone|address/i.test(text)) {
          result.contact = await extractContact(text, page.url);
        }
        break;
    }
    
    // Calculate confidence based on what we found
    const foundItems = [
      result.businessProfile,
      result.contact,
      result.openingHours,
      result.faqs.length > 0,
      result.testimonials.length > 0,
      result.teamMembers.length > 0,
    ].filter(Boolean).length;
    
    result.confidence = Math.min(0.95, 0.5 + (foundItems * 0.1));
    
  } catch (error) {
    console.error('[BusinessDataExtractor] Extraction error:', error);
    result.confidence = 0.3;
  }
  
  return result;
}

/**
 * Convert extraction results to OrbitBox format for storage
 */
export function extractionResultToBoxes(
  result: BusinessDataExtractionResult,
  businessSlug: string
): Array<{
  businessSlug: string;
  boxType: OrbitBoxType;
  title: string;
  description: string | null;
  content: string | null;
  sourceUrl: string | null;
  tags: ProductTag[];
}> {
  const boxes: Array<{
    businessSlug: string;
    boxType: OrbitBoxType;
    title: string;
    description: string | null;
    content: string | null;
    sourceUrl: string | null;
    tags: ProductTag[];
  }> = [];
  
  // Business Profile box
  if (result.businessProfile) {
    boxes.push({
      businessSlug,
      boxType: 'business_profile',
      title: result.businessProfile.businessName,
      description: result.businessProfile.tagline || result.businessProfile.description,
      content: JSON.stringify(result.businessProfile),
      sourceUrl: result.sourceUrl,
      tags: result.businessProfile.keyClaims.map(claim => ({ key: 'claim', value: claim })),
    });
  }
  
  // Contact box
  if (result.contact && (result.contact.phones.length > 0 || result.contact.emails.length > 0)) {
    boxes.push({
      businessSlug,
      boxType: 'contact',
      title: 'Contact Information',
      description: result.contact.addresses[0]?.fullAddress || null,
      content: JSON.stringify(result.contact),
      sourceUrl: result.sourceUrl,
      tags: [],
    });
  }
  
  // Opening Hours box
  if (result.openingHours && result.openingHours.hours.length > 0) {
    boxes.push({
      businessSlug,
      boxType: 'opening_hours',
      title: 'Opening Hours',
      description: result.openingHours.notes.join('. ') || null,
      content: JSON.stringify(result.openingHours),
      sourceUrl: result.sourceUrl,
      tags: [],
    });
  }
  
  // FAQ boxes
  for (const faq of result.faqs) {
    boxes.push({
      businessSlug,
      boxType: 'faq',
      title: faq.question,
      description: faq.answer,
      content: null,
      sourceUrl: result.sourceUrl,
      tags: faq.category ? [{ key: 'category', value: faq.category }] : [],
    });
  }
  
  // Testimonial boxes
  for (const testimonial of result.testimonials) {
    boxes.push({
      businessSlug,
      boxType: 'testimonial',
      title: testimonial.author || 'Customer Review',
      description: testimonial.quote,
      content: JSON.stringify({ role: testimonial.role, company: testimonial.company, rating: testimonial.rating }),
      sourceUrl: result.sourceUrl,
      tags: testimonial.rating ? [{ key: 'rating', value: String(testimonial.rating) }] : [],
    });
  }
  
  // Team Member boxes
  for (const member of result.teamMembers) {
    boxes.push({
      businessSlug,
      boxType: 'team_member',
      title: member.name,
      description: member.role,
      content: member.bio,
      sourceUrl: result.sourceUrl,
      tags: [],
    });
  }
  
  // Social Link boxes
  if (result.contact?.socialLinks) {
    for (const social of result.contact.socialLinks) {
      boxes.push({
        businessSlug,
        boxType: 'social_link',
        title: social.platform,
        description: null,
        content: social.url,
        sourceUrl: result.sourceUrl,
        tags: [{ key: 'platform', value: social.platform }],
      });
    }
  }
  
  return boxes;
}

/**
 * Seeding Composer - Creates canonical summary boxes from all extraction results
 * 
 * This composes a unified "Business Identity" summary that captures:
 * - Primary business info (name, tagline, industry)
 * - Key trust signals
 * - Conversion CTAs
 * - Voice/tone guide
 */
export interface SeedingResult {
  businessIdentity: {
    name: string;
    tagline: string | null;
    industry: string | null;
    keyClaims: string[];
    serviceAreas: string[];
  } | null;
  contactSummary: {
    primaryPhone: string | null;
    primaryEmail: string | null;
    address: string | null;
    socialProfiles: string[];
  } | null;
  trustSummary: {
    testimonialCount: number;
    topQuote: string | null;
    trustBadges: string[];
  };
  conversionHooks: {
    primaryCTAs: string[];
    leadMagnets: string[];
  };
  faqCount: number;
  teamMemberCount: number;
}

export function composeSeedingResult(results: BusinessDataExtractionResult[]): SeedingResult {
  const seeding: SeedingResult = {
    businessIdentity: null,
    contactSummary: null,
    trustSummary: {
      testimonialCount: 0,
      topQuote: null,
      trustBadges: [],
    },
    conversionHooks: {
      primaryCTAs: [],
      leadMagnets: [],
    },
    faqCount: 0,
    teamMemberCount: 0,
  };
  
  for (const result of results) {
    // Business Identity - take first non-null profile
    if (!seeding.businessIdentity && result.businessProfile) {
      seeding.businessIdentity = {
        name: result.businessProfile.businessName,
        tagline: result.businessProfile.tagline,
        industry: result.businessProfile.industry,
        keyClaims: result.businessProfile.keyClaims,
        serviceAreas: result.businessProfile.serviceAreas,
      };
    }
    
    // Contact Summary - take first non-null contact
    if (!seeding.contactSummary && result.contact) {
      seeding.contactSummary = {
        primaryPhone: result.contact.phones[0] || null,
        primaryEmail: result.contact.emails[0] || null,
        address: result.contact.addresses[0]?.fullAddress || null,
        socialProfiles: result.contact.socialLinks.map(s => s.platform),
      };
    }
    
    // Trust Summary - aggregate testimonials
    seeding.trustSummary.testimonialCount += result.testimonials.length;
    if (!seeding.trustSummary.topQuote && result.testimonials.length > 0) {
      const best = result.testimonials.find(t => t.rating && t.rating >= 4) || result.testimonials[0];
      seeding.trustSummary.topQuote = best.quote;
    }
    
    // Aggregate trust signals
    for (const signal of result.trustSignals) {
      if (!seeding.trustSummary.trustBadges.includes(signal.name)) {
        seeding.trustSummary.trustBadges.push(signal.name);
      }
    }
    
    // Count FAQs and team members
    seeding.faqCount += result.faqs.length;
    seeding.teamMemberCount += result.teamMembers.length;
  }
  
  return seeding;
}

/**
 * Build AI context string from seeding result
 * This is used to enrich the AI's knowledge about the business for chat
 */
export function buildAIContextFromSeeding(seeding: SeedingResult): string {
  const parts: string[] = [];
  
  if (seeding.businessIdentity) {
    parts.push(`Business: ${seeding.businessIdentity.name}`);
    if (seeding.businessIdentity.tagline) {
      parts.push(`Tagline: ${seeding.businessIdentity.tagline}`);
    }
    if (seeding.businessIdentity.industry) {
      parts.push(`Industry: ${seeding.businessIdentity.industry}`);
    }
    if (seeding.businessIdentity.keyClaims.length > 0) {
      parts.push(`Key claims: ${seeding.businessIdentity.keyClaims.join(', ')}`);
    }
    if (seeding.businessIdentity.serviceAreas.length > 0) {
      parts.push(`Service areas: ${seeding.businessIdentity.serviceAreas.join(', ')}`);
    }
  }
  
  if (seeding.contactSummary) {
    const contactParts: string[] = [];
    if (seeding.contactSummary.primaryPhone) contactParts.push(`Phone: ${seeding.contactSummary.primaryPhone}`);
    if (seeding.contactSummary.primaryEmail) contactParts.push(`Email: ${seeding.contactSummary.primaryEmail}`);
    if (seeding.contactSummary.address) contactParts.push(`Address: ${seeding.contactSummary.address}`);
    if (contactParts.length > 0) {
      parts.push(`Contact: ${contactParts.join(', ')}`);
    }
  }
  
  if (seeding.trustSummary.testimonialCount > 0) {
    parts.push(`Customer reviews: ${seeding.trustSummary.testimonialCount} testimonials`);
    if (seeding.trustSummary.topQuote) {
      parts.push(`Featured review: "${seeding.trustSummary.topQuote.substring(0, 150)}..."`);
    }
  }
  
  if (seeding.faqCount > 0) {
    parts.push(`FAQ entries: ${seeding.faqCount}`);
  }
  
  if (seeding.teamMemberCount > 0) {
    parts.push(`Team size: ${seeding.teamMemberCount} members`);
  }
  
  return parts.join('\n');
}
