import { type ComponentType, Fragment } from "react";
import { Building2, Globe, Loader2, AlertCircle, ClipboardPaste, FileSpreadsheet, Link2, Shield, UtensilsCrossed, ShoppingCart, Briefcase, BookOpen, FileText, MapPin, Sparkles, ArrowLeft, Check, ArrowRight, X, Clock, Zap, Upload, ExternalLink, Code, FileCode, ChevronRight, Mail, CheckCircle, Headphones } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import OrbitLayout from "@/components/OrbitLayout";
import { Link, useLocation } from "wouter";
import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { SiteIngestionLoader } from "@/components/preview/SiteIngestionLoader";

type ExtractionIntent = 'menu' | 'catalogue' | 'service' | 'case_studies' | 'content' | 'locations';
type ExtractionIntentOrNull = ExtractionIntent | null;

interface PriorityOption {
  id: ExtractionIntent;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: 'hospitality' | 'ecommerce' | 'service' | 'all';
}

const priorityOptions: PriorityOption[] = [
  {
    id: 'menu',
    title: 'Menu & pricing',
    description: 'What you sell, organised into clear sections',
    icon: UtensilsCrossed,
    recommended: 'hospitality',
  },
  {
    id: 'catalogue',
    title: 'Products & shop items',
    description: 'Individual products, variations and details',
    icon: ShoppingCart,
    recommended: 'ecommerce',
  },
  {
    id: 'service',
    title: 'Services & capabilities',
    description: 'What you do, who it\'s for, and how it helps',
    icon: Briefcase,
    recommended: 'service',
  },
  {
    id: 'case_studies',
    title: 'Case studies & work',
    description: 'Examples, projects and results',
    icon: BookOpen,
  },
  {
    id: 'content',
    title: 'Articles & resources',
    description: 'Blogs, guides and helpful content',
    icon: FileText,
  },
  {
    id: 'locations',
    title: 'Locations & contact',
    description: 'Where you operate and how to get in touch',
    icon: MapPin,
  },
];

interface OrbitGenerateResponse {
  success: boolean;
  businessSlug: string;
  previewId?: string;
  status: string;
  brandName?: string;
  message?: string;
  crawlStatus?: 'ok' | 'blocked' | 'not_found' | 'server_error' | 'timeout' | 'no_content';
  showImportOptions?: boolean;
  importOptions?: string[];
}

