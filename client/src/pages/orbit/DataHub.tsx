import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Eye, 
  MessageCircle, 
  MousePointer, 
  Sparkles, 
  Lock, 
  TrendingUp,
  Calendar,
  ArrowLeft,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HubData {
  businessSlug: string;
  isClaimed: boolean;
  isOwner: boolean;
  isPaid: boolean;
  days: number;
  activity: {
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  };
  daily: Array<{
    date: string;
    visits: number;
    interactions: number;
    conversations: number;
    iceViews: number;
  }>;
  insights: {
    uniqueVisitors: number;
    avgSessionDuration: number;
    topQuestions: string[];
    topTopics: string[];
  } | null;
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  locked = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  trend?: number;
  locked?: boolean;
}) {
  return (
    <div className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 ${locked ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-zinc-800 rounded-lg">
          <Icon className="w-5 h-5 text-zinc-400" />
        </div>
        {locked && <Lock className="w-4 h-4 text-zinc-600" />}
        {trend !== undefined && !locked && (
          <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={`text-3xl font-semibold mb-1 ${locked ? 'blur-sm select-none' : 'text-white'}`}>
        {locked ? '---' : typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}

function LockedSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 relative overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-zinc-600" />
          <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
        </div>
        <p className="text-xs text-zinc-600 mb-4">{description}</p>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-zinc-800/50 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DataHub() {
  const [, params] = useRoute("/orbit/:slug/hub");
  const slug = params?.slug;
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState<'7' | '30'>('30');

  const { data: hubData, isLoading, error } = useQuery<HubData>({
    queryKey: ["orbit-hub", slug, timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/hub?days=${timeRange}`);
      if (!response.ok) throw new Error("Failed to load hub data");
      return response.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !hubData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Unable to load hub data</p>
          <Button variant="outline" onClick={() => setLocation(`/orbit/${slug}`)}>
            Return to Orbit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/orbit/${slug}`)}
              className="text-zinc-400 hover:text-white"
              data-testid="button-back-to-orbit"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-pink-400" />
                Data Hub
              </h1>
              <p className="text-sm text-zinc-500">{slug}</p>
            </div>
          </div>
          
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as '7' | '30')}>
            <TabsList className="bg-zinc-900">
              <TabsTrigger value="7" className="text-xs" data-testid="tab-7-days">
                <Calendar className="w-3 h-3 mr-1" />
                7 days
              </TabsTrigger>
              <TabsTrigger value="30" className="text-xs" data-testid="tab-30-days">
                <Calendar className="w-3 h-3 mr-1" />
                30 days
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!hubData.isClaimed && (
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-pink-300">
              This orbit hasn't been claimed yet. Claim it to access your Data Hub.
            </p>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Activity</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Eye}
              label="Visits"
              value={hubData.activity.visits}
            />
            <MetricCard
              icon={MousePointer}
              label="Interactions"
              value={hubData.activity.interactions}
            />
            <MetricCard
              icon={MessageCircle}
              label="Conversations"
              value={hubData.activity.conversations}
            />
            <MetricCard
              icon={Sparkles}
              label="ICE Views"
              value={hubData.activity.iceViews}
            />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Understanding</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LockedSection
              title="Conversation Insights"
              description="See what your visitors are really asking about"
            />
            <LockedSection
              title="Topic Analysis"
              description="Understand which topics resonate most"
            />
          </div>
          
          <div className="mt-4">
            <LockedSection
              title="Intelligence Summary"
              description="AI-generated insights from visitor interactions"
            />
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-zinc-500 text-sm mb-4">
            Something's happening here. Want to understand what?
          </p>
          <Button 
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
            data-testid="button-upgrade"
          >
            Upgrade to Business Hub
          </Button>
        </div>
      </div>
    </div>
  );
}
