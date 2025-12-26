import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, Newspaper, Building2, Star, GraduationCap, Film, Wand2, MessageCircle, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { useEffect } from "react";

const personas = [
  {
    id: "news_outlet",
    title: "News & Media",
    description: "Transform breaking news into immersive visual stories",
    icon: Newspaper,
    href: "/for/news",
  },
  {
    id: "business",
    title: "Businesses",
    description: "Turn brand stories into engaging narratives",
    icon: Building2,
    href: "/for/business",
  },
  {
    id: "influencer",
    title: "Creators",
    description: "Build serialized content your audience craves",
    icon: Star,
    href: "/for/influencer",
  },
  {
    id: "educator",
    title: "Educators",
    description: "Make learning unforgettable with stories",
    icon: GraduationCap,
    href: "/for/educator",
  },
];

const features = [
  {
    title: "AI Transform",
    description: "Paste any URL. Watch AI create stunning visual story cards in seconds.",
    icon: Wand2,
  },
  {
    title: "Daily Drops",
    description: "Keep audiences hooked with scheduled releases that build anticipation.",
    icon: Film,
  },
  {
    title: "Character Chat",
    description: "Let viewers chat with AI characters that live inside your stories.",
    icon: MessageCircle,
  },
  {
    title: "Video Export",
    description: "Generate cinematic clips ready for TikTok, Reels, and Shorts.",
    icon: Share2,
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
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/">
            <span className="text-2xl font-display font-black tracking-tight cursor-pointer bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent" data-testid="link-logo">
              STORYFLIX
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" data-testid="button-login">
                Sign In
              </Button>
            </Link>
            <Link href="/login?signup=true">
              <Button className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white border-0 shadow-lg shadow-red-500/25" data-testid="button-signup">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-br from-red-600/10 via-orange-600/5 to-transparent" />
          
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="max-w-5xl mx-auto px-6 text-center relative z-10 pt-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-red-400" />
                <span className="text-white/80">The future of interactive storytelling</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Stories that</span>
                <span className="block bg-gradient-to-r from-red-500 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                  keep them coming back
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed" data-testid="text-hero-description">
                Transform any content into addictive daily story drops. 
                Let your audience chat with characters. Watch engagement soar.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login?signup=true">
                  <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white border-0 shadow-xl shadow-red-500/30 gap-3" data-testid="button-hero-cta">
                    Start Creating Free
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 gap-3 backdrop-blur-sm" data-testid="button-hero-demo">
                  <Play className="w-5 h-5 fill-current" />
                  Watch Demo
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
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-red-500/10">
                <div className="aspect-video bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/30 cursor-pointer hover:scale-105 transition-transform">
                      <Play className="w-8 h-8 text-white ml-1 fill-white" />
                    </div>
                    <p className="text-white/40 text-sm">See StoryFlix in action</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
        </section>

        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4" data-testid="text-personas-title">
                Built for <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">every storyteller</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                From newsrooms to creators, StoryFlix adapts to your unique voice
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {personas.map((persona, index) => (
                <motion.div
                  key={persona.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link href={persona.href}>
                    <div 
                      className="group p-6 rounded-xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-red-500/50 cursor-pointer transition-all duration-300 hover:bg-white/5"
                      data-testid={`card-persona-${persona.id}`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mb-4 group-hover:from-red-500/30 group-hover:to-orange-500/30 transition-colors">
                        <persona.icon className="w-6 h-6 text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold mb-2 group-hover:text-red-400 transition-colors">
                        {persona.title}
                      </h3>
                      <p className="text-white/50 text-sm leading-relaxed">
                        {persona.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-3xl" />
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-full">
                <Sparkles className="w-4 h-4 text-red-400" />
                <span className="text-red-300">AI-Powered</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4" data-testid="text-features-title">
                Everything you need to captivate
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                Professional-grade storytelling tools, powered by cutting-edge AI
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-all duration-300"
                  data-testid={`card-feature-${index}`}
                >
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20">
                      <feature.icon className="w-7 h-7 text-white" />
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

        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-red-950/40 via-red-950/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-6" data-testid="text-cta-title">
                Ready to create stories<br />
                <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                  they can't stop watching?
                </span>
              </h2>
              <p className="text-xl text-white/50 mb-10 max-w-xl mx-auto">
                Join thousands of creators building the next generation of interactive content
              </p>
              <Link href="/login?signup=true">
                <Button size="lg" className="h-16 px-12 text-lg bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white border-0 shadow-xl shadow-red-500/30 gap-3" data-testid="button-footer-cta">
                  Start Creating Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <footer className="py-12 px-6 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xl font-display font-black tracking-tight bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
              STORYFLIX
            </span>
            <div className="flex items-center gap-8">
              <Link href="/for/news" className="text-white/50 hover:text-white text-sm transition-colors">News & Media</Link>
              <Link href="/for/business" className="text-white/50 hover:text-white text-sm transition-colors">Business</Link>
              <Link href="/for/influencer" className="text-white/50 hover:text-white text-sm transition-colors">Creators</Link>
              <Link href="/for/educator" className="text-white/50 hover:text-white text-sm transition-colors">Educators</Link>
            </div>
            <p className="text-white/30 text-sm">
              © 2025 StoryFlix. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
