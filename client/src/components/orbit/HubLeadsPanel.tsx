import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Clock, Mail, Building, ChevronRight, Lock, X, MessageSquare, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HubLeadsPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

interface Lead {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string;
  isRead: boolean;
  sessionId?: string;
  boxId?: number;
  conversationId?: number;
  lastQuestion?: string;
  createdAt: string;
  preview?: boolean;
}

interface Event {
  id: number;
  eventType: string;
  boxId?: number;
  iceId?: number;
  createdAt: string;
}

interface LeadsResponse {
  leads: Lead[];
  count: number;
  locked: boolean;
  upgradeMessage?: string;
}

interface LeadDetailResponse {
  lead: Lead;
  events: Event[];
  conversationExcerpt: { role: string; content: string; createdAt: string }[];
}

export function HubLeadsPanel({ businessSlug, planTier }: HubLeadsPanelProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const INSIGHT_TIERS = ['insight', 'intelligence'];
  const isInsightTier = INSIGHT_TIERS.includes(planTier);

  const { data: leadsData, isLoading: loadingLeads } = useQuery<LeadsResponse>({
    queryKey: ['/api/orbit', businessSlug, 'leads'],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/leads`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json();
    },
  });

  const { data: leadDetail, isLoading: loadingDetail } = useQuery<LeadDetailResponse>({
    queryKey: ['/api/orbit', businessSlug, 'leads', selectedLeadId],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/leads/${selectedLeadId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch lead');
      return res.json();
    },
    enabled: !!selectedLeadId && isInsightTier,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      orbit: 'Orbit Page',
      chat: 'Chat Widget',
      cta: 'CTA Button',
      ice: 'ICE Experience',
    };
    return labels[source] || source;
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      visit: 'Visited Orbit',
      box_open: 'Opened Box',
      box_click: 'Clicked Box',
      chat_message: 'Sent Message',
      ice_open: 'Opened ICE',
      lead_submit: 'Submitted Lead',
    };
    return labels[eventType] || eventType;
  };

  if (loadingLeads) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
          <div className="space-y-3 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const leads = leadsData?.leads || [];
  const isLocked = leadsData?.locked || false;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-1">Leads</h2>
        <p className="text-zinc-400 text-sm">
          {isInsightTier ? 'View leads with journey context' : 'Upgrade to view lead details and journeys'}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="bg-zinc-800/50 rounded-lg px-4 py-2">
          <p className="text-xs text-zinc-500 mb-0.5">Total Leads</p>
          <p className="text-lg font-semibold text-white" data-testid="text-leads-count">
            {leadsData?.count || 0}
          </p>
        </div>
        {!isInsightTier && (
          <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              <p className="text-sm text-amber-200">
                {leadsData?.upgradeMessage || 'Upgrade to Orbit Insight to view lead details'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {leads.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No leads captured yet</p>
                <p className="text-sm mt-1">Leads from chat and forms will appear here</p>
              </div>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => isInsightTier && setSelectedLeadId(lead.id)}
                  disabled={!isInsightTier}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all",
                    selectedLeadId === lead.id
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600",
                    !isInsightTier && "opacity-60 cursor-not-allowed"
                  )}
                  data-testid={`lead-item-${lead.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-white">
                        {lead.preview ? lead.name : lead.name}
                      </span>
                    </div>
                    {isInsightTier && (
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="bg-zinc-700/50 px-2 py-0.5 rounded">
                      {getSourceLabel(lead.source)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                  </div>
                  {lead.preview && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                      <Lock className="h-3 w-3" />
                      <span>Details locked</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {selectedLeadId && isInsightTier && (
          <div className="w-96 bg-zinc-800/30 rounded-lg border border-zinc-700/50 flex flex-col">
            <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Lead Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedLeadId(null)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {loadingDetail ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-zinc-700 rounded"></div>
                  ))}
                </div>
              ) : leadDetail ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-400" />
                      <span className="font-medium text-white">{leadDetail.lead.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Mail className="h-4 w-4" />
                      <span>{leadDetail.lead.email}</span>
                    </div>
                    {leadDetail.lead.company && (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Building className="h-4 w-4" />
                        <span>{leadDetail.lead.company}</span>
                      </div>
                    )}
                    {leadDetail.lead.message && (
                      <div className="bg-zinc-700/30 rounded-lg p-3">
                        <p className="text-xs text-zinc-500 mb-1">Message</p>
                        <p className="text-sm text-zinc-300">{leadDetail.lead.message}</p>
                      </div>
                    )}
                  </div>

                  {leadDetail.events.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        Journey Before Conversion
                      </h4>
                      <div className="space-y-1.5">
                        {leadDetail.events.slice(-5).map((event, i) => (
                          <div
                            key={event.id}
                            className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-700/20 rounded px-2 py-1.5"
                          >
                            <span className="text-zinc-500">{i + 1}.</span>
                            <span>{getEventLabel(event.eventType)}</span>
                            <span className="text-zinc-600 ml-auto">
                              {formatDate(event.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {leadDetail.conversationExcerpt.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" />
                        Conversation Excerpt
                      </h4>
                      <div className="space-y-2">
                        {leadDetail.conversationExcerpt.map((msg, i) => (
                          <div
                            key={i}
                            className={cn(
                              "p-2 rounded text-xs",
                              msg.role === 'user'
                                ? "bg-zinc-700/50 text-zinc-300"
                                : "bg-purple-500/10 text-purple-200"
                            )}
                          >
                            <span className="font-medium opacity-70">
                              {msg.role === 'user' ? 'Visitor: ' : 'AI: '}
                            </span>
                            {msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
