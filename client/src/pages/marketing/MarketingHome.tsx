import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Layers, MessageCircle, Share2, Shield, Brain, Lock, Eye, CheckCircle2, FileText, Presentation, Globe, ScrollText, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const pipelineSteps = [
  { step: 1, title: "Ingest your source", description: "PDF, deck, URL, script", icon: Upload },
  { step: 2, title: "Auto-structure into scenes", description: "Themes, pacing, flow", icon: Layers },
  { step: 3, title: "Add an interactive guide", description: "With knowledge boundaries", icon: MessageCircle },
  { step: 4, title: "Publish a link or embed", description: "Share anywhere", icon: Share2 },
];

const differentiators = [
  {
    title: "Source-grounded Q&A",
    description: "Your guide answers from your approved material — not the open internet.",
    icon: Shield,
  },
  {
    title: "Memory and context",
    description: "The guide remembers what the viewer has seen and what they asked, so it stays relevant.",
    icon: Brain,
  },
  {
    title: "Boundaries and control",
    description: "Lock knowledge to sections, chapters, or scenes. Perfect for compliance and regulated teams.",
    icon: Lock,
  },
  {
    title: "Scene-based structure",
    description: "Not slides. Not a wall of text. Scenes that guide attention and improve retention.",
    icon: Layers,
  },
];

const useCases = [
  "Compliance and policy training people actually complete",
  "Onboarding journeys that answer questions in real time",
  "Sales enablement experiences that shorten time-to-understanding",
  "Product education that adapts to the viewer's questions",
  "Agency deliverables that feel premium and measurable",
];

const trustFeatures = [
  { text: "Grounded responses only: the guide answers from your source.", icon: Shield },
  { text: "Clear limits: if the source doesn't cover it, the guide says so.", icon: Lock },
  { text: "Progressive reveal: control what can be discussed at each stage.", icon: Eye },
  { text: "Audit trail: review questions, refine boundaries, improve the experience.", icon: CheckCircle2 },
];

const faqs = [
  {
    q: "What can I upload?",
    a: "PDFs, decks, URLs, documents, scripts, notes, and datasheets.",
  },
  {
    q: "Will it make things up?",
    a: "No — IceMaker guides are grounded in your source material and will acknowledge limits.",
  },
  {
    q: "Can I embed it?",
    a: "Yes — publish a link or embed on your site.",
  },
];

export default function MarketingHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      setLocation("/app");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-[1.1]" data-testid="text-hero-title">
                Turn training and enablement content into{' '}
                <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-purple-500 bg-clip-text text-transparent">interactive experiences</span>{' '}
                people actually finish.
              </h1>
              
              <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto mb-6 leading-relaxed" data-testid="text-hero-description">
                IceMaker transforms PDFs, decks, URLs and scripts into scene-based experiences with AI visuals, music, and an on-screen guide that answers questions using only your approved material.
              </p>
              
              <p className="text-sm text-white/50 max-w-2xl mx-auto mb-10">
                Not a slideshow. Not a chatbot. Interactive cinematic experiences — grounded, controlled, and built from what you already have.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link href="/try">
                  <Button size="lg" className="gap-2 text-base px-8" data-testid="button-start-building">
                    Start building
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/book-demo">
                  <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-book-demo">
                    Book a demo
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Trust / Proof Strip */}
        <section className="py-16 border-y border-white/5 bg-neutral-950/50">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest text-center mb-8">
              Built for teams who need more than static content
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center gap-2">
                <Shield className="w-6 h-6 text-purple-400" />
                <p className="text-white/80">Source-grounded answers (no random internet facts)</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Brain className="w-6 h-6 text-purple-400" />
                <p className="text-white/80">Memory across scenes and sessions</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Lock className="w-6 h-6 text-purple-400" />
                <p className="text-white/80">Knowledge boundaries and progressive reveal</p>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" data-testid="text-problem-heading">
              Static content gets skimmed. Interactive content gets completed.
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 rounded-lg bg-neutral-900/50 border border-white/5">
                <FileText className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70 text-lg">Compliance and onboarding decks don't stick — people click through and forget.</p>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-lg bg-neutral-900/50 border border-white/5">
                <Presentation className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70 text-lg">Sales collateral sits unread — prospects want answers, not pages.</p>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-lg bg-neutral-900/50 border border-white/5">
                <Globe className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70 text-lg">Building engaging training is slow and expensive — even before it needs updating.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Solution Overview */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-6" data-testid="text-solution-heading">
              From source material to a guided experience — in minutes.
            </h2>
            <p className="text-white/60 text-lg text-center max-w-3xl mx-auto mb-16">
              Upload your material once. IceMaker structures it into scenes, generates supporting visuals and pacing, and adds interactive moments where a guide can answer questions without going beyond the source.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {pipelineSteps.map((step) => (
                <div key={step.step} className="relative p-6 rounded-lg bg-neutral-900/50 border border-white/5 hover-lift">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                  <step.icon className="w-8 h-8 text-purple-400 mb-4" />
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Differentiators */}
        <section className="py-24 bg-black">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              What makes IceMaker different
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {differentiators.map((diff) => (
                <div key={diff.title} className="p-8 rounded-lg bg-neutral-900/30 border border-white/5 hover-lift">
                  <diff.icon className="w-10 h-10 text-purple-400 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{diff.title}</h3>
                  <p className="text-white/60">{diff.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12" data-testid="text-usecases-heading">
              What teams build with IceMaker
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {useCases.map((useCase, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/30 border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                  <p className="text-white/80">{useCase}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & Control Section */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Built for trust — not guesswork.
            </h2>
            <div className="space-y-4">
              {trustFeatures.map((feature, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                  <feature.icon className="w-6 h-6 text-purple-400 shrink-0" />
                  <p className="text-white/80">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="py-24 bg-neutral-950 border-y border-white/5">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pricing that scales from solo to teams.
            </h2>
            <p className="text-white/60 text-lg mb-10">
              Start from £29/month. Team and Enterprise options available for L&D and agencies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-view-pricing">
                  View pricing
                </Button>
              </Link>
              <Link href="/book-demo">
                <Button size="lg" className="gap-2 text-base px-8" data-testid="button-book-demo-pricing">
                  Book a demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-black">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div 
                  key={i} 
                  className="rounded-lg bg-neutral-900/50 border border-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left"
                    data-testid={`button-faq-${i}`}
                  >
                    <span className="font-medium text-white">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5">
                      <p className="text-white/60">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-gradient-to-b from-neutral-950 to-black">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" data-testid="text-final-cta">
              Stop losing your audience to static content.
            </h2>
            <p className="text-white/60 text-lg mb-10 max-w-2xl mx-auto">
              Turn what you already have into an experience people engage with — interactive, cinematic, and controlled.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/try">
                <Button size="lg" className="gap-2 text-base px-8" data-testid="button-start-building-final">
                  Start building
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/book-demo">
                <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-book-demo-final">
                  Book a demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 bg-black border-t border-white/5">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-white/40 text-sm">
                © {new Date().getFullYear()} IceMaker. All rights reserved.
              </div>
              <div className="flex gap-6 text-sm">
                <Link href="/privacy" className="text-white/40 hover:text-white/60 transition-colors">Privacy</Link>
                <Link href="/terms" className="text-white/40 hover:text-white/60 transition-colors">Terms</Link>
                <Link href="/cookies" className="text-white/40 hover:text-white/60 transition-colors">Cookies</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
