import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  FileText, 
  Upload, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle, 
  Check, 
  Clock, 
  Loader2,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";

interface TransformationJob {
  id: number;
  status: "queued" | "running" | "completed" | "failed";
  currentStage: number;
  sourceFileName: string;
  outputUniverseId: number | null;
  createdAt: string;
}

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

function StatusBadge({ status }: { status: TransformationJob["status"] }) {
  const styles = {
    queued: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  
  const icons = {
    queued: <Clock className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <Check className="w-3 h-3" />,
    failed: <AlertCircle className="w-3 h-3" />,
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CreateTransformationForm({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [hookPackCount, setHookPackCount] = useState("3");
  const [releaseMode, setReleaseMode] = useState("hybrid");
  const { toast } = useToast();
  
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/transformations", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create transformation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transformation started", description: "Your story is being processed." });
      setFile(null);
      setText("");
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    
    if (file) {
      formData.append("file", file);
    } else if (text.trim()) {
      formData.append("text", text);
    } else {
      toast({ title: "Error", description: "Please upload a file or enter text", variant: "destructive" });
      return;
    }
    
    formData.append("hookPackCount", hookPackCount);
    formData.append("releaseMode", releaseMode);
    
    createMutation.mutate(formData);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Create New Transformation
        </CardTitle>
        <CardDescription>
          Upload a script, PDF, or paste text to transform into a StoryFlix universe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload File</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.pdf,.md,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                data-testid="input-file"
              />
              <p className="text-xs text-muted-foreground">
                Supported: .txt, .pdf, .md, .json
              </p>
            </div>
            
            <div className="flex items-end">
              <a 
                href="/templates/season-pack-template.json" 
                download
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                data-testid="download-template"
              >
                <Download className="w-4 h-4" />
                Download Season Pack Template
              </a>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="text">Or paste text directly</Label>
            <Textarea
              id="text"
              placeholder="Paste your story content here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              disabled={!!file}
              data-testid="input-text"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hookPackCount">Hook Pack Count</Label>
              <Select value={hookPackCount} onValueChange={setHookPackCount}>
                <SelectTrigger data-testid="select-hook-pack">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 card</SelectItem>
                  <SelectItem value="2">2 cards</SelectItem>
                  <SelectItem value="3">3 cards (recommended)</SelectItem>
                  <SelectItem value="5">5 cards</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cards available immediately when viewers arrive
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="releaseMode">Release Mode</Label>
              <Select value={releaseMode} onValueChange={setReleaseMode}>
                <SelectTrigger data-testid="select-release-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binge">Binge (all at once)</SelectItem>
                  <SelectItem value="daily">Daily (one per day)</SelectItem>
                  <SelectItem value="hybrid">Hybrid (hook pack + daily)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How cards are released to viewers
              </p>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={createMutation.isPending || (!file && !text.trim())}
            className="w-full"
            data-testid="button-start-transformation"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Start Transformation
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function JobsList({ jobs, isLoading }: { jobs: TransformationJob[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No transformations yet</p>
        <p className="text-sm">Upload content above to create your first story</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const progress = Math.round(((job.currentStage + (job.status === "completed" ? 1 : 0)) / 6) * 100);
        
        return (
          <Card key={job.id} className="hover:bg-muted/50 transition-colors" data-testid={`job-row-${job.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{job.sourceFileName}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{format(new Date(job.createdAt), "MMM d, h:mm a")}</span>
                      {job.status === "running" && (
                        <span>Stage {job.currentStage + 1}/6</span>
                      )}
                    </div>
                    {(job.status === "running" || job.status === "queued") && (
                      <Progress value={progress} className="h-1.5 mt-2 w-48" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Link href={`/admin/transformations/${job.id}`}>
                    <Button variant="outline" size="sm" data-testid={`button-view-${job.id}`}>
                      View Details
                    </Button>
                  </Link>
                  {job.outputUniverseId && (
                    <Link href={`/admin/universes/${job.outputUniverseId}`}>
                      <Button variant="secondary" size="sm" data-testid={`button-universe-${job.id}`}>
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Universe
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function TransformationsPage() {
  const queryClient = useQueryClient();
  
  const { data: jobs, isLoading, refetch } = useQuery<TransformationJob[]>({
    queryKey: ["transformations"],
    queryFn: async () => {
      const res = await fetch("/api/transformations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transformations");
      return res.json();
    },
    refetchInterval: 3000,
  });
  
  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Story Transformations</h1>
            <p className="text-muted-foreground">
              Transform scripts, PDFs, and text into interactive StoryFlix universes
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        <CreateTransformationForm onSuccess={() => refetch()} />
        
        <Card>
          <CardHeader>
            <CardTitle>Your Transformations</CardTitle>
            <CardDescription>
              Track the progress of your story transformations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobsList jobs={jobs || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
