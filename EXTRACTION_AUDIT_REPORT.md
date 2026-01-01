# Extraction Logic Audit Report

**Date:** January 2026  
**Auditor:** Claude Code  
**Status:** ✅ PHASE 1 COMPLETE - Consolidated

---

## Executive Summary

~~Extraction logic is fragmented across **5 files** with **5 separate Puppeteer launches** and **3 different image filtering functions**.~~ 

**UPDATE:** Phase 1 consolidation complete:
- ✅ Only **1 Puppeteer launch** remains (in `deepScraper.ts` singleton)
- ✅ Unified image filtering in `server/utils/mediaFilter.ts`
- ✅ Quality gate now **blocks persistence** when score < 50
- ✅ Site fingerprinting wired for logging

---

## 1. Call Graph: Extraction Entry Points

### Route: `/api/orbit/auto-generate` (server/routes.ts:7250)
```
POST /api/orbit/auto-generate
  └─> validateUrlSafety() [previewHelpers.ts]
  └─> detectSiteType(url) [catalogueDetection.ts:144]
        └─> puppeteer.launch() ❌ LAUNCHES OWN BROWSER
        └─> detectStructuredData()
        └─> detectPlatformFingerprints()
        └─> detectUrlPatterns()
        └─> detectDomHeuristics()
  └─> deriveExtractionPlan() [catalogueDetection.ts]
  └─> extractCatalogueItems(url) [catalogueDetection.ts:537]
        └─> puppeteer.launch() ❌ LAUNCHES OWN BROWSER
  └─> extractMenuItemsMultiPage(url) [catalogueDetection.ts:683]
        └─> puppeteer.launch() ❌ LAUNCHES OWN BROWSER
        └─> extractItemsFromPage() [internal]
  └─> validateExtractionQuality() [catalogueDetection.ts:1034]
        └─> isPaymentOrBadImage() [catalogueDetection.ts:1090]
  └─> isExtractionBadImage() [routes.ts:7236] ⚠️ DUPLICATE FILTER
  └─> storage.createOrbitBox()
```

### Route: `/api/orbit/generate` (server/routes.ts:7369)
```
POST /api/orbit/generate
  └─> validateUrlSafety() [previewHelpers.ts]
  └─> ingestSitePreview() [previewHelpers.ts]
        └─> fetch() (simple HTTP, no browser)
        └─> extractImagePool() [previewHelpers.ts:284] ⚠️ SEPARATE FILTER
        └─> extractSiteIdentity()
```

### Preview Ingestion: Deep Scrape Path
```
ingestSitePreview() with useDeepScraper=true
  └─> deepScrapeUrl() [deepScraper.ts:74]
        └─> getBrowser() [deepScraper.ts:41]
              └─> puppeteer.launch() ✅ SHARED INSTANCE
        └─> autoScroll()
```

---

## 2. Puppeteer Launch Locations (~~5~~ 1 total)

| File | Line | Function | Shared? | Notes |
|------|------|----------|---------|-------|
| `deepScraper.ts` | 58 | `getBrowser()` | ✅ Yes | Singleton pattern, reuses browser |
| ~~`catalogueDetection.ts`~~ | ~~145~~ | ~~`detectSiteType()`~~ | ~~❌ No~~ | ✅ Now uses `withPage()` |
| ~~`catalogueDetection.ts`~~ | ~~537~~ | ~~`extractCatalogueItems()`~~ | ~~❌ No~~ | ✅ Now uses `withPage()` |
| ~~`catalogueDetection.ts`~~ | ~~600~~ | ~~`extractMenuItems()`~~ | ~~❌ No~~ | ✅ Now uses `withPage()` |
| ~~`catalogueDetection.ts`~~ | ~~684~~ | ~~`extractMenuItemsMultiPage()`~~ | ~~❌ No~~ | ✅ Now uses `withMultiplePages()` |

**✅ RESOLVED:** All functions now delegate to `deepScraper.ts` singleton via `withPage()` and `withMultiplePages()` helpers.

---

## 3. Image Filtering Functions (~~3~~ 1 unified)

| File | Function | Status |
|------|----------|--------|
| `server/utils/mediaFilter.ts` | `isBadImageUrl()` | ✅ **NEW** - Unified blocklist |
| ~~`previewHelpers.ts`~~ | ~~`extractImagePool()`~~ | Delegates to mediaFilter |
| ~~`routes.ts`~~ | ~~`isExtractionBadImage()`~~ | Delegates to mediaFilter |
| ~~`catalogueDetection.ts`~~ | ~~`isPaymentOrBadImage()`~~ | Delegates to mediaFilter |

