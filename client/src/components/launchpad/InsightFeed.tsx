import { useState } from "react";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InsightCard, type Insight } from "./InsightCard";

interface InsightFeedProps {
  insights: Insight[];
  selectedInsightId?: string;
  onMakeIce: (insight: Insight) => void;
  isLoading?: boolean;
}

const filterOptions = ["All", "New", "High confidence", "Analytics", "Chat"];
const sortOptions = ["Latest", "Impact"];

export function InsightFeed({
  insights,
  selectedInsightId,
  onMakeIce,
  isLoading,
}: InsightFeedProps) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInsights = insights.filter((insight) => {
    if (searchQuery && !insight.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (activeFilter === "All") return true;
    if (activeFilter === "New") return true;
    if (activeFilter === "High confidence") return insight.confidence === "high";
    if (activeFilter === "Analytics") return insight.source === "Analytics";
    if (activeFilter === "Chat") return insight.source === "Conversations";
    return true;
  });

  const headerContent = (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Insights feed</h3>
        <div className="flex items-center gap-2">
          <button className="text-xs text-white/50 hover:text-white/70 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            Latest
          </button>
          {isLoading && <RefreshCw className="w-4 h-4 text-white/40 animate-spin" />}
        </div>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          placeholder="Search insights..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 h-9 text-sm"
          data-testid="insight-search"
        />
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterOptions.map((filter) => (
          <Badge
            key={filter}
            variant="outline"
            onClick={() => setActiveFilter(filter)}
            className={`cursor-pointer whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                : "border-white/10 text-white/50 hover:border-blue-500/30 hover:text-white/70"
            }`}
            data-testid={`filter-${filter.toLowerCase().replace(" ", "-")}`}
          >
            {filter}
          </Badge>
        ))}
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
              className="p-4 rounded-lg bg-white/[0.02] border border-white/10 animate-pulse"
            >
              <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
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
        <div className="p-6 rounded-lg bg-white/[0.02] border border-white/10 text-center">
          <p className="text-white/60 text-sm">
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
            onMakeIce={onMakeIce}
          />
        ))}
        {filteredInsights.length === 0 && (
          <p className="text-white/40 text-sm text-center py-4">
            No insights match your filter
          </p>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
