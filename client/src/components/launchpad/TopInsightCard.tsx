import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star } from "lucide-react";
import type { Insight } from "./InsightCard";

interface TopInsightCardProps {
  insight: Insight | null;
  onMakeIce: (insight: Insight) => void;
}

const confidenceColors = {
  high: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function TopInsightCard({ insight, onMakeIce }: TopInsightCardProps) {
  if (!insight) {
    return (
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-400" />
          <h3 className="font-semibold text-white">Today's top insight</h3>
        </div>
        <p className="text-white/60 text-sm">
          No insights available yet. As your Orbit collects data, insights will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
      data-testid="top-insight-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          <h3 className="font-semibold text-white">Today's top insight</h3>
        </div>
        <Badge
          variant="outline"
          className={confidenceColors[insight.confidence]}
        >
          ★ {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
        </Badge>
      </div>

      <h4 className="text-xl font-medium text-white mb-2">{insight.title}</h4>
      <p className="text-white/70 mb-4">{insight.meaning}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {insight.topicTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-white/20 text-white/60"
            >
              {tag}
            </Badge>
          ))}
          <span className="text-xs text-white/40">• {insight.source}</span>
        </div>
        <Button
          onClick={() => onMakeIce(insight)}
          className="bg-purple-600 hover:bg-purple-700"
          data-testid="button-make-ice-top"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Make Ice
        </Button>
      </div>
    </div>
  );
}
