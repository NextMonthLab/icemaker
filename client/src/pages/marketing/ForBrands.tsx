import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Wand2, MessageCircle, Share2, Code, Video, QrCode, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const benefits = [
  {
    title: "Enter a URL or upload documents",
    description: "Paste your website, product page, or case study. NextScene extracts the meaning.",
    icon: Globe,
  },
  {
    title: "NextScene builds a visual story",
    description: "AI transforms your content into cinematic story cards with stunning visuals.",
    icon: Wand2,
  },
  {
    title: '"Talk to the brand" via AI chat',
    description: "Visitors can ask questions answered by an AI grounded in your content.",
    icon: MessageCircle,
  },
  {
    title: "Export anywhere",
    description: "Embeddable experience, shareable link, or standalone video with QR.",
    icon: Share2,
  },
];

const exportOptions = [
  {
    title: "Embeddable Experience",
    description: "Drop into any website with a single line of code",
    icon: Code,
  },
  {
    title: "Shareable Link",
    description: "Send directly to prospects and customers",
    icon: Share2,
  },
  {
    title: "Video with QR",
    description: "Standalone video that drives back to the interactive experience",
    icon: QrCode,
  },
];

const useCases = [
  "Product launches and announcements",
  "Customer case studies and testimonials",
  "Company story and about pages",
  "Sales enablement and demos",
  "Investor and stakeholder updates",
  "Internal training and onboarding",
];

export default function ForBrands() {
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
            <a href="#how-it-works">
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white border-0 shadow-lg shadow-blue-500/25" data-testid="button-signup">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-32">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-blue-500/10 border border-blue-500/20 rounded-full backdrop-blur-sm">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300">For Brands & Businesses</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Turn your website into a</span>
                <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  cinematic story customers can explore
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed" data-testid="text-hero-description">
                Transform your brand content into interactive experiences that sell, 
                educate, and engage — automatically.
              </p>
              
              <Link href="/login?signup=true">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white border-0 shadow-xl shadow-blue-500/30 gap-3" data-testid="button-hero-cta">
                  Create a Brand Story
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 px-6 relative scroll-mt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                How it <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">works</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                      <benefit.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                      <p className="text-white/50 leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Export Options */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-black to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                Export <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">anywhere</span>
              </h2>
              <p className="text-white/50 text-lg">Three ways to share your brand story</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {exportOptions.map((option, index) => (
                <motion.div
                  key={option.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                    <option.icon className="w-7 h-7 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{option.title}</h3>
                  <p className="text-white/50">{option.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
                Perfect for
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                >
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="text-white/80">{useCase}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/40 via-blue-950/20 to-transparent" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
                Ready to transform<br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  your brand story?
                </span>
              </h2>
              <Link href="/login?signup=true">
                <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white border-0 shadow-xl shadow-blue-500/30 gap-3" data-testid="button-footer-cta">
                  Create a Brand Story
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
                <Link href="/for/brands" className="text-white text-sm transition-colors">Brands</Link>
                <Link href="/for/creators" className="text-white/50 hover:text-white text-sm transition-colors">Creators</Link>
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
