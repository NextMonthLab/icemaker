import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Building2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Plan, PlanFeatures, User } from "@shared/schema";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  reason?: string;
}

const planIcons: Record<string, any> = {
  free: Sparkles,
  pro: Zap,
  business: Building2,
};

const planColors: Record<string, string> = {
  free: "bg-muted",
  pro: "bg-gradient-to-br from-cyan-500 to-blue-500",
  business: "bg-gradient-to-br from-blue-600 to-cyan-500",
};

export function UpgradeModal({ open, onOpenChange, feature, reason }: UpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  
  // Fetch current user to check authentication
  const { data: user } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 30000,
  });
  
  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json() as Promise<Plan[]>;
    },
  });
  
  const handleLoginRedirect = () => {
    // Close modal and redirect to login
    onOpenChange(false);
    setLocation("/login?redirect=/create");
  };
  
  const handleUpgrade = async (plan: Plan) => {
    if (plan.name === "free" || !plan.stripePriceIdMonthly) return;
    
    // Check if user is authenticated
    if (!user) {
      handleLoginRedirect();
      return;
    }
    
    setLoading(plan.name);
    setError(null);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.stripePriceIdMonthly,
          planName: plan.name,
        }),
        credentials: "include",
      });
      
      if (response.status === 401) {
        // Not authenticated - redirect to login
        handleLoginRedirect();
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create checkout session");
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else if (data.message) {
        // Handle server messages (e.g., Stripe not configured)
        setError(data.message);
      } else {
        setError("Checkout session could not be created. Please try again later.");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(null);
    }
  };
  
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };
  
  const getFeatureList = (features: PlanFeatures | null): string[] => {
    if (!features) return [];
    
    const list: string[] = [];
    
    list.push(`Up to ${features.maxCardsPerStory} cards per story`);
    
    if (features.storageDays >= 365) {
      list.push("Unlimited storage");
    } else {
      list.push(`${features.storageDays} days storage`);
    }
    
    if (features.canUseCloudLlm) list.push("Cloud AI processing");
    if (features.canGenerateImages) list.push("AI image generation");
    if (features.canExport) list.push("Video & media export");
    if (features.canUseCharacterChat) list.push("AI character chat");
    if (features.collaborationRoles) list.push("Team collaboration");
    
    if (features.monthlyVideoCredits > 0) {
      list.push(`${features.monthlyVideoCredits} video credits/month`);
    }
    if (features.monthlyVoiceCredits > 0) {
      list.push(`${features.monthlyVoiceCredits} voice credits/month`);
    }
    
    return list;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" data-testid="upgrade-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {feature ? `Unlock ${feature}` : "Choose Your Plan"}
          </DialogTitle>
          <DialogDescription>
            {reason || "Upgrade to access premium features and take your stories further."}
          </DialogDescription>
        </DialogHeader>
        
        {/* Error message display */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 mt-4">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-destructive font-medium">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please try again or contact support if the issue persists.
              </p>
            </div>
          </div>
        )}
        
        {/* Login prompt for unauthenticated users */}
        {!user && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/30 mt-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Sign in to upgrade</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create an account or sign in to access premium plans.
                </p>
              </div>
            </div>
            <Button onClick={handleLoginRedirect} size="sm" data-testid="button-login-to-upgrade">
              Sign In
            </Button>
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {plans?.map((plan) => {
            const Icon = planIcons[plan.name] || Sparkles;
            const features = plan.features as PlanFeatures | null;
            const featureList = getFeatureList(features);
            const isPopular = plan.name === "pro";
            
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 ${
                  isPopular ? "border-primary shadow-lg" : "border-border"
                }`}
                data-testid={`plan-card-${plan.name}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                
                <div className={`w-12 h-12 rounded-lg ${planColors[plan.name]} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-bold">{plan.displayName}</h3>
                
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">
                    {plan.monthlyPrice === 0 ? "Free" : formatPrice(plan.monthlyPrice)}
                  </span>
                  {plan.monthlyPrice > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>
                
                <ul className="space-y-2 mb-6">
                  {featureList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  disabled={plan.name === "free" || loading === plan.name}
                  onClick={() => handleUpgrade(plan)}
                  data-testid={`button-upgrade-${plan.name}`}
                >
                  {loading === plan.name ? "Loading..." : 
                   plan.name === "free" ? "Current Plan" : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
