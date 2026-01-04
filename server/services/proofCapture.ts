import OpenAI from "openai";
import type { SocialProofTopic } from "@shared/schema";

const openai = new OpenAI();

// Keyword lists for quick rule-based filtering
const PRAISE_KEYWORDS = [
  "amazing", "fantastic", "excellent", "wonderful", "brilliant", "outstanding",
  "incredible", "superb", "perfect", "love", "loved", "loving", "great",
  "best", "awesome", "impressed", "impressed", "exceptional", "remarkable",
  "thank you so much", "thanks so much", "really appreciate", "highly recommend",
  "would recommend", "definitely recommend", "can't recommend enough",
  "exceeded expectations", "beyond expectations", "blown away", "delighted"
];

const COMPLAINT_KEYWORDS = [
  "refund", "not happy", "disappointed", "complain", "complaint", "late", 
  "damaged", "cancel", "cancelled", "broken", "wrong", "terrible", "awful",
  "horrible", "disgusting", "worst", "never again", "waste of money",
  "rip off", "scam", "fraud", "useless", "unacceptable"
];

const LEGAL_SENSITIVE_KEYWORDS = [
  "lawsuit", "lawyer", "solicitor", "gdpr", "legal", "sue", "court",
  "trading standards", "ombudsman", "compensation"
];

const PROFANITY_KEYWORDS = [
  "fuck", "shit", "damn", "ass", "bastard", "bitch"
];

// Topic question templates based on spec
const TOPIC_QUESTIONS: Record<SocialProofTopic, string[]> = {
  service: [
    "That means a lot, thank you. What was the main thing we did that made the service feel so good?"
  ],
  delivery: [
    "Love to hear that. Was it the speed, the updates, or the packaging that stood out most?"
  ],
  quality: [
    "Amazing. What do you like most about the product - the feel, fit, durability, or design?"
  ],
  product: [
    "Amazing. What do you like most about it - the quality, features, or how easy it is to use?"
  ],
  value: [
    "Brilliant. What made it feel like good value to you?"
  ],
  staff: [
    "Thank you. Was there anyone in particular who helped, or was it the overall experience?"
  ],
  other: [
    "If you had to describe us in one sentence to a friend, what would you say?"
  ]
};

// Clarifier questions for low-specificity responses
const CLARIFIER_QUESTIONS = [
  "Was there a specific moment that made you think that?",
  "What were you unsure about beforehand, and did we change your mind?"
];

// Consent request template
const CONSENT_REQUEST = `Would you be happy for us to use your comment as a testimonial in our marketing? You can choose first name + town, or anonymous.`;

const CONSENT_OPTIONS = [
  "Yes - name + town",
  "Yes - anonymous",
  "No thanks"
];

// Attribution follow-up
const ATTRIBUTION_FOLLOWUP = "Great - what first name and town should we use?";
const ANONYMOUS_CONFIRMATION = "Perfect - we'll keep it anonymous.";
const DECLINED_RESPONSE = "No worries at all - thanks again.";

export interface TestimonialClassification {
  isTestimonialWorthy: boolean;
  confidence: number;
  sentimentScore: number; // -1 to 1
  topic: SocialProofTopic;
  specificityScore: number; // 0 to 1
  riskFlags: string[];
  praiseKeywordsFound: string[];
}

export interface ProofCaptureFlowState {
  stage: 'idle' | 'context_question' | 'clarifier' | 'consent_request' | 'attribution' | 'complete';
  topic: SocialProofTopic;
  rawQuote: string;
  clarifierAsked: boolean;
  consentGranted: boolean | null;
  consentType: 'name_town' | 'anonymous' | null;
  attributionName?: string;
  attributionTown?: string;
}

/**
 * Quick rule-based pre-filter to avoid unnecessary AI calls
 */
function quickPreFilter(message: string): { 
  hasPraise: boolean; 
  hasRisk: boolean; 
  riskFlags: string[];
  praiseKeywords: string[];
} {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/);
  
  const praiseKeywords: string[] = [];
  const riskFlags: string[] = [];
  
  // Check for praise keywords
  for (const keyword of PRAISE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      praiseKeywords.push(keyword);
    }
  }
  
  // Check for complaint keywords
  for (const keyword of COMPLAINT_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      riskFlags.push(`complaint:${keyword}`);
    }
  }
  
  // Check for legal/sensitive keywords
  for (const keyword of LEGAL_SENSITIVE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      riskFlags.push(`legal:${keyword}`);
    }
  }
  
  // Check for profanity
  for (const keyword of PROFANITY_KEYWORDS) {
    if (words.some(word => word.includes(keyword))) {
      riskFlags.push(`profanity:${keyword}`);
    }
  }
  
  return {
    hasPraise: praiseKeywords.length > 0,
    hasRisk: riskFlags.length > 0,
    riskFlags,
    praiseKeywords
  };
}

