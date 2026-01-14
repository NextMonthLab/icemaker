import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  MessageCircle,
  TrendingUp,
  HelpCircle,
  BarChart3,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ExperienceInsightsPanelProps {
  universeId: number;
  universeName: string;
}

interface AnalyticsSummary {
  views: { total: number; last7Days: number };
  conversations: { total: number; last7Days: number };
  completionRate: number;
  topQuestions: string[];
  topCard: { id: number; title: string; views: number } | null;
}

export function ExperienceInsightsPanel({ universeId, universeName }: ExperienceInsightsPanelProps) {
  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["experience-analytics", universeId],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/experience/${universeId}/summary`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
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
      label: "Total Views",
      value: analytics?.views.total || 0,
      subValue: `+${analytics?.views.last7Days || 0} last 7 days`,
      icon: Eye,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Conversations",
      value: analytics?.conversations.total || 0,
      subValue: `+${analytics?.conversations.last7Days || 0} last 7 days`,
      icon: MessageCircle,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "Completion Rate",
      value: `${analytics?.completionRate || 0}%`,
      subValue: "Viewers who finish",
      icon: TrendingUp,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Top Card",
      value: analytics?.topCard?.title?.slice(0, 20) || "—",
      subValue: analytics?.topCard ? `${analytics.topCard.views} views` : "No data yet",
      icon: BarChart3,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
    },
  ];

  const hasData = (analytics?.views.total || 0) > 0;
  const topQuestions = analytics?.topQuestions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="insights-title">Experience Insights</h3>
          <p className="text-sm text-muted-foreground">30-day analytics for {universeName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-bold truncate" data-testid={`metric-${metric.label.toLowerCase().replace(/\s/g, '-')}`}>
                    {metric.value}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{metric.subValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {topQuestions.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Top Questions Asked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {topQuestions.slice(0, 5).map((question, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-400 font-mono text-xs">{idx + 1}.</span>
                  <span className="capitalize">{question}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!hasData && (
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-zinc-700">
          <CardContent className="pt-6 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-primary mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              No analytics data yet. Share this experience to start collecting insights.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
