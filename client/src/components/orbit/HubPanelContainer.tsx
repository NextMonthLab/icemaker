import { HubOverviewPanel } from "./HubOverviewPanel";
import { HubGridPanel } from "./HubGridPanel";
import { HubBrandPanel } from "./HubBrandPanel";
import { HubConversationsPanel } from "./HubConversationsPanel";
import { HubLeadsPanel } from "./HubLeadsPanel";
import { HubIcePanel } from "./HubIcePanel";
import { HubNotificationsPanel } from "./HubNotificationsPanel";
import type { HubPanel } from "./BusinessHubSidebar";

interface HubPanelContainerProps {
  activePanel: HubPanel;
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
  customTitle?: string | null;
  customDescription?: string | null;
}

export function HubPanelContainer({ 
  activePanel, 
  businessSlug, 
  planTier,
  customTitle,
  customDescription,
}: HubPanelContainerProps) {
  switch (activePanel) {
    case 'overview':
      return <HubOverviewPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'conversations':
      return <HubConversationsPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'leads':
      return <HubLeadsPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'grid':
      return <HubGridPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'ice':
      return <HubIcePanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'brand':
      return (
        <HubBrandPanel 
          businessSlug={businessSlug} 
          planTier={planTier}
          currentTitle={customTitle}
          currentDescription={customDescription}
        />
      );
    
    case 'notifications':
      return (
        <div className="p-6">
          <HubNotificationsPanel tier={planTier} />
        </div>
      );
    
    case 'settings':
      return (
        <div className="p-6">
          <h2 className="text-2xl font-semibold text-white mb-1">Settings</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Configure your Orbit settings
          </p>
          <div className="border border-dashed border-zinc-700 rounded-lg p-8 text-center">
            <p className="text-zinc-500">Settings panel coming soon</p>
          </div>
        </div>
      );
    
    default:
      return null;
  }
}
