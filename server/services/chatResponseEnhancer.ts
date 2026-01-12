/**
 * Chat Response Enhancer
 *
 * Implements intelligent query analysis and response optimization for orbit chat.
 * Provides adaptive temperature, relevance filtering, and confidence scoring.
 */

export type QueryType = 'factual' | 'creative' | 'comparison' | 'transactional';

export interface QueryAnalysis {
  type: QueryType;
  temperature: number;
  intent: string;
  entities: string[];
  confidence: number;
}

export interface DocumentScore {
  doc: any;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface ResponseMetadata {
  confidence: number;
  queryType: QueryType;
  documentsUsed: number;
  hallucination
Detected: boolean;
  temperature: number;
}

/**
 * Detects query type and intent from user message
 */
export function analyzeQuery(message: string, recentHistory: string[] = []): QueryAnalysis {
  const messageLower = message.toLowerCase();

  // Transactional patterns (location, contact, hours)
  const transactionalPatterns = [
    /\b(where|location|address|find you|directions|open|hours|opening|closing|when|contact|email|phone|call|reach)\b/i,
    /\bhow (do|can) i (get|reach|contact|find)\b/i,
  ];

  // Factual patterns (specific information requests)
  const factualPatterns = [
    /\b(how much|price|cost|what is|what are|when|where|who|which|define|explain)\b/i,
    /\b(tell me about|information about|details about|facts about)\b/i,
    /\b(do you have|is there|are there)\b/i,
  ];

  // Creative patterns (recommendations, opinions)
  const creativePatterns = [
    /\b(recommend|suggest|best|top|favorite|popular|should i|what would you|advise|opinion)\b/i,
    /\b(help me (choose|decide|pick))\b/i,
    /\bwhat('s| is) (good|great|better)\b/i,
  ];

  // Comparison patterns
  const comparisonPatterns = [
    /\b(vs|versus|compare|difference|better than|prefer|choice between)\b/i,
    /\bor\b.*\?/i, // "Should I get X or Y?"
  ];

  // Determine query type
  let type: QueryType = 'factual';
  let temperature = 0.5;
  let intent = 'general_inquiry';

  if (transactionalPatterns.some(p => p.test(messageLower))) {
    type = 'transactional';
    temperature = 0.3;
    intent = 'contact_location_hours';
  } else if (comparisonPatterns.some(p => p.test(messageLower))) {
    type = 'comparison';
    temperature = 0.5;
    intent = 'compare_options';
  } else if (creativePatterns.some(p => p.test(messageLower))) {
    type = 'creative';
    temperature = 0.8;
    intent = 'recommendation';
  } else if (factualPatterns.some(p => p.test(messageLower))) {
    type = 'factual';
    temperature = 0.3;
    intent = 'information_request';
  }

  // Extract entities (products, prices, locations, etc.)
  const entities: string[] = [];

  // Price mentions
  const priceMatches = message.match(/£?\d+(\.\d{2})?/g);
  if (priceMatches) entities.push(...priceMatches);

  // Capitalized words (potential product/place names)
  const capitalizedWords = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (capitalizedWords) {
    entities.push(...capitalizedWords.filter(w => w.length > 2));
  }

  // Calculate confidence based on pattern matches and message clarity
  let confidence = 0.7;

  // Higher confidence for clear transactional/factual queries
  if (type === 'transactional' || type === 'factual') {
    confidence = 0.85;
  }

  // Lower confidence for very short or vague messages
  if (message.length < 10) {
    confidence = 0.5;
  }

  // Higher confidence if message contains entities
  if (entities.length > 0) {
    confidence = Math.min(0.95, confidence + 0.1);
  }

  return {
    type,
    temperature,
    intent,
    entities,
    confidence,
  };
}

/**
 * Scores and filters documents by relevance to user query
 * Returns top N most relevant documents
 */
export function filterDocumentsByRelevance(
  message: string,
  documents: any[],
  maxDocuments: number = 3
): DocumentScore[] {
  if (documents.length === 0) return [];

  const messageLower = message.toLowerCase();
  const queryKeywords = extractKeywords(messageLower);

  // Score each document
  const scoredDocs: DocumentScore[] = documents.map(doc => {
    const docText = `${doc.title || ''} ${doc.fileName || ''} ${doc.extractedText || ''}`.toLowerCase();
    const docCategory = (doc.category || '').toLowerCase();

    let score = 0;
    const matchedKeywords: string[] = [];

    // Keyword matching (primary signal)
    for (const keyword of queryKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = docText.match(regex);
      if (matches) {
        score += matches.length * 2;
        matchedKeywords.push(keyword);
      }
    }

    // Category matching (secondary signal)
    if (messageLower.includes('price') || messageLower.includes('cost')) {
      if (docCategory === 'pricing') score += 10;
    }

    if (messageLower.includes('policy') || messageLower.includes('terms') || messageLower.includes('refund')) {
      if (docCategory === 'policies') score += 10;
    }

    if (messageLower.includes('how to') || messageLower.includes('guide') || messageLower.includes('tutorial')) {
      if (docCategory === 'guides') score += 10;
    }

    if (messageLower.includes('faq') || messageLower.includes('question')) {
      if (docCategory === 'faqs') score += 10;
    }

    // Recency bonus for guides (prefer newer content)
    if (doc.uploadedAt) {
      const daysSinceUpload = (Date.now() - new Date(doc.uploadedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpload < 30) score += 2;
    }

    return {
      doc,
      relevanceScore: score,
      matchedKeywords,
    };
  });

  // Sort by relevance and return top N
  return scoredDocs
    .filter(d => d.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxDocuments);
}

/**
 * Extracts meaningful keywords from query for matching
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'you', 'your', 'can', 'do', 'does',
    'i', 'me', 'my', 'we', 'us', 'our', 'what', 'when', 'where', 'how',
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Detects potential hallucination in AI response
 * Checks if response references information not present in context
 */
export function detectHallucination(
  response: string,
  availableContext: {
    productNames: string[];
    documentContent: string;
    hasContactInfo: boolean;
    hasLocationInfo: boolean;
  }
): boolean {
  const responseLower = response.toLowerCase();

  // Check for specific claims that should be verified
  const specificPricePattern = /£\d+\.\d{2}/g;
  const specificTimePattern = /\b\d{1,2}:\d{2}\s*(am|pm)\b/gi;
  const specificAddressPattern = /\b\d+\s+[A-Z][a-z]+\s+(street|road|avenue|lane)\b/i;

  // Flag if response contains specific information that's likely hallucinated
  const hasPrices = specificPricePattern.test(response);
  const hasSpecificTimes = specificTimePattern.test(response);
  const hasSpecificAddress = specificAddressPattern.test(response);

  // Check if these specific claims are supported by context
  if (hasPrices) {
    // If response mentions prices, context should have price data
    const contextHasPrices = /£\d+/.test(availableContext.documentContent) ||
                            availableContext.productNames.some(p => /\d+/.test(p));
    if (!contextHasPrices) return true;
  }

  if (hasSpecificTimes && !hasSpecificTimes) {
    // If response mentions specific hours, should have that info
    const contextHasHours = /\d{1,2}:\d{2}/.test(availableContext.documentContent);
    if (!contextHasHours) return true;
  }

  if (hasSpecificAddress && !availableContext.hasLocationInfo) {
    return true;
  }

  // Check for hedging language (good sign - not hallucinating)
  const hasHedging = /\b(might|may|could|possibly|likely|probably|typically|generally)\b/i.test(response);
  if (hasHedging) return false;

  // Check for absolute statements without supporting context
  const absoluteStatements = [
    /\bwe (always|never|definitely|certainly|guarantee)\b/i,
    /\ball of our .* (are|is)/i,
    /\beveryone (who|that)/i,
  ];

  const hasAbsoluteStatement = absoluteStatements.some(p => p.test(responseLower));
  if (hasAbsoluteStatement && availableContext.documentContent.length < 500) {
    // Absolute claim with limited context is suspicious
    return true;
  }

  return false;
}

/**
 * Calculates confidence score for response quality
 */
export function scoreResponseConfidence(
  query: QueryAnalysis,
  response: string,
  contextAvailable: {
    documentCount: number;
    productCount: number;
    hasRelevantDocs: boolean;
  }
): ResponseMetadata {
  let confidence = query.confidence;

  // Adjust confidence based on available context
  if (query.type === 'factual' || query.type === 'transactional') {
    // These queries need specific info
    if (contextAvailable.hasRelevantDocs) {
      confidence = Math.min(0.95, confidence + 0.15);
    } else if (contextAvailable.productCount === 0 && contextAvailable.documentCount === 0) {
      confidence = Math.max(0.3, confidence - 0.3);
    }
  }

  // Check response length (very short responses are lower confidence)
  if (response.length < 50) {
    confidence = Math.max(0.4, confidence - 0.2);
  }

  // Check for hedge words (indicate uncertainty)
  const hedgePattern = /\b(might|may|could|possibly|not sure|don't know|unclear)\b/i;
  if (hedgePattern.test(response)) {
    confidence = Math.max(0.4, confidence - 0.15);
  }

  // Check for confident language
  const confidentPattern = /\b(yes|definitely|certainly|absolutely|exactly)\b/i;
  if (confidentPattern.test(response)) {
    confidence = Math.min(0.95, confidence + 0.05);
  }

  return {
    confidence: Math.round(confidence * 100) / 100,
    queryType: query.type,
    documentsUsed: contextAvailable.documentCount,
    hallucinationDetected: false, // Set externally by caller
    temperature: query.temperature,
  };
}

/**
 * Summarizes conversation history for better context
 * Condenses older messages while preserving key information
 */
export function summarizeConversation(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxMessages: number = 6
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (history.length <= maxMessages) {
    return history;
  }

  // Keep most recent messages
  const recentMessages = history.slice(-maxMessages);

  // For older messages, extract key topics
  const olderMessages = history.slice(0, -maxMessages);
  const topics = new Set<string>();

  for (const msg of olderMessages) {
    if (msg.role === 'user') {
      const keywords = extractKeywords(msg.content);
      keywords.slice(0, 3).forEach(k => topics.add(k));
    }
  }

  // If there are significant earlier topics, add a summary message
  if (topics.size > 0) {
    const summaryMessage = {
      role: 'assistant' as const,
      content: `[Earlier conversation covered: ${Array.from(topics).slice(0, 5).join(', ')}]`,
    };
    return [summaryMessage, ...recentMessages];
  }

  return recentMessages;
}

/**
 * Filters and enhances system prompt with most relevant documents
 */
export function buildEnhancedDocumentContext(
  message: string,
  documents: any[],
  maxDocuments: number = 3
): string {
  if (documents.length === 0) return '';

  const relevantDocs = filterDocumentsByRelevance(message, documents, maxDocuments);

  if (relevantDocs.length === 0) {
    // No relevant docs found, return brief summary of available docs
    const categories = [...new Set(documents.map(d => d.category || 'other'))];
    return `\n\nAVAILABLE DOCUMENTS: We have ${documents.length} documents covering: ${categories.join(', ')}.\n`;
  }

  // Build focused context with only relevant docs
  const docSections = relevantDocs.map(({ doc, matchedKeywords }) => {
    const text = doc.extractedText?.slice(0, 2000) || '';
    const relevanceNote = matchedKeywords.length > 0
      ? ` (Relevant for: ${matchedKeywords.slice(0, 3).join(', ')})`
      : '';
    return `[${doc.title || doc.fileName}]${relevanceNote}\n${text}`;
  }).join('\n\n');

  return `\n\nRELEVANT DOCUMENTS:\n${docSections}\n`;
}