/**
 * Classify a message to determine if it's testimonial-worthy
 */
export async function classifyTestimonialMoment(
  customerMessage: string,
  recentContext: string[] = []
): Promise<TestimonialClassification> {
  // Quick pre-filter
  const preFilter = quickPreFilter(customerMessage);
  
  // Immediate block if risk flags present
  if (preFilter.hasRisk) {
    return {
      isTestimonialWorthy: false,
      confidence: 0.95,
      sentimentScore: -0.5,
      topic: 'other',
      specificityScore: 0,
      riskFlags: preFilter.riskFlags,
      praiseKeywordsFound: preFilter.praiseKeywords
    };
  }
  
  const wordCount = customerMessage.trim().split(/\s+/).length;
  
  // Strong praise keywords that indicate genuine testimonial intent even in short messages
  const STRONG_PRAISE_KEYWORDS = ['love', 'great', 'amazing', 'fantastic', 'incredible', 'best', 'excellent', 'perfect', 'wonderful', 'brilliant', 'outstanding', 'awesome'];
  const hasStrongPraise = preFilter.praiseKeywords.some(pk => 
    STRONG_PRAISE_KEYWORDS.some(sp => pk.toLowerCase().includes(sp))
  );
  
  // Skip if message is too short AND doesn't have strong praise keywords
  // Allow short messages with strong praise (e.g., "I love KFC", "KFC is amazing")
  if (wordCount < 6 && !hasStrongPraise) {
    return {
      isTestimonialWorthy: false,
      confidence: 0.9,
      sentimentScore: 0,
      topic: 'other',
      specificityScore: 0,
      riskFlags: ['too_short'],
      praiseKeywordsFound: preFilter.praiseKeywords
    };
  }
  
  // If no praise keywords and message is short-ish, skip AI call
  if (!preFilter.hasPraise && wordCount < 15) {
    return {
      isTestimonialWorthy: false,
      confidence: 0.7,
      sentimentScore: 0,
      topic: 'other',
      specificityScore: 0,
      riskFlags: [],
      praiseKeywordsFound: []
    };
  }
  
  // For short messages with strong praise, we can fast-path to testimonial-worthy
  // without AI call since the intent is clear
  if (wordCount <= 6 && hasStrongPraise && preFilter.praiseKeywords.length > 0) {
    return {
      isTestimonialWorthy: true,
      confidence: 0.8,
      sentimentScore: 0.9,
      topic: 'other',
      specificityScore: 0.3,
      riskFlags: [],
      praiseKeywordsFound: preFilter.praiseKeywords
    };
  }
  
  // Use AI for deeper analysis
  try {
    const contextStr = recentContext.length > 0 
      ? `Recent conversation context:\n${recentContext.slice(-5).join('\n')}\n\n` 
      : '';
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are analyzing customer messages to identify genuine praise that could be used as testimonials.

Analyze the message and return a JSON object with:
- isTestimonialWorthy: boolean (true only if strongly positive, specific, and authentic)
- sentimentScore: number from -1 (negative) to 1 (positive)
- topic: one of "service", "delivery", "quality", "value", "staff", "product", "other"
- specificityScore: number from 0 to 1 (how specific/detailed the praise is)
- riskFlags: array of any detected issues (sarcasm, backhanded compliment, complaint mixed in)
- confidence: number from 0 to 1

Be conservative - only mark as testimonial-worthy if the message expresses genuine, specific praise.
Watch for sarcasm, mixed sentiment, or complaints disguised as praise.`
        },
        {
          role: "user",
          content: `${contextStr}Customer message to analyze:\n"${customerMessage}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      isTestimonialWorthy: result.isTestimonialWorthy === true && (result.confidence || 0) >= 0.75,
      confidence: result.confidence || 0.5,
      sentimentScore: result.sentimentScore || 0,
      topic: result.topic || 'other',
      specificityScore: result.specificityScore || 0,
      riskFlags: result.riskFlags || [],
      praiseKeywordsFound: preFilter.praiseKeywords
    };
  } catch (error) {
    console.error('[ProofCapture] Classification error:', error);
    // Fall back to rule-based
    return {
      isTestimonialWorthy: preFilter.hasPraise && !preFilter.hasRisk && wordCount >= 10,
      confidence: 0.5,
      sentimentScore: preFilter.hasPraise ? 0.7 : 0,
      topic: 'other',
      specificityScore: 0.3,
      riskFlags: [],
      praiseKeywordsFound: preFilter.praiseKeywords
    };
  }
}

/**
 * Get the context question for a given topic
 */
export function getContextQuestion(topic: SocialProofTopic): string {
  const questions = TOPIC_QUESTIONS[topic] || TOPIC_QUESTIONS.other;
  return questions[0];
}

/**
 * Get a clarifier question
 */
