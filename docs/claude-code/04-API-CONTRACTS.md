# API Contracts

## Overview

All API endpoints are defined in `server/routes.ts`. This document covers the most critical endpoints used by the frontend.

---

## Authentication Endpoints

### POST /api/auth/register
**Purpose**: Create new user account
**Auth**: None (public)
**Request**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```
**Response (201)**:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "role": "viewer"
}
```
**Errors**: 400 (validation), 409 (username/email exists)

### POST /api/auth/login
**Purpose**: Authenticate user
**Auth**: None (public)
**Request**:
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```
**Response (200)**:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "role": "creator"
}
```
**Errors**: 401 (invalid credentials)

### POST /api/auth/logout
**Purpose**: End session
**Auth**: Session cookie
**Response (200)**:
```json
{ "message": "Logged out" }
```

### GET /api/auth/me
**Purpose**: Get current user
**Auth**: Session cookie
**Response (200)**: User object
**Response (401)**:
```json
{ "message": "Not authenticated" }
```

---

## ICE Preview Endpoints (Core)

### POST /api/ice/preview/upload
**Purpose**: Upload content file to create ICE
**Auth**: Optional (guest allowed)
**Content-Type**: multipart/form-data
**Request**: Form data with `file` field
**Response (200)**:
```json
{
  "id": "abc123-uuid",
  "title": "Extracted Title",
  "cards": [...],
  "characters": [],
  "projectBible": {...},
  "status": "draft"
}
```

### POST /api/ice/preview/brief
**Purpose**: Upload Producer Brief document
**Auth**: Required
**Content-Type**: multipart/form-data
**Request**: Form data with `file` field (.docx, .txt, .md)
**Response (200)**:
```json
{
  "id": "abc123-uuid",
  "title": "Brief Title",
  "cards": [
    {
      "id": "card-1",
      "title": "Scene 1",
      "sceneText": "Content...",
      "visualPrompt": "A cinematic shot of...",
      "videoPrompt": null
    }
  ],
  "projectBible": {...}
}
```

### GET /api/ice/preview/:id
**Purpose**: Get ICE preview details
**Auth**: Public (or owner for draft)
**Response (200)**:
```json
{
  "id": "abc123-uuid",
  "title": "My ICE",
  "description": "Description...",
  "cards": [...],
  "characters": [...],
  "projectBible": {...},
  "visibility": "public",
  "publishedAt": "2024-01-14T12:00:00Z",
  "status": "published",
  "ownerUserId": 1
}
```
**Errors**: 404 (not found), 403 (private + not owner)

### PUT /api/ice/preview/:id/cards
**Purpose**: Update all cards in ICE
**Auth**: Owner or admin
**Request**:
```json
{
  "cards": [
    {
      "id": "card-1",
      "title": "Updated Title",
      "sceneText": "Updated content...",
      "imageUrl": "https://...",
      "captionEnabled": true
    }
  ]
}
```
**Response (200)**: Updated ICE preview object

### DELETE /api/ice/preview/:id
**Purpose**: Delete ICE preview
**Auth**: Owner or admin
**Response (200)**:
```json
{ "message": "Preview deleted" }
```

### GET /api/ice/my-previews
**Purpose**: Get current user's ICE library
**Auth**: Required
**Response (200)**:
```json
[
  {
    "id": "abc123",
    "title": "My First ICE",
    "status": "published",
    "createdAt": "2024-01-14T12:00:00Z"
  }
]
```

---

## Media Generation Endpoints

### POST /api/cards/:id/image/generate
**Purpose**: Generate image for card
**Auth**: Owner
**Request**:
```json
{
  "iceId": "ice-uuid",
  "prompt": "A cinematic shot of a coffee shop interior"
}
```
**Response (200)**:
```json
{
  "imageUrl": "https://storage.../image.png",
  "card": { ... }
}
```
**Errors**: 402 (quota exceeded), 503 (generation failed)

### POST /api/cards/:id/video/generate
**Purpose**: Start video generation for card
**Auth**: Owner
**Request**:
```json
{
  "iceId": "ice-uuid",
  "prompt": "Camera slowly pans across the scene"
}
```
**Response (200)**:
```json
{
  "taskId": "kling-task-123",
  "status": "pending"
}
```

