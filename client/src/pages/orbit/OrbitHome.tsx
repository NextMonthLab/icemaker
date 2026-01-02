import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Map,
  Brain,
  ArrowRight,
  Plus,
  Orbit,
  Zap,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import OrbitLayout from "@/components/OrbitLayout";

interface OrbitSummary {
  slug: string;
  name: string;
  status: "basic" | "powered";
  strengthScore?: number;
}

export default function OrbitHome() {
  const { data: orbits = [], isLoading } = useQuery<OrbitSummary[]>({
    queryKey: ["/api/orbit/my"],
    queryFn: async () => {
      const res = await fetch("/api/orbit/my");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <OrbitLayout>
      <div className="p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white" data-testid="text-orbit-title">
              Orbits
            </h1>
            <p className="text-white/60 text-sm" data-testid="text-orbit-subtitle">
              Manage your AI-powered business presence
            </p>
          </div>
          <Link href="/orbit/claim">
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2"
              data-testid="button-claim-orbit"
            >
              <Plus className="w-4 h-4" />
              Claim Orbit
            </Button>
          </Link>
        </div>

        {orbits.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-white/60">My Orbits</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orbits.map((orbit) => (
                <div
                  key={orbit.slug}
                  className="group p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/30 transition-all"
                  data-testid={`orbit-card-${orbit.slug}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Orbit className="w-5 h-5 text-blue-400" />
                    </div>
                    <Badge
                      variant="outline"
                      className={orbit.status === "powered" 
                        ? "border-green-500/50 text-green-400" 
                        : "border-amber-500/50 text-amber-400"
                      }
                    >
                      {orbit.status === "powered" ? "Powered" : "Basic"}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{orbit.name}</h3>
                  {orbit.strengthScore !== undefined && (
                    <p className="text-xs text-white/50 mb-4">
                      Strength: {orbit.strengthScore}%
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Link href={`/launchpad?orbit=${orbit.slug}`} className="flex-1">
                      <Button 
                        size="sm" 
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        Open Launchpad
                      </Button>
                    </Link>
                    <Link href={`/orbit/${orbit.slug}/settings`}>
                      <Button size="sm" variant="outline" className="border-white/20 text-white/70">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.03] border-t-2 border-t-blue-500 border border-white/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Orbit className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Claim Your First Orbit</h3>
                <p className="text-sm text-white/60">
                  Set up your business presence for AI-powered discovery and customer engagement
                </p>
              </div>
              <Link href="/orbit/claim">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2"
                >
                  Claim Orbit
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/orbit/map">
            <div className="group p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/30 transition-all cursor-pointer" data-testid="card-knowledge-map">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Map className="w-5 h-5 text-white/60" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Knowledge Map</h3>
                  <p className="text-sm text-white/50">
                    Visualize and manage your brand's knowledge graph
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          </Link>

          <Link href="/orbit/intelligence">
            <div className="group p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/30 transition-all cursor-pointer" data-testid="card-intelligence">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white/60" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Intelligence</h3>
                  <p className="text-sm text-white/50">
                    See how AI systems perceive your brand
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </OrbitLayout>
  );
}
