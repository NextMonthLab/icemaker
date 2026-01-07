import { HubOverviewPanel } from "./HubOverviewPanel";
import { HubGridPanel } from "./HubGridPanel";
import { HubBrandPanel } from "./HubBrandPanel";
import { HubConversationsPanel } from "./HubConversationsPanel";
import { HubLeadsPanel } from "./HubLeadsPanel";
import { HubIcePanel } from "./HubIcePanel";
import { HubNotificationsPanel } from "./HubNotificationsPanel";
import { HubDataSourcesPanel } from "./HubDataSourcesPanel";
import { HubCubesPanel } from "./HubCubesPanel";
import { HubAIDiscoveryPanel } from "./HubAIDiscoveryPanel";
import { HubSettingsPanel } from "./HubSettingsPanel";
import { HubKnowledgeCoachPanel } from "./HubKnowledgeCoachPanel";
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
    
    case 'data-sources':
      return <HubDataSourcesPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'cubes':
      return <HubCubesPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'ai-discovery':
      return <HubAIDiscoveryPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'knowledge-coach':
      return <HubKnowledgeCoachPanel businessSlug={businessSlug} planTier={planTier} />;
    
    case 'settings':
      return (
        <HubSettingsPanel 
          businessSlug={businessSlug} 
          planTier={planTier}
          customTitle={customTitle}
        />
      );
    
    default:
      return null;
  }
}
