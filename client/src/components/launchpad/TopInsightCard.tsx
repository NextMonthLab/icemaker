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
      className="relative p-5 rounded-xl bg-white/[0.03] border-t-2 border-t-blue-500 border border-white/10 hover:border-blue-500/30 transition-all group"
      data-testid="top-insight-card"
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs px-2 py-0.5">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Top insight
            </Badge>
          </div>
          <Badge
            variant="outline"
            className={confidenceColors[insight.confidence]}
          >
            {insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}
          </Badge>
        </div>

        <h4 className="text-lg font-medium text-white mb-2">{insight.title}</h4>
        <p className="text-white/60 text-sm mb-4 line-clamp-2">{insight.meaning}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {insight.topicTags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-white/20 text-white/50 text-xs"
              >
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-white/40">{insight.source}</span>
          </div>
          <Button
            onClick={() => onMakeIce(insight)}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-make-ice-top"
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            Make Ice
          </Button>
        </div>
      </div>
    </div>
  );
}
