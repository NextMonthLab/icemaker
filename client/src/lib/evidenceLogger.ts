interface RenderEvent {
  nm_event_type: 'render_event';
  nm_evidence_key: string;
  nm_component: string;
  nm_timestamp: string;
  nm_contract_version: string;
  nm_orbit_slug?: string;
  nm_additional?: Record<string, string | number | boolean>;
}

interface HealthEvent {
  nm_event_type: 'health_check';
  nm_evidence_key: string;
  nm_status: 'pass' | 'fail' | 'warn';
  nm_timestamp: string;
  nm_message?: string;
}

type EvidenceEvent = RenderEvent | HealthEvent;

const CONTRACT_VERSION = '1.0.0';
const eventLog: EvidenceEvent[] = [];
const MAX_LOG_SIZE = 1000;

export function logRenderEvent(
  evidenceKey: string,
  component: string,
  orbitSlug?: string,
  additional?: Record<string, string | number | boolean>
): void {
  const event: RenderEvent = {
    nm_event_type: 'render_event',
    nm_evidence_key: evidenceKey,
    nm_component: component,
    nm_timestamp: new Date().toISOString(),
    nm_contract_version: CONTRACT_VERSION,
    nm_orbit_slug: orbitSlug,
    nm_additional: additional,
  };

  eventLog.push(event);
  
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.shift();
  }

  if (import.meta.env.DEV) {
    console.debug(`[Evidence] ${evidenceKey}`, event);
  }
}

export function logHealthCheck(
  evidenceKey: string,
  status: 'pass' | 'fail' | 'warn',
  message?: string
): void {
  const event: HealthEvent = {
    nm_event_type: 'health_check',
    nm_evidence_key: evidenceKey,
    nm_status: status,
    nm_timestamp: new Date().toISOString(),
    nm_message: message,
  };

  eventLog.push(event);
  
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.shift();
  }

  if (import.meta.env.DEV) {
    console.debug(`[Health] ${evidenceKey}: ${status}`, message);
  }
}

export function getEventLog(): EvidenceEvent[] {
  return [...eventLog];
}

export function getRecentEvents(count: number = 100): EvidenceEvent[] {
  return eventLog.slice(-count);
}

export function getEventsByKey(evidenceKey: string): EvidenceEvent[] {
  return eventLog.filter(e => 
    ('nm_evidence_key' in e && e.nm_evidence_key === evidenceKey)
  );
}

export function hasRendered(evidenceKey: string): boolean {
  return eventLog.some(e => 
    e.nm_event_type === 'render_event' && e.nm_evidence_key === evidenceKey
  );
}

export function clearEventLog(): void {
  eventLog.length = 0;
}

export function getContractVersion(): string {
  return CONTRACT_VERSION;
}

export function exportEvidencePack(): {
  contractVersion: string;
  exportedAt: string;
  eventCount: number;
  events: EvidenceEvent[];
} {
  return {
    contractVersion: CONTRACT_VERSION,
    exportedAt: new Date().toISOString(),
    eventCount: eventLog.length,
    events: [...eventLog],
  };
}
