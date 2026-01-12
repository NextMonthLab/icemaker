/**
 * Proactive Context Engine (Tier 3)
 *
 * Makes chat "always providing context" by automatically expanding user queries
 * with related information, linking entities, and anticipating information needs.
 */

export interface ExtractedEntity {
  type: 'product' | 'price' | 'date' | 'location' | 'category' | 'person' | 'time';
  value: string;
  confidence: number;
  linkedItem?: any;
}

export interface ContextExpansion {
  relatedProducts: string[];
  relatedTopics: string[];
  anticipatedInfo: Array<{
    type: string;
    content: string;
    reason: string;
  }>;
  missingContext: string[];
}

export interface ConversationCoverage {
  topicsDiscussed: Set<string>;
  productsDiscussed: Set<string>;
  questionsAnswered: Set<string>;
  informationShared: Set<string>;
}

/**
 * Extracts entities (products, prices, dates, etc.) from user message
 */
export function extractEntities(
  message: string,
  availableItems: any[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const messageLower = message.toLowerCase();

  // Extract prices (£X, $X, X pounds, etc.)
  const pricePatterns = [
    /£(\d+(?:\.\d{2})?)/g,
    /\$(\d+(?:\.\d{2})?)/g,
    /(\d+)\s*(?:pounds?|quid|gbp)/gi,
  ];

  for (const pattern of pricePatterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'price',
        value: match[1],
        confidence: 0.95,
      });
    }
  }

  // Extract dates and times
  const datePatterns = [
    /\b(today|tomorrow|yesterday|tonight|this\s+(?:morning|afternoon|evening|weekend))\b/gi,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{2,4})?)\b/gi,
  ];

  for (const pattern of datePatterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'date',
        value: match[1],
        confidence: 0.9,
      });
    }
  }

  const timePatterns = [
    /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/gi,
    /\b(\d{1,2}\s*(?:am|pm))\b/gi,
  ];

  for (const pattern of timePatterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      entities.push({
        type: 'time',
        value: match[1],
        confidence: 0.9,
      });
    }
  }

  // Extract location mentions
  const locationKeywords = ['location', 'address', 'where', 'directions', 'find you', 'near me'];
  if (locationKeywords.some(kw => messageLower.includes(kw))) {
    entities.push({
      type: 'location',
      value: 'location_request',
      confidence: 0.85,
    });
  }

  // Extract product mentions with fuzzy matching
  for (const item of availableItems) {
    const itemNameLower = item.name?.toLowerCase() || '';

    // Exact match
    if (messageLower.includes(itemNameLower)) {
      entities.push({
        type: 'product',
        value: item.name,
        confidence: 0.95,
        linkedItem: item,
      });
      continue;
    }

    // Partial match (for multi-word items)
    const itemWords = itemNameLower.split(/\s+/).filter(w => w.length >= 4);
    const matchedWords = itemWords.filter(word => messageLower.includes(word));

    if (matchedWords.length >= 2 || (itemWords.length === 1 && matchedWords.length === 1)) {
      const confidence = matchedWords.length / Math.max(1, itemWords.length);
      if (confidence >= 0.6) {
        entities.push({
          type: 'product',
          value: item.name,
          confidence: Math.round(confidence * 100) / 100,
          linkedItem: item,
        });
      }
    }

    // Category match
    if (item.category) {
      const categoryLower = item.category.toLowerCase();
      if (messageLower.includes(categoryLower)) {
        entities.push({
          type: 'category',
          value: item.category,
          confidence: 0.8,
          linkedItem: item,
        });
      }
    }
  }

  // Remove duplicate products (keep highest confidence)
  const productEntities = entities.filter(e => e.type === 'product');
  const uniqueProducts = new Map<string, ExtractedEntity>();

  for (const entity of productEntities) {
    const existing = uniqueProducts.get(entity.value);
    if (!existing || entity.confidence > existing.confidence) {
      uniqueProducts.set(entity.value, entity);
    }
  }

  // Rebuild entities list with unique products
  const finalEntities = entities.filter(e => e.type !== 'product');
  finalEntities.push(...Array.from(uniqueProducts.values()));

  return finalEntities;
}

/**
 * Expands context proactively based on entities and intent
 */
