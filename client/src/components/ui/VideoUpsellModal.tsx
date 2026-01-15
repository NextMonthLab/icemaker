import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap, ArrowRight } from "lucide-react";

interface VideoUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredTier: string;
  featureName?: string;
  onUpgrade?: () => void;
}

const tierConfig: Record<string, { 
  title: string; 
  icon: React.ReactNode; 
  benefits: string[];
  color: string;
}> = {
  pro: {
    title: "Pro",
    icon: <Zap className="w-5 h-5 text-purple-400" />,
    color: "purple",
    benefits: [
      "Access to Advanced video engine (Kling 1.6 Pro)",
      "Enhanced motion quality and realism",
      "Priority rendering queue",
      "10x more video generation credits",
    ],
  },
  business: {
    title: "Business",
    icon: <Crown className="w-5 h-5 text-amber-400" />,
    color: "amber",
    benefits: [
      "Access to Studio-grade engines (Minimax, Haiper)",
      "Premium quality for professional productions",
      "Fastest rendering priority",
      "Unlimited video generation",
      "Conversation insights & custom fields",
    ],
  },
};

export function VideoUpsellModal({
  open,
  onOpenChange,
  requiredTier,
  featureName,
  onUpgrade,
}: VideoUpsellModalProps) {
  const tier = tierConfig[requiredTier] || tierConfig.pro;
  
  const handleUpgrade = () => {
    onOpenChange(false);
    onUpgrade?.();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {tier.icon}
            <span>Unlock {featureName || "Studio-grade video"}</span>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Upgrade to {tier.title} to access higher realism, smoother motion, and priority rendering.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="text-sm text-slate-300 mb-2">
            {tier.title} plan includes:
          </div>
          <ul className="space-y-2">
            {tier.benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Sparkles className={`w-4 h-4 mt-0.5 text-${tier.color}-400 shrink-0`} />
                <span className="text-slate-300">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            data-testid="button-upsell-dismiss"
          >
            Not now
          </Button>
          <Button
            onClick={handleUpgrade}
            className={`flex-1 bg-gradient-to-r from-${tier.color}-600 to-${tier.color}-500 hover:from-${tier.color}-700 hover:to-${tier.color}-600 text-white gap-1`}
            data-testid="button-upsell-upgrade"
          >
            Upgrade
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
