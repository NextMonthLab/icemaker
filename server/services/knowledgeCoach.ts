import OpenAI from "openai";
import { storage } from "../storage";
import type { OrbitBox, OrbitDocument, OrbitKnowledgePrompt, InsertOrbitKnowledgePrompt } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type GapSource = 
  | "missing_category"
  | "thin_content"
  | "no_faq"
  | "chat_deflection"
  | "visitor_intent"
  | "missing_pricing"
  | "no_testimonials"
  | "incomplete_profile";

export type FilingDestination = 
  | "faq"
  | "box_enrichment"
  | "new_box"
  | "document"
  | "business_profile";

interface DetectedGap {
  source: GapSource;
  context: Record<string, unknown>;
  severity: number;
}

interface GeneratedQuestion {
  question: string;
  rationale: string;
  impactScore: number;
  gapSource: GapSource;
  gapContext: Record<string, unknown>;
  suggestedDestination: FilingDestination;
  suggestedBoxId?: number;
}

export async function detectKnowledgeGaps(businessSlug: string): Promise<DetectedGap[]> {
  const gaps: DetectedGap[] = [];
  
  const boxes = await storage.getOrbitBoxes(businessSlug, true);
  const documents = await storage.getOrbitDocuments(businessSlug);
  const meta = await storage.getOrbitMeta(businessSlug);
  
  const faqBoxes = boxes.filter(b => b.boxType === "faq");
  const productBoxes = boxes.filter(b => b.boxType === "product" || b.boxType === "menu_item");
  const testimonialBoxes = boxes.filter(b => b.boxType === "testimonial");
  const teamBoxes = boxes.filter(b => b.boxType === "team_member");
  const profileBoxes = boxes.filter(b => b.boxType === "business_profile");
  
  if (faqBoxes.length === 0) {
    gaps.push({
      source: "no_faq",
      context: { message: "No FAQ content found" },
      severity: 8,
    });
  } else if (faqBoxes.length < 3) {
    gaps.push({
      source: "thin_content",
      context: { category: "faq", count: faqBoxes.length, recommended: 5 },
      severity: 5,
    });
  }
  
  if (testimonialBoxes.length === 0) {
    gaps.push({
      source: "no_testimonials",
      context: { message: "No testimonials or reviews found" },
      severity: 6,
    });
  }
  
  const itemsWithoutPrice = productBoxes.filter(b => !b.price || b.price === "0" || b.price === "");
  if (itemsWithoutPrice.length > 0) {
    gaps.push({
      source: "missing_pricing",
      context: { 
        count: itemsWithoutPrice.length,
        items: itemsWithoutPrice.slice(0, 3).map(b => ({ id: b.id, title: b.title }))
      },
      severity: 7,
    });
  }
  
  const itemsWithThinContent = productBoxes.filter(b => {
    const descLen = (b.description || "").length;
    return descLen < 50;
  });
  if (itemsWithThinContent.length > 0) {
    gaps.push({
      source: "thin_content",
      context: {
        category: "products_services",
        count: itemsWithThinContent.length,
        items: itemsWithThinContent.slice(0, 3).map(b => ({ id: b.id, title: b.title }))
      },
      severity: 6,
    });
  }
  
  const hasAbout = profileBoxes.length > 0 || meta?.customDescription;
  const hasContact = boxes.some(b => b.boxType === "contact");
  const hasHours = boxes.some(b => b.boxType === "opening_hours");
  
  const missingCategories: string[] = [];
  if (!hasAbout) missingCategories.push("about/business profile");
  if (!hasContact) missingCategories.push("contact information");
  if (!hasHours) missingCategories.push("opening hours");
  
  if (missingCategories.length > 0) {
    gaps.push({
      source: "missing_category",
      context: { categories: missingCategories },
      severity: 7,
    });
  }
  
  if (teamBoxes.length === 0 && profileBoxes.length > 0) {
    gaps.push({
      source: "incomplete_profile",
      context: { message: "No team member information" },
      severity: 4,
    });
  }
  
  return gaps.sort((a, b) => b.severity - a.severity);
}

