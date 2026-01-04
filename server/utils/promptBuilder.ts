import { 
  Universe, 
  Card, 
  Character, 
  DesignGuide, 
  UniverseReferenceAsset,
  ProjectBible, 
  CharacterBibleEntry, 
  WorldBible, 
  StyleBible,
  IcePreviewCard 
} from "@shared/schema";

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
    negativePrompt: negativePrompt || "blurry, low quality, distorted, ugly, text, words, letters, titles, captions, typography",
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

// ============ PROJECT BIBLE PROMPT COMPOSITION ============

interface BiblePromptContext {
  bible: ProjectBible;
  card: IcePreviewCard;
  charactersInScene?: string[];
}

interface ComposedBiblePrompt {
  fullPrompt: string;
  negativePrompt: string;
  characterDescriptions: string[];
  worldContext: string;
  styleDirectives: string[];
  lockedConstraints: string[];
  bibleVersionId: string;
}

export function composePromptWithBible(context: BiblePromptContext): ComposedBiblePrompt {
  const { bible, card, charactersInScene = [] } = context;
  
  const promptParts: string[] = [];
  const characterDescriptions: string[] = [];
  const styleDirectives: string[] = [];
  const lockedConstraints: string[] = [];
  const negativePromptParts: string[] = [];
  
  // 1. Style Bible - global visual rules
  if (bible.style) {
    if (bible.style.realismLevel) {
      styleDirectives.push(bible.style.realismLevel);
      promptParts.push(`Visual style: ${bible.style.realismLevel}`);
    }
    if (bible.style.colorGrading) {
      styleDirectives.push(bible.style.colorGrading);
      promptParts.push(`Color grading: ${bible.style.colorGrading}`);
    }
    if (bible.style.cameraMovement) {
      styleDirectives.push(bible.style.cameraMovement);
    }
    if (bible.style.aspectRatio) {
      promptParts.push(`${bible.style.aspectRatio} vertical format`);
    }
    
    // Always enforce no on-screen text
    negativePromptParts.push(
      "text", "words", "letters", "writing", "caption", "title", 
      "watermark", "signature", "logo", "subtitle", "typography"
    );
    
    if (bible.style.additionalNegativePrompts?.length) {
      negativePromptParts.push(...bible.style.additionalNegativePrompts);
    }
  }
  
  // 2. World Bible - setting and visual language
  let worldContext = "";
  if (bible.world) {
    const worldParts: string[] = [];
    
    if (bible.world.setting?.place) {
      worldParts.push(`Set in ${bible.world.setting.place}`);
    }
    if (bible.world.setting?.era) {
      worldParts.push(`${bible.world.setting.era} era`);
    }
    if (bible.world.setting?.culture) {
      worldParts.push(`${bible.world.setting.culture} culture`);
    }
    
    if (bible.world.visualLanguage?.cinematicStyle) {
      styleDirectives.push(bible.world.visualLanguage.cinematicStyle);
      promptParts.push(`Cinematic style: ${bible.world.visualLanguage.cinematicStyle}`);
    }
    if (bible.world.visualLanguage?.lighting) {
      promptParts.push(`Lighting: ${bible.world.visualLanguage.lighting}`);
    }
    if (bible.world.visualLanguage?.lensVibe) {
      promptParts.push(`Shot on ${bible.world.visualLanguage.lensVibe}`);
    }
    
    if (bible.world.toneRules?.mood) {
      promptParts.push(`Mood: ${bible.world.toneRules.mood}`);
    }
    if (bible.world.toneRules?.genre) {
      styleDirectives.push(bible.world.toneRules.genre);
    }
    
    // Locked world traits become constraints
    if (bible.world.lockedWorldTraits?.length) {
      lockedConstraints.push(...bible.world.lockedWorldTraits.map(t => `WORLD: ${t}`));
    }
    
    worldContext = worldParts.join(", ");
    if (worldContext) {
      promptParts.push(worldContext);
    }
  }
  
  // 3. Character Bible - detailed descriptions for characters in scene
  const matchedCharacters = findCharactersInScene(bible.characters, charactersInScene, card);
  
  for (const char of matchedCharacters) {
    const charDesc = buildCharacterDescription(char);
    if (charDesc) {
      characterDescriptions.push(`${char.name}: ${charDesc}`);
      promptParts.push(charDesc);
    }
    
    // Character locked traits
    if (char.lockedTraits?.length) {
      lockedConstraints.push(...char.lockedTraits.map(t => `${char.name}: ${t}`));
    }
  }
  
  // 4. Card-specific content
  if (card.content) {
    promptParts.push(card.content);
  }
  
  // 5. Build final prompt
  const fullPrompt = promptParts.filter(Boolean).join(". ").replace(/\.\./g, ".").trim();
  const negativePrompt = Array.from(new Set(negativePromptParts)).join(", ");
  
  return {
    fullPrompt: fullPrompt || "A cinematic scene, high quality, professional",
    negativePrompt: negativePrompt || "text, words, letters, blurry, low quality",
    characterDescriptions,
    worldContext,
    styleDirectives,
    lockedConstraints,
    bibleVersionId: bible.versionId,
  };
}

