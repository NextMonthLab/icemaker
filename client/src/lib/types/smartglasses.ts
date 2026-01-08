// Smart Glasses Category Discovery Types

// === AUDIT WIZARD ===
export type BudgetRange = 'under_300' | '300_600' | '600_1200' | 'over_1200';
export type PrimaryGoal = 'content_creation' | 'fitness' | 'commuting' | 'work' | 'accessibility' | 'experimenting';
export type MustHaveFeature = 'camera' | 'open_ear_audio' | 'ar_display' | 'prescription_support' | 'long_battery' | 'lightweight';
export type PrivacyComfort = 'low' | 'medium' | 'high';
export type PhoneEcosystem = 'iphone' | 'android' | 'mixed';

export interface AuditAnswers {
  budgetRange: BudgetRange | null;
  primaryGoal: PrimaryGoal | null;
  mustHaveFeatures: MustHaveFeature[];
  privacyComfort: PrivacyComfort | null;
  phoneEcosystem: PhoneEcosystem | null;
  wearsGlasses: boolean | null;
}

export interface CategoryFit {
  id: string;
  name: string;
  description: string;
  matchScore: number;
}

export interface AuditResult {
  profileSummary: string;
  considerations: string[];
  categoryFits: CategoryFit[];
}

// === EXPLAINER TILES ===
export interface ExplainerCard {
  id: string;
  title: string;
  description: string;
  icon: string;
}

// === Q&A LIBRARY ===
export interface TrendingQuestion {
  id: string;
  question: string;
  heat: number;
  updatedAt: string;
}

export interface ProductRef {
  id: string;
  name: string;
  detailsUrl?: string;
  sponsored: boolean;
}

export interface StoredAnswer {
  id: string;
  questionId: string;
  answer: string;
  sourceType: 'editorial' | 'community';
  updatedAt: string;
  upvotes: number;
  downvotes: number;
  productRefs?: ProductRef[];
}

// === SURFACED PRODUCTS ===
export type ProductTagType = 'sponsored' | 'new' | 'best_for_creators' | 'best_for_comfort' | 'budget_friendly' | 'premium';

export interface ProductTag {
  label: string;
  type: ProductTagType;
}

export interface SurfacedProduct {
  id: string;
  name: string;
  pitch: string;
  priceRange: string;
  tags: ProductTag[];
  sponsored: boolean;
  imageUrl?: string;
  detailsUrl?: string;
}

// === PARTNER INQUIRY ===
export interface PartnerInquiry {
  name: string;
  company: string;
  product: string;
  website: string;
  email: string;
}

// === API RESPONSES ===
export interface QuestionsResponse {
  questions: TrendingQuestion[];
}

export interface AnswersResponse {
  answers: StoredAnswer[];
}

export interface ProductsResponse {
  products: SurfacedProduct[];
}

export interface VoteResponse {
  answer: StoredAnswer;
}
