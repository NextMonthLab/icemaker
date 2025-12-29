import { useQuery } from "@tanstack/react-query";
import { 
  Radar, 
  Bot, 
  Eye, 
  Clock, 
  Shield, 
  FileJson,
  ExternalLink,
  Activity,
  Lock,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SignalMetrics {
  totalAccesses: number;
  lastAccessAt: string | null;
  topUserAgents: { agent: string; count: number }[];
}

interface HubAIDiscoveryPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subtext 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  subtext?: string;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-zinc-800 rounded-lg">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>
      </div>
      <div className="text-3xl font-semibold mb-1 text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
      {subtext && <div className="text-xs text-zinc-600 mt-1">{subtext}</div>}
    </div>
  );
}

function LockedSection({ title, description, upgradeTier }: { title: string; description: string; upgradeTier?: string }) {
  return (
    <div 
      className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 relative overflow-hidden"
      data-testid={`locked-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-zinc-600" />
          <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
        </div>
        <p className="text-xs text-zinc-600 mb-4">{description}</p>
        {upgradeTier && (
          <p className="text-xs text-purple-400">Upgrade to {upgradeTier} to unlock</p>
        )}
        <div className="space-y-2 mt-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-zinc-800/50 rounded" style={{ width: `${70 + i * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HubAIDiscoveryPanel({ businessSlug, planTier }: HubAIDiscoveryPanelProps) {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  
  const isPaidTier = ['grow', 'insight', 'intelligence'].includes(planTier);
  
  const { data: metrics, isLoading } = useQuery<SignalMetrics>({
    queryKey: ["/api/orbit", businessSlug, "signal-metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${businessSlug}/signal/metrics?days=30`);
      if (!response.ok) {
        if (response.status === 403) {
          return { totalAccesses: 0, lastAccessAt: null, topUserAgents: [] };
        }
        throw new Error("Failed to fetch metrics");
      }
      return response.json();
    },
    enabled: isPaidTier,
  });

  const signalEndpoint = `/.well-known/orbit.json`;
  
  const copyEndpoint = () => {
    navigator.clipboard.writeText(window.location.origin + signalEndpoint);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const formatLastAccess = (dateStr: string | null) => {
    if (!dateStr) return "No access yet";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return "Less than an hour ago";
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1 flex items-center gap-2">
          <Radar className="h-6 w-6 text-purple-400" />
          AI Discovery Control
        </h2>
        <p className="text-zinc-400 text-sm">
          Control how AI systems discover and understand your business
        </p>
      </div>

      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg">
            <FileJson className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-white mb-1">Orbit Signal Schema v0.1</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Your machine-readable business identity for AI systems. When AI assistants and search engines 
              visit your Orbit, they receive structured data about your services, positioning, and contact information.
            </p>
            
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 font-mono">
                {signalEndpoint}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyEndpoint}
                className="border-zinc-700 hover:bg-zinc-800"
                data-testid="button-copy-endpoint"
              >
                {copiedEndpoint ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/orbit/${businessSlug}/signal-schema`, '_blank')}
                className="border-zinc-700 hover:bg-zinc-800"
                data-testid="button-view-schema"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View
              </Button>
            </div>
            
            <div className="flex gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" /> HMAC Signed
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> 7-day TTL
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-zinc-400" />
          AI Access Metrics
          {!isPaidTier && <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Grow+</span>}
        </h3>
        
        {!isPaidTier ? (
          <LockedSection 
            title="AI Access Metrics" 
            description="Track when AI systems access your Signal Schema and which systems are discovering your business."
            upgradeTier="Grow"
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 animate-pulse">
                <div className="h-10 w-10 bg-zinc-800 rounded-lg mb-3" />
                <div className="h-8 w-16 bg-zinc-800 rounded mb-1" />
                <div className="h-4 w-24 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon={Eye}
              label="Total AI Accesses"
              value={metrics?.totalAccesses || 0}
              subtext="Last 30 days"
            />
            <MetricCard
              icon={Clock}
              label="Last Access"
              value={formatLastAccess(metrics?.lastAccessAt || null)}
            />
            <MetricCard
              icon={Bot}
              label="Unique AI Systems"
              value={metrics?.topUserAgents?.length || 0}
              subtext="Distinct user agents"
            />
          </div>
        )}
      </div>

      {isPaidTier && metrics?.topUserAgents && metrics.topUserAgents.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Top AI Systems</h3>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">User Agent</th>
                  <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Accesses</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topUserAgents.map((agent, idx) => (
                  <tr key={idx} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 text-sm text-zinc-300 font-mono truncate max-w-xs">
                      {agent.agent}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-right">
                      {agent.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-2">What AI Systems See</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Your Signal Schema includes:
          </p>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              Business identity and description
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              Services and capabilities
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              Proof points and testimonials
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              FAQ answers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              AI response guidance
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              Contact information
            </li>
          </ul>
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-medium text-white mb-2">How It Works</h3>
          <p className="text-sm text-zinc-400 mb-4">
            When AI assistants like ChatGPT, Claude, or Perplexity need information about your business:
          </p>
          <ol className="space-y-2 text-sm text-zinc-300 list-decimal list-inside">
            <li>They request your Signal Schema endpoint</li>
            <li>Orbit serves structured, accurate data</li>
            <li>AI systems use this to answer questions about you</li>
            <li>You get better, more accurate AI representation</li>
          </ol>
          <p className="text-xs text-zinc-500 mt-4">
            Think of it as SEO for AI - ensuring AI systems have the right information to represent your business.
          </p>
        </div>
      </div>
    </div>
  );
}
