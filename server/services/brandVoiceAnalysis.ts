import OpenAI from "openai";
import type { HeroPost } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface BrandVoiceAnalysis {
  brandVoiceSummary: string;
  voiceTraits: string[];
  audienceNotes: string;
  toneGuidance: {
    dosList: string[];
    dontsList: string[];
    keyPhrases: string[];
  };
}

export async function analyzeBrandVoice(posts: HeroPost[]): Promise<BrandVoiceAnalysis | null> {
  const readyPosts = posts.filter(p => p.status === 'ready' && p.postText);
  
  if (readyPosts.length === 0) {
    return null;
  }

  const postsContext = readyPosts.map((post, i) => {
    return `POST ${i + 1} (${post.platform}):
${post.postText}
---`;
  }).join('\n\n');

  const systemPrompt = `You are an expert brand voice analyst. Analyze the provided social media posts from a business to understand their unique brand voice and communication style.

Based on ALL the posts provided, create a comprehensive brand voice analysis that captures:
1. The overall tone and personality
2. Key traits that define how they communicate
3. Their relationship with their audience
4. Specific guidance for an AI to replicate this voice

Be specific and cite examples from the posts where possible. Focus on what makes this voice UNIQUE.

Return valid JSON with this structure:
{
  "brandVoiceSummary": "Two paragraphs describing the brand voice. First paragraph: overall personality and feel. Second paragraph: how they engage their audience and what makes their voice distinctive.",
  "voiceTraits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "audienceNotes": "A paragraph about their audience relationship - how they address readers, the level of formality, whether they use humor, etc.",
  "toneGuidance": {
    "dosList": ["Do use...", "Do incorporate...", "Do maintain..."],
    "dontsList": ["Don't be too...", "Don't use...", "Avoid..."],
    "keyPhrases": ["signature phrases or patterns they frequently use"]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze these ${readyPosts.length} posts to extract the brand voice:\n\n${postsContext}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as BrandVoiceAnalysis;
    
    return {
      brandVoiceSummary: parsed.brandVoiceSummary || '',
      voiceTraits: parsed.voiceTraits || [],
      audienceNotes: parsed.audienceNotes || '',
      toneGuidance: {
        dosList: parsed.toneGuidance?.dosList || [],
        dontsList: parsed.toneGuidance?.dontsList || [],
        keyPhrases: parsed.toneGuidance?.keyPhrases || [],
      },
    };
  } catch (error) {
    console.error('[BrandVoice] Analysis error:', error);
    return null;
  }
}
