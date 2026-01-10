import type { TimedWord, GroupingConfig, PhraseGroupResult } from "./types";
import { defaultGroupingConfig } from "./types";

function isPunctuation(word: string): boolean {
  return /[.!?,;:]$/.test(word);
}

function isSentenceEnd(word: string): boolean {
  return /[.!?]$/.test(word);
}

function generateGroupId(): string {
  return `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function breakIntoLines(words: TimedWord[], maxCharsPerLine: number): string[] {
  if (words.length === 0) return [];
  
  const lines: string[] = [];
  let currentLine = "";
  
  for (const { word } of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

function countLinesNeeded(words: TimedWord[], maxCharsPerLine: number): number {
  if (words.length === 0) return 0;
  const lines = breakIntoLines(words, maxCharsPerLine);
  return lines.length;
}

export function groupWordsIntoPhrases(
  words: TimedWord[],
  config: Partial<GroupingConfig> = {}
): PhraseGroupResult[] {
  const cfg: GroupingConfig = { ...defaultGroupingConfig, ...config };
  
  if (words.length === 0) return [];
  
  const groups: PhraseGroupResult[] = [];
  let currentWords: TimedWord[] = [];
  
  const flushGroup = () => {
    if (currentWords.length === 0) return;
    
    const lines = breakIntoLines(currentWords, cfg.maxCharsPerLine);
    
    groups.push({
      id: generateGroupId(),
      lines,
      words: [...currentWords],
      startMs: currentWords[0].startMs,
      endMs: currentWords[currentWords.length - 1].endMs,
    });
    
    currentWords = [];
  };
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];
    
    const testWords = [...currentWords, word];
    const linesNeeded = countLinesNeeded(testWords, cfg.maxCharsPerLine);
    const wouldExceedLines = linesNeeded > cfg.maxLinesPerGroup;
    const wouldExceedWords = testWords.length > cfg.maxWordsPerGroup;
    
    if (wouldExceedLines || wouldExceedWords) {
      flushGroup();
    }
    
    currentWords.push(word);
    
    if (nextWord) {
      const pauseMs = nextWord.startMs - word.endMs;
      const hasPause = pauseMs >= cfg.minPauseForBreakMs;
      const hasPunctuation = cfg.preferBreakOnPunctuation && isSentenceEnd(word.word);
      
      if (hasPause || hasPunctuation) {
        flushGroup();
      }
    }
  }
  
  flushGroup();
  
  return groups;
}

export function mergeShortGroups(
  groups: PhraseGroupResult[],
  minDurationMs: number = 800
): PhraseGroupResult[] {
  if (groups.length <= 1) return groups;
  
  const merged: PhraseGroupResult[] = [];
  let pending: PhraseGroupResult | null = null;
  
  for (const group of groups) {
    const duration = group.endMs - group.startMs;
    
    if (pending) {
      const combinedWords = [...pending.words, ...group.words];
      const combinedText = combinedWords.map(w => w.word).join(" ");
      
      merged.push({
        id: pending.id,
        lines: breakIntoLines(combinedWords, defaultGroupingConfig.maxCharsPerLine),
        words: combinedWords,
        startMs: pending.startMs,
        endMs: group.endMs,
      });
      pending = null;
    } else if (duration < minDurationMs && groups.indexOf(group) < groups.length - 1) {
      pending = group;
    } else {
      merged.push(group);
    }
  }
  
  if (pending) {
    merged.push(pending);
  }
  
  return merged;
}

export function addDisplayPadding(
  groups: PhraseGroupResult[],
  paddingMs: number = 100,
  minDurationMs: number = 200,
  safetyMarginMs: number = 30
): PhraseGroupResult[] {
  return groups.map((group, index) => {
    const nextGroup = groups[index + 1];
    const prevGroup = groups[index - 1];
    
    const originalDuration = group.endMs - group.startMs;
    const naturalDuration = Math.max(originalDuration, minDurationMs);
    
    let startMs = group.startMs;
    let endMs = group.endMs;
    
    const maxEndMs = nextGroup 
      ? nextGroup.startMs - safetyMarginMs 
      : Infinity;
    
    const minStartMs = prevGroup
      ? prevGroup.endMs + safetyMarginMs
      : 0;
    
    if (!prevGroup && originalDuration >= minDurationMs) {
      startMs = group.startMs;
    } else if (!prevGroup) {
      const leadPad = Math.min(paddingMs, group.startMs);
      startMs = Math.max(0, group.startMs - leadPad);
    } else {
      const gapBefore = group.startMs - prevGroup.endMs;
      if (gapBefore > paddingMs * 2) {
        startMs = Math.max(minStartMs, group.startMs - Math.min(paddingMs, gapBefore / 3));
      }
    }
    
    if (nextGroup) {
      const gapAfter = nextGroup.startMs - group.endMs;
      const availablePad = Math.max(0, gapAfter - safetyMarginMs);
      endMs = group.endMs + Math.min(paddingMs, availablePad);
    } else {
      endMs = group.endMs + paddingMs;
    }
    
    if (endMs - startMs < minDurationMs) {
      const targetEnd = startMs + minDurationMs;
      endMs = Math.min(targetEnd, maxEndMs);
    }
    
    if (endMs <= startMs) {
      endMs = startMs + Math.min(minDurationMs, maxEndMs - startMs);
    }
    
    if (endMs <= startMs) {
      endMs = startMs + 50;
    }
    
    return { ...group, startMs, endMs };
  });
}
