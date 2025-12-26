export enum LocalTask {
  PASS0_NORMALISE_INPUT = 'PASS0_NORMALISE_INPUT',
  PASS1_THEME_AND_INTENT = 'PASS1_THEME_AND_INTENT',
  PASS2_ENTITIES_CHARACTERS_LOCATIONS = 'PASS2_ENTITIES_CHARACTERS_LOCATIONS',
  PASS3_CARD_OUTLINE_AND_ORDER = 'PASS3_CARD_OUTLINE_AND_ORDER',
  PASS4_CARD_COPY_DRAFT = 'PASS4_CARD_COPY_DRAFT',
  PASS5_QA_AND_GUARDRAILS_CHECK = 'PASS5_QA_AND_GUARDRAILS_CHECK',
  MICRO_COPY_TITLES_CAPTIONS = 'MICRO_COPY_TITLES_CAPTIONS',
  SUMMARISE_SECTION = 'SUMMARISE_SECTION',
  EXTRACT_QUOTES_AND_CITATIONS = 'EXTRACT_QUOTES_AND_CITATIONS',
  SAFE_CHAT_GUARDRAILS_TEMPLATE = 'SAFE_CHAT_GUARDRAILS_TEMPLATE',
  JSON_SCHEMA_VALIDATION_HELPER = 'JSON_SCHEMA_VALIDATION_HELPER',
}

export interface GroundingPack {
  extractedTextChunks: Array<{ id: string; text: string; offset?: number }>;
  citations: Array<{ chunkId: string; offset?: number }>;
  forbidden: string[];
}

export interface LocalTaskInput {
  task: LocalTask;
  prompt: string;
  groundingPack: GroundingPack;
  maxTokens?: number;
  temperature?: number;
}

export interface LocalTaskOutput {
  result: string;
  usedChunkIds: string[];
  confidenceRating: number;
  unsupportedClaims: Array<{ claim: string; reason: string }>;
  needsReview: boolean;
  modelUsed: string;
  processingTimeMs: number;
}

export interface ModelConfig {
  modelId: string;
  reasoning: string;
  limits: {
    maxTokens: number;
    contextWindow: number;
  };
  priority: number;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'llama-3.2-3b': {
    modelId: 'Llama-3.2-3B-Instruct',
    reasoning: 'Small, fast model for simple tasks',
    limits: { maxTokens: 2048, contextWindow: 8192 },
    priority: 1,
  },
  'qwen2.5-7b': {
    modelId: 'Qwen2.5-7B-Instruct',
    reasoning: 'Higher quality reasoning for complex tasks',
    limits: { maxTokens: 4096, contextWindow: 32768 },
    priority: 2,
  },
};

const TASK_MODEL_PREFERENCES: Record<LocalTask, string[]> = {
  [LocalTask.PASS0_NORMALISE_INPUT]: ['llama-3.2-3b', 'qwen2.5-7b'],
  [LocalTask.PASS1_THEME_AND_INTENT]: ['qwen2.5-7b', 'llama-3.2-3b'],
  [LocalTask.PASS2_ENTITIES_CHARACTERS_LOCATIONS]: ['qwen2.5-7b', 'llama-3.2-3b'],
  [LocalTask.PASS3_CARD_OUTLINE_AND_ORDER]: ['qwen2.5-7b', 'llama-3.2-3b'],
  [LocalTask.PASS4_CARD_COPY_DRAFT]: ['qwen2.5-7b', 'llama-3.2-3b'],
  [LocalTask.PASS5_QA_AND_GUARDRAILS_CHECK]: ['qwen2.5-7b'],
  [LocalTask.MICRO_COPY_TITLES_CAPTIONS]: ['llama-3.2-3b', 'qwen2.5-7b'],
  [LocalTask.SUMMARISE_SECTION]: ['llama-3.2-3b', 'qwen2.5-7b'],
  [LocalTask.EXTRACT_QUOTES_AND_CITATIONS]: ['llama-3.2-3b', 'qwen2.5-7b'],
  [LocalTask.SAFE_CHAT_GUARDRAILS_TEMPLATE]: ['qwen2.5-7b', 'llama-3.2-3b'],
  [LocalTask.JSON_SCHEMA_VALIDATION_HELPER]: ['llama-3.2-3b', 'qwen2.5-7b'],
};

let availableModels: Set<string> = new Set();
let localLlmAvailable = false;
let checkComplete = false;

