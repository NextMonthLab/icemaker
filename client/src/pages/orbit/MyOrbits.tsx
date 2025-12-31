import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Loader2, 
  Globe, 
  Eye, 
  MessageCircle, 
  MousePointer, 
  Sparkles,
  ArrowRight,
  Plus,
  ExternalLink,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OrbitLayout from "@/components/OrbitLayout";

interface OwnedOrbit {
  businessSlug: string;
  sourceUrl: string;
  generationStatus: string;
  previewId: string | null;
  customTitle: string | null;
  customDescription: string | null;
  planTier: string | null;
  verifiedAt: string | null;
  lastUpdated: string | null;
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

function StatBadge({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/60">
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium text-white">{value.toLocaleString()}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function OrbitCard({ orbit }: { orbit: OwnedOrbit }) {
  const displayName = orbit.customTitle || new URL(orbit.sourceUrl).hostname.replace('www.', '');
  const tierColors: Record<string, string> = {
    free: 'bg-zinc-700 text-zinc-300',
    grow: 'bg-blue-500/20 text-blue-400',
    insight: 'bg-purple-500/20 text-purple-400',
    intelligence: 'bg-pink-500/20 text-pink-400',
  };
  const tierColor = tierColors[orbit.planTier || 'free'] || tierColors.free;

  return (
    <div 
      className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
      data-testid={`orbit-card-${orbit.businessSlug}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">{displayName}</h3>
            <p className="text-xs text-white/40 truncate">{orbit.sourceUrl}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${tierColor}`}>
          {orbit.planTier || 'Free'}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <StatBadge icon={Eye} value={orbit.stats.visits} label="visits" />
        <StatBadge icon={MousePointer} value={orbit.stats.interactions} label="interactions" />
        <StatBadge icon={MessageCircle} value={orbit.stats.conversations} label="chats" />
        <StatBadge icon={Sparkles} value={orbit.stats.iceViews} label="ICE views" />
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/orbit/${orbit.businessSlug}/hub`}>
          <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white" data-testid={`button-hub-${orbit.businessSlug}`}>
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            Open Hub
          </Button>
        </Link>
        <Link href={`/orbit/${orbit.businessSlug}`}>
          <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" data-testid={`button-view-${orbit.businessSlug}`}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            View Public
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function MyOrbits() {
  const { data, isLoading, error } = useQuery<OrbitsResponse>({
    queryKey: ["my-orbits"],
    queryFn: async () => {
      const response = await fetch("/api/me/orbits");
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in to view your Orbits");
        }
        throw new Error("Failed to fetch your Orbits");
      }
      return response.json();
    },
  });

  return (
    <OrbitLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-my-orbits-title">
              My Orbits
            </h1>
            <p className="text-white/60 text-sm">
              Manage your business presences
            </p>
          </div>
          <Link href="/orbit/claim">
            <Button className="bg-blue-500 hover:bg-blue-600" data-testid="button-claim-new">
              <Plus className="w-4 h-4 mr-2" />
              Claim New Orbit
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{(error as Error).message}</p>
            <Link href="/login">
              <Button variant="outline" className="border-white/20 text-white">
                Sign In
              </Button>
            </Link>
          </div>
        )}

        {data && data.orbits.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
              <Globe className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">No Orbits yet</h2>
            <p className="text-white/60 max-w-md mx-auto">
              Claim your first Orbit to control how AI systems represent your business
            </p>
            <Link href="/orbit/claim">
              <Button className="bg-blue-500 hover:bg-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Claim Your First Orbit
              </Button>
            </Link>
          </div>
        )}

        {data && data.orbits.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.orbits.map((orbit) => (
              <OrbitCard key={orbit.businessSlug} orbit={orbit} />
            ))}
          </div>
        )}
      </div>
    </OrbitLayout>
  );
}