### GET /api/cards/:id/video/status
**Purpose**: Check video generation status
**Auth**: Owner
**Query**: `?iceId=xxx&taskId=yyy`
**Response (200)**:
```json
{
  "status": "completed",
  "videoUrl": "https://storage.../video.mp4"
}
```
**Status values**: `pending`, `processing`, `completed`, `failed`

### POST /api/cards/:id/narration/generate
**Purpose**: Generate TTS narration for card
**Auth**: Owner
**Request**:
```json
{
  "iceId": "ice-uuid",
  "text": "The text to speak...",
  "voice": "alloy",
  "speed": 1.0
}
```
**Response (200)**:
```json
{
  "narrationUrl": "https://storage.../audio.mp3",
  "card": { ... }
}
```

---

## AI Character Chat Endpoints

### POST /api/ice/preview/:id/chat
**Purpose**: Send message to AI character
**Auth**: Public (rate limited)
**Request**:
```json
{
  "characterId": 1,
  "message": "Hello, tell me more about yourself",
  "cardIndex": 2,
  "sessionId": "viewer-session-uuid"
}
```
**Response (200)**:
```json
{
  "response": "Hello! I'm happy to share...",
  "messageId": "msg-uuid",
  "remainingMessages": 15
}
```
**Errors**: 429 (rate limit), 402 (conversation limit)

### POST /api/ice/preview/:id/characters
**Purpose**: Add AI character to ICE
**Auth**: Owner
**Request**:
```json
{
  "name": "Alex",
  "role": "Friendly Guide",
  "systemPrompt": "You are Alex, a helpful guide...",
  "avatar": "https://..."
}
```
**Response (200)**: Updated ICE with new character

---

## Billing Endpoints

### GET /api/plans
**Purpose**: Get available subscription plans
**Auth**: None (public)
**Response (200)**:
```json
[
  {
    "id": 1,
    "name": "Creator",
    "priceMonthly": 19,
    "features": {...}
  }
]
```

### GET /api/subscription
**Purpose**: Get current user's subscription status
**Auth**: Required
**Response (200)**:
```json
{
  "planId": 2,
  "planName": "Creator",
  "status": "active",
  "currentPeriodEnd": "2024-02-14T12:00:00Z"
}
```

### POST /api/checkout
**Purpose**: Create Stripe checkout session
**Auth**: Required
**Request**:
```json
{
  "planId": 2,
  "iceId": "optional-ice-uuid"
}
```
**Response (200)**:
```json
{
  "sessionId": "cs_live_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

## Admin Endpoints

### GET /api/admin/stats
**Purpose**: Get platform statistics
**Auth**: Admin only
**Response (200)**:
```json
{
  "totalUsers": 1500,
  "totalICEs": 3200,
  "activeSubscriptions": 450
}
```

### POST /api/admin/previews/:id/emergency-archive
**Purpose**: Archive problematic ICE
**Auth**: Admin only
**Request**:
```json
{
  "reason": "Policy violation - inappropriate content"
}
```
**Response (200)**:
```json
{ "message": "Preview archived", "id": "abc123" }
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "message": "Human-readable error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | VALIDATION_ERROR | Request body invalid |
| 401 | NOT_AUTHENTICATED | Login required |
| 403 | ACCESS_DENIED | Permission denied |
| 404 | NOT_FOUND | Resource doesn't exist |
| 402 | QUOTA_EXCEEDED | Usage limit reached |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | External service down |

---

## Endpoint Categories

### Public Endpoints (no auth)
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/plans`
- `GET /api/ice/preview/:id` (if public/unlisted)
- `POST /api/public/analytics/event`

### Authenticated Endpoints (requireAuth)
- All `/api/me/*` endpoints
- `GET /api/ice/my-previews`
- `POST /api/checkout`
- Media generation endpoints
- ICE CRUD operations (own content)

### Admin Endpoints (requireAdmin)
- All `/api/admin/*` endpoints
- Universe management
- Character management
- Emergency controls

### Internal Endpoints (not for frontend)
- Stripe webhooks (`POST /api/webhooks/stripe`)
- Health checks for monitoring
