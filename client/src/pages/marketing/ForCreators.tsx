import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Film, Clapperboard, Sparkles, MessageCircle, Calendar, Zap, CheckCircle2, Upload, Palette, Share2, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";

const features = [
  {
    title: "Scripts become story cards",
    description: "Upload your screenplay, treatment, or outline. Each scene becomes a visual card.",
    icon: Clapperboard,
  },
  {
    title: "Cinematic visuals per card",
    description: "AI generates consistent imagery in your chosen visual style across the experience.",
    icon: Sparkles,
  },
  {
    title: "Optional character interaction",
    description: "Let audiences speak to characters between scenes, constrained to your story world.",
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
  "Pilot episodes and proof of concepts",
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

  const scrollToExamples = () => {
    const element = document.getElementById('creator-examples');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white" data-nm-page="for-creators">
      <SiteNav variant="marketing" />

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-20 scroll-mt-24" data-nm-section="hero">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
          
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
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  one moment at a time
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-6 leading-relaxed" data-testid="text-hero-description">
                Transform scripts and ideas into cinematic, interactive story experiences.
                Built for filmmakers who think in scenes, not pages.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
                  Short films
                </span>
                <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
                  Trailers and proof of concepts
                </span>
                <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
                  Interactive fiction
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/try">
                  <Button size="lg" className="h-14 px-8 text-lg bg-blue-500 hover:bg-blue-400 text-white border-0 shadow-lg shadow-blue-500/30 gap-3" data-testid="button-hero-cta">
                    Build a Story Experience
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={scrollToExamples}
                  className="h-14 px-8 text-lg border-white/20 text-white hover:bg-white/10"
                  data-testid="button-hero-secondary"
                >
                  Browse examples
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 relative bg-white/[0.02] border-y border-white/5 scroll-mt-24" data-nm-section="how-it-works">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              From script to experience
            </h2>
            
            <div className="grid md:grid-cols-4 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-blue-400" />
                </div>
                <div className="text-sm font-bold text-blue-400 mb-2">1</div>
                <h3 className="font-bold mb-2">Upload your script or outline</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clapperboard className="w-7 h-7 text-purple-400" />
                </div>
                <div className="text-sm font-bold text-purple-400 mb-2">2</div>
                <h3 className="font-bold mb-2">We turn scenes into cinematic cards</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                  <Palette className="w-7 h-7 text-pink-400" />
                </div>
                <div className="text-sm font-bold text-pink-400 mb-2">3</div>
                <h3 className="font-bold mb-2">Lock your visual bible for consistency</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-7 h-7 text-green-400" />
                </div>
                <div className="text-sm font-bold text-green-400 mb-2">4</div>
                <h3 className="font-bold mb-2">Share as a link or release in chapters</h3>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 relative scroll-mt-24" data-nm-section="script-to-screen">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                From script to <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">screen</span>
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
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

        {/* Visual Bible System */}
        <section className="py-24 px-6 relative overflow-hidden scroll-mt-24" data-nm-section="visual-bible-system">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-black" />
          <div className="max-w-4xl mx-auto relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-purple-500/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Visual Bible System
              </h2>
              <p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
                Define your look once. Lens feel, lighting mood, colour palette, and visual tone are locked and applied across every card.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {visualStyles.map((style) => (
                  <span 
                    key={style}
                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm"
                  >
                    {style}
                  </span>
                ))}
              </div>
              
              <p className="text-white/50 max-w-2xl mx-auto">
                Characters stay recognisable. Locations feel connected. The look stays coherent from first scene to last.
              </p>
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
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="text-white/80">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Creator Examples / Scenarios */}
        <section id="creator-examples" className="py-24 px-6 relative scroll-mt-24" data-nm-section="creator-scenarios">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Creator <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">Stories</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                See how filmmakers use ICE (Interactive Content Experiences) to bring their visions to life
              </p>
            </div>
            
            {/* Independent Filmmaker Scenario */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20"
              data-testid="scenario-filmmaker"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Film className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Independent Filmmaker</h3>
                  <p className="text-sm text-white/50">Vision-driven, resource-conscious</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Problem
                  </div>
                  <p className="text-white/70 text-sm">
                    A polished screenplay and a clear creative vision, but limited budget for full previs to pitch investors or align a team.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                    <MessageCircle className="w-3.5 h-3.5" />
                    How they use ICE
                  </div>
                  <p className="text-white/70 text-sm">
                    They build a living storyboard: AI-generated scenes that communicate shots, lighting, composition, and mood so cast and crew understand the vision before day one.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Outcome
                  </div>
                  <p className="text-white/70 text-sm">
                    Investors grasp the vision faster. Crew arrives aligned. Production runs smoother and the budget holds.
                  </p>
                </div>
              </div>
            </motion.div>
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
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  story to life?
                </span>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                Build an interactive story experience your audience can explore, not just watch.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/try">
                  <Button size="lg" className="h-16 px-12 text-lg bg-blue-500 hover:bg-blue-400 text-white border-0 shadow-lg shadow-blue-500/30 gap-3" data-testid="button-footer-cta">
                    Build a Story Experience
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={scrollToExamples}
                  className="h-16 px-8 text-lg border-white/20 text-white hover:bg-white/10"
                  data-testid="button-footer-secondary"
                >
                  Browse examples
                </Button>
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
