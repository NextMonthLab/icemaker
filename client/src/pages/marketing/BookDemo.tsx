import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Mail, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";

export default function BookDemo() {
  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20 mb-6">
              <Calendar className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6" data-testid="text-demo-title">
              Book a demo
            </h1>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              See how IceMaker can transform your training, sales enablement, or marketing content into interactive experiences.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 rounded-lg bg-neutral-900/50 border border-white/10"
          >
            <div className="text-center mb-8">
              <p className="text-white/70 mb-6">
                Get in touch to schedule a personalised walkthrough with your own content.
              </p>
              <a 
                href="mailto:hello@icemaker.app?subject=Demo%20Request" 
                className="inline-flex"
              >
                <Button size="lg" className="gap-2 text-base px-8" data-testid="button-email-demo">
                  <Mail className="w-4 h-4" />
                  hello@icemaker.app
                </Button>
              </a>
            </div>

            <div className="border-t border-white/10 pt-8">
              <p className="text-white/50 text-sm text-center mb-6">
                Or start building right away:
              </p>
              <div className="flex justify-center">
                <Link href="/try">
                  <Button variant="outline" size="lg" className="gap-2 text-base px-8" data-testid="button-start-building">
                    Start building
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
