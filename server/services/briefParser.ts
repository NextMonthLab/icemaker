import { 
  ProducerBrief, 
  BriefStage, 
  BriefCard, 
  BriefAiCharacter,
  BriefVisualDirection,
  ParsedProducerBrief,
  PRODUCER_BRIEF_MARKERS 
} from "@shared/producerBrief";

export class ProducerBriefParser {
  private rawText: string;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor(text: string) {
    this.rawText = text;
  }

  parse(): ParsedProducerBrief {
    try {
      const title = this.extractTitle();
      const overview = this.extractOverview();
      const visualDirection = this.extractVisualDirection();
      const aiCharacter = this.extractAiCharacter();
      const stages = this.extractStages();
      const totalCardCount = stages.reduce((sum, s) => sum + s.cards.length, 0);

      const brief: ProducerBrief = {
        title,
        format: overview.format,
        targetAudience: overview.targetAudience,
        estimatedDuration: overview.estimatedDuration,
        visualStyle: overview.visualStyle,
        visualDirection,
        aiCharacter,
        stages,
        totalCardCount,
        strictMode: true,
      };

      return {
        brief,
        rawText: this.rawText,
        parseWarnings: this.warnings,
        parseErrors: this.errors,
      };
    } catch (error) {
      this.errors.push(`Fatal parse error: ${error}`);
      return {
        brief: {
          title: "Parse Error",
          stages: [],
          totalCardCount: 0,
          strictMode: true,
        },
        rawText: this.rawText,
        parseWarnings: this.warnings,
        parseErrors: this.errors,
      };
    }
  }

