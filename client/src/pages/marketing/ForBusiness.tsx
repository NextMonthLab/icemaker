import { Building2, Sparkles, ArrowRight, CheckCircle2, Loader2, Zap, MessageSquare, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import SiteNav from "@/components/SiteNav";

const useCases = [
  {
    title: "Product Launch Stories",
    description: "Daily chapters that build anticipation and drive repeat visits"
  },
  {
    title: "Customer Success Series",
    description: "Turn case studies into guided before and after journeys"
  },
  {
    title: "Company Culture Content",
    description: "Employee spotlights that make your brand feel human"
  }
];

const benefits = [
  "Transform marketing content into story experiences",
  "AI-generated visuals maintain brand consistency",
  "Interactive character chat for product demos",
  "Daily drops create ongoing engagement",
  "Export video clips for ad campaigns",
  "Track engagement metrics and conversions",
  "Team collaboration with role-based access",
  "Embed stories on your website or share directly"
];

export default function ForBusiness() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState("");

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
      setLocation(`/preview/${data.previewId}`);
    },
    onError: (err: Error) => {
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
      createPreviewMutation.mutate(url);
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const scrollToExamples = () => {
    const element = document.getElementById('ice-examples');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteNav variant="marketing" />

      <main className="pt-14">
        {/* Unified Hero Section */}
        <section className="relative overflow-hidden py-20 px-4 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10">
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-blue-500/10 backdrop-blur rounded-full border border-blue-500/20">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-blue-300">For Businesses</span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white" data-testid="hero-headline">
                See what NextMonth does for businesses in 60 seconds
              </h1>
              
              <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8" data-testid="hero-subheadline">
                Create a free preview showing how an AI assistant would answer customer questions about your business. Or explore how ICE (Interactive Content Experiences) turns your content into interactive story experiences.
              </p>

              <div className="max-w-xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <Input
                    type="url"
                    placeholder="https://yourdomain.co.uk"
                    value={siteUrl}
                    onChange={(e) => {
                      setSiteUrl(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePreview()}
                    disabled={createPreviewMutation.isPending}
                    className="flex-1 h-12 px-4 text-base bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    data-testid="input-preview-url"
                  />
                  <Button
                    onClick={handleCreatePreview}
                    disabled={createPreviewMutation.isPending || !siteUrl.trim()}
                    size="lg"
                    className="gap-2 h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    data-testid="button-create-preview"
                  >
                    {createPreviewMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Create free preview
                      </>
                    )}
                  </Button>
                </div>
                
                {error && (
                  <p className="text-sm text-red-400 text-left mb-3" data-testid="text-preview-error">
                    {error}
                  </p>
                )}
                
                <p className="text-xs text-white/40 mb-6">
                  We only use publicly available content. No signup. Nothing is published unless you choose.
                </p>
                
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={scrollToExamples}
                    className="border-white/20 text-white hover:bg-white/10"
                    data-testid="button-explore-examples"
                  >
                    Explore ICE examples
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-4 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10" data-testid="how-it-works-title">
              How the free preview works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0 }}
                className="text-center"
                data-testid="step-1"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-blue-400">1</span>
                </div>
                <h3 className="font-bold mb-2">Paste your website</h3>
                <p className="text-sm text-white/60">Enter your business URL above</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-center"
                data-testid="step-2"
              >
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-purple-400">2</span>
                </div>
                <h3 className="font-bold mb-2">We generate a preview assistant</h3>
                <p className="text-sm text-white/60">See demo answers based on your content</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-center"
                data-testid="step-3"
              >
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-pink-400">3</span>
                </div>
                <h3 className="font-bold mb-2">Upgrade to publish</h3>
                <p className="text-sm text-white/60">Embed, track leads, and go live</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-usecases-title">
                How businesses use NextMonth
              </h2>
              <p className="text-white/60 max-w-xl mx-auto">
                From product launches to customer stories, turn your content into experiences that drive engagement.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="p-6 rounded-xl border border-white/10 bg-white/5 hover:border-blue-500/30 transition-all"
                  data-testid={`card-usecase-${index}`}
                >
                  <h3 className="font-bold mb-3">{useCase.title}</h3>
                  <p className="text-sm text-white/60">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ICE Examples / Scenarios Section */}
        <section id="ice-examples" className="py-20 px-4 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="scenarios-title">
                See how businesses use ICE
              </h2>
              <p className="text-white/60 max-w-xl mx-auto">
                Real scenarios showing how ICE transforms content into experiences
              </p>
            </div>
            
            {/* Innovative Manufacturer Scenario */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20 mb-6" data-testid="scenario-manufacturer">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Innovative Manufacturer</h3>
                  <p className="text-sm text-white/50">Technical products, complex sales cycles</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Problem
                  </div>
                  <p className="text-white/70 text-sm">
                    Dense technical documentation, CAD specs, and engineering white papers overwhelm prospects and slow sales cycles.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" />
                    ICE Experience
                  </div>
                  <p className="text-white/70 text-sm">
                    ICE turns product specs into an interactive experience where an AI engineer guide walks prospects through features, answers technical questions in real time, and demonstrates use cases visually.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Outcome
                  </div>
                  <p className="text-white/70 text-sm">
                    Shorter sales cycles as prospects self-educate. Technical complexity becomes an advantage, not a barrier.
                  </p>
                </div>
              </div>
            </div>

            {/* Restaurant/Hospitality Scenario */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/5 border border-orange-500/20 mb-6" data-testid="scenario-restaurant">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Restaurant Group</h3>
                  <p className="text-sm text-white/50">Multiple locations, seasonal menus</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Problem
                  </div>
                  <p className="text-white/70 text-sm">
                    Static menus and basic websites fail to capture the dining experience. Customers have questions but no easy way to get answers before booking.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" />
                    ICE Experience
                  </div>
                  <p className="text-white/70 text-sm">
                    An AI host guides visitors through the menu, explains dishes, suggests pairings, and answers questions about dietary requirements and availability.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Outcome
                  </div>
                  <p className="text-white/70 text-sm">
                    Higher quality reservations from informed diners. Reduced no-shows and fewer staff hours answering repetitive questions.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center mt-10">
              <div className="max-w-md mx-auto">
                <p className="text-sm text-white/50 mb-4">
                  Ready to see what ICE can do for your business?
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Input
                    type="url"
                    placeholder="https://yourdomain.co.uk"
                    value={siteUrl}
                    onChange={(e) => {
                      setSiteUrl(e.target.value);
                      setError("");
                    }}
                    className="h-11 px-4 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    data-testid="input-preview-url-bottom"
                  />
                  <Button
                    onClick={handleCreatePreview}
                    disabled={createPreviewMutation.isPending || !siteUrl.trim()}
                    className="gap-2 h-11 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    data-testid="button-create-preview-bottom"
                  >
                    {createPreviewMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Create free preview
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-benefits-title">
                Why businesses choose NextMonth
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex items-start gap-3 p-4"
                  data-testid={`text-benefit-${index}`}
                >
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-cta-title">
              Ready to transform your business content?
            </h2>
            <p className="text-white/80 mb-8 max-w-xl mx-auto">
              Join businesses already creating story experiences with NextMonth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto w-full">
                <Input
                  type="url"
                  placeholder="https://yourdomain.co.uk"
                  value={siteUrl}
                  onChange={(e) => {
                    setSiteUrl(e.target.value);
                    setError("");
                  }}
                  className="h-12 px-4 text-base bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  data-testid="input-preview-url-footer"
                />
                <Button
                  onClick={handleCreatePreview}
                  disabled={createPreviewMutation.isPending || !siteUrl.trim()}
                  size="lg"
                  variant="secondary"
                  className="gap-2 h-12 px-6"
                  data-testid="button-create-preview-footer"
                >
                  {createPreviewMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Create free preview
                </Button>
              </div>
            </div>
            <div className="mt-6">
              <Button
                variant="ghost"
                onClick={scrollToExamples}
                className="text-white/70 hover:text-white hover:bg-white/10"
                data-testid="button-explore-examples-footer"
              >
                Explore ICE examples
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <span className="text-sm text-white/60 hover:text-foreground transition-colors cursor-pointer">
              Back to NextMonth Home
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
