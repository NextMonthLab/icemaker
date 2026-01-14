import { z } from "zod";

export const templateFamilyIds = [
  "onboarding",
  "lesson",
  "job-advert",
  "product-showcase",
  "menu-showcase",
  "house-listing",
  "survey",
  "lead-magnet",
  "short-film",
  "brand-story",
] as const;

export type TemplateFamilyId = typeof templateFamilyIds[number];

export const templateCategories = [
  {
    id: "onboard-train",
    label: "Onboard + Train",
    description: "Welcome new team members or teach new skills",
    families: ["onboarding", "lesson", "job-advert"],
  },
  {
    id: "sell-showcase",
    label: "Sell + Showcase",
    description: "Present products, menus, or properties",
    families: ["product-showcase", "menu-showcase", "house-listing"],
  },
  {
    id: "engage-collect",
    label: "Engage + Collect",
    description: "Gather feedback or capture leads",
    families: ["survey", "lead-magnet"],
  },
  {
    id: "story-entertain",
    label: "Story + Entertain",
    description: "Tell compelling brand stories",
    families: ["short-film", "brand-story"],
  },
] as const;

export type TemplateCategory = typeof templateCategories[number];

export interface TemplateStructure {
  id: string;
  label: string;
  description: string;
  cardArc: { type: string; title: string; objective: string }[];
}

export interface TemplateFamily {
  id: TemplateFamilyId;
  label: string;
  description: string;
  icon: string;
  category: string;
  structures: TemplateStructure[];
  defaultArcs: {
    short: string[];
    standard: string[];
    feature: string[];
  };
}