export function getClarifierQuestion(): string {
  return CLARIFIER_QUESTIONS[Math.floor(Math.random() * CLARIFIER_QUESTIONS.length)];
}

/**
 * Get the consent request message
 */
export function getConsentRequest(): { message: string; options: string[] } {
  return {
    message: CONSENT_REQUEST,
    options: CONSENT_OPTIONS
  };
}

/**
 * Get follow-up based on consent response
 */
export function getConsentFollowup(consentType: 'name_town' | 'anonymous' | 'declined'): string {
  switch (consentType) {
    case 'name_town':
      return ATTRIBUTION_FOLLOWUP;
    case 'anonymous':
      return ANONYMOUS_CONFIRMATION;
    case 'declined':
      return DECLINED_RESPONSE;
  }
}

/**
 * Parse consent response from user message
 */
export function parseConsentResponse(message: string): 'name_town' | 'anonymous' | 'declined' | null {
  const lower = message.toLowerCase();
  
  if (lower.includes('name') && lower.includes('town')) {
    return 'name_town';
  }
  if (lower.includes('anonymous') || (lower.includes('yes') && !lower.includes('town'))) {
    return 'anonymous';
  }
  if (lower.includes('no') || lower.includes('decline') || lower.includes("don't") || lower.includes("rather not")) {
    return 'declined';
  }
  
  return null;
}

/**
 * Clean and enhance a raw quote for display
 */
export async function cleanAndGenerateVariants(rawQuote: string): Promise<{
  cleanQuote: string;
  variants: {
    short: string;   // <= 90 chars
    medium: string;  // <= 220 chars
    long: string;    // <= 500 chars
  };
  recommendedPlacements: ('homepage' | 'product_page' | 'checkout_reassurance' | 'case_study')[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are cleaning customer testimonials for marketing use.

Given a raw customer quote, produce:
1. cleanQuote: Remove filler words (um, uh, like) but preserve authentic voice. Don't change meaning.
2. variants:
   - short: A punchy version under 90 characters for overlays/social
   - medium: A balanced version under 220 characters for website blocks
   - long: A fuller version under 500 characters for case studies
3. recommendedPlacements: Array of where this testimonial fits best from: "homepage", "product_page", "checkout_reassurance", "case_study"

Rules:
- Never exaggerate or add claims not in the original
- Never invent details
- Preserve the customer's authentic voice
- Keep the emotional impact

Return a JSON object with these fields.`
        },
        {
          role: "user",
          content: `Raw customer quote:\n"${rawQuote}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      cleanQuote: result.cleanQuote || rawQuote,
      variants: {
        short: (result.variants?.short || rawQuote).substring(0, 90),
        medium: (result.variants?.medium || rawQuote).substring(0, 220),
        long: (result.variants?.long || rawQuote).substring(0, 500)
      },
      recommendedPlacements: result.recommendedPlacements || ['homepage']
    };
  } catch (error) {
    console.error('[ProofCapture] Quote cleaning error:', error);
    // Fallback: simple truncation
    return {
      cleanQuote: rawQuote,
      variants: {
        short: rawQuote.substring(0, 90),
        medium: rawQuote.substring(0, 220),
        long: rawQuote.substring(0, 500)
      },
      recommendedPlacements: ['homepage']
    };
  }
}

/**
 * Check if proof capture should trigger for this conversation
 */
export function shouldTriggerProofCapture(
  proofCaptureEnabled: boolean,
  proofCaptureTriggeredAt: Date | null,
  classification: TestimonialClassification
): { shouldTrigger: boolean; reason: string; showSuggestionChip: boolean } {
  // Feature disabled
  if (!proofCaptureEnabled) {
    return { shouldTrigger: false, reason: 'feature_disabled', showSuggestionChip: false };
  }
  
  // Already triggered in this conversation
  if (proofCaptureTriggeredAt) {
    return { shouldTrigger: false, reason: 'already_triggered', showSuggestionChip: false };
  }
  
  // Has risk flags
  if (classification.riskFlags.length > 0) {
    return { shouldTrigger: false, reason: 'risk_flags_present', showSuggestionChip: false };
  }
  
  // Not testimonial worthy
  if (!classification.isTestimonialWorthy) {
    // Show suggestion chip if confidence is in the middle range
    if (classification.confidence >= 0.55 && classification.confidence < 0.75 && classification.sentimentScore > 0.3) {
      return { shouldTrigger: false, reason: 'low_confidence', showSuggestionChip: true };
    }
    return { shouldTrigger: false, reason: 'not_testimonial_worthy', showSuggestionChip: false };
  }
  
  // High confidence - auto trigger
  if (classification.confidence >= 0.75) {
    return { shouldTrigger: true, reason: 'high_confidence_praise', showSuggestionChip: false };
  }
  
  return { shouldTrigger: false, reason: 'confidence_too_low', showSuggestionChip: false };
}
