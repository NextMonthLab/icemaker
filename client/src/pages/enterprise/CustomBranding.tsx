import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  ArrowRight, 
  Palette, 
  Type, 
  Music, 
  Sparkles,
  FolderOpen,
  Video,
  Check,
  Shield,
  Users,
  MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const featureBlocks = [
  {
    icon: Type,
    title: "Custom Title Packs",
    description: "Typography systems designed to match your brand guidelines exactly.",
    bullets: [
      "Fonts, colours, and motion rules aligned to your style",
      "Lower-thirds, scene titles, intro/outro variants",
      "Multiple layouts (top, middle, bottom) with correct spacing",
      "Size rules for consistent hierarchy",
    ],
  },
  {
    icon: Palette,
    title: "Branded Captions and Data Styling",
    description: "Caption styles and data visualisation that feel native to your brand.",
    bullets: [
      "Caption animation aligned to brand motion language",
      "Graph and chart title styling",
      "Overlay treatments and safe defaults for teams",
      "Consistent colour application across all exports",
    ],
  },
  {
    icon: Music,
    title: "Custom Music and Sonic Identity",
    description: "Audio that reinforces your brand at every touchpoint.",
    bullets: [
      "Approved music beds and mood packs",
      "Optional sonic logo and stings",
      "Consistent intro/outro audio",
      "Mood-based selection for different content types",
    ],
  },
  {
    icon: Sparkles,
    title: "Custom Sound Effects Pack",
    description: "Brand-appropriate SFX that elevate your content without distraction.",
    bullets: [
      "Curated SFX library matched to your tone",
      "Transition effects for reveals and emphasis",
      "Moment effects for key points",
      "Consistent audio language across all content",
    ],
  },
  {
    icon: FolderOpen,
    title: "Brand Asset Library",
    description: "A centralised home for approved visual assets.",
    bullets: [
      "Upload logos, imagery, icons, and b-roll",
      "Template library for common use cases",
      "IceMaker prefers approved assets over generic stock",
      "Version control and asset governance",
    ],
  },
  {
    icon: Video,
    title: "Done-for-you Media Production",
    description: "Professional video and photography as a managed service.",
    bullets: [
      "Filmed video intros and outros",
      "Presenter footage and interviews",
      "B-roll and campaign asset creation",
      "Photography for product and team content",
    ],
    note: "Available as a managed service. Quoted separately.",
  },
];

const steps = [
  {
    number: "1",
    title: "Discovery and brand guidelines",
    description: "We review your brand guidelines, existing assets, and requirements to understand your visual and sonic identity.",
  },
  {
    number: "2",
    title: "Build the Brand Pack",
    description: "Our team creates your custom title packs, caption styles, audio library, and asset library - all aligned to your brand.",
  },
  {
    number: "3",
    title: "Deploy to your workspace",
    description: "Your Brand Pack is deployed into your IceMaker workspace with governance controls so your team creates on-brand content every time.",
  },
];

const customisationOptions = [
  { id: "title-packs", label: "Title packs" },
  { id: "captions", label: "Captions and data styling" },
  { id: "music", label: "Music and sonic identity" },
  { id: "sfx", label: "Sound effects" },
  { id: "asset-library", label: "Asset library" },
  { id: "filming", label: "Filming" },
  { id: "photography", label: "Photography" },
];

