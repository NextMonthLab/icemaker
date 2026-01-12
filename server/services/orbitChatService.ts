import OpenAI from 'openai';
import type { IStorage } from '../storage';

export interface OrbitChatContext {
  slug: string;
  brandName: string;
  sourceDomain: string;
  siteSummary?: string;
  keyServices?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProofCaptureConfig {
  enabled: boolean;
  triggeredAt: Date | null;
  history: ChatMessage[];
}

export interface ChatResult {
  response: string;
  proofCaptureFlow?: any;
  suggestionChip?: { text: string; action: string };
  praiseDetected?: string[];
}

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  products: 'Products & Services Info',
  pricing: 'Pricing Information',
  policies: 'Policies & Terms',
  guides: 'How-to Guides',
  faqs: 'FAQs',
  company: 'Company Information',
  other: 'Additional Information',
};

export async function buildOrbitContext(
  storage: IStorage,
  slug: string
): Promise<{
  productContext: string;
  documentContext: string;
  heroPostContext: string;
  videoContext: string;
  videos: { id: number; title: string; tags: string[]; topics: string[]; youtubeVideoId: string; thumbnailUrl: string | null; description: string | null }[];
  businessType: 'recruitment' | 'restaurant' | 'professional_services' | 'retail' | 'general';
  businessTypeLabel: string;
  offeringsLabel: string;
  items: any[];
}> {
  const boxes = await storage.getOrbitBoxes(slug);
  const documents = await storage.getOrbitDocuments(slug);
  const readyDocs = documents.filter(d => d.status === 'ready' && d.extractedText);
  
  // Get hero posts marked as knowledge sources
  const heroPostsAsKnowledge = await storage.getHeroPostsAsKnowledge(slug);
  
  // Get enabled videos for chat suggestions
  const enabledVideos = await storage.getOrbitVideos(slug, true);
  
  const items = boxes.slice(0, 60).map(b => ({
    name: b.title,
    description: b.description,
    price: b.price,
    category: b.category,
    boxType: b.boxType,
  }));

  let documentContext = '';
  if (readyDocs.length > 0) {
    const docsByCategory: Record<string, typeof readyDocs> = {};
    for (const doc of readyDocs) {
      const cat = doc.category || 'other';
      if (!docsByCategory[cat]) docsByCategory[cat] = [];
      docsByCategory[cat].push(doc);
    }
    
    const docSections: string[] = [];
    for (const [category, docs] of Object.entries(docsByCategory)) {
      const label = DOCUMENT_CATEGORY_LABELS[category] || 'Additional Information';
      const docsContent = docs.map(d => {
        const text = d.extractedText?.slice(0, 3000) || '';
        return `[${d.title || d.fileName}]\n${text}`;
      }).join('\n\n');
      
      docSections.push(`### ${label}:\n${docsContent}`);
    }
    
    documentContext = `\n\nUPLOADED DOCUMENTS:\n${docSections.join('\n\n')}\n`;
  }

  let productContext = '';
  const productBoxes = boxes.filter(b => b.boxType === 'product' || b.boxType === 'menu_item');
  
  if (productBoxes.length > 0) {
    const categoryMap = new Map<string, typeof productBoxes>();
    for (const box of productBoxes) {
      const cat = box.category || 'Other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(box);
    }
    
    const catalogueSummary: string[] = [];
    catalogueSummary.push(`\nCATALOGUE (${productBoxes.length} items):`);
    
    for (const [category, catItems] of Array.from(categoryMap.entries())) {
      const sortedItems = [...catItems].sort((a: any, b: any) => 
        (b.popularityScore || 0) - (a.popularityScore || 0)
      ).slice(0, 5);
      
      catalogueSummary.push(`\n${category} (${catItems.length} total):`);
      for (const item of sortedItems) {
        const priceNum = item.price != null ? Number(item.price) : null;
        const priceStr = priceNum != null && !isNaN(priceNum) ? ` - ${item.currency || '£'}${priceNum.toFixed(2)}` : '';
        catalogueSummary.push(`  • ${item.title}${priceStr}`);
        if (item.description) {
          catalogueSummary.push(`    ${item.description.slice(0, 100)}...`);
        }
      }
      if (catItems.length > 5) {
        catalogueSummary.push(`  • ...and ${catItems.length - 5} more items`);
      }
    }
    
    productContext = catalogueSummary.join('\n');
  }

  const boxTypeCounts: Record<string, number> = {};
  for (const box of boxes) {
    boxTypeCounts[box.boxType] = (boxTypeCounts[box.boxType] || 0) + 1;
  }
  
  const hasMenuItems = (boxTypeCounts['menu_item'] || 0) > 0;
  const hasProducts = (boxTypeCounts['product'] || 0) > 0;
  
  const slugLower = slug.toLowerCase();
  const allTitles = boxes.map(b => b.title?.toLowerCase() || '').join(' ');
  const allDescriptions = boxes.map(b => b.description?.toLowerCase() || '').join(' ');
  const allContent = `${slugLower} ${allTitles} ${allDescriptions}`;
  
  type BusinessType = 'recruitment' | 'restaurant' | 'professional_services' | 'retail' | 'general';
  let businessType: BusinessType = 'general';
  let businessTypeLabel = 'business';
  let offeringsLabel = 'services';
  
  const recruitmentKeywords = ['employment', 'recruitment', 'jobs', 'careers', 'staffing', 'hiring', 'vacancies', 'candidates', 'cv', 'resume'];
  const isRecruitment = recruitmentKeywords.some(k => allContent.includes(k));
  
  const foodKeywords = ['menu', 'restaurant', 'cafe', 'bistro', 'pub', 'bar', 'food', 'dining', 'kitchen', 'chef', 'dish'];
  const isFood = hasMenuItems || foodKeywords.some(k => allContent.includes(k));
  
  const servicesKeywords = ['agency', 'consulting', 'marketing', 'digital', 'design', 'web', 'software', 'solutions'];
  const isServices = servicesKeywords.some(k => allContent.includes(k));
  
  if (isRecruitment) {
    businessType = 'recruitment';
    businessTypeLabel = 'recruitment agency';
    offeringsLabel = 'job opportunities and services';
  } else if (isFood && hasMenuItems) {
    businessType = 'restaurant';
    businessTypeLabel = 'restaurant';
    offeringsLabel = 'menu';
  } else if (hasProducts) {
    businessType = 'retail';
    businessTypeLabel = 'business';
    offeringsLabel = 'products';
  } else if (isServices) {
    businessType = 'professional_services';
    businessTypeLabel = 'agency';
    offeringsLabel = 'services';
  }

  // Build hero post knowledge context
  let heroPostContext = '';
  if (heroPostsAsKnowledge.length > 0) {
    const postsSummary = heroPostsAsKnowledge.slice(0, 10).map((post: any) => {
      const topics = post.extracted?.topics?.join(', ') || '';
      return `[${post.sourcePlatform}] ${post.title || 'Post'}\n${post.text?.slice(0, 500) || ''}${topics ? `\nTopics: ${topics}` : ''}`;
    }).join('\n\n');
    
    heroPostContext = `\n\nBRAND INSIGHTS (From our published content):\n${postsSummary}\n`;
  }

  // Build video context for suggestions
  let videoContext = '';
  const videos = enabledVideos.map((v: any) => ({
    id: v.id,
    title: v.title,
    tags: (v.tags as string[]) || [],
    topics: (v.topics as string[]) || [],
    youtubeVideoId: v.youtubeVideoId,
    thumbnailUrl: v.thumbnailUrl,
    description: v.description,
  }));
  
  if (videos.length > 0) {
    const videoList = videos.slice(0, 10).map((v: any) => 
      `- [ID:${v.id}] "${v.title}" (${v.tags.join(', ') || 'no tags'})`
    ).join('\n');
    
    videoContext = `\n\nAVAILABLE VIDEOS:
${videoList}

IMPORTANT: When a video is highly relevant to the user's question, include [VIDEO:id] at the END of your response (e.g. [VIDEO:${videos[0]?.id || 1}]). Only suggest ONE video per response, and only if it directly answers their question.\n`;
  }

  return {
    productContext,
    documentContext,
    heroPostContext,
    videoContext,
    videos,
    businessType,
    businessTypeLabel,
    offeringsLabel,
    items,
  };
}

