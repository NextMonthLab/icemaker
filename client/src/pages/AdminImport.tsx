import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Upload, FileArchive, CheckCircle2, AlertTriangle, Loader2, XCircle, Download } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ImportValidationResult, ImportExecutionResult } from "@/lib/api";

export default function AdminImport() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isDryRun, setIsDryRun] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [dropAllImmediately, setDropAllImmediately] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  const validateMutation = useMutation({
    mutationFn: (file: File) => api.validateImport(file),
    onSuccess: (data) => {
      setReport(data);
      toast({ 
        title: data.valid ? "Validation Passed" : "Validation Issues Found",
        description: data.valid 
          ? `Found ${data.createdCards} cards and ${data.createdCharacters} characters ready to import.`
          : `Found ${data.errors.length} error(s). Please fix them before importing.`,
        variant: data.valid ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Could not validate the ZIP file.",
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (file: File) => api.executeImport(file, { overwrite: overwriteExisting, dropImmediately: dropAllImmediately }),
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast({ 
        title: "Import Successful!",
        description: `Created ${data.createdCards} cards and ${data.createdCharacters} characters in "${data.universeName}".`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Could not import the season pack.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setSelectedFile(e.target.files[0]);
      setReport(null);
      setImportResult(null);
      toast({ 
        title: "File Selected", 
        description: e.target.files[0].name 
      });
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast({ 
        title: "No File Selected",
        description: "Please select a ZIP file first.",
        variant: "destructive",
      });
      return;
    }

    if (isDryRun) {
      validateMutation.mutate(selectedFile);
    } else {
      executeMutation.mutate(selectedFile);
    }
  };

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You need admin privileges to access this page.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isProcessing = validateMutation.isPending || executeMutation.isPending;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
        
        <div className="flex items-center gap-4">
            <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
            </Link>
            <div>
                <h1 className="text-3xl font-display font-bold">Import Season Pack</h1>
                <p className="text-muted-foreground">Bulk upload content via ZIP archive</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Input */}
            <Card className="md:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle>Source File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center text-center hover:bg-muted/50 transition-colors cursor-pointer group relative">
                        <Input 
                            type="file" 
                            accept=".zip" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                            onChange={handleFileSelect}
                            data-testid="input-zip-file"
                        />
                        <FileArchive className="w-10 h-10 text-muted-foreground mb-4 group-hover:text-primary transition-colors" />
                        {selectedFile ? (
                          <>
                            <span className="font-bold text-sm text-primary">{selectedFile.name}</span>
                            <span className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-sm">Drop ZIP file here</span>
                            <span className="text-xs text-muted-foreground mt-1">manifest.json + assets</span>
                          </>
                        )}
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                        <Label htmlFor="dry-run" className="flex flex-col gap-1 cursor-pointer">
                            <span>Dry Run Mode</span>
                            <span className="font-normal text-xs text-muted-foreground">Validate only, no DB writes</span>
                        </Label>
                        <Switch 
                          id="dry-run" 
                          checked={isDryRun} 
                          onCheckedChange={setIsDryRun}
                          data-testid="switch-dry-run"
                        />
                    </div>
                    
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                        <Label htmlFor="overwrite" className="flex flex-col gap-1 cursor-pointer">
                            <span>Overwrite Existing</span>
                            <span className="font-normal text-xs text-muted-foreground">Replace universe with same slug</span>
                        </Label>
                        <Switch 
                          id="overwrite" 
                          checked={overwriteExisting} 
                          onCheckedChange={setOverwriteExisting}
                          data-testid="switch-overwrite"
                          disabled={isDryRun}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/20">
                        <Label htmlFor="drop-immediately" className="flex flex-col gap-1 cursor-pointer">
                            <span>Drop All Immediately</span>
                            <span className="font-normal text-xs text-muted-foreground">Ignore publish dates - make all cards available now</span>
                        </Label>
                        <Switch 
                          id="drop-immediately" 
                          checked={dropAllImmediately} 
                          onCheckedChange={setDropAllImmediately}
                          data-testid="switch-drop-immediately"
                          disabled={isDryRun}
                        />
                    </div>

                    <Button 
                      className="w-full gap-2" 
                      onClick={handleImport} 
                      disabled={isProcessing || !selectedFile}
                      data-testid="button-import"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isProcessing ? "Processing..." : isDryRun ? "Run Validation" : "Import Pack"}
                    </Button>

                    <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3">Need a template to get started?</p>
                        <Button 
                          variant="outline" 
                          className="w-full gap-2" 
                          onClick={() => window.open("/api/import/template", "_blank")}
                          data-testid="button-download-template"
                        >
                            <Download className="w-4 h-4" />
                            Download Sample Manifest
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Right Column: Report */}
            <Card className="md:col-span-2 min-h-[400px]">
                <CardHeader>
                    <CardTitle>Import Report</CardTitle>
                    <CardDescription>Status and validation output</CardDescription>
                </CardHeader>
                <CardContent>
                    {!report && !importResult && !isProcessing && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50">
                            <FileArchive className="w-12 h-12 mb-4" />
                            <p>Upload a file to see validation results</p>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <div className="text-sm text-muted-foreground text-center">
                                <p>{isDryRun ? "Validating archive..." : "Importing content..."}</p>
                                <p className="opacity-50">Processing manifest and assets...</p>
                            </div>
                        </div>
                    )}

                    {importResult && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-4">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                                <div>
                                    <p className="text-xl font-bold text-green-500">Import Complete!</p>
                                    <p className="text-sm text-muted-foreground">
                                        Created {importResult.createdCards} cards and {importResult.createdCharacters} characters in "{importResult.universeName}"
                                    </p>
                                </div>
                            </div>
                            <Button onClick={() => setLocation("/admin")} className="w-full" data-testid="button-back-to-admin">
                                Back to Dashboard
                            </Button>
                        </div>
                    )}

                    {report && !importResult && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <div>
                                        <p className="text-2xl font-bold" data-testid="text-card-count">{report.createdCards}</p>
                                        <p className="text-xs text-muted-foreground uppercase">Cards Found</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <p className="text-2xl font-bold" data-testid="text-character-count">{report.createdCharacters}</p>
                                        <p className="text-xs text-muted-foreground uppercase">Characters Found</p>
                                    </div>
                                </div>
                            </div>

                            {report.errors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-bold text-sm flex items-center gap-2 text-red-500">
                                        <XCircle className="w-4 h-4" /> Errors ({report.errors.length})
                                    </h4>
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-md p-3 text-sm font-mono text-red-200/80">
                                        {report.errors.map((e, i) => (
                                            <p key={i}>[ERROR] {e}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {report.warnings.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-bold text-sm flex items-center gap-2 text-yellow-500">
                                        <AlertTriangle className="w-4 h-4" /> Warnings ({report.warnings.length})
                                    </h4>
                                    <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-md p-3 text-sm font-mono text-yellow-200/80">
                                        {report.warnings.map((w, i) => (
                                            <p key={i}>[WARN] {w}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm">Schedule Preview</h4>
                                <ScrollArea className="h-48 border rounded-md">
                                    <div className="p-4 space-y-2">
                                        {report.schedule.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0" data-testid={`schedule-row-${i}`}>
                                                <div className="flex gap-4">
                                                    <span className="font-mono text-muted-foreground w-8">D{item.day}</span>
                                                    <span>{item.title}</span>
                                                </div>
                                                <span className="text-muted-foreground font-mono text-xs">{item.date}</span>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            {report.valid && (
                              <div className="pt-4 border-t border-border">
                                <p className="text-sm text-muted-foreground mb-3">
                                  Validation passed! Turn off Dry Run mode and click "Import Pack" to save to database.
                                </p>
                              </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
      </div>
    </Layout>
  );
}
