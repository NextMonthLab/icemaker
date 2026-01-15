import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Lock, Sparkles, Zap, Crown } from "lucide-react";

export interface VideoEngine {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  requiredTier: string;
  poweredBy: string;
}

export interface VideoModel {
  id: string;
  name: string;
  description: string;
  costPer5s: number;
  locked?: boolean;
  requiredTier?: string;
}

export interface VideoEngineConfig {
  configured: boolean;
  planTier: string;
  defaultEngine: string;
  canChooseProvider: boolean;
  engines: VideoEngine[];
  models: VideoModel[];
  allModels: VideoModel[];
}

interface VideoEngineSelectorProps {
  config: VideoEngineConfig | undefined;
  selectedEngine: string;
  selectedModel: string;
  onEngineChange: (engine: string) => void;
  onModelChange: (model: string) => void;
  onLockedEngineClick?: (engine: VideoEngine) => void;
  onLockedModelClick?: (model: VideoModel) => void;
  showAdvanced?: boolean;
  className?: string;
}

const engineIcons: Record<string, React.ReactNode> = {
  'auto': <Sparkles className="w-3.5 h-3.5 text-cyan-400" />,
  'standard': <Zap className="w-3.5 h-3.5 text-blue-400" />,
  'advanced': <Zap className="w-3.5 h-3.5 text-purple-400" />,
  'studio': <Crown className="w-3.5 h-3.5 text-amber-400" />,
};

export function VideoEngineSelector({
  config,
  selectedEngine,
  selectedModel,
  onEngineChange,
  onModelChange,
  onLockedEngineClick,
  onLockedModelClick,
  showAdvanced: externalShowAdvanced,
  className = "",
}: VideoEngineSelectorProps) {
  const [showAdvancedToggle, setShowAdvancedToggle] = useState(false);
  
  const showAdvanced = externalShowAdvanced ?? showAdvancedToggle;
  
  useEffect(() => {
    if (config?.defaultEngine && !selectedEngine) {
      onEngineChange(config.defaultEngine);
    }
  }, [config?.defaultEngine, selectedEngine, onEngineChange]);
  
  useEffect(() => {
    if (config?.models?.length && !selectedModel) {
      onModelChange(config.models[0]?.id || '');
    }
  }, [config?.models, selectedModel, onModelChange]);
  
  if (!config?.configured) {
    return null;
  }
  
  const selectedEngineConfig = config.engines?.find(e => e.id === selectedEngine);
  const canShowAdvanced = config.canChooseProvider && config.models?.length > 1;
  
  const handleEngineSelect = (engineId: string) => {
    const engine = config.engines?.find(e => e.id === engineId);
    if (engine?.locked) {
      onLockedEngineClick?.(engine);
      return;
    }
    onEngineChange(engineId);
  };
  
  const handleModelSelect = (modelId: string) => {
    const model = config.allModels?.find(m => m.id === modelId);
    if (model?.locked) {
      onLockedModelClick?.(model);
      return;
    }
    onModelChange(modelId);
  };
  
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        <Label className="text-slate-300">Engine</Label>
        <Select value={selectedEngine} onValueChange={handleEngineSelect}>
          <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-video-engine">
            <SelectValue placeholder="Select engine" />
          </SelectTrigger>
          <SelectContent>
            {config.engines?.map((engine) => (
              <SelectItem 
                key={engine.id} 
                value={engine.id}
                className={engine.locked ? "opacity-60" : ""}
                data-testid={`engine-option-${engine.id}`}
              >
                <div className="flex items-center gap-2">
                  {engineIcons[engine.id] || <Zap className="w-3.5 h-3.5" />}
                  <span>{engine.name}</span>
                  {engine.locked && <Lock className="w-3 h-3 text-slate-500" />}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedEngine !== 'auto' && selectedEngineConfig?.poweredBy && (
          <p className="text-xs text-slate-500">
            Powered by {selectedEngineConfig.poweredBy}
          </p>
        )}
        {selectedEngine === 'auto' && (
          <p className="text-xs text-cyan-500/70">
            Best for your plan
          </p>
        )}
      </div>
      
      {canShowAdvanced && (
        <div className="flex items-center justify-between py-1">
          <Label className="text-slate-400 text-sm">Advanced options</Label>
          <Switch
            checked={showAdvanced}
            onCheckedChange={setShowAdvancedToggle}
            data-testid="toggle-advanced-video"
          />
        </div>
      )}
      
      {showAdvanced && canShowAdvanced && (
        <div className="space-y-2 pl-2 border-l-2 border-slate-700">
          <Label className="text-slate-400 text-sm">Provider Model</Label>
          <Select value={selectedModel} onValueChange={handleModelSelect}>
            <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-video-model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {config.allModels?.map((model) => (
                <SelectItem 
                  key={model.id} 
                  value={model.id}
                  className={model.locked ? "opacity-60" : ""}
                  data-testid={`model-option-${model.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    <span className="text-xs text-slate-500">${model.costPer5s?.toFixed(2)}/5s</span>
                    {model.locked && <Lock className="w-3 h-3 text-slate-500" />}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
