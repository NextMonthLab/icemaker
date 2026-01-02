import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, FileText, Check, Loader2 } from "lucide-react";
import type { Insight } from "./InsightCard";

export type IceFormat = "hook_bullets" | "myth_reality" | "checklist" | "problem_solution_proof";
export type IceTone = "direct" | "warm" | "playful" | "premium";
export type IceOutputType = "video_card" | "interactive";

export interface IceDraft {
  id: string;
  orbitSlug: string;
  insightId: string;
  format: IceFormat;
  tone: IceTone;
  outputType: IceOutputType;
  status: "draft" | "published";
  headline: string;
  captions: string[];
  ctaText?: string;
  previewFrameUrl?: string;
  createdAt: string;
  publishedAt?: string;
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

export function IceBuilderPanel({
  selectedInsight,
  draft,
  onGenerateDraft,
  isGenerating,
}: IceBuilderPanelProps) {
  const [format, setFormat] = useState<IceFormat>("hook_bullets");
  const [tone, setTone] = useState<IceTone>("direct");
  const [outputType, setOutputType] = useState<IceOutputType>("interactive");

  if (!selectedInsight && !draft) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center p-8 text-center"
        data-testid="builder-empty-state"
      >
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">IceMaker</h3>
        <p className="text-white/60 text-sm max-w-xs">
          Select an insight to turn it into content. Click "Make Ice" on any
          insight to get started.
        </p>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="p-6 space-y-4" data-testid="builder-draft-state">
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
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
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

  return (
    <div className="p-6 space-y-6" data-testid="builder-selected-state">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">
          Turn this insight to content
        </h3>
        <p className="text-sm text-white/60">
          Configure your output format and style
        </p>
      </div>

      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
        <p className="text-white font-medium">{insight.title}</p>
        <p className="text-sm text-white/60 mt-1 line-clamp-2">
          {insight.meaning}
        </p>
        <Badge
          variant="outline"
          className="mt-2 border-purple-500/30 text-purple-400"
        >
          ★ {insight.confidence}
        </Badge>
      </div>

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
                    ? "border-purple-500 bg-purple-500/20 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
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
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
              }`}
              data-testid="output-video"
            >
              📹 Video card
            </button>
            <button
              onClick={() => setOutputType("interactive")}
              className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                outputType === "interactive"
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
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
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        data-testid="button-generate-draft"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate draft
          </>
        )}
      </Button>
    </div>
  );
}
