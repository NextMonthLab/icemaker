import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Lightbulb, Sparkles, Clock } from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import { useAuth } from "@/lib/auth";
import {
  LaunchpadHeader,
  SignalTiles,
  TopInsightCard,
  InsightFeed,
  IceBuilderPanel,
  RecentStrip,
  PowerUpBanner,
  type OrbitSummary,
  type Insight,
  type IceDraft,
  type IceFormat,
  type IceTone,
  type IceOutputType,
} from "@/components/launchpad";
import { NewIceModal } from "@/components/launchpad/NewIceModal";
import { FirstRunOnboarding, Spotlight, type SpotlightStep } from "@/components/onboarding";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingProfile {
  id: number;
  userId: number;
  onboardingCompleted: boolean;
  onboardingDismissed: boolean;
  onboardingPath: "orbit-first" | "ice-first" | null;
  onboardingCompletedAt: string | null;
}

type MobileTab = "insights" | "builder" | "recent";

interface OwnedOrbit {
  businessSlug: string;
  sourceUrl: string;
  generationStatus: string;
  previewId: string | null;
  customTitle: string | null;
  planTier: string | null;
  strengthScore: number;
  stats: {
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
    leads: number;
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
  const searchString = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const processedQueryParams = useRef(false);

  const [selectedOrbit, setSelectedOrbit] = useState<OrbitSummary | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [currentDraft, setCurrentDraft] = useState<IceDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("insights");
  const [mobileBuilderOpen, setMobileBuilderOpen] = useState(false);
  const [highlightedInsightId, setHighlightedInsightId] = useState<string | null>(null);
  const [newIceModalOpen, setNewIceModalOpen] = useState(false);
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTour, setActiveTour] = useState<"orbit-first" | "ice-first" | null>(null);
  const [tourStep, setTourStep] = useState(0);

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
    strengthScore: o.strengthScore ?? 0,
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

  // Handle query params for returning from editor (origin trace back-link)
  useEffect(() => {
    if (processedQueryParams.current) return;
    if (!orbitSummaries.length) return; // Wait for orbits to load
    
    const params = new URLSearchParams(searchString);
    const orbitSlug = params.get("orbit");
    const insightId = params.get("insight");
    
    if (!orbitSlug) {
      // No query params to process, mark as done
      processedQueryParams.current = true;
      return;
    }
    
    const targetOrbit = orbitSummaries.find((o) => o.slug === orbitSlug);
    if (targetOrbit) {
      setSelectedOrbit(targetOrbit);
      setStoredOrbitSlug(orbitSlug);
      if (insightId) {
        setHighlightedInsightId(insightId);
        // Clear highlight after a few seconds
        const timer = setTimeout(() => setHighlightedInsightId(null), 3000);
        // Cleanup on unmount
        return () => clearTimeout(timer);
      }
      processedQueryParams.current = true;
      // Clear URL params without navigation
      window.history.replaceState({}, "", "/launchpad");
    }
  }, [searchString, orbitSummaries]);

