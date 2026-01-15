import OpenAI from 'openai';
import type { AlignmentTranscript, AlignedWord, CaptionTiming, CaptionTimingSource, CaptionAlignmentStatus } from '@shared/schema';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Feature flag check
export function isAlignmentEnabled(): boolean {
  return process.env.CAPTION_ALIGNMENT_ENABLED === 'true';
}

// Normalise text for fuzzy matching
function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'") // Normalize apostrophes
    .replace(/[^\w\s']/g, '') // Remove punctuation except apostrophe
    .replace(/\s+/g, ' ')
    .trim();
}

// Tokenize text into words
function tokenise(text: string): string[] {
  return normaliseText(text).split(' ').filter(w => w.length > 0);
}

// Number word mapping for fuzzy matching
const numberWords: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
  '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
  '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
  '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
};

// Expand contractions for matching
function expandContractions(word: string): string[] {
  const contractions: Record<string, string[]> = {
    "we're": ["we", "are"],
    "you're": ["you", "are"],
    "they're": ["they", "are"],
    "i'm": ["i", "am"],
    "it's": ["it", "is"],
    "that's": ["that", "is"],
    "what's": ["what", "is"],
    "don't": ["do", "not"],
    "doesn't": ["does", "not"],
    "didn't": ["did", "not"],
    "won't": ["will", "not"],
    "can't": ["cannot"],
    "couldn't": ["could", "not"],
    "shouldn't": ["should", "not"],
    "wouldn't": ["would", "not"],
    "haven't": ["have", "not"],
    "hasn't": ["has", "not"],
    "hadn't": ["had", "not"],
    "isn't": ["is", "not"],
    "aren't": ["are", "not"],
    "wasn't": ["was", "not"],
    "weren't": ["were", "not"],
    "let's": ["let", "us"],
    "there's": ["there", "is"],
    "here's": ["here", "is"],
  };
  
  const normalised = word.toLowerCase();
  if (contractions[normalised]) {
    return contractions[normalised];
  }
  return [word];
}

// Fuzzy word match with tolerance
function wordsMatch(captionWord: string, transcriptWord: string): boolean {
  const a = normaliseText(captionWord);
  const b = normaliseText(transcriptWord);
  
  if (a === b) return true;
  
  // Number matching
  if (numberWords[a] === b || numberWords[b] === a) return true;
  if (a === numberWords[b] || b === numberWords[a]) return true;
  
  return false;
}

export interface AlignmentResult {
  timings: CaptionTiming[];
  transcript: AlignmentTranscript;
  status: CaptionAlignmentStatus;
  alignedCount: number;
  totalCount: number;
}

// Call Whisper API to transcribe audio
export async function transcribeAudio(audioUrl: string): Promise<AlignmentTranscript | null> {
  try {
    // Download audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error('[whisperAlignment] Failed to fetch audio:', response.statusText);
      return null;
    }
    
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    const audioFile = new File([audioBlob], 'narration.mp3', { type: 'audio/mp3' });
    
    // Call Whisper API with word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });
    
    // Extract words with timestamps
    const words: AlignedWord[] = [];
    if (transcription.words) {
      for (const word of transcription.words) {
        words.push({
          w: word.word,
          startMs: Math.round(word.start * 1000),
          endMs: Math.round(word.end * 1000),
        });
      }
    }
    
    // Also extract segments if available
    const segments: { text: string; startMs: number; endMs: number }[] = [];
    if (transcription.segments) {
      for (const seg of transcription.segments) {
        segments.push({
          text: seg.text,
          startMs: Math.round(seg.start * 1000),
          endMs: Math.round(seg.end * 1000),
        });
      }
    }
    
    return {
      provider: 'openai_whisper',
      model: 'whisper-1',
      createdAt: new Date().toISOString(),
      words,
      segments,
    };
  } catch (error) {
    console.error('[whisperAlignment] Transcription failed:', error);
    return null;
  }
}

