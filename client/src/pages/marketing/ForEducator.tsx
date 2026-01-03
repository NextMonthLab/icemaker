import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, GraduationCap, CheckCircle2, Upload, BookOpen, MessageCircle, Share2, Zap, BarChart3, Shield, Lock, UserCheck, BookMarked } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import SiteNav from "@/components/SiteNav";

const useCases = [
  {
    title: "Curriculum storytelling",
    description: "Turn lessons into narrative journeys where concepts unfold over time."
  },
  {
    title: "Historical characters",
    description: "Let students explore perspectives through guided conversations with historical figures."
  },
  {
    title: "Course companions",
    description: "Create an always-on tutor that helps students practise and revise."
  }
];

const benefits = [
  "Source guardrails to support educational accuracy",
  "Accessibility features for inclusive learning",
  "Interactive characters as learning companions",
  "AI-generated visuals that bring concepts to life",
  "Daily drops that encourage consistent study habits",
  "Track engagement and progress",
  "Works with any LMS or course platform",
  "Transform lessons into story experiences"
];

export default function ForEducator() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scrollToExamples = () => {
    const element = document.getElementById('educator-examples');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToSafety = () => {
    const element = document.getElementById('safety-privacy');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white" data-nm-page="for-educators">
      <SiteNav variant="marketing" />

      <main>
        {/* Hero */}
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden pt-20 scroll-mt-24" data-nm-section="hero">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium bg-green-500/10 border border-green-500/20 rounded-full backdrop-blur-sm">
                <GraduationCap className="w-4 h-4 text-green-400" />
                <span className="text-green-300">Educators</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[0.9]" data-testid="text-hero-title">
                <span className="block text-white">Make learning unforgettable</span>
                <span className="block bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">
                  with story-driven lessons
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed" data-testid="text-hero-description">
                Transform educational content into immersive narratives that students want to continue.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/try">
                  <Button size="lg" className="h-14 px-8 text-lg bg-green-500 hover:bg-green-400 text-white border-0 shadow-lg shadow-green-500/30 gap-3" data-testid="button-hero-cta">
                    Start creating free
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
              
              {/* Classroom-safe trust strip */}
              <div className="mt-12 pt-8 border-t border-white/10">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">Classroom-safe by design</span>
                </div>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400/70" />
                    <span>Teacher-controlled content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400/70" />
                    <span>Constrained character chat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400/70" />
                    <span>Designed to discourage sharing personal data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-emerald-400/70" />
                    <span>Curriculum-aligned learning support</span>
                  </div>
                </div>
                <button 
                  onClick={scrollToSafety}
                  className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                  data-testid="link-safety-privacy"
                >
                  Safety & privacy
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 relative bg-white/[0.02] border-y border-white/5 scroll-mt-24" data-nm-section="how-it-works">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How it works
            </h2>
            
            <div className="grid md:grid-cols-4 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-green-400" />
                </div>
                <div className="text-sm font-bold text-green-400 mb-2">1</div>
                <h3 className="font-bold mb-2">Upload lesson content or a topic</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-sm font-bold text-emerald-400 mb-2">2</div>
                <h3 className="font-bold mb-2">NextMonth turns it into a chapter-based story</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-teal-400" />
                </div>
                <div className="text-sm font-bold text-teal-400 mb-2">3</div>
                <h3 className="font-bold mb-2">Add interactive characters with safe constraints</h3>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-cyan-400 mb-2">4</div>
                <h3 className="font-bold mb-2">Share a link or embed into your course platform</h3>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-24 px-6 relative scroll-mt-24" data-nm-section="use-cases">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-usecases-title">
                How educators use NextMonth
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto">
                Create story-based lessons, interactive learning companions, and chapter drops that improve engagement and retention.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-green-500/30 transition-all"
                  data-testid={`card-usecase-${index}`}
                >
                  <h3 className="text-xl font-bold mb-3">{useCase.title}</h3>
                  <p className="text-white/60 leading-relaxed">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Educator Examples / Scenarios */}
        <section id="educator-examples" className="py-24 px-6 relative bg-white/[0.02] border-y border-white/5 scroll-mt-24" data-nm-section="educator-scenarios">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Educator <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">Stories</span>
              </h2>
              <p className="text-white/50 text-lg max-w-xl mx-auto">
                See how educators use ICE (Interactive Content Experiences) to transform their teaching
              </p>
            </div>
            
            {/* History Teacher Scenario */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20"
              data-testid="scenario-history-teacher"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">History Teacher</h3>
                  <p className="text-sm text-white/50">Engaging students with the past</p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Problem
                  </div>
                  <p className="text-white/70 text-sm">
                    Dry curriculum materials and fact sheets get skimmed and forgotten. Engagement drops and results stall.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider">
                    <MessageCircle className="w-3.5 h-3.5" />
                    How they use ICE
                  </div>
                  <p className="text-white/70 text-sm">
                    They build immersive lessons where historical figures guide the learning through story chapters, with responses constrained to curriculum-aligned sources and teacher-provided material.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Outcome
                  </div>
                  <p className="text-white/70 text-sm">
                    Students engage longer, retention improves, and lessons spark discussion beyond the classroom.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-24 px-6 relative scroll-mt-24" data-nm-section="benefits">
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-benefits-title">
                Why educators choose NextMonth
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10"
                  data-testid={`text-benefit-${index}`}
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-white/80">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety & Privacy */}
        <section id="safety-privacy" className="py-24 px-6 relative bg-white/[0.02] border-y border-white/5 scroll-mt-24" data-nm-section="safety-privacy">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">Safety & privacy</span>
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Built for the classroom
              </h2>
              <p className="text-white/60 max-w-xl mx-auto">
                Every feature is designed with student safety and educational integrity in mind.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0 }}
                className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
              >
                <UserCheck className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="font-bold mb-2">Teacher-controlled content</h3>
                <p className="text-sm text-white/60">
                  You decide what material goes into each experience. Students only see content you have reviewed and approved.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
              >
                <Lock className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="font-bold mb-2">Constrained character chat</h3>
                <p className="text-sm text-white/60">
                  AI characters respond only within the boundaries you set. Conversations stay on topic and aligned to your learning objectives.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
              >
                <Shield className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="font-bold mb-2">Designed to discourage sharing personal data</h3>
                <p className="text-sm text-white/60">
                  The experience is structured to keep focus on curriculum content. Students are not prompted to share personal information.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20"
              >
                <BookMarked className="w-8 h-8 text-emerald-400 mb-4" />
                <h3 className="font-bold mb-2">Curriculum-aligned learning support</h3>
                <p className="text-sm text-white/60">
                  Responses draw from your source materials. The AI supports your teaching goals rather than introducing unvetted information.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-20 px-6 relative scroll-mt-24" data-nm-section="testimonial">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-2xl italic mb-6 text-white/80" data-testid="text-testimonial-quote">
              "My students went from dreading history homework to asking when the next chapter drops. Engagement jumped noticeably within weeks."
            </blockquote>
            <div>
              <p className="font-bold text-white" data-testid="text-testimonial-author">Dr. Maria Santos</p>
              <p className="text-sm text-white/60" data-testid="text-testimonial-role">History Professor</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden scroll-mt-24" data-nm-section="footer-cta">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white" data-testid="text-cta-title">
                Ready to transform your educational content?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                Create lessons students can explore, not just read.
              </p>
              <p className="text-white/60 text-sm mb-8">
                Join educators already creating story-driven lessons with NextMonth.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/try">
                  <Button size="lg" variant="secondary" className="h-16 px-12 text-lg gap-3" data-testid="button-footer-cta">
                    Start creating free
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={scrollToExamples}
                  className="h-16 px-8 text-lg border-white/30 text-white hover:bg-white/10"
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
                <Link href="/for/creators" className="text-white/50 hover:text-white text-sm transition-colors">Creators</Link>
                <Link href="/for/knowledge" className="text-white text-sm transition-colors">Knowledge</Link>
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