/**
 * Builds intent-specific guidance for AI responses
 */
function buildIntentGuidance(intentChain?: string, conversationStage?: string): string {
  if (!intentChain) return '';

  let guidance = '\n## Intent-Specific Guidance:\n';

  switch (intentChain) {
    case 'product_exploration':
      guidance += `The user is **exploring options**. ${conversationStage === 'initial_contact' ? 'This is their first message.' : 'They are learning about what you offer.'}\n`;
      guidance += '- Highlight 2-3 specific items that match their interest\n';
      guidance += '- Mention variety/range if relevant\n';
      guidance += '- Be enthusiastic but not pushy\n';
      if (conversationStage === 'deepening') {
        guidance += '- They\'re getting interested - offer comparisons or recommendations\n';
      }
      break;

    case 'purchase_consideration':
      guidance += `The user is **evaluating and comparing**. They are seriously considering options.\n`;
      guidance += '- Focus on differentiators and benefits\n';
      guidance += '- Be specific about features, pricing, value\n';
      guidance += '- Help them make an informed decision\n';
      guidance += '- If they seem ready, gently suggest next steps (booking/contact)\n';
      break;

    case 'transactional_action':
      guidance += `The user is **ready to take action**. They want to buy, book, or contact.\n`;
      guidance += '- Provide clear, direct instructions\n';
      guidance += '- Include contact details, booking links, or purchase steps\n';
      guidance += '- Remove any friction - make it easy\n';
      guidance += '- Confirm what they need to do next\n';
      break;

    case 'support_inquiry':
      guidance += `The user **needs help** with a problem or question.\n`;
      guidance += '- Be empathetic and solution-focused\n';
      guidance += '- Provide actionable steps to resolve their issue\n';
      guidance += '- Offer contact details for further support if needed\n';
      guidance += '- Acknowledge their concern before solving\n';
      break;

    case 'information_gathering':
      guidance += `The user is **researching and learning**. They want facts and details.\n`;
      guidance += '- Be informative and specific\n';
      guidance += '- Cite concrete examples from available data\n';
      guidance += '- Structure information clearly\n';
      guidance += '- Avoid marketing language - focus on facts\n';
      break;

    case 'casual_conversation':
      guidance += `The user is **casually chatting**. Keep it light and friendly.\n`;
      guidance += '- Match their conversational tone\n';
      guidance += '- Offer to help with something specific\n';
      guidance += '- Don\'t force a sale or specific direction\n';
      break;
  }

  // Stage-specific additional guidance
  if (conversationStage === 'stuck') {
    guidance += '\n**IMPORTANT**: The user seems stuck or confused. Offer to:\n';
    guidance += '- Rephrase their question to confirm understanding\n';
    guidance += '- Show popular options to give them a starting point\n';
    guidance += '- Ask a clarifying question to understand their need\n';
  }

  if (conversationStage === 'decision' && intentChain !== 'transactional_action') {
    guidance += '\n**OPPORTUNITY**: The user is in decision mode. Help them:\n';
    guidance += '- Make the final choice confidently\n';
    guidance += '- Understand the next steps clearly\n';
  }

  return guidance;
}

