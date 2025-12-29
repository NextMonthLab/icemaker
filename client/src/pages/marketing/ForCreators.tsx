import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Film, Clapperboard, Sparkles, MessageCircle, Calendar, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const features = [
  {
    title: "Scripts become story cards",
    description: "Upload your screenplay, treatment, or outline. Each scene or beat becomes a visual story card.",
    icon: Clapperboard,
  },
  {
    title: "Cinematic visuals per card",
    description: "AI generates consistent imagery in your chosen visual style across the entire experience.",
    icon: Sparkles,
  },
  {
    title: "Optional character interaction",
    description: "Let audiences speak to characters between scenes, safely constrained to your story world.",
    icon: MessageCircle,
  },
  {
    title: "Release your way",
    description: "Drop everything at once or release scenes daily to build anticipation.",
    icon: Calendar,
  },
];

const perfectFor = [
  "Short films and micro-cinema",
  "Trailers and teasers",
  "Pilot episodes and proof-of-concepts",
  "Experimental storytelling",
  "Interactive fiction",
  "Music video narratives",
];

const visualStyles = [
  "Neo-noir",
  "Warm naturalism",
  "High contrast sci-fi",
  "Handheld documentary",
];

export default function ForCreators() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white" data-nm-page="for-creators">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-20 scroll-mt-24" data-nm-section="hero">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-purple-500/10 border border-purple-500/20 rounded-full backdrop-blur-sm">
                <Film className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300">For Creators & Filmmakers</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Your story,</span>
                <span className="block bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  one moment at a time
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-4 leading-relaxed" data-testid="text-hero-description">
                Transform scripts and ideas into cinematic, interactive story experiences.
                Built for filmmakers who think in scenes, not pages.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                <span className="text-sm text-white/50">Built for:</span>
                <span className="text-sm text-white/70">Short films</span>
                <span className="text-white/30">-</span>
                <span className="text-sm text-white/70">Trailers and proof-of-concepts</span>
                <span className="text-white/30">-</span>
                <span className="text-sm text-white/70">Interactive fiction</span>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <Link href="/login?signup=true">
                  <Button size="lg" className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-hero-cta" data-nm-cta="build-story-experience-hero">
                    Build a Story Experience
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/orbit/progress-accountants-accountin-1766789673893" className="text-white/50 hover:text-white/70 text-sm transition-colors" data-nm-cta="see-example-experience">
                  See an example experience
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 relative scroll-mt-24" data-nm-section="script-to-screen">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                From script to <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">screen</span>
              </h2>
            </div>
            <p className="text-white/60 text-center max-w-2xl mx-auto mb-12">
              Turn written story into a visual, structured experience without losing your voice.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                      <p className="text-white/60 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <p className="text-center text-white/40 text-sm mt-8">
              Output: cinematic cards, optional character chat, shareable link
            </p>
          </div>
        </section>

        {/* Visual Consistency */}
        <section className="py-24 px-6 relative overflow-hidden scroll-mt-24" data-nm-section="visual-bible-system">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-black" />
          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-purple-500/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Visual Bible System
              </h2>
              <p className="text-xl text-white/70 max-w-2xl mx-auto mb-4">
                Define your look once. Lens feel, lighting mood, colour palette, and visual tone are locked and applied across every card.
              </p>
              <p className="text-white/50 max-w-2xl mx-auto mb-8">
                Characters stay recognisable. Locations feel connected. Your visual identity stays intact from first scene to last.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3">
                {visualStyles.map((style) => (
                  <span 
                    key={style}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm"
                  >
                    {style}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Perfect For */}
        <section className="py-24 px-6 relative scroll-mt-24" data-nm-section="perfect-for-creators">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Perfect for
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {perfectFor.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0" />
                  <span className="text-white/80">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden scroll-mt-24" data-nm-section="footer-cta">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black to-transparent" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-4">
                Ready to bring your<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  story to life?
                </span>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                Build an interactive story experience your audience can explore, not just watch.
              </p>
              <div className="flex flex-col items-center gap-4">
                <Link href="/login?signup=true">
                  <Button size="lg" className="h-16 px-12 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-footer-cta" data-nm-cta="build-story-experience-footer">
                    Build a Story Experience
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/orbit/progress-accountants-accountin-1766789673893" className="text-white/50 hover:text-white/70 text-sm transition-colors" data-nm-cta="browse-examples">
                  Browse examples
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
                <Link href="/for/brands" className="text-white/50 hover:text-white text-sm transition-colors">Brands</Link>
                <Link href="/for/creators" className="text-white text-sm transition-colors">Creators</Link>
                <Link href="/for/knowledge" className="text-white/50 hover:text-white text-sm transition-colors">Knowledge</Link>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="text-white/40 hover:text-white/70 text-xs transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-white/40 hover:text-white/70 text-xs transition-colors">Terms of Service</Link>
                <Link href="/cookies" className="text-white/40 hover:text-white/70 text-xs transition-colors">Cookie Policy</Link>
              </div>
              <p className="text-white/30 text-xs">© {new Date().getFullYear()} NextMonth Ltd. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
