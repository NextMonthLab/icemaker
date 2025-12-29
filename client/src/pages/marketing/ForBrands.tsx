import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Globe, Wand2, MessageCircle, Share2, Code, QrCode, CheckCircle2, Sparkles, Loader2, Shield, Eye, BarChart3, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { SiteIngestionLoader } from "@/components/preview/SiteIngestionLoader";
import MarketingHeader from "@/components/MarketingHeader";

const benefits = [
  {
    title: "We read your public pages",
    description: "We fetch your website content and structure it into a guided experience.",
    icon: Globe,
  },
  {
    title: "Chapters and boundaries are created",
    description: "We create key points, safe guardrails, and clear structure from your content.",
    icon: Wand2,
  },
  {
    title: "Customers can ask real questions",
    description: "Answers stay grounded in your pages, not generic internet knowledge.",
    icon: MessageCircle,
  },
  {
    title: "Share it anywhere",
    description: "Embed on your site, share a link, or export as an asset.",
    icon: Share2,
  },
];

const exportOptions = [
  {
    title: "Embeddable Experience",
    description: "Drop into any website with a single line of code",
    icon: Code,
  },
  {
    title: "Shareable Link",
    description: "Send directly to prospects and customers",
    icon: Share2,
  },
  {
    title: "Video with QR",
    description: "Standalone video that drives back to the interactive experience",
    icon: QrCode,
  },
];

const useCases = [
  "Product launches and announcements",
  "Customer case studies and testimonials",
  "Company story and about pages",
  "Sales enablement and demos",
  "Investor and stakeholder updates",
  "Internal training and onboarding",
];

