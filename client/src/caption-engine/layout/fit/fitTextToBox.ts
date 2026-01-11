import { composeLines } from './composeLines';
import { getCanvasContext, checkLinesFit } from './measurer';

export interface FitSettings {
  maxLines: 1 | 2 | 3 | 4 | 5;
  panelMaxWidthPercent: number;
  baseFontSize: number;
  minFontSize: number;
  padding: number;
  lineHeight: number;
  fontFamily?: string;
  fontWeight?: number;
}

export interface FitResult {
  lines: string[];
  fontSize: number;
  lineCount: number;
  panelWidth: number;
  fitted: boolean;
  warning: string | null;
  iterations: number;
  overflowLog: string[];
}

const SAFETY_MARGIN_PERCENT = 0.08;

export const DEFAULT_SETTINGS: FitSettings = {
  maxLines: 3,
  panelMaxWidthPercent: 92,
  baseFontSize: 56,
  minFontSize: 12,
  padding: 16,
  lineHeight: 1.1,
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  fontWeight: 700
};

function forceLineBreaks(words: string[], targetLines: number): string[] {
  if (words.length <= targetLines) {
    return words.slice();
  }
  
  const wordsPerLine = Math.ceil(words.length / targetLines);
  const lines: string[] = [];
  
  for (let i = 0; i < targetLines; i++) {
    const start = i * wordsPerLine;
    const end = Math.min(start + wordsPerLine, words.length);
    if (start < words.length) {
      lines.push(words.slice(start, end).join(' '));
    }
  }
  
  return lines.filter(l => l.length > 0);
}

function tryFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  targetLines: number,
  availableWidth: number,
  settings: FitSettings,
  overflowLog: string[]
): { lines: string[]; fontSize: number } | null {
  const words = text.split(/\s+/);
  
  let lines: string[];
  if (targetLines === 1) {
    lines = [text];
  } else {
    const composition = composeLines(text, targetLines);
    lines = composition.lines;
    if (lines.length < targetLines && words.length >= targetLines) {
      lines = forceLineBreaks(words, targetLines);
    }
  }
  
  overflowLog.push(`Lines=${lines.length}: [${lines.map(l => `"${l}"`).join(', ')}]`);
  
  let fontSize = settings.baseFontSize;
  
  while (fontSize >= settings.minFontSize) {
    const { fits, maxWidth } = checkLinesFit(
      ctx, 
      lines, 
      availableWidth, 
      fontSize,
      settings.fontFamily,
      settings.fontWeight
    );
    
    if (fits) {
      overflowLog.push(`OK ${fontSize}px fits (${Math.round(maxWidth)}px <= ${Math.round(availableWidth)}px)`);
      return { lines, fontSize };
    }
    
    overflowLog.push(`X ${fontSize}px overflow (${Math.round(maxWidth)}px > ${Math.round(availableWidth)}px)`);
    fontSize -= 2;
  }
  
  return null;
}

export function fitTextToBox(
  text: string,
  containerWidth: number,
  settings: FitSettings = DEFAULT_SETTINGS
): FitResult {
  const overflowLog: string[] = [];
  
  const trimmedText = text.trim();
  const panelWidth = (containerWidth * settings.panelMaxWidthPercent) / 100;
  const rawAvailableWidth = panelWidth - (settings.padding * 2);
  const availableWidth = rawAvailableWidth * (1 - SAFETY_MARGIN_PERCENT);
  
  if (!trimmedText) {
    return {
      lines: [''],
      fontSize: settings.baseFontSize,
      lineCount: 1,
      panelWidth,
      fitted: true,
      warning: null,
      iterations: 0,
      overflowLog: []
    };
  }
  
  const words = trimmedText.split(/\s+/);
  const wordCount = words.length;
  const hasLongToken = words.some(w => w.length > 25);
  
  overflowLog.push(`Container=${containerWidth}px Panel=${panelWidth.toFixed(0)}px Available=${Math.round(availableWidth)}px`);
  
  const ctx = getCanvasContext();
  
  for (let targetLines = 1; targetLines <= settings.maxLines; targetLines++) {
    if (wordCount < targetLines) continue;
    
    const result = tryFit(ctx, trimmedText, targetLines, availableWidth, settings, overflowLog);
    
    if (result) {
      return {
        lines: result.lines,
        fontSize: result.fontSize,
        lineCount: result.lines.length,
        panelWidth,
        fitted: true,
        warning: null,
        iterations: 0,
        overflowLog
      };
    }
    
    overflowLog.push(`Trying more lines...`);
  }
  
  const composition = composeLines(trimmedText, settings.maxLines);
  let finalLines = composition.lines;
  if (finalLines.length < settings.maxLines && wordCount >= settings.maxLines) {
    finalLines = forceLineBreaks(words, settings.maxLines);
  }
  
  const warning = hasLongToken
    ? 'Text contains an unbreakable long word that cannot fit without splitting'
    : 'Cannot fit text within constraints - showing at minimum size';
  
  overflowLog.push(`Warning: Min size ${settings.minFontSize}px`);
  
  return {
    lines: finalLines,
    fontSize: settings.minFontSize,
    lineCount: finalLines.length,
    panelWidth,
    fitted: false,
    warning,
    iterations: 0,
    overflowLog
  };
}
