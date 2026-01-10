import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Download, Upload, Sparkles, Copy, FileText, CheckCircle2, 
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Box, Users, MessageSquare, Lightbulb, Radio, Image, HelpCircle
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IndustryOrbit {
  id: number;
  slug: string;
  title: string;
}

interface CpacStats {
  entities: number;
  products: number;
  reviews: number;
  communities: number;
  tiles: number;
  pulseSources: number;
  coreConcepts: number;
  assets: number;
  entityTypes: Record<string, number>;
  productCategories: Record<string, number>;
  productStatuses: Record<string, number>;
}

interface DiffSummary {
  newEntities: { id: string; name: string; entityType: string }[];
  newProducts: { id: string; name: string; category: string; status: string }[];
  newCommunities: { id: string; name: string; communityType: string }[];
  newTiles: { id: string; label: string }[];
  newPulseSources: { id: string; name: string; sourceType: string }[];
  potentialDuplicates: { type: string; newName: string; existingName: string; similarity: number }[];
  warnings: string[];
}

export default function AdminCpac() {
  const { user } = useAuth();
  const [selectedOrbit, setSelectedOrbit] = useState<string>("");
  const [claudePrompt, setClaudePrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [uploadedCpac, setUploadedCpac] = useState<string>("");
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [diffResult, setDiffResult] = useState<{ diff: DiffSummary; summary: any } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data: orbitsData, isLoading: orbitsLoading } = useQuery({
    queryKey: ["/api/industry-orbits"],
    queryFn: async () => {
      const res = await fetch("/api/industry-orbits");
      if (!res.ok) throw new Error("Failed to fetch industry orbits");
      return res.json();
    },
  });

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/industry-orbits", selectedOrbit, "stats"],
    queryFn: async () => {
      if (!selectedOrbit) return null;
      const res = await fetch(`/api/industry-orbits/${selectedOrbit}/cpac/stats`);
      if (!res.ok) throw new Error("Failed to fetch CPAC stats");
      return res.json();
    },
    enabled: !!selectedOrbit,
  });

  const generatePromptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/industry-orbits/${selectedOrbit}/cpac/claude-prompt`);
      if (!res.ok) throw new Error("Failed to generate prompt");
      return res.text();
    },
    onSuccess: (prompt) => {
      setClaudePrompt(prompt);
      setShowPrompt(true);
      toast({ title: "Claude prompt generated", description: "Ready to copy or download" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate prompt", variant: "destructive" });
    },
  });

  const analyzeDiffMutation = useMutation({
    mutationFn: async (cpacJson: string) => {
      let parsed;
      try {
        parsed = JSON.parse(cpacJson);
      } catch {
        throw new Error("Invalid JSON format. Please check the file contents.");
      }
      
      if (!parsed.formatVersion) {
        throw new Error("Invalid CPAC format: missing formatVersion field");
      }
      
      const res = await fetch(`/api/industry-orbits/${selectedOrbit}/cpac/diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to analyze diff");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setDiffResult(result);
      setShowDiffDialog(true);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error analyzing CPAC", 
        description: error.message || "Invalid JSON or CPAC format", 
        variant: "destructive" 
      });
    },
  });

  const handleDownloadCpac = () => {
    if (!selectedOrbit) return;
    window.open(`/api/industry-orbits/${selectedOrbit}/cpac`, "_blank");
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([claudePrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedOrbit}-claude-prompt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(claudePrompt);
    toast({ title: "Copied!", description: "Prompt copied to clipboard" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedCpac(content);
    };
    reader.readAsText(file);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-zinc-500">Admin access required</p>
        </div>
      </Layout>
    );
  }

  const stats: CpacStats | null = statsData?.stats;
  const orbits: IndustryOrbit[] = orbitsData?.orbits || [];

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Box className="w-6 h-6 text-zinc-400" />
                Orbit CPAC
              </h1>
              <p className="text-zinc-500 mt-1">
                Export, extend, and import knowledge packs for Industry Orbits
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <HelpCircle className="w-5 h-5 text-zinc-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Orbit CPAC = Orbit knowledge pack export. Use this to extend Industry Orbit data via Claude.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Select Industry Orbit</CardTitle>
              <CardDescription>Choose an orbit to manage its CPAC</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedOrbit} onValueChange={setSelectedOrbit}>
                <SelectTrigger className="w-full max-w-md bg-zinc-800 border-zinc-700" data-testid="select-orbit">
                  <SelectValue placeholder="Select an Industry Orbit..." />
                </SelectTrigger>
                <SelectContent>
                  {orbitsLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : orbits.length === 0 ? (
                    <SelectItem value="none" disabled>No Industry Orbits found</SelectItem>
                  ) : (
                    orbits.map((orbit) => (
                      <SelectItem key={orbit.slug} value={orbit.slug}>
                        {orbit.title || orbit.slug}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedOrbit && (
            <>
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-white">Current CPAC Contents</CardTitle>
                    <CardDescription>
                      {statsData?.orbit?.title || selectedOrbit}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => refetchStats()}
                    disabled={statsLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading stats...
                    </div>
                  ) : stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatBox icon={<Users className="w-4 h-4" />} label="Entities" value={stats.entities} />
                      <StatBox icon={<Box className="w-4 h-4" />} label="Products" value={stats.products} />
                      <StatBox icon={<MessageSquare className="w-4 h-4" />} label="Reviews" value={stats.reviews} />
                      <StatBox icon={<Users className="w-4 h-4" />} label="Communities" value={stats.communities} />
                      <StatBox icon={<Lightbulb className="w-4 h-4" />} label="Tiles" value={stats.tiles} />
                      <StatBox icon={<Radio className="w-4 h-4" />} label="Pulse Sources" value={stats.pulseSources} />
                      <StatBox icon={<Sparkles className="w-4 h-4" />} label="Core Concepts" value={stats.coreConcepts} />
                      <StatBox icon={<Image className="w-4 h-4" />} label="Assets" value={stats.assets} />
                    </div>
                  ) : (
                    <p className="text-zinc-500">Select an orbit to view stats</p>
                  )}

                  {stats && Object.keys(stats.entityTypes).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-400 mb-2">Entity breakdown:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.entityTypes).map(([type, count]) => (
                          <Badge key={type} variant="secondary" className="bg-zinc-800 text-zinc-300">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats && Object.keys(stats.productCategories).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-400 mb-2">Product categories:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.productCategories).map(([cat, count]) => (
                          <Badge key={cat} variant="secondary" className="bg-zinc-800 text-zinc-300">
                            {cat}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Download className="w-5 h-5 text-blue-400" />
                      Download Orbit CPAC
                    </CardTitle>
                    <CardDescription>
                      Export the current orbit data as a pre-populated JSON file
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      onClick={handleDownloadCpac}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-download-cpac"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Orbit CPAC
                    </Button>
                    <p className="text-xs text-zinc-500">
                      Downloads all current entities, products, communities, tiles, and more
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Claude Extension Prompt
                    </CardTitle>
                    <CardDescription>
                      Generate a prompt to extend this CPAC via Claude
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      onClick={() => generatePromptMutation.mutate()}
                      disabled={generatePromptMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      data-testid="button-generate-prompt"
                    >
                      {generatePromptMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Generate Prompt
                    </Button>
                    <p className="text-xs text-zinc-500">
                      Creates a detailed prompt with current contents, rules, and expansion buckets
                    </p>
                  </CardContent>
                </Card>
              </div>

              {showPrompt && claudePrompt && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">Generated Claude Prompt</CardTitle>
                      <CardDescription>Copy or download this prompt to use with Claude</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyPrompt} data-testid="button-copy-prompt">
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadPrompt} data-testid="button-download-prompt">
                        <FileText className="w-4 h-4 mr-2" />
                        Download .txt
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      value={claudePrompt}
                      readOnly
                      className="min-h-[300px] font-mono text-xs bg-zinc-950 border-zinc-700"
                    />
                  </CardContent>
                </Card>
              )}

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-green-400" />
                    Upload Orbit CPAC
                  </CardTitle>
                  <CardDescription>
                    Upload an extended CPAC to preview changes before applying
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="cpac-upload"
                    />
                    <label 
                      htmlFor="cpac-upload"
                      className="flex-1 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors"
                    >
                      <Upload className="w-5 h-5 text-zinc-500" />
                      <span className="text-zinc-400">Click to upload CPAC JSON</span>
                    </label>
                  </div>

                  {uploadedCpac && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">File uploaded ({(uploadedCpac.length / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button 
                        onClick={() => analyzeDiffMutation.mutate(uploadedCpac)}
                        disabled={analyzeDiffMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700"
                        data-testid="button-analyze-diff"
                      >
                        {analyzeDiffMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Analyze Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">CPAC Diff Preview</DialogTitle>
            <DialogDescription>
              Review the changes before applying to the database
            </DialogDescription>
          </DialogHeader>
          
          {diffResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20 text-center">
                  <p className="text-2xl font-bold text-green-400">{diffResult.summary.totalAdditions}</p>
                  <p className="text-xs text-green-300">New entries</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{diffResult.summary.potentialDuplicates}</p>
                  <p className="text-xs text-yellow-300">Potential duplicates</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 text-center">
                  <p className="text-2xl font-bold text-orange-400">{diffResult.summary.warnings}</p>
                  <p className="text-xs text-orange-300">Warnings</p>
                </div>
              </div>

              {diffResult.diff.potentialDuplicates.length > 0 && (
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <h4 className="font-medium text-yellow-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Potential Duplicates Detected
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {diffResult.diff.potentialDuplicates.map((dup, i) => (
                      <li key={i} className="text-yellow-300">
                        "{dup.newName}" is {dup.similarity}% similar to existing "{dup.existingName}" ({dup.type})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {diffResult.diff.warnings.length > 0 && (
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <h4 className="font-medium text-orange-400 mb-2">Warnings</h4>
                  <ul className="space-y-1 text-sm text-orange-300">
                    {diffResult.diff.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {diffResult.summary.totalAdditions === 0 && diffResult.summary.potentialDuplicates === 0 && (
                <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                  <CheckCircle2 className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-400">No new entries detected</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    The uploaded CPAC contains entries that already exist in the database
                  </p>
                </div>
              )}

              <DiffSection 
                title="New Entities" 
                count={diffResult.diff.newEntities.length}
                expanded={expandedSections.has("entities")}
                onToggle={() => toggleSection("entities")}
              >
                {diffResult.diff.newEntities.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-white">{e.name}</span>
                    <Badge variant="secondary" className="bg-zinc-800">{e.entityType}</Badge>
                  </div>
                ))}
              </DiffSection>

              <DiffSection 
                title="New Products" 
                count={diffResult.diff.newProducts.length}
                expanded={expandedSections.has("products")}
                onToggle={() => toggleSection("products")}
              >
                {diffResult.diff.newProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-white">{p.name}</span>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-zinc-800">{p.category}</Badge>
                      <Badge variant="secondary" className="bg-zinc-800">{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </DiffSection>

              <DiffSection 
                title="New Communities" 
                count={diffResult.diff.newCommunities.length}
                expanded={expandedSections.has("communities")}
                onToggle={() => toggleSection("communities")}
              >
                {diffResult.diff.newCommunities.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-white">{c.name}</span>
                    <Badge variant="secondary" className="bg-zinc-800">{c.communityType}</Badge>
                  </div>
                ))}
              </DiffSection>

              <DiffSection 
                title="New Tiles" 
                count={diffResult.diff.newTiles.length}
                expanded={expandedSections.has("tiles")}
                onToggle={() => toggleSection("tiles")}
              >
                {diffResult.diff.newTiles.map((t) => (
                  <div key={t.id} className="py-1 text-sm text-white">{t.label}</div>
                ))}
              </DiffSection>

              <DiffSection 
                title="New Pulse Sources" 
                count={diffResult.diff.newPulseSources.length}
                expanded={expandedSections.has("sources")}
                onToggle={() => toggleSection("sources")}
              >
                {diffResult.diff.newPulseSources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-white">{s.name}</span>
                    <Badge variant="secondary" className="bg-zinc-800">{s.sourceType}</Badge>
                  </div>
                ))}
              </DiffSection>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiffDialog(false)}>
              Close
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              disabled
              data-testid="button-apply-changes"
            >
              Apply Changes (Coming Soon)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-3 bg-zinc-800/50 rounded-lg">
      <div className="flex items-center gap-2 text-zinc-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function DiffSection({ 
  title, 
  count, 
  expanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  count: number; 
  expanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{title}</span>
          <Badge className="bg-green-500/20 text-green-400">+{count}</Badge>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2 space-y-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
