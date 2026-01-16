import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, Calendar, Loader2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { useToast } from "@/hooks/use-toast";

export default function BookDemo() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in your name and email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/contact/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setIsSubmitted(true);
      toast({
        title: "Request received!",
        description: "We'll be in touch within 24 hours to schedule your demo.",
      });
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or email us directly at hello@icemaker.app",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-6">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Thanks for reaching out!</h2>
                <p className="text-white/60 mb-6">
                  We'll review your request and get back to you within 24 hours to schedule your personalised demo.
                </p>
                <Link href="/try">
                  <Button variant="outline" size="lg" className="gap-2">
                    Start building now
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <p className="text-white/70 text-center mb-6">
                  Fill in your details and we'll schedule a personalised walkthrough with your own content.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/80">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your name"
                        className="bg-black/50 border-white/20 text-white placeholder:text-white/40"
                        data-testid="input-demo-name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/80">Work email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@company.com"
                        className="bg-black/50 border-white/20 text-white placeholder:text-white/40"
                        data-testid="input-demo-email"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-white/80">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Your company name"
                      className="bg-black/50 border-white/20 text-white placeholder:text-white/40"
                      data-testid="input-demo-company"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-white/80">What would you like to explore?</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us about your training, sales enablement, or content needs..."
                      className="bg-black/50 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                      data-testid="textarea-demo-message"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full gap-2 text-base"
                    disabled={isSubmitting}
                    data-testid="button-submit-demo"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Request a demo"
                    )}
                  </Button>
                </form>

                <div className="border-t border-white/10 pt-6 mt-6">
                  <p className="text-white/50 text-sm text-center mb-4">
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
              </>
            )}
          </motion.div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
