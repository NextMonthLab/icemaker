import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, FileText, Check, Loader2, Target, Lightbulb, Award, MousePointerClick } from "lucide-react";
import type { Insight, ContentBrief } from "./InsightCard";

export type IceFormat = "hook_bullets" | "myth_reality" | "checklist" | "problem_solution_proof";
export type IceTone = "direct" | "warm" | "playful" | "premium";
export type IceOutputType = "video_card" | "interactive";

export interface IceDraft {
  id: string | number;
  businessSlug?: string;
  orbitSlug?: string;
  insightId: string;
  format: IceFormat;
  tone: IceTone;
  outputType: IceOutputType;
  status: "draft" | "published";
  headline: string;
  captions: string[];
  ctaText?: string | null;
  previewFrameUrl?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

interface IceBuilderPanelProps {
  selectedInsight: Insight | null;
  draft: IceDraft | null;
  onGenerateDraft: (options: {
    insightId: string;
    format: IceFormat;
    tone: IceTone;
    outputType: IceOutputType;
  }) => void;
  isGenerating?: boolean;
}

const formatOptions: { value: IceFormat; label: string; icon: string }[] = [
  { value: "hook_bullets", label: "Hook + bullets", icon: "📋" },
  { value: "myth_reality", label: "Myth vs reality", icon: "⚖️" },
  { value: "checklist", label: "Checklist", icon: "✅" },
  { value: "problem_solution_proof", label: "Problem → Solution", icon: "💡" },
];

const toneOptions: { value: IceTone; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "warm", label: "Warm" },
  { value: "playful", label: "Playful" },
  { value: "premium", label: "Premium" },
];

const formatSuggestionToIceFormat: Record<string, IceFormat> = {
  "hook": "hook_bullets",
  "myth_bust": "myth_reality",
  "checklist": "checklist",
  "problem_solution": "problem_solution_proof",
  "testimonial": "problem_solution_proof",
  "story": "hook_bullets",
};

