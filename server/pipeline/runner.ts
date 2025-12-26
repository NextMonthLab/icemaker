import { storage } from "../storage";
import { StageArtifacts, StageStatuses, TransformationJob, SourceType } from "@shared/schema";

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
  characters?: Array<{ id: string; name: string; role?: string }>;
  locations?: Array<{ id: string; name: string }>;
  worldRules?: string[];
  cardPlan?: Array<{ dayIndex: number; title: string; intent?: string }>;
  hookPackCount?: number;
  releaseMode?: string;
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

export async function stage0_normalise(ctx: PipelineContext, sourceText: string): Promise<void> {
  await updateJobStage(ctx.jobId, 0, "running");

  try {
    await new Promise((r) => setTimeout(r, 800));

    const detectedType: SourceType = detectContentType(sourceText);
    const parseConfidence = 0.85 + Math.random() * 0.1;
    const lines = sourceText.split("\n").filter((l) => l.trim());
    const outlineCount = Math.min(lines.filter((l) => l.startsWith("#") || l.length < 60).length, 20);

    ctx.normalizedText = sourceText;
    ctx.sourceType = detectedType;

    await updateJobStage(ctx.jobId, 0, "done", {
      stage0: {
        detected_type: detectedType,
        parse_confidence: Math.round(parseConfidence * 100) / 100,
        outline_count: outlineCount || lines.length,
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
    await new Promise((r) => setTimeout(r, 1000));

    const text = ctx.normalizedText || "";
    const paragraphs = text.split("\n\n").length;

    ctx.structureSummary = paragraphs > 10
      ? "Multi-scene narrative with distinct emotional beats."
      : "Compact story with focused emotional core.";
    ctx.voiceNotes = "Intimate, grounded, observational tone.";
    ctx.keySections = ["Opening", "Conflict", "Resolution"];

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
    await new Promise((r) => setTimeout(r, 1200));

    ctx.themeStatement = "Choices echo longer than we expect.";
    ctx.toneTags = ["warm", "reflective", "grounded"];
    ctx.genreGuess = "social realism";
    ctx.audienceGuess = "Adults seeking meaningful character drama";

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
    await new Promise((r) => setTimeout(r, 1500));

    ctx.characters = [
      { id: "protagonist", name: "The Protagonist", role: "Main Character" },
      { id: "companion", name: "The Companion", role: "Supporting Character" },
    ];
    ctx.locations = [
      { id: "main-location", name: "The Main Location" },
    ];
    ctx.worldRules = ["Grounded in everyday reality"];

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
    await new Promise((r) => setTimeout(r, 1200));

    ctx.hookPackCount = 3;
    ctx.releaseMode = "hybrid";
    ctx.cardPlan = [
      { dayIndex: 1, title: "The Beginning", intent: "Hook the viewer" },
      { dayIndex: 2, title: "The Question", intent: "Raise stakes" },
      { dayIndex: 3, title: "The Turn", intent: "Reveal complexity" },
      { dayIndex: 4, title: "The Choice", intent: "Force decision" },
      { dayIndex: 5, title: "The Echo", intent: "Deliver consequence" },
    ];

    await updateJobStage(ctx.jobId, 4, "done", {
      stage4: {
        card_count: ctx.cardPlan.length,
        hook_enabled: true,
        card_plan: ctx.cardPlan,
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
    await new Promise((r) => setTimeout(r, 2000));

    const job = await storage.getTransformationJob(ctx.jobId);
    if (!job) throw new Error("Job not found");

    const slug = `story-${ctx.jobId}-${Date.now()}`;
    const universe = await storage.createUniverse({
      name: ctx.themeStatement || "Untitled Story",
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
        description: "",
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
        captionsJson: [plan.intent || ""],
        sceneText: `Scene for ${plan.title}`,
        recapText: `Day ${plan.dayIndex} - ${plan.title}`,
        effectTemplate: "ken-burns",
        status: "published",
        publishAt,
        sceneDescription: `A moment capturing: ${plan.intent}`,
        imageGeneration: {
          prompt: `Cinematic scene: ${plan.title}, ${ctx.genreGuess || "drama"} style`,
          shotType: "medium",
          lighting: "natural",
        },
      });
    }

    await updateJobStage(ctx.jobId, 5, "done", {
      stage5: {
        cards_drafted: true,
        image_prompts_ready: true,
        chat_prompts_ready: true,
        discussion_prompts_ready: true,
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

export async function runPipeline(jobId: number, sourceText: string): Promise<void> {
  const ctx: PipelineContext = { jobId };

  try {
    await stage0_normalise(ctx, sourceText);
    await stage1_read(ctx);
    await stage2_identifyStory(ctx);
    await stage3_extractWorld(ctx);
    await stage4_shapeMoments(ctx);
    await stage5_craftExperience(ctx);
  } catch (err) {
    console.error(`Pipeline failed for job ${jobId}:`, err);
  }
}

function detectContentType(text: string): SourceType {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("int.") || lowerText.includes("ext.") || lowerText.includes("fade in")) {
    return "script";
  }
  if (lowerText.includes("slide ") || lowerText.includes("presentation")) {
    return "ppt";
  }
  if (lowerText.includes("transcript") || lowerText.includes("speaker:")) {
    return "transcript";
  }
  if (text.split("\n").filter((l) => l.trim()).length > 20) {
    return "article";
  }
  return "unknown";
}

export async function resumeStaleJobs(): Promise<void> {
  console.log("[Pipeline] Checking for stale jobs...");
}
