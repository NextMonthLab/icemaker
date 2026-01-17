import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storage } from "../storage";
import { VideoExportQuality, VideoExportStatus } from "@shared/schema";
import { getTitlePackById, DEFAULT_TITLE_PACK_ID, TITLE_PACKS } from "@shared/titlePacks";
import { putObject, isObjectStorageConfigured } from "../storage/objectStore";
import type { CaptionState } from "@shared/captionTypes";
import { generateASSFromCaptionState } from "../caption-engine/assGenerator";

interface ExportConfig {
  jobId: string;
  userId: number;
  previewId: string;
  quality: VideoExportQuality;
  includeNarration: boolean;
  includeMusic: boolean;
  titlePackId?: string;
  musicTrackUrl?: string;
  musicVolume?: number;
  narrationVolume?: number;
  captionState?: CaptionState;
  useCaptionEngine?: boolean;
}

interface CardData {
  id: string;
  title: string;
  content: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  narrationAudioUrl?: string;
  duration?: number;
}

const QUALITY_SETTINGS: Record<VideoExportQuality, { width: number; height: number; crf: number; preset: string }> = {
  draft: { width: 720, height: 1280, crf: 30, preset: "ultrafast" },
  standard: { width: 1080, height: 1920, crf: 26, preset: "veryfast" },
  hd: { width: 1080, height: 1920, crf: 23, preset: "faster" },
};

const CARD_DURATION = 5;

function getCardDuration(card: CardData): number {
  return card.duration || CARD_DURATION;
}

function resolveAbsoluteUrl(url: string): string {
  if (!url) return url;
  
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  let baseUrl: string;
  if (process.env.PUBLIC_URL) {
    baseUrl = process.env.PUBLIC_URL;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (process.env.RENDER_EXTERNAL_URL) {
    baseUrl = process.env.RENDER_EXTERNAL_URL;
  } else {
    baseUrl = "http://localhost:5000";
  }
  
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  
  return `${cleanBase}${cleanPath}`;
}

async function downloadFile(url: string, destPath: string, timeoutMs: number = 60000): Promise<void> {
  const absoluteUrl = resolveAbsoluteUrl(url);
  console.log(`[Export] Downloading: ${absoluteUrl}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(absoluteUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download ${absoluteUrl}: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(destPath, Buffer.from(buffer));
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Download timeout after ${timeoutMs}ms: ${absoluteUrl}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runFFmpeg(args: string[], timeoutMs: number = 180000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      ffmpeg.kill("SIGKILL");
      reject(new Error(`FFmpeg timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    ffmpeg.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      clearTimeout(timeout);
      if (killed) return;
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", (err) => {
      clearTimeout(timeout);
      if (killed) return;
      reject(err);
    });
  });
}

async function cleanupFiles(paths: string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      await fs.promises.unlink(filePath);
    } catch (e) {
    }
  }
}

async function getDirSizeMB(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stats = await fs.promises.stat(fullPath);
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        totalSize += await getDirSizeMB(fullPath) * 1024 * 1024;
      }
    }
  } catch (e) {
  }
  return totalSize / (1024 * 1024);
}

async function logDirSize(tempDir: string, label: string): Promise<void> {
  const sizeMB = await getDirSizeMB(tempDir);
  console.log(`[Export] ${label}: tempDir size = ${sizeMB.toFixed(2)} MB`);
}

async function updateJobProgress(jobId: string, progress: number, currentStep: string): Promise<void> {
  await storage.updateVideoExportJob(jobId, {
    progress,
    currentStep,
  });
}

async function updateJobStatus(jobId: string, status: VideoExportStatus, errorMessage?: string): Promise<void> {
  const updates: any = { status };
  if (status === "processing") {
    updates.startedAt = new Date();
  } else if (status === "completed" || status === "failed") {
    updates.completedAt = new Date();
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }
  await storage.updateVideoExportJob(jobId, updates);
}

