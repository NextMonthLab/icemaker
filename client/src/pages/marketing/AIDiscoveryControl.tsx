import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Sparkles, Shield, Target, Layers, Radio, CheckCircle2, Eye, Brain, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const comparisonData = [
  { then: "Rankings", now: "Interpretation" },
  { then: "Keywords", now: "Meaning" },
  { then: "Traffic", now: "Trust" },
  { then: "Clicks", now: "Answers" },
  { then: "Search engines", now: "AI systems" },
];

const orbitDefines = [
  "Who you are and who you're for",
  "What you do (and what you don't)",
  "How your services should be described",
  "Which proof points matter",
  "Which answers are authoritative",
  "Which information is outdated or sensitive",
];

const claimBenefits = [
  "Verifies you as the legitimate business owner",
  "Gives you control over how your business is described",
  "Allows you to correct, refine, and guide AI understanding",
  "Unlocks future AI-facing capabilities as discovery evolves",
];

export default function AIDiscoveryControl() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleClaimClick = () => {
    setLocation("/for/brands");
  };

  const handleDemoClick = () => {
    setLocation("/for/brands");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
          
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-pink-500/10 border border-pink-500/20 rounded-full backdrop-blur-sm">
                <Radio className="w-4 h-4 text-pink-400" />
                <span className="text-pink-300">AI Discovery Control</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-[1.1]" data-testid="text-hero-title">
                <span className="text-white">When AI answers questions about your business, </span>
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">who decides what it says?</span>
              </h1>

              <div className="text-lg md:text-xl text-white/70 max-w-3xl mx-auto mb-12 leading-relaxed space-y-4 text-left" data-testid="text-hero-intro">
                <p>For years, businesses focused on being found.</p>
                <p>Search rankings. Keywords. Click-through rates.</p>
                <p>But discovery has changed.</p>
                <p>Today, people don't search for businesses the way they used to. They ask AI. And AI doesn't return a list of links. It returns an answer.</p>
                <p>A summary. An interpretation. An opinion.</p>
                <p>The question is no longer <em>where does my website rank?</em></p>
                <p className="font-semibold text-white">It's this: How is my business being understood and described by AI?</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  onClick={handleClaimClick}
                  className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" 
                  data-testid="button-hero-claim-cta"
                >
                  Claim your business Orbit
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={handleDemoClick}
                  className="h-14 px-8 text-lg border-white/20 text-white hover:bg-white/10 gap-3" 
                  data-testid="button-hero-demo-cta"
                >
                  <Eye className="w-5 h-5" />
                  See Orbit in action
                </Button>
              </div>
              <p className="text-sm text-white/50 mt-4">
                Claiming your Orbit helps control how AI represents your business.
              </p>
            </motion.div>
          </div>
        </section>

        {/* The Shift Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Search has changed. Discovery has changed. Control hasn't caught up.
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>AI-powered systems like ChatGPT, Gemini, and AI-enhanced search results are now a primary way people discover and evaluate businesses.</p>
                
                <p>Instead of scanning websites, users ask questions like:</p>
                
                <ul className="space-y-2 pl-6">
                  <li className="flex items-start gap-3">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>Who should I trust for this?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>What does this company actually do?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>Are they credible?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>Who's best for my situation?</span>
                  </li>
                </ul>
                
                <p>The AI answers by interpreting information pulled from across the web.</p>
                <p>Not just your website. Not just your marketing copy. But fragments, summaries, assumptions, and third-party references.</p>
                <p className="font-semibold text-white">And once that answer is given, it often becomes the truth for that user.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* AI Infers Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  AI doesn't know your business. It infers it.
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>This is the uncomfortable reality.</p>
                <p>AI systems are not malicious. They're not biased against you.</p>
                <p className="font-semibold text-white">But they are interpretive.</p>
                <p>They compress nuance. They flatten differentiation. They prioritise what's easy to summarise, not what matters most.</p>
                
                <p>That means:</p>
                <ul className="space-y-2 pl-6">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Your positioning can be diluted</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Your proof points can disappear</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Your tone can become generic</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Outdated or partial information can persist</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>Context can be guessed instead of known</span>
                  </li>
                </ul>
                
                <p className="font-semibold text-white">Most businesses are already being described by AI. They're just not part of the conversation.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* From SEO to AI Representation Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  From SEO to AI representation
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed mb-12">
                <p>Traditional SEO was about visibility.</p>
                <p className="font-semibold text-white">AI discovery is about understanding.</p>
                <p>This isn't SEO 2.0.</p>
                <p>It's a shift from optimising for algorithms to defining how your business is represented when AI speaks on your behalf.</p>
                <p className="font-semibold text-white">The next phase of discovery isn't about being found. It's about being represented accurately.</p>
              </div>

              {/* Comparison Table */}
              <div className="rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 overflow-hidden">
                <div className="grid grid-cols-2">
                  <div className="p-4 bg-white/5 border-b border-r border-white/10">
                    <span className="font-bold text-white/60">Then</span>
                  </div>
                  <div className="p-4 bg-white/5 border-b border-white/10">
                    <span className="font-bold text-pink-400">Now</span>
                  </div>
                  {comparisonData.map((row, index) => (
                    <motion.div
                      key={row.then}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="contents"
                    >
                      <div className={`p-4 border-r border-white/10 ${index < comparisonData.length - 1 ? 'border-b border-white/10' : ''}`}>
                        <span className="text-white/60">{row.then}</span>
                      </div>
                      <div className={`p-4 ${index < comparisonData.length - 1 ? 'border-b border-white/10' : ''}`}>
                        <span className="text-white font-medium">{row.now}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Source of Truth Section */}
        <section className="py-16 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-3xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 text-center"
            >
              <h3 className="text-2xl md:text-3xl font-bold mb-6">
                Businesses need a source of truth for AI
              </h3>
              <div className="text-lg text-white/70 leading-relaxed space-y-4">
                <p>Right now, AI systems are forced to guess.</p>
                <p>They scrape. They summarise. They infer.</p>
                <p>What's missing is an authoritative, structured, business-owned source of truth designed for AI.</p>
                <p className="font-semibold text-white text-xl">That's the gap Orbit exists to fill.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Orbit Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Orbit is how your business speaks to AI
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>Orbit is not a chatbot. It's not a website builder. It's not an SEO tool.</p>
                <p className="font-semibold text-white text-xl">Orbit is a Business-to-AI interface.</p>
                <p>It gives AI systems something better than inference: a clear, structured, up-to-date representation of your business that you control.</p>
                
                <p className="font-semibold text-white">With Orbit, you define:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  {orbitDefines.map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/80">{item}</span>
                    </motion.div>
                  ))}
                </div>
                
                <p className="mt-8">Orbit doesn't try to game AI systems.</p>
                <p className="font-semibold text-white">It gives them something reliable to listen to.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Control Requires Ownership Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Control requires ownership
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>Orbit instances exist for real businesses and domains.</p>
                <p className="font-semibold text-white">But ownership matters.</p>
                
                <p>Claiming your Orbit:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-6 mb-8">
                  {claimBenefits.map((benefit, index) => (
                    <motion.div
                      key={benefit}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                      <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/80">{benefit}</span>
                    </motion.div>
                  ))}
                </div>
                
                <p className="font-semibold text-white text-xl">If AI is going to describe your business, it should be using something you own.</p>
              </div>

              <div className="mt-12 text-center">
                <Button 
                  size="lg" 
                  onClick={handleClaimClick}
                  className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" 
                  data-testid="button-section-claim-cta"
                >
                  Claim your business Orbit
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <p className="text-sm text-white/50 mt-4">
                  Claiming your Orbit helps control how AI represents your business.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Beyond Interfaces Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Layers className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Beyond interfaces: the future of AI discovery
                </h2>
              </div>
              
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>Orbit isn't just about what humans see.</p>
                <p>We're building toward a future where Orbit also acts as a machine-readable signal designed specifically for AI systems.</p>
                <p>A clear, authoritative dataset that AI can read, trust, reference, and query.</p>
                
                <div className="p-6 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 my-8">
                  <p className="text-white font-semibold text-xl mb-2">Think of it like a lighthouse.</p>
                  <p className="text-white/70">The clearer the signal, the further and more accurately it travels.</p>
                </div>
                
                <p>As AI discovery continues to evolve, Orbit is designed to become the place AI systems look first to understand a business properly.</p>
                <p>Not because they're forced to.</p>
                <p className="font-semibold text-white">But because it's the most reliable source available.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Closing Section */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-3xl mx-auto relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="space-y-6 text-lg text-white/70 leading-relaxed mb-12">
                <p>AI is already shaping how businesses are discovered, evaluated, and recommended.</p>
                <p>The question isn't whether this shift will continue.</p>
                <p className="font-semibold text-white text-xl">It's whether businesses will accept being interpreted by default, or take control of how they're understood.</p>
                <p className="font-semibold text-white text-xl">Orbit exists for businesses that choose the second option.</p>
              </div>

              <Button 
                size="lg" 
                onClick={handleClaimClick}
                className="h-16 px-10 text-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" 
                data-testid="button-final-claim-cta"
              >
                Claim your business Orbit
                <ArrowRight className="w-6 h-6" />
              </Button>
              <p className="text-sm text-white/50 mt-4">
                Claiming your Orbit helps control how AI represents your business.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/">
              <img
                src="/logo.png"
                alt="NextMonth"
                className="h-24 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                style={{ clipPath: 'inset(30% 0 30% 0)' }}
              />
            </Link>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
