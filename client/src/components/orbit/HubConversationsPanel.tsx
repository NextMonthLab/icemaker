import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Clock, ChevronRight, Lock, TrendingUp, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface HubConversationsPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

interface Conversation {
  id: number;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  leadGenerated: boolean;
  engagedBoxIds?: number[];
  extractedQuestions?: string[];
  preview?: boolean;
}

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationsResponse {
  conversations: Conversation[];
  count: number;
  locked: boolean;
  upgradeMessage?: string;
}

interface ConversationDetailResponse {
  conversation: Conversation;
  messages: Message[];
  events: any[];
}

interface InsightsSummaryResponse {
  conversationCount: number;
  leadsCount: number;
  topQuestions?: string[];
  topThemes?: string[];
  locked: boolean;
  upgradeMessage?: string;
}

export function HubConversationsPanel({ businessSlug, planTier }: HubConversationsPanelProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const INSIGHT_TIERS = ['insight', 'intelligence'];
  const isInsightTier = INSIGHT_TIERS.includes(planTier);

  const { data: conversationsData, isLoading: loadingConversations } = useQuery<ConversationsResponse>({
    queryKey: ['/api/orbit', businessSlug, 'conversations'],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/conversations`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
  });

  const { data: insightsData } = useQuery<InsightsSummaryResponse>({
    queryKey: ['/api/orbit', businessSlug, 'insights', 'summary'],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/insights/summary`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch insights');
      return res.json();
    },
  });

  const { data: conversationDetail, isLoading: loadingDetail } = useQuery<ConversationDetailResponse>({
    queryKey: ['/api/orbit', businessSlug, 'conversations', selectedConversationId],
    queryFn: async () => {
      const res = await fetch(`/api/orbit/${businessSlug}/conversations/${selectedConversationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return res.json();
    },
    enabled: !!selectedConversationId && isInsightTier,
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

  if (loadingConversations) {
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

  const conversations = conversationsData?.conversations || [];
  const isLocked = conversationsData?.locked || false;

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white mb-1">Conversations</h2>
        <p className="text-zinc-400 text-sm">
          {isInsightTier ? 'View chat transcripts and visitor questions' : 'Upgrade to view conversation details'}
        </p>
      </div>

      {insightsData && !insightsData.locked && insightsData.topQuestions && insightsData.topQuestions.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-medium text-white">Top Questions This Month</h3>
          </div>
          <div className="space-y-2">
            {insightsData.topQuestions.slice(0, 3).map((question, i) => (
              <div key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                <span>{question}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div className="bg-zinc-800/50 rounded-lg px-4 py-2">
          <p className="text-xs text-zinc-500 mb-0.5">Total</p>
          <p className="text-lg font-semibold text-white" data-testid="text-conversation-count">
            {conversationsData?.count || 0}
          </p>
        </div>
        {!isInsightTier && (
          <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              <p className="text-sm text-amber-200">
                {conversationsData?.upgradeMessage || 'Upgrade to Orbit Insight to view transcripts'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Visitors will appear here when they chat</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => isInsightTier && setSelectedConversationId(conv.id)}
                  disabled={!isInsightTier}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border transition-all",
                    selectedConversationId === conv.id
                      ? "bg-purple-500/10 border-purple-500/30"
                      : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600",
                    !isInsightTier && "opacity-60 cursor-not-allowed"
                  )}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-zinc-400" />
                      <span className="text-sm font-medium text-white">
                        {conv.messageCount} messages
                      </span>
                      {conv.leadGenerated && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                          Lead
                        </span>
                      )}
                    </div>
                    {isInsightTier && (
                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(conv.startedAt)}</span>
                  </div>
                  {conv.preview && (
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

        {selectedConversationId && isInsightTier && (
          <div className="w-96 bg-zinc-800/30 rounded-lg border border-zinc-700/50 flex flex-col">
            <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Conversation Detail</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedConversationId(null)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
              {loadingDetail ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-zinc-700 rounded"></div>
                  ))}
                </div>
              ) : conversationDetail ? (
                <div className="space-y-3">
                  {conversationDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-3 rounded-lg text-sm",
                        msg.role === 'user'
                          ? "bg-zinc-700/50 text-zinc-200"
                          : "bg-purple-500/10 text-purple-100 border border-purple-500/20"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium opacity-70">
                          {msg.role === 'user' ? 'Visitor' : 'AI'}
                        </span>
                        <span className="text-xs opacity-50">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p>{msg.content}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
