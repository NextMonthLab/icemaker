import { storage } from "../storage";
import { StageArtifacts, StageStatuses, TransformationJob, SourceType } from "@shared/schema";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { harvestImagesFromUrl, DownloadedImage } from "../imageExtractor";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface SourceGuardrails {
  coreThemes: string[];
  toneConstraints: string[];
  factualBoundaries: string[];
  exclusions: string[];
  quotableElements: string[];
  sensitiveTopics: string[];
  creativeLatitude: "strict" | "moderate" | "liberal";
  groundingStatement: string;
}

export interface PipelineContext {
  jobId: number;
  normalizedText?: string;
  sourceType?: SourceType;
  structureSummary?: string;
  voiceNotes?: string;
  keySections?: string[];
  themeStatement?: string;
  toneTags?: string[];
  genreGuess?: string;
  audienceGuess?: string;
  guardrails?: SourceGuardrails;
  characters?: Array<{ id: string; name: string; role?: string; description?: string }>;
  locations?: Array<{ id: string; name: string; description?: string }>;
  worldRules?: string[];
  cardPlan?: Array<{ 
    dayIndex: number; 
    title: string; 
    intent?: string; 
    sceneText?: string;
    captions?: string[];
    imagePrompt?: string;
  }>;
  hookPackCount?: number;
  releaseMode?: string;
  storyTitle?: string;
  storyLength?: "short" | "medium" | "long";
}

const STAGE_NAMES = [
  "Normalising your input",
  "Reading the material",
  "Identifying the story",
  "Extracting the world",
  "Shaping the moments",
  "Crafting the experience",
];

async function updateJobStage(
  jobId: number,
  stage: number,
  stageStatus: "pending" | "running" | "done" | "failed",
  artifacts?: Partial<StageArtifacts>,
  error?: { user: string; dev: string }
): Promise<void> {
  const job = await storage.getTransformationJob(jobId);
  if (!job) return;

  const stageStatuses = { ...(job.stageStatuses as StageStatuses) };
  const stageKey = `stage${stage}` as keyof StageStatuses;
  stageStatuses[stageKey] = stageStatus;

  const currentArtifacts = { ...(job.artifacts as StageArtifacts || {}) };
  if (artifacts) {
    Object.assign(currentArtifacts, artifacts);
  }

  const updates: any = {
    stageStatuses,
    artifacts: currentArtifacts,
    currentStage: stage,
  };

  if (stageStatus === "running") {
    updates.status = "running";
  } else if (stageStatus === "failed") {
    updates.status = "failed";
    updates.errorMessageUser = error?.user || "An unexpected error occurred.";
    updates.errorMessageDev = error?.dev || "Unknown error";
  }

  await storage.updateTransformationJob(jobId, updates);
}

async function callAI(systemPrompt: string, userPrompt: string, jsonMode = true): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: jsonMode ? { type: "json_object" } : undefined,
    max_tokens: 4096,
  });
  
  const content = response.choices[0]?.message?.content || "";
  if (!content) {
    throw new Error("Empty response from AI");
  }
  return content;
}