export const templateFamilies: Record<TemplateFamilyId, TemplateFamily> = {
  onboarding: {
    id: "onboarding",
    label: "Onboarding",
    description: "Welcome new team members with essential information",
    icon: "UserPlus",
    category: "onboard-train",
    structures: [
      {
        id: "welcome-role-essentials",
        label: "Welcome + Role + Essentials",
        description: "Start with a warm welcome, explain the role, cover essentials",
        cardArc: [
          { type: "intro", title: "Welcome", objective: "Create warm first impression" },
          { type: "scene", title: "About Us", objective: "Share company mission and values" },
          { type: "scene", title: "Your Role", objective: "Explain role responsibilities" },
          { type: "scene", title: "Your Team", objective: "Introduce key team members" },
          { type: "scene", title: "Tools & Systems", objective: "Cover essential tools" },
          { type: "scene", title: "First Week", objective: "Outline first week plan" },
          { type: "cta", title: "Get Started", objective: "Provide next steps" },
        ],
      },
      {
        id: "culture-first",
        label: "Culture-First Onboarding",
        description: "Lead with company culture and values before role details",
        cardArc: [
          { type: "intro", title: "Welcome Aboard", objective: "Create emotional connection" },
          { type: "scene", title: "Our Story", objective: "Share founding story" },
          { type: "scene", title: "Our Values", objective: "Explain core values" },
          { type: "scene", title: "How We Work", objective: "Describe work culture" },
          { type: "scene", title: "Your Journey", objective: "Map growth path" },
          { type: "cta", title: "Join the Team", objective: "Welcome to the family" },
        ],
      },
      {
        id: "compliance-heavy",
        label: "Compliance-Heavy Onboarding",
        description: "Focus on policies, procedures, and required training",
        cardArc: [
          { type: "intro", title: "Welcome", objective: "Brief welcome" },
          { type: "scene", title: "Company Policies", objective: "Cover key policies" },
          { type: "scene", title: "Safety & Compliance", objective: "Required safety info" },
          { type: "quiz", title: "Knowledge Check", objective: "Verify understanding" },
          { type: "scene", title: "Resources", objective: "Where to find help" },
          { type: "cta", title: "Acknowledge", objective: "Confirm completion" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  lesson: {
    id: "lesson",
    label: "Lesson / Training",
    description: "Teach concepts with structured learning modules",
    icon: "GraduationCap",
    category: "onboard-train",
    structures: [
      {
        id: "concept-practice-apply",
        label: "Concept → Practice → Apply",
        description: "Introduce concept, practice with examples, apply to real scenarios",
        cardArc: [
          { type: "intro", title: "Learning Objective", objective: "Set expectations" },
          { type: "scene", title: "Core Concept", objective: "Explain the main idea" },
          { type: "scene", title: "Examples", objective: "Show practical examples" },
          { type: "scene", title: "Practice", objective: "Guided practice" },
          { type: "quiz", title: "Check Understanding", objective: "Quick quiz" },
          { type: "scene", title: "Apply It", objective: "Real-world application" },
          { type: "cta", title: "Summary", objective: "Key takeaways" },
        ],
      },
      {
        id: "problem-solution",
        label: "Problem → Solution",
        description: "Present a problem, explore solutions, teach best practices",
        cardArc: [
          { type: "intro", title: "The Challenge", objective: "Present the problem" },
          { type: "scene", title: "Why It Matters", objective: "Explain impact" },
          { type: "scene", title: "The Solution", objective: "Introduce solution" },
          { type: "scene", title: "Step by Step", objective: "Detailed walkthrough" },
          { type: "scene", title: "Common Mistakes", objective: "What to avoid" },
          { type: "cta", title: "Next Steps", objective: "Continue learning" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "quiz", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "quiz", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "quiz", "scene", "scene", "scene", "scene", "quiz", "scene", "scene", "scene", "cta"],
    },
  },
  "job-advert": {
    id: "job-advert",
    label: "Job Advert",
    description: "Attract top talent with compelling role presentations",
    icon: "Briefcase",
    category: "onboard-train",
    structures: [
      {
        id: "opportunity-team-apply",
        label: "Opportunity → Team → Apply",
        description: "Sell the role, show the team, guide to application",
        cardArc: [
          { type: "intro", title: "The Opportunity", objective: "Hook with exciting role" },
          { type: "scene", title: "About the Role", objective: "Key responsibilities" },
          { type: "scene", title: "Meet the Team", objective: "Team culture preview" },
          { type: "scene", title: "Growth Path", objective: "Career development" },
          { type: "scene", title: "Benefits", objective: "What we offer" },
          { type: "cta", title: "Apply Now", objective: "Drive applications" },
        ],
      },
      {
        id: "day-in-life",
        label: "Day in the Life",
        description: "Show what it's really like to work in this role",
        cardArc: [
          { type: "intro", title: "Your Day Starts", objective: "Morning routine" },
          { type: "scene", title: "Morning Work", objective: "Key activities" },
          { type: "scene", title: "Team Time", objective: "Collaboration moments" },
          { type: "scene", title: "Challenges", objective: "Interesting problems" },
          { type: "scene", title: "Wins", objective: "Celebrate successes" },
          { type: "cta", title: "Join Us", objective: "Make it their day" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  "product-showcase": {
    id: "product-showcase",
    label: "Product Showcase",
    description: "Present products with compelling visuals and benefits",
    icon: "Package",
    category: "sell-showcase",
    structures: [
      {
        id: "problem-product-proof",
        label: "Problem → Product → Proof → CTA",
        description: "Classic sales narrative: pain, solution, social proof, action",
        cardArc: [
          { type: "intro", title: "The Problem", objective: "Identify pain point" },
          { type: "scene", title: "Meet the Solution", objective: "Introduce product" },
          { type: "scene", title: "Key Features", objective: "Highlight benefits" },
          { type: "scene", title: "How It Works", objective: "Show in action" },
          { type: "scene", title: "Results", objective: "Social proof" },
          { type: "cta", title: "Get Started", objective: "Drive purchase" },
        ],
      },
      {
        id: "feature-walkthrough",
        label: "Feature-Led Walkthrough",
        description: "Deep dive into product features and capabilities",
        cardArc: [
          { type: "intro", title: "Introducing", objective: "Product overview" },
          { type: "scene", title: "Feature 1", objective: "First key feature" },
          { type: "scene", title: "Feature 2", objective: "Second key feature" },
          { type: "scene", title: "Feature 3", objective: "Third key feature" },
          { type: "scene", title: "Pricing", objective: "Value proposition" },
          { type: "cta", title: "Try Now", objective: "Start trial" },
        ],
      },
      {
        id: "comparison-guide",
        label: "Comparison + Decision Guide",
        description: "Help buyers compare options and make decisions",
        cardArc: [
          { type: "intro", title: "Choosing Right", objective: "Frame the decision" },
          { type: "scene", title: "Option A", objective: "First option" },
          { type: "scene", title: "Option B", objective: "Second option" },
          { type: "scene", title: "Comparison", objective: "Side by side" },
          { type: "scene", title: "Recommendation", objective: "Expert advice" },
          { type: "cta", title: "Choose", objective: "Make selection" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  "menu-showcase": {
    id: "menu-showcase",
    label: "Menu Showcase",
    description: "Present food and beverage menus beautifully",
    icon: "UtensilsCrossed",
    category: "sell-showcase",
    structures: [
      {
        id: "category-highlights",
        label: "Category Highlights",
        description: "Organize by category with featured items",
        cardArc: [
          { type: "intro", title: "Welcome", objective: "Set the mood" },
          { type: "scene", title: "Starters", objective: "Appetizer selection" },
          { type: "scene", title: "Mains", objective: "Main course highlights" },
          { type: "scene", title: "Specials", objective: "Chef recommendations" },
          { type: "scene", title: "Desserts", objective: "Sweet endings" },
          { type: "cta", title: "Reserve", objective: "Book a table" },
        ],
      },
      {
        id: "chef-journey",
        label: "Chef's Journey",
        description: "Tell the story behind the food",
        cardArc: [
          { type: "intro", title: "Our Kitchen", objective: "Meet the chef" },
          { type: "scene", title: "Philosophy", objective: "Cooking approach" },
          { type: "scene", title: "Ingredients", objective: "Source story" },
          { type: "scene", title: "Signature Dishes", objective: "Must-try items" },
          { type: "scene", title: "Experience", objective: "Dining atmosphere" },
          { type: "cta", title: "Taste It", objective: "Visit us" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  "house-listing": {
    id: "house-listing",
    label: "House Listing",
    description: "Showcase properties with virtual tours",
    icon: "Home",
    category: "sell-showcase",
    structures: [
      {
        id: "tour-led",
        label: "Tour-Led",
        description: "Walk through the property room by room",
        cardArc: [
          { type: "intro", title: "Welcome Home", objective: "First impression" },
          { type: "scene", title: "Living Spaces", objective: "Main living areas" },
          { type: "scene", title: "Kitchen", objective: "Heart of the home" },
          { type: "scene", title: "Bedrooms", objective: "Private spaces" },
          { type: "scene", title: "Outdoor", objective: "Garden/patio" },
          { type: "cta", title: "Schedule Viewing", objective: "Book showing" },
        ],
      },
      {
        id: "lifestyle-led",
        label: "Lifestyle-Led",
        description: "Focus on the lifestyle this property enables",
        cardArc: [
          { type: "intro", title: "Your Life Here", objective: "Lifestyle vision" },
          { type: "scene", title: "Morning Routine", objective: "Start your day" },
          { type: "scene", title: "Entertainment", objective: "Host and enjoy" },
          { type: "scene", title: "Neighborhood", objective: "Community life" },
          { type: "scene", title: "The Details", objective: "Property specs" },
          { type: "cta", title: "Make It Yours", objective: "Contact agent" },
        ],
      },
      {
        id: "investor-led",
        label: "Investor-Led",
        description: "Focus on investment potential and ROI",
        cardArc: [
          { type: "intro", title: "Investment Opportunity", objective: "Value proposition" },
          { type: "scene", title: "Market Analysis", objective: "Area growth" },
          { type: "scene", title: "Property Details", objective: "Key features" },
          { type: "scene", title: "Financials", objective: "ROI potential" },
          { type: "scene", title: "Comparables", objective: "Market position" },
          { type: "cta", title: "Invest Now", objective: "Make offer" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  survey: {
    id: "survey",
    label: "Survey / Feedback",
    description: "Collect responses and gather insights",
    icon: "ClipboardList",
    category: "engage-collect",
    structures: [
      {
        id: "quick-pulse",
        label: "Quick Pulse",
        description: "Fast 3-5 question check-in",
        cardArc: [
          { type: "intro", title: "Quick Check-in", objective: "Set expectations" },
          { type: "quiz", title: "Question 1", objective: "Primary metric" },
          { type: "quiz", title: "Question 2", objective: "Secondary insight" },
          { type: "quiz", title: "Question 3", objective: "Additional data" },
          { type: "cta", title: "Thank You", objective: "Appreciation" },
        ],
      },
      {
        id: "deep-feedback",
        label: "Deep Feedback",
        description: "Comprehensive feedback collection",
        cardArc: [
          { type: "intro", title: "Your Feedback Matters", objective: "Explain importance" },
          { type: "quiz", title: "Overall Experience", objective: "General rating" },
          { type: "quiz", title: "Specific Areas", objective: "Detailed feedback" },
          { type: "quiz", title: "Suggestions", objective: "Improvement ideas" },
          { type: "quiz", title: "Would Recommend", objective: "NPS question" },
          { type: "cta", title: "Submitted", objective: "Thank and close" },
        ],
      },
      {
        id: "nps-followup",
        label: "NPS + Follow-ups",
        description: "Net Promoter Score with contextual follow-ups",
        cardArc: [
          { type: "intro", title: "One Question", objective: "Simple ask" },
          { type: "quiz", title: "Would You Recommend?", objective: "NPS score" },
          { type: "quiz", title: "Tell Us More", objective: "Open feedback" },
          { type: "scene", title: "What's Next", objective: "Set expectations" },
          { type: "cta", title: "Done", objective: "Thank you" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "quiz", "quiz", "quiz", "quiz", "cta"],
      standard: ["intro", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "scene", "cta"],
      feature: ["intro", "scene", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "quiz", "scene", "scene", "cta"],
    },
  },
  "lead-magnet": {
    id: "lead-magnet",
    label: "Lead Magnet",
    description: "Capture leads with valuable gated content",
    icon: "Magnet",
    category: "engage-collect",
    structures: [
      {
        id: "value-gate-deliver",
        label: "Value → Gate → Deliver",
        description: "Show value, capture info, deliver content",
        cardArc: [
          { type: "intro", title: "Free Resource", objective: "Hook with value" },
          { type: "scene", title: "What You'll Get", objective: "Preview content" },
          { type: "scene", title: "Why It Works", objective: "Build credibility" },
          { type: "quiz", title: "Get Access", objective: "Capture lead info" },
          { type: "scene", title: "Your Download", objective: "Deliver content" },
          { type: "cta", title: "Next Steps", objective: "Nurture relationship" },
        ],
      },
      {
        id: "quiz-result",
        label: "Quiz → Result",
        description: "Interactive quiz that delivers personalized results",
        cardArc: [
          { type: "intro", title: "Discover Your...", objective: "Engage curiosity" },
          { type: "quiz", title: "Question 1", objective: "First assessment" },
          { type: "quiz", title: "Question 2", objective: "Second assessment" },
          { type: "quiz", title: "Question 3", objective: "Third assessment" },
          { type: "quiz", title: "Get Your Results", objective: "Capture email" },
          { type: "cta", title: "Your Result", objective: "Personalized outcome" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "quiz", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "quiz", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "quiz", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  "short-film": {
    id: "short-film",
    label: "Short Film",
    description: "Tell a cinematic story with dramatic structure",
    icon: "Film",
    category: "story-entertain",
    structures: [
      {
        id: "classic-3-act",
        label: "Classic 3-Act",
        description: "Setup, confrontation, resolution",
        cardArc: [
          { type: "intro", title: "Opening", objective: "Set the scene" },
          { type: "scene", title: "The World", objective: "Establish normal" },
          { type: "scene", title: "The Catalyst", objective: "Inciting incident" },
          { type: "scene", title: "Rising Action", objective: "Build tension" },
          { type: "scene", title: "Climax", objective: "Peak moment" },
          { type: "scene", title: "Resolution", objective: "New equilibrium" },
          { type: "cta", title: "The End", objective: "Closing" },
        ],
      },
      {
        id: "mystery-reveal",
        label: "Mystery Reveal",
        description: "Build intrigue and reveal at the end",
        cardArc: [
          { type: "intro", title: "The Question", objective: "Hook with mystery" },
          { type: "scene", title: "Clue 1", objective: "First hint" },
          { type: "scene", title: "Clue 2", objective: "Second hint" },
          { type: "scene", title: "Misdirection", objective: "False lead" },
          { type: "scene", title: "The Reveal", objective: "Truth unveiled" },
          { type: "cta", title: "Aftermath", objective: "Implications" },
        ],
      },
      {
        id: "character-driven",
        label: "Character-Driven",
        description: "Focus on character arc and transformation",
        cardArc: [
          { type: "intro", title: "Meet the Character", objective: "Introduction" },
          { type: "scene", title: "Their World", objective: "Current state" },
          { type: "scene", title: "The Challenge", objective: "What they face" },
          { type: "scene", title: "The Struggle", objective: "Internal conflict" },
          { type: "scene", title: "The Change", objective: "Transformation" },
          { type: "cta", title: "New Beginning", objective: "Where they end up" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
  "brand-story": {
    id: "brand-story",
    label: "Brand Story",
    description: "Share your brand's journey and mission",
    icon: "Sparkles",
    category: "story-entertain",
    structures: [
      {
        id: "origin-story",
        label: "Origin Story",
        description: "How it all began and why we exist",
        cardArc: [
          { type: "intro", title: "Our Beginning", objective: "The spark" },
          { type: "scene", title: "The Problem", objective: "What we saw" },
          { type: "scene", title: "The Solution", objective: "Our answer" },
          { type: "scene", title: "The Journey", objective: "Growth story" },
          { type: "scene", title: "Today", objective: "Where we are" },
          { type: "cta", title: "Join Us", objective: "Be part of it" },
        ],
      },
      {
        id: "mission-driven",
        label: "Mission-Driven",
        description: "Focus on purpose and impact",
        cardArc: [
          { type: "intro", title: "Our Mission", objective: "What we believe" },
          { type: "scene", title: "The Challenge", objective: "World problem" },
          { type: "scene", title: "Our Approach", objective: "How we help" },
          { type: "scene", title: "Impact", objective: "Results achieved" },
          { type: "scene", title: "Vision", objective: "Future goals" },
          { type: "cta", title: "Get Involved", objective: "Call to action" },
        ],
      },
    ],
    defaultArcs: {
      short: ["intro", "scene", "scene", "scene", "scene", "cta"],
      standard: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
      feature: ["intro", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "scene", "cta"],
    },
  },
};

export const lengthOptions = [
  { id: "short", label: "Short", cardCount: 6, description: "Quick and focused" },
  { id: "standard", label: "Standard", cardCount: 10, description: "Comprehensive coverage" },
  { id: "feature", label: "Feature", cardCount: 15, description: "In-depth experience" },
] as const;

export type LengthOption = typeof lengthOptions[number]["id"];

export const styleOptions = {
  visualStyle: [
    { id: "clean", label: "Clean", description: "Minimal and professional" },
    { id: "cinematic", label: "Cinematic", description: "Bold and dramatic" },
    { id: "playful", label: "Playful", description: "Fun and energetic" },
    { id: "corporate", label: "Corporate", description: "Business formal" },
  ],
  voiceMode: [
    { id: "none", label: "No Voice", description: "Silent experience" },
    { id: "narrator", label: "Narrator", description: "Professional voiceover" },
    { id: "character", label: "Character", description: "Persona-driven" },
  ],
  interactionMode: [
    { id: "none", label: "View Only", description: "Passive viewing" },
    { id: "qna", label: "Q&A", description: "Questions between scenes" },
    { id: "choices", label: "Guided Choices", description: "Interactive decisions" },
  ],
  titlePackVibe: [
    { id: "modern", label: "Modern", description: "Clean sans-serif" },
    { id: "bold", label: "Bold", description: "Impactful statements" },
    { id: "minimal", label: "Minimal", description: "Subtle and elegant" },
    { id: "retro", label: "Retro", description: "Vintage inspired" },
  ],
} as const;

export type VisualStyle = typeof styleOptions.visualStyle[number]["id"];
export type VoiceMode = typeof styleOptions.voiceMode[number]["id"];
export type InteractionMode = typeof styleOptions.interactionMode[number]["id"];
export type TitlePackVibe = typeof styleOptions.titlePackVibe[number]["id"];

export const iceBlueprintSchema = z.object({
  templateFamily: z.enum(templateFamilyIds),
  length: z.enum(["short", "standard", "feature"]),
  structureId: z.string(),
  style: z.object({
    visualStyle: z.enum(["clean", "cinematic", "playful", "corporate"]),
    voiceMode: z.enum(["none", "narrator", "character"]),
    interactionMode: z.enum(["none", "qna", "choices"]),
    titlePackVibe: z.enum(["modern", "bold", "minimal", "retro"]),
  }),
  cards: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    objective: z.string(),
    contentPrompt: z.string().optional(),
    suggestedAssets: z.object({
      imagePrompt: z.string().optional(),
      videoPrompt: z.string().optional(),
      musicMood: z.string().optional(),
    }).optional(),
    interaction: z.object({
      characterId: z.string().optional(),
      qnaRules: z.string().optional(),
      choices: z.array(z.string()).optional(),
    }).optional(),
  })),
});

export type IceBlueprint = z.infer<typeof iceBlueprintSchema>;

export function generateBlueprintCards(
  family: TemplateFamily,
  structureId: string,
  length: LengthOption
): IceBlueprint["cards"] {
  const structure = family.structures.find(s => s.id === structureId);
  const cardCount = lengthOptions.find(l => l.id === length)?.cardCount || 6;
  
  if (structure && structure.cardArc.length > 0) {
    const baseArc = structure.cardArc;
    const cards: IceBlueprint["cards"] = [];
    
    if (cardCount <= baseArc.length) {
      for (let i = 0; i < cardCount; i++) {
        const arcItem = baseArc[Math.min(i, baseArc.length - 1)];
        cards.push({
          id: `card_${i}`,
          type: arcItem.type,
          title: arcItem.title,
          objective: arcItem.objective,
          contentPrompt: `Content for: ${arcItem.objective}`,
        });
      }
    } else {
      for (let i = 0; i < cardCount; i++) {
        if (i < baseArc.length) {
          cards.push({
            id: `card_${i}`,
            type: baseArc[i].type,
            title: baseArc[i].title,
            objective: baseArc[i].objective,
            contentPrompt: `Content for: ${baseArc[i].objective}`,
          });
        } else {
          const idx = i % (baseArc.length - 2) + 1;
          cards.push({
            id: `card_${i}`,
            type: "scene",
            title: `Scene ${i - baseArc.length + 2}`,
            objective: `Additional content section`,
            contentPrompt: `Expand on the narrative`,
          });
        }
      }
    }
    
    return cards;
  }
  
  const defaultArc = family.defaultArcs[length] || family.defaultArcs.short;
  return defaultArc.map((type, i) => ({
    id: `card_${i}`,
    type,
    title: type === "intro" ? "Introduction" : type === "cta" ? "Take Action" : `Scene ${i}`,
    objective: type === "intro" ? "Set the stage" : type === "cta" ? "Drive action" : "Develop the story",
    contentPrompt: `Content for card ${i + 1}`,
  }));
}
