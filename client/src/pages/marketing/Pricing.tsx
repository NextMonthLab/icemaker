import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Star, Building2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { cn } from "@/lib/utils";
import { BrandBackground } from "@/components/brand/BrandBackground";
import { useAuth } from "@/lib/auth";

const pricingPlans = [
  {
    name: "Starter",
    price: "£19",
    period: "/month",
    tagline: "For individuals getting started",
    description: "Perfect for solo creators who want to experiment with AI-powered interactive content.",
    icon: Sparkles,
    popular: false,
    features: [
      "5 ICE experiences",
      "5GB storage",
      "AI image generation",
      "Basic analytics",
      "Email support",
      "Bring your own API keys",
    ],
    limitations: [
      "IceMaker branding on content",
    ],
    idealFor: "Freelancers, solo consultants, and individuals exploring AI content creation.",
    cta: "Get Started",
    ctaHref: "/login",
  },
  {
    name: "Creator",
    price: "£39",
    period: "/month",
    tagline: "Most popular",
    description: "Everything you need to create and share professional interactive experiences.",
    icon: Zap,
    popular: true,
    features: [
      "15 ICE experiences",
      "25GB storage",
      "AI image & video generation",
      "Advanced analytics",
      "Lead capture & insights",
      "Custom branding",
      "Priority email support",
      "Remove IceMaker branding",
    ],
    limitations: [],
    idealFor: "Growing businesses, content creators, and marketing teams building their audience.",
    cta: "Start Creating",
    ctaHref: "/login",
  },
  {
    name: "Studio",
    price: "£99",
    period: "/month",
    tagline: "For teams & agencies",
    description: "Full power for agencies and teams creating at scale with premium features.",
    icon: Crown,
    popular: false,
    features: [
      "50 ICE experiences",
      "100GB storage",
      "All AI generation features",
      "Conversation insights",
      "Custom field capture",
      "Team collaboration",
      "White-label options",
      "Dedicated support",
      "API access",
    ],
    limitations: [],
    idealFor: "Agencies, L&D teams, and enterprises running cohort-based programmes at scale.",
    cta: "Contact Sales",
    ctaHref: "/book-demo",
  },
];

const enterprisePlan = {
  name: "Enterprise",
  tagline: "Custom branding at scale",
  description: "Turn IceMaker into your on-brand content factory with custom title packs, captions, music, and asset libraries.",
  features: [
    "Everything in Studio",
    "Custom Brand Packs (titles, captions, music, assets)",
    "Branded caption styles and motion",
    "Custom music beds and sonic identity",
    "Brand asset library with governance",
    "Done-for-you media production (optional)",
    "Dedicated account manager",
    "Custom onboarding and training",
  ],
  cta: "Find out more",
  ctaHref: "/enterprise/custom-branding",
};

const comparisonFeatures = [
  { name: "ICE Experiences", starter: "5", creator: "15", studio: "50" },
  { name: "Storage", starter: "5GB", creator: "25GB", studio: "100GB" },
  { name: "AI Image Generation", starter: true, creator: true, studio: true },
  { name: "AI Video Generation", starter: false, creator: true, studio: true },
  { name: "TTS Narration", starter: true, creator: true, studio: true },
  { name: "Analytics Dashboard", starter: "Basic", creator: "Advanced", studio: "Full" },
  { name: "Lead Capture", starter: false, creator: true, studio: true },
  { name: "Conversation Insights", starter: false, creator: false, studio: true },
  { name: "Custom Field Capture", starter: false, creator: false, studio: true },
  { name: "Custom Branding", starter: false, creator: true, studio: true },
  { name: "Remove IceMaker Logo", starter: false, creator: true, studio: true },
  { name: "API Access", starter: false, creator: false, studio: true },
  { name: "Support", starter: "Email", creator: "Priority", studio: "Dedicated" },
];

