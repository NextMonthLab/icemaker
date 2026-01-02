import Replicate from "replicate";

export interface ReplicateVideoRequest {
  prompt: string;
  imageUrl?: string;
  negativePrompt?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: 5 | 10;
  model?: string;
}

export interface ReplicateVideoResult {
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

const REPLICATE_MODELS = {
  "kling-v1.6-standard": "kwaivgi/kling-v1.6-standard",
  "kling-v1.6-pro": "kwaivgi/kling-v1.6-pro",
  "minimax-video": "minimax/video-01",
  "haiper-video-2": "haiper-ai/haiper-video-2",
};

export function isReplicateConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

export function getReplicateModels() {
  return [
    { id: "kling-v1.6-standard", name: "Kling 1.6 Standard", description: "High quality, ~$1.40/5s video", provider: "replicate" },
    { id: "kling-v1.6-pro", name: "Kling 1.6 Pro", description: "Professional quality, ~$2.00/5s video", provider: "replicate" },
    { id: "minimax-video", name: "Minimax Video", description: "Excellent quality, ~$1.00/5s video", provider: "replicate" },
    { id: "haiper-video-2", name: "Haiper Video 2", description: "Budget option, ~$0.25/5s video", provider: "replicate" },
  ];
}

function getReplicateClient(): Replicate {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }
  return new Replicate({ auth: token });
}

export async function generateVideoWithReplicate(
  request: ReplicateVideoRequest
): Promise<ReplicateVideoResult> {
  const replicate = getReplicateClient();
  const modelKey = request.model || "kling-v1.6-standard";
  const modelId = REPLICATE_MODELS[modelKey as keyof typeof REPLICATE_MODELS];
  
  if (!modelId) {
    throw new Error(`Unknown Replicate model: ${modelKey}`);
  }

  console.log(`[Replicate] Starting video generation with model: ${modelId}`);
  console.log(`[Replicate] Prompt: ${request.prompt?.substring(0, 100)}...`);

  try {
    let input: Record<string, any> = {
      prompt: request.prompt,
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || "9:16",
    };

    if (request.negativePrompt) {
      input.negative_prompt = request.negativePrompt;
    }

    if (request.imageUrl) {
      if (request.imageUrl.startsWith("http://") || request.imageUrl.startsWith("https://")) {
        input.start_image = request.imageUrl;
        console.log(`[Replicate] Using start_image URL: ${request.imageUrl}`);
      } else {
        console.log(`[Replicate] Skipping local image (use text-to-video mode instead)`);
      }
    }

    input.cfg_scale = 0.5;

    console.log(`[Replicate] Running prediction with input:`, JSON.stringify(input, null, 2).substring(0, 500));

    const prediction = await replicate.predictions.create({
      model: modelId,
      input,
    });
    
    console.log(`[Replicate] Prediction created:`, prediction.id, prediction.status);
    
    let finalPrediction = await replicate.wait(prediction);
    
    console.log(`[Replicate] Prediction completed`);
    console.log(`[Replicate] Status:`, finalPrediction.status);
    console.log(`[Replicate] Error:`, finalPrediction.error);
    console.log(`[Replicate] Output type:`, typeof finalPrediction.output);
    console.log(`[Replicate] Output:`, JSON.stringify(finalPrediction.output, null, 2)?.substring(0, 1000));
    
    if (finalPrediction.status === "failed") {
      return {
        status: "failed",
        error: finalPrediction.error || "Prediction failed",
      };
    }
    
    const output = finalPrediction.output;

    let videoUrl: string | undefined;
    
    if (typeof output === "string" && output.startsWith("http")) {
      videoUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      if (typeof firstItem === "string" && firstItem.startsWith("http")) {
        videoUrl = firstItem;
      } else if (firstItem && typeof firstItem === "object" && "url" in firstItem) {
        videoUrl = firstItem.url;
      }
    } else if (output && typeof output === "object") {
      const obj = output as Record<string, any>;
      if (obj.video && typeof obj.video === "object" && obj.video.url) {
        videoUrl = obj.video.url;
      } else {
        videoUrl = obj.url || obj.video_url || obj.output || obj.video;
      }
      if (Array.isArray(videoUrl)) {
        videoUrl = videoUrl[0];
      }
    }

    if (videoUrl && typeof videoUrl === "string" && videoUrl.startsWith("http")) {
      console.log(`[Replicate] Video URL extracted: ${videoUrl}`);
      return {
        status: "completed",
        videoUrl,
      };
    } else {
      console.error(`[Replicate] Could not extract video URL from output`);
      return {
        status: "failed",
        error: "No valid video URL returned from Replicate. Output: " + JSON.stringify(output).substring(0, 200),
      };
    }
  } catch (error: any) {
    console.error(`[Replicate] Error:`, error);
    return {
      status: "failed",
      error: error.message || "Unknown error during video generation",
    };
  }
}

