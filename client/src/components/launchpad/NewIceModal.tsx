import { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Link2, ClipboardPaste, Upload, Check, ArrowRight, FileText, X, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Insight {
  id: string;
  title: string;
  meaning: string;
  orbitId: string;
  confidence: "high" | "medium" | "low";
  topicTags: string[];
  segment?: string;
  source: string;
  kind?: "top" | "feed";
  createdAt: string;
  updatedAt?: string;
}

interface NewIceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessSlug: string;
  selectedInsight?: Insight | null;
  insights?: Insight[];
}

type InputMode = 'insight' | 'url' | 'paste' | 'upload';

interface InputModeOption {
  id: InputMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}

const inputModes: InputModeOption[] = [
  {
    id: 'insight',
    title: 'From an insight',
    description: 'Generate from your Orbit insights',
    icon: Sparkles,
  },
  {
    id: 'url',
    title: 'From a URL',
    description: 'Import content from any webpage',
    icon: Link2,
  },
  {
    id: 'paste',
    title: 'Paste text',
    description: 'Paste your own content directly',
    icon: ClipboardPaste,
  },
  {
    id: 'upload',
    title: 'Upload file',
    description: 'Plain text document (.txt)',
    icon: Upload,
  },
];

export function NewIceModal({
  open,
  onOpenChange,
  businessSlug,
  selectedInsight,
  insights = [],
}: NewIceModalProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<InputMode>(selectedInsight ? 'insight' : 'insight');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(selectedInsight?.id || null);
  const [urlInput, setUrlInput] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFromInsightMutation = useMutation({
    mutationFn: async (insightId: string) => {
      const response = await fetch(`/api/orbit/${businessSlug}/ice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightId,
          format: 'story',
          tone: 'professional',
          outputType: 'story',
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to generate draft');
      }
      return response.json();
    },
    onSuccess: () => {
      onOpenChange(false);
      // Stay on launchpad - draft is saved and visible in Recent
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async (data: { type: 'url' | 'text'; value: string }) => {
      const response = await fetch('/api/ice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create preview');
      }
      return response.json();
    },
    onSuccess: (data) => {
      onOpenChange(false);
      if (data.id) {
        setLocation(`/ice/preview/${data.id}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });
  
  const isPending = generateFromInsightMutation.isPending || generatePreviewMutation.isPending;

  const handleGenerate = useCallback(async () => {
    setError("");
    
    if (mode === 'insight') {
      if (!selectedInsightId) {
        setError("Please select an insight");
        return;
      }
      generateFromInsightMutation.mutate(selectedInsightId);
    } else if (mode === 'url') {
      if (!urlInput.trim()) {
        setError("Please enter a URL");
        return;
      }
      try {
        new URL(urlInput.trim());
      } catch {
        setError("Please enter a valid URL");
        return;
      }
      generatePreviewMutation.mutate({ type: 'url', value: urlInput.trim() });
    } else if (mode === 'paste') {
      if (!pasteInput.trim()) {
        setError("Please paste some content");
        return;
      }
      if (pasteInput.trim().length < 50) {
        setError("Please provide more content (at least 50 characters)");
        return;
      }
      generatePreviewMutation.mutate({ type: 'text', value: pasteInput.trim() });
    } else if (mode === 'upload') {
      if (!uploadedFile) {
        setError("Please upload a file");
        return;
      }
      
      // Only allow plain text files - binary formats (PDF, DOC, DOCX) require server-side processing
      const isPlainText = uploadedFile.type === 'text/plain' || uploadedFile.name.endsWith('.txt');
      
      if (!isPlainText) {
        setError("Only plain text files (.txt) are supported. For PDF or Word documents, please copy and paste the content instead.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (!content || content.trim().length < 50) {
          setError("File appears empty or too short (minimum 50 characters)");
          return;
        }
        generatePreviewMutation.mutate({ type: 'text', value: content });
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsText(uploadedFile);
    }
  }, [mode, selectedInsightId, urlInput, pasteInput, uploadedFile, generateFromInsightMutation, generatePreviewMutation]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPlainText = file.type === 'text/plain' || file.name.endsWith('.txt');
      if (!isPlainText) {
        setError("Only plain text files (.txt) are supported. For PDF or Word documents, please copy and paste the content instead.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large (max 10MB)");
        return;
      }
      setUploadedFile(file);
      setError("");
    }
  }, []);

  const isValid = () => {
    if (mode === 'insight') return !!selectedInsightId;
    if (mode === 'url') return !!urlInput.trim();
    if (mode === 'paste') return pasteInput.trim().length >= 50;
    if (mode === 'upload') return !!uploadedFile;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create a new ICE</DialogTitle>
          <DialogDescription className="text-white/60">
            Choose how you want to create your Interactive Cinematic Experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Input mode selection */}
          <div className="grid grid-cols-2 gap-2">
            {inputModes.map((option) => {
              const isSelected = mode === option.id;
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setMode(option.id);
                    setError("");
                  }}
                  className={`
                    p-3 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    ${isSelected
                      ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                    }
                  `}
                  data-testid={`button-mode-${option.id}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-blue-400' : 'text-white/50'}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block ${isSelected ? 'text-white' : 'text-white/80'}`}>
                        {option.title}
                      </span>
                      <span className="text-xs text-white/40 line-clamp-1">{option.description}</span>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode-specific input */}
          <div className="min-h-[150px] pt-2">
            {mode === 'insight' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Select an insight from your Orbit</label>
                {insights.length === 0 ? (
                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                    <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/50">No insights available yet</p>
                    <p className="text-xs text-white/30 mt-1">Add sources to your Orbit to generate insights</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {insights.map((insight) => (
                      <button
                        key={insight.id}
                        onClick={() => setSelectedInsightId(insight.id)}
                        className={`
                          w-full p-3 rounded-lg border text-left transition-all
                          ${selectedInsightId === insight.id
                            ? 'bg-blue-500/10 border-blue-500/50'
                            : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                          }
                        `}
                        data-testid={`insight-${insight.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white line-clamp-1">{insight.title}</span>
                            <span className="text-xs text-white/50 line-clamp-1 mt-0.5">{insight.meaning}</span>
                          </div>
                          {selectedInsightId === insight.id && (
                            <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === 'url' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Enter a webpage URL to import</label>
                <Input
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setError("");
                  }}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-url"
                />
                <p className="text-xs text-white/30">We'll extract the content and generate your ICE</p>
              </div>
            )}

            {mode === 'paste' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Paste your content</label>
                <textarea
                  placeholder="Paste your article, script, or story here..."
                  value={pasteInput}
                  onChange={(e) => {
                    setPasteInput(e.target.value);
                    setError("");
                  }}
                  className="w-full h-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  data-testid="textarea-paste"
                />
                <p className="text-xs text-white/30">
                  {pasteInput.length} characters {pasteInput.length < 50 && pasteInput.length > 0 && "(minimum 50)"}
                </p>
              </div>
            )}

            {mode === 'upload' && (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Upload a document</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadedFile ? (
                  <div className="p-4 rounded-lg bg-white/[0.03] border border-white/10 flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-white/40">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 rounded hover:bg-white/10"
                    >
                      <X className="w-4 h-4 text-white/50" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 rounded-lg border-2 border-dashed border-white/10 hover:border-white/20 text-center transition-colors"
                    data-testid="button-upload-file"
                  >
                    <Upload className="w-8 h-8 text-white/30 mx-auto mb-2" />
                    <p className="text-sm text-white/60">Click to upload</p>
                    <p className="text-xs text-white/30 mt-1">Plain text file (.txt, max 10MB)</p>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!isValid() || isPending}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
              data-testid="button-generate-ice"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate ICE
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}