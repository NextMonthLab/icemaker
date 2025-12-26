import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Film, Clapperboard, Sparkles, MessageCircle, Calendar, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    title: "Scripts become story cards",
    description: "Upload your screenplay, treatment, or story outline. Each scene or beat becomes a visual card.",
    icon: Clapperboard,
  },
  {
    title: "Cinematic visuals per card",
    description: "AI generates stunning imagery in your chosen visual style, maintaining consistency throughout.",
    icon: Sparkles,
  },
  {
    title: "Optional AI character interaction",
    description: "Let audiences talk to your characters between scenes. Guardrailed to stay in-world.",
    icon: MessageCircle,
  },
  {
    title: "Daily release or full-drop modes",
    description: "Build anticipation with scheduled releases, or drop the full experience at once.",
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

export default function ForCreators() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/90 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/">
            <img 
              src="/nextscene-logo.png" 
              alt="NextScene" 
              className="h-[75px] cursor-pointer" 
              data-testid="link-logo"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" data-testid="button-login">
                Sign In
              </Button>
            </Link>
            <a href="#features">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white border-0 shadow-lg shadow-purple-500/25" data-testid="button-signup">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-32">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-black to-black" />
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
              
              <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Your story,</span>
                <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                  one moment at a time
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed" data-testid="text-hero-description">
                Transform scripts and ideas into interactive visual experiences. 
                Perfect for filmmakers who think in scenes.
              </p>
              
              <Link href="/login?signup=true">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white border-0 shadow-xl shadow-purple-500/30 gap-3" data-testid="button-hero-cta">
                  Create a Story
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 relative scroll-mt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                From script to <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">screen</span>
              </h2>
            </div>
            
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
                      <p className="text-white/50 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Visual Consistency */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-black to-black" />
          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-purple-500/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
                Visual Bible System
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto mb-8">
                Define your visual style once. Art direction, color palette, camera style, and lighting 
                are automatically applied to every card, maintaining consistency across your entire story.
              </p>
              <p className="text-white/40">
                Characters stay recognizable. Locations feel connected. Your vision stays intact.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Perfect For */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
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
                  <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-white/80">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-purple-950/40 via-purple-950/20 to-transparent" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
                Ready to bring your<br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                  story to life?
                </span>
              </h2>
              <Link href="/login?signup=true">
                <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white border-0 shadow-xl shadow-purple-500/30 gap-3" data-testid="button-footer-cta">
                  Create a Story
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10 bg-black">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <img 
                src="/nextscene-logo.png" 
                alt="NextScene" 
                className="h-[60px]"
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
