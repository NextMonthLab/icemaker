/**
 * UX Copy for IceMaker - Upgrade Flows and Limit Messaging
 * 
 * PRINCIPLE: Frame limits as success, not restriction.
 * TONE: Calm, supportive, never punitive.
 */

// ============================================
// FREE ORBIT CONVERSATION LIMITS
// ============================================

export const FREE_CONVERSATION_LIMIT = 50;
export const FREE_CONVERSATION_SOFT_LIMIT = 40;

export const conversationLimitCopy = {
  // Soft limit (40 messages) - gentle nudge
  softLimit: {
    title: "Your Orbit is getting attention",
    message: "People are engaging with your business. You're approaching the free conversation limit.",
    cta: "Unlock unlimited conversations",
    ctaSecondary: "Continue for now",
  },

  // Hard limit (50 messages) - upgrade required
  hardLimit: {
    title: "Your Orbit is popular",
    message: "You've had 50 conversations this month — that's great engagement. Upgrade to continue conversations and unlock insights.",
    cta: "Upgrade to Orbit Grow",
    ctaSecondary: "View what people asked",
  },

  // Counter display (always visible)
  counter: (used: number, limit: number) => ({
    label: `${used} of ${limit} conversations this month`,
    percentage: Math.round((used / limit) * 100),
  }),
};

// ============================================
// ICE MAKER - CREDIT MESSAGING
// ============================================

export const iceCredits = {
  // Standard ICE (1 credit)
  standard: {
    title: "Create ICE",
    description: "12 cards with images and 4 featured video scenes",
    credits: 1,
    price: "£8",
  },

  // Full Cinematic upgrade
  fullCinematic: {
    budget: {
      title: "Full Cinematic (Budget)",
      description: "All 12 scenes as video (Haiper quality)",
      credits: 4,
      price: "£32",
    },
    standard: {
      title: "Full Cinematic (Standard)",
      description: "All 12 scenes as video (Minimax quality)",
      credits: 6,
      price: "£48",
    },
    premium: {
      title: "Full Cinematic (Premium)",
      description: "All 12 scenes as video (Kling quality)",
      credits: 8,
      price: "£64",
    },
  },

  // Upsell to Full Cinematic
  upgradeToFullCinematic: {
    title: "Upgrade to Full Cinematic",
    message: "Turn all 12 scenes into video for a complete short film experience.",
    cta: "Choose video quality",
  },

  // Insufficient credits
  insufficientCredits: {
    title: "Credits needed",
    message: (needed: number, balance: number) => 
      `This requires ${needed} credits. You have ${balance}.`,
    cta: "Get more credits",
    ctaSecondary: "Choose a smaller option",
  },
};

// ============================================
// ORBIT TIER UPGRADE MESSAGING
// ============================================

export const tierUpgrade = {
  // Free → Grow
  freeToGrow: {
    title: "Unlock Orbit Grow",
    message: "People are interacting with your Orbit. Unlock the ability to shape and grow it.",
    benefits: [
      "Edit and curate your Orbit",
      "Add pages, testimonials, PDFs",
      "Create ICE experiences",
      "Reduced IceMaker branding",
    ],
    price: "£19/month",
    cta: "Upgrade to Grow",
  },

  // Grow → Understand
  growToUnderstand: {
    title: "Unlock Orbit Understand",
    message: "You can shape your Orbit. Now understand what people are actually asking and why.",
    benefits: [
      "Conversation transcripts",
      "Question clustering",
      "Lead context (not just counts)",
      "6 ICE credits included monthly",
    ],
    price: "£49/month",
    cta: "Upgrade to Understand",
  },

  // Understand → Intelligence
  understandToIntelligence: {
    title: "Unlock Orbit Intelligence",
    message: "You don't just see activity or questions. You see how understanding forms — and what to do next.",
    benefits: [
      "Pattern Intelligence",
      "Journey path analysis",
      "Strategic Advice layer",
      "12-15 ICE credits monthly",
    ],
    price: "£99/month",
    cta: "Upgrade to Intelligence",
  },
};

// ============================================
// ICE FAIR USAGE (BUNDLED TIERS)
// ============================================

export const ICE_MONTHLY_ALLOWANCE = {
  grow: 0, // Pay-as-you-go
  understand: 6,
  intelligence: 15,
};

export const iceFairUsage = {
  // Approaching limit (80% used)
  approaching: (used: number, limit: number) => ({
    title: "ICE usage",
    message: `You've created ${used} of your ${limit} included ICEs this month.`,
    cta: "Get more credits",
    ctaSecondary: "Continue creating",
  }),

  // At limit
  atLimit: (limit: number) => ({
    title: "Monthly ICEs used",
    message: `You've used your ${limit} included ICEs. Create more with credits, or upgrade for a higher allowance.`,
    cta: "Upgrade plan",
    ctaSecondary: "Buy credits",
  }),
};

// ============================================
// VIDEO CAP MESSAGING
// ============================================

export const BUNDLED_VIDEO_SCENES = 4;
export const MAX_SCENES_PER_ICE = 12;

export const videoCap = {
  // Explain bundled video limit
  bundledLimit: {
    title: "4 video scenes included",
    message: "Your ICE includes 4 featured video scenes. Upgrade to Full Cinematic for all 12 scenes as video.",
    cta: "Upgrade to Full Cinematic",
  },

  // Video quality options
  qualityOptions: {
    title: "Choose video quality",
    subtitle: "Higher quality = more realistic motion",
    options: [
      { id: "haiper", label: "Budget", description: "Good quality, fast", credits: 4 },
      { id: "minimax", label: "Standard", description: "Excellent quality", credits: 6 },
      { id: "kling", label: "Premium", description: "Cinematic realism", credits: 8 },
    ],
  },
};

// ============================================
// GENERIC SUCCESS MESSAGES
// ============================================

export const success = {
  orbitClaimed: {
    title: "Orbit claimed",
    message: "You now own this Orbit. Welcome to your Data Hub.",
  },
  iceCreated: {
    title: "ICE created",
    message: "Your experience is ready to share.",
  },
  creditsPurchased: {
    title: "Credits added",
    message: (credits: number) => `${credits} credits have been added to your account.`,
  },
};

// ============================================
// LEAD CAPTURE MESSAGING
// ============================================

export const leadCapture = {
  // Contact form success
  success: {
    title: "Message sent",
    message: "The business owner will receive your message.",
  },
  // Form labels
  form: {
    title: "Get in touch",
    nameLabel: "Your name",
    emailLabel: "Email",
    messageLabel: "How can we help?",
    submitButton: "Send message",
  },
};
