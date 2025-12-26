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
  Download,
  Globe
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

function AiThinkingAnimation() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransformationJob["status"] }) {
  const styles = {
    queued: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    running: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-700",
    completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  
  const icons = {
    queued: <Clock className="w-3 h-3" />,
    running: <AiThinkingAnimation />,
    completed: <Check className="w-3 h-3" />,
    failed: <AlertCircle className="w-3 h-3" />,
  };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CreateTransformationForm({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [contentSourceType, setContentSourceType] = useState("");
  const [contentIndustry, setContentIndustry] = useState("");
  const [contentCategory, setContentCategory] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [hookPackCount, setHookPackCount] = useState("3");
  const [releaseMode, setReleaseMode] = useState("hybrid");
  const [storyLength, setStoryLength] = useState("medium");
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
      setSourceUrl("");
      setContentSourceType("");
      setContentIndustry("");
      setContentCategory("");
      setContentGoal("");
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    
    if (sourceUrl.trim()) {
      formData.append("sourceUrl", sourceUrl.trim());
      if (contentSourceType) formData.append("contentSourceType", contentSourceType);
      if (contentIndustry) formData.append("contentIndustry", contentIndustry);
      if (contentCategory) formData.append("contentCategory", contentCategory);
      if (contentGoal) formData.append("contentGoal", contentGoal);
    } else if (file) {
      formData.append("file", file);
    } else if (text.trim()) {
      formData.append("text", text);
    } else {
      toast({ title: "Error", description: "Please enter a URL, upload a file, or enter text", variant: "destructive" });
      return;
    }
    
    formData.append("hookPackCount", hookPackCount);
    formData.append("releaseMode", releaseMode);
    formData.append("storyLength", storyLength);
    
    createMutation.mutate(formData);
  };
  
  return (
    <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-7 h-7 text-white" />
        </div>
        <CardTitle className="text-xl">Create Your Story</CardTitle>
        <CardDescription className="max-w-md mx-auto">
          Upload a script, PDF, or paste your story text. Our AI will analyze it and create 
          an interactive universe with characters, scenes, and daily story drops.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceUrl">Import from URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://example.com/article..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={!!file || !!text.trim()}
              data-testid="input-source-url"
            />
            <p className="text-xs text-muted-foreground">
              Enter a website, blog post, or article URL to transform into a story
            </p>
          </div>
          
          {sourceUrl.trim() && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="contentSourceType" className="text-xs">Source Type</Label>
                <Select value={contentSourceType} onValueChange={setContentSourceType}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-content-source-type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="blog_post">Blog Post</SelectItem>
                    <SelectItem value="news_article">News Article</SelectItem>
                    <SelectItem value="documentation">Documentation</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="press_release">Press Release</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="contentIndustry" className="text-xs">Industry</Label>
                <Select value={contentIndustry} onValueChange={setContentIndustry}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-content-industry">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="food">Food & Beverage</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="contentCategory" className="text-xs">Category</Label>
                <Select value={contentCategory} onValueChange={setContentCategory}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-content-category">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="narrative">Narrative</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="documentary">Documentary</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="contentGoal" className="text-xs">Goal</Label>
                <Select value={contentGoal} onValueChange={setContentGoal}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-content-goal">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                    <SelectItem value="lead_generation">Lead Generation</SelectItem>
                    <SelectItem value="audience_engagement">Audience Engagement</SelectItem>
                    <SelectItem value="product_launch">Product Launch</SelectItem>
                    <SelectItem value="thought_leadership">Thought Leadership</SelectItem>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-muted-foreground/20"></div>
            <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">or</span>
            <div className="flex-grow border-t border-muted-foreground/20"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="file">Upload File</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.pdf,.md,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={!!sourceUrl.trim()}
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
              disabled={!!file || !!sourceUrl.trim()}
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
          
          <div className="space-y-2">
            <Label htmlFor="storyLength">Story Length</Label>
            <Select value={storyLength} onValueChange={setStoryLength}>
              <SelectTrigger data-testid="select-story-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (~8 cards, ~1 week)</SelectItem>
                <SelectItem value="medium">Medium (~16 cards, ~2 weeks)</SelectItem>
                <SelectItem value="long">Long (~24 cards, ~3-4 weeks)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how many story cards are generated from your content
            </p>
          </div>
          
          <Button
            type="submit"
            disabled={createMutation.isPending || (!file && !text.trim() && !sourceUrl.trim())}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white h-12"
            data-testid="button-start-transformation"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Your Story...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Create Story
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
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">{job.sourceFileName}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span>{format(new Date(job.createdAt), "MMM d, h:mm a")}</span>
                      {job.status === "running" && (
                        <span className="font-medium text-purple-600 dark:text-purple-400">Stage {job.currentStage + 1}/6</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {(job.status === "running" || job.status === "queued") && (
                  <Progress value={progress} className="h-1.5 w-full" />
                )}
                
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/admin/transformations/${job.id}`} className="flex-1 sm:flex-initial">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm" data-testid={`button-view-${job.id}`}>
                      View Details
                    </Button>
                  </Link>
                  {job.outputUniverseId && (
                    <Link href={`/admin/universes/${job.outputUniverseId}`} className="flex-1 sm:flex-initial">
                      <Button variant="secondary" size="sm" className="w-full sm:w-auto text-xs sm:text-sm" data-testid={`button-universe-${job.id}`}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
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
  
  const hasJobs = jobs && jobs.length > 0;
  
  return (
    <AdminLayout>
      <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Header - Simplified */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">Create Story</h1>
          {hasJobs && (
            <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="button-refresh" aria-label="Refresh transformations">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* Main Create Form */}
        <CreateTransformationForm onSuccess={() => refetch()} />
        
        {/* Previous Transformations - Only show if there are jobs */}
        {hasJobs && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Previous Transformations</CardTitle>
            </CardHeader>
            <CardContent>
              <JobsList jobs={jobs} isLoading={isLoading} />
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
