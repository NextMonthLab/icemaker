import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Building2,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlobalNav from "@/components/GlobalNav";

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

  const { data: plans } = useQuery<{ name: string; stripePriceIdMonthly: string | null }[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const proPlan = plans?.find(p => p.name === "pro");
      if (!proPlan?.stripePriceIdMonthly) {
        throw new Error("Pro plan not available");
      }
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: proPlan.stripePriceIdMonthly,
          planName: "pro",
        }),
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to create checkout session");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        // Redirect to Stripe checkout (same window works better on mobile)
        window.location.href = data.url;
      }
    },
  });

  const handleUpgrade = () => {
    upgradeMutation.mutate();
  };

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
    // Free tier: Show basic management view with teaser analytics and locked premium sections
    const trendIndicator = hubData.activity.visits > 10 ? "↑" : hubData.activity.visits > 0 ? "→" : "–";
    
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" breadcrumbHref={`/orbit/${slug}`} />
        <div className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/orbit/${slug}`)}
              className="text-zinc-400 hover:text-white"
              data-testid="button-back-to-orbit-free"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Manage Your Orbit</h1>
              <p className="text-sm text-zinc-500">{slug}</p>
            </div>
          </div>
          
          {/* Ownership Confirmation */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-medium">You own this Orbit</p>
                <p className="text-xs text-zinc-500">Claimed and verified</p>
              </div>
            </div>
          </div>

          {/* Basic Analytics - Teaser Level */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-zinc-400" />
              Activity Overview
              <span className="text-xs text-zinc-500 font-normal">(Last 30 days)</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-zinc-500">{trendIndicator}</span>
                </div>
                <p className="text-2xl font-bold">{hubData.activity.visits}</p>
                <p className="text-xs text-zinc-500">Total Visits</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <MessageCircle className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-2xl font-bold">{hubData.activity.conversations}</p>
                <p className="text-xs text-zinc-500">Conversations</p>
              </div>
            </div>
            {hubData.activity.visits > 0 && (
              <p className="text-sm text-zinc-400 mt-4 text-center">
                <Sparkles className="w-4 h-4 inline mr-1 text-pink-400" />
                Your Orbit is being discovered!
              </p>
            )}
          </div>

          {/* Locked Premium Sections */}
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-zinc-400" />
              Unlock More Insights
            </h2>
            
            {/* Locked: Audience Insights */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-400">Audience Breakdown</p>
                    <p className="text-xs text-zinc-600">See who's visiting and when</p>
                  </div>
                </div>
                <Lock className="w-4 h-4 text-zinc-600" />
              </div>
            </div>

            {/* Locked: AI Insights */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-400">AI Recommendations</p>
                    <p className="text-xs text-zinc-600">Personalised growth insights</p>
                  </div>
                </div>
                <Lock className="w-4 h-4 text-zinc-600" />
              </div>
            </div>

            {/* Locked: Leads & Introductions */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-400">Leads & Introductions</p>
                    <p className="text-xs text-zinc-600">Connect with interested visitors</p>
                  </div>
                </div>
                <Lock className="w-4 h-4 text-zinc-600" />
              </div>
            </div>
          </div>

          {/* Upgrade CTA - Positioned as advantage, not gate */}
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-6 text-center">
            <h3 className="text-lg font-medium mb-2">Ready for the full picture?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Unlock audience insights, AI recommendations, and lead notifications.
            </p>
            <Button 
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              data-testid="button-upgrade-to-grow"
              onClick={handleUpgrade}
              disabled={upgradeMutation.isPending}
            >
              {upgradeMutation.isPending ? "Loading..." : "Upgrade to Grow"}
            </Button>
          </div>

          {/* View Orbit Link */}
          <div className="text-center mt-6">
            <Button 
              variant="ghost" 
              onClick={() => setLocation(`/orbit/${slug}`)}
              className="text-zinc-400"
              data-testid="button-view-orbit"
            >
              ← View your Orbit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GlobalNav context="orbit" showBreadcrumb breadcrumbLabel="Orbit" breadcrumbHref={`/orbit/${slug}`} />
      <div className="max-w-4xl mx-auto px-4 py-8 flex-1">
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
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/orbit/${slug}/import`)}
              className="text-pink-400 border-pink-500/30 hover:bg-pink-500/10"
              data-testid="button-import-catalogue"
            >
              <Package className="w-4 h-4 mr-1.5" />
              Import Catalogue
            </Button>
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
            onClick={handleUpgrade}
            disabled={upgradeMutation.isPending}
          >
            {upgradeMutation.isPending ? "Processing..." : "Upgrade to Business Hub"}
          </Button>
        </div>
      </div>
    </div>
  );
}
