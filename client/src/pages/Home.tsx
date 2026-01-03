import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Play, 
  ArrowRight, 
  Sparkles, 
  Target, 
  Lightbulb, 
  Rocket,
  CheckCircle2,
  Clock,
  PoundSterling,
  Shield,
  MessageSquare,
  Megaphone,
  BookOpen,
  Film,
  ExternalLink
} from "lucide-react";

export default function Home() {
  return (
    <Layout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative py-20 px-4 md:px-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-blue-900/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
          
          <div className="relative max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <span className="inline-block px-4 py-1.5 text-xs font-bold tracking-widest text-purple-400 uppercase bg-purple-500/10 border border-purple-500/20 rounded-full">
                ICE = Interactive Cinematic Experiences
              </span>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-black text-white leading-tight" data-testid="hero-headline">
                Stop sending links.
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Start guiding people.
                </span>
              </h1>
              
              <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed" data-testid="hero-subheadline">
                Turn websites, PDFs and decks into Interactive Cinematic Experiences people can explore, feel, and remember.
              </p>
              
              <p className="text-base text-white/50 max-w-xl mx-auto">
                NextMonth is the engine that turns your business knowledge into trusted AI discovery and interactive experiences, without a production team.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link href="/try">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg font-semibold shadow-lg shadow-purple-500/25"
                  data-testid="cta-launch-builder"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Experience Builder
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg"
                  data-testid="cta-how-it-works"
                >
                  <Play className="w-5 h-5 mr-2" />
                  See how it works
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-white/40 pt-2">
              No code required. Share as a link or embed on your site.
              <br />
              Built for brands, creators, and educators who want people to engage, not just scroll.
            </p>
          </div>
        </section>

        {/* Workflow Section: Orbit → Launchpad → ICE */}
        <section id="how-it-works" className="py-20 px-4 md:px-8 bg-neutral-900/60 border-y border-white/10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">One clear workflow</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mt-4" data-testid="workflow-headline">
                From knowledge to discovery to experience
              </h2>
              <p className="text-white/60 mt-4 max-w-xl mx-auto">
                NextMonth works as a simple pipeline:
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {/* Step 1: Orbit */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 hover:border-blue-500/40 transition-all group">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
                  1
                </div>
                <div className="pt-4">
                  <Target className="w-10 h-10 text-blue-400 mb-4" />
                  <h3 className="text-xl font-display font-bold text-white mb-2">Orbit</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Create a source AI can trust. Control how your business is described, recommended, and understood.
                  </p>
                </div>
              </div>
              
              {/* Step 2: Launchpad */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
                  2
                </div>
                <div className="pt-4">
                  <Lightbulb className="w-10 h-10 text-purple-400 mb-4" />
                  <h3 className="text-xl font-display font-bold text-white mb-2">Launchpad</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    See what people ask. Spot gaps, objections, and opportunities, then turn them into content.
                  </p>
                </div>
              </div>
              
              {/* Step 3: ICE */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/20 hover:border-pink-500/40 transition-all group">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-pink-500/30">
                  3
                </div>
                <div className="pt-4">
                  <Sparkles className="w-10 h-10 text-pink-400 mb-4" />
                  <h3 className="text-xl font-display font-bold text-white mb-2">ICE</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Publish insights as cinematic, interactive journeys. Audiences can explore and ask questions, grounded in your source.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
              <Link href="/orbit/claim">
                <Button variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10" data-testid="cta-claim-orbit">
                  <Target className="w-4 h-4 mr-2" />
                  Claim your Orbit
                </Button>
              </Link>
              <Link href="/try">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" data-testid="cta-launch-builder-2">
                  <Rocket className="w-4 h-4 mr-2" />
                  Launch Experience Builder
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* AI Discovery Section */}
        <section className="py-20 px-4 md:px-8 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-yellow-400 uppercase bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-full">AI Discovery</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mt-4" data-testid="discovery-headline">
                Discovery has changed. AI now answers.
              </h2>
              <p className="text-white/60 mt-4 max-w-2xl mx-auto leading-relaxed">
                People don't only search and browse. They ask ChatGPT and Gemini and trust the response. If you are not providing a clear source, you get interpreted by default.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 text-center">
              <h3 className="text-2xl font-display font-bold text-white mb-4">
                Orbit helps you become the source.
              </h3>
              <p className="text-white/60 max-w-lg mx-auto">
                So customers, prospects, and partners get consistent answers, backed by your content.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                <Link href="/about/ai-discovery">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" data-testid="cta-learn-ai-discovery">
                    Learn about AI discovery
                  </Button>
                </Link>
                <Link href="/orbit/claim">
                  <Button className="bg-blue-600 hover:bg-blue-700" data-testid="cta-claim-orbit-discovery">
                    <Target className="w-4 h-4 mr-2" />
                    Claim your Orbit
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Comparison */}
        <section className="py-20 px-4 md:px-8 bg-neutral-900/60 border-y border-white/10 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-green-400 uppercase bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full">Weeks → Minutes</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mt-4">
                Creating interactive experiences used to take forever. Not anymore.
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Traditional Agency */}
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10">
                <h3 className="font-bold text-white/60 mb-4">Traditional Agency</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">2 to 4 weeks</p>
                      <p className="text-xs text-white/40">Weeks of waiting</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PoundSterling className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">£4,000+</p>
                      <p className="text-xs text-white/40">Thousands spent</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* DIY Tools */}
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10">
                <h3 className="font-bold text-white/60 mb-4">DIY Tools</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">30+ hours</p>
                      <p className="text-xs text-white/40">Hours of learning</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PoundSterling className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">£79+/month</p>
                      <p className="text-xs text-white/40">Multiple subscriptions</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* NextMonth */}
              <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-2 border-green-500/30 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                  Recommended
                </div>
                <h3 className="font-bold text-green-400 mb-4">NextMonth</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">Under 1 hour</p>
                      <p className="text-xs text-white/40">Minutes to create</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PoundSterling className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">From £9.99</p>
                      <p className="text-xs text-white/40">Per experience</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <Link href="/try">
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" data-testid="cta-try-now">
                  Try it now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-20 px-4 md:px-8 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-purple-400 uppercase bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full">What people use ICE for</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mt-4">
                Interactive Cinematic Experiences for every storytelling need
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 hover:border-purple-500/30 transition-all">
                <Megaphone className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Marketing & Sales</h3>
                <p className="text-white/60 text-sm">
                  Interactive landing pages, product explainers, pitch journeys, and proposals that convert.
                </p>
              </div>
              
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 hover:border-blue-500/30 transition-all">
                <BookOpen className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Content & Publishing</h3>
                <p className="text-white/60 text-sm">
                  Turn articles, blogs, or scripts into guided stories people actually finish.
                </p>
              </div>
              
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 hover:border-green-500/30 transition-all">
                <MessageSquare className="w-8 h-8 text-green-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Training & Knowledge</h3>
                <p className="text-white/60 text-sm">
                  Onboarding, education, and internal explainers that stick.
                </p>
              </div>
              
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 hover:border-pink-500/30 transition-all">
                <Film className="w-8 h-8 text-pink-400 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Creative & Storytelling</h3>
                <p className="text-white/60 text-sm">
                  Narrative prototypes, interactive films, and character-led journeys.
                </p>
              </div>
            </div>
            
            <div className="text-center mt-10">
              <Link href="/try">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" data-testid="cta-start-building">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start building your experience
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Case Study Teaser */}
        <section className="py-20 px-4 md:px-8 bg-neutral-900/60 border-y border-white/10 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full">Real examples</span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mt-4">
                See how real people use ICE
              </h2>
              <p className="text-white/60 mt-4">
                From technical documents to creative stories, these scenarios show what's possible.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Innovative Manufacturer</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-white/40 font-medium">They have:</span>
                      <p className="text-white/70 mt-1">Dense technical documentation, CAD specs, and engineering white papers that overwhelm prospects and slow sales cycles.</p>
                    </div>
                    <div>
                      <span className="text-white/40 font-medium">They use ICE to:</span>
                      <p className="text-white/70 mt-1">Turn product specs into a guided experience where an AI engineer walks prospects through key features, answers questions in real time, and shows use cases visually.</p>
                    </div>
                    <div>
                      <span className="text-white/40 font-medium">The outcome:</span>
                      <p className="text-white mt-1 font-medium">Prospects self-educate, sales cycles shorten, and complexity becomes a competitive advantage instead of a barrier.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <Link href="/examples">
                  <Button variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10" data-testid="cta-see-examples">
                    See NextMonth in action
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-20 px-4 md:px-8 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-green-400 uppercase bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full mb-6">Trust & Control</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Built for trust, not hallucinations
            </h2>
            <p className="text-white/60 mb-10 max-w-xl mx-auto">
              Credibility matters. NextMonth gives you control.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/80 text-sm">Creator-editable prompts so the experience sounds like you</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/80 text-sm">Explicit guardrails to prevent drift from source</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/80 text-sm">Source-grounded chat so characters only know what you provide</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/80 text-sm">Human review before publishing where required</p>
              </div>
            </div>
          </div>
        </section>

        {/* Website to ICE Section */}
        <section className="py-20 px-4 md:px-8 bg-gradient-to-br from-purple-900/20 via-background to-pink-900/20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Turn your website into an interactive experience
            </h2>
            <p className="text-white/60 mb-4 max-w-xl mx-auto">
              Close the gap between where visitors land and where your best information lives. Guide them through what matters instead of hoping they find it.
            </p>
            <p className="text-white/40 text-sm mb-8">
              Start with a URL. Publish in minutes.
            </p>
            
            <Link href="/try">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-10 py-6 text-lg font-semibold shadow-lg shadow-purple-500/25"
                data-testid="cta-website-to-ice"
              >
                <Rocket className="w-5 h-5 mr-2" />
                Launch Experience Builder
              </Button>
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4 md:px-8 bg-neutral-900/60 border-t border-white/10 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
              Stop being interpreted by default.
              <br />
              <span className="text-white/70">Give AI a source it can trust.</span>
            </h2>
            <p className="text-white/50 max-w-lg mx-auto">
              Turn your content into an interactive journey people actually finish.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Link href="/try">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-6 text-lg font-semibold"
                  data-testid="cta-final-builder"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Experience Builder
                </Button>
              </Link>
              <Link href="/orbit/claim">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 px-8 py-6 text-lg"
                  data-testid="cta-final-orbit"
                >
                  <Target className="w-5 h-5 mr-2" />
                  Claim your Orbit
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
