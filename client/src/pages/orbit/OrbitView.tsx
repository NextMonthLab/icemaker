import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Globe, ExternalLink, AlertCircle, CheckCircle, Mail, MessageCircle, LayoutDashboard } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RadarGrid } from "@/components/radar";
import { SpatialSmartSite } from "@/components/spatial";
import { BrandCustomizationScreen, type BrandPreferences } from "@/components/preview/BrandCustomizationScreen";
import { PreviewShareBar } from "@/components/preview/PreviewShareBar";
import { BusinessHubSidebar } from "@/components/orbit/BusinessHubSidebar";
import { HubPanelContainer } from "@/components/orbit/HubPanelContainer";
import { OrbitGrid } from "@/components/orbit/OrbitGrid";
import type { SiteKnowledge } from "@/lib/siteKnowledge";
import GlobalNav from "@/components/GlobalNav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ValidatedContent {
  overview: string;
  whatWeDo: string[];
  commonQuestions: { question: string; contextPrompt: string }[];
  brandName: string;
  passed: boolean;
  issues: string[];
}

interface Testimonial {
  quote: string;
  author: string | null;
  role: string | null;
  company: string | null;
  rating: number | null;
  imageUrl: string | null;
}

interface FaqPair {
  question: string;
  answer: string;
}

interface StructuredData {
  organization: {
    name: string | null;
    description: string | null;
    url: string | null;
    logo: string | null;
    sameAs: string[];
  } | null;
  products: Array<{
    name: string;
    description: string | null;
    price: string | null;
    imageUrl: string | null;
  }>;
  faqs: FaqPair[];
  events: Array<{
    name: string;
    description: string | null;
    startDate: string | null;
    location: string | null;
  }>;
  people: Array<{
    name: string;
    jobTitle: string | null;
    description: string | null;
    imageUrl: string | null;
  }>;
}

interface SiteIdentity {
  sourceDomain: string;
  title: string | null;
  heroHeadline: string | null;
  heroDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  primaryColour: string;
  serviceHeadings: string[];
  serviceBullets: string[];
  faqCandidates: string[];
  extractedAt: string;
  imagePool?: string[];
  validatedContent?: ValidatedContent;
  structuredData?: StructuredData | null;
  testimonials?: Testimonial[];
  enhancedFaqs?: FaqPair[];
}

interface PreviewInstance {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'active' | 'archived' | 'claimed';
  siteTitle: string | null;
  siteSummary: string | null;
  keyServices: string[] | null;
  siteIdentity: SiteIdentity | null;
  messageCount: number;
  maxMessages: number;
  expiresAt: string;
  createdAt: string;
  previewAccessToken?: string;
}

interface OrbitBox {
  id: number;
  businessSlug: string;
  boxType: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  content: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isVisible: boolean;
  iceId: number | null;
  price?: string | null;
  currency?: string | null;
  category?: string | null;
  availability?: string | null;
  tags?: Array<{ key: string; value: string }> | null;
}

interface OrbitResponse {
  status: "ready" | "generating" | "failed" | "idle";
  businessSlug: string;
  ownerId?: number | null;
  planTier?: 'free' | 'grow' | 'insight' | 'intelligence';
  customTitle?: string | null;
  customDescription?: string | null;
  lastUpdated?: string;
  previewId?: string | null;
  boxes?: OrbitBox[];
  error?: string;
  requestedAt?: string;
}

