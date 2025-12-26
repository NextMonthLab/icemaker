import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import TransformationTimeline from "@/components/TransformationTimeline";
import { format } from "date-fns";

interface TransformationJobDetail {
  id: number;
  status: "queued" | "running" | "completed" | "failed";
  currentStage: number;
  stageStatuses: {
    stage0: "pending" | "running" | "done" | "failed";
    stage1: "pending" | "running" | "done" | "failed";
    stage2: "pending" | "running" | "done" | "failed";
    stage3: "pending" | "running" | "done" | "failed";
    stage4: "pending" | "running" | "done" | "failed";
    stage5: "pending" | "running" | "done" | "failed";
  };
  artifacts: Record<string, any>;
  outputUniverseId: number | null;
  errorMessageUser: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TransformationDetailPage() {
  const [, params] = useRoute("/admin/transformations/:id");
  const id = params?.id ? parseInt(params.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: job, isLoading, error } = useQuery<TransformationJobDetail>({
    queryKey: ["transformation", id],
    queryFn: async () => {
      const res = await fetch(`/api/transformations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transformation");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "running" || data?.status === "queued") {
        return 2000;
      }
      return false;
    },
  });
  
  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/transformations/${id}/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to retry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Retry started", description: "The transformation is running again." });
      queryClient.invalidateQueries({ queryKey: ["transformation", id] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
  
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  if (error || !job) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-500">Failed to load transformation job</p>
              <Link href="/admin/transformations">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Transformations
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/transformations">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">
                Transformation #{job.id}
              </h1>
              <p className="text-muted-foreground">
                Started {format(new Date(job.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {job.status === "failed" && (
              <Button
                variant="outline"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                data-testid="button-retry"
              >
                {retryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Retry
              </Button>
            )}
            {job.outputUniverseId && (
              <Link href={`/admin/universes/${job.outputUniverseId}`}>
                <Button data-testid="button-view-universe">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Universe
                </Button>
              </Link>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TransformationTimeline
              stageStatuses={job.stageStatuses}
              artifacts={job.artifacts}
              currentStage={job.currentStage}
              status={job.status}
              errorMessage={job.errorMessageUser}
              onRetry={job.status === "failed" ? () => retryMutation.mutate() : undefined}
            />
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{job.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Stage</span>
                  <span className="font-medium">{job.currentStage + 1} / 6</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{format(new Date(job.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{format(new Date(job.updatedAt), "MMM d, h:mm a")}</span>
                </div>
                {job.outputUniverseId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Universe ID</span>
                    <span className="font-medium">{job.outputUniverseId}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {job.status === "completed" && job.outputUniverseId && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-lg text-green-700 dark:text-green-300">
                    Ready to Explore
                  </CardTitle>
                  <CardDescription>
                    Your universe has been created with all content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href={`/admin/universes/${job.outputUniverseId}`}>
                    <Button className="w-full" data-testid="button-manage-universe">
                      Manage Universe
                    </Button>
                  </Link>
                  <Link href={`/?universe=${job.outputUniverseId}`}>
                    <Button variant="outline" className="w-full" data-testid="button-view-story">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Story
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
