import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Layers, MessageCircle, Shield, Brain, Users, Lightbulb, BookOpen, RefreshCw, ChevronDown, CheckCircle2, Sparkles, Target, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const facilitatorBenefits = [
  {
    title: "Run better thinking conversations",
    description: "Guide learners through structured reflection with an intelligence that challenges assumptions and surfaces blind spots — without you doing all the heavy lifting.",
    icon: Lightbulb,
  },
  {
    title: "Capture learning that compounds",
    description: "Every question, insight, and breakthrough is retained. Your cohort's collective understanding grows over time, not just during the session.",
    icon: Brain,
  },
  {
    title: "Challenge assumptions constructively",
    description: "The guide asks the right follow-up questions, grounded in your source material — so learners think harder, not just absorb content.",
    icon: Target,
  },
  {
    title: "No dashboards or manual synthesis",
    description: "Stop exporting, copying, and summarising. The intelligence remembers context, connects dots, and helps you spot patterns across cohorts.",
    icon: Compass,
  },
];

const howItWorks = [
  { step: 1, title: "Upload your material", description: "Framework, model, reading, case study", icon: Upload },
  { step: 2, title: "IceMaker structures it", description: "Into thinking beats and discussion prompts", icon: Layers },
  { step: 3, title: "Add a facilitator intelligence", description: "That remembers, challenges, and stays grounded", icon: MessageCircle },
  { step: 4, title: "Run cohorts with memory", description: "Learning compounds across sessions", icon: RefreshCw },
];

const ldMentalModels = [
  {
    model: "Modules",
    description: "Break complex topics into digestible learning beats that build on each other.",
  },
  {
    model: "Cohorts",
    description: "Run multiple groups through the same material with shared and separate memory.",
  },
  {
    model: "Learning journeys",
    description: "Multi-session programmes where insights from week 1 inform week 4.",
  },
  {
    model: "Facilitation",
    description: "An intelligence that supports your role — challenges, prompts, remembers — so you can focus on the humans in the room.",
  },
];

const useCases = [
  "Leadership development programmes",
  "Manager capability building",
  "Change and transformation cohorts",
  "Executive coaching support",
  "Strategy and scenario workshops",
  "New leader transitions",
];

const trustPoints = [
  "Grounded in your source material — no hallucination",
  "Challenges thinking without inventing facts",
  "Remembers what each cohort has discussed",
  "Respects knowledge boundaries you set",
  "Audit trail for every interaction",
];

const faqs = [
  {
    q: "How is this different from a chatbot?",
    a: "Chatbots answer questions. IceMaker challenges thinking. The intelligence is grounded in your material, remembers context across sessions, and is designed to support facilitation — not replace it.",
  },
  {
    q: "Can I run multiple cohorts on the same material?",
    a: "Yes — each cohort has its own memory and context. You can also share insights across cohorts when appropriate.",
  },
  {
    q: "What if it says something outside my source material?",
    a: "It won't. The intelligence is grounded in what you upload and will acknowledge when something is outside its knowledge.",
  },
  {
    q: "Does this replace my LMS?",
    a: "No — IceMaker creates the thinking experience. Share by link or embed, and integrate with your existing systems over time.",
  },
  {
    q: "Can I see what learners are asking and thinking?",
    a: "Yes — you get visibility into questions, themes, and breakthrough moments without manual synthesis.",
  },
];

export default function CorporateTraining() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-white/80">IceMaker for Corporate L&D</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-[1.1]" data-testid="text-hero-title">
                Run better thinking conversations.{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">Capture learning that compounds.</span>
              </h1>
              
              <p className="text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
                IceMaker helps L&D facilitators challenge assumptions, support reflection, and build institutional memory — without dashboards or manual synthesis.
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
                    Try with your material
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Intelligence that supports facilitation
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto text-lg">
                Not a chatbot. Not a slide deck. A conversational intelligence that challenges thinking, remembers context, and stays grounded in your material.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {facilitatorBenefits.map((benefit) => (
                <div key={benefit.title} className="p-8 rounded-lg bg-neutral-900/30 border border-white/5 hover-elevate">
                  <benefit.icon className="w-10 h-10 text-cyan-400 mb-5" />
                  <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                  <p className="text-white/60 leading-relaxed">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mental Models */}
        <section className="py-24 bg-black">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Built for how L&D actually works
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto text-lg">
                IceMaker thinks in modules, cohorts, learning journeys, and facilitation — because that's how you think.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ldMentalModels.map((item) => (
                <div key={item.model} className="flex items-start gap-4 p-6 rounded-lg bg-neutral-900/50 border border-white/5">
                  <Sparkles className="w-6 h-6 text-cyan-400 shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white mb-2">{item.model}</h3>
                    <p className="text-white/60 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howItWorks.map((step) => (
                <div key={step.step} className="relative p-6 rounded-lg bg-neutral-900/50 border border-white/5">
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                  <step.icon className="w-8 h-8 text-cyan-400 mb-4" />
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 bg-black">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Where L&D teams use IceMaker
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {useCases.map((useCase, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-neutral-900/30 border border-white/5">
                  <BookOpen className="w-5 h-5 text-cyan-400 shrink-0" />
                  <p className="text-white/80">{useCase}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & Control */}
        <section className="py-24 bg-neutral-950">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Grounded. Controlled. Trustworthy.
            </h2>
            <div className="space-y-4">
              {trustPoints.map((point, i) => (
                <div key={i} className="flex items-center gap-4 p-5 rounded-lg bg-neutral-900/50 border border-white/5">
                  <Shield className="w-6 h-6 text-cyan-400 shrink-0" />
                  <p className="text-white/80">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Strip */}
        <section className="py-16 bg-cyan-500/10 border-y border-cyan-500/20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              See it with your own programme material.
            </h2>
            <p className="text-white/60 mb-8">
              Bring a framework, a case study, or a reading — we'll show you how IceMaker turns it into a thinking experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="gap-2 text-base px-8">
                  Book a demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/try">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Try with your material
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
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Learning that challenges. Memory that compounds.
            </h2>
            <p className="text-white/60 mb-10 text-lg">
              Stop building slides. Start building thinking.
            </p>
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
