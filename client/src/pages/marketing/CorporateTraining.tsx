import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Layers, MessageCircle, Shield, Lock, CheckCircle2, Users, RefreshCw, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const howItWorks = [
  { step: 1, title: "Upload your material", description: "Policy, handbook, deck, SOPs", icon: Upload },
  { step: 2, title: "IceMaker structures it", description: "Into scenes and learning beats", icon: Layers },
  { step: 3, title: "Add a guide with boundaries", description: "That answers questions accurately", icon: MessageCircle },
  { step: 4, title: "Publish and measure", description: "Track engagement and completion", icon: RefreshCw },
];

const benefits = [
  {
    title: "Higher engagement by design",
    description: "Scenes, pacing, and interactive moments keep learners present.",
  },
  {
    title: "Fewer repeat questions",
    description: "Learners ask the guide instead of emailing managers.",
  },
  {
    title: "Controlled, source-grounded answers",
    description: "No open-internet improvisation — it stays on policy.",
  },
  {
    title: "Easier updates",
    description: "Refresh the source, regenerate scenes, keep training current.",
  },
];

const trustPoints = [
  "Source-grounded responses only",
  "Chapter/scene knowledge boundaries",
  "Progressive reveal for sensitive material",
  "Reviewable interactions (audit trail)",
  "Brand and tone control for your guide",
];

const useCases = [
  "Compliance training (HR, security, finance)",
  "New starter onboarding",
  "Internal process training (SOPs)",
  "Change communications and rollouts",
  "Manager enablement and playbooks",
];

const faqs = [
  {
    q: "Does this replace our LMS?",
    a: "No — IceMaker creates the experience. You can share by link/embed and integrate over time.",
  },
  {
    q: "What if someone asks something outside policy?",
    a: "The guide acknowledges the limit and stays within the approved source.",
  },
  {
    q: "Can we control what the guide can discuss?",
    a: "Yes — you can lock knowledge boundaries by section, chapter, or scene.",
  },
];

export default function CorporateTraining() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-purple-500/10 border border-purple-500/20 rounded-full">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-white/80">IceMaker for L&D</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]" data-testid="text-hero-title">
                Corporate training that people{' '}
                <span className="bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">actually complete</span>.
              </h1>
              
              <p className="text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
                Turn policy packs, onboarding docs, compliance decks and internal knowledge into interactive learning experiences — with an on-screen guide that answers questions using only your approved material.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/book-demo">
                  <Button size="lg" className="gap-2 text-base px-8" data-testid="button-book-demo">
                    Book a demo
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/try">
                  <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-start-building">
                    Start building
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pain → Outcome */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              The problem isn't your content. It's the format.
            </h2>
            <div className="space-y-4 mb-12">
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-2 shrink-0" />
                <p className="text-white/70">"Click-next" modules and long decks invite skimming, not learning.</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-2 shrink-0" />
                <p className="text-white/70">Learners drop off when they can't ask questions in context.</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-2 shrink-0" />
                <p className="text-white/70">Updating training becomes a constant rebuild cycle.</p>
              </div>
            </div>
            <div className="text-center p-6 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-lg text-white/90">
                IceMaker makes training active — so understanding improves, and completion follows.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-black">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howItWorks.map((step) => (
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

        {/* Key Benefits */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Key benefits
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="p-8 rounded-lg bg-neutral-900/30 border border-white/5 hover-lift">
                  <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                  <p className="text-white/60">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & Control */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Made for compliance, accuracy, and control.
            </h2>
            <div className="space-y-4">
              {trustPoints.map((point, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                  <Shield className="w-6 h-6 text-purple-400 shrink-0" />
                  <p className="text-white/80">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Use cases for L&D
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

        {/* CTA Strip */}
        <section className="py-16 bg-purple-500/10 border-y border-purple-500/20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">
              Want to see it with your own training pack?
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="gap-2 text-base px-8">
                  Book a demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/try">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Start building
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
            <h2 className="text-3xl md:text-4xl font-bold mb-10">
              Turn your existing training into learning people remember.
            </h2>
            <Link href="/book-demo">
              <Button size="lg" className="gap-2 text-base px-8">
                Book a demo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
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
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