// Async video generation - returns prediction ID immediately for polling
export async function startReplicateVideoAsync(
  request: ReplicateVideoRequest
): Promise<{ predictionId: string; status: string }> {
  const replicate = getReplicateClient();
  const modelKey = request.model || "kling-v1.6-standard";
  const modelId = REPLICATE_MODELS[modelKey as keyof typeof REPLICATE_MODELS];
  
  if (!modelId) {
    throw new Error(`Unknown Replicate model: ${modelKey}`);
  }

  console.log(`[Replicate] Starting async video generation with model: ${modelId}`);
  console.log(`[Replicate] Prompt: ${request.prompt?.substring(0, 100)}...`);

  let input: Record<string, any> = {
    prompt: request.prompt,
    duration: request.duration || 5,
    aspect_ratio: request.aspectRatio || "9:16",
  };

  if (request.negativePrompt) {
    input.negative_prompt = request.negativePrompt;
  }

  if (request.imageUrl) {
    if (request.imageUrl.startsWith("http://") || request.imageUrl.startsWith("https://")) {
      input.start_image = request.imageUrl;
      console.log(`[Replicate] Using start_image URL: ${request.imageUrl}`);
    }
  }

  input.cfg_scale = 0.5;

  console.log(`[Replicate] Creating prediction with input:`, JSON.stringify(input, null, 2).substring(0, 500));

  const prediction = await replicate.predictions.create({
    model: modelId,
    input,
  });
  
  console.log(`[Replicate] Prediction created: ${prediction.id}, status: ${prediction.status}`);
  
  return {
    predictionId: prediction.id,
    status: prediction.status,
  };
}

// Check status of a Replicate prediction
export async function checkReplicatePrediction(
  predictionId: string
): Promise<ReplicateVideoResult> {
  const replicate = getReplicateClient();
  
  console.log(`[Replicate] Checking prediction status: ${predictionId}`);
  
  try {
    const prediction = await replicate.predictions.get(predictionId);
    
    console.log(`[Replicate] Prediction ${predictionId}: status=${prediction.status}`);
    
    if (prediction.status === "starting" || prediction.status === "processing") {
      return { status: "processing" };
    }
    
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return {
        status: "failed",
        error: prediction.error || "Prediction failed or was canceled",
      };
    }
    
    if (prediction.status === "succeeded") {
      const output = prediction.output;
      let videoUrl: string | undefined;
      
      if (typeof output === "string" && output.startsWith("http")) {
        videoUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem === "string" && firstItem.startsWith("http")) {
          videoUrl = firstItem;
        } else if (firstItem && typeof firstItem === "object" && "url" in firstItem) {
          videoUrl = (firstItem as any).url;
        }
      } else if (output && typeof output === "object") {
        const obj = output as Record<string, any>;
        if (obj.video && typeof obj.video === "object" && obj.video.url) {
          videoUrl = obj.video.url;
        } else {
          videoUrl = obj.url || obj.video_url || obj.output || obj.video;
        }
        if (Array.isArray(videoUrl)) {
          videoUrl = videoUrl[0];
        }
      }

      if (videoUrl && typeof videoUrl === "string" && videoUrl.startsWith("http")) {
        console.log(`[Replicate] Video completed: ${videoUrl}`);
        return { status: "completed", videoUrl };
      } else {
        return {
          status: "failed",
          error: "No valid video URL returned",
        };
      }
    }
    
    return { status: "pending" };
  } catch (error: any) {
    console.error(`[Replicate] Error checking prediction:`, error);
    return {
      status: "failed",
      error: error.message || "Error checking prediction status",
    };
  }
}
