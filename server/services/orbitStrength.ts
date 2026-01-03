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

const SCORE_MAP: Record<string, number> = {
  about: 15,
  services: 25,
  faq: 15,
  contact: 10,
  homepage: 10,
  linkedin: 5,
  instagram: 5,
  facebook: 5,
  twitter: 5,
  tiktok: 5,
  youtube: 5,
};

const SOCIAL_LABELS = ['linkedin', 'instagram', 'facebook', 'twitter', 'tiktok', 'youtube'];
const SOCIAL_CAP = 20;

export function calculateStrengthScore(sources: SourceInput[]): StrengthResult {
  const breakdown: Record<string, number> = {};
  let totalScore = 0;
  let socialScore = 0;

  for (const source of sources) {
    if (!source.value || source.value.trim() === '') continue;
    
    const label = source.label;
    const points = SCORE_MAP[label] || 0;
    
    if (SOCIAL_LABELS.includes(label)) {
      const newSocialScore = Math.min(socialScore + points, SOCIAL_CAP);
      const actualPoints = newSocialScore - socialScore;
      socialScore = newSocialScore;
      
      if (actualPoints > 0) {
        breakdown[label] = actualPoints;
        totalScore += actualPoints;
      }
    } else {
      if (!breakdown[label]) {
        breakdown[label] = points;
        totalScore += points;
      }
    }
  }

  return {
    strengthScore: Math.min(totalScore, 100),
    breakdown,
  };
}
