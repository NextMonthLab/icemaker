# CPAC v1.0.0 Specification

**Canonical Pulse And Content Format**

Version: 1.0.0  
Status: FROZEN  
Date: 2026-01-09

---

## Overview

CPAC (Canonical Pulse And Content) is the seed pack format for Industry Orbits. It provides a structured, validated approach to populating industry intelligence spaces with entities, products, reviews, communities, tiles, and pulse sources.

Industry Orbits are neutral, unowned public intelligence spaces that cannot be claimed by users. All content is ingested exclusively via CPAC format.

---

## Format Structure

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `formatVersion` | string | Yes | Must be "1.0.0" |
| `cpacVersion` | string | No | Alias for formatVersion |
| `packType` | string | No | "seed", "update", "patch" |
| `generatedAt` | ISO8601 | No | Timestamp of pack generation |
| `sourceAgent` | object | No | Agent/model that generated the pack |
| `orbit` | object | No | Orbit configuration |
| `seedPack` | object | No | Core concepts and starter tiles |
| `entities` | array | No | Manufacturers, reviewers, organizations |
| `products` | array | No | Product catalog |
| `reviews` | array | No | External reviews |
| `communities` | array | No | Community links |
| `tiles` | array | No | Topic tiles |
| `assets` | array | No | Media asset references |
| `pulse` | object | No | Pulse sources and monitoring rules |
| `governance` | object | No | Neutrality and data quality rules |

### Field Naming

CPAC accepts both camelCase and snake_case for all fields. Examples:
- `entityType` or `entity_type`
- `manufacturerEntityId` or `manufacturer_entity_id`
- `websiteUrl` or `website_url`

---

## Entity Schema

```json
{
  "id": "meta-reality-labs",
  "name": "Meta Reality Labs",
  "entityType": "manufacturer",
  "description": "Meta's AR/VR hardware division",
  "websiteUrl": "https://about.meta.com/realitylabs/",
  "regionTags": ["us", "global"],
  "trustLevel": "verified",
  "logoAssetRef": "asset:meta-logo",
  "socialUrls": {
    "x": "https://x.com/meta",
    "linkedin": "https://linkedin.com/company/meta",
    "youtube": "https://youtube.com/@meta",
    "instagram": "https://instagram.com/meta"
  },
  "notes": "Parent company of Ray-Ban Meta smart glasses line"
}
```

### Entity Types (Enum)

- `manufacturer` - Hardware/product manufacturers
- `reviewer` - Review publications/individuals
- `investor` - Investment entities
- `standards_body` - Standards organizations
- `media` - Media outlets
- `other` - Other entity types

### Trust Levels (Enum)

- `verified` - Officially verified entity
- `established` - Well-known, established entity
- `emerging` - Newer or less established
- `unverified` - Not yet verified

---

## Product Schema

```json
{
  "id": "ray-ban-meta-wayfarer",
  "name": "Ray-Ban Meta Wayfarer",
  "manufacturerEntityId": "meta-reality-labs",
  "category": "consumer",
  "status": "shipping",
  "releaseDate": "2023-09-17",
  "primaryUrl": "https://www.ray-ban.com/meta-smart-glasses",
  "summary": "Smart glasses with camera, speakers, and Meta AI assistant",
  "heroAssetRef": "asset:rayban-meta-hero",
  "mediaRefs": {
    "imageAssetRefs": ["asset:rayban-front", "asset:rayban-side"],
    "videoAssetRefs": ["asset:rayban-demo-video"]
  },
  "referenceUrls": [
    "https://about.meta.com/realitylabs/smartglasses/"
  ],
  "intentTags": ["casual", "photography", "ai-assistant"],
  "specs": [
    {
      "specKey": "camera_resolution",
      "specValue": "12",
      "specUnit": "MP",
      "sourceUrl": "https://www.ray-ban.com/meta-specs"
    },
    {
      "specKey": "battery_life",
      "specValue": "4",
      "specUnit": "hours"
    }
  ]
}
```

### Product Categories (Enum)

- `consumer` - Consumer-focused products
- `enterprise` - Enterprise/business products
- `developer` - Developer kits and tools
- `medical` - Medical/healthcare devices
- `industrial` - Industrial applications
- `military` - Defense/military products

### Product Status (Enum)

- `shipping` - Currently available for purchase
- `preorder` - Available for pre-order
- `announced` - Announced but not yet available
- `rumored` - Rumored/leaked product
- `discontinued` - No longer sold
- `prototype` - Prototype/demo only
- `unknown` - Status unknown

---

## Review Schema