export async function checkLocalLlmAvailability(): Promise<boolean> {
  if (checkComplete) return localLlmAvailable;

  try {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      const gpu = (navigator as any).gpu;
      if (gpu) {
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          localLlmAvailable = true;
          availableModels.add('llama-3.2-3b');
        }
      }
    }
  } catch (e) {
    console.log('WebGPU not available:', e);
    localLlmAvailable = false;
  }

  checkComplete = true;
  return localLlmAvailable;
}

export function getTaskModel(task: LocalTask): ModelConfig | null {
  const preferences = TASK_MODEL_PREFERENCES[task];
  
  for (const modelKey of preferences) {
    if (availableModels.has(modelKey)) {
      return MODEL_CONFIGS[modelKey];
    }
  }

  if (availableModels.size > 0) {
    const firstAvailable = Array.from(availableModels)[0];
    return MODEL_CONFIGS[firstAvailable];
  }

  return null;
}

export function buildGroundedPrompt(
  basePrompt: string,
  groundingPack: GroundingPack
): string {
  const chunks = groundingPack.extractedTextChunks
    .map(c => `[CHUNK ${c.id}]: ${c.text}`)
    .join('\n\n');

  const rules = `
GROUNDING RULES (CRITICAL):
1. You may ONLY use information from the provided source chunks.
2. Do NOT invent facts, names, dates, or events not present in the chunks.
3. If information is not in the chunks, say "not specified in source".
4. Always cite which chunk(s) you used for each claim.
5. FORBIDDEN topics to add: ${groundingPack.forbidden.join(', ') || 'none specified'}

SOURCE MATERIAL:
${chunks}

TASK:
${basePrompt}

Respond with a JSON object:
{
  "result": "your response here",
  "usedChunkIds": ["id1", "id2"],
  "confidenceRating": 0.0-1.0,
  "unsupportedClaims": [{"claim": "...", "reason": "..."}]
}`;

  return rules;
}

export async function runLocalTask(input: LocalTaskInput): Promise<LocalTaskOutput> {
  const startTime = Date.now();
  const model = getTaskModel(input.task);

  if (!model) {
    return {
      result: '',
      usedChunkIds: [],
      confidenceRating: 0,
      unsupportedClaims: [],
      needsReview: true,
      modelUsed: 'none',
      processingTimeMs: Date.now() - startTime,
    };
  }

  const groundedPrompt = buildGroundedPrompt(input.prompt, input.groundingPack);

  try {
    const response = await executeLocalModel(model.modelId, groundedPrompt, {
      maxTokens: input.maxTokens || model.limits.maxTokens,
      temperature: input.temperature || 0.7,
    });

    const parsed = parseModelResponse(response);

    return {
      result: parsed.result,
      usedChunkIds: parsed.usedChunkIds,
      confidenceRating: parsed.confidenceRating,
      unsupportedClaims: parsed.unsupportedClaims,
      needsReview: parsed.unsupportedClaims.length > 0 || parsed.confidenceRating < 0.7,
      modelUsed: model.modelId,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Local LLM error:', error);
    return {
      result: '',
      usedChunkIds: [],
      confidenceRating: 0,
      unsupportedClaims: [],
      needsReview: true,
      modelUsed: model.modelId,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

async function executeLocalModel(
  modelId: string,
  prompt: string,
  options: { maxTokens: number; temperature: number }
): Promise<string> {
  console.log(`[LocalLLM] Would execute ${modelId} with ${prompt.length} chars`);
  return JSON.stringify({
    result: "Local LLM execution placeholder - WebLLM integration required",
    usedChunkIds: [],
    confidenceRating: 0.5,
    unsupportedClaims: [],
  });
}

function parseModelResponse(response: string): {
  result: string;
  usedChunkIds: string[];
  confidenceRating: number;
  unsupportedClaims: Array<{ claim: string; reason: string }>;
} {
  try {
    const parsed = JSON.parse(response);
    return {
      result: parsed.result || '',
      usedChunkIds: parsed.usedChunkIds || [],
      confidenceRating: parsed.confidenceRating || 0.5,
      unsupportedClaims: parsed.unsupportedClaims || [],
    };
  } catch {
    return {
      result: response,
      usedChunkIds: [],
      confidenceRating: 0.5,
      unsupportedClaims: [],
    };
  }
}

export function isLocalLlmAvailable(): boolean {
  return localLlmAvailable;
}

export function getAvailableModels(): string[] {
  return Array.from(availableModels);
}
