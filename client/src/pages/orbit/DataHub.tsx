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
  BarChart3,
  Users,
  Mail,
  Phone,
  Building2
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

interface LeadData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  createdAt: string;
  isRead: boolean;
}

interface LeadsResponse {
  count: number;
  leads: LeadData[] | null;
  isOwner: boolean;
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
    <div 
      className={`orbit-metric-card bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 ${locked ? 'opacity-60' : 'cursor-default'}`}
      data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
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
    <div 
      className="orbit-hover bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 relative overflow-hidden"
      data-testid={`locked-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-zinc-600" />
          <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
        </div>
        <p className="text-xs text-zinc-600 mb-4">{description}</p>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-zinc-800/50 rounded" style={{ width: `${70 + i * 10}%` }} />
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

  const { data: leadsData } = useQuery<LeadsResponse>({
    queryKey: ["orbit-leads", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/leads`);
      if (!response.ok) throw new Error("Failed to load leads");
      return response.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm mt-4">Loading intelligence...</p>
        </div>
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

  if (!hubData.isOwner) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <Lock className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <h2 className="text-xl font-semibold text-white mb-2">Access restricted</h2>
          <p className="text-zinc-400 mb-6 text-sm">
            Only the owner of this Orbit can access the Business Hub.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/orbit/${slug}`)}
            data-testid="button-return-to-orbit"
          >
            View Orbit
          </Button>
        </div>
      </div>
    );
  }

  if (!hubData.isPaid) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-pink-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Upgrade to unlock your Business Hub</h2>
          <p className="text-zinc-400 mb-6 text-sm">
            See who's visiting, what they're asking, and shape your Orbit to grow your business.
          </p>
          <div className="flex flex-col gap-3">
            <Button 
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              data-testid="button-upgrade-to-grow"
            >
              Upgrade to Grow
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setLocation(`/orbit/${slug}?view=public`)}
              className="text-zinc-400"
              data-testid="button-view-orbit"
            >
              View your Orbit
            </Button>
          </div>
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

        {/* Leads Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Leads
            </h2>
            {leadsData && (
              <span className="text-sm text-pink-400 font-medium">
                {leadsData.count} total
              </span>
            )}
          </div>
          
          {leadsData?.leads && leadsData.leads.length > 0 ? (
            <div className="space-y-3">
              {leadsData.leads.slice(0, 5).map((lead) => (
                <div 
                  key={lead.id}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4"
                  data-testid={`lead-${lead.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-white">{lead.name}</div>
                    <div className="text-xs text-zinc-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {lead.email}
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </div>
                    )}
                    {lead.company && (
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {lead.company}
                      </div>
                    )}
                  </div>
                  {lead.message && (
                    <p className="mt-2 text-sm text-zinc-500 line-clamp-2">
                      {lead.message}
                    </p>
                  )}
                </div>
              ))}
              {leadsData.count > 5 && (
                <p className="text-center text-sm text-zinc-500">
                  +{leadsData.count - 5} more leads
                </p>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-6 text-center">
              <Users className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500 mb-1">No leads yet</p>
              <p className="text-xs text-zinc-600">
                Visitors can request contact through your Orbit
              </p>
            </div>
          )}
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
