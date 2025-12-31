import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, Building2, Film, GraduationCap, Upload, Wand2, MessageCircle, Share2, Shield, Eye, Lock, CheckCircle2, Radio, Clock, DollarSign, Zap, BookOpen, Megaphone, Lightbulb } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { useEffect } from "react";
import MarketingHeader from "@/components/MarketingHeader";

const useCases = [
  {
    id: "brands",
    title: "For Brands & Businesses",
    description: "Orbit is a Business-to-AI interface that helps you control how your brand is represented in AI-powered discovery.",
    icon: Building2,
    href: "/for/brands",
    color: "from-pink-500 to-purple-500",
    microCta: "Claim your business Orbit",
    intent: "brands",
    secondaryLink: "/ai-discovery-control",
    secondaryCta: "Why this matters",
  },
  {
    id: "creators",
    title: "For Creators & Filmmakers",
    description: "Bring scripts and ideas to life, one moment at a time.",
    icon: Film,
    href: "/for/creators",
    color: "from-purple-500 to-blue-500",
    microCta: "Bring my script to life",
    intent: "creators",
  },
  {
    id: "knowledge",
    title: "For Knowledge & Learning",
    description: "Transform dense information into experiences people remember.",
    icon: GraduationCap,
    href: "/for/knowledge",
    color: "from-blue-500 to-indigo-500",
    microCta: "Transform my material",
    intent: "knowledge",
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
    description: "Themes and structure, not just summaries",
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
    description: "Source-grounded chat audiences can trust",
    icon: MessageCircle,
  },
  {
    step: 5,
    title: "Share everywhere",
    description: "Link, embed, or export as an asset",
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

const valueComparison = [
  {
    path: "Traditional Agency",
    time: "2-4 weeks",
    cost: "$5,000+",
    timeLabel: "Weeks of waiting",
    costLabel: "Thousands spent",
    highlight: false,
  },
  {
    path: "DIY Tools",
    time: "30+ hours",
    cost: "$100+/mo",
    timeLabel: "Hours of learning",
    costLabel: "Multiple subscriptions",
    highlight: false,
  },
  {
    path: "NextMonth",
    time: "Under 1 hour",
    cost: "From $9.99",
    timeLabel: "Minutes to create",
    costLabel: "Pay per experience",
    highlight: true,
  },
];

const iceUseCases = [
  {
    title: "Marketing & Sales",
    description: "Interactive landing pages, product explainers, and pitch experiences that convert.",
    icon: Megaphone,
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Content & Publishing",
    description: "Turn articles, blogs, or scripts into interactive stories people actually finish.",
    icon: BookOpen,
    color: "from-purple-500 to-violet-500",
  },
  {
    title: "Training & Knowledge",
    description: "Onboarding, education, and internal explainers that stick in memory.",
    icon: GraduationCap,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Creative & Storytelling",
    description: "Narrative prototypes, interactive films, and character-driven experiences.",
    icon: Lightbulb,
    color: "from-amber-500 to-orange-500",
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
      <MarketingHeader />

      <main>
        {/* Hero Section - reduced ambient gradients */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-950/20 via-transparent to-transparent" />
          
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-pink-500/10 border border-pink-500/20 rounded-full backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span className="text-white/80">This is how stories are experienced now</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[0.95]" data-testid="text-hero-title">
                Turn anything into an{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">interactive experience</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-6 leading-relaxed" data-testid="text-hero-description">
                Transform documents, decks, and web pages into cinematic journeys people can explore, feel, and remember.
              </p>
              
              <p className="text-base text-white/50 max-w-2xl mx-auto mb-10">
                Built for brands, creators, and educators who want people to engage, not just scroll.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/try">
                  <Button size="lg" className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3 rounded-xl" data-testid="button-hero-cta">
                    Launch Experience Builder
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 gap-3 rounded-xl" data-testid="button-hero-demo">
                  <Play className="w-5 h-5 fill-current" />
                  See how it works
                </Button>
              </div>
              
              <p className="text-sm text-white/40 mt-6">
                No code required. Share as a link or embed on your site.
              </p>
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
                    <p className="text-white/40 text-sm">See NextMonth in action</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </section>

        {/* Value Framing Section - Time Comparison */}
        <section className="py-20 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-value-title">
                <span className="text-white/80">Weeks</span>{' '}
                <span className="text-white/40">→</span>{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">Minutes</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Creating interactive experiences used to take forever. Not anymore.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4">
              {valueComparison.map((item, index) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`p-6 rounded-2xl border transition-all ${
                    item.highlight 
                      ? 'bg-gradient-to-b from-purple-900/30 to-pink-900/20 border-purple-500/50 shadow-lg shadow-purple-500/10' 
                      : 'bg-white/5 border-white/10'
                  }`}
                  data-testid={`card-comparison-${index}`}
                >
                  <p className={`text-sm font-medium mb-4 ${item.highlight ? 'text-purple-400' : 'text-white/40'}`}>
                    {item.path}
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        item.highlight ? 'bg-purple-500/20' : 'bg-white/10'
                      }`}>
                        <Clock className={`w-5 h-5 ${item.highlight ? 'text-purple-400' : 'text-white/40'}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${item.highlight ? 'text-white' : 'text-white/70'}`}>
                          {item.time}
                        </p>
                        <p className="text-xs text-white/40">{item.timeLabel}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        item.highlight ? 'bg-pink-500/20' : 'bg-white/10'
                      }`}>
                        <DollarSign className={`w-5 h-5 ${item.highlight ? 'text-pink-400' : 'text-white/40'}`} />
                      </div>
                      <div>
                        <p className={`text-2xl font-bold ${item.highlight ? 'text-white' : 'text-white/70'}`}>
                          {item.cost}
                        </p>
                        <p className="text-xs text-white/40">{item.costLabel}</p>
                      </div>
                    </div>
                  </div>

                  {item.highlight && (
                    <div className="mt-6 pt-4 border-t border-purple-500/20">
                      <Link href="/try">
                        <Button size="sm" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0" data-testid="button-comparison-cta">
                          Try it now <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ICE Use Cases Section */}
        <section className="py-20 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />
          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-usecases-title">
                What people use{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">ICE</span>{' '}
                for
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Interactive Cinematic Experiences for every storytelling need
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {iceUseCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                  data-testid={`card-iceuse-${index}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <useCase.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                        {useCase.title}
                      </h3>
                      <p className="text-white/50 text-sm leading-relaxed">
                        {useCase.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 text-center"
            >
              <Link href="/try">
                <Button size="lg" className="h-12 px-8 bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-2" data-testid="button-usecases-cta">
                  Start building your experience
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* AI Discovery Shift Section */}
        <section className="py-20 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-4xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium bg-pink-500/10 border border-pink-500/20 rounded-full backdrop-blur-sm">
                <Radio className="w-4 h-4 text-pink-400" />
                <span className="text-pink-300">AI Discovery</span>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold mb-6" data-testid="text-ai-discovery-title">
                Discovery has changed.{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">AI now answers.</span>
              </h2>
              
              <p className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-10 leading-relaxed">
                People no longer find businesses only through search results.
                They ask AI systems like ChatGPT and Gemini and trust the answers.
                Orbit helps you control how your business is understood, described, and recommended.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/ai-discovery-control">
                  <Button size="lg" className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-ai-discovery-learn">
                    Learn about AI discovery
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/for/brands">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/20 text-white hover:bg-white/10 gap-3" data-testid="button-ai-discovery-claim">
                    Claim your business Orbit
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* What is NextMonth - Pipeline Visualization */}
        <section id="how-it-works" className="py-24 px-6 relative scroll-mt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-pipeline-title">
                What is <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">NextMonth?</span>
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

        {/* Three Ways to Use NextMonth */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-neutral-950" />
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-usecases-title">
                Three ways to use <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">NextMonth</span>
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
                  <div 
                    className="group p-8 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:bg-white/5 h-full flex flex-col"
                    data-testid={`card-usecase-${useCase.id}`}
                  >
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-6 shadow-lg`}>
                      <useCase.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 group-hover:text-purple-400 transition-colors">
                      {useCase.title}
                    </h3>
                    <p className="text-white/50 leading-relaxed mb-4 flex-grow">
                      {useCase.description}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Link href={useCase.href}>
                        <button 
                          className="flex items-center gap-2 text-pink-400 hover:text-pink-300 text-sm font-medium transition-colors cursor-pointer"
                          data-testid={`button-microcta-${useCase.id}`}
                        >
                          {useCase.microCta} <ArrowRight className="w-4 h-4" />
                        </button>
                      </Link>
                      {useCase.secondaryLink && (
                        <Link href={useCase.secondaryLink}>
                          <span className="text-white/40 hover:text-white/60 text-sm transition-colors cursor-pointer">
                            {useCase.secondaryCta}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why NextMonth is Different */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4" data-testid="text-different-title">
                Why NextMonth is <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">different</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Replace flat links with guided journeys. Great for pitches, onboarding, learning, and sales.
              </p>
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
                Credibility matters. NextMonth gives you full control.
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

        {/* Website Experience Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-black" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-6xl font-bold mb-6" data-testid="text-website-title">
                Turn your website into an<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">interactive experience</span>
              </h2>
              <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
                Close the gap between where visitors land and where your best information lives. Guide them through what matters instead of hoping they find it.
              </p>
              <Link href="/try">
                <Button size="lg" className="h-14 px-8 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3 rounded-xl" data-testid="button-website-cta">
                  Launch Experience Builder
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <p className="text-sm text-white/40 mt-4">
                Start with a URL. Publish in minutes.
              </p>
            </motion.div>
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
              <h2 className="text-4xl md:text-6xl font-bold mb-6" data-testid="text-cta-title">
                Stop sending links.<br />
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">Start guiding people.</span>
              </h2>
              <p className="text-xl text-white/50 mb-10 max-w-xl mx-auto">
                Turn your content into an interactive journey that people actually finish.
              </p>
              <Link href="/try">
                <Button size="lg" className="h-16 px-12 text-lg bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/30 gap-3" data-testid="button-footer-cta">
                  Launch Experience Builder
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Proof Strip */}
        <Link href="/ai-discovery-control">
          <section className="py-8 px-6 relative cursor-pointer group" data-testid="section-proof-strip">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5 group-hover:from-pink-500/10 group-hover:via-purple-500/10 group-hover:to-blue-500/10 transition-all" />
            <div className="max-w-4xl mx-auto relative z-10 text-center">
              <p className="text-lg md:text-xl text-white/60 group-hover:text-white/80 transition-colors">
                Stop being interpreted by default. Give AI a source it can trust.
              </p>
            </div>
          </section>
        </Link>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10 bg-black">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <img 
                src="/logo.png" 
                alt="NextMonth" 
                className="h-[48px]"
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
