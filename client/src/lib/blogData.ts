export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: "Corporate Training" | "Sales Enablement" | "Product Marketing" | "How-To";
  date: string;
  readingTime: string;
  heroSummary: string;
  body: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "compliance-deck-to-interactive-training",
    title: "From compliance deck to interactive training: a practical starter guide",
    excerpt: "How to turn a policy pack into an experience people actually complete — without rebuilding from scratch.",
    category: "Corporate Training",
    date: "2026-01-10",
    readingTime: "6 min read",
    heroSummary: "A step-by-step guide for L&D teams looking to transform static compliance content into engaging, interactive experiences.",
    body: `
## Why decks fail

Static slide decks have a fundamental problem: they're designed for the presenter, not the learner. When someone clicks through a compliance deck alone, they're missing context, unable to ask questions, and incentivised to skim.

The result? Low completion rates, poor retention, and the same questions landing in HR's inbox week after week.

## The scene-based approach

IceMaker structures content into scenes rather than slides. Each scene has pacing, visual context, and an opportunity for interaction. This isn't about adding animation — it's about creating moments where attention is naturally held.

A 40-slide policy deck becomes 8-12 scenes, each with a clear purpose and a natural pause point.

## Where to place interactive moments

The most effective interactive moments are:

- **After key policy points** — let the learner confirm understanding
- **At decision points** — "What would you do in this scenario?"
- **When complexity increases** — allow questions before moving on

The guide doesn't lecture. It waits for the learner to engage.

## Boundaries: keeping answers grounded

The critical difference between IceMaker and a generic chatbot is source-grounding. Your guide only answers from the material you've approved. If someone asks about something outside the policy, the guide acknowledges the limit.

This is essential for compliance training, where improvised answers can create liability.

## Publish and measure

Once your experience is ready, publish a link or embed it directly. Track completion rates, time spent, and questions asked. Use this data to refine boundaries and identify where learners get stuck.

No LMS replacement required — IceMaker creates the experience, and you decide how to distribute it.
    `,
  },
  {
    slug: "source-grounded-explained",
    title: "Not a chatbot, not a slideshow: what 'source-grounded' actually means",
    excerpt: "A plain-English explanation of grounded responses, boundaries, and why it matters.",
    category: "How-To",
    date: "2026-01-08",
    readingTime: "5 min read",
    heroSummary: "Understanding the difference between open-web AI and source-grounded responses — and why it matters for accuracy and trust.",
    body: `
## What goes wrong with generic AI

When you use a general-purpose AI chatbot, it draws from everything it was trained on — the entire internet, essentially. This creates problems:

- **Hallucination** — confident answers that are simply wrong
- **Inconsistency** — different answers to the same question
- **Uncontrolled scope** — answers about topics you never intended to cover

For training, sales enablement, or any context where accuracy matters, this is a liability.

## Grounded vs open-web answers

Source-grounded means the AI can only reference the material you've explicitly provided. If your compliance policy doesn't mention remote work, the guide won't improvise an answer about remote work.

This isn't a limitation — it's a feature. It means you can trust the answers, and so can your learners.

## Knowledge boundaries

IceMaker lets you set boundaries at different levels:

- **Document-level** — the guide knows the entire uploaded source
- **Chapter-level** — unlock knowledge progressively as learners advance
- **Scene-level** — fine-grained control for sensitive topics

This is particularly useful for onboarding (don't reveal everything on day one) or regulated content (only discuss certain topics after prerequisites are complete).

## Auditability and control

Every question asked and answer given is logged. You can review interactions, identify patterns, and refine boundaries. If learners consistently ask about something outside scope, you know what to add to the source material.

This creates a feedback loop that improves your training over time — without requiring constant manual updates.
    `,
  },
  {
    slug: "sales-enablement-replace-pdf",
    title: "Sales enablement that gets used: replace the PDF with an experience",
    excerpt: "A better way to educate prospects and shorten time-to-understanding.",
    category: "Sales Enablement",
    date: "2026-01-05",
    readingTime: "5 min read",
    heroSummary: "Why static sales collateral sits unread, and how interactive experiences can shorten the sales cycle.",
    body: `
## Why collateral sits unread

Sales teams spend hours creating PDFs, one-pagers, and pitch decks. Prospects download them, skim the first page, and move on. The information is there, but the format doesn't invite engagement.

The problem isn't the content — it's that prospects want answers to their specific questions, not a document to read.

## Interactive moments that convert

An IceMaker experience lets prospects explore at their own pace and ask questions along the way. Instead of reading about your pricing model, they ask the guide directly. Instead of hunting for the security section, they get a direct answer.

This isn't about replacing human sales conversations — it's about making sure prospects arrive at those conversations already informed.

## Common objections and how the guide handles them

You can train your guide to handle frequent objections within the source material:

- **"Is this secure?"** — Guide references your security documentation
- **"How does pricing work?"** — Guide explains tiers from your pricing page
- **"Do you integrate with X?"** — Guide answers based on your integrations list

The guide stays on-message because it only knows what you've told it.

## Embed + share playbook

For maximum impact:

1. **Embed on landing pages** — let prospects engage before filling out a form
2. **Share post-demo** — replace the PDF follow-up with an interactive experience
3. **Use for internal enablement** — train your own team the same way you train prospects

Track which questions get asked most often. This is real-time intelligence about what your market cares about.
    `,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getBlogPostsByCategory(category: string): BlogPost[] {
  if (category === "All") return blogPosts;
  return blogPosts.filter((post) => post.category === category);
}

export const categories = ["All", "Corporate Training", "Sales Enablement", "Product Marketing", "How-To"] as const;