export function buildSystemPrompt(
  context: OrbitChatContext,
  productContext: string,
  documentContext: string,
  businessType: string,
  businessTypeLabel: string,
  offeringsLabel: string,
  items: any[],
  heroPostContext: string = '',
  videoContext: string = '',
  intentChain?: string,
  conversationStage?: string
): string {
  const { brandName, sourceDomain, siteSummary, keyServices } = context;

  let contextSummary = '';
  if (businessType === 'recruitment') {
    const jobItems = items.filter((i: any) => i.category || i.description);
    contextSummary = `## Our Roles & Services:\n${jobItems.slice(0, 30).map((item: any) => 
      `- ${item.name}${item.category ? ` [${item.category}]` : ''}${item.description ? `: ${item.description.slice(0, 80)}` : ''}`
    ).join('\n')}`;
  } else if (businessType === 'restaurant') {
    contextSummary = `## Our Menu:\n${items.slice(0, 40).map((item: any) => 
      `- ${item.name}${item.price ? ` (£${item.price})` : ''}${item.category ? ` [${item.category}]` : ''}${item.description ? `: ${item.description.slice(0, 80)}` : ''}`
    ).join('\n')}`;
  } else {
    contextSummary = `## Our ${offeringsLabel.charAt(0).toUpperCase() + offeringsLabel.slice(1)}:\n${items.slice(0, 40).map((item: any) => 
      `- ${item.name}${item.price ? ` (£${item.price})` : ''}${item.category ? ` [${item.category}]` : ''}${item.description ? `: ${item.description.slice(0, 80)}` : ''}`
    ).join('\n')}`;
  }

  let narrativeSection = '';
  if (businessType === 'recruitment') {
    narrativeSection = `### NARRATIVE QUERIES (Engage conversationally):
For questions about job roles, requirements, salary expectations, industries we cover, application process, CV advice, or employer services.
→ Be helpful and informative. Use the job/service data to give informed answers.`;
  } else if (businessType === 'restaurant') {
    narrativeSection = `### NARRATIVE QUERIES (Engage conversationally):
For questions about menu items, recommendations, ingredients, dietary options, taste profiles, or brand story.
→ Be friendly, helpful, and conversational. Use the menu data to give informed answers.`;
  } else {
    narrativeSection = `### NARRATIVE QUERIES (Engage conversationally):
For questions about our ${offeringsLabel}, how we can help, our approach, or brand story.
→ Be friendly, helpful, and conversational.`;
  }

  let servicesSection = '';
  if (keyServices && keyServices.length > 0) {
    servicesSection = `\nSERVICES:\n${keyServices.map((s: string) => `• ${s}`).join('\n')}\n`;
  }

  let siteContext = '';
  if (siteSummary) {
    siteContext = `\nCONTEXT:\n${siteSummary}\n`;
  }

  return `You are a helpful assistant for ${brandName}, a ${businessTypeLabel}. You help visitors learn about our ${offeringsLabel} and find what they need.
${siteContext}${servicesSection}
${contextSummary}
${documentContext}${heroPostContext}${videoContext}
## Response Guidelines:

### TRANSACTIONAL QUERIES (Answer directly):
1. **Contact/Get in Touch**: Provide contact options. Suggest visiting ${sourceDomain || 'our website'}.
2. **Locations/Branches**: Help them find locations or suggest checking the website.
3. **Opening Hours**: Provide hours if known, otherwise suggest checking the website.

${narrativeSection}

### LOW-SIGNAL (Brief, polite):
For greetings, thanks, or unclear messages: Brief, warm response. Offer to help with something specific.

## Response Rules:
- Be friendly and helpful - never leave questions unanswered
- Keep responses concise (2-4 sentences max)
- If you genuinely don't have information, say so and suggest where to find it
- Lead with value, not filler like "Great question!" or "I'd be happy to..."
- Never repeat the same information twice in one response
${productContext ? '- For product/menu queries: cite specific items with prices when relevant' : ''}
${videoContext ? '- If a video is highly relevant to the question, suggest watching it for more detail' : ''}

${buildIntentGuidance(intentChain, conversationStage)}`;
}

