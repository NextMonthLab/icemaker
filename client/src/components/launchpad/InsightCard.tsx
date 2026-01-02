import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export interface Insight {
  id: string;
  orbitId: string;
  title: string;
  meaning: string;
  confidence: "high" | "medium" | "low";
  topicTags: string[];
  segment?: string;
  source: string;
  kind?: "top" | "feed";
  createdAt: string;
  updatedAt?: string;
}

interface InsightCardProps {
  insight: Insight;
  isSelected?: boolean;
  onMakeIce: (insight: Insight) => void;
}

const confidenceColors = {
  high: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function InsightCard({
  insight,
  isSelected,
  onMakeIce,
}: InsightCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? "bg-white/[0.03] border-l-2 border-l-blue-500 border-white/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          : "bg-white/[0.02] border-white/10 hover:border-blue-500/30 hover:bg-white/[0.04]"
      }`}
      data-testid={`insight-card-${insight.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white mb-1 truncate">
            {insight.title}
          </h4>
          <p className="text-sm text-white/60 line-clamp-2">{insight.meaning}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge
              variant="outline"
              className={confidenceColors[insight.confidence]}
            >
              {insight.confidence}
            </Badge>
            {insight.topicTags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-white/20 text-white/60"
              >
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-white/40">{insight.source}</span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onMakeIce(insight);
          }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shrink-0"
          data-testid={`button-make-ice-${insight.id}`}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Make Ice
        </Button>
      </div>
    </div>
  );
}
