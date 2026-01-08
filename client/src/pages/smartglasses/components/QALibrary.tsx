import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ThumbsUp, ThumbsDown, Share2, RefreshCw, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { TrendingQuestion, StoredAnswer } from "@/lib/types/smartglasses";

export function QALibrary() {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: questionsData, isLoading: loadingQuestions, isError: questionsError, refetch: refetchQuestions } = useQuery({
    queryKey: ["smartglasses-questions"],
    queryFn: async () => {
      const res = await fetch("/api/smartglasses/questions");
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json() as Promise<{ questions: TrendingQuestion[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: answersData, isLoading: loadingAnswers, isError: answersError } = useQuery({
    queryKey: ["smartglasses-answers", expandedQuestion],
    queryFn: async () => {
      if (!expandedQuestion) return { answers: [] };
      const res = await fetch(`/api/smartglasses/answers?questionId=${expandedQuestion}`);
      if (!res.ok) throw new Error("Failed to fetch answers");
      return res.json() as Promise<{ answers: StoredAnswer[] }>;
    },
    enabled: !!expandedQuestion,
    staleTime: 5 * 60 * 1000,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ answerId, vote }: { answerId: string; vote: "up" | "down" }) => {
      const res = await fetch(`/api/smartglasses/answers/${answerId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      if (!res.ok) throw new Error("Failed to vote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smartglasses-answers", expandedQuestion] });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShare = (questionId: string, answerId: string) => {
    const url = `${window.location.origin}/smartglasses?qa=${questionId}&answer=${answerId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Share this link to point others to this answer.",
    });
  };

  const questions = questionsData?.questions || [];
  const answers = answersData?.answers || [];

  return (
    <section className="py-16 px-4 bg-zinc-950">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Popular questions</h2>
            <p className="text-zinc-400">Explore what others are asking about smart glasses</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchQuestions()}
            className="border-zinc-700"
            data-testid="button-refresh-questions"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <p className="text-sm text-zinc-500 mb-6">Help improve this Orbit by voting on answers.</p>

        {loadingQuestions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : questionsError ? (
          <div className="text-center py-12">
            <p className="text-zinc-400 mb-4">Unable to load questions. Please try again.</p>
            <Button variant="outline" onClick={() => refetchQuestions()} className="border-zinc-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-xl bg-zinc-900/50 border border-zinc-800 overflow-hidden"
                data-testid={`question-${q.id}`}
              >
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-pink-400 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">{q.question}</p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Popularity: {q.heat}% - Updated: {new Date(q.updatedAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-zinc-400 transition-transform",
                      expandedQuestion === q.id && "rotate-180"
                    )}
                  />
                </button>

                {expandedQuestion === q.id && (
                  <div className="border-t border-zinc-800 p-5 space-y-4">
                    {loadingAnswers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                      </div>
                    ) : answersError ? (
                      <p className="text-zinc-500 text-center py-4">Unable to load answers. Please try again.</p>
                    ) : answers.length === 0 ? (
                      <p className="text-zinc-500 text-center py-4">No answers yet for this question.</p>
                    ) : (
                      answers.map((answer) => (
                        <div
                          key={answer.id}
                          id={`answer-${answer.id}`}
                          className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 transition-all"
                          data-testid={`answer-${answer.id}`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                              {answer.sourceType === "editorial" ? "Editorial" : "Community"}
                            </Badge>
                            <span className="text-xs text-zinc-500">
                              Updated: {new Date(answer.updatedAt).toLocaleDateString("en-GB")}
                            </span>
                          </div>

                          <p className="text-zinc-300 mb-4">{answer.answer}</p>

                          {answer.productRefs && answer.productRefs.length > 0 && (
                            <div className="mb-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700">
                              <p className="text-xs text-zinc-500 mb-2">Referenced products:</p>
                              <div className="flex flex-wrap gap-2">
                                {answer.productRefs.map((ref) => (
                                  <div key={ref.id} className="flex items-center gap-2">
                                    <span className="text-sm text-zinc-300">{ref.name}</span>
                                    {ref.sponsored && (
                                      <Badge className="bg-amber-500/20 text-amber-400 text-xs">Sponsored</Badge>
                                    )}
                                    {ref.detailsUrl && (
                                      <a
                                        href={ref.detailsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-pink-400 hover:text-pink-300"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => voteMutation.mutate({ answerId: answer.id, vote: "up" })}
                              className="text-zinc-400 hover:text-emerald-400"
                              data-testid={`button-upvote-${answer.id}`}
                            >
                              <ThumbsUp className="w-4 h-4 mr-1" />
                              {answer.upvotes}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => voteMutation.mutate({ answerId: answer.id, vote: "down" })}
                              className="text-zinc-400 hover:text-red-400"
                              data-testid={`button-downvote-${answer.id}`}
                            >
                              <ThumbsDown className="w-4 h-4 mr-1" />
                              {answer.downvotes}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleShare(q.id, answer.id)}
                              className="text-zinc-400 hover:text-pink-400"
                              data-testid={`button-share-${answer.id}`}
                            >
                              <Share2 className="w-4 h-4 mr-1" />
                              Share
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-zinc-700 text-zinc-400"
                      data-testid="button-ask-followup"
                    >
                      Ask a follow-up (5 free per day)
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