export async function generateKnowledgeQuestions(
  businessSlug: string,
  gaps: DetectedGap[],
  maxQuestions: number = 3
): Promise<GeneratedQuestion[]> {
  if (gaps.length === 0) {
    return [];
  }
  
  const meta = await storage.getOrbitMeta(businessSlug);
  const businessName = meta?.customTitle || businessSlug;
  const businessType = "business";
  
  const gapSummary = gaps.slice(0, 5).map(gap => {
    switch (gap.source) {
      case "no_faq":
        return "No FAQ content - visitors may have common questions unanswered";
      case "thin_content":
        return `Thin content in ${(gap.context as { category?: string }).category || 'some areas'} - ${(gap.context as { count?: number }).count || 'several'} items need more detail`;
      case "no_testimonials":
        return "No testimonials - social proof helps build trust";
      case "missing_pricing":
        return `${(gap.context as { count?: number }).count || 'Some'} products/services missing price information`;
      case "missing_category":
        return `Missing information: ${((gap.context as { categories?: string[] }).categories || []).join(", ")}`;
      case "incomplete_profile":
        return "Business profile incomplete - missing team or key details";
      default:
        return `Knowledge gap: ${gap.source}`;
    }
  }).join("\n- ");

  const prompt = `You are a Knowledge Coach helping "${businessName}" (a ${businessType}) improve their AI-powered business presence.

Based on these knowledge gaps, generate ${maxQuestions} specific, actionable questions to ask the business owner:

Gaps identified:
- ${gapSummary}

For each question:
1. Be specific and conversational - address the business owner directly
2. Focus on information that would help visitors/customers
3. Explain briefly why this matters (the impact)
4. Suggest where the answer should be filed (faq, product description, business profile, etc.)

Respond with a JSON array of questions in this format:
[{
  "question": "The specific question to ask",
  "rationale": "Why this information matters for the business",
  "impactScore": 1-10 (how much this will improve the Orbit),
  "gapSource": "which gap this addresses",
  "suggestedDestination": "faq" | "box_enrichment" | "new_box" | "document" | "business_profile"
}]

Only return valid JSON array, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Failed to parse questions JSON:", content);
      return [];
    }

    const questions = JSON.parse(jsonMatch[0]) as Array<{
      question: string;
      rationale: string;
      impactScore: number;
      gapSource: string;
      suggestedDestination: string;
    }>;

    return questions.slice(0, maxQuestions).map((q, idx) => ({
      question: q.question,
      rationale: q.rationale,
      impactScore: Math.min(10, Math.max(1, q.impactScore || 5)),
      gapSource: (gaps[idx]?.source || "thin_content") as GapSource,
      gapContext: gaps[idx]?.context || {},
      suggestedDestination: (q.suggestedDestination || "faq") as FilingDestination,
    }));
  } catch (error) {
    console.error("Failed to generate knowledge questions:", error);
    return [];
  }
}

export function getCurrentWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(diff / oneWeek) + 1;
}

export async function generateWeeklyPrompts(
  businessSlug: string,
  tier: "grow" | "intelligence"
): Promise<OrbitKnowledgePrompt[]> {
  const maxQuestions = tier === "intelligence" ? 5 : 3;
  const weekNumber = getCurrentWeekNumber();
  
  const existingPrompts = await storage.getWeeklyKnowledgePrompts(businessSlug, weekNumber);
  if (existingPrompts.length > 0) {
    return existingPrompts;
  }
  
  const gaps = await detectKnowledgeGaps(businessSlug);
  const questions = await generateKnowledgeQuestions(businessSlug, gaps, maxQuestions);
  
  if (questions.length === 0) {
    return [];
  }
  
  const batchId = `${businessSlug}-${weekNumber}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  
  const promptsToInsert: InsertOrbitKnowledgePrompt[] = questions.map(q => ({
    businessSlug,
    question: q.question,
    rationale: q.rationale,
    impactScore: q.impactScore,
    gapSource: q.gapSource,
    gapContext: q.gapContext,
    suggestedDestination: q.suggestedDestination,
    suggestedBoxId: q.suggestedBoxId,
    status: "pending" as const,
    weekNumber,
    batchId,
    expiresAt,
  }));
  
  const createdPrompts = await storage.createKnowledgePrompts(promptsToInsert);
  return createdPrompts;
}

export async function processAnswer(
  promptId: number,
  answerText: string,
  filedDestination: FilingDestination,
  filedBoxId?: number
): Promise<{ success: boolean; message: string }> {
  const prompt = await storage.getKnowledgePrompt(promptId);
  if (!prompt) {
    return { success: false, message: "Prompt not found" };
  }
  
  if (prompt.status !== "pending") {
    return { success: false, message: "Prompt already processed" };
  }
  
  try {
    switch (filedDestination) {
      case "faq":
        await storage.createOrbitBox({
          businessSlug: prompt.businessSlug,
          boxType: "faq",
          title: prompt.question,
          description: answerText,
          isVisible: true,
          sortOrder: 0,
        });
        break;
        
      case "box_enrichment":
        if (filedBoxId) {
          const box = await storage.getOrbitBox(filedBoxId);
          if (box) {
            const newDescription = box.description 
              ? `${box.description}\n\n${answerText}`
              : answerText;
            await storage.updateOrbitBox(filedBoxId, { description: newDescription });
          }
        }
        break;
        
      case "new_box":
        await storage.createOrbitBox({
          businessSlug: prompt.businessSlug,
          boxType: "faq",
          title: prompt.question,
          description: answerText,
          isVisible: true,
          sortOrder: 0,
        });
        break;
        
      case "business_profile":
        const meta = await storage.getOrbitMeta(prompt.businessSlug);
        if (meta) {
          const existingDesc = meta.customDescription || "";
          await storage.updateOrbitMeta(prompt.businessSlug, {
            customDescription: existingDesc ? `${existingDesc}\n\n${answerText}` : answerText,
          });
        }
        break;
        
      case "document":
        // Create as a text/content box since we don't have an actual file to upload
        await storage.createOrbitBox({
          businessSlug: prompt.businessSlug,
          boxType: "text",
          title: `Knowledge: ${prompt.question.slice(0, 50)}${prompt.question.length > 50 ? '...' : ''}`,
          description: answerText,
          content: answerText,
          isVisible: true,
          sortOrder: 0,
        });
        break;
    }
    
    await storage.updateKnowledgePrompt(promptId, {
      status: "answered",
      answerText,
      filedDestination,
      filedBoxId,
      answeredAt: new Date(),
      filedAt: new Date(),
    });
    
    return { success: true, message: "Answer saved successfully" };
  } catch (error) {
    console.error("Failed to process answer:", error);
    return { success: false, message: "Failed to save answer" };
  }
}

export async function dismissPrompt(promptId: number): Promise<boolean> {
  const result = await storage.updateKnowledgePrompt(promptId, {
    status: "dismissed",
  });
  return !!result;
}