// Align captions to transcript words using sequential greedy matching
export function alignCaptionsToTranscript(
  captions: string[],
  transcript: AlignmentTranscript,
  audioDurationMs: number
): AlignmentResult {
  const words = transcript.words;
  const timings: CaptionTiming[] = [];
  let pointer = 0;
  let alignedCount = 0;
  
  for (let i = 0; i < captions.length; i++) {
    const captionText = captions[i];
    let captionTokens = tokenise(captionText);
    
    // Expand contractions in caption tokens
    captionTokens = captionTokens.flatMap(expandContractions);
    
    if (captionTokens.length === 0) {
      // Empty caption - use heuristic
      timings.push({
        startMs: 0,
        endMs: 0,
        timingSource: 'heuristic' as CaptionTimingSource,
        timingVersion: 1,
      });
      continue;
    }
    
    // Search for best matching window starting at pointer
    let bestMatchStart = -1;
    let bestMatchEnd = -1;
    let bestScore = 0;
    
    // Search window: don't go too far ahead
    const maxSearchAhead = Math.min(words.length - pointer, captionTokens.length * 3 + 10);
    
    for (let searchStart = pointer; searchStart < pointer + maxSearchAhead && searchStart < words.length; searchStart++) {
      let matchedTokens = 0;
      let lastMatchedWordIndex = searchStart - 1;
      let captionTokenIndex = 0;
      
      for (let wordIndex = searchStart; wordIndex < words.length && captionTokenIndex < captionTokens.length; wordIndex++) {
        const transcriptToken = normaliseText(words[wordIndex].w);
        
        // Skip filler words in transcript
        if (['um', 'uh', 'ah', 'er'].includes(transcriptToken)) {
          continue;
        }
        
        const captionToken = captionTokens[captionTokenIndex];
        
        if (wordsMatch(captionToken, transcriptToken)) {
          matchedTokens++;
          lastMatchedWordIndex = wordIndex;
          captionTokenIndex++;
        } else {
          // Allow small gaps (max 2 words)
          const lookAhead = Math.min(wordIndex + 2, words.length);
          let found = false;
          for (let skip = wordIndex + 1; skip <= lookAhead; skip++) {
            if (skip < words.length && wordsMatch(captionToken, words[skip].w)) {
              matchedTokens++;
              lastMatchedWordIndex = skip;
              captionTokenIndex++;
              found = true;
              break;
            }
          }
          if (!found) {
            // Move to next caption token
            captionTokenIndex++;
          }
        }
      }
      
      const score = matchedTokens / captionTokens.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatchStart = searchStart;
        bestMatchEnd = lastMatchedWordIndex;
      }
      
      // Early exit if we found a good match
      if (score >= 0.9) break;
    }
    
    // Accept if score >= 0.75 (tuneable threshold)
    if (bestScore >= 0.75 && bestMatchStart >= 0 && bestMatchEnd >= bestMatchStart) {
      timings.push({
        startMs: words[bestMatchStart].startMs,
        endMs: words[bestMatchEnd].endMs,
        timingSource: 'whisper' as CaptionTimingSource,
        timingVersion: 1,
        matchScore: bestScore,
        alignmentMethod: 'word',
      });
      pointer = bestMatchEnd + 1;
      alignedCount++;
    } else {
      // Fallback to heuristic for this caption
      const heuristicDuration = audioDurationMs / captions.length;
      const startMs = i * heuristicDuration;
      const endMs = (i + 1) * heuristicDuration;
      
      timings.push({
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        timingSource: 'heuristic' as CaptionTimingSource,
        timingVersion: 1,
        matchScore: bestScore,
      });
      
      // Advance pointer slightly to avoid infinite loops
      pointer = Math.min(pointer + 1, words.length);
    }
  }
  
  // Determine overall status
  const alignmentRatio = alignedCount / captions.length;
  let status: CaptionAlignmentStatus;
  
  if (alignedCount === 0) {
    status = 'failed';
  } else if (alignmentRatio < 0.6) {
    status = 'partial';
  } else {
    status = 'complete';
  }
  
  return {
    timings,
    transcript,
    status,
    alignedCount,
    totalCount: captions.length,
  };
}

// Main alignment function - call after TTS generation
export async function alignCardCaptions(
  captions: string[],
  narrationAudioUrl: string,
  audioDurationMs: number
): Promise<AlignmentResult | null> {
  if (!isAlignmentEnabled()) {
    return null;
  }
  
  if (!captions.length || !narrationAudioUrl) {
    return null;
  }
  
  try {
    // Step 1: Transcribe audio with Whisper
    const transcript = await transcribeAudio(narrationAudioUrl);
    
    if (!transcript || !transcript.words.length) {
      console.error('[whisperAlignment] No transcript words returned');
      return null;
    }
    
    // Step 2: Align captions to transcript
    const result = alignCaptionsToTranscript(captions, transcript, audioDurationMs);
    
    console.log(`[whisperAlignment] Aligned ${result.alignedCount}/${result.totalCount} captions, status: ${result.status}`);
    
    return result;
  } catch (error) {
    console.error('[whisperAlignment] Alignment failed:', error);
    return null;
  }
}
