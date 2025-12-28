import { useQuery } from "@tanstack/react-query";
import { Sparkles, Zap, TrendingUp, Gift, AlertTriangle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface HubIcePanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

interface IceAllowanceResponse {
  allowance: number;
  used: number;
  remaining: number;
  periodStart: string;
  tier: string;
}

export function HubIcePanel({ businessSlug, planTier }: HubIcePanelProps) {
  const INSIGHT_TIERS = ['insight', 'intelligence'];
  const isInsightTier = INSIGHT_TIERS.includes(planTier);
  const PAID_TIERS = ['grow', 'insight', 'intelligence'];
  const isPaidTier = PAID_TIERS.includes(planTier);

  const { data: allowanceData, isLoading } = useQuery<IceAllowanceResponse>({
    queryKey: ['/api/orbit', businessSlug, 'ice-allowance'],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/ice-allowance`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch ICE allowance');
      return res.json();
    },
    enabled: isPaidTier,
  });

  const getNudgeMessage = (used: number, allowance: number) => {
    if (allowance === 0) return null;
    
    const usageRatio = used / allowance;
    
    if (usageRatio >= 1.33) {
      return {
        type: 'warning' as const,
        icon: AlertTriangle,
        message: "You're using ICE heavily! Consider Orbit Intelligence for more credits.",
        action: 'Upgrade',
      };
    }
    if (usageRatio >= 1) {
      return {
        type: 'info' as const,
        icon: Zap,
        message: "You've used your bundled credits. Additional ICEs are pay-as-you-go.",
        action: null,
      };
    }
    if (usageRatio >= 0.67) {
      return {
        type: 'success' as const,
        icon: TrendingUp,
        message: "Great momentum! You're making the most of your Orbit.",
        action: null,
      };
    }
    return null;
  };

  const nudge = allowanceData ? getNudgeMessage(allowanceData.used, allowanceData.allowance) : null;

  const tierCredits = {
    free: 0,
    grow: 0,
    insight: 6,
    intelligence: 12,
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
          <div className="h-32 bg-zinc-800 rounded mt-6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-1">ICE Maker</h2>
        <p className="text-zinc-400 text-sm">
          Create Interactive Cinematic Experiences for your visitors
        </p>
      </div>

      {isInsightTier && allowanceData && (
        <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-400" />
              <h3 className="font-medium text-white">Monthly Bundled Credits</h3>
            </div>
            <span className="text-sm text-zinc-400">
              Resets monthly
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{allowanceData.allowance}</p>
              <p className="text-xs text-zinc-500">Included</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-pink-400">{allowanceData.used}</p>
              <p className="text-xs text-zinc-500">Used</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{allowanceData.remaining}</p>
              <p className="text-xs text-zinc-500">Remaining</p>
            </div>
          </div>

          <div className="mb-2">
            <Progress 
              value={allowanceData.allowance > 0 ? Math.min((allowanceData.used / allowanceData.allowance) * 100, 100) : 0} 
              className="h-2 bg-zinc-700"
            />
          </div>
          <p className="text-xs text-zinc-500">
            {allowanceData.used} of {allowanceData.allowance} credits used this period
          </p>
        </div>
      )}

      {nudge && (
        <div className={cn(
          "mb-6 rounded-lg p-4 border flex items-start gap-3",
          nudge.type === 'warning' && "bg-amber-500/10 border-amber-500/30",
          nudge.type === 'info' && "bg-blue-500/10 border-blue-500/30",
          nudge.type === 'success' && "bg-emerald-500/10 border-emerald-500/30"
        )}>
          <nudge.icon className={cn(
            "h-5 w-5 mt-0.5 shrink-0",
            nudge.type === 'warning' && "text-amber-400",
            nudge.type === 'info' && "text-blue-400",
            nudge.type === 'success' && "text-emerald-400"
          )} />
          <div className="flex-1">
            <p className={cn(
              "text-sm",
              nudge.type === 'warning' && "text-amber-200",
              nudge.type === 'info' && "text-blue-200",
              nudge.type === 'success' && "text-emerald-200"
            )}>
              {nudge.message}
            </p>
            {nudge.action && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
              >
                <Crown className="h-4 w-4 mr-1" />
                {nudge.action} to Intelligence
              </Button>
            )}
          </div>
        </div>
      )}

      {planTier === 'grow' && (
        <div className="mb-6 bg-zinc-800/30 rounded-lg p-5 border border-zinc-700">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-emerald-400" />
            <h3 className="font-medium text-white">Pay-as-you-go</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Create ICE experiences for £8 per credit. Each standard ICE includes 12 cards, 12 AI images, and up to 4 video scenes.
          </p>
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <Gift className="h-4 w-4" />
            <span>Upgrade to Orbit Insight for 6 bundled credits/month</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
          <h4 className="font-medium text-white mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pink-400" />
            What's included in an ICE?
          </h4>
          <ul className="text-sm text-zinc-400 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
              12 narrative cards/scenes
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              12 AI-generated images
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Up to 4 video scenes (auto-selected)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Script and styling included
            </li>
          </ul>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          size="lg"
          data-testid="button-create-ice"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Create New ICE
        </Button>
      </div>
    </div>
  );
}