  const { data: insightsData, isLoading: insightsLoading } = useQuery<{ 
    insights: Insight[];
    total?: number;
    remaining?: number;
    locked?: boolean;
    upgradeMessage?: string;
  }>({
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

  const { data: draftsData } = useQuery<{ drafts: IceDraft[] }>({
    queryKey: ["orbit-drafts", selectedOrbit?.slug],
    queryFn: async () => {
      if (!selectedOrbit?.slug) return { drafts: [] };
      const response = await fetch(`/api/orbit/${selectedOrbit.slug}/ice/drafts`, {
        credentials: "include",
      });
      if (!response.ok) return { drafts: [] };
      return response.json();
    },
    enabled: !!selectedOrbit?.slug,
  });

  const recentDrafts = draftsData?.drafts || [];

  const { data: onboardingProfile } = useQuery<OnboardingProfile | null>({
    queryKey: ["me", "onboarding"],
    queryFn: async () => {
      const response = await fetch("/api/me/onboarding", { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/me/onboarding/tour", { 
        onboardingCompleted: true,
        onboardingDismissed: false 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "onboarding"] });
    },
  });

  useEffect(() => {
    if (!user || orbitsLoading) return;
    if (onboardingProfile === undefined) return;
    
    const shouldShowOnboarding = 
      onboardingProfile === null || 
      (!onboardingProfile.onboardingCompleted && !onboardingProfile.onboardingDismissed);
    
    if (shouldShowOnboarding && hasOrbits) {
      setShowOnboarding(true);
    }
  }, [user, onboardingProfile, orbitsLoading, hasOrbits]);

  const iceTourSteps: SpotlightStep[] = [
    {
      id: "header",
      targetSelector: '[data-testid="launchpad-header"]',
      title: "Your Orbit at a Glance",
      description: "This shows which Orbit is selected and its current status. You can switch between different Orbits here.",
      position: "bottom",
    },
    {
      id: "insights",
      targetSelector: '[data-testid="top-insight-card"]',
      title: "AI-Powered Insights",
      description: "Your Orbit generates insights from conversations and data. Each insight can become an ICE with one click.",
      position: "right",
    },
    {
      id: "builder",
      targetSelector: '[data-testid="ice-builder-panel"]',
      title: "ICE Builder",
      description: "Create Interactive Cinematic Experiences here. Choose a format, tone, and output type to generate content.",
      position: "left",
    },
  ];

  const handleStartTour = (path: "orbit-first" | "ice-first") => {
    if (path === "ice-first") {
      setActiveTour(path);
      setTourStep(0);
    } else {
      setLocation("/orbit/claim");
    }
  };

  const handleTourNext = () => {
    if (tourStep < iceTourSteps.length - 1) {
      setTourStep((prev) => prev + 1);
    }
  };

  const handleTourSkip = () => {
    setActiveTour(null);
    setTourStep(0);
    completeOnboardingMutation.mutate();
  };

  const handleTourComplete = () => {
    setActiveTour(null);
    setTourStep(0);
    completeOnboardingMutation.mutate();
    toast({
      title: "Tour Complete!",
      description: "You're all set to start creating. Need help? Click 'Take the Tour' in the menu anytime.",
    });
  };

  const handleOpenTourFromMenu = () => {
    setShowOnboarding(true);
  };

  const insights = insightsData?.insights || [];
  const insightsLocked = insightsData?.locked || false;
  const insightsUpgradeMessage = insightsData?.upgradeMessage;
  const insightsRemaining = insightsData?.remaining ?? 0;
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
    setMobileBuilderOpen(true);
    setMobileTab("builder");
  }, []);

  const handleCreateIce = useCallback(() => {
    setNewIceModalOpen(true);
  }, []);

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
        const response = await fetch(`/api/orbit/${selectedOrbit.slug}/ice/generate-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...options,
            insightTitle: selectedInsight.title,
            insightMeaning: selectedInsight.meaning,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate draft");
        }

        const result = await response.json();
        queryClient.invalidateQueries({ queryKey: ["orbit-drafts", selectedOrbit.slug] });
        
        // Navigate to the Amalgamated Editor
        setLocation(`/ice/preview/${result.previewId}`);
      } catch (error) {
        toast({
          title: "Generation failed",
          description: "Please try again.",
          variant: "destructive",
        });
        setIsGenerating(false);
      }
    },
    [selectedOrbit, selectedInsight, toast, setLocation, queryClient]
  );

  if (orbitsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalNav context="app" onStartTour={handleOpenTourFromMenu} />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!hasOrbits) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalNav context="app" onStartTour={handleOpenTourFromMenu} />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GlobalNav context="app" onStartTour={handleOpenTourFromMenu} />
      
      <FirstRunOnboarding
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onStartTour={handleStartTour}
      />
      
      {activeTour === "ice-first" && (
        <Spotlight
          steps={iceTourSteps}
          currentStep={tourStep}
          onNext={handleTourNext}
          onSkip={handleTourSkip}
          onComplete={handleTourComplete}
        />
      )}

      <LaunchpadHeader
        orbits={orbitSummaries}
        selectedOrbit={selectedOrbit}
        onOrbitSelect={handleOrbitSelect}
        onCreateIce={handleCreateIce}
      />

      {selectedOrbit?.status === "basic" && (
        <PowerUpBanner
          orbitSlug={selectedOrbit.slug}
          onUpgrade={() => setLocation(`/orbit/${selectedOrbit.slug}/sources`)}
        />
      )}

      {/* Desktop Layout */}
      <div className="flex-1 hidden lg:flex">
        <div className="flex-1 flex flex-col lg:flex-row">
          <div className="lg:w-2/3 p-6 space-y-6 overflow-y-auto">
            <SignalTiles
              visits={currentOrbitStats?.visits || 0}
              conversations={currentOrbitStats?.conversations || 0}
              iceViews={currentOrbitStats?.iceViews || 0}
              leads={currentOrbitStats?.leads || 0}
            />

            <TopInsightCard insight={topInsight} onMakeIce={handleMakeIce} />

            <InsightFeed
              insights={feedInsights}
              selectedInsightId={selectedInsight?.id}
              highlightedInsightId={highlightedInsightId}
              onMakeIce={handleMakeIce}
              isLoading={insightsLoading}
              locked={insightsLocked}
              upgradeMessage={insightsUpgradeMessage}
              remainingInsights={insightsRemaining}
              orbitSlug={selectedOrbit?.slug}
            />
          </div>

          <div className="lg:w-1/3 border-l border-border bg-muted/30">
            <IceBuilderPanel
              selectedInsight={selectedInsight}
              draft={currentDraft}
              onGenerateDraft={handleGenerateDraft}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </div>

      {/* Desktop RecentStrip */}
      <div className="hidden lg:block">
        <RecentStrip drafts={recentDrafts} />
      </div>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col lg:hidden pb-16">
        {mobileTab === "insights" && (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <SignalTiles
              visits={currentOrbitStats?.visits || 0}
              conversations={currentOrbitStats?.conversations || 0}
              iceViews={currentOrbitStats?.iceViews || 0}
              leads={currentOrbitStats?.leads || 0}
            />
            <TopInsightCard insight={topInsight} onMakeIce={handleMakeIce} />
            <InsightFeed
              insights={feedInsights}
              selectedInsightId={selectedInsight?.id}
              highlightedInsightId={highlightedInsightId}
              onMakeIce={handleMakeIce}
              isLoading={insightsLoading}
              locked={insightsLocked}
              upgradeMessage={insightsUpgradeMessage}
              remainingInsights={insightsRemaining}
              orbitSlug={selectedOrbit?.slug}
            />
          </div>
        )}

        {mobileTab === "builder" && (
          <div className="flex-1 overflow-y-auto bg-muted/30">
            <IceBuilderPanel
              selectedInsight={selectedInsight}
              draft={currentDraft}
              onGenerateDraft={handleGenerateDraft}
              isGenerating={isGenerating}
            />
          </div>
        )}

        {mobileTab === "recent" && (
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Content</h2>
            {recentDrafts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent drafts yet. Create your first content from an insight.</p>
            ) : (
              <div className="space-y-3">
                {recentDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => {
                      setCurrentDraft(draft);
                      setMobileTab("builder");
                    }}
                    className="p-4 rounded-lg bg-muted/50 border border-border"
                    data-testid={`mobile-draft-${draft.id}`}
                  >
                    <p className="font-medium text-foreground truncate">{draft.headline}</p>
                    <p className="text-xs text-muted-foreground mt-1">{draft.status === "published" ? "Published" : "Draft"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur border-t border-border z-50">
        <div className="flex">
          <button
            onClick={() => setMobileTab("insights")}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              mobileTab === "insights" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="tab-insights"
          >
            <Lightbulb className="w-5 h-5" />
            <span className="text-xs">Insights</span>
          </button>
          <button
            onClick={() => setMobileTab("builder")}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              mobileTab === "builder" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="tab-builder"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-xs">Builder</span>
          </button>
          <button
            onClick={() => setMobileTab("recent")}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              mobileTab === "recent" ? "text-primary" : "text-muted-foreground"
            }`}
            data-testid="tab-recent"
          >
            <Clock className="w-5 h-5" />
            <span className="text-xs">Recent</span>
          </button>
        </div>
      </div>

      {/* Mobile Builder Sheet (alternative full-screen approach) */}
      <Sheet open={mobileBuilderOpen && mobileTab !== "builder"} onOpenChange={setMobileBuilderOpen}>
        <SheetContent side="bottom" className="h-[90vh] bg-background border-border p-0">
          <IceBuilderPanel
            selectedInsight={selectedInsight}
            draft={currentDraft}
            onGenerateDraft={handleGenerateDraft}
            isGenerating={isGenerating}
          />
        </SheetContent>
      </Sheet>

      {/* New ICE Modal */}
      {selectedOrbit && (
        <NewIceModal
          open={newIceModalOpen}
          onOpenChange={setNewIceModalOpen}
          businessSlug={selectedOrbit.slug}
          selectedInsight={selectedInsight}
          insights={insights}
        />
      )}
    </div>
  );
}