**✅ RESOLVED:** All filtering now uses shared `server/utils/mediaFilter.ts` with union of all blocklists.

---

## 4. Multi-Page Crawling (2 implementations)

| File | Function | Browser | Link Discovery |
|------|----------|---------|----------------|
| `deepScraper.ts` | `deepScrapeMultiplePages()` | Shared singleton | General nav patterns (about, services, products, etc.) |
| `catalogueDetection.ts` | `extractMenuItemsMultiPage()` | Launches own browser | Menu-specific patterns (burgers, chicken, sides, etc.) |

**Problem:** Two separate crawling implementations. `catalogueDetection` should delegate to `deepScraper` for browser lifecycle.

---

## 5. Unused/Half-Integrated Code

| File | Function | Status |
|------|----------|--------|
| `catalogueDetection.ts` | `fingerprintSite()` | ✅ Now wired for logging in auto-generate route |
| `catalogueDetection.ts` | `validateExtractionQuality()` | ✅ Now **blocks persistence** when score < 50 |
| `catalogueDetection.ts` | `getStrategiesForType()` | Used internally by fingerprinting |

---

## 6. Canonical Owners (Recommended)

| Responsibility | Current Owner | Recommended Owner |
|----------------|---------------|-------------------|
| Browser lifecycle | Split across 2 files | `deepScraper.ts` (singleton) |
| Image filtering | Split across 3 files | New `server/utils/mediaFilter.ts` |
| Site detection | `catalogueDetection.ts` | Keep, but delegate browser to deepScraper |
| Multi-page crawling | Split across 2 files | `deepScraper.ts` with configurable link patterns |
| Quality validation | `catalogueDetection.ts` | Keep, but enforce as gate |
| Extraction orchestration | `routes.ts` | New `server/services/extraction/orchestrator.ts` |

---

## 7. Consolidation Plan

### Phase 1: Stop the Bleeding ✅ COMPLETE

1. **✅ Create shared media filter**
   - Created `server/utils/mediaFilter.ts`
   - Consolidated blocklist from all 3 locations
   - All call sites now delegate to shared module

2. **✅ Make `catalogueDetection.ts` use `deepScraper.ts` for browser**
   - Removed all 4 `puppeteer.launch()` calls
   - Added `withPage()` and `withMultiplePages()` helpers to deepScraper
   - All detection/extraction uses shared browser singleton

3. **✅ Wire `validateExtractionQuality()` as a real gate**
   - Quality gate blocks persistence when score < 50
   - Response includes `quality` and `qualityGateBlocked` fields
   - Recommendations logged for future AI fallback

4. **✅ Wire `detectSiteFingerprint()` for logging**
   - Added `fingerprintSite()` helper using shared browser
   - Wired into auto-generate route with try/catch (non-blocking)
   - Logs platform, type, strategies for future routing improvements

### Phase 2: Unify Deep Crawling

1. **Add menu-specific patterns to `deepScraper.ts`**
   - Make `extractNavigationLinks()` configurable with pattern sets
   - Add "menu patterns" as an option

2. **Replace `extractMenuItemsMultiPage()` internals**
   - Use `deepScrapeMultiplePages()` for page fetching
   - Keep menu-specific DOM parsing in `catalogueDetection.ts`

### Phase 3: Add Tests

1. **Golden URL fixtures**
   - Add 5-10 known URLs with expected extraction counts
   - Snapshot test: "URL X yields Y menu items with Z images"

2. **Regression suite**
   - Run before/after consolidation to ensure no output changes

---

## 8. Files to Modify

| File | Action |
|------|--------|
| `server/utils/mediaFilter.ts` | CREATE - shared blocklist |
| `server/services/catalogueDetection.ts` | MODIFY - remove puppeteer.launch, import deepScraper |
| `server/services/deepScraper.ts` | MODIFY - add configurable link patterns |
| `server/previewHelpers.ts` | MODIFY - use shared mediaFilter |
| `server/routes.ts` | MODIFY - use shared mediaFilter, enforce quality gate |

---

## 9. Do NOT Change

- `deepScraper.ts` browser singleton pattern (it's correct)
- `previewHelpers.ts` identity extraction logic
- Schema/storage layer
- Route endpoints (URLs/payloads)

---

## 10. Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 | 2-3 hours | Low (no behaviour change) |
| Phase 2 | 3-4 hours | Medium (crawling logic) |
| Phase 3 | 2-3 hours | Low (tests only) |

**Recommendation:** Complete Phase 1 before adding any new extraction features.
