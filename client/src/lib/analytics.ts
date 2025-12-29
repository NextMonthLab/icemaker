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
}

const sentEvents = new Set<string>();

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  const eventKey = `${event.type}-${event.universeId}-${event.cardId || ''}-${Date.now()}`;
  
  if (event.type === 'experience_view' || event.type === 'card_view') {
    const dedupKey = `${event.type}-${event.universeId}-${event.cardId || ''}`;
    if (sentEvents.has(dedupKey)) {
      return;
    }
    sentEvents.add(dedupKey);
  }
  
  try {
    await fetch('/api/public/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.debug('Analytics event failed:', error);
  }
}

export function trackExperienceView(universeId: number): void {
  trackEvent({ type: 'experience_view', universeId });
}

export function trackCardView(universeId: number, cardId: number): void {
  trackEvent({ type: 'card_view', universeId, cardId });
}

export function trackConversationStart(universeId: number, characterId?: number): void {
  trackEvent({ 
    type: 'conversation_start', 
    universeId, 
    metadata: { characterId } 
  });
}

export function trackQuestion(universeId: number, question: string): void {
  trackEvent({ 
    type: 'question_asked', 
    universeId, 
    metadata: { question: question.slice(0, 200) } 
  });
}
