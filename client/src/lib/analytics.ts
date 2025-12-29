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
const pendingEvents = new Set<string>();

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  const dedupKey = `${event.type}-${event.universeId}-${event.cardId || ''}`;
  
  if (event.type === 'experience_view' || event.type === 'card_view') {
    if (sentEvents.has(dedupKey) || pendingEvents.has(dedupKey)) {
      return;
    }
    pendingEvents.add(dedupKey);
  }
  
  try {
    const response = await fetch('/api/public/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
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
