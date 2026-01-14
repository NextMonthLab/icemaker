# Claude Code Orientation Pack

This documentation pack provides everything Claude Code (or any developer) needs to safely navigate, debug, and modify the IceMaker codebase.

## Quick Start

**Read these first, in order**:

1. [00-START-HERE.md](./00-START-HERE.md) - Overview, golden rules, quick commands
2. [01-ARCHITECTURE-MAP.md](./01-ARCHITECTURE-MAP.md) - System architecture and key files

## Full Index

| File | Purpose | When to Read |
|------|---------|--------------|
| [00-START-HERE.md](./00-START-HERE.md) | Project overview, philosophy, golden rules | First read, always |
| [01-ARCHITECTURE-MAP.md](./01-ARCHITECTURE-MAP.md) | Frontend, backend, pipelines, storage | Understanding system structure |
| [02-DEPENDENCIES-AND-INTERDEPENDENCIES.md](./02-DEPENDENCIES-AND-INTERDEPENDENCIES.md) | What depends on what, fragile points | Before refactoring |
| [03-ENV-VARS-RUNBOOK.md](./03-ENV-VARS-RUNBOOK.md) | All environment variables, Render deployment | Setting up, deploying |
| [04-API-CONTRACTS.md](./04-API-CONTRACTS.md) | API endpoint reference, request/response shapes | Working on API or frontend |
| [05-MONETISATION-AND-PERFECT-PICTURE.md](./05-MONETISATION-AND-PERFECT-PICTURE.md) | Pricing, costs, guardrails | Before touching billing or AI |
| [06-BUGFIX-WORKFLOW.md](./06-BUGFIX-WORKFLOW.md) | How to debug, test, and safely patch | Fixing bugs |
| [99-REPO-INVENTORY.txt](./99-REPO-INVENTORY.txt) | Directory tree and key files snapshot | Quick reference |

## Key Principles

1. **Schema is sacred** - Never modify `shared/schema.ts` without approval
2. **Cost guardrails matter** - Video max 5s, images max 1024x1024
3. **Test the full flow** - Always verify ICE creation through playback
4. **Respect entitlements** - Feature gating by tier must be enforced
5. **Debug, don't rewrite** - Fix existing code rather than replacing it

## When Things Break

1. Check [00-START-HERE.md](./00-START-HERE.md) for top 10 files to inspect
2. Check [06-BUGFIX-WORKFLOW.md](./06-BUGFIX-WORKFLOW.md) for debugging steps
3. Check [03-ENV-VARS-RUNBOOK.md](./03-ENV-VARS-RUNBOOK.md) for deployment issues

## Getting Support

- **Developer support**: Read this documentation pack first, then check the bugfix workflow
- **Platform issues**: Replit support at https://replit.com/support, Render at https://render.com/docs
- **User/customer support**: Enterprise contact form at `/enterprise/custom-branding`

## Updating This Documentation

When making significant changes to the codebase:
1. Update relevant section in the appropriate doc
2. Keep file paths and line numbers accurate
3. Add new endpoints to API contracts
4. Update environment variables if changed

---

*Last updated: January 2025*
