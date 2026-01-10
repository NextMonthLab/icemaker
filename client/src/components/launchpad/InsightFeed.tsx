import { useState } from "react";
import { RefreshCw, Search, SlidersHorizontal, Sparkles, Zap, BarChart3, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InsightCard, type Insight, type InsightKind } from "./InsightCard";
import { Link } from "wouter";

interface InsightFeedProps {
  insights: Insight[];
  selectedInsightId?: string;
  highlightedInsightId?: string | null;
  onMakeIce: (insight: Insight) => void;
  isLoading?: boolean;
  locked?: boolean;
  upgradeMessage?: string;
  remainingInsights?: number;
  orbitSlug?: string;
}

type InsightTab = "all" | "content_ready" | "signals" | "ops";

const tabConfig: Record<InsightTab, { label: string; icon: typeof Sparkles; description: string }> = {
  all: { label: "All", icon: SlidersHorizontal, description: "All insights" },
  content_ready: { label: "Content-ready", icon: Sparkles, description: "Ready to publish" },
  signals: { label: "Signals", icon: BarChart3, description: "Internal metrics" },
  ops: { label: "Ops", icon: Database, description: "Data status" },
};

const filterOptions = ["All", "High confidence", "Analytics", "Chat"];
const sortOptions = ["Latest", "Impact"];

export function InsightFeed({
  insights,
  selectedInsightId,
  highlightedInsightId,
  onMakeIce,
  isLoading,
  locked,
  upgradeMessage,
  remainingInsights,
  orbitSlug,
}: InsightFeedProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Count insights by kind
  const contentReadyCount = insights.filter(i => i.insightKind === "content_ready").length;
  const signalCount = insights.filter(i => i.insightKind === "signal").length;
  const opsCount = insights.filter(i => i.insightKind === "ops").length;

  const filteredInsights = insights.filter((insight) => {
    // Search filter
    if (searchQuery && !insight.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Tab filter
    if (activeTab === "all") return true;
    if (activeTab === "content_ready") return insight.insightKind === "content_ready";
    if (activeTab === "signals") return insight.insightKind === "signal";
    if (activeTab === "ops") return insight.insightKind === "ops";
    return true;
  });

  const headerContent = (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Insights</h3>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
        </div>
      </div>
      
      {/* Insight kind tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg border border-border">
        {(["all", "content_ready", "signals", "ops"] as InsightTab[]).map((tab) => {
          const config = tabConfig[tab];
          const TabIcon = config.icon;
          const count = tab === "all" ? insights.length 
            : tab === "content_ready" ? contentReadyCount 
            : tab === "signals" ? signalCount 
            : opsCount;
          const isActive = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? tab === "content_ready"
                    ? "bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-400 border border-purple-500/30"
                    : "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
              }`}
              data-testid={`tab-${tab}`}
            >
              <TabIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{config.label}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${
                  isActive 
                    ? tab === "content_ready" ? "bg-purple-500/30" : "bg-blue-500/30" 
                    : "bg-muted"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search insights..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-muted/30 border-border h-9 text-sm"
          data-testid="insight-search"
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {headerContent}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-muted/30 border border-border animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {headerContent}
        <div className="p-6 rounded-lg bg-muted/30 border border-border text-center">
          <p className="text-muted-foreground text-sm">
            No insights yet. Insights will appear as your Orbit gathers data
            from conversations and interactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="insight-feed">
      {headerContent}
      <div className="flex-1 overflow-y-auto space-y-3 relative">
        {filteredInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            isSelected={insight.id === selectedInsightId}
            isHighlighted={insight.id === highlightedInsightId}
            onMakeIce={onMakeIce}
          />
        ))}
        {filteredInsights.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-4">
            No insights match your filter
          </p>
        )}
        
        {/* Upgrade banner - reframed as reward */}
        {locked && upgradeMessage && remainingInsights && remainingInsights > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-foreground">
                Unlock {remainingInsights} more insights
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Most users unlock this by adding About + Services pages
            </p>
            {orbitSlug && (
              <Link href={`/orbit/${orbitSlug}/settings`}>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-xs"
                  data-testid="button-unlock-insights"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Add sources (~2 min)
                </Button>
              </Link>
            )}
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
