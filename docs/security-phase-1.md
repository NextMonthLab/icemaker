# Security Documentation - Phase 1 + 1.1

## Overview

This document covers the security measures implemented in Phase 1 (Core Security) and Phase 1.1 (Beta Readiness) for NextMonth's Orbit and ICE systems.

**Last Updated:** December 2024  
**Target Users:** ~100 beta users  
**Architecture:** Single-tenant (userId = implicit tenant)

---

## Token System (Phase 1)

### Public Access Tokens

HMAC-SHA256 signed tokens for authenticating public (unauthenticated) access to resources.

**Token Payload Structure:**
```typescript
{
  ver: 1,              // Token version for future upgrades
  aud: 'analytics' | 'chat',  // Audience (intended use)
  resourceType: 'story' | 'preview',
  resourceId: string,  // Universe ID or Preview ID
  iat: number,         // Issued at (unix timestamp)
  exp: number          // Expiry (unix timestamp)
}
```

**Token Properties:**
- Expiry: 1 hour (3600 seconds)
- Algorithm: HMAC-SHA256
- Format: `base64url(payload).base64url(signature)`

**Resource Types:**
| Type | Purpose | Audience |
|------|---------|----------|
| `story` | Published ICE experiences | `analytics` |
| `preview` | Orbit preview instances | `chat` |

**Token Generation:**
- Story tokens: Generated at `/api/story/:slug` for public access
- Preview tokens: Generated at `/api/previews/:id` for chat access

**Token Validation:**
- Analytics endpoint: Requires story token matching universeId
- Chat endpoint: Requires preview token matching previewId
- Cross-resource attacks are prevented by type+ID validation

### Production Configuration

**REQUIRED Environment Variable:**
```
PUBLIC_TOKEN_SECRET=<32+ character secret>
```

In production, missing `PUBLIC_TOKEN_SECRET` will:
1. Log a CRITICAL error
2. Fail server startup

In development, a random secret is generated (tokens invalidate on restart).

---

## Rate Limiting (Phase 1)

### Configured Limits

| Endpoint Category | Limit | Window | Purpose |
|------------------|-------|--------|---------|
| Analytics | 100 req | 1 min | Prevent analytics poisoning |
| Activation/Pause | 10 req | 1 min | Prevent activation abuse |
| Chat | 30 req | 1 min | Prevent chat flooding |

### Headers Returned

```
X-RateLimit-Limit: <max requests>
X-RateLimit-Remaining: <remaining requests>
X-RateLimit-Reset: <seconds until reset>
Retry-After: <seconds> (only on 429)
```

---

## Request Validation (Phase 1.1)

### Body Size Limits

| Endpoint Type | Max Body Size | Max Text Length | Max Metadata Depth |
|--------------|---------------|-----------------|-------------------|
| Chat | 10 KB | 5,000 chars | N/A |
| Analytics | 5 KB | 1,000 chars | 3 levels |
| Preview | 50 KB | 10,000 chars | N/A |
| Admin | 2 KB | 500 chars (reason) | N/A |

### Content-Type Enforcement

Public endpoints require `Content-Type: application/json`.

Rejected requests receive 415 (Unsupported Media Type).

### Metadata Validation

Analytics metadata objects are validated for maximum nesting depth (3 levels) to prevent amplification attacks.

---

## Security Logging (Phase 1.1)

### Log Format

```
[SECURITY] <TYPE> | <STATUS> | <ENDPOINT> | resource=<type>:<id> | user=<id|anon> | ip=<ip> | reason=<reason>
```

### Event Types

| Type | Status Code | Description |
|------|-------------|-------------|
| AUTH_FAILURE | 401 | Missing or invalid authentication |
| ACCESS_DENIED | 403 | Valid auth but insufficient permissions |
| RATE_LIMIT | 429 | Rate limit exceeded |
| TOKEN_ERROR | 401 | Token validation failed |
| VALIDATION_ERROR | 400/413/415 | Request validation failed |
| ADMIN_ACTION | 200 | Admin performed emergency action |

### Log Fields

- `timestamp`: ISO 8601 timestamp
- `endpoint`: API path
- `statusCode`: HTTP response code
- `resourceType`: story, preview, orbit, experience
- `resourceId`: Resource identifier
- `userId`: Authenticated user ID or 'anon'
- `ip`: Client IP address
- `reason`: Human-readable description

---

## Admin Emergency Controls (Phase 1.1)

### Available Actions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/experiences/:id/emergency-pause` | POST | Immediately pause any experience |
| `/api/admin/orbits/:slug/emergency-disable` | POST | Disable orbit public access |
| `/api/admin/previews/:id/emergency-archive` | POST | Archive any preview immediately |

### Request Body

```json
{
  "reason": "Description of why action was taken"
}
```

All admin actions are logged with full audit trail.

---

## Startup Security Checks (Phase 1.1)

On server boot, the following checks run:

1. **Environment Variables**
   - Production: `PUBLIC_TOKEN_SECRET` REQUIRED (fail if missing)
   - Development: Warning if using random secret

2. **Status Display**
   - Token system configuration
   - Rate limit settings
   - Warnings and errors

---

## Known Limitations

### Current Scope (Phase 1.1)

- **Single-user accounts only**: No team/workspace sharing
- **No cross-user visibility**: Users can only see their own resources
- **No shared workspaces**: Each account is isolated
- **userId = tenant**: Implicit single-tenant model

### Not Implemented

- Full multi-tenant architecture
- Team membership or roles
- Cross-organization sharing
- IP allowlisting
- Webhook security

---

## Testing

### Security Test Suite

Location: `server/tests/phase1-security.test.ts`

Run: `npx tsx server/tests/phase1-security.test.ts`

**Tests Covered:**
1. Token mismatch rejection (Story A token for Story B)
2. Resource-type confusion (story token for preview)
3. Token expiry validation
4. Missing token rejection (401)
5. Invalid token rejection (403)
6. Rate limiting enforcement (429)

---

## Response Codes

| Code | Meaning |
|------|---------|
| 401 | Missing authentication/token |
| 403 | Invalid token or insufficient permissions |
| 410 | Resource no longer active |
| 413 | Request body too large |
| 415 | Unsupported content type |
| 429 | Rate limit exceeded |

---

## Deferred to Phase 2

- CORS audit and tightening (explicit origin allowlist)
- Data retention policies (automatic cleanup)
- Full soft delete implementation
- IP-based abuse detection
- Enhanced audit logging (database-backed)
- Webhook security