export function expandContextProactively(
  entities: ExtractedEntity[],
  intentChain: string,
  availableItems: any[],
  documents: any[]
): ContextExpansion {
  const expansion: ContextExpansion = {
    relatedProducts: [],
    relatedTopics: [],
    anticipatedInfo: [],
    missingContext: [],
  };

  const mentionedProducts = entities.filter(e => e.type === 'product' && e.linkedItem);

  // If user asked about a specific product, proactively include related info
  if (mentionedProducts.length > 0) {
    for (const productEntity of mentionedProducts) {
      const product = productEntity.linkedItem;

      // Add related products from same category
      const relatedInCategory = availableItems
        .filter(item =>
          item.category === product.category &&
          item.name !== product.name
        )
        .slice(0, 3);

      expansion.relatedProducts.push(...relatedInCategory.map(i => i.name));

      // Anticipate pricing questions
      if (product.price != null) {
        expansion.anticipatedInfo.push({
          type: 'pricing',
          content: `${product.name} costs ${product.currency || '£'}${product.price}`,
          reason: 'user_mentioned_product',
        });
      } else {
        expansion.missingContext.push('pricing');
      }

      // Anticipate availability/description
      if (product.description) {
        expansion.anticipatedInfo.push({
          type: 'description',
          content: product.description.slice(0, 200),
          reason: 'user_mentioned_product',
        });
      }

      // Add category as related topic
      if (product.category && !expansion.relatedTopics.includes(product.category)) {
        expansion.relatedTopics.push(product.category);
      }
    }
  }

  // If user asked about pricing, anticipate booking/contact info
  const hasPriceEntity = entities.some(e => e.type === 'price');
  const askedAboutPrice = intentChain === 'purchase_consideration';

  if (hasPriceEntity || askedAboutPrice) {
    expansion.anticipatedInfo.push({
      type: 'next_steps',
      content: 'how to book or order',
      reason: 'pricing_interest',
    });

    expansion.relatedTopics.push('booking', 'ordering');
  }

  // If user asked about time/date, anticipate location/contact
  const hasTimeEntity = entities.some(e => e.type === 'time' || e.type === 'date');
  if (hasTimeEntity) {
    expansion.anticipatedInfo.push({
      type: 'location',
      content: 'location and contact details',
      reason: 'time_based_query',
    });

    expansion.relatedTopics.push('location', 'hours', 'contact');
  }

  // If user asked about location, anticipate hours and contact
  const hasLocationEntity = entities.some(e => e.type === 'location');
  if (hasLocationEntity) {
    expansion.anticipatedInfo.push({
      type: 'hours',
      content: 'opening hours',
      reason: 'location_query',
    });

    expansion.anticipatedInfo.push({
      type: 'contact',
      content: 'contact information',
      reason: 'location_query',
    });
  }

  // If transactional intent, anticipate ALL key details
  if (intentChain === 'transactional_action') {
    if (!hasLocationEntity) expansion.missingContext.push('location');
    if (!hasTimeEntity) expansion.missingContext.push('hours');
    expansion.missingContext.push('contact_details');

    expansion.anticipatedInfo.push({
      type: 'complete_booking_info',
      content: 'all details needed to complete action',
      reason: 'transactional_intent',
    });
  }

  // Category-based expansion
  const categoryEntities = entities.filter(e => e.type === 'category');
  for (const catEntity of categoryEntities) {
    const itemsInCategory = availableItems.filter(
      item => item.category === catEntity.value
    );

    // Add top 3 items from that category
    expansion.relatedProducts.push(
      ...itemsInCategory.slice(0, 3).map(i => i.name)
    );
  }

  return expansion;
}

/**
 * Tracks what has been discussed to avoid repetition
 */
export function buildConversationCoverage(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): ConversationCoverage {
  const coverage: ConversationCoverage = {
    topicsDiscussed: new Set(),
    productsDiscussed: new Set(),
    questionsAnswered: new Set(),
    informationShared: new Set(),
  };

  // Topic keywords to track
  const topicKeywords: Record<string, string[]> = {
    pricing: ['price', 'cost', '£', '$', 'expensive', 'cheap', 'fee'],
    location: ['location', 'address', 'where', 'find', 'directions'],
    hours: ['hours', 'open', 'close', 'opening', 'closing', 'when'],
    booking: ['book', 'reserve', 'appointment', 'schedule'],
    delivery: ['delivery', 'ship', 'shipping', 'dispatch'],
    menu: ['menu', 'food', 'dish', 'meal'],
    features: ['features', 'include', 'offer', 'provide'],
    quality: ['quality', 'good', 'best', 'premium'],
    availability: ['available', 'stock', 'in stock', 'sold out'],
    payment: ['payment', 'pay', 'credit', 'card', 'invoice'],
  };

  // Scan all messages
  for (const msg of history) {
    const contentLower = msg.content.toLowerCase();

    // Track topics discussed
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => contentLower.includes(kw))) {
        coverage.topicsDiscussed.add(topic);
      }
    }

    // Track questions (messages ending with ?)
    if (msg.role === 'user' && msg.content.includes('?')) {
      const question = msg.content.trim().slice(0, 100);
      coverage.questionsAnswered.add(question);
    }

    // Track information shared by assistant
    if (msg.role === 'assistant') {
      // Extract key information types
      if (/£\d+|price|cost/i.test(contentLower)) {
        coverage.informationShared.add('pricing');
      }
      if (/location|address|find us/i.test(contentLower)) {
        coverage.informationShared.add('location');
      }
      if (/open|close|hours|am|pm/i.test(contentLower)) {
        coverage.informationShared.add('hours');
      }
      if (/book|order|contact|email|phone/i.test(contentLower)) {
        coverage.informationShared.add('booking_info');
      }
    }
  }

  return coverage;
}

