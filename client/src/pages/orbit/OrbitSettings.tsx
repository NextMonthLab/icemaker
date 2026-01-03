import { Settings, Building2, Globe, Bell, Shield, FileText, Zap, Check, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import OrbitLayout from "@/components/OrbitLayout";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface OrbitSource {
  id: number;
  label: string;
  sourceType: string;
  value: string;
}

interface OrbitMeta {
  strengthScore: number;
  planTier: string;
}

export default function OrbitSettings() {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: sourcesData } = useQuery<{ sources: OrbitSource[] }>({
    queryKey: ["orbit-sources", slug],
    queryFn: async () => {
      if (!slug) return { sources: [] };
      const response = await fetch(`/api/orbit/${slug}/sources`, { credentials: "include" });
      if (!response.ok) return { sources: [] };
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: orbitData } = useQuery<OrbitMeta>({
    queryKey: ["orbit-meta", slug],
    queryFn: async () => {
      if (!slug) return { strengthScore: 0, planTier: 'free' };
      const response = await fetch(`/api/orbit/${slug}/meta`, { credentials: "include" });
      if (!response.ok) return { strengthScore: 0, planTier: 'free' };
      return response.json();
    },
    enabled: !!slug,
  });

  const sources = sourcesData?.sources || [];
  const strengthScore = orbitData?.strengthScore ?? 0;
  const isPowered = strengthScore > 0;

  const getSourceLabel = (label: string) => {
    const labels: Record<string, string> = {
      about: 'About Page',
      services: 'Services/Pricing',
      faq: 'FAQ/Contact',
      homepage: 'Homepage',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      facebook: 'Facebook',
      tiktok: 'TikTok',
    };
    return labels[label] || label;
  };

  return (
    <OrbitLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-settings-title">
            Settings
          </h1>
          <p className="text-white/60 text-sm">
            Manage your Orbit preferences and knowledge sources
          </p>
        </div>

        <div className="space-y-6">
          {/* Knowledge Sources Section */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-sources">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Knowledge Sources</h2>
                  <p className="text-xs text-white/50">Pages and links that power your Orbit</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={isPowered ? "border-blue-500/50 text-blue-400" : "border-amber-500/50 text-amber-400"}
              >
                {isPowered ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
                    Powered insights
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
                    Starter (3)
                  </>
                )}
              </Badge>
            </div>
            
            {/* Strength Progress */}
            <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60">Orbit Strength</span>
                <span className="text-sm font-semibold text-white">{strengthScore}/100</span>
              </div>
              <Progress value={strengthScore} className="h-1.5" />
            </div>
            
            {/* Source List */}
            {sources.length > 0 ? (
              <div className="space-y-2 mb-4">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-sm text-white/80">{getSourceLabel(source.label)}</span>
                    </div>
                    {source.sourceType === 'page_url' || source.sourceType === 'social_link' ? (
                      <a
                        href={source.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-white/40">Text</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-white/[0.02] border border-dashed border-white/10 text-center mb-4">
                <p className="text-sm text-white/50">No sources added yet</p>
                <p className="text-xs text-white/30 mt-1">Add sources to power up your Orbit</p>
              </div>
            )}
            
            {/* Add/Edit Sources Button */}
            <Button
              variant="outline"
              className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-edit-sources"
            >
              <Plus className="w-4 h-4 mr-2" />
              {sources.length > 0 ? 'Add More Sources' : 'Add Sources'}
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-business">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Business Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">Business Name</label>
                <Input
                  placeholder="Your Business Name"
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-business-name"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">Website</label>
                <Input
                  placeholder="https://example.com"
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-website"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-ai">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">AI Discovery Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Allow AI Indexing</p>
                  <p className="text-xs text-white/50">Let AI systems discover your business</p>
                </div>
                <Switch defaultChecked data-testid="toggle-ai-indexing" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Auto-Update Knowledge</p>
                  <p className="text-xs text-white/50">Automatically sync changes to AI systems</p>
                </div>
                <Switch defaultChecked data-testid="toggle-auto-update" />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-notifications">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">AI Accuracy Alerts</span>
                <Switch defaultChecked data-testid="toggle-accuracy-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Weekly Reports</span>
                <Switch data-testid="toggle-weekly-reports" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button className="bg-blue-500 hover:bg-blue-600" data-testid="button-save-settings">
            Save Changes
          </Button>
        </div>
      </div>
    </OrbitLayout>
  );
}