```json
{
  "id": "verge-rayban-meta-review-2024",
  "title": "Ray-Ban Meta review: the AI glasses that actually work",
  "url": "https://www.theverge.com/reviews/rayban-meta",
  "productId": "ray-ban-meta-wayfarer",
  "reviewerEntityId": "the-verge",
  "publishedAt": "2024-04-15",
  "ratingValue": 8.5,
  "ratingScale": 10,
  "summary": "Comprehensive review of Meta's latest smart glasses",
  "sentiment": "positive"
}
```

### Sentiment Values (Enum)

- `positive`
- `negative`
- `mixed`
- `unknown`

---

## Community Schema

```json
{
  "id": "reddit-smartglasses",
  "name": "r/smartglasses",
  "url": "https://reddit.com/r/smartglasses",
  "communityType": "reddit",
  "regionTags": ["global"],
  "notes": "Main Reddit community for smart glasses discussion"
}
```

### Community Types (Enum)

- `reddit` - Reddit subreddits
- `discord` - Discord servers
- `forum` - Traditional forums
- `facebook` - Facebook groups
- `linkedin` - LinkedIn groups
- `other` - Other community types

---

## Tile Schema

```json
{
  "id": "tile-best-for-outdoor",
  "label": "Best for Outdoor Photography",
  "sublabel": "Top picks for outdoor use",
  "intentTags": ["photography", "outdoor"],
  "priority": 10,
  "badgeState": {
    "new": false,
    "trending": true,
    "debated": false,
    "updatedRecently": true
  },
  "evidenceRefs": {
    "productIds": ["ray-ban-meta-wayfarer", "xreal-air-2"],
    "entityIds": ["meta-reality-labs"],
    "communityIds": []
  }
}
```

---

## Pulse Source Schema

```json
{
  "id": "verge-smart-glasses-feed",
  "name": "The Verge - Smart Glasses",
  "sourceType": "news",
  "url": "https://www.theverge.com/smart-glasses",
  "rssUrl": "https://www.theverge.com/rss/smart-glasses.xml",
  "monitoringMethod": "rss",
  "updateFrequency": "daily",
  "trustLevel": "high",
  "eventTypes": ["product_launch", "review", "news"],
  "isEnabled": true,
  "keywordTriggers": ["smart glasses", "AR glasses", "Meta Ray-Ban"],
  "notes": "Primary tech news source for smart glasses coverage"
}
```

### Source Types (Enum)

- `news` - News publications
- `blog` - Blogs
- `youtube` - YouTube channels
- `podcast` - Podcasts
- `social` - Social media accounts
- `official` - Official manufacturer sources
- `other` - Other source types

### Monitoring Methods (Enum)

- `rss` - RSS feed polling
- `scrape` - Web scraping
- `api` - API integration
- `manual` - Manual updates

### Update Frequencies (Enum)

- `realtime` - Real-time updates
- `hourly` - Hourly updates
- `daily` - Daily updates
- `weekly` - Weekly updates
- `monthly` - Monthly updates

### Trust Levels (Enum)

- `high` - Highly trusted source
- `medium` - Moderately trusted
- `low` - Less trusted, requires verification
- `unverified` - Not yet verified

---

## Asset Schema

```json
{
  "assetRef": "asset:rayban-meta-hero",
  "assetType": "image",
  "title": "Ray-Ban Meta Wayfarer Hero Image",
  "sourceUrl": "https://example.com/images/rayban-meta.jpg",
  "licensing": {
    "status": "pending",
    "notes": "Press image, awaiting confirmation"
  }
}
```

### Asset Types (Enum)

- `image` - Static images
- `video` - Video content
- `document` - Documents/PDFs

### Licensing Status (Enum)

- `approved` - Licensed for use
- `pending` - Awaiting approval
- `rejected` - Not licensed
- `unknown` - Status unknown

---

## Governance Section

```json
{
  "governance": {
    "neutrality": {
      "isUnowned": true,
      "sponsorsDoNotInfluenceIntelligence": true,
      "influencersDoNotPublishConclusions": true
    },
    "dataQuality": {
      "doNotInventRss": true,
      "requireSourceUrlForSpecs": true,
      "avoidFakeNumbers": true
    }
  }
}
```

---

## Quality Scoring System

### Score Calculation

| Factor | Points |
|--------|--------|
| Base score | 100 |
| Per error | -40 |
| Per CRITICAL warning | -15 |
| Per WARNING | -5 |
| Skip rate > 50% | -20 |
| Skip rate > 20% | -10 |

### Grade Scale

| Grade | Score Range |
|-------|-------------|
| A | 90-100 |
| B | 75-89 |
| C | 60-74 |
| D | 40-59 |
| F | 0-39 |

### Blocking Issues

Import is flagged with `hasBlockingIssues: true` when:
- Any errors occurred
- Any CRITICAL severity warnings exist

