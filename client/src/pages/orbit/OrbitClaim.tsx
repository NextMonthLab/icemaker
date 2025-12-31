import { Building2, Globe, Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import OrbitLayout from "@/components/OrbitLayout";
import { Link, useLocation } from "wouter";
import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

interface OrbitGenerateResponse {
  success: boolean;
  businessSlug: string;
  previewId?: string;
  status: string;
  brandName?: string;
  message?: string;
}

export default function OrbitClaim() {
  const [, setLocation] = useLocation();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeWebsiteMutation = useMutation({
    mutationFn: async (url: string): Promise<OrbitGenerateResponse> => {
      const response = await fetch('/api/orbit/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to analyze website');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.businessSlug) {
        setLocation(`/orbit/${data.businessSlug}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/orbit/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.businessSlug) {
        setLocation(`/orbit/${data.businessSlug}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleAnalyze = () => {
    setError("");
    
    if (!websiteUrl.trim()) {
      setError("Please enter your website URL");
      return;
    }

    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
      analyzeWebsiteMutation.mutate(url);
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError("");
      uploadDocumentMutation.mutate(file);
    }
  };

  const isLoading = analyzeWebsiteMutation.isPending || uploadDocumentMutation.isPending;

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
            <h2 className="text-lg font-semibold text-white">Step 1: Enter Your Website</h2>
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
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()}
                  disabled={isLoading}
                  className="bg-white/5 border-white/10 pl-10 text-white placeholder:text-white/40"
                  data-testid="input-website-url"
                />
              </div>
              <Button 
                onClick={handleAnalyze}
                disabled={isLoading || !websiteUrl.trim()}
                className="bg-blue-500 hover:bg-blue-600 min-w-[100px]" 
                data-testid="button-analyze"
              >
                {analyzeWebsiteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze"
                )}
              </Button>
            </div>
            
            {analyzeWebsiteMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing your website... This may take a moment.</span>
              </div>
            )}
          </div>

          <div className="text-center text-white/40 text-sm">or</div>

          <div className="p-6 rounded-xl bg-white/5 border border-white/10 border-dashed space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6 text-white/60" />
            </div>
            <h2 className="text-lg font-semibold text-white">Upload Business Documents</h2>
            <p className="text-sm text-white/60">
              Upload PDFs, presentations, or other documents about your business
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            <Button 
              variant="outline" 
              onClick={handleFileSelect}
              disabled={isLoading}
              className="border-white/20 text-white/60" 
              data-testid="button-upload"
            >
              {uploadDocumentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Choose Files"
              )}
            </Button>
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
