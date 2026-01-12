/**
 * Conversation Intelligence Service
 *
 * Tier 2 chat improvements: Intent chain detection, next-question prediction,
 * and proactive follow-up suggestions to anticipate user needs.
 */

export type IntentChain =
  | 'product_exploration'     // Browsing, learning about offerings
  | 'purchase_consideration'   // Comparing, evaluating specific items
  | 'transactional_action'     // Ready to buy/book/contact
  | 'support_inquiry'          // Has a problem or question
  | 'casual_conversation'      // Just chatting, no clear goal
  | 'information_gathering';   // Researching, fact-finding

export type ConversationStage =
  | 'initial_contact'          // First message
  | 'exploration'              // Learning phase
  | 'deepening'                // Asking detailed questions
  | 'decision'                 // Comparing options, ready to act
  | 'completion'               // Got what they needed
  | 'stuck';                   // Unclear or repetitive questions

export interface ConversationState {
  stage: ConversationStage;
  intentChain: IntentChain;
  userGoal: string;
  mentionedItems: string[];
  topicsDiscussed: string[];
  questionsAsked: number;
  confidenceLevel: number;
  nextQuestionPredictions: string[];
  suggestedFollowUps: Array<{
    question: string;
    reason: string;
    priority: number;
  }>;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Analyzes conversation history to detect intent chain and user goal
 */
export function detectIntentChain(
  currentMessage: string,
  history: Message[],
  queryType: string
): { chain: IntentChain; goal: string; confidence: number } {
  const messageLower = currentMessage.toLowerCase();
  const recentUserMessages = history
    .filter(m => m.role === 'user')
    .slice(-5)
    .map(m => m.content.toLowerCase());

  const allUserText = [messageLower, ...recentUserMessages].join(' ');

  // Strong transactional signals
  const transactionalPatterns = [
    /\b(book|buy|purchase|order|get|sign up|register|subscribe|contact|call|email)\b/i,
    /\bhow (do|can) i (get|buy|order|book|contact|reach)\b/i,
    /\bwhere (can|do) i\b/i,
    /\bi('d| would) like to\b/i,
    /\bi want to\b/i,
  ];

  // Purchase consideration signals
  const considerationPatterns = [
    /\b(compare|vs|versus|difference|better|best|recommend|suggest|which|should i)\b/i,
    /\bwhat('s| is) the (difference|best)\b/i,
    /\b(cheaper|expensive|worth|value|affordable)\b/i,
    /\bpros and cons\b/i,
  ];

  // Product exploration signals
  const explorationPatterns = [
    /\b(tell me about|what is|what are|show me|do you have|available|options)\b/i,
    /\b(services|products|menu|offerings|range)\b/i,
    /\b(types of|kinds of|variety)\b/i,
  ];

  // Support inquiry signals
  const supportPatterns = [
    /\b(problem|issue|help|trouble|not working|broken|wrong|error|refund|return)\b/i,
    /\bhow do i (fix|solve|resolve)\b/i,
    /\bwhy (is|isn't|won't|can't)\b/i,
  ];

  // Information gathering signals
  const informationPatterns = [
    /\b(how does|what does|when does|who|where|why)\b/i,
    /\b(learn|understand|know|information|details)\b/i,
    /\bcan you explain\b/i,
  ];

  let chain: IntentChain = 'casual_conversation';
  let goal = 'Having a general conversation';
  let confidence = 0.6;

  // Determine intent chain based on patterns
  if (transactionalPatterns.some(p => p.test(messageLower))) {
    chain = 'transactional_action';
    goal = 'Ready to take action (buy, book, or contact)';
    confidence = 0.9;
  } else if (considerationPatterns.some(p => p.test(allUserText))) {
    chain = 'purchase_consideration';
    goal = 'Comparing options and evaluating choices';
    confidence = 0.85;

    // If they've been exploring before, confidence increases
    if (recentUserMessages.length >= 2) confidence = 0.92;
  } else if (supportPatterns.some(p => p.test(messageLower))) {
    chain = 'support_inquiry';
    goal = 'Seeking help with an issue or question';
    confidence = 0.88;
  } else if (explorationPatterns.some(p => p.test(messageLower))) {
    chain = 'product_exploration';
    goal = 'Exploring offerings and learning about options';
    confidence = 0.8;
  } else if (informationPatterns.some(p => p.test(messageLower))) {
    chain = 'information_gathering';
    goal = 'Researching and gathering information';
    confidence = 0.75;
  }

  // Adjust confidence based on conversation history
  if (recentUserMessages.length >= 3) {
    // Multi-turn conversation - look for consistency
    const chainConsistency = checkChainConsistency(recentUserMessages, chain);
    confidence = Math.min(0.95, confidence + chainConsistency * 0.1);
  }

  return { chain, goal, confidence };
}

/**
 * Checks if recent messages are consistent with detected intent chain
 */
function checkChainConsistency(recentMessages: string[], currentChain: IntentChain): number {
  let consistencyScore = 0;

  for (const msg of recentMessages) {
    switch (currentChain) {
      case 'product_exploration':
        if (/\b(what|show|tell|have|options|available)\b/i.test(msg)) consistencyScore++;
        break;
      case 'purchase_consideration':
        if (/\b(compare|vs|better|best|recommend|which|should)\b/i.test(msg)) consistencyScore++;
        break;
      case 'transactional_action':
        if (/\b(buy|book|order|contact|get|sign|price)\b/i.test(msg)) consistencyScore++;
        break;
      case 'support_inquiry':
        if (/\b(help|problem|issue|how do i|why|fix)\b/i.test(msg)) consistencyScore++;
        break;
    }
  }

  return consistencyScore / Math.max(1, recentMessages.length);
}

/**
 * Determines conversation stage based on message count and intent evolution
 */
export function detectConversationStage(
  history: Message[],
  intentChain: IntentChain
): ConversationStage {
  const userMessageCount = history.filter(m => m.role === 'user').length;

  if (userMessageCount === 0) {
    return 'initial_contact';
  }

  if (userMessageCount === 1 || userMessageCount === 2) {
    return 'exploration';
  }

  if (intentChain === 'transactional_action') {
    return 'decision';
  }

  if (intentChain === 'purchase_consideration') {
    return 'decision';
  }

  // Check for stuck patterns (repetitive or confused)
  if (userMessageCount >= 4) {
    const recentUserMessages = history
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.content.toLowerCase());

    // Check for repetition
    const uniqueWords = new Set<string>();
    for (const msg of recentUserMessages) {
      const words = msg.split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => uniqueWords.add(w));
    }

    const totalWords = recentUserMessages.join(' ').split(/\s+/).filter(w => w.length > 3).length;
    const repetitionRatio = uniqueWords.size / Math.max(1, totalWords);

    if (repetitionRatio < 0.5) {
      return 'stuck';
    }
  }

  if (userMessageCount >= 5) {
    return 'deepening';
  }

  return 'exploration';
}

/**
 * Extracts items/topics mentioned in conversation
 */
export function extractMentionedItems(
  history: Message[],
  availableItems: string[]
): string[] {
  const allText = history
    .map(m => m.content.toLowerCase())
    .join(' ');

  const mentioned = new Set<string>();

  for (const item of availableItems) {
    const itemLower = item.toLowerCase();
    // Check for exact match or partial match (for multi-word items)
    if (allText.includes(itemLower)) {
      mentioned.add(item);
    } else {
      // Check individual words for partial matches
      const words = itemLower.split(/\s+/);
      if (words.length > 1) {
        const longestWord = words.reduce((a, b) => a.length > b.length ? a : b);
        if (longestWord.length >= 4 && allText.includes(longestWord)) {
          mentioned.add(item);
        }
      }
    }
  }

  return Array.from(mentioned);
}

/**
 * Extracts key topics discussed in conversation
 */
export function extractTopicsDiscussed(history: Message[]): string[] {
  const topics = new Set<string>();

  const topicKeywords: Record<string, string[]> = {
    'pricing': ['price', 'cost', 'expensive', 'cheap', 'affordable', 'fee', 'rate'],
    'location': ['where', 'location', 'address', 'directions', 'find you'],
    'hours': ['hours', 'open', 'close', 'when', 'time', 'schedule'],
    'delivery': ['delivery', 'ship', 'shipping', 'dispatch', 'send'],
    'quality': ['quality', 'good', 'best', 'top', 'premium', 'excellent'],
    'comparison': ['compare', 'vs', 'versus', 'difference', 'better'],
    'features': ['features', 'includes', 'has', 'offers', 'provides'],
    'support': ['help', 'support', 'problem', 'issue', 'question'],
    'booking': ['book', 'reserve', 'appointment', 'schedule', 'availability'],
    'payment': ['pay', 'payment', 'credit', 'card', 'invoice', 'billing'],
  };

  const allText = history
    .map(m => m.content.toLowerCase())
    .join(' ');

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => allText.includes(kw))) {
      topics.add(topic);
    }
  }

  return Array.from(topics);
}