export default function CustomBranding() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    customisations: [] as string[],
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCustomisationChange = (optionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      customisations: checked
        ? [...prev.customisations, optionId]
        : prev.customisations.filter(id => id !== optionId),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/enterprise/branding-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Enquiry submitted",
          description: "We'll be in touch within 2 business days.",
        });
        setFormData({
          name: "",
          company: "",
          email: "",
          customisations: [],
          notes: "",
        });
      } else {
        throw new Error("Failed to submit");
      }
    } catch {
      toast({
        title: "Enquiry received",
        description: "We'll be in touch within 2 business days.",
      });
      setFormData({
        name: "",
        company: "",
        email: "",
        customisations: [],
        notes: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToContact = () => {
    document.getElementById("contact-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-6">
                <Shield className="w-4 h-4" />
                Enterprise
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6" data-testid="text-hero-title">
                Enterprise Custom Branding
              </h1>
              <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto">
                Consistent, brand-safe outputs across interactive experiences and video.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="gap-2 text-base px-8" 
                  onClick={scrollToContact}
                  data-testid="button-talk-to-us"
                >
                  Talk to us about custom branding
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 text-base px-8"
                  onClick={scrollToFeatures}
                  data-testid="button-see-included"
                >
                  See what's included
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* What this unlocks */}
        <section className="py-16 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-6">
                Turn IceMaker into your on-brand content factory
              </h2>
              <p className="text-white/60 text-lg leading-relaxed">
                IceMaker can be configured with a complete brand system so every export - 
                whether interactive experience or video - looks like your business created 
                it in-house. Your team gets creative freedom within brand-safe guardrails, 
                and your audience gets a consistent experience every time.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Feature blocks */}
        <section id="features" className="py-16 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">What's included</h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto">
                Every element of your content, styled to your brand specifications.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featureBlocks.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Card className="h-full bg-neutral-900/50 border-white/10 hover:border-cyan-500/30 transition-colors">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
                        <feature.icon className="w-6 h-6 text-cyan-400" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="text-white/60">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feature.bullets.map((bullet, i) => (
                          <li key={i} className="flex gap-2 text-sm text-white/70">
                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      {feature.note && (
                        <p className="mt-4 text-xs text-cyan-400/70 border-t border-white/5 pt-4">
                          {feature.note}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-6 border-t border-white/5 bg-gradient-to-b from-transparent to-cyan-950/10">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
              <p className="text-white/60 text-lg">
                Three steps to on-brand content at scale.
              </p>
            </motion.div>

            <div className="space-y-8">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="flex gap-6"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl shrink-0">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-white/60">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Governance and approval */}
        <section className="py-16 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-4">
                <Users className="w-4 h-4" />
                Governance
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Brand control built in
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Admin-only editing",
                  description: "Only workspace admins can edit Brand Packs. Your team uses them, not modifies them.",
                },
                {
                  title: "Version history",
                  description: "Track changes to your Brand Pack with a full change log. Roll back if needed.",
                },
                {
                  title: "Approval workflows",
                  description: "Optional approval workflows available on request for enterprise deployments.",
                },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="p-6 rounded-lg bg-neutral-900/30 border border-white/5"
                >
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-white/60">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact form */}
        <section id="contact-form" className="py-16 px-6 border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Request Enterprise custom branding
              </h2>
              <p className="text-white/60">
                Enterprise customisation is tailored to your requirements. Final pricing depends on scope.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="bg-neutral-900/50 border-white/10">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Your name"
                          required
                          data-testid="input-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                          placeholder="Company name"
                          required
                          data-testid="input-company"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="you@company.com"
                        required
                        data-testid="input-email"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>What would you like to customise?</Label>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {customisationOptions.map((option) => (
                          <div key={option.id} className="flex items-center gap-2">
                            <Checkbox
                              id={option.id}
                              checked={formData.customisations.includes(option.id)}
                              onCheckedChange={(checked) => 
                                handleCustomisationChange(option.id, checked === true)
                              }
                              data-testid={`checkbox-${option.id}`}
                            />
                            <Label htmlFor={option.id} className="text-sm font-normal cursor-pointer">
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Tell us about your requirements..."
                        rows={4}
                        data-testid="textarea-notes"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full gap-2"
                      disabled={isSubmitting}
                      data-testid="button-submit-enquiry"
                    >
                      {isSubmitting ? "Submitting..." : "Request Enterprise custom branding"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 bg-black border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-white/40 text-sm">
              © {new Date().getFullYear()} IceMaker. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-white/40 hover:text-white/60 transition-colors">Privacy</Link>
              <Link href="/terms" className="text-white/40 hover:text-white/60 transition-colors">Terms</Link>
              <Link href="/pricing" className="text-white/40 hover:text-white/60 transition-colors">Pricing</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
