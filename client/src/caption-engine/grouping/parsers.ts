import type { TimedWord, Transcript } from "./types";

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.replace(",", ".").split(":");
  
  if (parts.length === 3) {
    const [hours, minutes, secondsMs] = parts;
    const [seconds, ms = "0"] = secondsMs.split(".");
    return (
      parseInt(hours) * 3600000 +
      parseInt(minutes) * 60000 +
      parseInt(seconds) * 1000 +
      parseInt(ms.padEnd(3, "0").slice(0, 3))
    );
  } else if (parts.length === 2) {
    const [minutes, secondsMs] = parts;
    const [seconds, ms = "0"] = secondsMs.split(".");
    return (
      parseInt(minutes) * 60000 +
      parseInt(seconds) * 1000 +
      parseInt(ms.padEnd(3, "0").slice(0, 3))
    );
  }
  
  return 0;
}

export function parseSRT(srtContent: string): Transcript {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  const words: TimedWord[] = [];
  let maxEndMs = 0;
  
  for (const block of blocks) {
    const lines = block.split("\n").filter(l => l.trim());
    if (lines.length < 2) continue;
    
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) continue;
    
    const [startStr, endStr] = timeLine.split("-->").map(s => s.trim());
    const startMs = parseTimestamp(startStr);
    const endMs = parseTimestamp(endStr);
    maxEndMs = Math.max(maxEndMs, endMs);
    
    const textLines = lines.filter(l => !l.includes("-->") && !/^\d+$/.test(l.trim()));
    const text = textLines.join(" ").replace(/<[^>]*>/g, "").trim();
    
    if (!text) continue;
    
    const blockWords = text.split(/\s+/).filter(w => w);
    const wordDuration = (endMs - startMs) / blockWords.length;
    
    blockWords.forEach((word, i) => {
      words.push({
        word,
        startMs: startMs + i * wordDuration,
        endMs: startMs + (i + 1) * wordDuration,
      });
    });
  }
  
  return { words, durationMs: maxEndMs };
}

export function parseVTT(vttContent: string): Transcript {
  const lines = vttContent.split("\n");
  const words: TimedWord[] = [];
  let maxEndMs = 0;
  
  let i = 0;
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.includes("-->")) {
      const [startStr, endStrPart] = line.split("-->");
      const endStr = endStrPart.split(" ")[0].trim();
      const startMs = parseTimestamp(startStr.trim());
      const endMs = parseTimestamp(endStr);
      maxEndMs = Math.max(maxEndMs, endMs);
      
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].includes("-->")) {
        textLines.push(lines[i]);
        i++;
      }
      
      const text = textLines.join(" ").replace(/<[^>]*>/g, "").trim();
      if (text) {
        const blockWords = text.split(/\s+/).filter(w => w);
        const wordDuration = (endMs - startMs) / blockWords.length;
        
        blockWords.forEach((word, j) => {
          words.push({
            word,
            startMs: startMs + j * wordDuration,
            endMs: startMs + (j + 1) * wordDuration,
          });
        });
      }
    } else {
      i++;
    }
  }
  
  return { words, durationMs: maxEndMs };
}

export function parseJSON(jsonWords: Array<{ word: string; start: number; end: number; confidence?: number }>): Transcript {
  const words: TimedWord[] = jsonWords.map(w => ({
    word: w.word,
    startMs: w.start * 1000,
    endMs: w.end * 1000,
    confidence: w.confidence,
  }));
  
  const durationMs = words.length > 0 ? words[words.length - 1].endMs : 0;
  
  return { words, durationMs };
}

export function detectAndParse(content: string): Transcript {
  const trimmed = content.trim();
  
  if (trimmed.startsWith("WEBVTT")) {
    return parseVTT(trimmed);
  }
  
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const wordsArray = Array.isArray(parsed) ? parsed : parsed.words;
      return parseJSON(wordsArray);
    } catch {
      // Not valid JSON
    }
  }
  
  if (/^\d+\s*\n\d{2}:\d{2}/.test(trimmed)) {
    return parseSRT(trimmed);
  }
  
  const plainWords = trimmed.split(/\s+/).filter(w => w);
  const avgWordDuration = 300;
  let currentMs = 0;
  
  const words: TimedWord[] = plainWords.map(word => {
    const startMs = currentMs;
    const endMs = currentMs + avgWordDuration;
    currentMs = endMs + 50;
    return { word, startMs, endMs };
  });
  
  return { words, durationMs: currentMs };
}