---

## Warning System

### Warning Codes

| Code | Description |
|------|-------------|
| `UNSUPPORTED_SECTIONS` | Pack contains unrecognized sections |
| `MISSING_MANUFACTURER_REF` | Product references non-existent entity |
| `INVALID_ENUM_VALUE` | Field contains invalid enum value |
| `SKIPPED_RECORD` | Record was skipped during import |

### Severity Levels

| Severity | Description |
|----------|-------------|
| `INFO` | Informational, no action required |
| `WARNING` | Potential issue, review recommended |
| `CRITICAL` | Blocking issue, must be resolved |

### Severity Doctrine

**CRITICAL severity is applied to:**
- `MISSING_MANUFACTURER_REF` - Products with unresolved manufacturer references are skipped

This ensures entity-product integrity is maintained for:
- Brand pages
- Product comparisons
- Sponsorship tracking
- Analytics

---

## Import Response Format

```json
{
  "success": true,
  "imported": {
    "coreConcepts": 5,
    "entities": 12,
    "products": 45,
    "productSpecs": 180,
    "reviews": 23,
    "communities": 8,
    "tiles": 15,
    "pulseSources": 10,
    "assets": 50
  },
  "skipped": {
    "products": 2,
    "entities": 0,
    "communities": 0,
    "tiles": 0,
    "pulseSources": 0
  },
  "errors": [],
  "warnings": [
    {
      "code": "MISSING_MANUFACTURER_REF",
      "severity": "CRITICAL",
      "message": "Product \"Orphan Product\" skipped: manufacturer \"nonexistent\" not found in entities",
      "path": "products[5].manufacturerEntityId",
      "suggestedFix": "Add entity with id \"nonexistent\" to entities array, or remove manufacturerEntityId from product"
    }
  ],
  "quality": {
    "score": 85,
    "grade": "B",
    "summary": "Import completed with 1 critical warning",
    "hasBlockingIssues": true
  }
}
```

---

## Publishing Gates

| Condition | Action |
|-----------|--------|
| Grade A/B + no blocking issues | Auto-publish eligible |
| Grade C or blocking issues | Draft mode, admin banner shown |
| Grade D/F | Import allowed, requires manual review |

---

## Version History

### v1.0.0 (2026-01-09)
- Initial frozen specification
- Entity, Product, Review, Community, Tile, PulseSource schemas
- Asset schema with licensing tracking
- Governance section for neutrality rules
- Quality scoring system
- Structured warning system with severity doctrine
- MISSING_MANUFACTURER_REF elevated to CRITICAL

---

## Migration Notes

### From Legacy Format

Legacy seed packs (pre-CPAC) are still supported:
- `version` field is accepted alongside `formatVersion`
- `orbitSlug` is accepted alongside `orbit.slug`
- `tiles` array is accepted (mapped to seedPack.starterTiles)
- `pulseSources` array is accepted (mapped to pulse.sources)

### Future Versions

Any future schema changes MUST be:
- **Additive only** for v1.x releases
- **Breaking changes** require v2.0.0

---

## Appendix: Complete Example

```json
{
  "formatVersion": "1.0.0",
  "packType": "seed",
  "generatedAt": "2026-01-09T12:00:00Z",
  "sourceAgent": {
    "name": "NextMonth CPAC Generator",
    "model": "gpt-4o",
    "notes": "Initial smart glasses industry seed"
  },
  "orbit": {
    "slug": "smart-glasses",
    "title": "Smart Glasses Industry",
    "summary": "Intelligence hub for smart glasses and AR eyewear",
    "regionFocus": ["global"],
    "orbitType": "industry",
    "visibility": "public"
  },
  "entities": [
    {
      "id": "meta-reality-labs",
      "name": "Meta Reality Labs",
      "entityType": "manufacturer",
      "websiteUrl": "https://about.meta.com/realitylabs/"
    }
  ],
  "products": [
    {
      "id": "ray-ban-meta-wayfarer",
      "name": "Ray-Ban Meta Wayfarer",
      "manufacturerEntityId": "meta-reality-labs",
      "category": "consumer",
      "status": "shipping",
      "specs": [
        {
          "specKey": "camera_resolution",
          "specValue": "12",
          "specUnit": "MP"
        }
      ]
    }
  ],
  "communities": [
    {
      "id": "reddit-smartglasses",
      "name": "r/smartglasses",
      "url": "https://reddit.com/r/smartglasses",
      "communityType": "reddit"
    }
  ],
  "governance": {
    "neutrality": {
      "isUnowned": true,
      "sponsorsDoNotInfluenceIntelligence": true
    }
  }
}
```
