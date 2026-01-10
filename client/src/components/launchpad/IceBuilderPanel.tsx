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
import { 
  Sparkles, 
  FileText, 
  Check, 
  Loader2, 
  Target, 
  Lightbulb, 
  Award, 
  MousePointerClick,
  Brain,
  Megaphone,
  Compass,
  Zap,
  Link2,
  Bookmark,
  ArrowLeft,
  MessageSquare,
  PenLine
} from "lucide-react";
import type { Insight, ContentBrief } from "./InsightCard";

export type IceFormat = "hook_bullets" | "myth_reality" | "checklist" | "problem_solution_proof";
export type IceTone = "direct" | "warm" | "playful" | "premium";
export type IceOutputType = "video_card" | "interactive";
export type InsightIntent = "internal" | "external" | null;
export type InternalAction = "explore" | "challenge" | "connect" | "save";

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

const internalActions: { value: InternalAction; label: string; description: string; icon: typeof Brain }[] = [
  { value: "explore", label: "Explore deeper", description: "Ask follow-up questions, uncover hidden patterns", icon: Compass },
  { value: "challenge", label: "Challenge this", description: "Test assumptions, find counter-evidence", icon: Zap },
  { value: "connect", label: "Connect to strategy", description: "Link to goals, decisions, or other insights", icon: Link2 },
  { value: "save", label: "Save to knowledge", description: "Store for future reference and pattern matching", icon: Bookmark },
];

