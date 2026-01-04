import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storage } from "../storage";
import { VideoExportQuality, VideoExportStatus } from "@shared/schema";
import { getTitlePackById, DEFAULT_TITLE_PACK_ID, TITLE_PACKS } from "@shared/titlePacks";
import { putObject, isObjectStorageConfigured } from "../storage/objectStore";

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
  draft: { width: 720, height: 1280, crf: 28, preset: "ultrafast" },
  standard: { width: 1080, height: 1920, crf: 23, preset: "medium" },
  hd: { width: 1080, height: 1920, crf: 18, preset: "slow" },
};

const CARD_DURATION = 5;

function getCardDuration(card: CardData): number {
  return card.duration || CARD_DURATION;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  await fs.promises.writeFile(destPath, Buffer.from(buffer));
}

async function runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stdout = "";
    let stderr = "";

    ffmpeg.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
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
  const { jobId, previewId, quality, includeNarration, includeMusic, musicTrackUrl, musicVolume = 50, narrationVolume = 100 } = config;
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

    await updateJobProgress(jobId, 10, "Downloading media files...");

    const cardInputs: string[] = [];
    const cardDurations: number[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const progress = 10 + (i / cards.length) * 40;
      await updateJobProgress(jobId, progress, `Downloading card ${i + 1}/${cards.length}...`);

      const duration = getCardDuration(card);
      cardDurations.push(duration);

      if (card.generatedVideoUrl) {
        const videoPath = path.join(tempDir, `card_${i}_video.mp4`);
        await downloadFile(card.generatedVideoUrl, videoPath);
        cardInputs.push(videoPath);
      } else if (card.generatedImageUrl) {
        const imagePath = path.join(tempDir, `card_${i}_image.jpg`);
        await downloadFile(card.generatedImageUrl, imagePath);
        
        const videoPath = path.join(tempDir, `card_${i}_from_image.mp4`);
        await runFFmpeg([
          "-y",
          "-loop", "1",
          "-i", imagePath,
          "-c:v", "libx264",
          "-t", duration.toString(),
          "-pix_fmt", "yuv420p",
          "-vf", `scale=${qualitySettings.width}:${qualitySettings.height}:force_original_aspect_ratio=decrease,pad=${qualitySettings.width}:${qualitySettings.height}:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.2)':d=${duration * 30}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${qualitySettings.width}x${qualitySettings.height}`,
          "-r", "30",
          "-preset", qualitySettings.preset,
          videoPath,
        ]);
        cardInputs.push(videoPath);
      } else {
        const videoPath = path.join(tempDir, `card_${i}_placeholder.mp4`);
        await runFFmpeg([
          "-y",
          "-f", "lavfi",
          "-i", `color=c=black:s=${qualitySettings.width}x${qualitySettings.height}:d=${duration}`,
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-preset", qualitySettings.preset,
          videoPath,
        ]);
        cardInputs.push(videoPath);
      }
    }

    await updateJobProgress(jobId, 55, "Adding captions...");

    const titlePack = getTitlePackById(titlePackId) || TITLE_PACKS[0];
    const cardVideosWithCaptions: string[] = [];

    for (let i = 0; i < cardInputs.length; i++) {
      const card = cards[i];
      const inputPath = cardInputs[i];
      const outputPath = path.join(tempDir, `card_${i}_captioned.mp4`);

      const captionText = card.content.split(". ").slice(0, 2).join(". ");
      const escapedText = captionText
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "'\\''")
        .replace(/:/g, "\\:")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");

      const headlineStyle = titlePack.headline;
      const fontColor = headlineStyle.color.replace("#", "");
      const shadowColor = headlineStyle.shadow?.color || "black";
      const fontSize = Math.round((headlineStyle.sizeMin + headlineStyle.sizeMax) / 2);
      const fontWeight = headlineStyle.fontWeight >= 700 ? ":force_style='Bold'" : "";

      await runFFmpeg([
        "-y",
        "-i", inputPath,
        "-vf", `drawtext=text='${escapedText}':fontcolor=${fontColor}:fontsize=${fontSize}:x=(w-text_w)/2:y=h-th-100:shadowcolor=${shadowColor}:shadowx=2:shadowy=2${fontWeight}`,
        "-c:v", "libx264",
        "-crf", qualitySettings.crf.toString(),
        "-preset", qualitySettings.preset,
        "-c:a", "copy",
        outputPath,
      ]);

      cardVideosWithCaptions.push(outputPath);
    }

    await updateJobProgress(jobId, 70, "Concatenating cards...");

    const concatListPath = path.join(tempDir, "concat.txt");
    const concatContent = cardVideosWithCaptions.map((p) => `file '${p}'`).join("\n");
    await fs.promises.writeFile(concatListPath, concatContent);

    const concatenatedPath = path.join(tempDir, "concatenated.mp4");
    await runFFmpeg([
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c:v", "libx264",
      "-crf", qualitySettings.crf.toString(),
      "-preset", qualitySettings.preset,
      "-c:a", "aac",
      concatenatedPath,
    ]);

    let finalVideoPath = concatenatedPath;

    if (includeNarration) {
      await updateJobProgress(jobId, 80, "Adding narration audio...");

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

        const filterInputs = narrationPaths.map((n, i) => `-i ${n.path}`).join(" ");
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

        finalVideoPath = withNarrationPath;
      }
    }

    if (includeMusic && musicTrackUrl) {
      await updateJobProgress(jobId, 90, "Adding background music...");

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

      finalVideoPath = withMusicPath;
    }

    await updateJobProgress(jobId, 95, "Uploading final video...");

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