export default function OrbitView() {
  const [matchedOrbit, orbitParams] = useRoute("/orbit/:slug");
  const [matchedO, oParams] = useRoute("/o/:slug");
  const [matchedClaim, claimParams] = useRoute("/orbit/:slug/claim");
  const slug = orbitParams?.slug || oParams?.slug || claimParams?.slug;
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  
  const [showCustomization, setShowCustomization] = useState(true);
  const [brandPreferences, setBrandPreferences] = useState<BrandPreferences | null>(null);
  const [experienceType, setExperienceType] = useState<'radar' | 'spatial' | 'classic'>('radar');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimStep, setClaimStep] = useState<'intro' | 'verify'>('intro');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimStatus, setClaimStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'success' | 'error'>('idle');
  const [claimMessage, setClaimMessage] = useState('');
  const [conversationTracked, setConversationTracked] = useState(false);
  const [lastTrackedSlug, setLastTrackedSlug] = useState<string | null>(null);
  
  // Contact form state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Business Hub state
  const [showHub, setShowHub] = useState(false);
  const [hubPanel, setHubPanel] = useState<'overview' | 'grid' | 'ice' | 'brand' | 'settings' | 'conversations' | 'leads' | 'notifications' | 'data-sources' | 'cubes' | 'ai-discovery'>('overview');
  
  // Conversation history for AI chat
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  useEffect(() => {
    if (slug && slug !== lastTrackedSlug) {
      setConversationTracked(false);
      setLastTrackedSlug(slug);
    }
  }, [slug, lastTrackedSlug]);

  const trackMetric = (metric: 'visits' | 'interactions' | 'conversations' | 'iceViews') => {
    if (!slug) return;
    fetch(`/api/orbit/${slug}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric }),
    }).catch(() => {});
  };

  const { data: orbitData, isLoading: orbitLoading, error: orbitError, refetch } = useQuery<OrbitResponse>({
    queryKey: ["orbit", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch orbit");
      }
      return response.json();
    },
    refetchInterval: (query) => {
      if (query.state.data?.status === "generating") {
        return 3000;
      }
      return false;
    },
    enabled: !!slug,
  });

  const { data: preview, isLoading: previewLoading } = useQuery<PreviewInstance>({
    queryKey: ["preview", orbitData?.previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${orbitData!.previewId}`);
      if (!response.ok) throw new Error("Preview not found");
      return response.json();
    },
    enabled: !!orbitData?.previewId,
  });

  // Check if current user is the owner
  const { data: currentUser } = useQuery<{ id: number; email: string } | null>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await fetch("/api/user");
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Viewer context - authoritative source for viewer role and permissions
  interface ViewerContext {
    viewerRole: 'admin' | 'public';
    isClaimed: boolean;
    isFirstRun: boolean;
    planTier: string;
    canEditAppearance: boolean;
    canDeepScan: boolean;
    canSeeClaimCTA: boolean;
    canAccessHub: boolean;
    businessSlug: string;
    generationStatus: string;
  }
  
  const { data: viewerContext } = useQuery<ViewerContext | null>({
    queryKey: ["orbit-viewer-context", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/viewer-context`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug,
  });

  // Use viewer context as primary source of truth - default to safe values until loaded
  const viewerContextLoaded = !!viewerContext;
  const isOwner = viewerContext?.viewerRole === 'admin' || (currentUser && orbitData?.ownerId === currentUser.id);
  const isUnclaimed = viewerContext ? !viewerContext.isClaimed : !orbitData?.ownerId;
  const isFirstRun = viewerContext?.isFirstRun ?? false;
  // CRITICAL: Default to false to prevent showing claim CTA to admin before context loads
  const canSeeClaimCTA = viewerContextLoaded ? (viewerContext?.canSeeClaimCTA ?? false) : false;
  const canDeepScan = viewerContext?.canDeepScan ?? false;
  
  // Tier checks
  type PlanTierType = 'free' | 'grow' | 'insight' | 'intelligence';
  const planTier = (viewerContext?.planTier || orbitData?.planTier || 'free') as PlanTierType;
  const PAID_TIERS: PlanTierType[] = ['grow', 'insight', 'intelligence'];
  const isPaidTier = PAID_TIERS.includes(planTier);

  // Fetch hub analytics for owners
  const { data: hubData } = useQuery<{
    analytics: { visits: number; interactions: number; conversations: number; iceViews: number };
    leads: { count: number };
  }>({
    queryKey: ["orbit-hub", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/hub`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!slug && !!isOwner,
  });

  // Redirect paid tier owners to Business Hub (unless they're on claim route or explicitly viewing public orbit)
  const viewPublic = new URLSearchParams(searchString).get('view') === 'public';
  useEffect(() => {
    if (isOwner && isPaidTier && slug && !matchedClaim && !viewPublic) {
      setLocation(`/orbit/${slug}/hub`);
    }
  }, [isOwner, isPaidTier, slug, matchedClaim, viewPublic, setLocation]);

  const requestClaimMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/orbit/${slug}/claim/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to request claim');
      return data;
    },
    onSuccess: (data) => {
      setClaimStatus('sent');
      setClaimMessage(data.trusted 
        ? 'Check your email for the magic link to claim this orbit.' 
        : 'We need to verify your connection to this domain. Check your email for next steps.');
    },
    onError: (error: Error) => {
      setClaimStatus('error');
      setClaimMessage(error.message);
    },
  });

  const verifyClaimMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch(`/api/orbit/${slug}/claim/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to verify claim');
      return data;
    },
    onSuccess: () => {
      setClaimStatus('success');
      setClaimMessage('You\'ve successfully claimed this orbit!');
      refetch();
      setTimeout(() => {
        setShowClaimModal(false);
        setLocation(`/orbit/${slug}`);
      }, 2000);
    },
    onError: (error: Error) => {
      setClaimStatus('error');
      setClaimMessage(error.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const token = params.get('token');
    if (token && matchedClaim) {
      setShowClaimModal(true);
      setClaimStatus('verifying');
      verifyClaimMutation.mutate(token);
    }
  }, [matchedClaim, searchString]);

  useEffect(() => {
    if (slug && orbitData?.status === 'ready') {
      trackMetric('visits');
    }
  }, [slug, orbitData?.status]);

  const handleClaimRequest = () => {
    if (!claimEmail) return;
    setClaimStatus('sending');
    requestClaimMutation.mutate(claimEmail);
  };

  const handleCustomizationConfirm = (prefs: BrandPreferences, expType?: 'radar' | 'spatial' | 'classic') => {
    setBrandPreferences(prefs);
    if (expType) setExperienceType(expType);
    setShowCustomization(false);
  };

  const generateSiteKnowledge = (preview: PreviewInstance): SiteKnowledge => {
    const siteIdentity = preview.siteIdentity;
    const validatedContent = siteIdentity?.validatedContent;
    
    const extractBrandFromTitle = (title: string | null | undefined): string | undefined => {
      if (!title) return undefined;
      const parts = title.split(/\s*[|\-]\s*/);
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        if (lastPart.length > 0 && lastPart.length < 40 && !lastPart.toLowerCase().includes('home')) {
          return lastPart;
        }
      }
      return parts[0]?.trim();
    };
    
    const brandName = validatedContent?.brandName || 
                      extractBrandFromTitle(siteIdentity?.title) || 
                      preview.sourceDomain;
    const imagePool = siteIdentity?.imagePool || [];
    
    const topics = [
      ...(siteIdentity?.serviceBullets || []).slice(0, 12).map((bullet, i) => ({
        id: `t_${i}`,
        label: bullet.length > 40 ? bullet.slice(0, 40) + '...' : bullet,
        keywords: bullet.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'topic' as const,
        summary: bullet,
        imageUrl: imagePool[i % imagePool.length],
      })),
      ...(validatedContent?.whatWeDo || []).slice(0, 10).map((item, i) => ({
        id: `tw_${i}`,
        label: item.length > 40 ? item.slice(0, 40) + '...' : item,
        keywords: item.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'topic' as const,
        summary: item,
        imageUrl: imagePool[(i + 2) % imagePool.length],
      })),
    ];

    const pages = [
      {
        id: 'p_home',
        title: brandName,
        url: preview.sourceUrl,
        summary: siteIdentity?.heroDescription || preview.siteSummary || `Explore everything about ${brandName}`,
        keywords: ['home', 'main', 'about', ...brandName.toLowerCase().split(/\s+/)],
        type: 'page' as const,
        imageUrl: siteIdentity?.heroImageUrl || imagePool[0],
      },
      ...(siteIdentity?.serviceHeadings || []).slice(0, 10).map((heading, i) => ({
        id: `p_${i + 1}`,
        title: heading,
        url: preview.sourceUrl,
        summary: `Learn more about ${heading}`,
        keywords: heading.toLowerCase().split(/\s+/),
        type: 'page' as const,
        imageUrl: imagePool[(i + 1) % imagePool.length],
      })),
    ];

    const proof: SiteKnowledge['proof'] = [];
    
    // Add testimonials as proof tiles (highest value)
    const testimonials = siteIdentity?.testimonials || [];
    testimonials.slice(0, 8).forEach((testimonial, i) => {
      const label = testimonial.author 
        ? `${testimonial.author}${testimonial.company ? ` - ${testimonial.company}` : ''}`
        : 'Customer Testimonial';
      proof.push({
        id: `pt_${i}`,
        label: label.length > 50 ? label.slice(0, 50) + '...' : label,
        summary: testimonial.quote.length > 200 ? testimonial.quote.slice(0, 200) + '...' : testimonial.quote,
        keywords: ['testimonial', 'review', 'customer', ...(testimonial.author?.toLowerCase().split(/\s+/) || [])],
        type: 'proof' as const,
        imageUrl: testimonial.imageUrl || imagePool[(i + 5) % imagePool.length],
      });
    });
    
    // Add enhanced FAQs as proof tiles
    const enhancedFaqs = siteIdentity?.enhancedFaqs || [];
    enhancedFaqs.slice(0, 8).forEach((faq, i) => {
      proof.push({
        id: `pf_${i}`,
        label: faq.question.length > 50 ? faq.question.slice(0, 50) + '...' : faq.question,
        summary: faq.answer.length > 200 ? faq.answer.slice(0, 200) + '...' : faq.answer,
        keywords: [...faq.question.toLowerCase().split(/\s+/).filter(w => w.length > 3), 'faq', 'question'],
        type: 'proof' as const,
        imageUrl: imagePool[(i + 3) % imagePool.length],
      });
    });
    
    // Fallback to old FAQ candidates if no enhanced data
    if (proof.length === 0) {
      (validatedContent?.commonQuestions || siteIdentity?.faqCandidates || []).slice(0, 8).forEach((faq, i) => {
        const question = typeof faq === 'string' ? faq : faq.question;
        proof.push({
          id: `pr_${i}`,
          label: question.length > 50 ? question.slice(0, 50) + '...' : question,
          summary: question,
          keywords: question.toLowerCase().split(/\s+/).filter(w => w.length > 3),
          type: 'proof' as const,
          imageUrl: imagePool[(i + 3) % imagePool.length],
        });
      });
    }

    // Extract people from structured data
    const people: SiteKnowledge['people'] = [];
    const structuredPeople = siteIdentity?.structuredData?.people || [];
    structuredPeople.slice(0, 10).forEach((person, i) => {
      people.push({
        id: `pe_${i}`,
        name: person.name,
        role: person.jobTitle || 'Team Member',
        email: '',
        phone: null,
        avatar: person.imageUrl || null,
        keywords: [person.name.toLowerCase(), ...(person.jobTitle?.toLowerCase().split(/\s+/) || []), 'team', 'person'],
        type: 'person' as const,
      });
    });

    // Add products as topics if available
    const structuredProducts = siteIdentity?.structuredData?.products || [];
    structuredProducts.slice(0, 10).forEach((product, i) => {
      topics.push({
        id: `tpr_${i}`,
        label: product.name.length > 40 ? product.name.slice(0, 40) + '...' : product.name,
        keywords: [...product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3), 'product'],
        type: 'topic' as const,
        summary: product.description || `${product.name}${product.price ? ` - ${product.price}` : ''}`,
        imageUrl: product.imageUrl || imagePool[(i + 4) % imagePool.length],
      });
    });

    // Extract social links from sameAs
    const socials: SiteKnowledge['socials'] = [];
    const sameAsUrls = siteIdentity?.structuredData?.organization?.sameAs || [];
    const platformPatterns: { platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest'; pattern: RegExp }[] = [
      { platform: 'linkedin', pattern: /linkedin\.com/ },
      { platform: 'twitter', pattern: /twitter\.com|x\.com/ },
      { platform: 'facebook', pattern: /facebook\.com/ },
      { platform: 'instagram', pattern: /instagram\.com/ },
      { platform: 'youtube', pattern: /youtube\.com/ },
      { platform: 'tiktok', pattern: /tiktok\.com/ },
      { platform: 'pinterest', pattern: /pinterest\.com/ },
    ];
    
    sameAsUrls.slice(0, 7).forEach((socialUrl, i) => {
      const matchedPlatform = platformPatterns.find(p => p.pattern.test(socialUrl));
      if (matchedPlatform) {
        const handleMatch = socialUrl.match(/(?:\/(?:company|in|@)?\/?)([^/?\s]+)\/?$/);
        const handle = handleMatch ? handleMatch[1] : matchedPlatform.platform;
        socials.push({
          id: `soc_${i}`,
          platform: matchedPlatform.platform,
          handle: handle,
          url: socialUrl,
          connected: true,
          keywords: [matchedPlatform.platform, 'social', 'connect', handle.toLowerCase()],
          type: 'social' as const,
        });
      }
    });

    return {
      brand: {
        name: brandName,
        domain: preview.sourceDomain,
        tagline: siteIdentity?.heroHeadline || preview.siteSummary || '',
        primaryColor: brandPreferences?.accentColor || siteIdentity?.primaryColour || '#3b82f6',
      },
      topics,
      pages,
      people,
      proof,
      actions: [
        {
          id: 'a_video',
          label: 'Request Video Reply',
          summary: 'Get a personalised video response from our team',
          keywords: ['video', 'reply', 'personal', 'response'],
          type: 'action' as const,
          actionType: 'video_reply' as const,
        },
        {
          id: 'a_call',
          label: 'Schedule a Call',
          summary: 'Book a consultation call with our experts',
          keywords: ['call', 'phone', 'consultation', 'schedule', 'book'],
          type: 'action' as const,
          actionType: 'call' as const,
        },
        {
          id: 'a_email',
          label: 'Send Enquiry',
          summary: 'Email your questions to our team',
          keywords: ['email', 'enquiry', 'contact', 'message'],
          type: 'action' as const,
          actionType: 'email' as const,
        },
        {
          id: 'a_quote',
          label: 'Get a Quote',
          summary: 'Request pricing information',
          keywords: ['quote', 'price', 'cost', 'pricing'],
          type: 'action' as const,
          actionType: 'quote' as const,
        },
      ],
      blogs: [],
      socials,
    };
  };

  if (orbitLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mx-auto" data-testid="loading-spinner" />
          <p className="text-zinc-500 text-sm mt-4">Loading orbit...</p>
        </div>
      </div>
    );
  }

  if (orbitError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold text-zinc-100">Orbit Not Found</h1>
          <p className="text-zinc-400">{(orbitError as Error).message}</p>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = "/for/brands"}
            className="mt-4"
            data-testid="button-create-orbit"
          >
            Create an Orbit
          </Button>
        </div>
      </div>
    );
  }

  if (orbitData?.status === "generating") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto" />
          <h1 className="text-lg font-medium text-zinc-200">Preparing your orbit</h1>
          <p className="text-zinc-500 text-sm">Extracting intelligence from your site. This typically takes 30 seconds.</p>
          {orbitData.requestedAt && (
            <p className="text-xs text-zinc-600">
              Started: {new Date(orbitData.requestedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (orbitData?.status === "failed") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold text-zinc-100">Generation Failed</h1>
          <p className="text-zinc-400">{orbitData.error || "An error occurred"}</p>
          <Button 
            variant="outline"
            onClick={() => refetch()}
            className="mt-4"
            data-testid="button-retry"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (previewLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500 mx-auto" />
          <p className="text-zinc-500 text-sm mt-4">Loading experience...</p>
        </div>
      </div>
    );
  }

  const hasBoxes = orbitData?.boxes && orbitData.boxes.length > 0;
  const transformedBoxes = hasBoxes ? orbitData!.boxes!.map(box => ({
    id: String(box.id),
    type: (box.boxType === 'product' ? 'product' : box.boxType) as "page" | "service" | "faq" | "testimonial" | "blog" | "document" | "custom" | "product" | "menu_item",
    title: box.title,
    summary: box.description || '',
    themes: [],
    price: box.price ? Number(box.price) : undefined,
    currency: box.currency || 'USD',
    category: box.category || undefined,
    imageUrl: box.imageUrl || undefined,
    availability: (box.availability === 'available' ? 'in_stock' : box.availability === 'limited' ? 'limited' : 'out_of_stock') as 'in_stock' | 'out_of_stock' | 'limited',
    tags: box.tags?.map((t: any) => t.value).filter(Boolean) || [],
  })) : [];

  const buildMergedSiteKnowledge = (boxes: OrbitBox[], previewData?: PreviewInstance | null): SiteKnowledge => {
    const siteIdentity = previewData?.siteIdentity;
    const brandName = orbitData?.customTitle || 
                      siteIdentity?.validatedContent?.brandName || 
                      siteIdentity?.title?.split(' - ')[0]?.split(' | ')[0] || 
                      slug?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Business';
    
    // Merge image pools: preview images + box images
    const previewImages = siteIdentity?.imagePool || [];
    const boxImages = boxes.map(b => b.imageUrl).filter(Boolean) as string[];
    const allImagesSet: string[] = [];
    boxImages.forEach(img => { if (!allImagesSet.includes(img)) allImagesSet.push(img); });
    previewImages.forEach(img => { if (!allImagesSet.includes(img)) allImagesSet.push(img); });
    
    const categorySet: Record<string, boolean> = {};
    boxes.forEach(b => { if (b.category) categorySet[b.category] = true; });
    const categories = Object.keys(categorySet);
    
    // Create topics from boxes with fallback images from preview
    const topics = boxes.slice(0, 50).map((box, i) => ({
      id: `box_${box.id}`,
      label: box.title.length > 40 ? box.title.slice(0, 40) + '...' : box.title,
      keywords: [...box.title.toLowerCase().split(/\s+/).filter(w => w.length > 2), box.category?.toLowerCase() || 'product'],
      type: 'topic' as const,
      summary: box.description || `${box.title}${box.price ? ` - ${box.currency || '£'}${box.price}` : ''}`,
      imageUrl: box.imageUrl || (previewImages.length > 0 ? previewImages[i % previewImages.length] : undefined),
    }));

    // Create category pages
    const pages = categories.slice(0, 10).map((cat, i) => {
      const catImage = boxes.find(b => b.category === cat && b.imageUrl)?.imageUrl || 
                       (previewImages.length > 0 ? previewImages[i % previewImages.length] : undefined);
      return {
        id: `cat_${i}`,
        title: cat,
        url: '#',
        summary: `Browse our ${cat} selection (${boxes.filter(b => b.category === cat).length} items)`,
        keywords: [cat.toLowerCase(), 'category', 'menu'],
        type: 'page' as const,
        imageUrl: catImage,
      };
    });

    return {
      brand: {
        name: brandName,
        domain: siteIdentity?.sourceDomain || slug || '',
        tagline: siteIdentity?.heroHeadline || orbitData?.customDescription || `${boxes.length} items available`,
        primaryColor: brandPreferences?.accentColor || siteIdentity?.primaryColour || '#ec4899',
      },
      topics,
      pages,
      people: [],
      proof: [],
      actions: [
        {
          id: 'a_menu',
          label: 'View Full Menu',
          summary: `Browse all ${boxes.length} items`,
          keywords: ['menu', 'order', 'food', 'browse'],
          type: 'action' as const,
          actionType: 'quote' as const,
        },
      ],
      blogs: [],
      socials: [],
    };
  };

  // Priority: Boxes (extracted menu/products) > Preview siteIdentity (scraped pages)
  // Boxes contain real product data; siteIdentity often only has page titles
  // Use merged knowledge that combines boxes data with preview branding/images
  if (hasBoxes) {
    const mergedKnowledge = buildMergedSiteKnowledge(orbitData!.boxes!, preview);
    const logoUrl = preview?.siteIdentity?.logoUrl || null;
    const faviconUrl = preview?.siteIdentity?.faviconUrl || null;
    const accentColor = mergedKnowledge.brand.primaryColor;
    
    // Merge image pools for brand customization
    const previewImages = preview?.siteIdentity?.imagePool || [];
    const boxImages = orbitData!.boxes!.map(b => b.imageUrl).filter(Boolean) as string[];
    const mergedImagePool: string[] = [];
    boxImages.forEach(img => { if (!mergedImagePool.includes(img)) mergedImagePool.push(img); });
    previewImages.forEach(img => { if (!mergedImagePool.includes(img)) mergedImagePool.push(img); });
    
    // Build menu context for AI chat
    const menuContext = orbitData!.boxes!.slice(0, 60).map(box => ({
      name: box.title,
      description: box.description,
      price: box.price,
      category: box.category,
    }));
    
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col relative">
        <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" />
        <div className="flex-1">
          {showCustomization ? (
            <BrandCustomizationScreen
              logoUrl={logoUrl}
              faviconUrl={faviconUrl}
              brandName={mergedKnowledge.brand.name}
              defaultAccentColor={accentColor}
              imagePool={mergedImagePool}
              previewId={preview?.id || ""}
              canDeepScan={canDeepScan}
              isFirstRun={isFirstRun}
              onConfirm={handleCustomizationConfirm}
            />
          ) : (
            <RadarGrid
              knowledge={mergedKnowledge}
              accentColor={accentColor}
              lightMode={brandPreferences?.theme === 'light'}
              onInteraction={() => trackMetric('interactions')}
              onSendMessage={async (message) => {
                if (!conversationTracked) {
                  trackMetric('conversations');
                  setConversationTracked(true);
                }
                
                // Add user message to history
                chatHistoryRef.current.push({ role: 'user', content: message });
                
                // Keep only last 10 messages to avoid token limits
                if (chatHistoryRef.current.length > 10) {
                  chatHistoryRef.current = chatHistoryRef.current.slice(-10);
                }
                
                // Use orbit-specific chat endpoint with history
                try {
                  const response = await fetch(`/api/orbit/${slug}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      message,
                      menuContext,
                      history: chatHistoryRef.current.slice(0, -1), // Exclude current message
                    }),
                  });
                  if (response.ok) {
                    const data = await response.json();
                    const assistantResponse = data.response || data.message || "I'm here to help you explore our menu.";
                    
                    // Add assistant response to history
                    chatHistoryRef.current.push({ role: 'assistant', content: assistantResponse });
                    
                    return assistantResponse;
                  }
                } catch (e) {
                  console.error('Orbit chat error:', e);
                }
                return `I'm here to help you explore our menu. We have ${orbitData!.boxes!.length} items available. What would you like to know?`;
              }}
            />
          )}
        </div>
        {/* Public unclaimed CTA - only show to public viewers */}
        {!showCustomization && isUnclaimed && canSeeClaimCTA && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10 py-2 px-4">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
              <span className="text-xs text-white/60">
                Powered by <span className="text-pink-400 font-medium">NextMonth</span>
              </span>
              <Button
                size="sm"
                className="bg-pink-500/90 hover:bg-pink-500 text-white text-xs px-3 py-1 h-7"
                onClick={() => setShowClaimModal(true)}
                data-testid="button-claim-orbit"
              >
                Claim This Orbit
              </Button>
            </div>
          </div>
        )}
        
        {/* First-run admin CTA - allow creators to verify ownership after preview */}
        {!showCustomization && isFirstRun && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-sm border-t border-pink-500/30 py-3 px-4">
            <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
              <div className="w-full flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm text-white font-medium">Your Orbit is ready!</span>
                  <span className="text-xs text-zinc-300">Verify ownership to unlock all features</span>
                </div>
                <Button 
                  size="sm"
                  className="bg-white hover:bg-zinc-100 text-purple-900 font-medium text-xs px-4 py-2 h-8"
                  onClick={() => setShowClaimModal(true)}
                  data-testid="button-verify-ownership"
                >
                  Verify Ownership
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  if (!preview?.siteIdentity) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Globe className="h-12 w-12 text-zinc-400 mx-auto" />
          <h1 className="text-xl font-semibold text-zinc-100">Experience Not Available</h1>
          <p className="text-zinc-400">This orbit's experience data is still being prepared.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" minimal={showHub} />
      <div className="flex-1 flex relative">
      {/* Business Hub Sidebar for paid tier owners */}
      {isOwner && isPaidTier && showHub && (
        <BusinessHubSidebar
          isOwner={true}
          planTier={planTier}
          businessSlug={slug || ''}
          activePanel={hubPanel}
          onPanelChange={setHubPanel}
          onClose={() => setShowHub(false)}
          analytics={hubData ? {
            visits: hubData.analytics.visits,
            interactions: hubData.analytics.interactions,
            conversations: hubData.analytics.conversations,
            leads: hubData.leads.count,
          } : undefined}
        />
      )}

      {/* Hub toggle button for paid tier owners */}
      {isOwner && isPaidTier && !showHub && !showCustomization && (
        <Button
          onClick={() => setShowHub(true)}
          className="fixed left-4 top-4 z-50 bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700"
          size="sm"
          data-testid="button-open-hub"
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Business Hub
        </Button>
      )}
      
      {/* Free tier owner - show upgrade prompt */}
      {isOwner && !isPaidTier && !showCustomization && (
        <div className="fixed left-4 top-4 z-50 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 max-w-xs">
          <p className="text-sm text-zinc-300 mb-2">Upgrade to unlock your Business Hub</p>
          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            data-testid="button-upgrade-cta"
          >
            Upgrade to Grow
          </Button>
        </div>
      )}

      {/* Hub Panel Content (when hub is open) */}
      {isOwner && isPaidTier && showHub && (
        <div className="flex-1 bg-zinc-950 overflow-auto">
          <HubPanelContainer
            activePanel={hubPanel}
            businessSlug={slug || ''}
            planTier={planTier}
            customTitle={orbitData?.customTitle}
            customDescription={orbitData?.customDescription}
          />
        </div>
      )}

      {/* Main content area (when hub is closed or not owner) */}
      <div className={cn("flex-1 flex flex-col", isOwner && isPaidTier && showHub && "hidden")}>
        {/* Share bar for unclaimed orbits */}
        {isUnclaimed && !showCustomization && preview && (
          <PreviewShareBar
            previewId={preview.id}
            expiresAt={preview.expiresAt}
            brandName={preview.siteIdentity?.validatedContent?.brandName || preview.siteIdentity?.title?.split(' - ')[0]?.split(' | ')[0] || preview.sourceDomain}
          />
        )}

        {showCustomization && (
        <BrandCustomizationScreen
          logoUrl={preview.siteIdentity.logoUrl}
          faviconUrl={preview.siteIdentity.faviconUrl}
          brandName={preview.siteIdentity.validatedContent?.brandName || preview.siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || preview.sourceDomain}
          defaultAccentColor={preview.siteIdentity.primaryColour || '#ffffff'}
          imagePool={preview.siteIdentity.imagePool || []}
          previewId={preview.id}
          canDeepScan={canDeepScan}
          isFirstRun={isFirstRun}
          onConfirm={handleCustomizationConfirm}
        />
      )}

      {!showCustomization && experienceType === 'radar' && (
        <RadarGrid
          knowledge={generateSiteKnowledge(preview)}
          accentColor={brandPreferences?.accentColor || preview.siteIdentity.primaryColour || '#3b82f6'}
          lightMode={brandPreferences?.theme === 'light'}
          onInteraction={() => trackMetric('interactions')}
          onSendMessage={async (message) => {
            if (!conversationTracked) {
              trackMetric('conversations');
              setConversationTracked(true);
            }
            const response = await fetch(`/api/previews/${preview.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message, previewAccessToken: preview.previewAccessToken }),
            });
            if (!response.ok) {
              return "Sorry, I couldn't process that request.";
            }
            const data = await response.json();
            if (data.capped) {
              return data.message || "Message limit reached. Claim this Orbit to continue chatting.";
            }
            return data.reply;
          }}
        />
      )}

      {!showCustomization && experienceType === 'spatial' && (
        <SpatialSmartSite
          siteIdentity={{
            sourceDomain: preview.siteIdentity.sourceDomain,
            title: preview.siteIdentity.title,
            logoUrl: preview.siteIdentity.logoUrl,
            faviconUrl: preview.siteIdentity.faviconUrl,
            heroDescription: preview.siteIdentity.heroDescription,
            primaryColour: preview.siteIdentity.primaryColour,
            serviceBullets: preview.siteIdentity.serviceBullets,
            faqCandidates: preview.siteIdentity.faqCandidates,
          }}
          validatedContent={preview.siteIdentity.validatedContent ? {
            overview: preview.siteIdentity.validatedContent.overview,
            whatWeDo: preview.siteIdentity.validatedContent.whatWeDo,
            commonQuestions: preview.siteIdentity.validatedContent.commonQuestions,
            brandName: preview.siteIdentity.validatedContent.brandName,
          } : null}
          brandPreferences={brandPreferences}
          onSendMessage={async (message) => {
            if (!conversationTracked) {
              trackMetric('conversations');
              setConversationTracked(true);
            }
            const response = await fetch(`/api/previews/${preview.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message, previewAccessToken: preview.previewAccessToken }),
            });
            if (!response.ok) {
              return "Sorry, I couldn't process that request.";
            }
            const data = await response.json();
            if (data.capped) {
              return data.message || "Message limit reached. Claim this Orbit to continue chatting.";
            }
            return data.reply;
          }}
        />
      )}

      {!showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10 py-2 px-4">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <span className="text-xs text-white/60">
              Powered by <span className="text-pink-400 font-medium">NextMonth</span>
            </span>
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                className="bg-pink-500/90 hover:bg-pink-500 text-white text-xs px-3 py-1 h-7"
                onClick={() => setShowContactModal(true)}
                data-testid="button-contact-us"
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Contact Us
              </Button>
              {isOwner && (
                <Button 
                  size="sm"
                  variant="ghost"
                  className="text-zinc-400 hover:text-white text-xs px-3 py-1 h-7"
                  onClick={() => setLocation(`/orbit/${slug}/hub`)}
                  data-testid="button-view-hub"
                >
                  View Data Hub
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Public unclaimed CTA - only show to public viewers, never to admin */}
      {canSeeClaimCTA && !showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10 py-2 px-4">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-1">
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xs text-white/60">
                Powered by <span className="text-pink-400 font-medium">NextMonth</span>
              </span>
              <Button 
                size="sm"
                className="bg-pink-500/90 hover:bg-pink-500 text-white text-xs px-3 py-1 h-7"
                onClick={() => setShowClaimModal(true)}
                data-testid="button-claim-orbit"
              >
                Claim for free
              </Button>
            </div>
            <span className="text-[10px] text-zinc-500 text-center">
              This Orbit is in preview. The business owner hasn't activated it yet.
            </span>
          </div>
        </div>
      )}

      {/* First-run admin CTA - allow creators to verify ownership */}
      {isFirstRun && !showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-sm border-t border-pink-500/30 py-3 px-4">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm text-white font-medium">Your Orbit is ready!</span>
                <span className="text-xs text-zinc-300">Verify ownership to unlock all features</span>
              </div>
              <Button 
                size="sm"
                className="bg-white hover:bg-zinc-100 text-purple-900 font-medium text-xs px-4 py-2 h-8"
                onClick={() => setShowClaimModal(true)}
                data-testid="button-verify-ownership"
              >
                Verify Ownership
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showClaimModal} onOpenChange={(open) => {
        setShowClaimModal(open);
        if (!open) {
          setClaimStep('intro');
          setClaimStatus('idle');
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              {claimStatus === 'success' ? 'Orbit Claimed!' : 'Claim your business Orbit'}
              {claimStatus === 'idle' && claimStep === 'intro' && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">FREE</span>
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {claimStatus === 'verifying' 
                ? 'Verifying your claim...'
                : claimStatus === 'success'
                ? 'You now own this Orbit and can customize it.'
                : claimStep === 'intro'
                ? `Take control of how AI represents ${preview?.sourceDomain || slug}`
                : `Verify ownership of ${preview?.sourceDomain || slug}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {claimStep === 'intro' && claimStatus === 'idle' && (
              <>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300 font-medium">
                    Your Orbit is your AI-powered business presence
                  </p>
                  <p className="text-xs text-blue-400/80 mt-1">
                    When AI assistants search for businesses like yours, your Orbit ensures they get accurate, up-to-date information directly from you.
                  </p>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Claiming is free and unlocks:
                </p>
                <ul className="space-y-2.5 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-300">AI conversation assistant</span>
                      <span className="text-xs text-zinc-500 block">Answers visitor questions 24/7 using your business knowledge</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-300">Brand control & customization</span>
                      <span className="text-xs text-zinc-500 block">Edit responses, add FAQs, and set your brand voice</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-300">Lead capture & analytics</span>
                      <span className="text-xs text-zinc-500 block">See what questions visitors ask and capture their contact info</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-zinc-300">AI discovery protection</span>
                      <span className="text-xs text-zinc-500 block">Ensure AI search tools represent your business accurately</span>
                    </div>
                  </li>
                </ul>
                <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
                  Once verified, this Orbit is exclusively reserved for {preview?.sourceDomain || slug}.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-medium"
                    onClick={() => setClaimStep('verify')}
                    data-testid="button-verify-claim"
                  >
                    Claim for free
                  </Button>
                </div>
                <button 
                  className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400"
                  onClick={() => setShowClaimModal(false)}
                >
                  Learn more about Orbit
                </button>
              </>
            )}

            {claimStatus === 'verifying' && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
              </div>
            )}

            {claimStatus === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <CheckCircle className="w-12 h-12 text-green-400" />
                <p className="text-green-400 text-sm">{claimMessage}</p>
              </div>
            )}

            {claimStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{claimMessage}</p>
              </div>
            )}

            {claimStatus === 'sent' && (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Mail className="w-10 h-10 text-pink-400" />
                <p className="text-zinc-300 text-center text-sm">{claimMessage}</p>
                <p className="text-zinc-500 text-xs text-center">
                  Check your console for the magic link (email delivery coming soon).
                </p>
              </div>
            )}

            {claimStep === 'verify' && (claimStatus === 'idle' || claimStatus === 'sending') && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Your email address</label>
                  <Input
                    type="email"
                    placeholder={`you@${preview?.sourceDomain || 'example.com'}`}
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-claim-email"
                  />
                  <p className="text-xs text-zinc-500">
                    For instant verification, use an email @{preview?.sourceDomain || 'your domain'}.
                  </p>
                </div>
                <Button
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white"
                  onClick={handleClaimRequest}
                  disabled={!claimEmail || claimStatus === 'sending'}
                  data-testid="button-submit-claim"
                >
                  {claimStatus === 'sending' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Magic Link'
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Form Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {contactStatus === 'success' ? 'Message Sent!' : 'Get in Touch'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {contactStatus === 'success'
                ? 'Your message has been received.'
                : `Leave your details and we'll connect you with ${preview?.siteIdentity?.validatedContent?.brandName || preview?.siteTitle || 'this business'}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {contactStatus === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <CheckCircle className="w-12 h-12 text-green-400" />
                <p className="text-green-400 text-sm">Thanks for reaching out!</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setShowContactModal(false);
                    setContactStatus('idle');
                    setContactName('');
                    setContactEmail('');
                    setContactMessage('');
                  }}
                  data-testid="button-close-contact"
                >
                  Close
                </Button>
              </div>
            )}

            {contactStatus === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">Failed to send message. Please try again.</p>
              </div>
            )}

            {(contactStatus === 'idle' || contactStatus === 'sending' || contactStatus === 'error') && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Your name</label>
                  <Input
                    type="text"
                    placeholder="John Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Your email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="input-contact-email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Message (optional)</label>
                  <textarea
                    placeholder="How can we help you?"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm min-h-[80px] resize-none"
                    data-testid="input-contact-message"
                  />
                </div>
                <Button
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white"
                  onClick={async () => {
                    if (!contactName || !contactEmail) return;
                    setContactStatus('sending');
                    try {
                      const response = await fetch(`/api/orbit/${slug}/leads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: contactName,
                          email: contactEmail,
                          message: contactMessage || null,
                          source: 'orbit',
                        }),
                      });
                      if (!response.ok) throw new Error('Failed');
                      setContactStatus('success');
                    } catch {
                      setContactStatus('error');
                    }
                  }}
                  disabled={!contactName || !contactEmail || contactStatus === 'sending'}
                  data-testid="button-submit-contact"
                >
                  {contactStatus === 'sending' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
      </div>
    </div>
  );
}
