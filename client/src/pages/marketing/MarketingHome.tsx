import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, Building2, Film, GraduationCap, Upload, Wand2, MessageCircle, Share2, Shield, Eye, Lock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { useEffect } from "react";
const LOGO_URL = "/nextscene-logo.png";

const useCases = [
  {
    id: "brands",
    title: "For Brands & Businesses",
    description: "Turn your website into a story that sells itself.",
    icon: Building2,
    href: "/for/brands",
    color: "from-pink-500 to-purple-500",
  },
  {
    id: "creators",
    title: "For Creators & Filmmakers",
    description: "Bring scripts and ideas to life, one moment at a time.",
    icon: Film,
    href: "/for/creators",
    color: "from-purple-500 to-blue-500",
  },
  {
    id: "knowledge",
    title: "For Knowledge & Learning",
    description: "Transform dense information into experiences people remember.",
    icon: GraduationCap,
    href: "/for/knowledge",
    color: "from-blue-500 to-indigo-500",
  },
];

const pipelineSteps = [
  {
    step: 1,
    title: "Upload content",
    description: "Script, PDF, website, or deck",
    icon: Upload,
  },
  {
    step: 2,
    title: "Extract meaning",
    description: "Themes, boundaries, and structure",
    icon: Wand2,
  },
  {
    step: 3,
    title: "Build visual story",
    description: "Cinematic cards with AI imagery",
    icon: Film,
  },
  {
    step: 4,
    title: "Enable interaction",
    description: "Characters can be spoken to safely",
    icon: MessageCircle,
  },
  {
    step: 5,
    title: "Share everywhere",
    description: "Embed, export, or share directly",
    icon: Share2,
  },
];

const differentiators = [
  {
    text: "Not just video. Interactive moments.",
    icon: Play,
  },
  {
    text: "Not generic AI. Guardrailed and grounded.",
    icon: Shield,
  },
  {
    text: "Not passive content. Audiences can talk back.",
    icon: MessageCircle,
  },
  {
    text: "Not locked in. Export, embed, share.",
    icon: Share2,
  },
];

const trustFeatures = [
  {
    title: "Creator-editable prompts",
    description: "Full control over AI behavior and output",
    icon: Eye,
  },
  {
    title: "Explicit guardrails",
    description: "Prevent hallucination and drift from source",
    icon: Shield,
  },
  {
    title: "Source-grounded chat",
    description: "Characters only know what you tell them",
    icon: Lock,
  },
  {
    title: "Human review",
    description: "Approve before publishing where required",
    icon: CheckCircle2,
  },
];

export default function MarketingHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black via-black/90 to-transparent">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/">
            <img 
              src={LOGO_URL} 
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
              <Button className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-400 hover:via-purple-400 hover:to-blue-400 text-white border-0 shadow-lg shadow-purple-500/20" data-testid="button-signup">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section - reduced ambient gradients */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-transparent to-transparent" />
          
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-32">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span className="text-white/80">This is how stories are experienced now</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-semibold tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Turn any content into an</span>
                <span className="block bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
                  interactive cinematic experience
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed" data-testid="text-hero-description">
                NextScene transforms scripts, documents, and websites into visual story cards 
                your audience can explore, feel, and interact with.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login?signup=true">
                  <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-400 hover:via-purple-400 hover:to-blue-400 text-white border-0 shadow-lg shadow-purple-500/20 gap-3" data-testid="button-hero-cta">
                    Create a NextScene
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 gap-3" data-testid="button-hero-demo">
                  <Play className="w-5 h-5 fill-current" />
                  See how it works
                </Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-20 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                <div className="aspect-video bg-neutral-900 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20 cursor-pointer hover:from-pink-400 hover:via-purple-400 hover:to-blue-400 transition-all">
                      <Play className="w-8 h-8 text-white ml-1 fill-white" />
                    </div>
                    <p className="text-white/40 text-sm">See NextScene in action</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </section>

        {/* What is NextScene - Pipeline Visualization */}
        <section id="how-it-works" className="py-24 px-6 relative scroll-mt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-pipeline-title">
                What is <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">NextScene?</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                From content to cinematic experience in five steps
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {pipelineSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative"
                >
                  <div className="p-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 text-center h-full">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
                      <step.icon className="w-6 h-6 text-violet-400" />
                    </div>
                    <div className="text-xs text-violet-400 font-medium mb-2">Step {step.step}</div>
                    <h3 className="text-base font-bold mb-1">{step.title}</h3>
                    <p className="text-white/50 text-sm">{step.description}</p>
                  </div>
                  {index < pipelineSteps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Three Ways to Use NextScene */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-neutral-950" />
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-usecases-title">
                Three ways to use <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">NextScene</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                One engine, built for every storyteller
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link href={useCase.href}>
                    <div 
                      className="group p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-purple-500/50 cursor-pointer transition-all duration-300 hover:bg-white/5 h-full"
                      data-testid={`card-usecase-${useCase.id}`}
                    >
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-6 shadow-lg`}>
                        <useCase.icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-3 group-hover:text-purple-400 transition-colors">
                        {useCase.title}
                      </h3>
                      <p className="text-white/50 leading-relaxed mb-4">
                        {useCase.description}
                      </p>
                      <div className="flex items-center gap-2 text-purple-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Learn more <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why NextScene is Different */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-different-title">
                Why NextScene is <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">different</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {differentiators.map((diff, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <diff.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-lg font-medium">{diff.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & Control */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-neutral-950" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium bg-white/5 border border-white/10 rounded-full">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-white/70">Built for Trust</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-trust-title">
                Trust & Control
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Credibility matters. NextScene gives you full control.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trustFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent border border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-base font-bold mb-2">{feature.title}</h3>
                  <p className="text-white/50 text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-neutral-950" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-6" data-testid="text-cta-title">
                Ready to create your first<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">NextScene?</span>
              </h2>
              <p className="text-xl text-white/50 mb-10 max-w-xl mx-auto">
                Transform your content into cinematic experiences your audience will never forget
              </p>
              <Link href="/login?signup=true">
                <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-400 hover:via-purple-400 hover:to-blue-400 text-white border-0 shadow-lg shadow-purple-500/20 gap-3" data-testid="button-footer-cta">
                  Create a NextScene
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
                src={LOGO_URL} 
                alt="NextScene" 
                className="h-[60px]"
              />
              <div className="flex items-center gap-8">
                <Link href="/for/brands" className="text-white/50 hover:text-white text-sm transition-colors">Brands</Link>
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
              <p className="text-white/30 text-xs">
                © {new Date().getFullYear()} NextMonth Ltd. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
