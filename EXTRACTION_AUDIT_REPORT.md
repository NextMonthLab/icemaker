# Extraction Logic Audit Report

**Date:** January 2026  
**Auditor:** Claude Code  
**Status:** Fragmented - requires consolidation

---

## Executive Summary

Extraction logic is fragmented across **5 files** with **5 separate Puppeteer launches** and **3 different image filtering functions**. This creates unpredictable behaviour, resource waste, and maintenance burden.

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

## 2. Puppeteer Launch Locations (5 total)

| File | Line | Function | Shared? | Notes |
|------|------|----------|---------|-------|
| `deepScraper.ts` | 58 | `getBrowser()` | ✅ Yes | Singleton pattern, reuses browser |
| `catalogueDetection.ts` | 145 | `detectSiteType()` | ❌ No | Launches & closes immediately |
| `catalogueDetection.ts` | 537 | `extractCatalogueItems()` | ❌ No | Launches & closes immediately |
| `catalogueDetection.ts` | 600 | `extractMenuItems()` | ❌ No | Launches & closes immediately |
| `catalogueDetection.ts` | 684 | `extractMenuItemsMultiPage()` | ❌ No | Launches & closes immediately |

**Problem:** `catalogueDetection.ts` has 4 independent browser launches. A single Orbit generation can launch 3+ browsers sequentially, wasting resources and creating inconsistent behaviour.

---

## 3. Image Filtering Functions (3 total)

| File | Line | Function | Blocklist |
|------|------|----------|-----------|
| `previewHelpers.ts` | 284 | `extractImagePool()` | icon, logo, avatar, sprite, 1x1, visa, mastercard, paypal, payment, stripe, footer, social, facebook, twitter, instagram, linkedin |
| `routes.ts` | 7236 | `isExtractionBadImage()` | visa, mastercard, paypal, payment, pp-card, stripe, footer, social, facebook, twitter, instagram, linkedin, icon, logo, avatar, sprite, 1x1, pixel, blank, loading, spinner, placeholder, amex, discover |
| `catalogueDetection.ts` | 1090 | `isPaymentOrBadImage()` | visa, mastercard, paypal, payment, card, stripe, footer, social, facebook, twitter, instagram, linkedin, icon, logo, avatar, sprite, 1x1, pixel, blank, loading, spinner, placeholder |

**Problem:** Three separate blocklists with slight variations. Changes to one won't propagate to others.

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
| `catalogueDetection.ts` | `detectSiteFingerprint()` | ❌ Exported but never called |
| `catalogueDetection.ts` | `validateExtractionQuality()` | ⚠️ Called but doesn't gate persistence |
| `catalogueDetection.ts` | `getStrategiesForType()` | ❌ Exported but never called |

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

### Phase 1: Stop the Bleeding (No Behaviour Change)

1. **Create shared media filter**
   - Create `server/utils/mediaFilter.ts`
   - Move blocklist logic from all 3 locations
   - Update `previewHelpers.ts`, `routes.ts`, `catalogueDetection.ts` to import it

2. **Make `catalogueDetection.ts` use `deepScraper.ts` for browser**
   - Remove all 4 `puppeteer.launch()` calls
   - Import `deepScrapeUrl()` from deepScraper
   - Pass HTML to detection/extraction functions instead of Page objects

3. **Wire `validateExtractionQuality()` as a real gate**
   - Return `quality.passed` must block persistence when false
   - Log recommendations for fallback (AI extraction - future)

4. **Remove or wire `detectSiteFingerprint()`**
   - Either use it in route to influence strategy, or delete it

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
