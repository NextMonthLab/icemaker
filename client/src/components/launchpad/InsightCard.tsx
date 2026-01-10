import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BarChart3, MessageSquare, Database } from "lucide-react";

export type InsightKind = "signal" | "content_ready" | "ops";

export interface ContentBrief {
  audience: string;
  problem: string;
  promise: string;
  proof: string;
  cta: string;
  formatSuggestion: "hook" | "myth_bust" | "checklist" | "problem_solution" | "testimonial" | "story";
}

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
  insightKind: InsightKind;
  contentPotentialScore: number;
  contentBrief?: ContentBrief;
  createdAt: string;
  updatedAt?: string;
}

interface InsightCardProps {
  insight: Insight;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onMakeIce: (insight: Insight) => void;
}

const confidenceColors = {
  high: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const insightKindConfig: Record<InsightKind, { label: string; icon: typeof Sparkles; color: string }> = {
  content_ready: { 
    label: "Content-ready", 
    icon: Sparkles, 
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30" 
  },
  signal: { 
    label: "Signal", 
    icon: BarChart3, 
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30" 
  },
  ops: { 
    label: "Ops", 
    icon: Database, 
    color: "bg-slate-500/20 text-slate-400 border-slate-500/30" 
  },
};

export function InsightCard({
  insight,
  isSelected,
  isHighlighted,
  onMakeIce,
}: InsightCardProps) {
  const kindConfig = insightKindConfig[insight.insightKind || "signal"];
  const KindIcon = kindConfig.icon;
  const isContentReady = insight.insightKind === "content_ready";
  
  return (
    <div
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isHighlighted
          ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/50 animate-pulse"
          : isSelected
          ? "bg-muted/30 border-l-2 border-l-blue-500 border-border shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          : isContentReady
          ? "bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10"
          : "bg-muted/20 border-border hover:border-blue-500/30 hover:bg-muted/40"
      }`}
      data-testid={`insight-card-${insight.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`${kindConfig.color} text-xs`}
            >
              <KindIcon className="w-3 h-3 mr-1" />
              {kindConfig.label}
            </Badge>
            {insight.contentPotentialScore >= 70 && (
              <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400 text-xs">
                High potential
              </Badge>
            )}
          </div>
          <h4 className="font-medium text-foreground mb-1 truncate">
            {insight.title}
          </h4>
          <p className="text-sm text-muted-foreground line-clamp-2">{insight.meaning}</p>
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
                className="border-border text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground/60">{insight.source}</span>
          </div>
        </div>
        {isContentReady ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMakeIce(insight);
            }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shrink-0"
            data-testid={`button-make-ice-${insight.id}`}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Create Story
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMakeIce(insight);
            }}
            className="text-white/40 hover:text-white/60 shrink-0"
            data-testid={`button-make-ice-${insight.id}`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            View
          </Button>
        )}
      </div>
    </div>
  );
}