export default function OrbitClaim() {
  const [, setLocation] = useLocation();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [brandName, setBrandName] = useState<string | undefined>();
  const [blockedData, setBlockedData] = useState<OrbitGenerateResponse | null>(null);
  const [showClassification, setShowClassification] = useState(false);
  const [validatedUrl, setValidatedUrl] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<ExtractionIntent[]>([]);
  
  // Quick Setup wizard state
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickSetupStep, setQuickSetupStep] = useState(1);
  const [quickSetupData, setQuickSetupData] = useState({
    aboutUrl: '',
    aboutText: '',
    aboutMode: 'url' as 'url' | 'text',
    servicesUrl: '',
    servicesText: '',
    servicesMode: 'url' as 'url' | 'text',
    faqUrl: '',
    faqText: '',
    faqMode: 'url' as 'url' | 'text',
    homepage: '',
    socialLinkedIn: '',
    socialInstagram: '',
    socialFacebook: '',
    socialTikTok: '',
    prioritizeSocials: true,
  });
  const [tryAnotherUrl, setTryAnotherUrl] = useState("");
  const [tryAnotherError, setTryAnotherError] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [powerUpResult, setPowerUpResult] = useState<{ planTier: string; strengthScore: number } | null>(null);
  const [powerUpError, setPowerUpError] = useState("");
  
  // Priority Setup (white glove service) state
  const [showPrioritySetup, setShowPrioritySetup] = useState(false);
  const [priorityForm, setPriorityForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [priorityStatus, setPriorityStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const MAX_SELECTIONS = 3;

  const togglePriority = useCallback((id: ExtractionIntent) => {
    setSelectedPriorities(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }
      if (prev.length >= MAX_SELECTIONS) {
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const getRecommendedType = useCallback((): 'hospitality' | 'ecommerce' | 'service' | null => {
    if (!validatedUrl) return null;
    const url = validatedUrl.toLowerCase();
    if (url.includes('restaurant') || url.includes('cafe') || url.includes('bar') || url.includes('food') || url.includes('menu')) {
      return 'hospitality';
    }
    if (url.includes('shop') || url.includes('store') || url.includes('buy') || url.includes('product')) {
      return 'ecommerce';
    }
    if (url.includes('consulting') || url.includes('agency') || url.includes('service') || url.includes('solutions')) {
      return 'service';
    }
    return null;
  }, [validatedUrl]);

  const analyzeWebsiteMutation = useMutation({
    mutationFn: async ({ url, extractionIntent, extractionPriorities }: { 
      url: string; 
      extractionIntent: ExtractionIntentOrNull;
      extractionPriorities?: ExtractionIntent[];
    }): Promise<OrbitGenerateResponse> => {
      const response = await fetch('/api/orbit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          extractionIntent,
          extractionPriorities: extractionPriorities || (extractionIntent ? [extractionIntent] : [])
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze website');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.brandName) {
        setBrandName(data.brandName);
      }
      
      if (data.showImportOptions || data.crawlStatus === 'blocked') {
        setBlockedData(data);
        return;
      }
      
      if (data.businessSlug) {
        setTimeout(() => {
          setLocation(`/orbit/${data.businessSlug}`);
        }, 1500);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Priority Setup (white glove service) mutation
  const submitPrioritySetup = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; notes: string }) => {
      const businessSlug = blockedData?.businessSlug;
      if (!businessSlug) throw new Error('No business slug');
      const response = await fetch(`/api/orbit/${businessSlug}/priority-setup`, {
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

  const handleContinue = () => {
    setError("");
    setBlockedData(null);
    
    if (!websiteUrl.trim()) {
      setError("Please enter your website URL");
      return;
    }

    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const parsedUrl = new URL(url);
      setBrandName(parsedUrl.hostname.replace('www.', ''));
      setValidatedUrl(url);
      setShowClassification(true);
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const handleStartExtraction = (extractionPriorities: ExtractionIntent[]) => {
    if (!validatedUrl) {
      setError("Please enter a valid URL first");
      return;
    }
    setShowClassification(false);
    const primaryIntent = extractionPriorities.length > 0 ? extractionPriorities[0] : null;
    analyzeWebsiteMutation.mutate({ 
      url: validatedUrl, 
      extractionIntent: primaryIntent,
      extractionPriorities: extractionPriorities
    });
  };

  const handleContinueWithSelection = () => {
    if (selectedPriorities.length === 0) return;
    handleStartExtraction(selectedPriorities);
  };

  const handleLetOrbitDecide = () => {
    handleStartExtraction([]);
  };

  const handleTryAnotherPage = async () => {
    if (!tryAnotherUrl.trim()) {
      setTryAnotherError("Please enter a URL");
      return;
    }
    
    let url = tryAnotherUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      new URL(url);
    } catch {
      setTryAnotherError("Please enter a valid URL");
      return;
    }
    
    setTryAnotherError("");
    setBlockedData(null);
    setValidatedUrl(url);
    setShowClassification(true);
  };

  const handleQuickSetupSubmit = async () => {
    // Validate at least one source is provided
    const hasAbout = quickSetupData.aboutMode === 'url' ? quickSetupData.aboutUrl.trim() : quickSetupData.aboutText.trim();
    const hasServices = quickSetupData.servicesMode === 'url' ? quickSetupData.servicesUrl.trim() : quickSetupData.servicesText.trim();
    const hasFaq = quickSetupData.faqMode === 'url' ? quickSetupData.faqUrl.trim() : quickSetupData.faqText.trim();
    
    if (!hasAbout && !hasServices && !hasFaq) {
      setPowerUpError("Please provide at least one source");
      return;
    }
    
    setIsBuilding(true);
    setPowerUpError("");
    
    try {
      // Collect all sources in the format expected by the API
      const sources: Array<{ label: string; sourceType: string; value: string }> = [];
      
      if (hasAbout) {
        sources.push({
          label: 'about',
          sourceType: quickSetupData.aboutMode === 'url' ? 'page_url' : 'page_text',
          value: quickSetupData.aboutMode === 'url' ? quickSetupData.aboutUrl : quickSetupData.aboutText,
        });
      }
      if (hasServices) {
        sources.push({
          label: 'services',
          sourceType: quickSetupData.servicesMode === 'url' ? 'page_url' : 'page_text',
          value: quickSetupData.servicesMode === 'url' ? quickSetupData.servicesUrl : quickSetupData.servicesText,
        });
      }
      if (hasFaq) {
        sources.push({
          label: 'faq',
          sourceType: quickSetupData.faqMode === 'url' ? 'page_url' : 'page_text',
          value: quickSetupData.faqMode === 'url' ? quickSetupData.faqUrl : quickSetupData.faqText,
        });
      }
      
      // Add social links if provided
      if (quickSetupData.socialLinkedIn.trim()) {
        sources.push({ label: 'linkedin', sourceType: 'social_link', value: quickSetupData.socialLinkedIn.trim() });
      }
      if (quickSetupData.socialInstagram.trim()) {
        sources.push({ label: 'instagram', sourceType: 'social_link', value: quickSetupData.socialInstagram.trim() });
      }
      if (quickSetupData.socialFacebook.trim()) {
        sources.push({ label: 'facebook', sourceType: 'social_link', value: quickSetupData.socialFacebook.trim() });
      }
      if (quickSetupData.socialTikTok.trim()) {
        sources.push({ label: 'tiktok', sourceType: 'social_link', value: quickSetupData.socialTikTok.trim() });
      }
      if (quickSetupData.homepage.trim()) {
        sources.push({ label: 'homepage', sourceType: 'page_url', value: quickSetupData.homepage.trim() });
      }
      
      // Call the real backend endpoint
      const response = await fetch(`/api/orbit/${blockedData?.businessSlug}/ingest-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sources }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to power up orbit');
      }
      
      const result = await response.json();
      
      // Show success screen
      setPowerUpResult({
        planTier: result.orbit.planTier,
        strengthScore: result.orbit.strengthScore,
      });
      setQuickSetupStep(3); // Move to success step
      setIsBuilding(false);
    } catch (err) {
      setIsBuilding(false);
      setPowerUpError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      console.error('Quick setup failed:', err);
    }
  };

  const quickSetupHasContent = () => {
    const hasAbout = quickSetupData.aboutMode === 'url' ? quickSetupData.aboutUrl.trim() : quickSetupData.aboutText.trim();
    const hasServices = quickSetupData.servicesMode === 'url' ? quickSetupData.servicesUrl.trim() : quickSetupData.servicesText.trim();
    const hasFaq = quickSetupData.faqMode === 'url' ? quickSetupData.faqUrl.trim() : quickSetupData.faqText.trim();
    return !!(hasAbout || hasServices || hasFaq);
  };

  const isLoading = analyzeWebsiteMutation.isPending;
  const isComplete = analyzeWebsiteMutation.isSuccess && !blockedData;

  if (isLoading || isComplete) {
    return (
      <SiteIngestionLoader
        brandName={brandName}
        accentColor="#3b82f6"
        isComplete={isComplete}
        onReady={() => {
          if (analyzeWebsiteMutation.data?.businessSlug) {
            setLocation(`/orbit/${analyzeWebsiteMutation.data.businessSlug}`);
          }
        }}
      />
    );
  }

  if (showClassification) {
    const recommendedType = getRecommendedType();
    const atLimit = selectedPriorities.length >= MAX_SELECTIONS;

    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Progress indicator */}
        <div className="border-b border-white/10 bg-black/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-medium">Orbit setup</span>
              </div>
              <span className="text-white/50 text-sm">Step 2 of 4</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 px-4 py-8 pb-32">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-classification-title">
                What should Orbit learn first?
              </h1>
              <p className="text-white/60 max-w-md mx-auto">
                Choose up to 3. We'll prioritise these sources first.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400" data-testid="text-classification-error">{error}</p>
              </div>
            )}

            {/* Selection limit indicator */}
            {atLimit && (
              <div className="text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                  <Check className="w-3.5 h-3.5" />
                  Maximum 3 selected
                </span>
              </div>
            )}

            {/* Let Orbit decide - Recommended option at top */}
            <button
              onClick={handleLetOrbitDecide}
              className="w-full p-4 rounded-xl border border-transparent bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/15 hover:to-purple-500/15 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ring-1 ring-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
              data-testid="button-intent-auto"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-blue-500/50">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Let Orbit decide</span>
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium">
                      Recommended
                    </span>
                  </div>
                  <span className="text-white/50 text-sm">Fastest setup — we'll analyse your site automatically</span>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400 flex-shrink-0 mt-2" />
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-white/30">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs uppercase tracking-wide">Or choose manually</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {priorityOptions.map((option) => {
                const isSelected = selectedPriorities.includes(option.id);
                const isRecommended = option.recommended === recommendedType;
                const Icon = option.icon;
                const isDisabled = atLimit && !isSelected;

                return (
                  <button
                    key={option.id}
                    onClick={() => togglePriority(option.id)}
                    disabled={isDisabled}
                    className={`
                      relative p-4 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
                      ${isSelected
                        ? 'bg-white/[0.07] border-transparent ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                        : isDisabled
                        ? 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05] cursor-pointer'
                      }
                    `}
                    data-testid={`button-intent-${option.id}`}
                  >
                    {/* Recommended chip */}
                    {isRecommended && (
                      <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium">
                        Suggested
                      </span>
                    )}

                    <div className="flex items-start gap-3">
                      {/* Icon with gradient ring when selected */}
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                        ${isSelected
                          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 ring-1 ring-blue-500/50'
                          : 'bg-white/[0.05]'
                        }
                      `}>
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-white/60'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isSelected ? 'text-white' : 'text-white/90'}`}>
                            {option.title}
                          </span>
                        </div>
                        <span className="text-white/50 text-sm line-clamp-1">{option.description}</span>
                      </div>

                      {/* Checkmark */}
                      <div className={`
                        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                        ${isSelected
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                          : 'border border-white/20'
                        }
                      `}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Button
              onClick={() => {
                setShowClassification(false);
                setValidatedUrl("");
                setSelectedPriorities([]);
              }}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/5"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center gap-3">
              {selectedPriorities.length > 0 && (
                <span className="text-white/40 text-sm hidden sm:inline">
                  {selectedPriorities.length} selected
                </span>
              )}
              <Button
                onClick={handleContinueWithSelection}
                disabled={selectedPriorities.length === 0}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-continue"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blockedData) {
    return (
      <OrbitLayout>
        <div className="p-6 max-w-[720px] mx-auto space-y-6">
          {/* Header - Positive framing */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center mx-auto">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white" data-testid="text-blocked-title">
              This site has extra protection
            </h1>
            <p className="text-white/60 max-w-md mx-auto">
              No problem — choose the fastest option below to build your Orbit.
            </p>
          </div>

          {/* Primary options - Sitemap first */}
          <div className="space-y-3">
            {/* Sitemap option - FIRST and fastest */}
            <button
              onClick={async () => {
                try {
                  const sitemapUrl = new URL('/sitemap.xml', validatedUrl || blockedData.sourceUrl).href;
                  setTryAnotherUrl(sitemapUrl);
                  // Auto-trigger scan with sitemap URL
                  analyzeWebsiteMutation.mutate({
                    url: sitemapUrl,
                    extractionIntent: null,
                    extractionPriorities: [],
                  });
                } catch (e) {
                  setTryAnotherError('Could not construct sitemap URL');
                }
              }}
              disabled={analyzeWebsiteMutation.isPending}
              className="w-full p-4 rounded-xl border border-transparent bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/15 hover:to-purple-500/15 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ring-1 ring-blue-500/30"
              data-testid="button-try-sitemap"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-blue-500/50">
                    <FileCode className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Try sitemap.xml</span>
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium">
                        Fastest
                      </span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~1 min
                      </span>
                    </div>
                    <span className="text-white/50 text-sm">Import your public sitemap without crawling pages</span>
                  </div>
                </div>
                {analyzeWebsiteMutation.isPending ? (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-blue-400" />
                )}
              </div>
            </button>

            {/* Quick Setup - Recommended */}
            <button
              onClick={() => {
                setQuickSetupStep(1);
                setShowQuickSetup(true);
                if (validatedUrl) {
                  setQuickSetupData(prev => ({ ...prev, homepage: validatedUrl }));
                }
              }}
              className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              data-testid="button-quick-setup"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Quick Setup</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/60">
                        Recommended
                      </span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~2 min
                      </span>
                    </div>
                    <span className="text-white/50 text-sm">Paste your key pages and we'll build your knowledge map</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </div>
            </button>

            {/* Install snippet option */}
            <button
              onClick={() => {
                // Show snippet modal
                alert('Snippet installation coming soon. For now, use Quick Setup.');
              }}
              className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              data-testid="button-install-snippet"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <Code className="w-5 h-5 text-white/60" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Install the Orbit snippet</span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ~3 min
                      </span>
                    </div>
                    <span className="text-white/50 text-sm">Securely authorise your site to send pages to Orbit</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/40" />
              </div>
            </button>

            {/* Priority Setup Service - White glove option */}
            {!showPrioritySetup ? (
              <button
                onClick={() => setShowPrioritySetup(true)}
                className="w-full p-4 rounded-xl border border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-purple-500/5 hover:from-pink-500/10 hover:to-purple-500/10 text-left transition-all focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                data-testid="button-priority-setup"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-pink-500/50">
                      <Headphones className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">Let us do it for you</span>
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 text-xs font-medium ring-1 ring-pink-500/30">
                          Free
                        </span>
                      </div>
                      <span className="text-white/50 text-sm">We'll set up your Orbit within 24 hours</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-pink-400" />
                </div>
              </button>
            ) : priorityStatus === 'sent' ? (
              <div className="p-6 rounded-xl border border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-green-500/10 flex items-center justify-center ring-1 ring-green-500/30">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <h2 className="text-lg font-medium text-white">Request Received!</h2>
                <p className="text-white/60 text-sm">
                  We'll be in touch within 24 hours to set up your Orbit.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-purple-500/5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-pink-500/50">
                    <Headphones className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <h2 className="font-medium text-white">Priority Setup Request</h2>
                    <p className="text-sm text-white/50">Share your details and we'll build your Orbit for you.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Input
                    placeholder="Your name"
                    value={priorityForm.name}
                    onChange={(e) => setPriorityForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-priority-name"
                  />
                  <Input
                    placeholder="Email address"
                    type="email"
                    value={priorityForm.email}
                    onChange={(e) => setPriorityForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-priority-email"
                  />
                  <Input
                    placeholder="Phone (optional)"
                    type="tel"
                    value={priorityForm.phone}
                    onChange={(e) => setPriorityForm(f => ({ ...f, phone: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-priority-phone"
                  />
                  <textarea
                    placeholder="Tell us about your business..."
                    value={priorityForm.notes}
                    onChange={(e) => setPriorityForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-20 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    data-testid="input-priority-notes"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 text-white/60 hover:text-white hover:bg-white/10"
                    onClick={() => setShowPrioritySetup(false)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
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
                  <p className="text-sm text-red-400 text-center">Something went wrong. Please try again.</p>
                )}
              </div>
            )}
          </div>

          {/* Try another page */}
          <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-3">
            <p className="text-sm text-white/40">
              Or try scanning a different page (About / Services often work)
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://yoursite.com/about"
                value={tryAnotherUrl}
                onChange={(e) => {
                  setTryAnotherUrl(e.target.value);
                  setTryAnotherError("");
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleTryAnotherPage()}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 flex-1"
                data-testid="input-try-another-url"
              />
              <Button
                onClick={handleTryAnotherPage}
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
                data-testid="button-try-scan"
              >
                Scan
              </Button>
            </div>
            {tryAnotherError && (
              <p className="text-xs text-red-400">{tryAnotherError}</p>
            )}
          </div>

          {/* More options - collapsed */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-white/30 uppercase tracking-wide">More options</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Paste menu/catalogue */}
              <button
                onClick={() => setLocation(`/orbit/${blockedData.businessSlug}/import`)}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-colors text-left"
                data-testid="button-paste-import"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardPaste className="w-4 h-4 text-white/30" />
                  <span className="text-xs text-white/30">~5 min</span>
                </div>
                <span className="text-sm font-medium text-white/70 block">Paste content</span>
              </button>

              {/* Upload CSV/Excel */}
              <button
                onClick={() => setLocation(`/orbit/${blockedData.businessSlug}/import`)}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-colors text-left"
                data-testid="button-csv-import"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-white/30" />
                  <span className="text-xs text-white/30">~10 min</span>
                </div>
                <span className="text-sm font-medium text-white/70 block">Upload spreadsheet</span>
              </button>

              {/* Connect platform */}
              <button
                onClick={() => {
                  setQuickSetupStep(1);
                  setShowQuickSetup(true);
                }}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-colors text-left relative"
                data-testid="button-connect-platform"
              >
                <div className="absolute top-1.5 right-1.5 px-1 py-0.5 text-[9px] uppercase tracking-wide bg-white/5 text-white/30 rounded">
                  Soon
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Link2 className="w-4 h-4 text-white/30" />
                  <span className="text-xs text-white/30">~2 min</span>
                </div>
                <span className="text-sm font-medium text-white/70 block">Connect platform</span>
              </button>
            </div>
          </div>

          {/* Bottom link */}
          <div className="pt-2 text-center">
            <button
              onClick={() => {
                setBlockedData(null);
                setWebsiteUrl("");
                setTryAnotherUrl("");
                analyzeWebsiteMutation.reset();
              }}
              className="text-sm text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
              data-testid="button-try-different"
            >
              Try scanning a different page
            </button>
          </div>
        </div>

        {/* Quick Setup Wizard Modal */}
        <Dialog open={showQuickSetup} onOpenChange={setShowQuickSetup}>
          <DialogContent className="bg-black border-white/10 text-white max-w-xl max-h-[90vh] overflow-y-auto">
            {isBuilding ? (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
                <p className="text-lg font-medium">Building your Orbit…</p>
                <p className="text-sm text-white/50">This usually takes about 30 seconds</p>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg font-semibold">
                      {quickSetupStep === 1 ? 'Add your key pages' : 'Add extra signals'}
                    </DialogTitle>
                    <span className="text-sm text-white/40">Step {quickSetupStep} of 2</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: quickSetupStep === 1 ? '50%' : '100%' }}
                    />
                  </div>
                </DialogHeader>

                {quickSetupStep === 1 && (
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-white/50">
                      Use what you have. One page is enough to start.
                    </p>

                    {/* About page */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-white/80">About page</label>
                        <div className="flex bg-white/5 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, aboutMode: 'url' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.aboutMode === 'url' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.aboutMode === 'url'}
                            data-testid="toggle-about-url"
                          >
                            URL
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, aboutMode: 'text' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.aboutMode === 'text' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.aboutMode === 'text'}
                            data-testid="toggle-about-text"
                          >
                            Paste text
                          </button>
                        </div>
                      </div>
                      {quickSetupData.aboutMode === 'url' ? (
                        <Input
                          placeholder="https://yoursite.com/about"
                          value={quickSetupData.aboutUrl}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, aboutUrl: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          data-testid="input-about-url"
                        />
                      ) : (
                        <textarea
                          placeholder="Paste your about page content..."
                          value={quickSetupData.aboutText}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, aboutText: e.target.value }))}
                          className="w-full h-20 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          data-testid="textarea-about-text"
                          aria-label="About page content"
                        />
                      )}
                    </div>

                    {/* Services page */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-white/80">Services / Pricing</label>
                        <div className="flex bg-white/5 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, servicesMode: 'url' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.servicesMode === 'url' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.servicesMode === 'url'}
                            data-testid="toggle-services-url"
                          >
                            URL
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, servicesMode: 'text' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.servicesMode === 'text' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.servicesMode === 'text'}
                            data-testid="toggle-services-text"
                          >
                            Paste text
                          </button>
                        </div>
                      </div>
                      {quickSetupData.servicesMode === 'url' ? (
                        <Input
                          placeholder="https://yoursite.com/services"
                          value={quickSetupData.servicesUrl}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, servicesUrl: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          data-testid="input-services-url"
                        />
                      ) : (
                        <textarea
                          placeholder="Paste your services or pricing info..."
                          value={quickSetupData.servicesText}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, servicesText: e.target.value }))}
                          className="w-full h-20 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          data-testid="textarea-services-text"
                          aria-label="Services or pricing content"
                        />
                      )}
                    </div>

                    {/* FAQ page */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-white/80">FAQ / Contact</label>
                        <div className="flex bg-white/5 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, faqMode: 'url' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.faqMode === 'url' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.faqMode === 'url'}
                            data-testid="toggle-faq-url"
                          >
                            URL
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickSetupData(prev => ({ ...prev, faqMode: 'text' }))}
                            className={`px-2 py-1 text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${quickSetupData.faqMode === 'text' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                            aria-pressed={quickSetupData.faqMode === 'text'}
                            data-testid="toggle-faq-text"
                          >
                            Paste text
                          </button>
                        </div>
                      </div>
                      {quickSetupData.faqMode === 'url' ? (
                        <Input
                          placeholder="https://yoursite.com/faq"
                          value={quickSetupData.faqUrl}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, faqUrl: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                          data-testid="input-faq-url"
                        />
                      ) : (
                        <textarea
                          placeholder="Paste your FAQ or contact info..."
                          value={quickSetupData.faqText}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, faqText: e.target.value }))}
                          className="w-full h-20 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          data-testid="textarea-faq-text"
                          aria-label="FAQ or contact content"
                        />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                      <Button
                        onClick={() => setShowQuickSetup(false)}
                        variant="ghost"
                        className="text-white/60 hover:text-white hover:bg-white/5"
                        data-testid="button-wizard-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => setQuickSetupStep(2)}
                        disabled={!quickSetupHasContent()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                        data-testid="button-wizard-continue"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {quickSetupStep === 2 && (
                  <div className="space-y-4 mt-4">
                    <p className="text-sm text-white/50">
                      Optional: Add more signals to enhance your Orbit.
                    </p>

                    {/* Homepage */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">Website homepage</label>
                      <Input
                        placeholder="https://yoursite.com"
                        value={quickSetupData.homepage}
                        onChange={(e) => setQuickSetupData(prev => ({ ...prev, homepage: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        data-testid="input-homepage"
                      />
                    </div>

                    {/* Social links */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-white/80">Social links</label>
                      <div className="grid gap-2">
                        <Input
                          placeholder="LinkedIn URL"
                          value={quickSetupData.socialLinkedIn}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, socialLinkedIn: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          data-testid="input-social-linkedin"
                        />
                        <Input
                          placeholder="Instagram URL"
                          value={quickSetupData.socialInstagram}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, socialInstagram: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          data-testid="input-social-instagram"
                        />
                        <Input
                          placeholder="Facebook URL"
                          value={quickSetupData.socialFacebook}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, socialFacebook: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          data-testid="input-social-facebook"
                        />
                        <Input
                          placeholder="TikTok URL"
                          value={quickSetupData.socialTikTok}
                          onChange={(e) => setQuickSetupData(prev => ({ ...prev, socialTikTok: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                          data-testid="input-social-tiktok"
                        />
                      </div>
                    </div>

                    {/* Priority checkbox - using shadcn Checkbox for proper keyboard handling */}
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="prioritize-socials"
                        checked={quickSetupData.prioritizeSocials}
                        onCheckedChange={(checked) => setQuickSetupData(prev => ({ ...prev, prioritizeSocials: checked === true }))}
                        data-testid="checkbox-prioritize-socials"
                        className="border-white/20 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-500 data-[state=checked]:border-0"
                      />
                      <label htmlFor="prioritize-socials" className="text-sm text-white/70 cursor-pointer">
                        Prioritise these pages first
                      </label>
                    </div>

                    {/* Error message */}
                    {powerUpError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-400">{powerUpError}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between gap-3 pt-4 border-t border-white/10">
                      <Button
                        onClick={() => setQuickSetupStep(1)}
                        variant="ghost"
                        className="text-white/60 hover:text-white hover:bg-white/5"
                        data-testid="button-wizard-back"
                        disabled={isBuilding}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <Button
                        onClick={handleQuickSetupSubmit}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        data-testid="button-build-orbit"
                        disabled={isBuilding}
                      >
                        {isBuilding ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Building...
                          </>
                        ) : (
                          'Build Orbit'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Success */}
                {quickSetupStep === 3 && powerUpResult && (
                  <div className="space-y-6 mt-4 text-center py-4">
                    {/* Success indicator */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center animate-pulse">
                        <Sparkles className="w-8 h-8 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-2">Orbit Powered Up</h3>
                        <p className="text-sm text-white/60">
                          Powered insights unlocked · Content-ready ideas enabled
                        </p>
                      </div>
                      {/* Insights increase animation */}
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="text-sm text-white/60">Insights:</span>
                        <span className="text-sm text-white/40 line-through">3</span>
                        <ArrowRight className="w-3 h-3 text-green-400" />
                        <span className="text-sm font-semibold text-green-400">10</span>
                      </div>
                    </div>

                    {/* Strength score with breakdown */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-white/60">Orbit Strength</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-white">{powerUpResult.strengthScore}/100</span>
                          <span className="text-xs text-green-400 font-medium">+{powerUpResult.strengthScore}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${powerUpResult.strengthScore}%` }}
                        />
                      </div>
                      
                      {/* Strength breakdown */}
                      <div className="space-y-2 text-xs">
                        <p className="text-white/50 mb-2">How to reach 100:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            {quickSetupData.aboutUrl || quickSetupData.aboutText ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <div className="w-3 h-3 border border-white/30 rounded" />
                            )}
                            <span className={quickSetupData.aboutUrl || quickSetupData.aboutText ? "text-white/70" : "text-white/40"}>About page</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {quickSetupData.servicesUrl || quickSetupData.servicesText ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <div className="w-3 h-3 border border-white/30 rounded" />
                            )}
                            <span className={quickSetupData.servicesUrl || quickSetupData.servicesText ? "text-white/70" : "text-white/40"}>Services/Pricing</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {quickSetupData.faqUrl || quickSetupData.faqText ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <div className="w-3 h-3 border border-white/30 rounded" />
                            )}
                            <span className={quickSetupData.faqUrl || quickSetupData.faqText ? "text-white/70" : "text-white/40"}>FAQ/Contact</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(quickSetupData.socialLinkedIn || quickSetupData.socialInstagram || quickSetupData.socialFacebook || quickSetupData.socialTikTok) ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <div className="w-3 h-3 border border-white/30 rounded" />
                            )}
                            <span className={(quickSetupData.socialLinkedIn || quickSetupData.socialInstagram || quickSetupData.socialFacebook || quickSetupData.socialTikTok) ? "text-white/70" : "text-white/40"}>
                              Socials ({[quickSetupData.socialLinkedIn, quickSetupData.socialInstagram, quickSetupData.socialFacebook, quickSetupData.socialTikTok].filter(Boolean).length}/4)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex justify-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-sm font-medium text-blue-300">Powered insights live</span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                      <Button
                        onClick={() => {
                          setShowQuickSetup(false);
                          setLocation('/launchpad');
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        data-testid="button-go-launchpad"
                      >
                        Go to Launchpad
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button
                        onClick={() => {
                          setShowQuickSetup(false);
                          if (blockedData?.businessSlug) {
                            setLocation(`/orbit/${blockedData.businessSlug}/settings`);
                          }
                        }}
                        variant="ghost"
                        className="w-full text-white/60 hover:text-white hover:bg-white/5"
                        data-testid="button-review-sources"
                      >
                        Review Sources
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </OrbitLayout>
    );
  }

  return (
    <OrbitLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-claim-title">
            Claim Your Orbit
          </h1>
          <p className="text-white/60">
            Set up your business presence for AI-powered discovery
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400" data-testid="text-error">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <h2 className="text-lg font-semibold text-white">Enter Your Website</h2>
            <p className="text-sm text-white/60">
              We'll analyze your website to understand your business and create your Orbit profile.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="https://yourbusiness.com"
                  value={websiteUrl}
                  onChange={(e) => {
                    setWebsiteUrl(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleContinue()}
                  disabled={isLoading}
                  className="bg-white/5 border-white/10 pl-10 text-white placeholder:text-white/40"
                  data-testid="input-website-url"
                />
              </div>
              <Button 
                onClick={handleContinue}
                disabled={isLoading || !websiteUrl.trim()}
                className="bg-blue-500 hover:bg-blue-600 min-w-[100px]" 
                data-testid="button-continue"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-4 text-center">
          <p className="text-xs text-white/40">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-blue-400 hover:underline">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </OrbitLayout>
  );
}
