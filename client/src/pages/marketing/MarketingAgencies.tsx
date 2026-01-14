import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, FileText, Users, Presentation, Megaphone, CheckCircle2, ChevronDown, Share2, Brain, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

const useCases = [
  "Interactive product explainers",
  "Sales enablement 'experiences' instead of decks",
  "Case studies people actually explore",
  "Pitch experiences with a brand persona that answers questions",
  "Customer onboarding journeys that reduce friction",
];

const agencyValue = [
  "Higher perceived value than static collateral",
  "Faster production from existing materials",
  "Measurable engagement and questions asked",
  "White-label / client-friendly delivery",
];

const differentiators = [
  { text: "Interactive guide grounded in your source (no hallucinated claims)", icon: Sparkles },
  { text: "Memory across scenes (keeps the narrative consistent)", icon: Brain },
  { text: "Scene-based pacing (feels cinematic, not slide-like)", icon: Layers },
  { text: "Publish by link or embed (share anywhere)", icon: Share2 },
];

const faqs = [
  {
    q: "Is this just an AI video tool?",
    a: "No — IceMaker creates an interactive experience, with a guide that can answer questions within your approved content.",
  },
  {
    q: "Can we keep it on-brand?",
    a: "Yes — define voice, tone, and boundaries.",
  },
  {
    q: "Can we embed it on a landing page?",
    a: "Yes — link or embed.",
  },
];

export default function MarketingAgencies() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                <span className="text-white/80">Marketing & Agencies</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]" data-testid="text-hero-title">
                Stop shipping flat content.{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">Ship experiences.</span>
              </h1>
              
              <p className="text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
                IceMaker turns decks, pages, case studies and product docs into interactive cinematic experiences — where a brand guide answers questions in real time, grounded in your approved source.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
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

        {/* Problem */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Templates are everywhere. Attention is not.
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <FileText className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70">Prospects don't read PDFs — they look for answers.</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <Presentation className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70">Slide tools look polished but stay passive.</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                <Users className="w-6 h-6 text-white/40 shrink-0 mt-0.5" />
                <p className="text-white/70">Video avatars speak at people, not with them.</p>
              </div>
            </div>
          </div>
        </section>

        {/* What You Can Build */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Interactive content that engages — and converts.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {useCases.map((useCase, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/30 border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                  <p className="text-white/80">{useCase}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Agency Value */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              A premium deliverable clients can't easily replicate.
            </h2>
            <div className="space-y-4">
              {agencyValue.map((point, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                  <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />
                  <p className="text-white/80">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Differentiators */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              What makes it different
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {differentiators.map((diff, i) => (
                <div key={i} className="flex items-start gap-4 p-6 rounded-lg bg-neutral-900/30 border border-white/5 hover-lift">
                  <diff.icon className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-white/80">{diff.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Strip */}
        <section className="py-16 bg-cyan-500/10 border-y border-cyan-500/20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">
              Want to replace your next deck with something unignorable?
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/try">
                <Button size="lg" className="gap-2 text-base px-8">
                  Start building
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/book-demo">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Book a demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-neutral-950">
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
        <section className="py-24 bg-gradient-to-b from-black to-neutral-950">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-10">
              Make your content interactive — without rebuilding from scratch.
            </h2>
            <Link href="/try">
              <Button size="lg" className="gap-2 text-base px-8">
                Start building
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </div>
  );
}