const faqs = [
  {
    q: "Can I change plans later?",
    a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and billing is prorated.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and can arrange invoicing for annual Studio plans.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes, you can try IceMaker free with our guest builder. Create a preview to see how it works before committing.",
  },
  {
    q: "What happens if I exceed my limits?",
    a: "You'll receive a notification when approaching limits. You can upgrade your plan or purchase additional credits as needed.",
  },
  {
    q: "Do you offer discounts for annual billing?",
    a: "Yes, annual plans receive 2 months free. Contact us for custom enterprise pricing.",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Determine the correct href for pricing buttons based on auth state
  const getPlanHref = (plan: typeof pricingPlans[0]) => {
    // Book demo always goes to the same place
    if (plan.ctaHref === "/book-demo") {
      return plan.ctaHref;
    }
    // If logged in, go to launchpad to start creating
    // (Subscription billing happens during ICE checkout flow)
    if (user) {
      return "/launchpad";
    }
    // Not logged in - go to login, then redirect to launchpad
    return "/login?returnUrl=/launchpad";
  };
  
  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-16 overflow-hidden">
          {/* Background image layer */}
          <BrandBackground purpose="pricing-hero" variant="hero" className="absolute inset-0" />
          {/* Full-bleed gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1] drop-shadow-lg" data-testid="text-pricing-title">
                Simple, transparent{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">pricing</span>
              </h1>
              <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto drop-shadow-md">
                Choose the plan that fits your needs. Start free with our guest builder, then scale as you grow.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="relative py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-2xl border p-8 flex flex-col",
                    plan.popular 
                      ? "bg-gradient-to-b from-cyan-950/30 to-black border-cyan-500/50 shadow-lg shadow-cyan-500/10" 
                      : "bg-neutral-900/50 border-white/10"
                  )}
                  data-testid={`card-pricing-${plan.name.toLowerCase()}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-xs font-semibold">
                        <Star className="w-3 h-3" />
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        plan.popular ? "bg-cyan-500/20" : "bg-white/5"
                      )}>
                        <plan.icon className={cn(
                          "w-5 h-5",
                          plan.popular ? "text-cyan-400" : "text-white/60"
                        )} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{plan.name}</h3>
                        <p className="text-xs text-white/40">{plan.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-white/40">{plan.period}</span>
                    </div>

                    <p className="text-sm text-white/60">{plan.description}</p>
                  </div>

                  <div className="flex-1">
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          <span className="text-white/80">{feature}</span>
                        </li>
                      ))}
                      {plan.limitations.map((limitation) => (
                        <li key={limitation} className="flex items-start gap-2 text-sm text-white/40">
                          <span className="w-4 h-4 mt-0.5 shrink-0 text-center">−</span>
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="p-3 rounded-lg bg-white/5 mb-6">
                      <p className="text-xs text-white/40 mb-1">Ideal for:</p>
                      <p className="text-sm text-white/70">{plan.idealFor}</p>
                    </div>
                  </div>

                  <Link href={getPlanHref(plan)}>
                    <Button 
                      className={cn(
                        "w-full",
                        plan.popular 
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white" 
                          : "bg-white/10 hover:bg-white/20 text-white"
                      )}
                      size="lg"
                      data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Enterprise Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative rounded-2xl border border-cyan-500/30 p-8 md:p-12 bg-gradient-to-br from-cyan-950/20 via-black to-black overflow-hidden"
              data-testid="card-pricing-enterprise"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{enterprisePlan.name}</h3>
                        <p className="text-sm text-white/40">{enterprisePlan.tagline}</p>
                      </div>
                    </div>

                    <p className="text-white/60 mb-6 max-w-lg">
                      {enterprisePlan.description}
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3 mb-8">
                      {enterprisePlan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          <span className="text-white/80">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-4">
                    <div className="text-right">
                      <p className="text-sm text-white/40 mb-1">Pricing</p>
                      <p className="text-lg font-medium">Tailored to requirements</p>
                    </div>
                    <Link href={enterprisePlan.ctaHref}>
                      <Button 
                        size="lg" 
                        className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                        data-testid="button-pricing-enterprise"
                      >
                        {enterprisePlan.cta}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="py-20 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">Compare all features</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 pr-4 font-medium text-white/60">Feature</th>
                    <th className="text-center py-4 px-4 font-medium">Starter</th>
                    <th className="text-center py-4 px-4 font-medium text-cyan-400">Creator</th>
                    <th className="text-center py-4 px-4 font-medium">Studio</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature) => (
                    <tr key={feature.name} className="border-b border-white/5">
                      <td className="py-4 pr-4 text-white/80">{feature.name}</td>
                      <td className="text-center py-4 px-4">
                        {typeof feature.starter === 'boolean' ? (
                          feature.starter ? <Check className="w-4 h-4 text-cyan-400 mx-auto" /> : <span className="text-white/20">—</span>
                        ) : (
                          <span className="text-white/60">{feature.starter}</span>
                        )}
                      </td>
                      <td className="text-center py-4 px-4 bg-cyan-500/5">
                        {typeof feature.creator === 'boolean' ? (
                          feature.creator ? <Check className="w-4 h-4 text-cyan-400 mx-auto" /> : <span className="text-white/20">—</span>
                        ) : (
                          <span className="text-white/80">{feature.creator}</span>
                        )}
                      </td>
                      <td className="text-center py-4 px-4">
                        {typeof feature.studio === 'boolean' ? (
                          feature.studio ? <Check className="w-4 h-4 text-cyan-400 mx-auto" /> : <span className="text-white/20">—</span>
                        ) : (
                          <span className="text-white/60">{feature.studio}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">Frequently asked questions</h2>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 rounded-xl bg-neutral-900/50 border border-white/5"
                >
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-white/60">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to create something amazing?</h2>
            <p className="text-white/60 mb-8">
              Start with our free guest builder to see IceMaker in action, then choose the plan that fits your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/try">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                  data-testid="button-try-free"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Try Free
                </Button>
              </Link>
              <Link href="/book-demo">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-book-demo"
                >
                  Book a Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
