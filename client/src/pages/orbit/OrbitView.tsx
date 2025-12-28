import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Globe, ExternalLink, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadarGrid } from "@/components/radar";
import { SpatialSmartSite } from "@/components/spatial";
import { BrandCustomizationScreen, type BrandPreferences } from "@/components/preview/BrandCustomizationScreen";
import type { SiteKnowledge } from "@/lib/siteKnowledge";

interface ValidatedContent {
  overview: string;
  whatWeDo: string[];
  commonQuestions: { question: string; contextPrompt: string }[];
  brandName: string;
  passed: boolean;
  issues: string[];
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
}

interface OrbitResponse {
  status: "ready" | "generating" | "failed" | "idle";
  businessSlug: string;
  ownerId?: number | null;
  lastUpdated?: string;
  previewId?: string | null;
  error?: string;
  requestedAt?: string;
}

export default function OrbitView() {
  const [, params] = useRoute("/orbit/:slug");
  const slug = params?.slug;
  
  const [showCustomization, setShowCustomization] = useState(true);
  const [brandPreferences, setBrandPreferences] = useState<BrandPreferences | null>(null);
  const [experienceType, setExperienceType] = useState<'radar' | 'spatial' | 'classic'>('radar');

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

  const isUnclaimed = !orbitData?.ownerId;

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
      ...(siteIdentity?.serviceBullets || []).slice(0, 6).map((bullet, i) => ({
        id: `t_${i}`,
        label: bullet.length > 40 ? bullet.slice(0, 40) + '...' : bullet,
        keywords: bullet.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'topic' as const,
        summary: bullet,
        imageUrl: imagePool[i % imagePool.length],
      })),
      ...(validatedContent?.whatWeDo || []).slice(0, 4).map((item, i) => ({
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
      ...(siteIdentity?.serviceHeadings || []).slice(0, 5).map((heading, i) => ({
        id: `p_${i + 1}`,
        title: heading,
        url: preview.sourceUrl,
        summary: `Learn more about ${heading}`,
        keywords: heading.toLowerCase().split(/\s+/),
        type: 'page' as const,
        imageUrl: imagePool[(i + 1) % imagePool.length],
      })),
    ];

    const proof = (validatedContent?.commonQuestions || siteIdentity?.faqCandidates || []).slice(0, 4).map((faq, i) => {
      const question = typeof faq === 'string' ? faq : faq.question;
      return {
        id: `pr_${i}`,
        label: question.length > 50 ? question.slice(0, 50) + '...' : question,
        summary: question,
        keywords: question.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'proof' as const,
        imageUrl: imagePool[(i + 3) % imagePool.length],
      };
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
      people: [],
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
      socials: [],
    };
  };

  if (orbitLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-spinner" />
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
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-pink-400 mx-auto animate-spin" />
          <h1 className="text-xl font-semibold text-zinc-100">Generating Orbit...</h1>
          <p className="text-zinc-400">This usually takes about 30 seconds</p>
          {orbitData.requestedAt && (
            <p className="text-xs text-zinc-500">
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      {showCustomization && (
        <BrandCustomizationScreen
          logoUrl={preview.siteIdentity.logoUrl}
          faviconUrl={preview.siteIdentity.faviconUrl}
          brandName={preview.siteIdentity.validatedContent?.brandName || preview.siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || preview.sourceDomain}
          defaultAccentColor={preview.siteIdentity.primaryColour || '#ffffff'}
          imagePool={preview.siteIdentity.imagePool || []}
          onConfirm={handleCustomizationConfirm}
        />
      )}

      {!showCustomization && experienceType === 'radar' && (
        <RadarGrid
          knowledge={generateSiteKnowledge(preview)}
          accentColor={brandPreferences?.accentColor || preview.siteIdentity.primaryColour || '#3b82f6'}
          onSendMessage={async (message) => {
            if (isUnclaimed) {
              return "This orbit hasn't been claimed yet. The business owner can claim it to enable full chat features.";
            }
            const response = await fetch(`/api/previews/${preview.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message }),
            });
            if (!response.ok) {
              return "Sorry, I couldn't process that request.";
            }
            const data = await response.json();
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
            if (isUnclaimed) {
              return "This orbit hasn't been claimed yet. The business owner can claim it to enable full chat features.";
            }
            const response = await fetch(`/api/previews/${preview.id}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message }),
            });
            if (!response.ok) {
              return "Sorry, I couldn't process that request.";
            }
            const data = await response.json();
            return data.reply;
          }}
        />
      )}

      {isUnclaimed && !showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pb-6">
          <div className="max-w-md mx-auto text-center">
            <p className="text-sm text-white/80 mb-3">
              Is this your business? <span className="text-pink-400 font-medium">Take control and unlock the full experience</span>
            </p>
            <Button 
              className="bg-pink-500 hover:bg-pink-600 text-white px-6"
              onClick={() => window.location.href = `/for/brands?claim=${slug}`}
              data-testid="button-claim-orbit"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Claim This Orbit
            </Button>
            <p className="text-xs text-white/50 mt-2">
              Powered by <span className="text-pink-400">NextMonth</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
