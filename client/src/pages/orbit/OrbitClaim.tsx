import { Building2, Globe, Loader2, AlertCircle, ClipboardPaste, FileSpreadsheet, Link2, Shield, UtensilsCrossed, ShoppingCart, Layers, HelpCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OrbitLayout from "@/components/OrbitLayout";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SiteIngestionLoader } from "@/components/preview/SiteIngestionLoader";

type SiteTypeHint = 'menu' | 'catalogue' | 'hybrid' | 'auto';

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

  const analyzeWebsiteMutation = useMutation({
    mutationFn: async ({ url, siteTypeHint }: { url: string; siteTypeHint: SiteTypeHint }): Promise<OrbitGenerateResponse> => {
      const response = await fetch('/api/orbit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, siteTypeHint }),
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

  const handleStartExtraction = (siteTypeHint: SiteTypeHint) => {
    if (!validatedUrl) {
      // Stay on classification screen and show error there
      setError("Please enter a valid URL first");
      return;
    }
    // Only clear classification after confirming URL is valid - mutation will trigger loading state
    setShowClassification(false);
    analyzeWebsiteMutation.mutate({ url: validatedUrl, siteTypeHint });
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
    return (
      <OrbitLayout>
        <div className="p-6 max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white" data-testid="text-classification-title">
              What type of website is this?
            </h1>
            <p className="text-white/60 max-w-md mx-auto">
              Help us extract your content more accurately by telling us about your website
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400" data-testid="text-classification-error">{error}</p>
            </div>
          )}

          <div className="grid gap-4">
            <Button
              onClick={() => handleStartExtraction('menu')}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all"
              data-testid="button-type-menu"
            >
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Restaurant / Menu</span>
                <span className="text-white/60 text-sm">Food & drink menus with items and prices</span>
              </div>
            </Button>

            <Button
              onClick={() => handleStartExtraction('catalogue')}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all"
              data-testid="button-type-catalogue"
            >
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Online Store</span>
                <span className="text-white/60 text-sm">E-commerce with products, prices, and categories</span>
              </div>
            </Button>

            <Button
              onClick={() => handleStartExtraction('hybrid')}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all"
              data-testid="button-type-hybrid"
            >
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Both Menu & Products</span>
                <span className="text-white/60 text-sm">Mixed content like cafes with merchandise</span>
              </div>
            </Button>

            <Button
              onClick={() => handleStartExtraction('auto')}
              variant="outline"
              className="w-full p-6 h-auto flex items-start gap-4 bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all"
              data-testid="button-type-auto"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">Not Sure / Other</span>
                <span className="text-white/60 text-sm">Let us auto-detect your content type</span>
              </div>
            </Button>
          </div>

          <div className="pt-4 flex justify-center">
            <Button
              onClick={() => {
                setShowClassification(false);
                setValidatedUrl("");
              }}
              variant="ghost"
              className="text-white/60 hover:text-white"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </OrbitLayout>
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
