interface SecurityLogEvent {
  type: 'auth_failure' | 'rate_limit' | 'access_denied' | 'token_error' | 'validation_error' | 'admin_action';
  endpoint: string;
  statusCode: number;
  resourceType?: 'story' | 'preview' | 'orbit' | 'experience';
  resourceId?: string | number;
  userId?: number;
  ip?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function logSecurityEvent(event: SecurityLogEvent): void {
  const logEntry = {
    timestamp: formatTimestamp(),
    ...event,
  };

  // Format for structured logging - easy to grep and analyze
  const logLine = `[SECURITY] ${event.type.toUpperCase()} | ${event.statusCode} | ${event.endpoint} | resource=${event.resourceType || 'none'}:${event.resourceId || 'none'} | user=${event.userId || 'anon'} | ip=${event.ip || 'unknown'} | reason=${event.reason || 'none'}`;
  
  // Log level based on event type
  if (event.statusCode >= 500) {
    console.error(logLine);
  } else if (event.type === 'auth_failure' || event.type === 'rate_limit') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // Also log full JSON for detailed analysis if needed
  if (process.env.SECURITY_LOG_VERBOSE === 'true') {
    console.log(JSON.stringify(logEntry));
  }
}

// Convenience functions for common security events
export function logAuthFailure(endpoint: string, reason: string, resourceType?: SecurityLogEvent['resourceType'], resourceId?: string | number, ip?: string, userId?: number): void {
  logSecurityEvent({
    type: 'auth_failure',
    endpoint,
    statusCode: 401,
    resourceType,
    resourceId,
    ip,
    userId,
    reason,
  });
}

export function logAccessDenied(endpoint: string, reason: string, resourceType?: SecurityLogEvent['resourceType'], resourceId?: string | number, ip?: string, userId?: number): void {
  logSecurityEvent({
    type: 'access_denied',
    endpoint,
    statusCode: 403,
    resourceType,
    resourceId,
    ip,
    userId,
    reason,
  });
}

export function logRateLimitHit(endpoint: string, ip?: string, userId?: number): void {
  logSecurityEvent({
    type: 'rate_limit',
    endpoint,
    statusCode: 429,
    ip,
    userId,
    reason: 'Rate limit exceeded',
  });
}

export function logTokenError(endpoint: string, reason: string, resourceType?: SecurityLogEvent['resourceType'], resourceId?: string | number, ip?: string): void {
  logSecurityEvent({
    type: 'token_error',
    endpoint,
    statusCode: 401,
    resourceType,
    resourceId,
    ip,
    reason,
  });
}

export function logAdminAction(endpoint: string, action: string, userId: number, resourceType?: SecurityLogEvent['resourceType'], resourceId?: string | number, metadata?: Record<string, unknown>): void {
  logSecurityEvent({
    type: 'admin_action',
    endpoint,
    statusCode: 200,
    resourceType,
    resourceId,
    userId,
    reason: action,
    metadata,
  });
}
