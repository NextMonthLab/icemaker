# ORBIT INTELLIGENCE VIEW

## Design Guardrails & Phase-1 Execution Rules

**Purpose:**
Orbit Intelligence View is the primary conversion surface for businesses.
It must communicate intelligence, trust, and calm authority within seconds.

Orbit is serious software, not a demo, not a playground, and not a chatbot with flair.

This document defines non-negotiable design rules and immediate no-brainer upgrades.
All future work must comply.

---

## 1. The Orbit North-Star Principle (Non-Negotiable)

Orbit should feel like a senior analyst who organised your intelligence before you asked.
Calm. Prepared. Confident enough not to prove it.

Every pixel, animation, and AI interaction must pass this test:
- Would a CMO trust this in a boardroom?
- Would this feel appropriate after 8 hours of daily use?
- Does this reduce cognitive load rather than add to it?

**If not: do not ship.**

---

## 2. Absolute Design Guardrails (Hard Rules)

### 2.1 Restraint Over Spectacle
- Orbit must never try to look impressive.
- Orbit must feel inevitable.

No visual element should draw attention to itself unless it:
- Improves clarity, or
- Improves orientation, or
- Improves trust

---

### 2.2 Motion Has One Job: Explanation
- Motion explains state change.
- Motion never entertains.
- No idle motion.
- No looping animations.
- No background pulsing.

**Rule:**
If nothing has changed, nothing moves.

---

### 2.3 AI Presence Is Contextual, Not Constant
- The AI is a capable analyst, not a personality.
- It speaks when useful, not to reassure itself.
- It recedes when the user is thinking.

**Avoid:**
- Anthropomorphic behaviour
- "Watching you" vibes
- Chatty filler language

---

### 2.4 Orientation Is Sacred

Because Orbit is spatial and novel:
- Users must be able to re-orient in under 2 seconds
- There must always be a clear way "home"
- Context loss is unacceptable

Novel UI requires more orientation support, not less.

---

### 2.5 Enterprise Credibility Always Wins

**Avoid:**
- Bouncy or elastic easing
- Glassmorphism, neon, trendy UI fads
- Consumer-app patterns
- Demo-ware theatrics

Orbit should age like Stripe or Linear, not like a Dribbble trend.

---

## 3. Phase-1 No-Brainer Upgrades (DO THESE NOW)

These are low risk, high return, architecturally safe changes.
They should be implemented immediately before any deeper experimentation.

### 3.1 Depth Hierarchy via CSS (Mandatory)

Introduce a subtle three-tier depth system using scale, opacity, and micro-blur.

**Purpose:**
- Communicates relevance without explanation
- Creates calm spatial hierarchy
- Zero backend risk

**Constraints:**
- Max scale: 1.02–1.05
- Blur must be barely perceptible
- No physics, no dynamic movement

This should be default behaviour, not optional.

---

### 3.2 Enterprise-Grade Hover States (Mandatory)

Hover = confirmation, not excitement.

**Rules:**
- Max Y-lift: 2px
- Soft shadow expansion only
- 200ms ease-out timing

Hover should say:
> "This is interactive and solid."

Not:
> "Look at me."

---

### 3.3 Unified Transition Timing Tokens (Mandatory)

Inconsistent timing destroys perceived quality.

Adopt a single timing system:
- Hover / focus: 100–150ms
- Panel transitions: 200–250ms
- View changes: 250–300ms
- Absolute max for anything: 400ms

Exits must always be slightly faster than entrances.

---

### 3.4 Reduced Motion Support (Mandatory)

Orbit must fully respect `prefers-reduced-motion`.
- No animation should be required for understanding
- Reduced motion = instant state change, not broken UI

This is non-negotiable for enterprise adoption.

---

### 3.5 Elevated AI Tone & Language (Mandatory)

This is a copy and behaviour change, not a UI rebuild.

**Rules for AI language:**
- Confident, measured, advisory
- Never jokey
- Never over-certain
- References context naturally ("Based on what we've seen so far…")

The AI should sound like:
> A calm analyst briefing you, not a chatbot waiting for praise.

---

### 3.6 First-30-Seconds Trust Stack (Mandatory)

On first load, Orbit must immediately communicate:

1. **What this is**
   Use grounded language like:
   "Intelligence command centre"
   not "spatial AI interface".

2. **Who trusts it**
   - 3–4 monochrome logos
   - Or one strong social proof metric

3. **That it's alive**
   - Never show an empty state
   - Always preload a meaningful demo configuration

4. **What to do next**
   - One clear CTA only
   - No choice paralysis

This is critical because Orbit is unfamiliar.
Trust must precede exploration.

---

## 4. Explicitly NOT in Phase-1 (Hold in Mind)

The following are valid ideas but must not be implemented yet:
- Three-state AI presence system
- Contextual AI tile highlighting
- Progressive disclosure hover-depth layers
- AI confidence metrics or source explainability
- Minimap / zoom indicators (unless disorientation is observed)

These stay in memory, not in code, until:
- Real usage data exists
- Orientation and trust are proven solid

---

## 5. Validation Checklist (Before Any Change Ships)

Every Orbit change must pass these tests:
- **8-Hour Test:** Would this feel right after a full workday?
- **Boardroom Test:** Would a CMO show this to a CEO?
- **Interruption Test:** Can users re-orient in under 2 seconds?
- **Minimum Spec Test:** Smooth on a 5-year-old laptop with 40 tabs?
- **Reduced Motion Test:** Fully usable without animation?

If any answer is "no" → revise or reject.

---

## 6. Final Rule for Claude & Replit Agents

When modifying Orbit Intelligence View, prioritise clarity, trust, and orientation over novelty.
Reject consumer UI patterns, idle motion, anthropomorphic AI behaviour, and demo-ware effects.
Orbit is serious software for serious decisions.

---

**End of Guardrails**

Everything else remains intentionally held back.