export async function processProofCapture(
  message: string,
  config: ProofCaptureConfig
): Promise<{
  intercepted: boolean;
  response?: string;
  proofCaptureFlow?: any;
  suggestionChip?: { text: string; action: string };
  classificationResult?: { praiseKeywordsFound: string[] };
}> {
  if (!config.enabled) {
    return { intercepted: false };
  }

  const { 
    classifyTestimonialMoment, 
    shouldTriggerProofCapture, 
    getContextQuestion, 
    getConsentRequest,
    isDetailedPraiseResponse,
    parseConsentResponse,
    getConsentFollowup
  } = await import('./proofCapture');

  const recentUserMessages = config.history
    .filter(h => h.role === 'user')
    .slice(-5)
    .map(h => h.content);
  
  const recentAssistantMessages = config.history
    .filter(h => h.role === 'assistant')
    .slice(-3)
    .map(h => h.content);

  const lastAssistantMsg = recentAssistantMessages[recentAssistantMessages.length - 1] || '';
  
  const isInContextQuestionStage = 
    lastAssistantMsg.includes("I'd love to know more") ||
    lastAssistantMsg.includes("what was the highlight") ||
    lastAssistantMsg.includes("what stood out") ||
    lastAssistantMsg.includes("what was the main thing") ||
    lastAssistantMsg.includes("what would you say") ||
    lastAssistantMsg.includes("Tell me more about what") ||
    lastAssistantMsg.includes("what is it about") ||
    lastAssistantMsg.includes("what impressed you") ||
    lastAssistantMsg.includes("what makes it special");
  
  const isInConsentStage = lastAssistantMsg.includes('Would you be happy for us to use your comment');

  console.log('[ProofCapture:Unified] Flow state - Context stage:', isInContextQuestionStage, 'Consent stage:', isInConsentStage);

  if (isInConsentStage) {
    const consentResponse = parseConsentResponse(message);
    console.log('[ProofCapture:Unified] Consent response:', consentResponse);
    
    if (consentResponse) {
      const followup = getConsentFollowup(consentResponse);
      return {
        intercepted: true,
        response: followup,
        proofCaptureFlow: {
          stage: 'consent_received',
          consentType: consentResponse,
        },
      };
    }
  } else if (isInContextQuestionStage) {
    const detailCheck = await isDetailedPraiseResponse(message, recentUserMessages);
    console.log('[ProofCapture:Unified] Detail check:', JSON.stringify(detailCheck));
    
    if (detailCheck.hasDetail) {
      const consentInfo = getConsentRequest();
      return {
        intercepted: true,
        response: `That's wonderful feedback, thank you for sharing!\n\nWould you be happy for us to use your comment as a testimonial?\n\n• ${consentInfo.options.join('\n• ')}`,
        proofCaptureFlow: {
          stage: 'consent_request',
          expandedQuote: detailCheck.combinedQuote,
          consentOptions: consentInfo.options,
        },
      };
    }
  } else if (!config.triggeredAt) {
    const classification = await classifyTestimonialMoment(message, recentUserMessages);
    
    console.log('[ProofCapture:Unified] Classification for message:', message);
    console.log('[ProofCapture:Unified] Result:', JSON.stringify(classification));
    
    const proofCaptureTrigger = shouldTriggerProofCapture(
      config.enabled,
      config.triggeredAt,
      classification
    );
    
    console.log('[ProofCapture:Unified] Trigger decision:', JSON.stringify(proofCaptureTrigger));
    
    if (proofCaptureTrigger.shouldTrigger) {
      const topicQuestion = getContextQuestion(classification.topic);
      
      return {
        intercepted: true,
        response: topicQuestion,
        proofCaptureFlow: {
          stage: 'context_question',
          topic: classification.topic,
          originalMessage: message,
          confidence: classification.confidence,
          specificityScore: classification.specificityScore,
        },
      };
    }
    
    if (proofCaptureTrigger.showSuggestionChip) {
      return {
        intercepted: false,
        suggestionChip: {
          text: "Leave a testimonial",
          action: "testimonial",
        },
        classificationResult: classification,
      };
    }

    return { intercepted: false, classificationResult: classification };
  }

  return { intercepted: false };
}

