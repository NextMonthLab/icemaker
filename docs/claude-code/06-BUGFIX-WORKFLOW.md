# Bugfix Workflow

## How to Reproduce Issues

### Where Logs Appear

**Server Logs**:
- Development: Console output from `npm run dev`
- Production (Render): Dashboard > Logs tab
- Express requests logged with: `[express] METHOD /path STATUS in Xms`

**Frontend Logs**:
- Browser DevTools console
- TanStack Query DevTools (development)
- Network tab for API request/response

**Database Queries**:
- Enable verbose logging: Set `DEBUG=drizzle:*` in environment
- Use `/api/health` to verify database connection

### Enable Debug Logging

```bash
# Server-side
COST_AUDIT_LOGGING=true    # Log AI generation costs
SECURITY_LOG_VERBOSE=true  # Verbose auth/security logs
DEBUG=drizzle:*            # Drizzle ORM queries

# Client-side (browser console)
localStorage.setItem('debug', 'true');
```

### Local Development Steps

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Reproduce the issue**:
   - Open browser to `http://localhost:5000`
   - Follow steps to trigger the bug
   - Check browser console for errors
   - Check terminal for server errors

3. **Check specific logs**:
   - API errors show in terminal with stack traces
   - Frontend errors show in browser console
   - Database errors include SQL query and error code

### Common Log Patterns to Search For

```
# Server errors
ERROR
error:
at /opt/render/project
relation "X" does not exist
ECONNREFUSED

# Auth issues
401
Not authenticated
Access denied
logAuthFailure

# Rate limiting
429
Rate limited
Too many requests

# Generation failures
generation failed
timeout
OpenAI error
Kling error
```

---

## How to Patch Safely

### Create Small, Focused Changes

1. **One fix per edit**: Don't bundle unrelated changes
2. **Minimal diff**: Change only what's necessary
3. **Preserve existing patterns**: Follow the code's existing style
4. **Test before suggesting**: Verify the fix locally

### Add or Update Tests (If Test Harness Exists)

Test files location: `server/tests/`

Current test coverage:
- Brief parser tests
- Validation tests (limited)

For new tests:
```typescript
// server/tests/myFeature.test.ts
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should handle edge case', () => {
    // Test implementation
  });
});
```

### Manual Regression Checklist

Before marking a fix complete, verify these flows still work:

#### Core ICE Flow
- [ ] Create new ICE from content upload
- [ ] Edit card text in editor
- [ ] Generate image for card
- [ ] Generate video for card (if available)
- [ ] Generate TTS narration
- [ ] Preview ICE in player
- [ ] Card transitions work smoothly
- [ ] Publish ICE
- [ ] Share link works

#### AI Character Flow
- [ ] Add character to ICE
- [ ] Chat with character
- [ ] Character respects guardrails
- [ ] Conversation limit enforced

#### Auth Flow
- [ ] Register new account
- [ ] Login existing account
- [ ] Logout
- [ ] Session persists across refresh
- [ ] Protected routes redirect to login

#### Billing Flow (if touching billing code)
- [ ] Checkout page loads
- [ ] Stripe integration works (test mode)
- [ ] Subscription status updates
- [ ] Entitlements change with tier

---

## Regression Checklist by Area

### If You Changed Card Transitions
- [ ] Cards animate forward correctly
- [ ] Cards animate backward correctly
- [ ] No flicker between cards
- [ ] Media preloads before transition
- [ ] Timeout fallback works (image fails to load)

### If You Changed ICE Player
- [ ] Player renders cards correctly
- [ ] Image cards display properly
- [ ] Video cards play correctly
- [ ] Narration plays in sync
- [ ] Captions render correctly
- [ ] Interactivity nodes work
- [ ] Mobile view works

### If You Changed API Contracts
- [ ] Frontend queries still work
- [ ] Error responses handled correctly
- [ ] Loading states show properly
- [ ] Cache invalidation works

### If You Changed Storage/URLs
- [ ] Uploaded images display
- [ ] Generated images display
- [ ] Videos play correctly
- [ ] Audio plays correctly
- [ ] Signed URLs don't expire prematurely

### If You Changed Pricing/Quotas
- [ ] Free tier limits enforced
- [ ] Paid tier limits correct
- [ ] Upgrade flow works
- [ ] Downgrade doesn't break access

---

## "Do Not Touch" List

These areas are particularly sensitive and require extra care:

### Critical Paths
1. **Session middleware** (`routes.ts` lines 118-140): Breaking this breaks auth
2. **Stripe webhooks** (`webhookHandlers.ts`): Breaking this breaks billing
3. **Entitlements** (`entitlements.ts`): Breaking this breaks feature gating
4. **Public access tokens** (`publicAccessToken.ts`): Breaking this breaks sharing

### Schema Changes
- **Never modify `shared/schema.ts`** without user approval
- Schema changes require database migration
- Existing data must be compatible

### Security Code
- Rate limiters in `rateLimit.ts`
- Auth policies in `authPolicies.ts`
- Request validators in `requestValidation.ts`
- Security logger in `securityLogger.ts`

### External Integrations
- OpenAI client initialisation
- Stripe client configuration
- Object storage service
- Kling/Replicate video APIs

---

## Debugging Specific Issues

### "relation does not exist"
**Cause**: Database tables not created
**Fix**: Run `npm run db:push` to sync schema

### "Not authenticated" on protected route
**Debug**:
1. Check session cookie exists
2. Check session not expired
3. Check `req.isAuthenticated()` returns true
4. Verify SESSION_SECRET is set

### Image/video not displaying
**Debug**:
1. Check URL in browser (404? 403?)
2. Verify object storage bucket is accessible
3. Check signed URL hasn't expired
4. Verify file was actually uploaded

### AI generation failing
**Debug**:
1. Check API key is set (OPENAI_API_KEY)
2. Check for rate limiting (429 errors)
3. Check for quota exceeded (402 errors)
4. Verify prompt isn't triggering content filters

### Card transitions broken
**Debug**:
1. Check browser console for errors
2. Verify media URLs are valid
3. Check MediaPreloader component
4. Verify displayedCardIndex/pendingCardIndex sync

---

## Quick Fixes for Common Issues

### Database Connection
```bash
# Verify connection
curl http://localhost:5000/api/health

# Reset tables (development only!)
npm run db:push
```

### Clear Browser State
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
// Then hard refresh
```

### Reset Session
```bash
# Clear session table (development only!)
# Via SQL: DELETE FROM session;
```

### Test API Endpoint
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```
