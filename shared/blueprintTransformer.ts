import { IceBlueprint, templateFamilies, TemplateFamilyId } from "./templateFamilies";

export interface IceCardDraft {
  id: string;
  title: string;
  content: string;
  order: number;
  sceneId?: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  videoGenerationStatus?: string;
  mediaAssets?: any[];
  selectedMediaAssetId?: string;
}

export interface IceDraftFromBlueprint {
  title: string;
  sourceType: "wizard";
  sourceValue: string;
  cards: IceCardDraft[];
  blueprintMetadata: {
    templateFamily: TemplateFamilyId;
    structureId: string;
    length: string;
    style: IceBlueprint["style"];
  };
}

const titlePackVibeToPackId: Record<string, string> = {
  modern: "modern-clean",
  bold: "bold-impact",
  minimal: "minimal-elegant",
  retro: "retro-vintage",
};

const visualStyleToMood: Record<string, string> = {
  clean: "professional, minimalist, white space",
  cinematic: "dramatic lighting, film grain, widescreen",
  playful: "bright colors, fun, energetic",
  corporate: "business formal, trustworthy, polished",
};

function generateCardContent(card: IceBlueprint["cards"][0], style: IceBlueprint["style"]): string {
  const moodHint = visualStyleToMood[style.visualStyle] || "";
  
  switch (card.type) {
    case "intro":
      return `Welcome to this experience.\n\nObjective: ${card.objective}\n\n[Add your opening content here to set the scene and capture attention.]`;
    case "cta":
      return `Ready to take the next step?\n\nObjective: ${card.objective}\n\n[Add your call-to-action details here.]`;
    case "quiz":
      return `Question: [Your question here]\n\nObjective: ${card.objective}\n\n[Add your quiz or feedback collection content.]`;
    default:
      return `${card.title}\n\nObjective: ${card.objective}\n\n[Add your scene content here. Consider the ${moodHint} visual style.]`;
  }
}

function generateImagePrompt(card: IceBlueprint["cards"][0], style: IceBlueprint["style"], family: TemplateFamilyId): string {
  const moodHint = visualStyleToMood[style.visualStyle] || "professional";
  const familyLabel = templateFamilies[family]?.label || family;
  
  switch (card.type) {
    case "intro":
      return `${moodHint}, opening shot for ${familyLabel}, welcoming, ${card.title.toLowerCase()}`;
    case "cta":
      return `${moodHint}, call to action visual, compelling, ${card.title.toLowerCase()}`;
    case "quiz":
      return `${moodHint}, interactive, question visual, engaging`;
    default:
      return `${moodHint}, ${card.objective.toLowerCase()}, ${familyLabel} theme`;
  }
}

export function transformBlueprintToIceDraft(blueprint: IceBlueprint): IceDraftFromBlueprint {
  const family = templateFamilies[blueprint.templateFamily];
  const structure = family?.structures.find(s => s.id === blueprint.structureId);
  
  const title = structure 
    ? `${family.label}: ${structure.label}`
    : `New ${family?.label || blueprint.templateFamily} ICE`;
  
  const cards: IceCardDraft[] = blueprint.cards.map((card, index) => ({
    id: card.id,
    title: card.title,
    content: generateCardContent(card, blueprint.style),
    order: index,
    sceneId: `scene_${index}`,
  }));
  
  return {
    title,
    sourceType: "wizard",
    sourceValue: JSON.stringify({
      templateFamily: blueprint.templateFamily,
      structureId: blueprint.structureId,
      length: blueprint.length,
      createdAt: new Date().toISOString(),
    }),
    cards,
    blueprintMetadata: {
      templateFamily: blueprint.templateFamily,
      structureId: blueprint.structureId,
      length: blueprint.length,
      style: blueprint.style,
    },
  };
}

export function generateImagePromptsForBlueprint(blueprint: IceBlueprint): string[] {
  return blueprint.cards.map(card => 
    generateImagePrompt(card, blueprint.style, blueprint.templateFamily)
  );
}

export function mapInjectedContentToBlueprint(
  blueprint: IceBlueprint,
  injectedSections: { title: string; content: string; type?: string }[]
): IceDraftFromBlueprint {
  const baseDraft = transformBlueprintToIceDraft(blueprint);
  
  const sectionsByType: Record<string, typeof injectedSections> = {};
  for (const section of injectedSections) {
    const type = section.type || "scene";
    if (!sectionsByType[type]) sectionsByType[type] = [];
    sectionsByType[type].push(section);
  }
  
  let usedSections = 0;
  const mappedCards = baseDraft.cards.map((card, index) => {
    const blueprintCard = blueprint.cards[index];
    if (!blueprintCard) return card;
    
    const matchingType = sectionsByType[blueprintCard.type];
    if (matchingType && matchingType.length > 0) {
      const section = matchingType.shift()!;
      usedSections++;
      return {
        ...card,
        title: section.title || card.title,
        content: section.content,
      };
    }
    
    const anySection = sectionsByType["scene"]?.shift();
    if (anySection) {
      usedSections++;
      return {
        ...card,
        title: anySection.title || card.title,
        content: anySection.content,
      };
    }
    
    return card;
  });
  
  const overflow: IceCardDraft[] = [];
  for (const type in sectionsByType) {
    for (const section of sectionsByType[type]) {
      overflow.push({
        id: `overflow_${overflow.length}`,
        title: section.title || `Additional Content ${overflow.length + 1}`,
        content: section.content,
        order: mappedCards.length + overflow.length,
        sceneId: `overflow_${overflow.length}`,
      });
    }
  }
  
  return {
    ...baseDraft,
    cards: [...mappedCards, ...overflow],
  };
}
