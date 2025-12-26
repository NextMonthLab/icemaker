import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, Users, Newspaper, Building2, Star, GraduationCap, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

const personas = [
  {
    id: "news_outlet",
    title: "News & Media",
    description: "Transform breaking news into immersive visual stories that captivate audiences",
    icon: Newspaper,
    href: "/for/news",
    color: "from-red-500/20 to-orange-500/20",
    borderColor: "border-red-500/30 hover:border-red-500",
  },
  {
    id: "business",
    title: "Businesses",
    description: "Turn product launches and brand stories into engaging visual narratives",
    icon: Building2,
    href: "/for/business",
    color: "from-blue-500/20 to-cyan-500/20",
    borderColor: "border-blue-500/30 hover:border-blue-500",
  },
  {
    id: "influencer",
    title: "Creators & Influencers",
    description: "Build deeper connections with serialized content your audience can't wait to see",
    icon: Star,
    href: "/for/influencer",
    color: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/30 hover:border-purple-500",
  },
  {
    id: "educator",
    title: "Educators",
    description: "Make learning unforgettable with story-driven lessons and interactive content",
    icon: GraduationCap,
    href: "/for/educator",
    color: "from-green-500/20 to-emerald-500/20",
    borderColor: "border-green-500/30 hover:border-green-500",
  },
];

const features = [
  {
    title: "AI-Powered Transform",
    description: "Paste any URL and watch AI transform your content into stunning visual story cards",
  },
  {
    title: "Daily Drops",
    description: "Keep audiences coming back with scheduled story releases that build anticipation",
  },
  {
    title: "Interactive Characters",
    description: "Let your audience chat with AI-powered characters from your stories",
  },
  {
    title: "Video Generation",
    description: "Turn static content into cinematic video clips ready for social sharing",
  },
];

export default function MarketingHome() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-display font-black tracking-tight cursor-pointer" data-testid="link-logo">
              StoryFlix
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/app">
                <Button data-testid="button-dashboard">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" data-testid="button-login">Sign In</Button>
                </Link>
                <Link href="/login?signup=true">
                  <Button data-testid="button-signup">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative overflow-hidden py-20 px-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block px-3 py-1 mb-6 text-xs font-bold bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                Transform Any Content Into Stories
              </span>
              <h1 className="text-4xl md:text-6xl font-display font-black tracking-tight mb-6" data-testid="text-hero-title">
                Turn Your Content Into
                <span className="text-primary block">Addictive Daily Drops</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-hero-description">
                StoryFlix transforms articles, videos, and ideas into immersive visual story cards 
                that keep audiences coming back day after day.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login?signup=true">
                  <Button size="lg" className="gap-2" data-testid="button-hero-cta">
                    Start Creating Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-hero-demo">
                  <Play className="w-4 h-4" />
                  Watch Demo
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 px-4 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4" data-testid="text-personas-title">
                Built for Storytellers Like You
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Whether you're a newsroom, brand, creator, or educator, StoryFlix adapts to your needs
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {personas.map((persona, index) => (
                <motion.div
                  key={persona.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Link href={persona.href}>
                    <div 
                      className={`group p-6 rounded-xl border ${persona.borderColor} bg-gradient-to-br ${persona.color} cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg`}
                      data-testid={`card-persona-${persona.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-background/50 shadow-sm">
                          <persona.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-display font-bold mb-2 group-hover:text-primary transition-colors">
                            {persona.title}
                          </h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            {persona.description}
                          </p>
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                            Learn more <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1 px-3 py-1 mb-4 text-xs font-bold bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Powered by AI
              </span>
              <h2 className="text-3xl font-display font-bold mb-4" data-testid="text-features-title">
                Everything You Need to Tell Stories
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                  className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
                  data-testid={`card-feature-${index}`}
                >
                  <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-display font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-cta-title">
              Ready to Transform Your Content?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Start creating captivating story experiences in minutes. No credit card required.
            </p>
            <Link href="/login?signup=true">
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-footer-cta">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            2024 StoryFlix. All rights reserved.
          </span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
