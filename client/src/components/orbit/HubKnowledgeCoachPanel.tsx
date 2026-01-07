import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  GraduationCap, 
  Lightbulb, 
  CheckCircle, 
  X, 
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  FileQuestion,
  RefreshCw,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface KnowledgePrompt {
  id: number;
  question: string;
  rationale: string;
  impactScore: number;
  gapSource: string;
  suggestedDestination: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

interface HubKnowledgeCoachPanelProps {
  businessSlug: string;
  planTier: 'free' | 'grow' | 'insight' | 'intelligence';
}

export function HubKnowledgeCoachPanel({ businessSlug, planTier }: HubKnowledgeCoachPanelProps) {
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [filedDestination, setFiledDestination] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isPaidTier = ['grow', 'insight', 'intelligence'].includes(planTier);

  const { data, isLoading, refetch } = useQuery<{ prompts: KnowledgePrompt[]; pendingCount: number }>({
    queryKey: [`/api/orbit/${businessSlug}/knowledge-coach/prompts`],
    enabled: isPaidTier,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/orbit/${businessSlug}/knowledge-coach/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/orbit/${businessSlug}/knowledge-coach/prompts`] });
      toast({
        title: "Questions Generated",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ promptId, answerText, filedDestination }: { 
      promptId: number; 
      answerText: string; 
      filedDestination: string;
    }) => {
      const response = await apiRequest("POST", `/api/orbit/${businessSlug}/knowledge-coach/prompts/${promptId}/answer`, {
        answerText,
        filedDestination,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/orbit/${businessSlug}/knowledge-coach/prompts`] });
      setExpandedPromptId(null);
      setAnswerText("");
      setFiledDestination("");
      toast({
        title: "Answer Saved",
        description: `Your content has been filed. New strength score: ${data.newStrengthScore}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your answer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (promptId: number) => {
      const response = await apiRequest("POST", `/api/orbit/${businessSlug}/knowledge-coach/prompts/${promptId}/dismiss`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orbit/${businessSlug}/knowledge-coach/prompts`] });
      toast({
        title: "Dismissed",
        description: "Question dismissed. We'll ask something different next time.",
      });
    },
  });

  const prompts = (data?.prompts || []).filter((p: KnowledgePrompt) => p.status === 'pending') as KnowledgePrompt[];
  const answeredPrompts = (data?.prompts || []).filter((p: KnowledgePrompt) => p.status === 'answered') as KnowledgePrompt[];

  const getImpactColor = (score: number) => {
    if (score >= 8) return "text-emerald-400 bg-emerald-400/10";
    if (score >= 5) return "text-amber-400 bg-amber-400/10";
    return "text-zinc-400 bg-zinc-400/10";
  };

  const getDestinationLabel = (dest: string) => {
    switch (dest) {
      case 'faq': return 'Add as FAQ';
      case 'box_enrichment': return 'Enrich existing content';
      case 'new_box': return 'Create new content';
      case 'business_profile': return 'Add to business profile';
      case 'document': return 'Upload as document';
      default: return dest;
    }
  };

  if (!isPaidTier) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center" data-testid="knowledge-coach-upgrade">
        <GraduationCap className="h-16 w-16 text-zinc-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Knowledge Coach</h2>
        <p className="text-zinc-400 max-w-md mb-6">
          Get AI-powered weekly questions to help you fill knowledge gaps and improve your Orbit's AI capabilities.
        </p>
        <Badge variant="outline" className="text-purple-400 border-purple-400/30">
          Available on Grow and Intelligence plans
        </Badge>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="knowledge-coach-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-400" />
            Knowledge Coach
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Answer questions to improve your Orbit's knowledge base
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="btn-generate-questions"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", generateMutation.isPending && "animate-spin")} />
          Generate Questions
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
        </div>
      ) : prompts.length === 0 ? (
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-emerald-400 mb-4" />
            <p className="text-white font-medium mb-2">All caught up!</p>
            <p className="text-zinc-400 text-sm text-center max-w-sm">
              No pending questions. Click "Generate Questions" to get fresh AI-powered suggestions based on your Orbit's current gaps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <Card 
              key={prompt.id} 
              className={cn(
                "bg-zinc-800/50 border-zinc-700 transition-all",
                expandedPromptId === prompt.id && "ring-1 ring-purple-500/50"
              )}
              data-testid={`prompt-card-${prompt.id}`}
            >
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn("text-xs", getImpactColor(prompt.impactScore))}>
                        <Zap className="h-3 w-3 mr-1" />
                        Impact: {prompt.impactScore}/10
                      </Badge>
                      <Badge variant="outline" className="text-xs text-zinc-400">
                        <Target className="h-3 w-3 mr-1" />
                        {getDestinationLabel(prompt.suggestedDestination)}
                      </Badge>
                    </div>
                    <CardTitle className="text-base text-white">{prompt.question}</CardTitle>
                    <CardDescription className="mt-2">
                      <Lightbulb className="h-3 w-3 inline mr-1 text-amber-400" />
                      {prompt.rationale}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissMutation.mutate(prompt.id);
                      }}
                      data-testid={`btn-dismiss-${prompt.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {expandedPromptId === prompt.id ? (
                      <ChevronUp className="h-5 w-5 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-zinc-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {expandedPromptId === prompt.id && (
                <CardContent className="pt-0 space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Your Answer</label>
                    <Textarea
                      placeholder="Type your answer here..."
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 min-h-[100px]"
                      data-testid={`input-answer-${prompt.id}`}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">File this answer as</label>
                    <Select 
                      value={filedDestination || prompt.suggestedDestination} 
                      onValueChange={setFiledDestination}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-700" data-testid={`select-destination-${prompt.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="faq">Add as FAQ</SelectItem>
                        <SelectItem value="business_profile">Add to Business Profile</SelectItem>
                        <SelectItem value="new_box">Create New Content Box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setExpandedPromptId(null);
                        setAnswerText("");
                        setFiledDestination("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => answerMutation.mutate({
                        promptId: prompt.id,
                        answerText,
                        filedDestination: filedDestination || prompt.suggestedDestination,
                      })}
                      disabled={answerText.length < 10 || answerMutation.isPending}
                      data-testid={`btn-submit-answer-${prompt.id}`}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {answerMutation.isPending ? "Saving..." : "Submit Answer"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {answeredPrompts.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Recently Answered ({answeredPrompts.length})
          </h3>
          <div className="space-y-2">
            {answeredPrompts.slice(0, 5).map((prompt) => (
              <div 
                key={prompt.id}
                className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50"
                data-testid={`answered-prompt-${prompt.id}`}
              >
                <p className="text-sm text-zinc-300 line-clamp-1">{prompt.question}</p>
                <p className="text-xs text-emerald-400 mt-1">Answered and filed</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
