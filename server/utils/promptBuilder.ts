import { Universe, Card, Character, DesignGuide, UniverseReferenceAsset } from "@shared/schema";

interface PromptContext {
  universe: Universe;
  card?: Card;
  character?: Character;
  referenceAssets?: UniverseReferenceAsset[];
}

interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
  styleKeywords: string[];
  referenceImageUrls: string[];
}

export function buildVisualPrompt(context: PromptContext): BuiltPrompt {
  const { universe, card, character, referenceAssets = [] } = context;
  const designGuide = universe.designGuide as DesignGuide | null;
  
  const promptParts: string[] = [];
  const styleKeywords: string[] = [];
  const negativePromptParts: string[] = [];
  const referenceImageUrls: string[] = [];
  
  // 1. Universe-level base prompt and style
  if (designGuide?.basePrompt) {
    promptParts.push(designGuide.basePrompt);
  }
  
  if (designGuide?.artStyle) {
    promptParts.push(`Style: ${designGuide.artStyle}`);
    styleKeywords.push(designGuide.artStyle);
  }
  
  if (designGuide?.colorPalette) {
    promptParts.push(`Color palette: ${designGuide.colorPalette}`);
  }
  
  if (designGuide?.moodTone) {
    promptParts.push(`Mood: ${designGuide.moodTone}`);
  }
  
  if (designGuide?.cameraStyle) {
    promptParts.push(`Camera: ${designGuide.cameraStyle}`);
  }
  
  if (designGuide?.lightingNotes) {
    promptParts.push(`Lighting: ${designGuide.lightingNotes}`);
  }
  
  if (designGuide?.styleKeywords?.length) {
    styleKeywords.push(...designGuide.styleKeywords);
  }
  
  if (designGuide?.requiredElements?.length) {
    promptParts.push(`Must include: ${designGuide.requiredElements.join(", ")}`);
  }
  
  // 2. Card-specific scene description
  if (card) {
    const cardImageGen = card.imageGeneration as { prompt?: string; shotType?: string; lighting?: string } | null;
    
    if (cardImageGen?.prompt) {
      promptParts.push(cardImageGen.prompt);
    } else if (card.sceneText) {
      promptParts.push(card.sceneText);
    }
    
    if (cardImageGen?.shotType) {
      promptParts.push(`Shot type: ${cardImageGen.shotType}`);
    }
    
    if (cardImageGen?.lighting) {
      promptParts.push(`Lighting: ${cardImageGen.lighting}`);
    }
  }
  
  // 3. Character visual profile (if a specific character is featured)
  if (character?.visualProfile) {
    const vp = character.visualProfile;
    const charDescription: string[] = [];
    
    if (vp.continuityDescription) {
      charDescription.push(vp.continuityDescription);
    }
    if (vp.ageRange) charDescription.push(`age ${vp.ageRange}`);
    if (vp.build) charDescription.push(vp.build);
    if (vp.hair) charDescription.push(vp.hair);
    if (vp.wardrobe) charDescription.push(`wearing ${vp.wardrobe}`);
    if (vp.accessories) charDescription.push(`with ${vp.accessories}`);
    
    if (charDescription.length > 0) {
      promptParts.push(`Character ${character.name}: ${charDescription.join(", ")}`);
    }
    
    // Character "do not change" elements become negative prompt additions
    if (vp.doNotChange?.length) {
      negativePromptParts.push(`Do not alter: ${vp.doNotChange.join(", ")}`);
    }
  }
  
  // 4. Reference assets - collect image URLs for style reference
  const styleAssets = referenceAssets.filter(a => a.assetType === 'style' && a.isActive);
  const characterAssets = character 
    ? referenceAssets.filter(a => a.characterId === character.id && a.isActive)
    : [];
  
  for (const asset of [...styleAssets, ...characterAssets].slice(0, 3)) {
    if (asset.imagePath && !asset.imagePath.startsWith('data:')) {
      referenceImageUrls.push(asset.imagePath);
    }
    if (asset.promptNotes) {
      promptParts.push(asset.promptNotes);
    }
  }
  
  // 5. Build negative prompt
  if (designGuide?.negativePrompt) {
    negativePromptParts.unshift(designGuide.negativePrompt);
  }
  
  if (designGuide?.avoidList?.length) {
    negativePromptParts.push(designGuide.avoidList.join(", "));
  }
  
  // 6. Add style keywords to the prompt
  if (styleKeywords.length > 0) {
    promptParts.push(styleKeywords.join(", "));
  }
  
  // Build final prompt
  const prompt = promptParts.filter(Boolean).join(". ").replace(/\.\./g, ".").trim();
  const negativePrompt = negativePromptParts.filter(Boolean).join(", ").trim();
  
  return {
    prompt: prompt || "A cinematic scene",
    negativePrompt: negativePrompt || "blurry, low quality, distorted, ugly",
    styleKeywords,
    referenceImageUrls,
  };
}

export function getQualitySettings(designGuide: DesignGuide | null | undefined): {
  quality: string;
  steps: number;
  guidanceScale: number;
} {
  const qualityLevel = designGuide?.qualityLevel || "standard";
  
  switch (qualityLevel) {
    case "draft":
      return { quality: "draft", steps: 20, guidanceScale: 5 };
    case "high":
      return { quality: "high", steps: 40, guidanceScale: 8 };
    case "ultra":
      return { quality: "ultra", steps: 50, guidanceScale: 9 };
    case "standard":
    default:
      return { quality: "standard", steps: 30, guidanceScale: 7 };
  }
}

export function buildMinimumDesignPrompt(userPrompt: string, designGuide: DesignGuide | null | undefined): string {
  if (!designGuide) {
    return ensureMinimumPromptQuality(userPrompt);
  }
  
  const parts: string[] = [];
  
  // Always include base style elements if available
  if (designGuide.basePrompt) {
    parts.push(designGuide.basePrompt);
  }
  
  // Add the user's specific prompt
  parts.push(userPrompt);
  
  // Append style keywords
  if (designGuide.styleKeywords?.length) {
    parts.push(designGuide.styleKeywords.join(", "));
  }
  
  // Add quality enhancers based on quality level
  const qualityEnhancers = getQualityEnhancers(designGuide.qualityLevel || "standard");
  parts.push(qualityEnhancers);
  
  return parts.filter(Boolean).join(". ").trim();
}

function ensureMinimumPromptQuality(prompt: string): string {
  const minQualityTerms = [
    "high quality",
    "detailed",
    "professional",
    "8k resolution"
  ];
  
  // Check if prompt already has quality terms
  const hasQuality = minQualityTerms.some(term => 
    prompt.toLowerCase().includes(term.toLowerCase())
  );
  
  if (hasQuality) {
    return prompt;
  }
  
  // Add minimum quality terms
  return `${prompt}, high quality, detailed, professional lighting`;
}

function getQualityEnhancers(qualityLevel: string): string {
  switch (qualityLevel) {
    case "draft":
      return "quick render, stylized";
    case "high":
      return "highly detailed, sharp focus, professional photography, 8k resolution";
    case "ultra":
      return "masterpiece quality, hyperrealistic, ultra detailed, ray tracing, 16k resolution, studio lighting";
    case "standard":
    default:
      return "high quality, detailed, good lighting";
  }
}
