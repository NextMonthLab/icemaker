import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  MessageCircle, 
  MousePointer, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  UserPlus,
  Calendar,
  BarChart3,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HubOverviewPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

interface HubAnalytics {
  activity: {
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  };
  leads?: {
    count: number;
  };
  conversationLimit?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

export function HubOverviewPanel({ businessSlug, planTier }: HubOverviewPanelProps) {
  const { data: hubData, isLoading } = useQuery<HubAnalytics>({
    queryKey: ["orbit-hub", businessSlug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${businessSlug}/hub`);
      if (!response.ok) throw new Error("Failed to fetch hub data");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-zinc-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: "Total Visits",
      value: hubData?.activity?.visits || 0,
      icon: Users,
      description: "People who viewed your Orbit",
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Interactions",
      value: hubData?.activity?.interactions || 0,
      icon: MousePointer,
      description: "Clicks and taps on content",
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Conversations",
      value: hubData?.activity?.conversations || 0,
      icon: MessageCircle,
      description: "Chat sessions started",
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "ICE Views",
      value: hubData?.activity?.iceViews || 0,
      icon: Sparkles,
      description: "Experience views",
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
    },
  ];

  const conversationUsage = hubData?.conversationLimit;
  const usagePercent = conversationUsage 
    ? (conversationUsage.used / conversationUsage.limit) * 100 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1" data-testid="text-overview-title">
          Overview
        </h2>
        <p className="text-zinc-400 text-sm">
          Track your Orbit's performance and engagement
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card 
              key={metric.label} 
              className="bg-zinc-900 border-zinc-800"
              data-testid={`card-metric-${metric.label.toLowerCase().replace(' ', '-')}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("p-2 rounded-lg", metric.bgColor)}>
                    <Icon className={cn("h-4 w-4", metric.color)} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white" data-testid={`text-metric-value-${metric.label.toLowerCase().replace(' ', '-')}`}>
                  {metric.value.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400">{metric.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              Lead Captures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white" data-testid="text-leads-count">
                {hubData?.leads?.count || 0}
              </span>
              <span className="text-sm text-zinc-400">leads collected</span>
            </div>
            {planTier === 'free' && (
              <p className="text-xs text-zinc-500 mt-2">
                Upgrade to see lead details and contact information
              </p>
            )}
          </CardContent>
        </Card>

        {conversationUsage && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-400" />
                Monthly Conversation Limit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white" data-testid="text-conversation-used">
                    {conversationUsage.used}
                  </span>
                  <span className="text-sm text-zinc-400">
                    / {conversationUsage.limit} used
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div 
                    className={cn(
                      "h-2 rounded-full transition-all",
                      usagePercent > 80 ? "bg-red-400" : usagePercent > 60 ? "bg-amber-400" : "bg-emerald-400"
                    )}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    data-testid="progress-conversation-usage"
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {conversationUsage.remaining} conversations remaining this month
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {planTier === 'free' && (
        <Card className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <BarChart3 className="h-5 w-5 text-pink-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-white mb-1">Unlock Deeper Insights</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Upgrade to Grow to see detailed analytics, lead contact information, and more.
                </p>
                <p className="text-xs text-zinc-500">
                  Activity is free. Understanding is paid.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