export async function stage0_normalise(ctx: PipelineContext, sourceText: string): Promise<void> {
  await updateJobStage(ctx.jobId, 0, "running");

  try {
    const detectedType: SourceType = detectContentType(sourceText);
    const lines = sourceText.split("\n").filter((l) => l.trim());
    
    const cleanedText = sourceText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    ctx.normalizedText = cleanedText;
    ctx.sourceType = detectedType;

    await updateJobStage(ctx.jobId, 0, "done", {
      stage0: {
        detected_type: detectedType,
        parse_confidence: 0.95,
        outline_count: lines.length,
      },
    });
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 0, "failed", undefined, {
      user: "We couldn't process your input. Try a different format.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

export async function stage1_read(ctx: PipelineContext): Promise<void> {
  await updateJobStage(ctx.jobId, 1, "running");

  try {
    const text = ctx.normalizedText || "";
    
    const systemPrompt = `You are a story analyst. Analyze the provided script/story and extract its structure.
Return a JSON object with these fields:
- structure_summary: A 1-2 sentence description of the narrative structure
- voice_notes: The tone and voice of the writing (e.g., "intimate, grounded, observational")
- key_sections: An array of 3-7 key story beats or sections
- estimated_duration: How long this story might take to experience (e.g., "5-episode arc")`;

    const userPrompt = `Analyze this story/script:\n\n${text.substring(0, 15000)}`;
    
    const response = await callAI(systemPrompt, userPrompt);
    const parsed = JSON.parse(response);

    ctx.structureSummary = parsed.structure_summary || "Multi-scene narrative";
    ctx.voiceNotes = parsed.voice_notes || "Observational tone";
    ctx.keySections = parsed.key_sections || ["Opening", "Middle", "End"];

    await updateJobStage(ctx.jobId, 1, "done", {
      stage1: {
        structure_summary: ctx.structureSummary,
        voice_notes: ctx.voiceNotes,
        key_sections: ctx.keySections,
      },
    });
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 1, "failed", undefined, {
      user: "We had trouble understanding your story's structure.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

export async function stage2_identifyStory(ctx: PipelineContext): Promise<void> {
  await updateJobStage(ctx.jobId, 2, "running");

  try {
    const text = ctx.normalizedText || "";
    
    const systemPrompt = `You are a story analyst. Identify the core themes and identity of this story.
Return a JSON object with these fields:
- title: A compelling title for this story (use the original title if present, or create one)
- theme_statement: A powerful one-line theme statement that captures the story's essence
- tone_tags: An array of 3-5 tone descriptors (e.g., ["tense", "intimate", "hopeful"])
- genre_guess: The primary genre (e.g., "thriller", "drama", "social realism")
- audience_guess: Target audience description (e.g., "Adults seeking meaningful drama")`;

    const userPrompt = `Identify the core story in this script. Structure summary: ${ctx.structureSummary}\n\nScript:\n${text.substring(0, 15000)}`;
    
    const response = await callAI(systemPrompt, userPrompt);
    const parsed = JSON.parse(response);

    ctx.storyTitle = parsed.title || "Untitled Story";
    ctx.themeStatement = parsed.theme_statement || "A story of choices and consequences.";
    ctx.toneTags = parsed.tone_tags || ["dramatic"];
    ctx.genreGuess = parsed.genre_guess || "drama";
    ctx.audienceGuess = parsed.audience_guess || "General audience";

    const guardrailsPrompt = `You are a content guardian. Analyze this source material and extract guardrails to prevent AI hallucination.
Your job is to identify what IS and IS NOT in this material, so later AI systems stay grounded.

Return a JSON object with:
- core_themes: Array of 3-5 themes EXPLICITLY present in the source (not inferred)
- tone_constraints: Array of tone rules (e.g., "restrained, not melodramatic", "factual, not speculative")
- factual_boundaries: Array of facts that MUST be respected (names, places, events, dates from the source)
- exclusions: Array of things the AI must NOT introduce (topics, themes, tropes NOT in the source)
- quotable_elements: Array of 5-10 key phrases, metaphors, or concepts directly from the source
- sensitive_topics: Array of sensitive subjects present that require careful handling
- creative_latitude: "strict" (factual/documentary), "moderate" (structured drama), or "liberal" (creative fiction)
- grounding_statement: A single sentence that captures what this material IS and what it is NOT

CRITICAL: Only extract what is EXPLICITLY in the source. Do not infer or imagine.`;

    const guardrailsUserPrompt = `Extract grounding guardrails from this ${ctx.genreGuess} material:\n\n${text.substring(0, 15000)}`;
    
    const guardrailsResponse = await callAI(guardrailsPrompt, guardrailsUserPrompt);
    const guardrailsParsed = JSON.parse(guardrailsResponse);

    ctx.guardrails = {
      coreThemes: guardrailsParsed.core_themes || [ctx.themeStatement],
      toneConstraints: guardrailsParsed.tone_constraints || ctx.toneTags || [],
      factualBoundaries: guardrailsParsed.factual_boundaries || [],
      exclusions: guardrailsParsed.exclusions || [],
      quotableElements: guardrailsParsed.quotable_elements || [],
      sensitiveTopics: guardrailsParsed.sensitive_topics || [],
      creativeLatitude: guardrailsParsed.creative_latitude || "moderate",
      groundingStatement: guardrailsParsed.grounding_statement || `A ${ctx.genreGuess} story grounded in the source material.`,
    };

    await updateJobStage(ctx.jobId, 2, "done", {
      stage2: {
        theme_statement: ctx.themeStatement,
        tone_tags: ctx.toneTags,
        genre_guess: ctx.genreGuess,
        audience_guess: ctx.audienceGuess,
        guardrails: ctx.guardrails,
      },
    });
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 2, "failed", undefined, {
      user: "We couldn't identify the core story elements.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

export async function stage3_extractWorld(ctx: PipelineContext): Promise<void> {
  await updateJobStage(ctx.jobId, 3, "running");

  try {
    const text = ctx.normalizedText || "";
    
    const systemPrompt = `You are a story analyst. Extract all characters and locations from this story.
Return a JSON object with these fields:
- characters: An array of character objects, each with:
  - id: A slug-friendly ID (lowercase, hyphens)
  - name: The character's name
  - role: Their role in the story (e.g., "Protagonist", "Antagonist", "Supporting")
  - description: A brief description for AI image generation
- locations: An array of location objects, each with:
  - id: A slug-friendly ID
  - name: The location name
  - description: A brief visual description
- world_rules: An array of 2-4 rules about this story world (e.g., "Set in modern-day London")`;

    const userPrompt = `Extract characters and locations from this ${ctx.genreGuess} story:\n\n${text.substring(0, 15000)}`;
    
    const response = await callAI(systemPrompt, userPrompt);
    const parsed = JSON.parse(response);

    ctx.characters = parsed.characters || [];
    ctx.locations = parsed.locations || [];
    ctx.worldRules = parsed.world_rules || ["Grounded in reality"];

    await updateJobStage(ctx.jobId, 3, "done", {
      stage3: {
        characters: ctx.characters,
        locations: ctx.locations,
        world_rules: ctx.worldRules,
      },
    });
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 3, "failed", undefined, {
      user: "We had trouble extracting characters and locations.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

export async function stage4_shapeMoments(ctx: PipelineContext): Promise<void> {
  await updateJobStage(ctx.jobId, 4, "running");

  try {
    const text = ctx.normalizedText || "";
    const characterNames = ctx.characters?.map(c => c.name).join(", ") || "Unknown";
    const guardrails = ctx.guardrails;
    
    const guardrailsConstraints = guardrails ? `
GROUNDING CONSTRAINTS (CRITICAL - MUST FOLLOW):
- Creative latitude: ${guardrails.creativeLatitude || "moderate"} (${guardrails.creativeLatitude === "strict" ? "stay purely factual - only use what's explicitly in the source" : guardrails.creativeLatitude === "moderate" ? "interpret but don't invent new facts" : "allow creative interpretation while staying true to themes"})
- ONLY reference themes from the source: ${(guardrails.coreThemes || []).join(", ") || "none specified"}
- Maintain tone: ${(guardrails.toneConstraints || []).join(", ") || "none specified"}
- NEVER introduce these topics or elements: ${(guardrails.exclusions || []).join(", ") || "nothing to exclude"}
- Use quotable elements from source where possible: ${(guardrails.quotableElements || []).slice(0, 3).join("; ") || "none specified"}
- Handle sensitively: ${(guardrails.sensitiveTopics || []).join(", ") || "none specified"}
- Facts to respect: ${(guardrails.factualBoundaries || []).slice(0, 5).join("; ") || "none specified"}

DO NOT invent new plot points, characters, or facts not in the source material.` : "";

    const cardCountTarget = ctx.storyLength === "short" ? "6-10" : ctx.storyLength === "long" ? "20-28" : "14-18";
    const cardCountDescription = ctx.storyLength === "short" ? "short (~8 cards, ~1 week)" : ctx.storyLength === "long" ? "long (~24 cards, ~3-4 weeks)" : "medium (~16 cards, ~2 weeks)";
    
    const systemPrompt = `You are a story designer for a vertical video story platform. 
Break this story into ${cardCountTarget} "story cards" for a ${cardCountDescription} story - each card is a dramatic moment that will be shown as a vertical video with captions.
${guardrailsConstraints}

Return a JSON object with these fields:
- hook_pack_count: Number of cards to release immediately (usually 3)
- release_mode: Either "hybrid" (hook pack + daily) or "daily" (all daily)
- card_plan: An array of card objects, each with:
  - dayIndex: The day number (1, 2, 3, etc.)
  - title: A short, evocative title (2-4 words, title case)
  - intent: What this moment accomplishes dramatically
  - sceneText: 1-2 sentences describing what happens (for the reader after watching)
  - captions: An array of 2-3 short caption lines shown during the video (dramatic, punchy)
  - imagePrompt: A detailed prompt for generating a vertical cinematic image of this moment`;

    const userPrompt = `Design story cards for "${ctx.storyTitle}".
Theme: ${ctx.themeStatement}
Genre: ${ctx.genreGuess}
Characters: ${characterNames}
Key sections: ${ctx.keySections?.join(", ")}
${guardrails ? `\nGrounding statement: ${guardrails.groundingStatement}` : ""}

Full script:
${text.substring(0, 12000)}`;
    
    const response = await callAI(systemPrompt, userPrompt);
    const parsed = JSON.parse(response);

    const hookPackCount = parsed.hook_pack_count || 3;
    const releaseMode = parsed.release_mode || "hybrid";
    const cardPlan = parsed.card_plan || [];
    
    ctx.hookPackCount = hookPackCount;
    ctx.releaseMode = releaseMode;
    ctx.cardPlan = cardPlan;

    await updateJobStage(ctx.jobId, 4, "done", {
      stage4: {
        card_count: cardPlan.length,
        hook_enabled: hookPackCount > 0,
        card_plan: cardPlan.map((c: any) => ({ dayIndex: c.dayIndex, title: c.title, intent: c.intent })),
      },
    });
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 4, "failed", undefined, {
      user: "We couldn't shape the story into moments.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

export async function stage5_craftExperience(ctx: PipelineContext): Promise<number> {
  await updateJobStage(ctx.jobId, 5, "running");

  try {
    const job = await storage.getTransformationJob(ctx.jobId);
    if (!job) throw new Error("Job not found");

    const slug = `${(ctx.storyTitle || "story").toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30)}-${Date.now()}`;
    const universe = await storage.createUniverse({
      name: ctx.storyTitle || ctx.themeStatement || "Untitled Story",
      slug,
      description: `${ctx.genreGuess || "Drama"} - ${ctx.audienceGuess || "General audience"}`,
      styleNotes: ctx.voiceNotes || "",
      visualMode: "engine_generated",
      releaseMode: ctx.releaseMode === "hybrid" ? "hybrid_intro_then_daily" : "daily",
      introCardsCount: ctx.hookPackCount || 3,
      sourceGuardrails: ctx.guardrails || null,
    });

    // Generate AI chat profiles for characters with source grounding
    const characterIdMap: Record<string, number> = {};
    const guardrails = ctx.guardrails;
    const groundingRules = guardrails ? `
SOURCE GROUNDING RULES (CRITICAL):
- You are grounded to this source material: ${guardrails.groundingStatement || "the uploaded content"}
- Creative latitude: ${guardrails.creativeLatitude || "moderate"} (${guardrails.creativeLatitude === "strict" ? "stay purely factual" : guardrails.creativeLatitude === "moderate" ? "interpret but don't invent" : "allow creative interpretation"})
- Core themes to reference: ${(guardrails.coreThemes || []).join(", ") || "none specified"}
- Tone constraints: ${(guardrails.toneConstraints || []).join(", ") || "none specified"}
- NEVER introduce: ${(guardrails.exclusions || []).join(", ") || "nothing to exclude"}
- If asked about something NOT in the source material, say "That's not something I know about from my experience" or similar in-character deflection.
- If the source doesn't answer a question, clearly frame any response as interpretation, not fact.
- No confident guessing. No lore creep. Stay grounded.` : "";

    for (const char of ctx.characters || []) {
      const characterSystemPromptRequest = `You are an expert at creating AI character personas for interactive storytelling.
Generate a system prompt for an AI to roleplay as this character.

CRITICAL GROUNDING REQUIREMENT:
The character can ONLY speak to what is explicitly in the source material. They must:
1. Stay within the factual boundaries of the source
2. Never invent backstory, facts, or conclusions not present
3. When asked about something not covered, deflect in-character: "That's not something I can speak to"
4. If interpreting, clearly frame it as their perspective, not established fact
${groundingRules}`;

      const chatPromptResponse = await callAI(
        characterSystemPromptRequest,
        `Character: ${char.name}
Role: ${char.role || "Character"}
Description: ${char.description || "A character in this story"}
Story: ${ctx.storyTitle || "Untitled"} - ${ctx.themeStatement || "A dramatic story"}
Genre: ${ctx.genreGuess || "Drama"}
${guardrails ? `
SOURCE GROUNDING DATA:
- Grounding statement: ${guardrails.groundingStatement || "A story grounded in the source material"}
- Creative latitude: ${guardrails.creativeLatitude || "moderate"}
- Core themes: ${(guardrails.coreThemes || []).join(", ") || "none specified"}
- Tone constraints: ${(guardrails.toneConstraints || []).join(", ") || "none specified"}
- MUST NOT introduce: ${(guardrails.exclusions || []).join(", ") || "nothing specified"}
- Factual boundaries: ${(guardrails.factualBoundaries || []).join("; ") || "None specified"}
- Key quotes to reference: ${(guardrails.quotableElements || []).slice(0, 5).join("; ") || "None specified"}
- Sensitive topics: ${(guardrails.sensitiveTopics || []).join(", ") || "None specified"}
` : ""}

Create a JSON response with:
{
  "system_prompt": "A detailed system prompt that MUST include: 1) Personality and speech patterns from the source, 2) EXPLICIT knowledge limits - what they know and DON'T know based on the source, 3) MANDATORY deflection rule: if asked about something not in the source, respond 'That's not something I know about' or similar in-character deflection, 4) No hallucination: never invent facts not in the source",
  "voice": "Brief description of how they speak based on the source",
  "secrets": ["Things this character knows but won't easily reveal based on the source"],
  "goals": ["What this character wants in conversations"],
  "knowledge_limits": ["Topics this character CANNOT speak to because they're not in the source"]
}`,
        true
      );
      
      const baseSystemPrompt = `You are ${char.name}, a character in "${ctx.storyTitle || "this story"}". Stay in character at all times.

GROUNDING RULES:
- You can ONLY speak to what is in the source material.
- If asked about something not covered, say "That's not something I can speak to" or similar in-character response.
- Never invent facts, backstory, or conclusions not present in the source.
- When interpreting, clearly frame it as your perspective, not established fact.`;

      let systemPrompt = baseSystemPrompt;
      let secrets: string[] = [];
      let chatProfile: any = {
        voice: "Natural conversational tone fitting this character",
        goals: ["Engage the viewer authentically", "Stay grounded to the source material"],
        speech_style: "Natural and in-character",
        knowledge_limits: [],
      };
      
      try {
        const chatData = JSON.parse(chatPromptResponse);
        if (chatData.system_prompt) {
          systemPrompt = chatData.system_prompt + "\n\n" + (guardrails ? groundingRules : "");
        }
        if (chatData.secrets && Array.isArray(chatData.secrets)) secrets = chatData.secrets;
        if (chatData.voice || chatData.goals) {
          chatProfile = {
            voice: chatData.voice || chatProfile.voice,
            goals: chatData.goals || chatProfile.goals,
            speech_style: chatData.voice || chatProfile.speech_style,
            knowledge_limits: chatData.knowledge_limits || [],
          };
        }
      } catch {
        // Use defaults with grounding rules if parsing fails
        systemPrompt = baseSystemPrompt + (guardrails ? groundingRules : "");
      }

      const createdChar = await storage.createCharacter({
        universeId: universe.id,
        characterSlug: char.id,
        name: char.name,
        role: char.role || "Character",
        description: char.description || "",
        systemPrompt,
        secretsJson: secrets,
        chatProfile,
      });
      
      characterIdMap[char.id] = createdChar.id;
    }

    for (const loc of ctx.locations || []) {
      await storage.createLocation({
        universeId: universe.id,
        locationSlug: loc.id,
        name: loc.name,
      });
    }

    // Get the primary character (first one created) for linking to cards
    const primaryCharacterId = Object.values(characterIdMap)[0] || null;

    const now = new Date();
    for (let i = 0; i < (ctx.cardPlan || []).length; i++) {
      const plan = ctx.cardPlan![i];
      const isHookCard = i < (ctx.hookPackCount || 3);
      const publishAt = isHookCard
        ? now
        : new Date(now.getTime() + (i - (ctx.hookPackCount || 3) + 1) * 24 * 60 * 60 * 1000);

      await storage.createCard({
        universeId: universe.id,
        season: 1,
        dayIndex: plan.dayIndex,
        title: plan.title,
        captionsJson: plan.captions || [plan.intent || ""],
        sceneText: plan.sceneText || `Scene for ${plan.title}`,
        recapText: `Day ${plan.dayIndex} - ${plan.title}`,
        effectTemplate: "ken-burns",
        status: "published",
        publishAt,
        sceneDescription: plan.sceneText || "",
        imageGeneration: plan.imagePrompt ? {
          prompt: plan.imagePrompt,
          shotType: "medium",
          lighting: "natural",
        } : undefined,
        primaryCharacterIds: primaryCharacterId ? [primaryCharacterId] : null,
      });
    }

    await updateJobStage(ctx.jobId, 5, "done", {
      stage5: {
        cards_drafted: true,
        image_prompts_ready: true,
        chat_prompts_ready: true,
        discussion_prompts_ready: false,
      },
    });

    await storage.updateTransformationJob(ctx.jobId, {
      status: "completed",
      outputUniverseId: universe.id,
    });

    return universe.id;
  } catch (err: any) {
    await updateJobStage(ctx.jobId, 5, "failed", undefined, {
      user: "We couldn't create the final story experience.",
      dev: err.message || String(err),
    });
    throw err;
  }
}

function detectContentType(text: string): SourceType {
  const lines = text.split("\n").slice(0, 50);
  const content = lines.join("\n").toLowerCase();

  if (content.includes("int.") || content.includes("ext.") || content.includes("fade in")) {
    return "script";
  }
  if (content.includes("chapter") || lines.some(l => l.match(/^\d+\./))) {
    return "article";
  }
  if (lines.some(l => l.match(/^\s*[A-Z]+:\s/))) {
    return "transcript";
  }
  return "script";
}

export async function runPipeline(jobId: number, sourceText: string): Promise<number> {
  const job = await storage.getTransformationJob(jobId);
  const storyLength = (job?.storyLength as "short" | "medium" | "long") || "medium";
  const ctx: PipelineContext = { jobId, storyLength };

  console.log(`[Pipeline] Starting job ${jobId} with ${sourceText.length} chars, storyLength=${storyLength}`);

  await stage0_normalise(ctx, sourceText);
  await stage1_read(ctx);
  await stage2_identifyStory(ctx);
  await stage3_extractWorld(ctx);
  await stage4_shapeMoments(ctx);
  const universeId = await stage5_craftExperience(ctx);
  
  // Harvest images from source URL if available
  if (job?.sourceUrl && universeId && job.userId) {
    await harvestAndAssignImages(job.sourceUrl, universeId, job.userId, ctx.cardPlan || []);
  }

  console.log(`[Pipeline] Job ${jobId} completed, created universe ${universeId}`);
  return universeId;
}

async function harvestAndAssignImages(
  sourceUrl: string,
  universeId: number,
  userId: number,
  cardPlan: Array<{ dayIndex: number; title: string; intent?: string; sceneText?: string; captions?: string[]; imagePrompt?: string; }>
): Promise<void> {
  try {
    console.log(`[Pipeline] Harvesting images from ${sourceUrl}`);
    
    const harvestedImages = await harvestImagesFromUrl(sourceUrl, universeId, 15);
    
    if (harvestedImages.length === 0) {
      console.log(`[Pipeline] No images found at source URL`);
      return;
    }
    
    console.log(`[Pipeline] Harvested ${harvestedImages.length} images, assigning to cards`);
    
    const cards = await storage.getCardsByUniverse(universeId);
    
    for (let i = 0; i < cards.length && i < harvestedImages.length; i++) {
      const card = cards[i];
      const image = harvestedImages[i];
      
      let relevanceScore = image.relevanceScore;
      
      const cardText = `${card.title} ${card.sceneText || ''} ${(card.captions || []).join(' ')}`.toLowerCase();
      const imageText = `${image.altText || ''} ${image.caption || ''}`.toLowerCase();
      
      if (imageText && cardText) {
        const cardWords = cardText.split(/\s+/).filter(w => w.length > 3);
        const imageWords = imageText.split(/\s+/).filter(w => w.length > 3);
        const overlap = cardWords.filter(w => imageWords.includes(w)).length;
        if (overlap > 0) {
          relevanceScore = Math.min(100, relevanceScore + overlap * 5);
        }
      }
      
      await storage.createCardMediaAsset({
        cardId: card.id,
        userId,
        mediaType: 'image',
        storageKey: image.storageKey,
        originalFilename: image.originalUrl.split('/').pop() || 'scraped-image',
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        isActive: true,
        source: 'scraped',
        sourceUrl: image.originalUrl,
        altText: image.altText,
        caption: image.caption,
        relevanceScore,
      });
      
      await storage.updateStorageUsage(userId, image.sizeBytes, 1, 0);
    }
    
    console.log(`[Pipeline] Assigned ${Math.min(cards.length, harvestedImages.length)} images to cards`);
  } catch (error) {
    console.error(`[Pipeline] Error harvesting images:`, error);
  }
}

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();
    return textResult.text;
  }
  
  if ([".txt", ".md", ".fountain"].includes(ext)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  
  return fs.readFileSync(filePath, "utf-8");
}

export async function resumeStaleJobs(): Promise<void> {
  console.log("[Pipeline] Checking for stale jobs...");
}