export async function generateChatResponse(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: options.maxTokens || 300,
    temperature: options.temperature || 0.7,
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

export function processEchoResponse(rawResponse: string): string {
  let response = rawResponse;
  
  response = response.replace(/^(Great question!|I'd be happy to|Let me explain|Certainly!|Absolutely!|Of course!)\s*/gi, '');
  response = response.replace(/^(I think|I believe|I would say)\s+/gi, '');
  
  if (response.endsWith('?')) {
    const questionCount = (response.match(/\?/g) || []).length;
    if (questionCount > 1) {
      const lastQuestionIndex = response.lastIndexOf('?');
      const secondLastQuestionIndex = response.lastIndexOf('?', lastQuestionIndex - 1);
      response = response.slice(0, secondLastQuestionIndex + 1);
    }
  }
  
  return response.trim();
}

export interface SuggestedVideo {
  id: number;
  title: string;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  description: string | null;
}

export function parseVideoSuggestion(
  response: string, 
  videos: { id: number; title: string; youtubeVideoId?: string; thumbnailUrl?: string | null; description?: string | null }[]
): { cleanResponse: string; suggestedVideo: SuggestedVideo | null } {
  const videoMatch = response.match(/\[VIDEO:(\d+)\]/);
  
  if (!videoMatch) {
    return { cleanResponse: response, suggestedVideo: null };
  }
  
  const videoId = parseInt(videoMatch[1]);
  const video = videos.find(v => v.id === videoId);
  
  const cleanResponse = response.replace(/\s*\[VIDEO:\d+\]\s*/g, '').trim();
  
  if (!video || !video.youtubeVideoId) {
    return { cleanResponse, suggestedVideo: null };
  }
  
  return {
    cleanResponse,
    suggestedVideo: {
      id: video.id,
      title: video.title,
      youtubeVideoId: video.youtubeVideoId,
      thumbnailUrl: video.thumbnailUrl || null,
      description: video.description || null,
    },
  };
}
