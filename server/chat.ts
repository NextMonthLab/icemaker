import { Universe, Character, Card, ChatPolicy, ChatProfile, CardChatOverride, CharacterSecret } from "@shared/schema";

interface ChatContext {
  universe: Universe;
  character: Character;
  currentCard?: Card;
  userDayIndex: number;
}

export function buildChatSystemPrompt(ctx: ChatContext): string {
  const { universe, character, currentCard, userDayIndex } = ctx;
  
  const policy = universe.chatPolicy as ChatPolicy | null;
  const profile = character.chatProfile as ChatProfile | null;
  const overrides = currentCard?.chatOverrides as Record<string, CardChatOverride> | null;
  const charOverride = overrides?.[character.characterSlug];

  const sections: string[] = [];
  
  if (profile?.system_prompt) {
    sections.push(profile.system_prompt);
  } else {
    sections.push(`You are ${character.name}, a character in the story "${universe.name}".`);
    if (character.role) {
      sections.push(`Your role: ${character.role}`);
    }
    if (character.description) {
      sections.push(`About you: ${character.description}`);
    }
  }
  
  if (profile?.voice) {
    sections.push(`\nVOICE: ${profile.voice}`);
  }
  if (profile?.speech_style) {
    sections.push(`SPEECH STYLE: ${profile.speech_style}`);
  }
  
  if (charOverride?.emotional_state) {
    sections.push(`CURRENT EMOTIONAL STATE: ${charOverride.emotional_state}`);
  }
  
  if (charOverride?.scene_context) {
    sections.push(`SCENE CONTEXT: ${charOverride.scene_context}`);
  }
  
  const allObjectives = [
    ...(profile?.goals || []),
    ...(charOverride?.objectives || [])
  ];
  if (allObjectives.length > 0) {
    sections.push(`\nYOUR OBJECTIVES IN THIS CONVERSATION:\n${allObjectives.map(g => `- ${g}`).join('\n')}`);
  }
  
  const knowsUpTo = charOverride?.knows_up_to_day_index ?? 
    (profile?.knowledge_cutoff?.mode === "dynamic" ? userDayIndex : profile?.knowledge_cutoff?.max_day_index) ?? 
    userDayIndex;
  
  // Always enforce knowledge cutoff to prevent spoilers
  sections.push(`\nKNOWLEDGE LIMIT: You only know events up to day ${knowsUpTo} of the story. Do not reveal or discuss any plot points beyond this day.`);
  
  if (policy?.spoiler_policy?.mode === "hard") {
    const spoilerRule = policy.spoiler_policy.rule || 
      `STRICT SPOILER PROTECTION: Never reveal ANY events, outcomes, or character fates beyond day ${knowsUpTo}. This is absolute.`;
    sections.push(`${spoilerRule}`);
    sections.push(`If asked about future events, respond naturally as the character would - you genuinely don't know what happens next. Deflect with curiosity or in-character uncertainty.`);
  } else {
    sections.push(`If asked about future events, respond naturally as the character would - you don't know what happens next.`);
  }
  
  if (charOverride?.spoiler_traps && charOverride.spoiler_traps.length > 0) {
    sections.push(`\nSPOILER TRAP HANDLING:`);
    for (const trap of charOverride.spoiler_traps) {
      sections.push(`- If user asks about "${trap.trigger}", respond with: "${trap.deflect_with}"`);
    }
  }
  
  const secrets = profile?.secrets as CharacterSecret[] | undefined;
  if (secrets && secrets.length > 0) {
    sections.push(`\nYOUR SECRETS (never reveal directly):`);
    for (const secret of secrets) {
      if (secret.never_reveal) {
        sections.push(`- Secret: ${secret.id}`);
        if (secret.deflect_with) {
          sections.push(`  If probed, deflect with: "${secret.deflect_with}"`);
        }
      }
    }
  } else if (character.secretsJson && Array.isArray(character.secretsJson) && character.secretsJson.length > 0) {
    sections.push(`\nYOUR SECRETS (never reveal directly, but they influence your behavior):\n${character.secretsJson.map((s: string) => `- ${s}`).join('\n')}`);
  }
  
  const tabooTopics = [
    ...(profile?.forbidden_topics || []),
    ...(charOverride?.taboo_for_this_scene || [])
  ];
  if (tabooTopics.length > 0) {
    sections.push(`\nTOPICS YOU REFUSE TO DISCUSS:\n${tabooTopics.map(t => `- ${t}`).join('\n')}`);
  }
  
  if (profile?.allowed_topics && profile.allowed_topics.length > 0) {
    sections.push(`\nTOPICS YOU'RE WILLING TO DISCUSS:\n${profile.allowed_topics.map(t => `- ${t}`).join('\n')}`);
  }
  
  if (charOverride?.can_reveal && charOverride.can_reveal.length > 0) {
    sections.push(`\nTHINGS YOU CAN NOW REVEAL (because of recent story events):\n${charOverride.can_reveal.map(r => `- ${r}`).join('\n')}`);
  }
  
  if (profile?.hard_limits && profile.hard_limits.length > 0) {
    sections.push(`\nHARD LIMITS (never break character on these):\n${profile.hard_limits.map(l => `- ${l}`).join('\n')}`);
  }
  
  if (profile?.refusal_style) {
    sections.push(`\nWhen declining to discuss something, ${profile.refusal_style}`);
  } else if (policy?.refusal_style?.in_character_deflection && policy.refusal_style.deflection_templates?.length) {
    sections.push(`\nWhen refusing to answer, use in-character deflections like: ${policy.refusal_style.deflection_templates.slice(0, 3).join(' OR ')}`);
  }
  
  if (policy?.truth_policy) {
    if (policy.truth_policy.allow_lies_in_character) {
      sections.push(`\nTRUTH POLICY: You may lie or misdirect in-character for: ${policy.truth_policy.lies_allowed_for?.join(', ') || 'self-protection, mystery tension'}`);
      if (policy.truth_policy.lies_not_allowed_for?.length) {
        sections.push(`NEVER lie about: ${policy.truth_policy.lies_not_allowed_for.join(', ')}`);
      }
    }
  }
  
  if (policy?.safety_policy?.disallowed?.length) {
    sections.push(`\nSAFETY RULES (these apply absolutely):\n${policy.safety_policy.disallowed.map(d => `- Do not: ${d}`).join('\n')}`);
    if (policy.safety_policy.escalation) {
      sections.push(policy.safety_policy.escalation);
    }
  } else {
    sections.push(`\nSAFETY GUIDELINES:
- Never engage in or encourage harassment, bullying, or personal attacks
- Never provide guidance on self-harm or suicide
- Keep all content appropriate - no explicit sexual content
- Never provide instructions for illegal activities`);
  }
  
  sections.push(`\nIMPORTANT: Stay in character at all times. Respond as ${character.name} would, with their personality and knowledge. Keep responses conversational and engaging, typically 2-4 sentences unless the question requires more detail.`);
  
  return sections.join('\n');
}

export function getChatDisclaimer(policy: ChatPolicy | null): string | null {
  if (!policy?.disclaimer) return null;
  return policy.disclaimer;
}

export function detectSpoilerAttempt(message: string): boolean {
  const spoilerPatterns = [
    /what happens next/i,
    /what will happen/i,
    /tomorrow/i,
    /later in the story/i,
    /how does.*(end|finish)/i,
    /the ending/i,
    /spoil(er)?/i,
    /tell me the future/i,
    /what's going to happen/i,
    /day \d+ events/i,
  ];
  
  return spoilerPatterns.some(pattern => pattern.test(message));
}

export function getInCharacterDeflection(policy: ChatPolicy | null, characterName: string): string {
  const templates = policy?.refusal_style?.deflection_templates;
  if (templates && templates.length > 0) {
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  const defaultDeflections = [
    `I'm afraid I don't know what you mean.`,
    `That's not something I can talk about right now.`,
    `Ask me something else, would you?`,
    `I'd rather not go into that.`,
  ];
  
  return defaultDeflections[Math.floor(Math.random() * defaultDeflections.length)];
}
