import { storage } from "../storage";
import { StageArtifacts, StageStatuses, TransformationJob, SourceType } from "@shared/schema";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

    await updateJobStage(ctx.jobId, 2, "done", {
      stage2: {
        theme_statement: ctx.themeStatement,
        tone_tags: ctx.toneTags,
        genre_guess: ctx.genreGuess,
        audience_guess: ctx.audienceGuess,
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
    
    const systemPrompt = `You are a story designer for a vertical video story platform. 
Break this story into 5-10 "story cards" - each card is a dramatic moment that will be shown as a vertical video with captions.

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
    });

    for (const char of ctx.characters || []) {
      await storage.createCharacter({
        universeId: universe.id,
        characterSlug: char.id,
        name: char.name,
        role: char.role || "Character",
        description: char.description || "",
      });
    }

    for (const loc of ctx.locations || []) {
      await storage.createLocation({
        universeId: universe.id,
        locationSlug: loc.id,
        name: loc.name,
      });
    }

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
      });
    }

    await updateJobStage(ctx.jobId, 5, "done", {
      stage5: {
        cards_drafted: true,
        image_prompts_ready: true,
        chat_prompts_ready: false,
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
  const ctx: PipelineContext = { jobId };

  console.log(`[Pipeline] Starting job ${jobId} with ${sourceText.length} chars`);

  await stage0_normalise(ctx, sourceText);
  await stage1_read(ctx);
  await stage2_identifyStory(ctx);
  await stage3_extractWorld(ctx);
  await stage4_shapeMoments(ctx);
  const universeId = await stage5_craftExperience(ctx);

  console.log(`[Pipeline] Job ${jobId} completed, created universe ${universeId}`);
  return universeId;
}

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  
  if ([".txt", ".md", ".fountain"].includes(ext)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  
  return fs.readFileSync(filePath, "utf-8");
}

export async function resumeStaleJobs(): Promise<void> {
  console.log("[Pipeline] Checking for stale jobs...");
}