/**
 * Predicts what the user might ask next based on intent chain and conversation state
 */
export function predictNextQuestions(
  intentChain: IntentChain,
  stage: ConversationStage,
  mentionedItems: string[],
  topicsDiscussed: string[],
  businessType: string
): string[] {
  const predictions: string[] = [];

  // Based on intent chain
  switch (intentChain) {
    case 'product_exploration':
      if (stage === 'exploration' || stage === 'initial_contact') {
        predictions.push('What are your most popular items?');
        predictions.push('Do you have any special offers?');
        if (!topicsDiscussed.includes('pricing')) {
          predictions.push('What are your prices?');
        }
      } else if (stage === 'deepening') {
        predictions.push('Can you tell me more about specific features?');
        if (!topicsDiscussed.includes('comparison')) {
          predictions.push('How do these compare?');
        }
      }
      break;

    case 'purchase_consideration':
      if (!topicsDiscussed.includes('pricing')) {
        predictions.push('How much does this cost?');
      }
      if (!topicsDiscussed.includes('delivery')) {
        predictions.push('How quickly can I get this?');
      }
      if (!topicsDiscussed.includes('quality')) {
        predictions.push('What makes this a good choice?');
      }
      if (mentionedItems.length >= 2) {
        predictions.push('What's the difference between these options?');
      }
      break;

    case 'transactional_action':
      if (!topicsDiscussed.includes('location')) {
        predictions.push('Where are you located?');
      }
      if (!topicsDiscussed.includes('hours')) {
        predictions.push('What are your opening hours?');
      }
      if (!topicsDiscussed.includes('booking')) {
        predictions.push('How do I book or order?');
      }
      if (!topicsDiscussed.includes('payment')) {
        predictions.push('What payment methods do you accept?');
      }
      break;

    case 'support_inquiry':
      predictions.push('Can you help me with this?');
      predictions.push('Who can I contact for support?');
      if (!topicsDiscussed.includes('hours')) {
        predictions.push('When is support available?');
      }
      break;

    case 'information_gathering':
      if (businessType === 'restaurant') {
        predictions.push('Do you have dietary options?');
        predictions.push('Can I see the full menu?');
      } else if (businessType === 'recruitment') {
        predictions.push('What qualifications are needed?');
        predictions.push('How do I apply?');
      } else {
        predictions.push('Tell me more about your services');
        predictions.push('Do you have case studies or examples?');
      }
      break;
  }

  // If user is stuck, offer reset/clarification
  if (stage === 'stuck') {
    predictions.unshift('Can you help me find what I need?');
    predictions.unshift('Let me rephrase my question');
  }

  return predictions.slice(0, 4); // Limit to top 4 predictions
}

/**
 * Generates smart follow-up suggestions based on conversation context
 */
export function generateFollowUpSuggestions(
  currentResponse: string,
  intentChain: IntentChain,
  stage: ConversationStage,
  mentionedItems: string[],
  topicsDiscussed: string[]
): Array<{ question: string; reason: string; priority: number }> {
  const suggestions: Array<{ question: string; reason: string; priority: number }> = [];

  // High priority: Natural next steps based on intent
  if (intentChain === 'product_exploration' && stage === 'exploration') {
    if (mentionedItems.length > 0) {
      suggestions.push({
        question: `Tell me more about ${mentionedItems[0]}`,
        reason: 'natural_progression',
        priority: 90,
      });
    }

    if (!topicsDiscussed.includes('pricing')) {
      suggestions.push({
        question: 'What are your prices?',
        reason: 'common_next_question',
        priority: 85,
      });
    }
  }

  // Moving from exploration to consideration
  if (intentChain === 'product_exploration' && stage === 'deepening' && mentionedItems.length >= 2) {
    suggestions.push({
      question: `Compare ${mentionedItems[0]} and ${mentionedItems[1]}`,
      reason: 'intent_progression',
      priority: 95,
    });
  }

  // Moving from consideration to action
  if (intentChain === 'purchase_consideration' && stage === 'decision') {
    suggestions.push({
      question: 'How do I order this?',
      reason: 'intent_progression',
      priority: 95,
    });

    if (!topicsDiscussed.includes('location')) {
      suggestions.push({
        question: 'Where are you located?',
        reason: 'transactional_readiness',
        priority: 90,
      });
    }
  }

  // If discussing pricing, suggest booking/contact
  if (topicsDiscussed.includes('pricing') && !topicsDiscussed.includes('booking')) {
    suggestions.push({
      question: 'How do I book or get in touch?',
      reason: 'natural_progression',
      priority: 88,
    });
  }

  // If stuck, suggest alternatives
  if (stage === 'stuck') {
    suggestions.push({
      question: 'Show me your most popular options',
      reason: 'unstuck_user',
      priority: 100,
    });
  }

  // Sort by priority and return top 3
  return suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

/**
 * Builds complete conversation state
 */
export function buildConversationState(
  currentMessage: string,
  history: Message[],
  queryType: string,
  availableItems: string[],
  businessType: string
): ConversationState {
  const { chain, goal, confidence } = detectIntentChain(currentMessage, history, queryType);
  const stage = detectConversationStage(history, chain);
  const mentionedItems = extractMentionedItems(history, availableItems);
  const topicsDiscussed = extractTopicsDiscussed(history);
  const nextQuestionPredictions = predictNextQuestions(
    chain,
    stage,
    mentionedItems,
    topicsDiscussed,
    businessType
  );
  const suggestedFollowUps = generateFollowUpSuggestions(
    '', // Will be filled after response generation
    chain,
    stage,
    mentionedItems,
    topicsDiscussed
  );

  return {
    stage,
    intentChain: chain,
    userGoal: goal,
    mentionedItems,
    topicsDiscussed,
    questionsAsked: history.filter(m => m.role === 'user').length,
    confidenceLevel: confidence,
    nextQuestionPredictions,
    suggestedFollowUps,
  };
}
