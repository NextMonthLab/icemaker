import { useState } from "react";
import { Share2, ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrbitShareModal } from "./OrbitShareModal";

interface HubSettingsPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
  customTitle?: string | null;
}

export function HubSettingsPanel({ 
  businessSlug, 
  planTier,
  customTitle,
}: HubSettingsPanelProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold text-white mb-1">Settings</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Configure your Orbit settings
      </p>

      <div className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Share & Embed</h3>
                <p className="text-zinc-400 text-sm">Get your Orbit link and embed code for your website</p>
              </div>
            </div>
            <Button
              onClick={() => setShowShareModal(true)}
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
              data-testid="button-open-share-modal"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Share
            </Button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
              <Settings className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-white font-medium">General Settings</h3>
              <p className="text-zinc-400 text-sm">More configuration options coming soon</p>
            </div>
          </div>
        </div>
      </div>

      <OrbitShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        businessSlug={businessSlug}
        brandName={customTitle || undefined}
      />
    </div>
  );
}
