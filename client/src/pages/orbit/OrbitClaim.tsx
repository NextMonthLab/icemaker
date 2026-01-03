import { Building2, Globe, Loader2, AlertCircle, ClipboardPaste, FileSpreadsheet, Link2, Shield, UtensilsCrossed, ShoppingCart, Briefcase, BookOpen, FileText, MapPin, Sparkles, ArrowLeft, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  icon: React.ComponentType<{ className?: string }>;
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
    mutationFn: async ({ url, extractionIntent }: { url: string; extractionIntent: ExtractionIntentOrNull }): Promise<OrbitGenerateResponse> => {
      const response = await fetch('/api/orbit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, extractionIntent }),
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

  const handleStartExtraction = (extractionIntent: ExtractionIntentOrNull) => {
    if (!validatedUrl) {
      setError("Please enter a valid URL first");
      return;
    }
    setShowClassification(false);
    analyzeWebsiteMutation.mutate({ url: validatedUrl, extractionIntent });
  };

  const handleContinueWithSelection = () => {
    if (selectedPriorities.length === 0) return;
    handleStartExtraction(selectedPriorities[0]);
  };

  const handleLetOrbitDecide = () => {
    handleStartExtraction(null);
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
                        Recommended
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

            {/* Let Orbit decide link */}
            <div className="text-center pt-2">
              <button
                onClick={handleLetOrbitDecide}
                className="text-white/40 hover:text-white/70 text-sm transition-colors underline underline-offset-2"
                data-testid="button-intent-auto"
              >
                Or let Orbit decide automatically
              </button>
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
        <div className="p-6 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold text-white" data-testid="text-blocked-title">
              Website Protected
            </h1>
            <p className="text-white/60 max-w-md mx-auto">
              {blockedData.message || "This website uses security measures that prevent automatic reading."}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-300 text-center">
              No problem! You can still set up your Orbit using one of these alternatives:
            </p>
          </div>

          <div className="grid gap-4">
            <Button
              onClick={() => setLocation(`/orbit/${blockedData.businessSlug}/import`)}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10"
              data-testid="button-paste-import"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ClipboardPaste className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Paste Your Menu or Catalogue</span>
                <span className="text-white/60 text-sm">Copy products from your website and paste as JSON or plain text</span>
              </div>
            </Button>

            <Button
              onClick={() => setLocation(`/orbit/${blockedData.businessSlug}/import`)}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10"
              data-testid="button-csv-import"
            >
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Upload CSV or Excel</span>
                <span className="text-white/60 text-sm">Export your product list from your system and upload it</span>
              </div>
            </Button>

            <Button
              onClick={() => setLocation(`/orbit/${blockedData.businessSlug}/import`)}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10"
              data-testid="button-connect-platform"
            >
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Connect Platform</span>
                <span className="text-white/60 text-sm">Link Shopify, Square, or other platforms for automatic sync</span>
              </div>
            </Button>
          </div>

          <div className="pt-4 flex justify-center gap-4">
            <Button
              onClick={() => {
                setBlockedData(null);
                setWebsiteUrl("");
                analyzeWebsiteMutation.reset();
              }}
              variant="ghost"
              className="text-white/60 hover:text-white"
              data-testid="button-try-different"
            >
              Try a Different Website
            </Button>
          </div>
        </div>
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