export function IceBuilderPanel({
  selectedInsight,
  draft,
  onGenerateDraft,
  isGenerating,
}: IceBuilderPanelProps) {
  const [format, setFormat] = useState<IceFormat>("hook_bullets");
  const [tone, setTone] = useState<IceTone>("direct");
  const [outputType, setOutputType] = useState<IceOutputType>("interactive");
  
  // Auto-select format based on content brief suggestion
  useEffect(() => {
    if (selectedInsight?.contentBrief?.formatSuggestion) {
      const suggestedFormat = formatSuggestionToIceFormat[selectedInsight.contentBrief.formatSuggestion];
      if (suggestedFormat) {
        setFormat(suggestedFormat);
      }
    }
  }, [selectedInsight?.id]);

  if (!selectedInsight && !draft) {
    return (
      <div className="p-6 space-y-6" data-testid="ice-builder-panel">
        <div>
          <h3 className="text-lg font-medium text-white mb-1">
            Turn insight into content
          </h3>
          <p className="text-sm text-white/50">
            Select an insight to unlock builder controls
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white/[0.02] border border-dashed border-white/10">
          <p className="text-white/30 text-sm text-center py-2">
            ← Choose an insight from the feed
          </p>
        </div>

        <div className="space-y-4 opacity-40 pointer-events-none">
          <div>
            <label className="text-sm text-white/40 mb-2 block">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.slice(0, 2).map((option) => (
                <div
                  key={option.value}
                  className="p-3 rounded-lg border border-white/10 bg-white/[0.02] text-white/40"
                >
                  <span className="mr-2 opacity-50">{option.icon}</span>
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-white/40 mb-2 block">Tone</label>
            <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02] text-white/40">
              Select tone...
            </div>
          </div>

          <div>
            <label className="text-sm text-white/40 mb-2 block">Output</label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 rounded-lg border border-white/10 bg-white/[0.02] text-white/40 text-center">
                📹 Video
              </div>
              <div className="flex-1 p-3 rounded-lg border border-white/10 bg-white/[0.02] text-white/40 text-center">
                ✨ Interactive
              </div>
            </div>
          </div>
        </div>

        <Button
          disabled
          className="w-full bg-white/10 text-white/40 cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 mr-2 opacity-50" />
          Generate draft
        </Button>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="p-6 space-y-4" data-testid="ice-builder-panel">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Draft Ready</h3>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Check className="w-3 h-3 mr-1" />
            Generated
          </Badge>
        </div>

        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <h4 className="font-medium text-white mb-2">{draft.headline}</h4>
          <div className="space-y-1">
            {draft.captions.slice(0, 3).map((caption, i) => (
              <p key={i} className="text-sm text-white/60">
                • {caption}
              </p>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10" variant="outline">
            Edit captions
          </Button>
          {draft.outputType === "video_card" ? (
            <Button variant="outline" className="flex-1 border-white/20 text-white">
              Download video
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 border-white/20 text-white">
              Publish interactive
            </Button>
          )}
        </div>

        <div className="text-xs text-white/40">
          Made from: {selectedInsight?.title || "Insight"}
        </div>
      </div>
    );
  }

  const insight = selectedInsight!;
  const isContentReady = insight.insightKind === "content_ready";
  const brief = insight.contentBrief;

  return (
    <div className="p-6 space-y-6" data-testid="ice-builder-panel">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">
          {isContentReady ? "Create your story" : "Turn this insight to content"}
        </h3>
        <p className="text-sm text-white/60">
          {isContentReady 
            ? "AI has prepared a content brief for you" 
            : "Configure your output format and style"}
        </p>
      </div>

      <div className={`p-4 rounded-lg border border-white/10 ${
        isContentReady 
          ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-l-2 border-l-purple-500" 
          : "bg-white/[0.03] border-l-2 border-l-blue-500"
      }`}>
        <p className="text-white font-medium">{insight.title}</p>
        <p className="text-sm text-white/60 mt-1 line-clamp-2">
          {insight.meaning}
        </p>
        <div className="flex gap-2 mt-2">
          <Badge
            variant="outline"
            className={isContentReady ? "border-purple-500/50 text-purple-400" : "border-white/20 text-white/60"}
          >
            {isContentReady ? "Content-ready" : `★ ${insight.confidence}`}
          </Badge>
          {insight.contentPotentialScore >= 70 && (
            <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300 text-xs">
              {insight.contentPotentialScore}% potential
            </Badge>
          )}
        </div>
      </div>

      {/* Content Brief section - shown for content-ready insights */}
      {brief && (
        <div className="space-y-3 p-4 rounded-lg bg-white/[0.02] border border-white/10">
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            Story Brief
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1">
                <Target className="w-3 h-3" /> Audience
              </div>
              <p className="text-white/80">{brief.audience}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1">
                <MousePointerClick className="w-3 h-3" /> CTA
              </div>
              <p className="text-white/80">{brief.cta}</p>
            </div>
          </div>
          <div>
            <div className="text-white/40 text-xs mb-1">Their problem</div>
            <p className="text-sm text-white/70">{brief.problem}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-white/40 text-xs mb-1">
              <Award className="w-3 h-3" /> Your promise
            </div>
            <p className="text-sm text-white font-medium">{brief.promise}</p>
          </div>
          <div>
            <div className="text-white/40 text-xs mb-1">Proof points</div>
            <p className="text-sm text-white/70">{brief.proof}</p>
          </div>
          <div className="pt-2 border-t border-white/10">
            <div className="text-white/40 text-xs mb-1">Suggested format</div>
            <Badge variant="outline" className="border-blue-500/50 text-blue-400">
              {brief.formatSuggestion.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm text-white/60 mb-2 block">Format</label>
          <div className="grid grid-cols-2 gap-2">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFormat(option.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  format === option.value
                    ? "border-blue-500 bg-blue-500/20 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-blue-500/30"
                }`}
                data-testid={`format-${option.value}`}
              >
                <span className="mr-2">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Tone</label>
          <Select value={tone} onValueChange={(v) => setTone(v as IceTone)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              {toneOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-white hover:bg-white/10"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Output</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOutputType("video_card")}
              className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                outputType === "video_card"
                  ? "border-blue-500 bg-blue-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-blue-500/30"
              }`}
              data-testid="output-video"
            >
              📹 Video card
            </button>
            <button
              onClick={() => setOutputType("interactive")}
              className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                outputType === "interactive"
                  ? "border-blue-500 bg-blue-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-blue-500/30"
              }`}
              data-testid="output-interactive"
            >
              ✨ Interactive
            </button>
          </div>
        </div>
      </div>

      <Button
        onClick={() =>
          onGenerateDraft({
            insightId: insight.id,
            format,
            tone,
            outputType,
          })
        }
        disabled={isGenerating}
        className={`w-full ${
          isContentReady 
            ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        }`}
        data-testid="button-generate-draft"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating story...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {isContentReady ? "Create story" : "Generate draft"}
          </>
        )}
      </Button>
    </div>
  );
}