export default function ForBrands() {
  const [, setLocation] = useLocation();
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ previewId: string } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const createPreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create preview");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewResult(data);
    },
    onError: (err: Error) => {
      setShowProgress(false);
      setError(err.message);
    },
  });

  const handleCreatePreview = () => {
    setError("");
    if (!siteUrl.trim()) {
      setError("Please enter your website URL");
      return;
    }

    let url = siteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
      setShowProgress(true);
      setPreviewResult(null);
      createPreviewMutation.mutate(url);
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const handleLoaderReady = () => {
    if (previewResult) {
      setLocation(`/preview/${previewResult.previewId}`);
    }
  };

  const scanDomain = siteUrl.replace(/^https?:\/\//, '').split('/')[0] || 'your site';

  if (showProgress) {
    return (
      <SiteIngestionLoader 
        isComplete={!!previewResult} 
        onReady={handleLoaderReady} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Orbit Preview Section */}
        <section className="relative py-24 px-6 overflow-hidden pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/10 via-transparent to-transparent" />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-pink-500/10 border border-pink-500/20 rounded-full backdrop-blur-sm"
              >
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span className="text-pink-300 text-sm font-medium">Orbit Preview</span>
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl font-black tracking-tight mb-6 leading-[1.1]"
              >
                Your website is passive.<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  Launch your Orbit.
                </span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-4 leading-relaxed"
              >
                Enter your URL. We generate your Orbit - an intelligent layer that lets visitors explore and ask questions based on your real content.
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-sm text-white/50 max-w-xl mx-auto mb-8"
              >
                Uses only public pages you provide. No changes to your site. You can delete the preview anytime.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <p className="text-sm text-white/60 text-left mb-2">
                  Paste your homepage URL (e.g. https://yourbrand.com)
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 blur-xl opacity-0 animate-pulse" />
                    <div className="absolute inset-0 rounded-lg" style={{
                      animation: 'pulse-border 3s ease-in-out infinite',
                    }} />
                    <Input
                      type="url"
                      placeholder="yourbrand.com"
                      value={siteUrl}
                      onChange={(e) => {
                        setSiteUrl(e.target.value);
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreatePreview()}
                      disabled={createPreviewMutation.isPending}
                      className="relative h-14 px-5 text-base bg-white/5 border-0 text-white placeholder:text-white/40 focus-visible:ring-pink-500 focus-visible:border-pink-400 transition-all duration-300 rounded-lg w-full"
                      data-testid="input-preview-url"
                    />
                  </div>
                  <Button
                    onClick={handleCreatePreview}
                    disabled={createPreviewMutation.isPending || !siteUrl.trim()}
                    size="lg"
                    className="gap-2 h-14 px-6 sm:px-8 bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/40 transition-all duration-300 rounded-lg whitespace-nowrap"
                    data-testid="button-create-preview"
                  >
                    {createPreviewMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Preview
                      </>
                    )}
                  </Button>
                </div>
                {error && (
                  <div className="text-left mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400" data-testid="text-preview-error">
                      {error}
                    </p>
                    {error.includes("valid URL") && (
                      <p className="text-xs text-red-300/70 mt-1">
                        Try using your homepage URL without paths (e.g. https://yourbrand.com)
                      </p>
                    )}
                    {error.includes("Failed") && (
                      <p className="text-xs text-red-300/70 mt-1">
                        Make sure the page is publicly accessible. Try your homepage URL instead.
                      </p>
                    )}
                  </div>
                )}
                <div className="text-center space-y-1">
                  <p className="text-xs text-white/50">
                    Free preview. Ready in about 60 seconds.
                  </p>
                  <p className="text-xs text-white/40">
                    We fetch your public content and generate a guided experience.
                  </p>
                </div>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-sm text-white/40 max-w-lg mx-auto mt-6 italic"
              >
                Most websites answer nothing. Orbit changes that.
              </motion.p>
            </motion.div>
          </div>
          
          <style>{`
            @keyframes pulse-border {
              0%, 100% {
                border: 2px solid rgba(236, 72, 153, 0.2);
                box-shadow: 0 0 20px rgba(236, 72, 153, 0.1);
              }
              50% {
                border: 2px solid rgba(236, 72, 153, 0.4);
                box-shadow: 0 0 30px rgba(236, 72, 153, 0.2);
              }
            }
          `}</style>
        </section>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-4 text-sm text-white/40">
                Or explore the full platform
              </span>
            </div>
          </div>
        </div>

        {/* Hero */}
        <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-pink-500/10 border border-pink-500/20 rounded-full backdrop-blur-sm">
                <Globe className="w-4 h-4 text-pink-400" />
                <span className="text-pink-300">For Brands & Businesses</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">How Orbit</span>
                <span className="block bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  works
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed" data-testid="text-hero-description">
                Orbit presents your content as a guided, cinematic experience customers can explore or talk to.
              </p>
              
              <Link href="/login?signup=true">
                <Button size="lg" className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-hero-cta">
                  Build a Brand Experience
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 px-6 relative scroll-mt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                What happens when you <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">create a preview</span>
              </h2>
              <p className="text-white/50 text-lg max-w-3xl mx-auto mt-4">
                We create your Orbit - an intelligent layer on top of your existing website. Customers can ask it questions. It answers using your real content. You see what your website would do if it could actually respond.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-pink-500/20">
                      <benefit.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                      <p className="text-white/50 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Built for Trust */}
        <section className="py-16 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-3xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold">Built for trust</h3>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-pink-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/70 text-sm">Source-grounded answers</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-pink-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/70 text-sm">Guardrails to reduce hallucination</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-pink-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/70 text-sm">Human review options for publish flows</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Export Options */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Export <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">anywhere</span>
              </h2>
              <p className="text-white/50 text-lg">Three ways to share your brand story</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {exportOptions.map((option, index) => (
                <motion.div
                  key={option.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
                    <option.icon className="w-7 h-7 text-pink-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{option.title}</h3>
                  <p className="text-white/50">{option.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Perfect for
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0" />
                  <span className="text-white/80">{useCase}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* What You Unlock */}
        <section className="py-20 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 to-black" />
          <div className="max-w-3xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-8">
                What you unlock when you <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">claim your Orbit</span>
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-5 h-5 text-pink-400" />
                  </div>
                  <h3 className="font-bold mb-2">Free Claim</h3>
                  <p className="text-white/50 text-sm">Analytics and activity counts</p>
                </div>
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                    <Eye className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-bold mb-2">Paid Tier</h3>
                  <p className="text-white/50 text-sm">Insights and transcripts</p>
                </div>
                <div className="p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-bold mb-2">Intelligence</h3>
                  <p className="text-white/50 text-sm">Pattern intelligence and strategic advice</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black to-transparent" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Ready to transform<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  your brand story?
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login?signup=true">
                  <Button size="lg" className="h-16 px-12 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-footer-cta">
                    Build a Brand Experience
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/orbit/progress-accountants-accountin-1766789673893">
                  <Button size="lg" variant="outline" className="h-16 px-8 text-lg bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 gap-3" data-testid="button-sample-cta">
                    Explore a sample Orbit
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10 bg-black">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <img
                src="/logo.png"
                alt="NextMonth"
                className="h-40"
                style={{ clipPath: 'inset(30% 0 30% 0)' }}
              />
              <div className="flex items-center gap-8">
                <Link href="/for/brands" className="text-white text-sm transition-colors">Brands</Link>
                <Link href="/for/creators" className="text-white/50 hover:text-white text-sm transition-colors">Creators</Link>
                <Link href="/for/knowledge" className="text-white/50 hover:text-white text-sm transition-colors">Knowledge</Link>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="text-white/40 hover:text-white/70 text-xs transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-white/40 hover:text-white/70 text-xs transition-colors">Terms of Service</Link>
                <Link href="/cookies" className="text-white/40 hover:text-white/70 text-xs transition-colors">Cookie Policy</Link>
              </div>
              <p className="text-white/30 text-xs">
                © {new Date().getFullYear()} NextMonth Ltd. All rights reserved.
                {import.meta.env.DEV && import.meta.env.VITE_GIT_COMMIT_HASH && (
                  <span className="ml-2 font-mono text-white/20">
                    v{import.meta.env.VITE_GIT_COMMIT_HASH.slice(0, 7)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