/**
 * Generates proactive context injection for system prompt
 */
export function generateProactiveContext(
  entities: ExtractedEntity[],
  expansion: ContextExpansion,
  coverage: ConversationCoverage,
  intentChain: string
): string {
  let proactiveContext = '\n## Proactive Context Guidance:\n';

  // Mention related products without being asked
  if (expansion.relatedProducts.length > 0 && intentChain !== 'support_inquiry') {
    proactiveContext += `\n**Related Items**: ${expansion.relatedProducts.slice(0, 3).join(', ')}\n`;
    proactiveContext += '→ If relevant, naturally mention these alternatives or complementary items\n';
  }

  // Inject anticipated information
  const pricingAnticipated = expansion.anticipatedInfo.some(a => a.type === 'pricing');
  const hasSharedPricing = coverage.informationShared.has('pricing');

  if (pricingAnticipated && !hasSharedPricing) {
    proactiveContext += '\n**Include Pricing**: User asked about a product. Proactively mention the price if available.\n';
  }

  const nextStepsAnticipated = expansion.anticipatedInfo.some(a => a.type === 'next_steps');
  const hasSharedBooking = coverage.informationShared.has('booking_info');

  if (nextStepsAnticipated && !hasSharedBooking && intentChain !== 'information_gathering') {
    proactiveContext += '\n**Suggest Next Steps**: User is interested. Proactively mention how to book/order/contact.\n';
  }

  const locationAnticipated = expansion.anticipatedInfo.some(a => a.type === 'location');
  const hasSharedLocation = coverage.informationShared.has('location');

  if (locationAnticipated && !hasSharedLocation) {
    proactiveContext += '\n**Include Location**: User\'s query implies they might visit. Mention location/directions proactively.\n';
  }

  const hoursAnticipated = expansion.anticipatedInfo.some(a => a.type === 'hours');
  const hasSharedHours = coverage.informationShared.has('hours');

  if (hoursAnticipated && !hasSharedHours) {
    proactiveContext += '\n**Include Hours**: User might visit/call. Mention opening hours proactively.\n';
  }

  // Avoid repetition
  if (coverage.topicsDiscussed.size > 0) {
    const discussedTopics = Array.from(coverage.topicsDiscussed).slice(0, 5).join(', ');
    proactiveContext += `\n**Already Discussed**: ${discussedTopics}\n`;
    proactiveContext += '→ Don\'t repeat this information unless specifically asked again\n';
  }

  // If transactional intent, inject comprehensive info
  if (intentChain === 'transactional_action') {
    const missing = expansion.missingContext.filter(
      ctx => !coverage.informationShared.has(ctx)
    );

    if (missing.length > 0) {
      proactiveContext += '\n**COMPLETE THE ACTION**: User is ready to act. Include:\n';
      proactiveContext += `- ${missing.includes('location') ? 'Location/address' : ''}\n`;
      proactiveContext += `- ${missing.includes('hours') ? 'Opening hours' : ''}\n`;
      proactiveContext += `- ${missing.includes('contact_details') ? 'Contact details (phone/email)' : ''}\n`;
      proactiveContext += '- Clear instructions on what to do next\n';
    }
  }

  // Highlight extracted entities for better context
  const productEntities = entities.filter(e => e.type === 'product' && e.confidence >= 0.7);
  if (productEntities.length > 0) {
    proactiveContext += `\n**Detected Products**: ${productEntities.map(e => e.value).join(', ')}\n`;
    proactiveContext += '→ Focus your response on these specific items\n';
  }

  return proactiveContext;
}

/**
 * Enriches system prompt with proactive context intelligence
 */
export function enrichSystemPromptWithContext(
  basePrompt: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  intentChain: string,
  availableItems: any[],
  documents: any[]
): string {
  // Extract entities from current message
  const entities = extractEntities(message, availableItems);

  // Build conversation coverage
  const coverage = buildConversationCoverage(history);

  // Expand context proactively
  const expansion = expandContextProactively(
    entities,
    intentChain,
    availableItems,
    documents
  );

  // Generate proactive context injection
  const proactiveContext = generateProactiveContext(
    entities,
    expansion,
    coverage,
    intentChain
  );

  // Append to base prompt
  return basePrompt + proactiveContext;
}
