import { Building2, Sparkles, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

const businessPersona = {
  id: "business",
  title: "Businesses",
  heroTitle: "Turn Your Brand Story Into An Experience",
  heroSubtitle: "Transform product launches, case studies, and company updates into engaging visual narratives your audience will remember.",
  description: "Businesses use NextMonth to create compelling brand narratives that capture attention and drive engagement across channels.",
  icon: Building2,
  color: "from-blue-500/10 via-transparent to-cyan-500/10",
  useCases: [
    {
      title: "Product Launch Stories",
      description: "Build anticipation with serialized daily drops that reveal features, benefits, and customer stories."
    },
    {
      title: "Customer Success Series",
      description: "Turn case studies into visual journeys that showcase real results and transformation."
    },
    {
      title: "Company Culture Content",
      description: "Share your team's story through interactive employee spotlights and behind-the-scenes narratives."
    }
  ],
  benefits: [
    "Transform marketing content into story experiences",
    "AI-generated visuals maintain brand consistency",
    "Interactive character chat for product demos",
    "Daily drops create ongoing engagement",
    "Export video clips for ad campaigns",
    "Track engagement metrics and conversions",
    "Team collaboration with role-based access",
    "Embed stories on your website or share directly"
  ],
  testimonial: {
    quote: "Our product launch story series generated 5x more engagement than traditional marketing emails. Customers couldn't wait for the next chapter.",
    author: "Michael Torres",
    role: "VP of Marketing, TechFlow Inc"
  }
};

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

    // Basic URL validation
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

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="NextMonth" className="h-8 cursor-pointer" data-testid="link-logo" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" data-testid="button-login">Sign In</Button>
            </Link>
            <Link href={`/login?signup=true&persona=${businessPersona.id}`}>
              <Button data-testid="button-signup">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-20">
        {/* Smart Site Preview Section */}
        <section className="relative overflow-hidden py-16 px-4 bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-primary/10 backdrop-blur rounded-full border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary">Try Smart Site Preview</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight mb-4">
                See your website as an AI assistant in 60 seconds
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Enter your business website below and we'll create a free preview showing how an AI assistant would answer customer questions about your business. No signup required.
              </p>

              <div className="max-w-xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <Input
                    type="url"
                    placeholder="yourbusiness.com"
                    value={siteUrl}
                    onChange={(e) => {
                      setSiteUrl(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePreview()}
                    disabled={createPreviewMutation.isPending}
                    className="flex-1 h-12 px-4 text-base"
                    data-testid="input-preview-url"
                  />
                  <Button
                    onClick={handleCreatePreview}
                    disabled={createPreviewMutation.isPending || !siteUrl.trim()}
                    size="lg"
                    className="gap-2 h-12 px-6"
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
                        Create Preview
                      </>
                    )}
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-destructive text-left" data-testid="text-preview-error">
                    {error}
                  </p>
                )}
                <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>Free preview</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>No signup needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>Ready in 60 seconds</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm text-muted-foreground">
                Or explore the full platform
              </span>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className={`relative overflow-hidden py-20 px-4 bg-gradient-to-br ${businessPersona.color}`}>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-background/80 backdrop-blur rounded-full">
                <businessPersona.icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold">{businessPersona.title}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-black tracking-tight mb-6" data-testid="text-hero-title">
                {businessPersona.heroTitle}
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-hero-subtitle">
                {businessPersona.heroSubtitle}
              </p>
              <Link href={`/login?signup=true&persona=${businessPersona.id}`}>
                <Button size="lg" className="gap-2" data-testid="button-hero-cta">
                  Start Creating Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4" data-testid="text-usecases-title">
                How {businessPersona.title} Use NextMonth
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {businessPersona.description}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {businessPersona.useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="p-6 rounded-xl border border-border bg-card"
                  data-testid={`card-usecase-${index}`}
                >
                  <h3 className="font-display font-bold mb-3">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-card/50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4" data-testid="text-benefits-title">
                Why {businessPersona.title} Choose NextMonth
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {businessPersona.benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex items-start gap-3 p-4"
                  data-testid={`text-benefit-${index}`}
                >
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {businessPersona.testimonial && (
          <section className="py-20 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <blockquote className="text-2xl font-display italic mb-6" data-testid="text-testimonial-quote">
                "{businessPersona.testimonial.quote}"
              </blockquote>
              <div>
                <p className="font-bold" data-testid="text-testimonial-author">{businessPersona.testimonial.author}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-testimonial-role">{businessPersona.testimonial.role}</p>
              </div>
            </div>
          </section>
        )}

        <section className="py-20 px-4 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-cta-title">
              Ready to Transform Your {businessPersona.title.replace(/s$/, '')} Content?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Join thousands of {businessPersona.title.toLowerCase()} already creating engaging stories with NextMonth.
            </p>
            <Link href={`/login?signup=true&persona=${businessPersona.id}`}>
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-footer-cta">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              Back to NextMonth Home
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