function findCharactersInScene(
  bibleCharacters: CharacterBibleEntry[],
  explicitNames: string[],
  card: IcePreviewCard
): CharacterBibleEntry[] {
  const cardContent = `${card.title || ''} ${card.content || ''}`.toLowerCase();
  const explicitNamesLower = explicitNames.map(n => n.toLowerCase());
  
  return bibleCharacters.filter(char => {
    const nameLower = char.name.toLowerCase();
    
    // Explicit match from charactersPresent
    if (explicitNamesLower.includes(nameLower)) {
      return true;
    }
    
    // Implicit match from card content
    if (cardContent.includes(nameLower)) {
      return true;
    }
    
    return false;
  });
}

function buildCharacterDescription(char: CharacterBibleEntry): string {
  const parts: string[] = [];
  
  if (char.physicalTraits) {
    const pt = char.physicalTraits;
    if (pt.ageRange) parts.push(pt.ageRange);
    if (pt.build) parts.push(pt.build);
    if (pt.skinTone) parts.push(`${pt.skinTone} skin`);
    if (pt.hairColor && pt.hairStyle) {
      parts.push(`${pt.hairColor} ${pt.hairStyle} hair`);
    } else if (pt.hairColor || pt.hairStyle) {
      parts.push(`${pt.hairColor || ''} ${pt.hairStyle || ''} hair`.trim());
    }
    if (pt.facialFeatures) parts.push(pt.facialFeatures);
    if (pt.distinguishingMarks) parts.push(pt.distinguishingMarks);
  }
  
  if (char.wardrobeRules) {
    const wr = char.wardrobeRules;
    if (wr.style) parts.push(`${wr.style} clothing style`);
    if (wr.signatureItems?.length) {
      parts.push(`wearing ${wr.signatureItems.slice(0, 3).join(", ")}`);
    }
    if (wr.colorPalette?.length) {
      parts.push(`in ${wr.colorPalette.slice(0, 3).join("/")} colors`);
    }
  }
  
  return parts.join(", ");
}

// Check for continuity issues before generation
interface ContinuityCheck {
  isValid: boolean;
  warnings: ContinuityWarning[];
  unknownCharacters: string[];
  suggestions: string[];
}

interface ContinuityWarning {
  type: 'unknown_character' | 'missing_bible' | 'stale_version' | 'locked_trait_conflict';
  message: string;
  severity: 'error' | 'warning' | 'info';
  characterId?: string;
  suggestedFix?: string;
}

export function checkContinuity(
  bible: ProjectBible | null | undefined,
  card: IcePreviewCard,
  existingAssetBibleVersion?: string
): ContinuityCheck {
  const warnings: ContinuityWarning[] = [];
  const unknownCharacters: string[] = [];
  const suggestions: string[] = [];
  
  // No bible = suggest generating one
  if (!bible) {
    return {
      isValid: true,
      warnings: [{
        type: 'missing_bible',
        message: 'No Project Bible found. Generate one for better visual consistency.',
        severity: 'info',
        suggestedFix: 'Click "Generate Bible" to create character and world rules.',
      }],
      unknownCharacters: [],
      suggestions: ['Generate a Project Bible to ensure consistent characters and settings'],
    };
  }
  
  // Check for stale bible version
  if (existingAssetBibleVersion && existingAssetBibleVersion !== bible.versionId) {
    warnings.push({
      type: 'stale_version',
      message: 'This card has media generated with an older Bible version.',
      severity: 'warning',
      suggestedFix: 'Regenerate media to apply the latest Bible rules.',
    });
  }
  
  // Find characters mentioned in card but not in bible
  const cardContent = `${card.title || ''} ${card.content || ''}`.toLowerCase();
  const bibleCharacterNames = bible.characters.map(c => c.name.toLowerCase());
  
  // Extract potential character names (capitalized words that might be names)
  const potentialNames = extractPotentialNames(card.title || '', card.content || '');
  
  for (const name of potentialNames) {
    const nameLower = name.toLowerCase();
    if (!bibleCharacterNames.includes(nameLower)) {
      unknownCharacters.push(name);
      warnings.push({
        type: 'unknown_character',
        message: `"${name}" appears in the card but is not in the Bible.`,
        severity: 'warning',
        suggestedFix: `Add "${name}" to the Character Bible for consistent appearance.`,
      });
    }
  }
  
  if (unknownCharacters.length > 0) {
    suggestions.push(`Add these characters to the Bible: ${unknownCharacters.join(', ')}`);
  }
  
  return {
    isValid: warnings.filter(w => w.severity === 'error').length === 0,
    warnings,
    unknownCharacters,
    suggestions,
  };
}

function extractPotentialNames(title: string, content: string): string[] {
  const text = `${title} ${content}`;
  
  // Match capitalized words that look like names
  // Exclude common words that are often capitalized
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'he', 'she', 'it', 'they', 'we', 'you', 'i',
    'his', 'her', 'its', 'their', 'our', 'your', 'my',
    'this', 'that', 'these', 'those',
    'who', 'what', 'where', 'when', 'why', 'how',
    'chapter', 'scene', 'act', 'part', 'episode', 'card',
    'day', 'night', 'morning', 'evening', 'noon', 'midnight',
  ]);
  
  const namePattern = /\b([A-Z][a-z]{2,})\b/g;
  const matches = text.match(namePattern) || [];
  
  const names = matches.filter(word => 
    !commonWords.has(word.toLowerCase()) &&
    word.length >= 3 &&
    word.length <= 20
  );
  
  // Return unique names
  return Array.from(new Set(names));
}
