import OpenAI from "openai";
import type { SocialProofTopic } from "@shared/schema";

const openai = new OpenAI();

// Keyword lists for quick rule-based filtering
// Note: "like" is handled separately via PRAISE_PATTERNS to avoid false positives
// (e.g., "What's it like?" should not trigger testimonial capture)
const PRAISE_KEYWORDS = [
  "amazing", "fantastic", "excellent", "wonderful", "brilliant", "outstanding",
  "incredible", "superb", "perfect", "love", "loved", "loving", "great",
  "enjoy", "enjoyed", "enjoying",
  "best", "awesome", "impressed", "exceptional", "remarkable",
  "thank you so much", "thanks so much", "really appreciate", "highly recommend",
  "would recommend", "definitely recommend", "can't recommend enough",
  "exceeded expectations", "beyond expectations", "blown away", "delighted"
];

// Patterns that indicate genuine praise (for words like "like" that are ambiguous)
const PRAISE_PATTERNS = [
  /\bi (really |truly |absolutely )?(like|liked)\b/i,           // "I like", "I really like"
  /\bwe (really |truly |absolutely )?(like|liked)\b/i,          // "We like", "We really like"  
  /\b(really |truly |absolutely )?liked (it|this|them|the|your)\b/i, // "liked it", "really liked the..."
  /\b(really |truly |absolutely )?like (it|this|them|the|your)\b/i,  // "like it", "really like the..."
  /\bi('m| am) (so |very |really )?(happy|pleased|satisfied)\b/i,    // "I'm so happy"
  /\bthis is (so |really |very )?(good|great|amazing)\b/i,           // "This is so good"
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

// Topic question templates - conversational, drawing out detail
const TOPIC_QUESTIONS: Record<SocialProofTopic, string[]> = {
  service: [
    "That's really kind of you to say! I'd love to know more about your experience - what was the main thing that stood out for you?",
    "Thank you! Tell me more about what made the service feel so good?",
  ],
  delivery: [
    "That's great to hear! What was it about the delivery that impressed you most?",
    "Thank you! I'd love to know more - was it the speed, the updates, or something else?",
  ],
  quality: [
    "That's wonderful feedback! What is it about the quality that you love most?",
    "Thank you! Tell me more about what stands out to you?",
  ],
  product: [
    "That's lovely to hear! What is it about us that you love? I'd love to know more.",
    "Thank you! Tell me what makes it special for you?",
  ],
  value: [
    "That's great feedback! What made it feel like such good value to you?",
    "Thank you! I'd love to hear what impressed you most about the value.",
  ],
  staff: [
    "That's wonderful! Was there someone in particular who made your experience great, or was it the overall team?",
    "Thank you! Tell me more about what made the experience so good.",
  ],
  other: [
    "That's really kind! I'd love to know more about your experience - what was the highlight for you?",
    "Thank you! If you were telling a friend about us, what would you say?",
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
  initialPraise: string;       // The first praise message that triggered the flow
  expandedQuote: string | null; // The detailed response after context question
  rawQuote: string;            // Combined quote for final testimonial
  clarifierAsked: boolean;
  consentGranted: boolean | null;
  consentType: 'name_town' | 'anonymous' | null;
  attributionName?: string;
  attributionTown?: string;
}

/**
 * Determine if a message is a detailed expansion of praise (for the second step)
 */
export async function isDetailedPraiseResponse(
  message: string,
  previousContext: string[]
): Promise<{ isExpansion: boolean; hasDetail: boolean; combinedQuote: string }> {
  const wordCount = message.trim().split(/\s+/).length;
  
  // Too short to be meaningful expansion
  if (wordCount < 4) {
    return { isExpansion: false, hasDetail: false, combinedQuote: '' };
  }
  
  // Check for detail indicators
  const detailIndicators = [
    /\bbecause\b/i,
    /\bthe way\b/i,
    /\bwhat I (loved|liked|appreciated)/i,
    /\bthe (staff|service|food|quality|price|value)/i,
    /\bthey (were|are|made|did)/i,
    /\bit('s| is| was)\b/i,
    /\bspecifically\b/i,
    /\bespecially\b/i,
    /\bthe best (part|thing)\b/i,
  ];
  
  const hasDetailIndicator = detailIndicators.some(p => p.test(message));
  
  // If message has detail indicators and is reasonably long, it's a good expansion
  if (hasDetailIndicator && wordCount >= 6) {
    const lastPraise = previousContext.length > 0 ? previousContext[previousContext.length - 1] : '';
    return {
      isExpansion: true,
      hasDetail: true,
      combinedQuote: lastPraise ? `${lastPraise} - ${message}` : message
    };
  }
  
  // For longer messages, use AI to check
  if (wordCount >= 10) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze if this message is providing specific, detailed feedback about a business/service.
Return JSON with:
- isDetailedFeedback: boolean (true if specific reasons/details given)
- summaryQuote: string (a clean, quotable version of their feedback)

Examples of detailed feedback:
- "The staff were so friendly and really took the time to explain everything"
- "I loved how fast delivery was, arrived next day in perfect packaging"
- "The quality is amazing, especially the stitching and material"

Examples of NOT detailed (too vague):
- "It's just great"
- "Everything"
- "Yes definitely"`
          },
          {
            role: "user",
            content: `Previous context: ${previousContext.slice(-2).join(' | ')}\n\nCurrent message: "${message}"`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 150
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isExpansion: result.isDetailedFeedback === true,
        hasDetail: result.isDetailedFeedback === true,
        combinedQuote: result.summaryQuote || message
      };
    } catch (error) {
      console.error('[ProofCapture] Detail check error:', error);
    }
  }
  
  return { isExpansion: false, hasDetail: false, combinedQuote: message };
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
  
  // Check for praise keywords (unambiguous positive words)
  for (const keyword of PRAISE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      praiseKeywords.push(keyword);
    }
  }
  
  // Check for praise patterns (handles ambiguous words like "like" in context)
  for (const pattern of PRAISE_PATTERNS) {
    if (pattern.test(message)) {
      const match = message.match(pattern);
      if (match) {
        praiseKeywords.push(match[0]);
      }
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
  // Note: "like" is excluded as it requires context (handled via PRAISE_PATTERNS)
  const STRONG_PRAISE_KEYWORDS = ['love', 'enjoy', 'great', 'amazing', 'fantastic', 'incredible', 'best', 'excellent', 'perfect', 'wonderful', 'brilliant', 'outstanding', 'awesome'];
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
