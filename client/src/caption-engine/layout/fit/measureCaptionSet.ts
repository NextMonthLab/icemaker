import { fitTextToBox, type FitSettings, type FitResult } from './fitTextToBox';
import { composeTitleLines, type CaptionLayoutMode } from '../title';

export interface CaptionSetMeasurement {
  globalScaleFactor: number;
  individualResults: FitResult[];
  smallestFontSize: number;
  baseFontSize: number;
}

export interface MeasureCaptionSetInput {
  captions: string[];
  containerWidthPx: number;
  baseFontSize: number;
  minFontSize: number;
  maxLines: 1 | 2 | 3 | 4 | 5;
  padding: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
  layoutMode: CaptionLayoutMode;
}

export function measureCaptionSet(input: MeasureCaptionSetInput): CaptionSetMeasurement {
  const {
    captions,
    containerWidthPx,
    baseFontSize,
    minFontSize,
    maxLines,
    padding,
    lineHeight,
    fontFamily,
    fontWeight,
    layoutMode,
  } = input;

  if (captions.length === 0) {
    return {
      globalScaleFactor: 1,
      individualResults: [],
      smallestFontSize: baseFontSize,
      baseFontSize,
    };
  }

  const fitSettings: FitSettings = {
    maxLines,
    panelMaxWidthPercent: 92,
    baseFontSize,
    minFontSize,
    padding,
    lineHeight,
    fontFamily,
    fontWeight,
  };

  const results: FitResult[] = [];
  let smallestFontSize = baseFontSize;

  for (const caption of captions) {
    if (!caption || !caption.trim()) {
      results.push({
        lines: [''],
        fontSize: baseFontSize,
        lineCount: 1,
        panelWidth: containerWidthPx * 0.92,
        fitted: true,
        warning: null,
        iterations: 0,
        overflowLog: [],
      });
      continue;
    }

    const composedLines = composeTitleLines(caption, { layoutMode });
    const composedText = composedLines.join('\n');
    const result = fitTextToBox(composedText, containerWidthPx, fitSettings);
    result.lines = composedLines;
    results.push(result);

    if (result.fontSize < smallestFontSize) {
      smallestFontSize = result.fontSize;
    }
  }

  // Calculate raw scale factor
  const rawScaleFactor = smallestFontSize / baseFontSize;
  
  // Clamp the global scale factor to prevent extreme shrinking
  // If one caption needs to shrink below 85%, let it shrink individually
  // rather than dragging all captions down
  const SCALE_THRESHOLD = 0.85;
  const globalScaleFactor = rawScaleFactor >= SCALE_THRESHOLD ? rawScaleFactor : 1;

  return {
    globalScaleFactor,
    individualResults: results,
    smallestFontSize,
    baseFontSize,
  };
}
