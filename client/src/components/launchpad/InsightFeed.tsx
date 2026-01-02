import { RefreshCw } from "lucide-react";
import { InsightCard, type Insight } from "./InsightCard";

interface InsightFeedProps {
  insights: Insight[];
  selectedInsightId?: string;
  onMakeIce: (insight: Insight) => void;
  isLoading?: boolean;
}

export function InsightFeed({
  insights,
  selectedInsightId,
  onMakeIce,
  isLoading,
}: InsightFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white">Insights feed</h3>
          <RefreshCw className="w-4 h-4 text-white/40 animate-spin" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-white/5 border border-white/10 animate-pulse"
          >
            <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
            <div className="h-3 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-white">Insights feed</h3>
        <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-center">
          <p className="text-white/60 text-sm">
            No insights yet. Insights will appear as your Orbit gathers data
            from conversations and interactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="insight-feed">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">Insights feed</h3>
        <RefreshCw className="w-4 h-4 text-white/40" />
      </div>
      {insights.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          isSelected={insight.id === selectedInsightId}
          onMakeIce={onMakeIce}
        />
      ))}
    </div>
  );
}
