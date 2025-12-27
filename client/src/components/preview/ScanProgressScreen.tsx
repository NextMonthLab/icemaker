import { motion } from "framer-motion";
import { Globe, Sparkles, Shield, BarChart3, Palette, MessageCircle } from "lucide-react";

interface ScanProgressScreenProps {
  domain: string;
}

const steps = [
  { id: 'crawl', label: 'Crawl', description: 'Reading your site structure' },
  { id: 'understand', label: 'Understand', description: 'Extracting services and questions' },
  { id: 'structure', label: 'Structure', description: 'Preparing brand-safe styling' },
  { id: 'build', label: 'Build', description: 'Building your 24/7 assistant' },
];

const ownerBenefits = [
  { icon: Palette, title: 'Brand Matching', description: 'Your colours, your voice' },
  { icon: Shield, title: 'AI Safeguards', description: 'Control what AI says' },
  { icon: BarChart3, title: 'Insights', description: 'What customers ask' },
  { icon: MessageCircle, title: '24/7 Leads', description: 'Capture enquiries always' },
];

export function ScanProgressScreen({ domain }: ScanProgressScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-white/[0.04] border border-white/[0.08] rounded-full">
          <Globe className="w-4 h-4 text-white/50" />
          <span className="text-white/60 text-sm">{domain}</span>
        </div>
        
        <h1 className="text-2xl font-semibold text-white mb-3">
          Building your Smart Site
        </h1>
        <p className="text-white/50 text-sm mb-10">
          This takes about 60 seconds. Here's what's happening.
        </p>

        <div className="space-y-3 mb-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2, duration: 0.4 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="relative w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: index * 0.5 }}
                  className="absolute inset-0 rounded-full border border-white/20 border-t-white/60"
                />
                <span className="text-xs font-medium text-white/60">{index + 1}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white/80">{step.label}</p>
                <p className="text-xs text-white/40">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="h-px bg-white/[0.06] mb-8" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-white/40" />
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              When you activate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ownerBenefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1, duration: 0.3 }}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.015] border border-white/[0.04]"
              >
                <benefit.icon className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-white/60">{benefit.title}</p>
                  <p className="text-[10px] text-white/30">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
