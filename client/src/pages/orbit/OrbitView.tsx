import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Globe, ExternalLink, AlertCircle, CheckCircle, Mail, MessageCircle, LayoutDashboard, Share2, FileText } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
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
import { OrbitShareModal } from "@/components/orbit/OrbitShareModal";
import { ViewWindscreen, MobileViewSheet } from "@/components/orbit/viewEngine/ViewWindscreen";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

import type { ViewPayload } from "@shared/orbitViewEngine";
import type { SiteKnowledge } from "@/lib/siteKnowledge";
import GlobalNav from "@/components/GlobalNav";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function AutoDismissEffect({ onDismiss, delayMs }: { onDismiss: () => void; delayMs: number }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, delayMs);
    return () => clearTimeout(timer);
  }, [onDismiss, delayMs]);
  return null;
}

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
  customLogo?: string | null;
  customAccent?: string | null;
  customTone?: string | null;
  lastUpdated?: string;
  previewId?: string | null;
  orbitType?: 'standard' | 'industry';
  boxes?: OrbitBox[];
  error?: string;
  requestedAt?: string;
}

interface IndustryKnowledgeResponse {
  orbitId: number;
  slug: string;
  type: 'industry';
  knowledge: SiteKnowledge;
}

export default function OrbitView() {
  const [matchedOrbit, orbitParams] = useRoute("/orbit/:slug");
  const [matchedO, oParams] = useRoute("/o/:slug");
  const [matchedClaim, claimParams] = useRoute("/orbit/:slug/claim");
  const slug = orbitParams?.slug || oParams?.slug || claimParams?.slug;
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  
  // Embed mode: hide nav/chrome when ?embed=true
  const isEmbedMode = searchString.includes('embed=true');
  
  // Preview mode: owner viewing as a visitor (hide all admin UI)
  const isPreviewMode = new URLSearchParams(searchString).get('preview') === 'true';
  
  const [showCustomization, setShowCustomization] = useState(false);
  const [brandPreferences, setBrandPreferences] = useState<BrandPreferences | null>(null);
  const [experienceType, setExperienceType] = useState<'radar' | 'spatial' | 'classic'>('radar');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
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
  const [hubPanel, setHubPanel] = useState<'overview' | 'grid' | 'ice' | 'brand' | 'settings' | 'conversations' | 'leads' | 'notifications' | 'data-sources' | 'cubes' | 'ai-discovery' | 'knowledge-coach'>('overview');
  
  // Industry Orbit: Launch directly into map view (instant launch)
  // Mobile shows a brief intro overlay that auto-dismisses
  const [showMobileIntro, setShowMobileIntro] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // View Engine state for industry orbits
  const [activeView, setActiveView] = useState<ViewPayload | null>(null);
  const [viewFollowups, setViewFollowups] = useState<string[]>([]);

  // Mobile detection - reactive to window resize
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setShowMobileIntro(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Conversation history for AI chat
  const chatHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  // Track when proof capture was triggered to prevent repeated prompts
  const proofCaptureTriggeredRef = useRef<string | null>(null);
  
  // Auth for ICE creation permissions
  const { user } = useAuth();
  const canCreateIce = user && (user.role === 'admin' || user.role === 'influencer' || user.isAdmin);
  
  // Map view types to valid ICE template types
  const mapViewTypeToTemplate = (viewType: string): string => {
    const mapping: Record<string, string> = {
      'compare': 'compare_ice',
      'shortlist': 'shortlist_ice',
      'checklist': 'buyer_checklist_ice',
      'pulse': 'weekly_pulse_ice',
    };
    return mapping[viewType] || 'custom';
  };
  
  // ICE creation callback for ViewWindscreen
  const handleCreateIceFromView = useCallback(async (view: ViewPayload) => {
    if (!slug || !canCreateIce) return;
    
    try {
      const draft = await api.createIceDraftFromOrbit(slug, {
        viewType: view.type,
        viewData: view.data,
        summaryText: view.title || 'View from Orbit',
        templateType: mapViewTypeToTemplate(view.type),
        title: view.title,
      });
      
      toast.success('ICE draft created', {
        description: 'Your content draft has been saved. Visit ICE Maker to customize and publish.',
      });
    } catch (error) {
      toast.error('Failed to create ICE draft', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  }, [slug, canCreateIce]);
  
  // ICE creation callback for ChatHub messages
  const handleCreateIceFromChat = useCallback(async (messageContent: string, _messageIndex: number) => {
    if (!slug || !canCreateIce) return;
    
    try {
      await api.createIceDraftFromOrbit(slug, {
        viewType: 'chat_response',
        summaryText: messageContent.substring(0, 500),
        templateType: 'custom',
        title: `Chat insight from ${slug}`,
      });
      
      toast.success('ICE draft created', {
        description: 'Your content draft has been saved. Visit ICE Maker to customize and publish.',
      });
    } catch (error) {
      toast.error('Failed to create ICE draft', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  }, [slug, canCreateIce]);

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

  // Import ChatResponse type from ChatHub - matches the expected interface
  type SuggestedVideo = { id: number; title: string; youtubeVideoId: string; thumbnailUrl: string | null; description: string | null };
  type ChatResponse = { text: string; video?: SuggestedVideo | null };

  // Shared chat handler for all RadarGrid instances
  const createChatHandler = (accessToken?: string, menuContext?: any) => {
    return async (message: string): Promise<ChatResponse> => {
      if (!conversationTracked) {
        trackMetric('conversations');
        setConversationTracked(true);
      }
      
      try {
        const response = await fetch(`/api/orbit/${slug}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message,
            accessToken,
            menuContext,
            history: chatHistoryRef.current,
            proofCaptureTriggeredAt: proofCaptureTriggeredRef.current,
          }),
        });
        
        // Handle non-OK HTTP responses first
        if (!response.ok) {
          try {
            const errorData = await response.json();
            // Check for capped responses (these may come with non-200 status)
            if (errorData.capped) {
              return { text: errorData.response || "Message limit reached.", video: null };
            }
            return { text: errorData.message || "Sorry, something went wrong. Please try again.", video: null };
          } catch {
            return { text: "Sorry, I couldn't process that request. Please try again.", video: null };
          }
        }
        
        const data = await response.json();
        
        // Handle capped responses (may come with 200 status)
        if (data.capped) {
          return {
            text: data.response || "Message limit reached. Upgrade to continue chatting.",
            video: null,
          };
        }
        
        // Validate we have a response
        if (!data.response) {
          return { text: "I'm here to help. What would you like to know?", video: null };
        }
        
        let assistantResponse = data.response;
        
        // Handle proof capture flow
        if (data.proofCaptureFlow?.triggered) {
          proofCaptureTriggeredRef.current = new Date().toISOString();
          const consentOptions = data.proofCaptureFlow.consentOptions || [];
          if (consentOptions.length > 0) {
            assistantResponse += `\n\nWould you be happy for us to use your comment as a testimonial?\n\n• ${consentOptions.join('\n• ')}`;
          }
        }
        
        // Suggestion chip nudge
        if (data.suggestionChip) {
          assistantResponse += `\n\n💬 By the way, if you'd like to leave a testimonial, just let me know!`;
        }
        
        // Update chat history after successful response
        chatHistoryRef.current.push({ role: 'user', content: message });
        chatHistoryRef.current.push({ role: 'assistant', content: assistantResponse });
        if (chatHistoryRef.current.length > 10) {
          chatHistoryRef.current = chatHistoryRef.current.slice(-10);
        }
        
        // Map server response to expected SuggestedVideo format
        let mappedVideo: SuggestedVideo | null = null;
        if (data.suggestedVideo) {
          mappedVideo = {
            id: data.suggestedVideo.id,
            title: data.suggestedVideo.title,
            youtubeVideoId: data.suggestedVideo.youtubeVideoId || data.suggestedVideo.youtubeId,
            thumbnailUrl: data.suggestedVideo.thumbnailUrl || null,
            description: data.suggestedVideo.description || null,
          };
        }
        
        return {
          text: assistantResponse,
          video: mappedVideo,
        };
      } catch (e) {
        console.error('Orbit chat error:', e);
        return { text: "Sorry, I couldn't process that request. Please try again.", video: null };
      }
    };
  };

  // View-enhanced chat handler for industry orbits
  const createIndustryViewChatHandler = () => {
    return async (message: string): Promise<ChatResponse> => {
      if (!conversationTracked) {
        trackMetric('conversations');
        setConversationTracked(true);
      }
      
      try {
        const response = await fetch(`/api/industry-orbits/${slug}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message,
            history: chatHistoryRef.current,
            category: industryFrontPage?.hero?.title || 'Smart Glasses',
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return { text: errorData.message || "Sorry, something went wrong.", video: null };
        }
        
        const data = await response.json();
        
        // Update view engine state based on response
        if (data.view) {
          setActiveView(data.view);
          setViewFollowups(data.followups || []);
        } else {
          // Clear stale view when response has no view payload
          setActiveView(null);
          setViewFollowups([]);
        }
        
        // Handle disambiguation as chip options
        let responseText = data.message;
        if (data.disambiguation) {
          responseText += `\n\n${data.disambiguation.question}\n`;
          data.disambiguation.options.forEach((opt: { label: string }) => {
            responseText += `• ${opt.label}\n`;
          });
        }
        
        // Update chat history
        chatHistoryRef.current.push({ role: 'user', content: message });
        chatHistoryRef.current.push({ role: 'assistant', content: responseText });
        if (chatHistoryRef.current.length > 10) {
          chatHistoryRef.current = chatHistoryRef.current.slice(-10);
        }
        
        return { text: responseText, video: null };
      } catch (e) {
        console.error('Industry orbit chat error:', e);
        return { text: "Sorry, I couldn't process that request.", video: null };
      }
    };
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

  const isIndustryOrbit = orbitData?.orbitType === 'industry';
  
  const { data: industryKnowledge, isLoading: industryKnowledgeLoading } = useQuery<IndustryKnowledgeResponse>({
    queryKey: ["industry-knowledge", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbits/${slug}/knowledge`);
      if (!response.ok) throw new Error("Failed to fetch industry knowledge");
      return response.json();
    },
    enabled: isIndustryOrbit && !!slug,
  });
  
  // Fetch industry orbit front-page data for landing view
  const { data: industryFrontPage } = useQuery({
    queryKey: ["industry-front-page", slug],
    queryFn: async () => {
      const response = await fetch(`/api/industry-orbits/${slug}/front-page`);
      if (!response.ok) throw new Error("Failed to fetch industry front page");
      return response.json();
    },
    enabled: isIndustryOrbit && !!slug,
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

  // Only show customization for first-run unclaimed orbits, not for owners viewing their orbit
  useEffect(() => {
    if (isFirstRun && isUnclaimed) {
      setShowCustomization(true);
    }
  }, [isFirstRun, isUnclaimed]);

  // Fetch hub analytics for owners
  const { data: hubData } = useQuery<{
    activity: { visits: number; interactions: number; conversations: number; iceViews: number };
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

  // No longer auto-redirect owners to hub - they can access Launchpad from nav
  // Owners now see the same public orbit view as visitors

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
    onSuccess: (data) => {
      setClaimStatus('success');
      setClaimMessage('You\'ve successfully claimed this orbit! Redirecting to your hub...');
      refetch();
      setTimeout(() => {
        setShowClaimModal(false);
        setLocation(data.redirectUrl || `/orbit/${slug}/hub`);
      }, 1500);
    },
    onError: (error: Error) => {
      setClaimStatus('error');
      setClaimMessage(error.message);
    },
  });
  
  // State for Priority Setup form (moved here to comply with Rules of Hooks)
  const [showPrioritySetup, setShowPrioritySetup] = useState(false);
  const [priorityForm, setPriorityForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [priorityStatus, setPriorityStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  
  const submitPrioritySetup = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; notes: string }) => {
      const response = await fetch(`/api/orbit/${slug}/priority-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit');
      return response.json();
    },
    onSuccess: () => setPriorityStatus('sent'),
    onError: () => setPriorityStatus('error'),
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

  // Reset brand preferences when slug changes (navigating between orbits)
  useEffect(() => {
    setBrandPreferences(null);
  }, [slug]);

  // Hydrate brand preferences from saved orbit data
  useEffect(() => {
    if (orbitData && orbitData.businessSlug === slug && !brandPreferences) {
      const savedPrefs: BrandPreferences = {
        accentColor: orbitData.customAccent || '#3b82f6',
        selectedLogo: orbitData.customLogo || null,
        theme: 'dark',
        selectedImages: [],
      };
      
      // Parse customTone for theme and selectedImages
      if (orbitData.customTone) {
        try {
          const toneData = JSON.parse(orbitData.customTone);
          if (toneData.theme) savedPrefs.theme = toneData.theme;
          if (toneData.selectedImages) savedPrefs.selectedImages = toneData.selectedImages;
        } catch {
          // customTone is not JSON, ignore
        }
      }
      
      // Only set if we have meaningful saved preferences
      if (orbitData.customAccent || orbitData.customLogo || orbitData.customTone) {
        setBrandPreferences(savedPrefs);
      }
    }
  }, [orbitData, slug, brandPreferences]);

  const handleClaimRequest = () => {
    if (!claimEmail) return;
    setClaimStatus('sending');
    requestClaimMutation.mutate(claimEmail);
  };

  const handleCustomizationConfirm = async (prefs: BrandPreferences, expType?: 'radar' | 'spatial' | 'classic') => {
    setBrandPreferences(prefs);
    if (expType) setExperienceType(expType);
    setShowCustomization(false);
    
    // Persist brand preferences to database if user is owner
    if (slug && orbitData?.isOwner) {
      try {
        await fetch(`/api/orbit/${slug}/brand`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            customLogo: prefs.selectedLogo,
            customAccent: prefs.accentColor,
            customTone: JSON.stringify({ theme: prefs.theme, selectedImages: prefs.selectedImages }),
          }),
        });
      } catch (err) {
        console.error('Failed to save brand preferences:', err);
      }
    }
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
        url: boxes.find(b => b.category === cat)?.sourceUrl || undefined,
        summary: `${boxes.filter(b => b.category === cat).length} ${cat.toLowerCase()} available`,
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

  // Industry Orbit: Launch directly into the Orbit UI (instant launch)
  if (isIndustryOrbit && industryFrontPage) {
    const knowledge = industryKnowledge?.knowledge;
    const accentColor = knowledge?.brand?.primaryColor || '#ec4899';
    const title = industryFrontPage.hero?.title || 'Industry Orbit';
    const subtitle = 'The living map of the companies, products, and ideas shaping wearable computing.';
    
    // Map view - radar grid with chat + view engine windscreen (launches immediately)
    if (knowledge) {
      const handleAskAboutRow = (query: string) => {
        createIndustryViewChatHandler()(query);
      };
      
      const handleFollowupClick = (followup: string) => {
        createIndustryViewChatHandler()(followup);
      };
      
      return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col relative">
          {/* Minimal Premium Header */}
          {!isEmbedMode && (
            <header className="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {industryFrontPage.hero?.heroImageUrl && (
                      <img 
                        src={industryFrontPage.hero.heroImageUrl} 
                        alt={title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-semibold tracking-tight text-white">
                        {title}
                      </h1>
                      <p className="text-xs text-white/40 hidden sm:block">
                        {industryFrontPage.hero.entityCount} brands · {industryFrontPage.hero.productCount} products
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/50 hover:text-white"
                    onClick={() => setShowShareModal(true)}
                    data-testid="button-share-orbit"
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </header>
          )}
          
          {/* Mobile Intro Overlay - auto-dismisses after 2 seconds */}
          {showMobileIntro && isMobile && (
            <div 
              className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col items-center justify-center p-6"
              onClick={() => setShowMobileIntro(false)}
              onTouchStart={() => setShowMobileIntro(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-sm"
              >
                {industryFrontPage.hero?.heroImageUrl && (
                  <motion.img 
                    src={industryFrontPage.hero.heroImageUrl} 
                    alt={title}
                    className="w-16 h-16 rounded-2xl object-cover mx-auto mb-6"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  />
                )}
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                  {title}
                </h1>
                <p className="text-base text-white/50 leading-relaxed mb-8">
                  {subtitle}
                </p>
                <p className="text-xs text-white/30 animate-pulse">
                  Tap to start a conversation
                </p>
              </motion.div>
            </div>
          )}
          
          {/* Auto-dismiss mobile intro after 2 seconds */}
          {showMobileIntro && isMobile && (
            <AutoDismissEffect onDismiss={() => setShowMobileIntro(false)} delayMs={2000} />
          )}
          
          {/* Main Orbit UI */}
          <div className={`flex-1 ${activeView && !isMobile ? 'mr-[420px]' : ''}`}>
            <RadarGrid
              knowledge={knowledge}
              accentColor={accentColor}
              lightMode={false}
              onInteraction={() => trackMetric('interactions')}
              orbitSlug={slug}
              onSendMessage={createIndustryViewChatHandler()}
              onCreateIce={handleCreateIceFromChat}
              canCreateIce={!!canCreateIce}
            />
          </div>
          
          {/* Desktop Windscreen - right side pane */}
          {activeView && !isMobile && (
            <ViewWindscreen
              view={activeView}
              followups={viewFollowups}
              onClose={() => setActiveView(null)}
              onAskAbout={handleAskAboutRow}
              onFollowupClick={handleFollowupClick}
              onCreateIce={handleCreateIceFromView}
              canCreateIce={!!canCreateIce}
            />
          )}
          
          {/* Mobile View Sheet - full screen overlay */}
          {activeView && isMobile && (
            <MobileViewSheet
              view={activeView}
              followups={viewFollowups}
              onClose={() => setActiveView(null)}
              onAskAbout={handleAskAboutRow}
              onFollowupClick={handleFollowupClick}
              onCreateIce={handleCreateIceFromView}
              canCreateIce={!!canCreateIce}
            />
          )}
          
          {/* Share Modal */}
          <OrbitShareModal
            open={showShareModal}
            onClose={() => setShowShareModal(false)}
            businessSlug={slug || ''}
            brandName={title}
          />
        </div>
      );
    }
  }
  
  // Calm, neutral loading state for industry orbits
  if (isIndustryOrbit && industryKnowledgeLoading) {
    const title = industryFrontPage?.hero?.title || 'Smart Glasses';
    const subtitle = 'The living map of the companies, products, and ideas shaping wearable computing.';
    
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-3">
            {title}
          </h1>
          <p className="text-sm text-white/50 mb-8">
            {subtitle}
          </p>
          <Loader2 className="w-5 h-5 animate-spin text-white/40 mx-auto" />
        </motion.div>
      </div>
    );
  }

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
        {!isEmbedMode && (
          <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" />
        )}
        <div className="flex-1">
          {!isEmbedMode && showCustomization ? (
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
              orbitSlug={slug}
              onVideoEvent={async (videoId, event, msWatched) => {
                try {
                  await fetch(`/api/orbit/${slug}/videos/${videoId}/event`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventType: event, msWatched }),
                  });
                } catch (e) {
                  console.error('Failed to track video event:', e);
                }
              }}
              onSendMessage={createChatHandler(undefined, menuContext)}
              onCreateIce={handleCreateIceFromChat}
              canCreateIce={!!canCreateIce}
            />
          )}
        </div>
        {/* Public unclaimed CTA - only show to public viewers */}
        {!isEmbedMode && !showCustomization && isUnclaimed && canSeeClaimCTA && (
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
        
        {/* First-run admin CTA - allow creators to verify ownership after preview (only if unclaimed) */}
        {!isEmbedMode && !showCustomization && isFirstRun && isUnclaimed && (
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
        
        {/* Owner CTA - show manage button for free tier owners who have already claimed */}
        {!isEmbedMode && !showCustomization && isOwner && !isUnclaimed && !isPaidTier && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-sm border-t border-pink-500/30 py-3 px-4">
            <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
              <div className="w-full flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm text-white font-medium">Welcome back!</span>
                  <span className="text-xs text-zinc-300">Manage your Orbit and view analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs px-3 py-2 h-8"
                    onClick={() => setShowShareModal(true)}
                    data-testid="button-share-orbit-free"
                  >
                    <Share2 className="w-3 h-3 mr-1" />
                    Share
                  </Button>
                  <Button 
                    size="sm"
                    className="bg-white hover:bg-zinc-100 text-purple-900 font-medium text-xs px-4 py-2 h-8"
                    onClick={() => setLocation(`/orbit/${slug}/hub`)}
                    data-testid="button-manage-orbit"
                  >
                    Manage Your Orbit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paid tier footer - no branding, brand-colored contact button */}
        {!isEmbedMode && !showCustomization && isPaidTier && !isUnclaimed && !isFirstRun && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10 py-2 px-4">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
              {/* Left side - owner controls */}
              <div className="flex items-center gap-2">
                {isOwner && (
                  <>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs px-3 py-1 h-7"
                      onClick={() => setShowShareModal(true)}
                      data-testid="button-share-orbit"
                    >
                      <Share2 className="w-3 h-3 mr-1" />
                      Share
                    </Button>
                    {!isPreviewMode && (
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
                  </>
                )}
              </div>
              {/* Right side - public contact */}
              <Button 
                size="sm"
                className="text-white text-xs px-3 py-1 h-7"
                style={{ 
                  backgroundColor: accentColor || '#ec4899',
                  opacity: 0.9
                }}
                onClick={() => setShowContactModal(true)}
                data-testid="button-contact-us"
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Contact Us
              </Button>
            </div>
          </div>
        )}
        
        {/* Claim Modal for boxes view */}
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
                  <Button
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium"
                    onClick={() => setClaimStep('verify')}
                    data-testid="button-verify-claim"
                  >
                    Claim for free
                  </Button>
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
                    data-testid="button-send-verification"
                  >
                    {claimStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send verification email'
                    )}
                  </Button>
                  <button 
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400"
                    onClick={() => setClaimStep('intro')}
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  const generationStatus = viewerContext?.generationStatus;
  const isBlocked = generationStatus === 'blocked';
  
  if (!preview?.siteIdentity) {
    // If the site was blocked (bot protection), show helpful options
    if (isBlocked) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <Globe className="h-8 w-8 text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-zinc-100">Website Uses Bot Protection</h1>
              <p className="text-zinc-400">
                This website blocks automated access. Choose how you'd like to proceed:
              </p>
            </div>
            
            {!showPrioritySetup ? (
              <div className="space-y-4 pt-4">
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => window.location.href = `/orbit/${slug}/import`}
                  data-testid="button-manual-import"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Add Content Myself
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-black px-2 text-zinc-500">or</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline"
                  className="w-full border-pink-500/50 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300"
                  onClick={() => setShowPrioritySetup(true)}
                  data-testid="button-priority-setup"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Priority Setup Service
                </Button>
                <p className="text-xs text-zinc-500">
                  We'll set up your Orbit for you within 24 hours
                </p>
              </div>
            ) : priorityStatus === 'sent' ? (
              <div className="space-y-4 pt-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <h2 className="text-lg font-medium text-zinc-100">Request Received!</h2>
                <p className="text-zinc-400 text-sm">
                  We'll be in touch within 24 hours to set up your Orbit.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <h2 className="text-lg font-medium text-zinc-100 text-left">Priority Setup Request</h2>
                <p className="text-sm text-zinc-400 text-left">
                  Share your details and we'll build your Orbit for you.
                </p>
                <div className="space-y-3">
                  <Input
                    placeholder="Your name"
                    value={priorityForm.name}
                    onChange={(e) => setPriorityForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700"
                    data-testid="input-priority-name"
                  />
                  <Input
                    placeholder="Email address"
                    type="email"
                    value={priorityForm.email}
                    onChange={(e) => setPriorityForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700"
                    data-testid="input-priority-email"
                  />
                  <Input
                    placeholder="Phone (optional)"
                    type="tel"
                    value={priorityForm.phone}
                    onChange={(e) => setPriorityForm(f => ({ ...f, phone: e.target.value }))}
                    className="bg-zinc-900 border-zinc-700"
                    data-testid="input-priority-phone"
                  />
                  <textarea
                    placeholder="Tell us about your business..."
                    value={priorityForm.notes}
                    onChange={(e) => setPriorityForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-24 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-sm resize-none"
                    data-testid="input-priority-notes"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 text-zinc-400"
                    onClick={() => setShowPrioritySetup(false)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-pink-600 hover:bg-pink-700"
                    onClick={() => {
                      setPriorityStatus('sending');
                      submitPrioritySetup.mutate(priorityForm);
                    }}
                    disabled={!priorityForm.name || !priorityForm.email || priorityStatus === 'sending'}
                    data-testid="button-submit-priority"
                  >
                    {priorityStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Request Setup'
                    )}
                  </Button>
                </div>
                {priorityStatus === 'error' && (
                  <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    
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
      {!isEmbedMode && (
        <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" minimal={showHub} />
      )}
      <div className="flex-1 flex relative">
      {/* Business Hub Sidebar for paid tier owners */}
      {!isEmbedMode && isOwner && isPaidTier && showHub && (
        <BusinessHubSidebar
          isOwner={true}
          planTier={planTier}
          businessSlug={slug || ''}
          activePanel={hubPanel}
          onPanelChange={setHubPanel}
          onClose={() => setShowHub(false)}
          analytics={hubData?.activity ? {
            visits: hubData.activity.visits,
            interactions: hubData.activity.interactions,
            conversations: hubData.activity.conversations,
            leads: hubData.leads?.count || 0,
          } : undefined}
        />
      )}

      {/* Hub toggle button for paid tier owners (hidden in preview mode) */}
      {!isEmbedMode && !isPreviewMode && isOwner && isPaidTier && !showHub && !showCustomization && (
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
      
      {/* Free tier owner - show upgrade prompt (hidden in preview mode) */}
      {!isEmbedMode && !isPreviewMode && isOwner && !isPaidTier && !showCustomization && (
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
      {!isEmbedMode && isOwner && isPaidTier && showHub && (
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

      {!showCustomization && experienceType === 'radar' && slug && (
        <RadarGrid
          knowledge={generateSiteKnowledge(preview)}
          accentColor={brandPreferences?.accentColor || preview.siteIdentity.primaryColour || '#3b82f6'}
          lightMode={brandPreferences?.theme === 'light'}
          onInteraction={() => trackMetric('interactions')}
          orbitSlug={slug}
          onVideoEvent={async (videoId, event, msWatched) => {
            try {
              await fetch(`/api/orbit/${slug}/videos/${videoId}/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType: event, msWatched }),
              });
            } catch (e) {
              console.error('Failed to track video event:', e);
            }
          }}
          onSendMessage={createChatHandler(preview.previewAccessToken)}
          onCreateIce={handleCreateIceFromChat}
          canCreateIce={!!canCreateIce}
        />
      )}

      {!showCustomization && experienceType === 'spatial' && slug && (
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
            // Use unified orbit chat endpoint with access token
            try {
              const response = await fetch(`/api/orbit/${slug}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  message, 
                  accessToken: preview.previewAccessToken,
                  history: chatHistoryRef.current,
                }),
              });
              const data = await response.json();
              if (data.capped) {
                return data.response || "Message limit reached. Claim this Orbit to continue chatting.";
              }
              if (response.ok && data.response) {
                // Update chat history
                chatHistoryRef.current.push({ role: 'user', content: message });
                chatHistoryRef.current.push({ role: 'assistant', content: data.response });
                if (chatHistoryRef.current.length > 10) {
                  chatHistoryRef.current = chatHistoryRef.current.slice(-10);
                }
                return data.response;
              }
            } catch (e) {
              console.error('Spatial chat error:', e);
            }
            return "Sorry, I couldn't process that request.";
          }}
        />
      )}

      {!showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10 py-2 px-4">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            {/* Hide branding for paid tier users */}
            {!isPaidTier && (
              <span className="text-xs text-white/60">
                Powered by <span className="text-pink-400 font-medium">NextMonth</span>
              </span>
            )}
            {isPaidTier && <span />}
            <div className="flex items-center gap-2">
              <Button 
                size="sm"
                className="text-white text-xs px-3 py-1 h-7"
                style={{ 
                  backgroundColor: brandPreferences?.accentColor || preview?.siteIdentity?.primaryColour || '#ec4899',
                  opacity: 0.9
                }}
                onClick={() => setShowContactModal(true)}
                data-testid="button-contact-us"
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Contact Us
              </Button>
              {isOwner && !isPreviewMode && (
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
      {!isEmbedMode && canSeeClaimCTA && !showCustomization && (
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

      {/* First-run admin CTA - allow creators to verify ownership (only if unclaimed) */}
      {!isEmbedMode && isFirstRun && isUnclaimed && !showCustomization && (
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
      
      {/* Owner CTA - show manage button for claimed orbit owners */}
      {!isEmbedMode && isOwner && !isUnclaimed && !isPaidTier && !showCustomization && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-sm border-t border-pink-500/30 py-3 px-4">
          <div className="max-w-lg mx-auto flex flex-col items-center gap-2">
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm text-white font-medium">Welcome back!</span>
                <span className="text-xs text-zinc-300">Manage your Orbit and view analytics</span>
              </div>
              <Button 
                size="sm"
                className="bg-white hover:bg-zinc-100 text-purple-900 font-medium text-xs px-4 py-2 h-8"
                onClick={() => setLocation(`/orbit/${slug}/hub`)}
                data-testid="button-manage-orbit"
              >
                Manage Your Orbit
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
                <Button
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium"
                  onClick={() => setClaimStep('verify')}
                  data-testid="button-verify-claim"
                >
                  Claim for free
                </Button>
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

      {/* Share Modal */}
      <OrbitShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        businessSlug={slug || ''}
        brandName={preview?.siteIdentity?.validatedContent?.brandName || preview?.siteTitle || undefined}
      />
      </div>
      </div>
    </div>
  );
}