  private extractTitle(): string {
    const titleMatch = this.rawText.match(/Ice\s+Title[:\s]*([^\n]+)/i);
    if (titleMatch) return titleMatch[1].trim();

    const headerMatch = this.rawText.match(/^#+\s*(.+?)(?:\n|$)/m);
    if (headerMatch) return headerMatch[1].trim();

    this.warnings.push("Could not extract title, using default");
    return "Untitled Experience";
  }

  private extractOverview(): { format?: string; targetAudience?: string; estimatedDuration?: string; visualStyle?: string } {
    const result: any = {};

    const formatMatch = this.rawText.match(/Format[:\s]*([^\n]+)/i);
    if (formatMatch) result.format = formatMatch[1].trim();

    const audienceMatch = this.rawText.match(/Target\s+Audience[:\s]*([^\n]+)/i);
    if (audienceMatch) result.targetAudience = audienceMatch[1].trim();

    const durationMatch = this.rawText.match(/(?:Estimated\s+)?Duration[:\s]*([^\n]+)/i);
    if (durationMatch) result.estimatedDuration = durationMatch[1].trim();

    const styleMatch = this.rawText.match(/Visual\s+Style[:\s]*([^\n]+)/i);
    if (styleMatch) result.visualStyle = styleMatch[1].trim();

    return result;
  }

  private extractVisualDirection(): BriefVisualDirection | undefined {
    const section = this.extractSection("Visual Direction");
    if (!section) return undefined;

    const result: BriefVisualDirection = {};

    const aestheticMatch = section.match(/(?:Overall\s+)?Aesthetic[:\s]*([^\n]+(?:\n(?![A-Z#\d])[^\n]+)*)/i);
    if (aestheticMatch) result.overallAesthetic = aestheticMatch[1].trim();

    const cameraMatch = section.match(/Camera\s+Perspective[:\s]*([^\n]+(?:\n(?![A-Z#\d])[^\n]+)*)/i);
    if (cameraMatch) result.cameraPerspective = cameraMatch[1].trim();

    const lightingMatch = section.match(/Lighting[^:]*[:\s]*([^\n]+(?:\n(?![A-Z#\d])[^\n]+)*)/i);
    if (lightingMatch) result.lightingAndColour = lightingMatch[1].trim();

    const basePromptMatch = section.match(/Base\s+Style\s+Prompt[^:]*[:\s]*([^\n]+(?:\n(?![A-Z#\d])[^\n]+)*)/i);
    if (basePromptMatch) result.baseStylePrompt = basePromptMatch[1].trim();

    return result;
  }

  private extractAiCharacter(): BriefAiCharacter | undefined {
    const section = this.extractSection("AI Character");
    if (!section) return undefined;

    const nameMatch = section.match(/(?:Chef|Character)\s+(?:\[?([^\]\n]+)\]?|(\w+))/i);
    const name = nameMatch ? (nameMatch[1] || nameMatch[2] || "Chef").replace(/[\[\]]/g, '') : "Chef";

    const personalityMatch = section.match(/Personality[:\s]*([^\n]+)/i);
    const personality = personalityMatch ? personalityMatch[1].trim() : "Warm, encouraging, helpful";

    const expertiseMatch = section.match(/Expertise\s*(?:Level)?[:\s]*([^\n]+)/i);
    const expertiseLevel = expertiseMatch ? expertiseMatch[1].trim() : undefined;

    const commStyleMatch = section.match(/Communication\s+Style[:\s]*([^\n]+)/i);
    const communicationStyle = commStyleMatch ? commStyleMatch[1].trim() : undefined;

    const behaviourRules = this.extractBehaviourRules(section);
    const systemPrompt = this.extractSystemPrompt(section);
    const stageContexts = this.extractStageContexts(section);
    const exampleInteractions = this.extractExampleInteractions(section);

    return {
      name,
      personality,
      expertiseLevel,
      communicationStyle,
      behaviourRules,
      systemPrompt,
      stageContexts,
      exampleInteractions,
    };
  }

  private extractBehaviourRules(section: string): string[] {
    const rules: string[] = [];
    const rulesSection = section.match(/Character\s+Behaviour\s+Rules[:\s]*([\s\S]+?)(?=\n\d+\.\d+|\n#+|$)/i);
    
    if (rulesSection) {
      const lines = rulesSection[1].split('\n').filter(l => l.trim());
      for (const line of lines) {
        const cleaned = line.replace(/^[-•*]\s*/, '').trim();
        if (cleaned.length > 10) {
          rules.push(cleaned);
        }
      }
    }

    return rules;
  }

  private extractSystemPrompt(section: string): string {
    const promptMatch = section.match(/System\s+Prompt\s*\(?[Bb]ase\)?[:\s]*([\s\S]+?)(?=\n\d+\.\d+|\n#+|Stage.*Addition|$)/i);
    if (promptMatch) {
      return promptMatch[1].trim();
    }

    const charDescription = section.match(/You\s+are\s+[\s\S]+?(?=\n\d+\.\d+|\n#+|$)/i);
    if (charDescription) {
      return charDescription[0].trim();
    }

    return "You are a helpful assistant guiding the user through this experience.";
  }

  private extractStageContexts(section: string): BriefAiCharacter['stageContexts'] {
    const contexts: BriefAiCharacter['stageContexts'] = [];
    const stagePattern = /Stage\s+(\d+)\s+Addition[:\s]*([^#]+?)(?=Stage\s+\d+\s+Addition|\n\d+\.\d+|\n#+|Example|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = stagePattern.exec(section)) !== null) {
      const stageNumber = parseInt(match[1]);
      const content = match[2].trim();
      
      const commonQuestionsMatch = content.match(/Common\s+questions?[:\s]*([^.]+\.(?:[^.]+\.)*)/i);
      const commonQuestions: string[] = [];
      
      if (commonQuestionsMatch) {
        const questions = commonQuestionsMatch[1].split(/\?/).filter((q: string) => q.trim());
        for (const q of questions) {
          const cleaned = q.trim();
          if (cleaned.length > 5) {
            commonQuestions.push(cleaned + '?');
          }
        }
      }

      contexts.push({
        stageNumber,
        stageName: `Stage ${stageNumber}`,
        contextAddition: content.split(/Common\s+questions/i)[0].trim(),
        commonQuestions,
      });
    }

    return contexts;
  }

  private extractExampleInteractions(section: string): BriefAiCharacter['exampleInteractions'] {
    const interactions: BriefAiCharacter['exampleInteractions'] = [];
    const exampleSection = section.match(/Example\s+Interactions[:\s]*([^#]+?)(?=\n\d+\.\d*[^.]|\n#+|$)/i);
    
    if (exampleSection) {
      const userPattern = /User[:\s]*([^\n]+)\n+(?:Chef|Character|Assistant)[:\s]*([^\n]+(?:\n(?!User)[^\n]+)*)/gi;
      let match: RegExpExecArray | null;
      
      while ((match = userPattern.exec(exampleSection[1])) !== null) {
        interactions.push({
          userMessage: match[1].trim(),
          characterResponse: match[2].trim(),
        });
      }
    }

    return interactions;
  }

  private extractStages(): BriefStage[] {
    const stages: BriefStage[] = [];
    const stagePattern = /Stage\s+(\d+)[:\s]*([^\n]+)/gi;
    const stagePositions: Array<{ num: number; name: string; start: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = stagePattern.exec(this.rawText)) !== null) {
      stagePositions.push({
        num: parseInt(match[1]),
        name: match[2].trim(),
        start: match.index,
      });
    }

    // If we found explicit Stage headers, use them
    if (stagePositions.length > 0) {
      for (let i = 0; i < stagePositions.length; i++) {
        const current = stagePositions[i];
        const next = stagePositions[i + 1];
        const endPos = next ? next.start : this.rawText.length;
        const stageContent = this.rawText.slice(current.start, endPos);

        const cards = this.extractCardsFromStage(stageContent, current.num, current.name);
        const hasCheckpoint = PRODUCER_BRIEF_MARKERS.aiCheckpoint.test(stageContent);
        
        const checkpointMatch = stageContent.match(/AI\s+(?:Chef\s+)?Checkpoint[:\s]*([^\n]+(?:\n(?![A-Z#\d])[^\n]+)*)/i);
        const checkpointDescription = checkpointMatch ? checkpointMatch[1].trim() : undefined;

        const purposeMatch = stageContent.match(/Purpose[:\s]*([^\n]+)/i);
        const purpose = purposeMatch ? purposeMatch[1].trim() : undefined;

        if (cards.length > 0) {
          stages.push({
            stageNumber: current.num,
            stageName: current.name,
            purpose,
            cards,
            hasAiCheckpoint: hasCheckpoint,
            checkpointDescription,
          });
        }
      }
    } else {
      // Fallback: infer stages from card IDs in tables (e.g., "1.1", "2.3")
      const inferredStages = this.inferStagesFromCardTables();
      stages.push(...inferredStages);
      
      if (inferredStages.length > 0) {
        this.warnings.push("No explicit 'Stage N:' headers found - stages inferred from card numbering");
      }
    }

    if (stages.length === 0) {
      this.errors.push("No stages found in document");
    }

    return stages;
  }

  private inferStagesFromCardTables(): BriefStage[] {
    const stageMap = new Map<number, BriefCard[]>();
    let foundTables = false;
    let skippedRows = 0;
    
    // More flexible table detection - find any markdown table with at least 3 columns
    // Pattern 1: Tables with header row containing Card/ID keywords
    const strictTablePattern = /\|[^\n]*(?:Card|ID)[^\n]*\|[^\n]*(?:Content|Script|Text|Caption)[^\n]*\|[^\n]*(?:Visual|Prompt|Image|Video)[^\n]*\|([\s\S]*?)(?=\n\n[A-Z]|\n#+|AI\s+(?:Chef\s+)?Checkpoint|$)/gi;
    
    // Pattern 2: Any markdown table with 3+ columns (flexible fallback)
    const flexibleTablePattern = /(\|[^\n|]+\|[^\n|]+\|[^\n|]+\|[^\n]*\n)(\|[\s:-]+\|[\s:-]+\|[\s:-]+\|[^\n]*\n)((?:\|[^\n]+\n?)+)/g;
    
    let tableMatch: RegExpExecArray | null;
    
    // Try strict pattern first
    while ((tableMatch = strictTablePattern.exec(this.rawText)) !== null) {
      foundTables = true;
      const tableContent = tableMatch[1];
      this.parseTableRows(tableContent, stageMap, (count) => { skippedRows += count; });
    }
    
    // If no tables found with strict pattern, try flexible pattern
    if (!foundTables) {
      while ((tableMatch = flexibleTablePattern.exec(this.rawText)) !== null) {
        foundTables = true;
        const tableContent = tableMatch[3]; // Just the data rows
        this.parseTableRows(tableContent, stageMap, (count) => { skippedRows += count; });
      }
      
      if (foundTables && stageMap.size === 0) {
        this.warnings.push("Tables found but couldn't detect card IDs. Expected headers: Card | Content | Visual Prompt");
      }
    }
    
    // Add warnings for parsing issues
    if (foundTables && stageMap.size === 0) {
      this.warnings.push("Card tables found but no valid card IDs detected. Use format like '1.1', '2.3' in first column.");
    }
    if (skippedRows > 0) {
      this.warnings.push(`Skipped ${skippedRows} table row(s) with missing or malformed card IDs (expected format: '1.1', '2.3')`);
    }
    
    // Check if there are any pipe characters (potential tables) but we didn't detect any
    if (!foundTables && this.rawText.includes('|')) {
      const pipeLineCount = (this.rawText.match(/\|.*\|/g) || []).length;
      if (pipeLineCount >= 3) {
        this.warnings.push(`Found ${pipeLineCount} lines with pipe characters that may be tables, but couldn't parse them. Use markdown table format with 'Card | Content | Visual Prompt' headers.`);
      }
    }
    
    // Convert map to sorted array of stages
    const stages: BriefStage[] = [];
    const sortedStageNums = Array.from(stageMap.keys()).sort((a, b) => a - b);
    
    // Check once for AI checkpoint (only assign to final stage)
    const hasCheckpoint = PRODUCER_BRIEF_MARKERS.aiCheckpoint.test(this.rawText);
    const checkpointMatch = this.rawText.match(/AI\s+(?:Chef\s+)?Checkpoint[:\s]*([^\n]+(?:\n(?![A-Z#\d|\|])[^\n]+)*)/i);
    const checkpointDescription = checkpointMatch ? checkpointMatch[1].trim() : undefined;
    const finalStageNum = sortedStageNums[sortedStageNums.length - 1];
    
    for (const stageNum of sortedStageNums) {
      const cards = stageMap.get(stageNum)!;
      
      // Sort cards by cardIndex to preserve order
      cards.sort((a, b) => a.cardIndex - b.cardIndex);
      
      const isFinalStage = stageNum === finalStageNum;
      
      stages.push({
        stageNumber: stageNum,
        stageName: `Stage ${stageNum}`,
        cards,
        hasAiCheckpoint: isFinalStage && hasCheckpoint,
        checkpointDescription: isFinalStage ? checkpointDescription : undefined,
      });
    }
    
    return stages;
  }

  private parseTableRows(
    tableContent: string, 
    stageMap: Map<number, BriefCard[]>, 
    onSkipped: (count: number) => void
  ): void {
    const rows = tableContent.split('\n').filter(row => row.includes('|') && !row.match(/^[\s|:-]+$/));
    let skipped = 0;
    
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const cardIdMatch = cells[0].match(/(\d+)\.(\d+)/);
        if (cardIdMatch) {
          const stageNum = parseInt(cardIdMatch[1]);
          const cardIndex = parseInt(cardIdMatch[2]);
          const rawVisual = cells[2] || '';
          
          // Parse IMAGE: vs VIDEO: prefix from visual column
          let visualPrompt: string | undefined;
          let videoPrompt: string | undefined;
          
          if (rawVisual) {
            const trimmedVisual = rawVisual.trim();
            const videoMatch = trimmedVisual.match(/^VIDEO\s*(?:\([^)]*\))?[:\s]+([\s\S]+)/i);
            if (videoMatch) {
              videoPrompt = videoMatch[1].trim();
            } else {
              const imageMatch = trimmedVisual.match(/^IMAGE[:\s]+([\s\S]+)/i);
              if (imageMatch) {
                visualPrompt = imageMatch[1].trim();
              } else {
                visualPrompt = trimmedVisual;
              }
            }
          }
          
          const card: BriefCard = {
            stageNumber: stageNum,
            stageName: `Stage ${stageNum}`,
            cardIndex,
            cardId: cells[0],
            content: cells[1] || '',
            visualPrompt,
            videoPrompt,
            isCheckpoint: false,
          };
          
          if (!stageMap.has(stageNum)) {
            stageMap.set(stageNum, []);
          }
          stageMap.get(stageNum)!.push(card);
        } else {
          skipped++;
        }
      }
    }
    
    if (skipped > 0) {
      onSkipped(skipped);
    }
  }

  private extractCardsFromStage(stageContent: string, stageNum: number, stageName: string): BriefCard[] {
    const cards: BriefCard[] = [];

    const tableMatch = stageContent.match(/\|[^\n]*Card[^\n]*\|[^\n]*Content[^\n]*\|[^\n]*Visual[^\n]*\|([\s\S]*?)(?=\n\n[A-Z]|\n#+|AI\s+(?:Chef\s+)?Checkpoint|$)/i);
    
    if (tableMatch) {
      const tableContent = tableMatch[1];
      const rows = tableContent.split('\n').filter(row => row.includes('|') && !row.match(/^[\s|:-]+$/));

      for (const row of rows) {
        const cells = row.split('|').map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          const cardIdMatch = cells[0].match(/(\d+)\.(\d+)/);
          if (cardIdMatch) {
            const cardIndex = parseInt(cardIdMatch[2]);
            const rawVisual = cells[2] || '';
            
            // Parse IMAGE: vs VIDEO: prefix from visual column
            let visualPrompt: string | undefined;
            let videoPrompt: string | undefined;
            
            if (rawVisual) {
              const trimmedVisual = rawVisual.trim();
              // Check for VIDEO: prefix (with optional duration like "VIDEO (5s):" or "VIDEO (3s loop):")
              // Using [\s\S] instead of . with 's' flag for ES2015 compatibility
              const videoMatch = trimmedVisual.match(/^VIDEO\s*(?:\([^)]*\))?[:\s]+([\s\S]+)/i);
              if (videoMatch) {
                videoPrompt = videoMatch[1].trim();
              } else {
                // Check for IMAGE: prefix
                const imageMatch = trimmedVisual.match(/^IMAGE[:\s]+([\s\S]+)/i);
                if (imageMatch) {
                  visualPrompt = imageMatch[1].trim();
                } else {
                  // No prefix - treat as image prompt by default
                  visualPrompt = trimmedVisual;
                }
              }
            }
            
            cards.push({
              stageNumber: stageNum,
              stageName,
              cardIndex,
              cardId: cells[0],
              content: cells[1] || '',
              visualPrompt,
              videoPrompt,
              isCheckpoint: false,
            });
          }
        }
      }
    }

    return cards;
  }

  private extractSection(sectionName: string): string | null {
    const pattern = new RegExp(`(?:^|\\n)#+?\\s*\\d*\\.?\\s*${sectionName}[\\s\\S]*?(?=\\n#+\\s*\\d|$)`, 'i');
    const match = this.rawText.match(pattern);
    return match ? match[0] : null;
  }
}

export function parseProducerBrief(text: string): ParsedProducerBrief {
  const parser = new ProducerBriefParser(text);
  return parser.parse();
}
