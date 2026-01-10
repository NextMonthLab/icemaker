import { Globe, Sparkles, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmptyStateProps {
  type: "no-orbits" | "no-insights" | "no-drafts";
}

export function EmptyState({ type }: EmptyStateProps) {
  if (type === "no-orbits") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
          <Globe className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Create Your First Orbit
        </h2>
        <p className="text-muted-foreground max-w-md mb-6">
          An Orbit is your AI-powered business presence. Claim your website to
          start gathering insights and creating content.
        </p>
        <Link href="/orbit/claim">
          <Button className="bg-blue-500 hover:bg-blue-600">
            <Globe className="w-4 h-4 mr-2" />
            Claim Your Orbit
          </Button>
        </Link>
      </div>
    );
  }

  if (type === "no-insights") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          No Insights Yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Insights will appear as your Orbit gathers data from conversations,
          visits, and interactions.
        </p>
      </div>
    );
  }

  if (type === "no-drafts") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <h3 className="text-md font-medium text-foreground mb-1">No Drafts Yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs">
          Select an insight and click "Make Ice" to create your first draft.
        </p>
      </div>
    );
  }

  return null;
}
