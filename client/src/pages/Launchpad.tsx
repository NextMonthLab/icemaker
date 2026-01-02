import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import { useAuth } from "@/lib/auth";
import {
  LaunchpadHeader,
  SignalTiles,
  TopInsightCard,
  InsightFeed,
  IceBuilderPanel,
  RecentStrip,
  type OrbitSummary,
  type Insight,
  type IceDraft,
  type IceFormat,
  type IceTone,
  type IceOutputType,
} from "@/components/launchpad";
import { useToast } from "@/hooks/use-toast";

interface OwnedOrbit {
  businessSlug: string;
  sourceUrl: string;
  generationStatus: string;
  previewId: string | null;
  customTitle: string | null;
  planTier: string | null;
  stats: {
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  };
}

interface OrbitsResponse {
  orbits: OwnedOrbit[];
}

const SELECTED_ORBIT_KEY = "launchpad_selected_orbit";

function getStoredOrbitSlug(): string | null {
  try {
    return localStorage.getItem(SELECTED_ORBIT_KEY);
  } catch {
    return null;
  }
}

function setStoredOrbitSlug(slug: string): void {
  try {
    localStorage.setItem(SELECTED_ORBIT_KEY, slug);
  } catch {
    // Ignore storage errors
  }
}

export default function Launchpad() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedOrbit, setSelectedOrbit] = useState<OrbitSummary | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [currentDraft, setCurrentDraft] = useState<IceDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: orbitsData, isLoading: orbitsLoading, isError: orbitsError } = useQuery<OrbitsResponse>({
    queryKey: ["my-orbits"],
    queryFn: async () => {
      const response = await fetch("/api/me/orbits", { credentials: "include" });
      if (!response.ok) return { orbits: [] };
      return response.json();
    },
  });

  const orbits = orbitsData?.orbits || [];
  const hasOrbits = orbits.length > 0;

  const orbitSummaries: OrbitSummary[] = orbits.map((o) => ({
    id: o.businessSlug,
    slug: o.businessSlug,
    name: o.customTitle || o.businessSlug.replace(/-/g, " "),
    status: o.planTier && o.planTier !== "free" ? "powered" : "basic",
    strengthScore: undefined,
  }));

  useEffect(() => {
    if (!orbitsLoading && !orbitsError && !hasOrbits) {
      setLocation("/orbit/claim");
    }
  }, [orbitsLoading, orbitsError, hasOrbits, setLocation]);

  useEffect(() => {
    if (orbitSummaries.length > 0 && !selectedOrbit) {
      const storedSlug = getStoredOrbitSlug();
      const found = orbitSummaries.find((o) => o.slug === storedSlug);
      setSelectedOrbit(found || orbitSummaries[0]);
    }
  }, [orbitSummaries, selectedOrbit]);

  const { data: insightsData, isLoading: insightsLoading } = useQuery<{ insights: Insight[] }>({
    queryKey: ["orbit-insights", selectedOrbit?.slug],
    queryFn: async () => {
      if (!selectedOrbit?.slug) return { insights: [] };
      const response = await fetch(`/api/orbit/${selectedOrbit.slug}/insights`, {
        credentials: "include",
      });
      if (!response.ok) return { insights: [] };
      return response.json();
    },
    enabled: !!selectedOrbit?.slug,
  });

  const insights = insightsData?.insights || [];
  const topInsight = insights.find((i) => i.kind === "top") || insights[0] || null;
  const feedInsights = insights.filter((i) => i.kind !== "top" || i.id !== topInsight?.id);

  const currentOrbitStats = orbits.find((o) => o.businessSlug === selectedOrbit?.slug)?.stats;

  const handleOrbitSelect = useCallback((orbit: OrbitSummary) => {
    setSelectedOrbit(orbit);
    setStoredOrbitSlug(orbit.slug);
    setSelectedInsight(null);
    setCurrentDraft(null);
  }, []);

  const handleMakeIce = useCallback((insight: Insight) => {
    setSelectedInsight(insight);
    setCurrentDraft(null);
  }, []);

  const handleCreateIce = useCallback(() => {
    if (topInsight) {
      setSelectedInsight(topInsight);
      setCurrentDraft(null);
    }
  }, [topInsight]);

  const handleGenerateDraft = useCallback(
    async (options: {
      insightId: string;
      format: IceFormat;
      tone: IceTone;
      outputType: IceOutputType;
    }) => {
      if (!selectedOrbit || !selectedInsight) return;

      setIsGenerating(true);
      try {
        const response = await fetch(`/api/orbit/${selectedOrbit.slug}/ice/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(options),
        });

        if (!response.ok) {
          throw new Error("Failed to generate draft");
        }

        const draft = await response.json();
        setCurrentDraft(draft);
        toast({
          title: "Draft generated!",
          description: "Your content is ready for review.",
        });
      } catch (error) {
        toast({
          title: "Generation failed",
          description: "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [selectedOrbit, selectedInsight, toast]
  );

  if (orbitsLoading) {
    return (
      <div className="min-h-screen bg-black">
        <GlobalNav context="app" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!hasOrbits) {
    return (
      <div className="min-h-screen bg-black">
        <GlobalNav context="app" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GlobalNav context="app" />

      <LaunchpadHeader
        orbits={orbitSummaries}
        selectedOrbit={selectedOrbit}
        onOrbitSelect={handleOrbitSelect}
        onCreateIce={handleCreateIce}
      />

      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className="lg:w-2/3 p-6 space-y-6 overflow-y-auto">
            <SignalTiles
              visits={currentOrbitStats?.visits || 0}
              conversations={currentOrbitStats?.conversations || 0}
              iceViews={currentOrbitStats?.iceViews || 0}
              leads={0}
            />

            <TopInsightCard insight={topInsight} onMakeIce={handleMakeIce} />

            <InsightFeed
              insights={feedInsights}
              selectedInsightId={selectedInsight?.id}
              onMakeIce={handleMakeIce}
              isLoading={insightsLoading}
            />
          </div>

          <div className="lg:w-1/3 border-l border-white/10 bg-white/[0.02]">
            <IceBuilderPanel
              selectedInsight={selectedInsight}
              draft={currentDraft}
              onGenerateDraft={handleGenerateDraft}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </div>

      <RecentStrip drafts={[]} />
    </div>
  );
}