export function IceBuilderPanel({
  selectedInsight,
  draft,
  onGenerateDraft,
  isGenerating,
}: IceBuilderPanelProps) {
  const [intent, setIntent] = useState<InsightIntent>(null);
  const [format, setFormat] = useState<IceFormat>("hook_bullets");
  const [tone, setTone] = useState<IceTone>("direct");
  const [outputType, setOutputType] = useState<IceOutputType>("interactive");
  const [selectedInternalAction, setSelectedInternalAction] = useState<InternalAction | null>(null);
  
  // Reset intent when insight changes
  useEffect(() => {
    setIntent(null);
    setSelectedInternalAction(null);
  }, [selectedInsight?.id]);
  
  // Auto-select format based on content brief suggestion
  useEffect(() => {
    if (selectedInsight?.contentBrief?.formatSuggestion) {
      const suggestedFormat = formatSuggestionToIceFormat[selectedInsight.contentBrief.formatSuggestion];
      if (suggestedFormat) {
        setFormat(suggestedFormat);
      }
    }
  }, [selectedInsight?.id]);

  // Empty state - no insight selected
  if (!selectedInsight && !draft) {
    return (
      <div className="p-6 space-y-6" data-testid="ice-builder-panel">
        <div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            Work with insights
          </h3>
          <p className="text-sm text-muted-foreground">
            Select an insight to decide what to do with it
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/20 border border-dashed border-border">
          <p className="text-muted-foreground/50 text-sm text-center py-2">
            ← Choose an insight from the feed
          </p>
        </div>

        <div className="space-y-4 opacity-40 pointer-events-none">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <Brain className="w-5 h-5 text-muted-foreground/50 mb-2" />
              <div className="text-muted-foreground font-medium text-sm">Internal</div>
              <div className="text-muted-foreground/50 text-xs">Think & refine</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-muted/20">
              <Megaphone className="w-5 h-5 text-muted-foreground/50 mb-2" />
              <div className="text-muted-foreground font-medium text-sm">External</div>
              <div className="text-muted-foreground/50 text-xs">Share & publish</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Draft generated state
  if (draft) {
    return (
      <div className="p-6 space-y-4" data-testid="ice-builder-panel">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">Draft Ready</h3>
          <Badge variant="outline" className="border-green-500/50 text-green-500">
            <Check className="w-3 h-3 mr-1" />
            Generated
          </Badge>
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="font-medium text-foreground mb-2">{draft.headline}</h4>
          <div className="space-y-1">
            {draft.captions.slice(0, 3).map((caption, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                • {caption}
              </p>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 border-blue-500/50 text-blue-500 hover:bg-blue-500/10" variant="outline">
            Edit captions
          </Button>
          {draft.outputType === "video_card" ? (
            <Button variant="outline" className="flex-1">
              Download video
            </Button>
          ) : (
            <Button variant="outline" className="flex-1">
              Publish interactive
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground/60">
          Made from: {selectedInsight?.title || "Insight"}
        </div>
      </div>
    );
  }

  const insight = selectedInsight!;
  const isContentReady = insight.insightKind === "content_ready";
  const brief = insight.contentBrief;

  // Internal action selected - show that path
  if (intent === "internal" && selectedInternalAction) {
    return (
      <div className="p-6 space-y-6" data-testid="ice-builder-panel">
        <button 
          onClick={() => setSelectedInternalAction(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          data-testid="button-back-to-internal"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to options
        </button>

        <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            {selectedInternalAction === "explore" && <Compass className="w-5 h-5 text-emerald-500" />}
            {selectedInternalAction === "challenge" && <Zap className="w-5 h-5 text-amber-500" />}
            {selectedInternalAction === "connect" && <Link2 className="w-5 h-5 text-blue-500" />}
            {selectedInternalAction === "save" && <Bookmark className="w-5 h-5 text-purple-500" />}
            <span className="text-foreground font-medium">
              {internalActions.find(a => a.value === selectedInternalAction)?.label}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            Working with: <span className="text-foreground">{insight.title}</span>
          </p>

          {selectedInternalAction === "explore" && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">What would you like to explore?</p>
              <div className="space-y-2">
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-emerald-500/30 transition-colors text-sm">
                  <MessageSquare className="w-4 h-4 inline mr-2 text-emerald-500" />
                  Ask follow-up questions
                </button>
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-emerald-500/30 transition-colors text-sm">
                  <Compass className="w-4 h-4 inline mr-2 text-emerald-500" />
                  Find related patterns
                </button>
              </div>
            </div>
          )}

          {selectedInternalAction === "challenge" && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">How would you like to test this insight?</p>
              <div className="space-y-2">
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-amber-500/30 transition-colors text-sm">
                  <Zap className="w-4 h-4 inline mr-2 text-amber-500" />
                  Find counter-evidence
                </button>
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-amber-500/30 transition-colors text-sm">
                  <PenLine className="w-4 h-4 inline mr-2 text-amber-500" />
                  List assumptions to verify
                </button>
              </div>
            </div>
          )}

          {selectedInternalAction === "connect" && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">Connect this insight to:</p>
              <div className="space-y-2">
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-blue-500/30 transition-colors text-sm">
                  <Target className="w-4 h-4 inline mr-2 text-blue-500" />
                  Business goals
                </button>
                <button className="w-full p-3 rounded-lg border border-border bg-muted/50 text-left text-foreground/80 hover:border-blue-500/30 transition-colors text-sm">
                  <Link2 className="w-4 h-4 inline mr-2 text-blue-500" />
                  Related insights
                </button>
              </div>
            </div>
          )}

          {selectedInternalAction === "save" && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">This insight will be saved to your knowledge base for future reference and pattern matching.</p>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Bookmark className="w-4 h-4 mr-2" />
                Save to knowledge base
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground/60 text-center">
          Internal thinking tools help you refine ideas before sharing
        </p>
      </div>
    );
  }

  // Internal intent selected - show internal action options
  if (intent === "internal") {
    return (
      <div className="p-6 space-y-6" data-testid="ice-builder-panel">
        <div>
          <button 
            onClick={() => setIntent(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
            data-testid="button-back-to-intent"
          >
            <ArrowLeft className="w-4 h-4" />
            Change intent
          </button>
          <h3 className="text-lg font-medium text-foreground mb-1 flex items-center gap-2">
            <Brain className="w-5 h-5 text-emerald-500" />
            Internal thinking
          </h3>
          <p className="text-sm text-muted-foreground">
            Refine, question, and deepen your understanding
          </p>
        </div>

        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-foreground/80 text-sm font-medium">{insight.title}</p>
        </div>

        <div className="space-y-2">
          {internalActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.value}
                onClick={() => setSelectedInternalAction(action.value)}
                className="w-full p-4 rounded-xl border border-border bg-muted/20 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors group"
                data-testid={`internal-action-${action.value}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Icon className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-foreground font-medium text-sm">{action.label}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{action.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // External intent selected - show content creation controls
  if (intent === "external") {
    return (
      <div className="p-6 space-y-6" data-testid="ice-builder-panel">
        <div>
          <button 
            onClick={() => setIntent(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-4"
            data-testid="button-back-to-intent"
          >
            <ArrowLeft className="w-4 h-4" />
            Change intent
          </button>
          <h3 className="text-lg font-medium text-foreground mb-1 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-500" />
            {isContentReady ? "Create your story" : "Create content"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isContentReady 
              ? "AI has prepared a content brief for you" 
              : "Configure your output format and style"}
          </p>
        </div>

        <div className={`p-4 rounded-lg border border-border ${
          isContentReady 
            ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-l-2 border-l-purple-500" 
            : "bg-muted/30 border-l-2 border-l-blue-500"
        }`}>
          <p className="text-foreground font-medium">{insight.title}</p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {insight.meaning}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge
              variant="outline"
              className={isContentReady ? "border-purple-500/50 text-purple-500" : "border-border text-muted-foreground"}
            >
              {isContentReady ? "Content-ready" : `★ ${insight.confidence}`}
            </Badge>
            {insight.contentPotentialScore >= 70 && (
              <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400 text-xs">
                {insight.contentPotentialScore}% potential
              </Badge>
            )}
          </div>
        </div>

        {/* Content Brief section - shown for content-ready insights */}
        {brief && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Story Brief
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center gap-1 text-muted-foreground/60 mb-1">
                  <Target className="w-3 h-3" /> Audience
                </div>
                <p className="text-foreground/80">{brief.audience}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-muted-foreground/60 mb-1">
                  <MousePointerClick className="w-3 h-3" /> CTA
                </div>
                <p className="text-foreground/80">{brief.cta}</p>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground/60 text-xs mb-1">Their problem</div>
              <p className="text-sm text-muted-foreground">{brief.problem}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-muted-foreground/60 text-xs mb-1">
                <Award className="w-3 h-3" /> Your promise
              </div>
              <p className="text-sm text-foreground font-medium">{brief.promise}</p>
            </div>
            <div>
              <div className="text-muted-foreground/60 text-xs mb-1">Proof points</div>
              <p className="text-sm text-muted-foreground">{brief.proof}</p>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="text-muted-foreground/60 text-xs mb-1">Suggested format</div>
              <Badge variant="outline" className="border-blue-500/50 text-blue-500">
                {brief.formatSuggestion.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Format</label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormat(option.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    format === option.value
                      ? "border-blue-500 bg-blue-500/20 text-foreground"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-blue-500/30"
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
            <label className="text-sm text-muted-foreground mb-2 block">Tone</label>
            <Select value={tone} onValueChange={(v) => setTone(v as IceTone)}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {toneOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Output</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOutputType("video_card")}
                className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                  outputType === "video_card"
                    ? "border-blue-500 bg-blue-500/20 text-foreground"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-blue-500/30"
                }`}
                data-testid="output-video"
              >
                📹 Video card
              </button>
              <button
                onClick={() => setOutputType("interactive")}
                className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                  outputType === "interactive"
                    ? "border-blue-500 bg-blue-500/20 text-foreground"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-blue-500/30"
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

  // Intent Gate - the fork in the road
  return (
    <div className="p-6 space-y-6" data-testid="ice-builder-panel">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          What would you like to do with this insight?
        </h3>
        <p className="text-sm text-muted-foreground">
          Choose your path before deciding on format
        </p>
      </div>

      <div className={`p-4 rounded-lg border border-border ${
        isContentReady 
          ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-l-2 border-l-purple-500" 
          : "bg-muted/30 border-l-2 border-l-blue-500"
      }`}>
        <p className="text-foreground font-medium">{insight.title}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {insight.meaning}
        </p>
      </div>

      {/* Intent Gate - Two Card Selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setIntent("internal")}
          className="p-5 rounded-xl border border-border bg-muted/20 text-left hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors group"
          data-testid="intent-internal"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:from-emerald-500/30 group-hover:to-teal-500/20 transition-colors">
            <Brain className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-foreground font-medium mb-1">Internal</div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            Think, refine, and connect to strategy
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70">Explore</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70">Challenge</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500/70">Store</span>
          </div>
        </button>

        <button
          onClick={() => setIntent("external")}
          className="p-5 rounded-xl border border-border bg-muted/20 text-left hover:border-purple-500/30 hover:bg-purple-500/5 transition-colors group"
          data-testid="intent-external"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 flex items-center justify-center mb-3 group-hover:from-purple-500/30 group-hover:to-pink-500/20 transition-colors">
            <Megaphone className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-foreground font-medium mb-1">External</div>
          <div className="text-muted-foreground text-xs leading-relaxed">
            Publish, share, and convert audience
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500/70">Content</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500/70">Video</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500/70">Share</span>
          </div>
        </button>
      </div>

      <p className="text-xs text-muted-foreground/60 text-center">
        Internal insights stay private. External content is for your audience.
      </p>
    </div>
  );
}
