import type { Request, Response } from 'express';

export interface EvidenceMetadata {
  nm_contract_version: string;
  nm_timestamp: string;
  nm_request_id: string;
  nm_orbit_slug?: string;
  nm_response_time_ms?: number;
  [key: string]: string | number | boolean | undefined;
}

const CONTRACT_VERSION = '1.0.0';

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createEvidenceMetadata(
  requestId: string,
  startTime: number,
  additionalFields: Record<string, string | number | boolean | undefined> = {}
): EvidenceMetadata {
  return {
    nm_contract_version: CONTRACT_VERSION,
    nm_timestamp: new Date().toISOString(),
    nm_request_id: requestId,
    nm_response_time_ms: Date.now() - startTime,
    ...additionalFields,
  };
}

export function attachEvidenceMetadata<T extends object>(
  data: T,
  requestId: string,
  startTime: number,
  additionalFields: Record<string, string | number | boolean | undefined> = {}
): T & { _evidence: EvidenceMetadata } {
  return {
    ...data,
    _evidence: createEvidenceMetadata(requestId, startTime, additionalFields),
  };
}

export function evidenceMiddleware(req: Request, res: Response, next: () => void): void {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  (req as any).nm_request_id = requestId;
  (req as any).nm_start_time = startTime;
  
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const orbitSlug = (req.params as any)?.slug;
      data._evidence = createEvidenceMetadata(requestId, startTime, {
        nm_orbit_slug: orbitSlug,
      });
    }
    return originalJson(data);
  };
  
  next();
}

export function extractRequestEvidence(req: Request): { requestId: string; startTime: number } {
  return {
    requestId: (req as any).nm_request_id || generateRequestId(),
    startTime: (req as any).nm_start_time || Date.now(),
  };
}