export async function processVideoExport(config: ExportConfig): Promise<string> {
  const { jobId, previewId, quality, includeNarration, includeMusic, musicTrackUrl, musicVolume = 15, narrationVolume = 100, captionState, useCaptionEngine = false } = config;
  const titlePackId = config.titlePackId || DEFAULT_TITLE_PACK_ID;

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ice-export-"));
  const qualitySettings = QUALITY_SETTINGS[quality];

  try {
    await updateJobStatus(jobId, "processing");
    await updateJobProgress(jobId, 5, "Fetching preview data...");

    const preview = await storage.getIcePreview(previewId);
    if (!preview) {
      throw new Error("Preview not found");
    }

    const cards: CardData[] = (preview.cards as any[]) || [];
    if (cards.length === 0) {
      throw new Error("No cards to export");
    }

    await updateJobProgress(jobId, 10, "Processing cards...");
    await logDirSize(tempDir, "Start");

    const titlePack = getTitlePackById(titlePackId) || TITLE_PACKS[0];
    const cardDurations: number[] = [];
    
    let rollingVideoPath: string | null = null;
    const concatListPath = path.join(tempDir, "concat.txt");

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const progress = 10 + (i / cards.length) * 50;
      await updateJobProgress(jobId, progress, `Processing card ${i + 1}/${cards.length}...`);
      console.log(`[Export ${jobId}] Starting card ${i + 1}/${cards.length}, video: ${card.generatedVideoUrl ? 'yes' : 'no'}, image: ${card.generatedImageUrl ? 'yes' : 'no'}`);

      const duration = getCardDuration(card);
      cardDurations.push(duration);

      const filesToCleanup: string[] = [];
      let cardVideoPath: string;

      try {
        if (card.generatedVideoUrl) {
          console.log(`[Export ${jobId}] Downloading video: ${card.generatedVideoUrl}`);
          const videoPath = path.join(tempDir, `card_${i}_video.mp4`);
          await downloadFile(card.generatedVideoUrl, videoPath);
          console.log(`[Export ${jobId}] Video downloaded successfully`);
          cardVideoPath = videoPath;
          filesToCleanup.push(videoPath);
        } else if (card.generatedImageUrl) {
          console.log(`[Export ${jobId}] Downloading image: ${card.generatedImageUrl}`);
          const imagePath = path.join(tempDir, `card_${i}_image.jpg`);
          await downloadFile(card.generatedImageUrl, imagePath);
          console.log(`[Export ${jobId}] Image downloaded successfully`);
          filesToCleanup.push(imagePath);
          
          cardVideoPath = path.join(tempDir, `card_${i}_from_image.mp4`);
          await runFFmpeg([
            "-y",
            "-loop", "1",
            "-i", imagePath,
            "-c:v", "libx264",
            "-t", duration.toString(),
            "-pix_fmt", "yuv420p",
            "-vf", `scale=${qualitySettings.width}:${qualitySettings.height}:force_original_aspect_ratio=decrease,pad=${qualitySettings.width}:${qualitySettings.height}:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.2)':d=${duration * 30}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${qualitySettings.width}x${qualitySettings.height}`,
            "-r", "30",
            "-crf", qualitySettings.crf.toString(),
            "-preset", qualitySettings.preset,
            cardVideoPath,
          ]);
          await cleanupFiles([imagePath]);
          filesToCleanup.push(cardVideoPath);
        } else {
          cardVideoPath = path.join(tempDir, `card_${i}_placeholder.mp4`);
          await runFFmpeg([
            "-y",
            "-f", "lavfi",
            "-i", `color=c=black:s=${qualitySettings.width}x${qualitySettings.height}:d=${duration}`,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-crf", qualitySettings.crf.toString(),
            "-preset", qualitySettings.preset,
            cardVideoPath,
          ]);
          filesToCleanup.push(cardVideoPath);
        }

        let captionedPath = cardVideoPath;
        
        if (!useCaptionEngine || !captionState || !captionState.phraseGroups || captionState.phraseGroups.length === 0) {
          const outputPath = path.join(tempDir, `card_${i}_captioned.mp4`);
          const captionText = card.content.split(". ").slice(0, 2).join(". ");
          
          const captionFilePath = path.join(tempDir, `card_${i}_caption.txt`);
          await fs.promises.writeFile(captionFilePath, captionText);
          const escapedCaptionPath = captionFilePath.replace(/\\/g, "/").replace(/:/g, "\\:");

          const headlineStyle = titlePack.headline;
          const fontColor = headlineStyle.color.replace("#", "");
          const shadowColor = "0x000000@0.8";
          const fontSize = Math.round((headlineStyle.sizeMin + headlineStyle.sizeMax) / 2);

          await runFFmpeg([
            "-y",
            "-i", cardVideoPath,
            "-vf", `drawtext=textfile=${escapedCaptionPath}:fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=h-th-100:shadowcolor=${shadowColor}:shadowx=2:shadowy=2`,
            "-c:v", "libx264",
            "-crf", qualitySettings.crf.toString(),
            "-preset", qualitySettings.preset,
            "-c:a", "copy",
            outputPath,
          ]);

          await cleanupFiles([captionFilePath, cardVideoPath]);
          captionedPath = outputPath;
          filesToCleanup.length = 0;
          filesToCleanup.push(captionedPath);
        }

        if (rollingVideoPath === null) {
          rollingVideoPath = path.join(tempDir, "current.mp4");
          await fs.promises.rename(captionedPath, rollingVideoPath);
        } else {
          const nextPath = path.join(tempDir, "next.mp4");
          
          await fs.promises.writeFile(concatListPath, 
            `file '${rollingVideoPath}'\nfile '${captionedPath}'`
          );
          
          await runFFmpeg([
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concatListPath,
            "-c:v", "libx264",
            "-crf", qualitySettings.crf.toString(),
            "-preset", qualitySettings.preset,
            "-c:a", "aac",
            nextPath,
          ]);

          await cleanupFiles([rollingVideoPath, captionedPath, concatListPath]);
          
          await fs.promises.rename(nextPath, rollingVideoPath);
        }

        await logDirSize(tempDir, `After card ${i + 1}`);

      } catch (cardError) {
        await cleanupFiles(filesToCleanup);
        throw cardError;
      }
    }

    if (!rollingVideoPath) {
      throw new Error("No video output generated");
    }

    let concatenatedPath = rollingVideoPath;

    if (useCaptionEngine && captionState && captionState.phraseGroups && captionState.phraseGroups.length > 0) {
      await updateJobProgress(jobId, 65, "Applying captions...");
      
      const assContent = generateASSFromCaptionState(captionState, {
        width: qualitySettings.width,
        height: qualitySettings.height,
      });
      const assPath = path.join(tempDir, "captions.ass");
      await fs.promises.writeFile(assPath, assContent, "utf-8");

      const withCaptionsPath = path.join(tempDir, "with_captions.mp4");
      const escapedAssPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      await runFFmpeg([
        "-y",
        "-i", concatenatedPath,
        "-vf", `ass='${escapedAssPath}'`,
        "-c:v", "libx264",
        "-crf", qualitySettings.crf.toString(),
        "-preset", qualitySettings.preset,
        "-c:a", "copy",
        withCaptionsPath,
      ]);

      await cleanupFiles([concatenatedPath, assPath]);
      concatenatedPath = withCaptionsPath;
    }

    let finalVideoPath = concatenatedPath;

    if (includeNarration) {
      await updateJobProgress(jobId, 75, "Adding narration audio...");

      const narrationPaths: { path: string; startTime: number }[] = [];
      let currentTime = 0;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (card.narrationAudioUrl) {
          const narrationPath = path.join(tempDir, `narration_${i}.mp3`);
          await downloadFile(card.narrationAudioUrl, narrationPath);
          narrationPaths.push({ path: narrationPath, startTime: currentTime });
        }
        currentTime += cardDurations[i];
      }

      if (narrationPaths.length > 0) {
        const withNarrationPath = path.join(tempDir, "with_narration.mp4");
        const narrationVolumeFactor = narrationVolume / 100;

        const filterComplex = narrationPaths
          .map((n, i) => `[${i + 1}:a]adelay=${Math.round(n.startTime * 1000)}|${Math.round(n.startTime * 1000)},volume=${narrationVolumeFactor}[a${i}]`)
          .join(";");
        const mixInputs = narrationPaths.map((_, i) => `[a${i}]`).join("");
        const amixFilter = `${filterComplex};${mixInputs}amix=inputs=${narrationPaths.length}[aout]`;

        await runFFmpeg([
          "-y",
          "-i", concatenatedPath,
          ...narrationPaths.flatMap((n) => ["-i", n.path]),
          "-filter_complex", amixFilter,
          "-map", "0:v",
          "-map", "[aout]",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
          withNarrationPath,
        ]);

        await cleanupFiles([concatenatedPath, ...narrationPaths.map(n => n.path)]);
        finalVideoPath = withNarrationPath;
      }
    }

    if (includeMusic && musicTrackUrl) {
      await updateJobProgress(jobId, 85, "Adding background music...");

      const musicPath = path.join(tempDir, "music.mp3");
      await downloadFile(musicTrackUrl, musicPath);

      const withMusicPath = path.join(tempDir, "final_with_music.mp4");
      const musicVolumeFactor = (musicVolume / 100) * 0.3;

      const hasAudio = finalVideoPath !== concatenatedPath;

      if (hasAudio) {
        await runFFmpeg([
          "-y",
          "-i", finalVideoPath,
          "-stream_loop", "-1",
          "-i", musicPath,
          "-filter_complex", `[1:a]volume=${musicVolumeFactor}[music];[0:a][music]amix=inputs=2:duration=shortest[aout]`,
          "-map", "0:v",
          "-map", "[aout]",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
          withMusicPath,
        ]);
      } else {
        await runFFmpeg([
          "-y",
          "-i", finalVideoPath,
          "-stream_loop", "-1",
          "-i", musicPath,
          "-filter_complex", `[1:a]volume=${musicVolumeFactor}[aout]`,
          "-map", "0:v",
          "-map", "[aout]",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
          withMusicPath,
        ]);
      }

      await cleanupFiles([finalVideoPath, musicPath]);
      finalVideoPath = withMusicPath;
    }

    await updateJobProgress(jobId, 95, "Uploading final video...");
    await logDirSize(tempDir, "Before upload");

    const finalVideoData = await fs.promises.readFile(finalVideoPath);
    const stats = await fs.promises.stat(finalVideoPath);
    const totalDuration = cardDurations.reduce((a, b) => a + b, 0);

    const outputFileName = `exports/${jobId}.mp4`;
    
    const outputUrl = await putObject(outputFileName, finalVideoData, "video/mp4");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await storage.updateVideoExportJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "Export complete",
      outputUrl,
      outputSizeBytes: stats.size,
      outputDurationSeconds: totalDuration,
      completedAt: new Date(),
      expiresAt,
    });

    await fs.promises.rm(tempDir, { recursive: true, force: true });

    return outputUrl;
  } catch (error: any) {
    console.error(`Video export failed for job ${jobId}:`, error);
    await updateJobStatus(jobId, "failed", error.message);
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function createExportJob(config: Omit<ExportConfig, "jobId">): Promise<string> {
  const jobId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await storage.createVideoExportJob({
    jobId,
    userId: config.userId,
    quality: config.quality,
    format: "mp4",
    includeNarration: config.includeNarration,
    includeMusic: config.includeMusic,
    status: "queued",
    progress: 0,
    currentStep: "Queued for processing",
    retryCount: 0,
  });

  setImmediate(() => {
    processVideoExport({ ...config, jobId }).catch((err) => {
      console.error(`Background export failed for ${jobId}:`, err);
    });
  });

  return jobId;
}

export async function getExportJob(jobId: string) {
  return storage.getVideoExportJob(jobId);
}
