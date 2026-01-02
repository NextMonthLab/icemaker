import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import ScenarioCarousel, { ScenarioAudience } from "@/components/ScenarioCarousel";

interface PersonaPageProps {
  persona: {
    id: string;
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    description: string;
    icon: LucideIcon;
    color: string;
    useCases: Array<{
      title: string;
      description: string;
    }>;
    benefits: string[];
    testimonial?: {
      quote: string;
      author: string;
      role: string;
    };
    scenarioFilter?: ScenarioAudience;
  };
}

export default function PersonaPage({ persona }: PersonaPageProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-display font-black tracking-tight cursor-pointer" data-testid="link-logo">
              NextMonth
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10" data-testid="button-login">Sign In</Button>
            </Link>
            <Link href={`/login?signup=true&persona=${persona.id}`}>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" data-testid="button-signup">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative overflow-hidden py-20 px-4 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-black/80 backdrop-blur rounded-full border border-white/10">
                <persona.icon className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-bold">{persona.title}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight mb-6 text-white" data-testid="text-hero-title">
                {persona.heroTitle}
              </h1>
              <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-8" data-testid="text-hero-subtitle">
                {persona.heroSubtitle}
              </p>
              <Link href={`/login?signup=true&persona=${persona.id}`}>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" data-testid="button-hero-cta">
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
                How {persona.title} Use NextMonth
              </h2>
              <p className="text-white/60 max-w-xl mx-auto">
                {persona.description}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {persona.useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="p-6 rounded-xl border border-white/10 bg-white/5"
                  data-testid={`card-usecase-${index}`}
                >
                  <h3 className="font-display font-bold mb-3">{useCase.title}</h3>
                  <p className="text-sm text-white/60">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {persona.scenarioFilter && (
          <section className="py-20 px-4 bg-white/5">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-display font-bold mb-4">
                  Real Scenarios
                </h2>
                <p className="text-white/60 max-w-xl mx-auto">
                  See how others like you use ICE to transform content into experiences
                </p>
              </div>
              <ScenarioCarousel filter={persona.scenarioFilter} />
            </div>
          </section>
        )}

        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4" data-testid="text-benefits-title">
                Why {persona.title} Choose NextMonth
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {persona.benefits.map((benefit, index) => (
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

        {persona.testimonial && (
          <section className="py-20 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <blockquote className="text-2xl font-display italic mb-6" data-testid="text-testimonial-quote">
                "{persona.testimonial.quote}"
              </blockquote>
              <div>
                <p className="font-bold" data-testid="text-testimonial-author">{persona.testimonial.author}</p>
                <p className="text-sm text-white/60" data-testid="text-testimonial-role">{persona.testimonial.role}</p>
              </div>
            </div>
          </section>
        )}

        <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-cta-title">
              Ready to Transform Your {persona.title.replace(/s$/, '')} Content?
            </h2>
            <p className="text-white/80 mb-8 max-w-xl mx-auto">
              Join thousands of {persona.title.toLowerCase()} already creating engaging stories with NextMonth.
            </p>
            <Link href={`/login?signup=true&persona=${persona.id}`}>
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-footer-cta">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <span className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer">
              Back to NextMonth Home
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
