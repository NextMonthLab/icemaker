import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  reason?: string;
}

export function UpgradeModal({ open, onOpenChange, feature, reason }: UpgradeModalProps) {
  const [, setLocation] = useLocation();
  
  const handleViewPricing = () => {
    onOpenChange(false);
    setLocation("/pricing");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="upgrade-modal">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">
            {feature ? `Unlock ${feature}` : "Upgrade Your Plan"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason || "Choose a plan that fits your needs and unlock premium features."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <h3 className="font-medium text-sm mb-2">What you'll get:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• More ICE experiences</li>
              <li>• AI image & video generation</li>
              <li>• Advanced analytics & insights</li>
              <li>• Custom branding options</li>
              <li>• Priority support</li>
            </ul>
          </div>
          
          <Button 
            className="w-full gap-2" 
            onClick={handleViewPricing}
            data-testid="button-view-pricing"
          >
            View Plans & Pricing
            <ArrowRight className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => onOpenChange(false)}
            data-testid="button-maybe-later"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
