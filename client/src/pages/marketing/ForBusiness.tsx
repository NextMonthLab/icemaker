import { Building2, Sparkles, ArrowRight, CheckCircle2, Loader2, Zap, MessageSquare, BarChart3, Rocket, Users, Heart } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import SiteNav from "@/components/SiteNav";
import SectionSkin, { SectionDivider } from "@/components/SectionSkin";

const useCases = [
  {
    title: "Product Launch Stories",
    description: "Daily chapters that build anticipation and drive repeat visits",
    icon: Rocket,
    color: "blue"
  },
  {
    title: "Customer Success Series",
    description: "Turn case studies into guided before and after journeys",
    icon: Users,
    color: "purple"
  },
  {
    title: "Company Culture Content",
    description: "Employee spotlights that make your brand feel human",
    icon: Heart,
    color: "pink"
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
        <SectionSkin 
          skins={["orbitGrid", "spotlight"]} 
          spotlightColor="rgba(99, 102, 241, 0.12)"
          gridOpacity={0.06}
          className="py-20 px-4"
        >
          <div className="max-w-3xl mx-auto text-center">
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
        </SectionSkin>

        <SectionDivider />

        {/* How It Works Section */}
        <SectionSkin 
          skins={["spotlight"]} 
          spotlightColor="rgba(139, 92, 246, 0.06)"
          spotlightPosition="center"
          className="py-16 px-4"
          separator="gradient"
        >
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
        </SectionSkin>

        {/* Use Cases Section */}
        <SectionSkin 
          skins={["noise", "spotlight"]} 
          spotlightColor="rgba(99, 102, 241, 0.06)"
          className="py-20 px-4"
          separator="gradient"
        >
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
              {useCases.map((useCase, index) => {
                const IconComponent = useCase.icon;
                const colorClasses = {
                  blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
                  purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400",
                  pink: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400"
                };
                const colors = colorClasses[useCase.color as keyof typeof colorClasses];
                return (
                  <motion.div
                    key={useCase.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className={`p-6 rounded-xl border bg-gradient-to-br ${colors.split(' ').slice(0, 2).join(' ')} ${colors.split(' ')[2]} hover:scale-[1.02] transition-all`}
                    data-testid={`card-usecase-${index}`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.split(' ').slice(0, 2).join(' ')} flex items-center justify-center mb-4`}>
                      <IconComponent className={`w-5 h-5 ${colors.split(' ')[3]}`} />
                    </div>
                    <h3 className="font-bold mb-3">{useCase.title}</h3>
                    <p className="text-sm text-white/60">{useCase.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </SectionSkin>

        {/* ICE Examples / Scenarios Section */}
        <SectionSkin 
          id="ice-examples"
          skins={["noise", "spotlight"]} 
          spotlightColor="rgba(139, 92, 246, 0.08)"
          className="py-24 px-4"
          separator="gradient"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="scenarios-title">
                See ICE in action
              </h2>
              <p className="text-white/50 max-w-xl mx-auto text-lg">
                How different businesses transform their content into guided experiences
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Innovative Manufacturer Scenario */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent hover:border-blue-500/30 transition-all duration-300"
                data-testid="scenario-manufacturer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative p-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">B2B Manufacturing</h3>
                        <p className="text-sm text-white/40">Technical products • Complex sales cycles</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-1">
                    <div className="relative p-5 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-red-400" />
                        </div>
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Challenge</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        Technical documentation overwhelms prospects. Engineering specs slow sales cycles and create friction.
                      </p>
                      <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 z-10" />
                    </div>
                    
                    <div className="relative p-5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">ICE Experience</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        An AI engineer guide walks prospects through features, answers technical questions, and demonstrates use cases visually.
                      </p>
                      <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 z-10" />
                    </div>
                    
                    <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <BarChart3 className="w-3 h-3 text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Result</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        Prospects self-educate faster. Technical complexity becomes an advantage, not a barrier to sale.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Restaurant/Hospitality Scenario */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent hover:border-orange-500/30 transition-all duration-300"
                data-testid="scenario-restaurant"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative p-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-600/10 border border-orange-500/20 flex items-center justify-center">
                        <MessageSquare className="w-7 h-7 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Restaurant Group</h3>
                        <p className="text-sm text-white/40">Multiple locations • Seasonal menus</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-1">
                    <div className="relative p-5 rounded-xl bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-red-400" />
                        </div>
                        <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Challenge</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        Static menus don't capture the dining experience. Customers have questions but no easy way to get answers before booking.
                      </p>
                      <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 z-10" />
                    </div>
                    
                    <div className="relative p-5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">ICE Experience</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        An AI host guides visitors through the menu, explains dishes, suggests pairings, and answers dietary questions.
                      </p>
                      <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 z-10" />
                    </div>
                    
                    <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <BarChart3 className="w-3 h-3 text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Result</span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">
                        Higher quality reservations from informed diners. Fewer no-shows and less staff time on repetitive questions.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </SectionSkin>

        {/* Benefits Section */}
        <SectionSkin 
          skins={["noise", "spotlight"]} 
          spotlightColor="rgba(99, 102, 241, 0.05)"
          className="py-20 px-4"
          separator="gradient"
        >
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
        </SectionSkin>

        {/* Final CTA Section */}
        <SectionSkin 
          skins={["spotlight"]} 
          spotlightColor="rgba(255, 255, 255, 0.1)"
          spotlightPosition="center"
          className="py-16 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
        >
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
        </SectionSkin>
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
