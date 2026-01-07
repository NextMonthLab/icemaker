import type { OrbitSourceLabel } from "@shared/schema";

interface SourceInput {
  label: OrbitSourceLabel;
  sourceType: string;
  value: string;
}

interface StrengthResult {
  strengthScore: number;
  breakdown: Record<string, number>;
}

// Points for factual sources that add knowledge to Orbit
const SCORE_MAP: Record<string, number> = {
  about: 15,
  services: 25,
  faq: 15,
  contact: 10,
  homepage: 10,
  document: 10, // Each document with extracted text adds 10 points
};

// Social links don't add to strength - they're for visitor navigation, not knowledge
const SOCIAL_LABELS = ['linkedin', 'instagram', 'facebook', 'twitter', 'tiktok', 'youtube'];
const DOCUMENT_CAP = 30; // Max 30 points from documents (3 docs)

export function calculateStrengthScore(sources: SourceInput[], documentCount: number = 0): StrengthResult {
  const breakdown: Record<string, number> = {};
  let totalScore = 0;

  for (const source of sources) {
    if (!source.value || source.value.trim() === '') continue;
    
    const label = source.label;
    
    // Skip social links - they don't add knowledge, just navigation
    if (SOCIAL_LABELS.includes(label)) {
      continue;
    }
    
    const points = SCORE_MAP[label] || 0;
    if (!breakdown[label] && points > 0) {
      breakdown[label] = points;
      totalScore += points;
    }
  }

  // Add document points (capped at DOCUMENT_CAP)
  if (documentCount > 0) {
    const docPoints = Math.min(documentCount * SCORE_MAP.document, DOCUMENT_CAP);
    breakdown['documents'] = docPoints;
    totalScore += docPoints;
  }

  return {
    strengthScore: Math.min(totalScore, 100),
    breakdown,
  };
}
