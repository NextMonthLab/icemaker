type AnalyticsEventType = 
  | 'experience_view' 
  | 'card_view' 
  | 'conversation_start' 
  | 'question_asked' 
  | 'chat_message';

interface AnalyticsEvent {
  type: AnalyticsEventType;
  universeId: number;
  cardId?: number;
  metadata?: Record<string, unknown>;
  publicAccessToken?: string;
}

const sentEvents = new Set<string>();
const pendingEvents = new Set<string>();

// Token storage per universe
const tokenStore = new Map<number, string>();

export function setPublicAccessToken(universeId: number, token: string): void {
  tokenStore.set(universeId, token);
}

export function getPublicAccessToken(universeId: number): string | undefined {
  return tokenStore.get(universeId);
}

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  const dedupKey = `${event.type}-${event.universeId}-${event.cardId || ''}`;
  
  if (event.type === 'experience_view' || event.type === 'card_view') {
    if (sentEvents.has(dedupKey) || pendingEvents.has(dedupKey)) {
      return;
    }
    pendingEvents.add(dedupKey);
  }
  
  // Get token from store if not provided
  const publicAccessToken = event.publicAccessToken || tokenStore.get(event.universeId);
  if (!publicAccessToken) {
    console.debug('Analytics event skipped: no public access token');
    return;
  }
  
  try {
    const response = await fetch('/api/public/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        publicAccessToken,
      }),
    });
    
    if (response.ok && (event.type === 'experience_view' || event.type === 'card_view')) {
      sentEvents.add(dedupKey);
    }
  } catch (error) {
    console.debug('Analytics event failed:', error);
  } finally {
    pendingEvents.delete(dedupKey);
  }
}

export function trackExperienceView(universeId: number, token?: string): void {
  trackEvent({ type: 'experience_view', universeId, publicAccessToken: token });
}

export function trackCardView(universeId: number, cardId: number, token?: string): void {
  trackEvent({ type: 'card_view', universeId, cardId, publicAccessToken: token });
}

export function trackConversationStart(universeId: number, characterId?: number, token?: string): void {
  trackEvent({ 
    type: 'conversation_start', 
    universeId, 
    metadata: { characterId },
    publicAccessToken: token,
  });
}

export function trackQuestion(universeId: number, question: string, token?: string): void {
  trackEvent({ 
    type: 'question_asked', 
    universeId, 
    metadata: { question: question.slice(0, 200) },
    publicAccessToken: token,
  });
}
