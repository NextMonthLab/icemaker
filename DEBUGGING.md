# NextMonth Debugging Guide

This document describes the built-in debugging and diagnostic tools available in NextMonth.

## Quick Reference

| Tool | Access Method | Purpose |
|------|---------------|---------|
| **Debug Panel** | Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) | View build info, server health, environment variables |
| **Health Endpoint** | Visit `/api/health` | Check server status and version |
| **Build Version** | Check footer (dev mode only) | See current git commit hash |

---

## 1. Debug Panel (Development Only)

**Access**: Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

The debug panel provides a comprehensive view of:

### Build Information
- **Git Commit**: The exact commit hash of the code currently running
- **Build Timestamp**: When the current build was created
- **Mode**: development or production

### Server Health
- **Status**: Server status (ok/error)
- **Version**: Git commit hash from server
- **Node Environment**: The NODE_ENV value
- **Server Time**: Current server timestamp

### Current Route
- Shows the active route path (e.g., `/for/brands`)

### Client Environment Variables
- Lists all VITE_* environment variables
- Safe to expose (no secrets)

### Quick Actions
- **Hard Reload**: Refreshes the page without cache
- **Clear Cache & Reload**: Clears localStorage, sessionStorage, and reloads

---

## 2. Health Check Endpoint

**Access**: `GET /api/health`

Returns JSON with server status:

```json
{
  "status": "ok",
  "version": "a6abe4d",
  "nodeEnv": "development",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Use Cases
- Verify server is running
- Check which version is deployed
- Confirm server time for debugging timezone issues

---

## 3. Build Version in Footer (Development Only)

In development mode, the footer of marketing pages shows the git commit hash:

```
© 2025 NextMonth Ltd. All rights reserved. va6abe4d
```

This helps quickly verify which version you're viewing.

---

## Common Debugging Scenarios

### Scenario 1: "Copy hasn't updated"

**Steps**:
1. Press `Ctrl+Shift+D` to open debug panel
2. Check the **Git Commit** hash
3. Compare with `git log` output in terminal
4. If they don't match:
   - Click **Hard Reload** button
   - If still not updated, click **Clear Cache & Reload**
5. If still not working, check server logs for compilation errors

### Scenario 2: "API not working"

**Steps**:
1. Visit `/api/health` in browser
2. Check if response is successful
3. If 404 or error:
   - Server may not be running
   - Check terminal for server errors
4. Compare server `version` with client commit hash
5. If mismatched, restart dev server

### Scenario 3: "Not sure what's deployed"

**Steps**:
1. Check footer version (dev mode)
2. Visit `/api/health` for server version
3. Run `git log --oneline -5` to see recent commits
4. Match commit hash with running version

---

## Environment Variables

### Build-Time Variables (Injected by Vite)

These are automatically injected during build:

- `VITE_GIT_COMMIT_HASH`: Short git commit hash (7 chars)
- `VITE_BUILD_TIMESTAMP`: ISO timestamp of build

### Runtime Variables

Server environment variables (see `.env.example`):

- `NODE_ENV`: development | production
- `GIT_COMMIT_HASH`: Set by CI/CD or manually
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- etc. (see .env.example for full list)

---

## Implementation Details

### Debug Panel Component

**Location**: `client/src/components/DebugPanel.tsx`

Features:
- Only renders in development mode
- Keyboard shortcut handler
- Fetches `/api/health` on open
- Shows environment variables (VITE_* only)

### Vite Configuration

**Location**: `vite.config.ts`

The build process injects git commit hash and timestamp:

```typescript
define: {
  'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitCommitHash()),
  'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(getBuildTimestamp()),
}
```

### Health Endpoint

**Location**: `server/routes.ts`

Simple endpoint that returns server metadata:

```typescript
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: process.env.GIT_COMMIT_HASH || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});
```

---

## For Claude/AI Assistants

When debugging issues in future sessions:

1. **Always ask user to check debug panel first**: `"Can you press Ctrl+Shift+D and tell me what git commit hash is showing?"`

2. **Verify server/client versions match**: Ask user to compare footer version with `/api/health` response

3. **If copy doesn't update**:
   - Ask for debug panel screenshot
   - Compare commit hash with git log
   - Suggest hard reload or cache clear

4. **If API fails**:
   - Ask user to visit `/api/health`
   - Check if server version matches expected commit
   - Check browser console for errors

5. **Git operations**:
   - After pushing commits, ask user to refresh and check footer version
   - If version doesn't match, server may need restart

---

## Adding New Diagnostic Features

To add new debug information:

### Add to Debug Panel

Edit `client/src/components/DebugPanel.tsx`:

```tsx
<div className="flex justify-between p-2 bg-muted/50 rounded">
  <span className="text-muted-foreground">Your Label:</span>
  <span className="font-semibold">{yourValue}</span>
</div>
```

### Add to Health Endpoint

Edit `server/routes.ts`:

```typescript
app.get('/api/health', (_req, res) => {
  res.json({
    // ... existing fields
    yourNewField: yourValue,
  });
});
```

### Add Environment Variable

1. Add to `vite.config.ts` define block
2. Use in component: `import.meta.env.VITE_YOUR_VAR`
3. Document in this file

---

## Troubleshooting

### Debug Panel Won't Open

- Make sure you're in **development mode** (`npm run dev`)
- Check browser console for errors
- Try refreshing the page
- Verify `import.meta.env.DEV` is true

### Health Endpoint 404

- Server may not be running
- Check server terminal for errors
- Verify route is registered before `return httpServer`

### Footer Version Not Showing

- Only visible in development mode
- Must have valid git repository
- Check vite.config.ts is executing git command

### Version Mismatch

- Server and client may be out of sync
- Restart dev server
- Run `git status` to check for uncommitted changes
- Clear browser cache

---

**Last Updated**: 2025-01-15
**Version**: 1.0
**Maintainer**: NextMonth Dev Team
