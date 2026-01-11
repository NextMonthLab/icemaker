export type CaptionLayoutMode = 'title' | 'paragraph';

export type TitleComposeOptions = {
  maxLines?: 1 | 2 | 3 | 4 | 5;
  targetWordsPerLine?: [number, number];
  allowSingleWordLineForNumbers?: boolean;
  layoutMode?: CaptionLayoutMode;
};

const TITLE_MODE_OPTIONS: Required<Omit<TitleComposeOptions, 'layoutMode'>> = {
  maxLines: 3,
  targetWordsPerLine: [2, 4],
  allowSingleWordLineForNumbers: true,
};

const PARAGRAPH_MODE_OPTIONS: Required<Omit<TitleComposeOptions, 'layoutMode'>> = {
  maxLines: 5,
  targetWordsPerLine: [3, 6],
  allowSingleWordLineForNumbers: true,
};

function getDefaultOptions(mode: CaptionLayoutMode): Required<Omit<TitleComposeOptions, 'layoutMode'>> {
  return mode === 'paragraph' ? PARAGRAPH_MODE_OPTIONS : TITLE_MODE_OPTIONS;
}

function isNumericToken(word: string): boolean {
  return /^\d+%?$/.test(word) || /^\$[\d,.]+$/.test(word);
}

function scoreSplit(lines: string[], opts: Required<TitleComposeOptions>): number {
  let penalty = 0;
  const [minWords, maxWords] = opts.targetWordsPerLine;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const words = line.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (i === lines.length - 1 && wordCount === 1) {
      const isNumeric = isNumericToken(words[0]);
      if (!isNumeric || !opts.allowSingleWordLineForNumbers) {
        penalty += 1000;
      }
    }

    if (wordCount > maxWords + 1) {
      penalty += (wordCount - maxWords) * 50;
    }

    if (wordCount < minWords && wordCount > 0 && lines.length > 1) {
      penalty += (minWords - wordCount) * 20;
    }
  }

  const lengths = lines.map(l => l.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  const imbalance = maxLen - minLen;
  penalty += imbalance * 2;

  if (lines.length >= 2) {
    const lastLen = lengths[lengths.length - 1];
    const firstLen = lengths[0];
    if (lastLen > firstLen * 1.5) {
      penalty += 30;
    }
  }

  if (lines.length === 3) {
    const middleLen = lengths[1];
    const avgOthers = (lengths[0] + lengths[2]) / 2;
    if (middleLen < avgOthers * 0.4) {
      penalty += 25;
    }
  }

  penalty += lines.length * 0.5;

  return penalty;
}

function generateCandidateSplits(words: string[], maxLines: number): string[][] {
  const results: string[][] = [];
  const n = words.length;

  results.push([words.join(' ')]);

  if (maxLines >= 2 && n >= 2) {
    for (let i = 1; i < n; i++) {
      results.push([
        words.slice(0, i).join(' '),
        words.slice(i).join(' ')
      ]);
    }
  }

  if (maxLines >= 3 && n >= 3) {
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        results.push([
          words.slice(0, i).join(' '),
          words.slice(i, j).join(' '),
          words.slice(j).join(' ')
        ]);
      }
    }
  }

  if (maxLines >= 4 && n >= 4) {
    for (let i = 1; i < n - 2; i++) {
      for (let j = i + 1; j < n - 1; j++) {
        for (let k = j + 1; k < n; k++) {
          results.push([
            words.slice(0, i).join(' '),
            words.slice(i, j).join(' '),
            words.slice(j, k).join(' '),
            words.slice(k).join(' ')
          ]);
        }
      }
    }
  }

  if (maxLines >= 5 && n >= 5) {
    for (let i = 1; i < n - 3; i++) {
      for (let j = i + 1; j < n - 2; j++) {
        for (let k = j + 1; k < n - 1; k++) {
          for (let l = k + 1; l < n; l++) {
            results.push([
              words.slice(0, i).join(' '),
              words.slice(i, j).join(' '),
              words.slice(j, k).join(' '),
              words.slice(k, l).join(' '),
              words.slice(l).join(' ')
            ]);
          }
        }
      }
    }
  }

  return results;
}

export function composeTitleLines(
  text: string,
  opts?: TitleComposeOptions
): string[] {
  const mode = opts?.layoutMode || 'title';
  const defaults = getDefaultOptions(mode);
  const options = { ...defaults, ...opts };
  const trimmedText = text.trim();

  if (!trimmedText) {
    return [''];
  }

  const words = trimmedText.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return [''];
  }

  if (words.length === 1) {
    return [trimmedText];
  }

  if (words.length === 2) {
    return [trimmedText];
  }

  const candidates = generateCandidateSplits(words, options.maxLines);

  let bestSplit: string[] = [trimmedText];
  let bestScore = Infinity;

  for (const candidate of candidates) {
    const score = scoreSplit(candidate, options);
    if (score < bestScore) {
      bestScore = score;
      bestSplit = candidate;
    }
  }

  return bestSplit;
}
