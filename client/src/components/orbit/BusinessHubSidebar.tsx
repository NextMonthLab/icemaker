import { useState } from "react";
import { 
  LayoutDashboard, 
  Grid3X3, 
  Sparkles, 
  Palette, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  TrendingUp,
  Crown,
  MessageSquare,
  UserCheck,
  Bell,
  Database,
  Box,
  Radar,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HubPanel = 'overview' | 'grid' | 'ice' | 'brand' | 'settings' | 'conversations' | 'leads' | 'notifications' | 'data-sources' | 'cubes' | 'ai-discovery' | 'knowledge-coach';

interface BusinessHubSidebarProps {
  isOwner: boolean;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
  businessSlug: string;
  activePanel: HubPanel;
  onPanelChange: (panel: HubPanel) => void;
  onClose: () => void;
  analytics?: {
    visits: number;
    interactions: number;
    conversations: number;
    leads: number;
  };
}

const tierColors = {
  free: 'text-zinc-400',
  grow: 'text-emerald-400',
  insight: 'text-purple-400',
  intelligence: 'text-amber-400',
};

const tierLabels = {
  free: 'Free',
  grow: 'Grow',
  insight: 'Understand',
  intelligence: 'Intelligence',
};

export function BusinessHubSidebar({
  isOwner,
  planTier,
  businessSlug,
  activePanel,
  onPanelChange,
  onClose,
  analytics,
}: BusinessHubSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const PAID_TIERS = ['grow', 'insight', 'intelligence'];
  const INSIGHT_TIERS = ['insight', 'intelligence'];
  const isPaidTier = PAID_TIERS.includes(planTier);
  const isInsightTier = INSIGHT_TIERS.includes(planTier);

  const navItems = [
    { 
      id: 'overview' as HubPanel, 
      label: 'Overview', 
      icon: LayoutDashboard,
      description: 'Activity & metrics',
      available: true,
    },
    { 
      id: 'conversations' as HubPanel, 
      label: 'Conversations', 
      icon: MessageSquare,
      description: isInsightTier ? 'View transcripts' : 'Chat insights',
      available: isPaidTier,
      tierRequired: 'grow',
      insightRequired: true,
    },
    { 
      id: 'leads' as HubPanel, 
      label: 'Leads', 
      icon: UserCheck,
      description: isInsightTier ? 'View journey context' : 'Lead capture',
      available: isPaidTier,
      tierRequired: 'grow',
      insightRequired: true,
    },
    { 
      id: 'data-sources' as HubPanel, 
      label: 'Data Sources', 
      icon: Database,
      description: 'Connect external APIs',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'cubes' as HubPanel, 
      label: 'Orbit Cube', 
      icon: Box,
      description: 'Physical kiosk devices',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'grid' as HubPanel, 
      label: 'Grid', 
      icon: Grid3X3,
      description: 'Curate your content',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'ice' as HubPanel, 
      label: 'ICE Maker', 
      icon: Sparkles,
      description: 'Create experiences',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'brand' as HubPanel, 
      label: 'Brand', 
      icon: Palette,
      description: 'Customize appearance',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'ai-discovery' as HubPanel, 
      label: 'AI Discovery', 
      icon: Radar,
      description: 'Control how AI sees you',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'knowledge-coach' as HubPanel, 
      label: 'Knowledge Coach', 
      icon: GraduationCap,
      description: 'Fill knowledge gaps',
      available: isPaidTier,
      tierRequired: 'grow',
    },
    { 
      id: 'notifications' as HubPanel, 
      label: 'Notifications', 
      icon: Bell,
      description: 'Alert preferences',
      available: isInsightTier,
      tierRequired: 'insight',
    },
    { 
      id: 'settings' as HubPanel, 
      label: 'Settings', 
      icon: Settings,
      description: 'Orbit configuration',
      available: true,
    },
  ];

  return (
    <div 
      className={cn(
        "h-full bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-800 flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      data-testid="business-hub-sidebar"
    >
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Crown className={cn("h-5 w-5", tierColors[planTier])} />
            <div>
              <p className="text-sm font-medium text-white">Business Hub</p>
              <p className={cn("text-xs", tierColors[planTier])}>
                {tierLabels[planTier]}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 text-zinc-400 hover:text-white"
          data-testid="button-toggle-sidebar"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && analytics && (
        <div className="p-4 border-b border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                <Users className="h-3 w-3" />
                <span>Visits</span>
              </div>
              <p className="text-lg font-semibold text-white" data-testid="text-visits-count">
                {analytics.visits.toLocaleString()}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                <TrendingUp className="h-3 w-3" />
                <span>Chats</span>
              </div>
              <p className="text-lg font-semibold text-white" data-testid="text-conversations-count">
                {analytics.conversations.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const isLocked = !item.available;
          
          return (
            <button
              key={item.id}
              onClick={() => !isLocked && onPanelChange(item.id)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-1",
                isActive 
                  ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-pink-500/30" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                isLocked && "opacity-50 cursor-not-allowed",
                isCollapsed && "justify-center"
              )}
              data-testid={`nav-${item.id}`}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-pink-400")} />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{item.label}</p>
                  {isLocked ? (
                    <p className="text-xs text-zinc-500">Requires {tierLabels[item.tierRequired as keyof typeof tierLabels]}</p>
                  ) : (
                    <p className="text-xs text-zinc-500">{item.description}</p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {!isCollapsed && planTier === 'free' && (
        <div className="p-4 border-t border-zinc-800">
          <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-lg p-3 border border-pink-500/20">
            <p className="text-sm font-medium text-white mb-1">Unlock More Features</p>
            <p className="text-xs text-zinc-400 mb-3">
              Upgrade to Grow to curate your grid, create ICE experiences, and customize your brand.
            </p>
            <Button 
              size="sm" 
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              data-testid="button-upgrade-tier"
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={cn("text-zinc-400 hover:text-white", isCollapsed ? "w-full px-0" : "w-full")}
          data-testid="button-close-hub"
        >
          {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : "Close Hub"}
        </Button>
      </div>
    </div>
  );
}
