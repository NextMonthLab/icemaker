import { useState, useRef } from "react";
import { Settings, Building2, Globe, Bell, Shield, FileText, Zap, Check, ExternalLink, Plus, X, Link2, Instagram, Linkedin, Facebook, Twitter, Youtube, Upload, Trash2, Loader2, File, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrbitLayout from "@/components/OrbitLayout";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface OrbitSource {
  id: number;
  label: string;
  sourceType: string;
  value: string;
}

interface OrbitMeta {
  strengthScore: number;
  planTier: string;
}

interface OrbitDocument {
  id: number;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  title: string;
  category: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  pageCount?: number;
  createdAt: string;
}

type SourceLabel = 'about' | 'services' | 'faq' | 'contact' | 'homepage' | 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube';

const DOCUMENT_CATEGORIES = [
  { value: 'products', label: 'Products/Services', description: 'What you offer' },
  { value: 'pricing', label: 'Pricing', description: 'Costs, packages, quotes' },
  { value: 'policies', label: 'Policies', description: 'Terms, refunds, guarantees' },
  { value: 'guides', label: 'How-to/Guides', description: 'Instructions for customers' },
  { value: 'faqs', label: 'FAQs', description: 'Common questions answered' },
  { value: 'company', label: 'Company Info', description: 'About us, team, history' },
  { value: 'other', label: 'Other', description: 'General reference material' },
];

const SOURCE_OPTIONS = [
  { value: 'homepage', label: 'Homepage', type: 'page_url', icon: Link2, description: 'Your main website URL' },
  { value: 'about', label: 'About Page', type: 'page_url', icon: FileText, description: 'Your about us page' },
  { value: 'services', label: 'Services/Pricing', type: 'page_url', icon: FileText, description: 'Services or pricing page' },
  { value: 'faq', label: 'FAQ/Help', type: 'page_url', icon: FileText, description: 'FAQ or help center' },
  { value: 'contact', label: 'Contact Page', type: 'page_url', icon: FileText, description: 'Contact information' },
  { value: 'linkedin', label: 'LinkedIn', type: 'social_link', icon: Linkedin, description: 'Company LinkedIn page' },
  { value: 'instagram', label: 'Instagram', type: 'social_link', icon: Instagram, description: 'Instagram profile' },
  { value: 'facebook', label: 'Facebook', type: 'social_link', icon: Facebook, description: 'Facebook page' },
  { value: 'twitter', label: 'Twitter/X', type: 'social_link', icon: Twitter, description: 'Twitter/X profile' },
  { value: 'youtube', label: 'YouTube', type: 'social_link', icon: Youtube, description: 'YouTube channel' },
];

export default function OrbitSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'links' | 'hero' | 'docs'>('links');
  const [selectedSourceType, setSelectedSourceType] = useState<SourceLabel | ''>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [heroPostUrl, setHeroPostUrl] = useState('');
  const [heroPostText, setHeroPostText] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  
  const { data: sourcesData, refetch: refetchSources } = useQuery<{ sources: OrbitSource[] }>({
    queryKey: ["orbit-sources", slug],
    queryFn: async () => {
      if (!slug) return { sources: [] };
      const response = await fetch(`/api/orbit/${slug}/sources`, { credentials: "include" });
      if (!response.ok) return { sources: [] };
      return response.json();
    },
    enabled: !!slug,
  });

  const { data: orbitData } = useQuery<OrbitMeta>({
    queryKey: ["orbit-meta", slug],
    queryFn: async () => {
      if (!slug) return { strengthScore: 0, planTier: 'free' };
      const response = await fetch(`/api/orbit/${slug}/meta`, { credentials: "include" });
      if (!response.ok) return { strengthScore: 0, planTier: 'free' };
      return response.json();
    },
    enabled: !!slug,
  });

  const addSourceMutation = useMutation({
    mutationFn: async (newSource: { label: SourceLabel; sourceType: string; value: string }) => {
      const existingSources = sources.map(s => ({
        label: s.label as SourceLabel,
        sourceType: s.sourceType as 'page_url' | 'social_link',
        value: s.value,
      }));
      
      const allSources = [...existingSources, newSource];
      
      const response = await fetch(`/api/orbit/${slug}/ingest-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sources: allSources }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add source');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Source added", description: "Your Orbit is now stronger!" });
      setShowAddModal(false);
      setSelectedSourceType('');
      setSourceUrl('');
      refetchSources();
      queryClient.invalidateQueries({ queryKey: ["orbit-meta", slug] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sources = sourcesData?.sources || [];
  const strengthScore = orbitData?.strengthScore ?? 0;
  const isPowered = strengthScore > 0;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: documentsData, refetch: refetchDocuments } = useQuery<{ documents: OrbitDocument[] }>({
    queryKey: ["orbit-documents", slug],
    queryFn: async () => {
      if (!slug) return { documents: [] };
      const response = await fetch(`/api/orbit/${slug}/documents`, { credentials: "include" });
      if (!response.ok) return { documents: [] };
      return response.json();
    },
    enabled: !!slug,
  });

  const documents = documentsData?.documents || [];

  const handleFileUpload = async (file: File, category: string) => {
    if (!slug) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);
    formData.append('category', category);
    
    try {
      const response = await fetch(`/api/orbit/${slug}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      toast({ title: "Document uploaded", description: `Added to ${DOCUMENT_CATEGORIES.find(c => c.value === category)?.label || 'Other'} category` });
      refetchDocuments();
      setShowAddModal(false);
      setDocCategory('other');
    } catch (error) {
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: number) => {
      const response = await fetch(`/api/orbit/${slug}/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      refetchDocuments();
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const addHeroPostMutation = useMutation({
    mutationFn: async (data: { url: string; text?: string }) => {
      const response = await fetch(`/api/orbit/${slug}/hero-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add hero post');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Hero Post added", description: "Analyzing your post for patterns..." });
      setShowAddModal(false);
      setHeroPostUrl('');
      setHeroPostText('');
      queryClient.invalidateQueries({ queryKey: ["hero-posts", slug] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddHeroPost = () => {
    if (!heroPostUrl.trim()) return;
    addHeroPostMutation.mutate({ 
      url: heroPostUrl.trim(), 
      text: heroPostText.trim() || undefined 
    });
  };

  const handleModalFileUpload = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSourceLabel = (label: string) => {
    const labels: Record<string, string> = {
      about: 'About Page',
      services: 'Services/Pricing',
      faq: 'FAQ/Help',
      contact: 'Contact Page',
      homepage: 'Homepage',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      facebook: 'Facebook',
      twitter: 'Twitter/X',
      tiktok: 'TikTok',
      youtube: 'YouTube',
    };
    return labels[label] || label;
  };

  const getSourceIcon = (label: string) => {
    const option = SOURCE_OPTIONS.find(o => o.value === label);
    return option?.icon || Link2;
  };

  const existingLabels = sources.map(s => s.label);
  const availableOptions = SOURCE_OPTIONS.filter(o => !existingLabels.includes(o.value));

  const handleAddSource = () => {
    if (!selectedSourceType || !sourceUrl) return;
    
    const option = SOURCE_OPTIONS.find(o => o.value === selectedSourceType);
    if (!option) return;
    
    addSourceMutation.mutate({
      label: selectedSourceType,
      sourceType: option.type as 'page_url' | 'social_link',
      value: sourceUrl,
    });
  };

  return (
    <OrbitLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto w-full">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white" data-testid="text-settings-title">
            Strengthen Your Orbit
          </h1>
          <p className="text-white/60 text-sm">
            Add sources to make your Orbit smarter and more helpful
          </p>
        </div>

        <div className="space-y-6">
          {/* Knowledge Sources Section */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-sources">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Knowledge Sources</h2>
                  <p className="text-xs text-white/50">Pages and links that power your Orbit</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={isPowered ? "border-blue-500/50 text-blue-400" : "border-amber-500/50 text-amber-400"}
              >
                {isPowered ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse" />
                    Powered
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
                    Starter
                  </>
                )}
              </Badge>
            </div>
            
            {/* Strength Progress */}
            <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60">Orbit Strength</span>
                <span className="text-sm font-semibold text-white">{strengthScore}/100</span>
              </div>
              <Progress value={strengthScore} className="h-1.5" />
              <p className="text-xs text-white/40 mt-2">
                {strengthScore === 0 
                  ? "Add sources below to power up your Orbit"
                  : strengthScore < 50 
                    ? "Good start! Add more sources to increase strength"
                    : strengthScore < 80 
                      ? "Strong! A few more sources will maximize your Orbit"
                      : "Excellent! Your Orbit is fully powered"
                }
              </p>
            </div>
            
            {/* Source List */}
            {sources.length > 0 ? (
              <div className="space-y-2 mb-4">
                {sources.map((source) => {
                  const Icon = getSourceIcon(source.label);
                  return (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <span className="text-sm text-white/80 block">{getSourceLabel(source.label)}</span>
                          <span className="text-xs text-white/40 truncate max-w-[200px] block">{source.value}</span>
                        </div>
                      </div>
                      {(source.sourceType === 'page_url' || source.sourceType === 'social_link') && (
                        <a
                          href={source.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-dashed border-white/10 text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-white/70 mb-1">No sources added yet</p>
                <p className="text-xs text-white/40">Add your website, social channels, and pages to power up your Orbit</p>
              </div>
            )}
            
            {/* Add Sources Button */}
            {availableOptions.length > 0 && (
              <Button
                variant="outline"
                className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                data-testid="button-add-sources"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {sources.length > 0 ? 'Add More Sources' : 'Add Your First Source'}
              </Button>
            )}
          </div>

          {/* Documents Section */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-documents">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <File className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Documents</h2>
                  <p className="text-xs text-white/50">Product manuals, presentations, and guides</p>
                </div>
              </div>
              <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                {documents.length} files
              </Badge>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, docCategory);
                e.target.value = '';
              }}
              data-testid="input-document-file"
            />

            {/* Document List */}
            {documents.length > 0 ? (
              <div className="space-y-2 mb-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5"
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <span className="text-sm text-white/80 block truncate max-w-[180px]">{doc.title || doc.fileName}</span>
                        <span className="text-xs text-white/40">
                          {doc.fileType.toUpperCase()} • {formatFileSize(doc.fileSizeBytes)}
                          {doc.pageCount ? ` • ${doc.pageCount} pages` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status === 'processing' && (
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      )}
                      {doc.status === 'ready' && (
                        <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">Ready</Badge>
                      )}
                      {doc.status === 'error' && (
                        <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">Error</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/40 hover:text-red-400"
                        onClick={() => {
                          if (confirm('Delete this document?')) {
                            deleteDocumentMutation.mutate(doc.id);
                          }
                        }}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-dashed border-white/10 text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-white/70 mb-1">No documents yet</p>
                <p className="text-xs text-white/40">Upload PDFs, presentations, or product manuals</p>
              </div>
            )}

            {/* Upload Button - Opens modal on Documents tab so user can select category */}
            <Button
              variant="outline"
              className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => {
                setModalTab('docs');
                setShowAddModal(true);
              }}
              disabled={isUploading}
              data-testid="button-upload-document"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
            <p className="text-xs text-white/40 mt-2 text-center">
              Supported: PDF, PPT, PPTX, DOC, DOCX, TXT, MD (max 25MB)
            </p>
          </div>

          {/* Value Proposition for Free Users */}
          {orbitData?.planTier === 'free' && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Why add sources?</h3>
                  <ul className="text-xs text-white/60 space-y-1">
                    <li>• Smarter AI responses about your business</li>
                    <li>• Visitors get accurate, helpful information</li>
                    <li>• Build trust with comprehensive knowledge</li>
                  </ul>
                  <p className="text-xs text-pink-400 mt-2">Upgrade to unlock automatic source updates and document uploads</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-business">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Business Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60 block mb-1">Business Name</label>
                <Input
                  placeholder="Your Business Name"
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-business-name"
                />
              </div>
              <div>
                <label className="text-sm text-white/60 block mb-1">Website</label>
                <Input
                  placeholder="https://example.com"
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-website"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-ai">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">AI Discovery Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Allow AI Indexing</p>
                  <p className="text-xs text-white/50">Let AI systems discover your business</p>
                </div>
                <Switch defaultChecked data-testid="toggle-ai-indexing" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Auto-Update Knowledge</p>
                  <p className="text-xs text-white/50">Automatically sync changes to AI systems</p>
                </div>
                <Switch defaultChecked data-testid="toggle-auto-update" />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-notifications">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">AI Accuracy Alerts</span>
                <Switch defaultChecked data-testid="toggle-accuracy-alerts" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Weekly Reports</span>
                <Switch data-testid="toggle-weekly-reports" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button className="bg-blue-500 hover:bg-blue-600" data-testid="button-save-settings">
            Save Changes
          </Button>
        </div>
      </div>

      {/* Add Source Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        setShowAddModal(open);
        if (!open) {
          setSelectedSourceType('');
          setSourceUrl('');
          setHeroPostUrl('');
          setHeroPostText('');
          setDocCategory('other');
          setModalTab('links');
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Power Up Your Orbit</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add knowledge sources to make your Orbit smarter
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'links' | 'hero' | 'docs')} className="mt-2">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-800">
              <TabsTrigger value="links" className="data-[state=active]:bg-blue-600 text-xs" data-testid="tab-links">
                <Link2 className="w-3 h-3 mr-1" />
                Links
              </TabsTrigger>
              <TabsTrigger value="hero" className="data-[state=active]:bg-purple-600 text-xs" data-testid="tab-hero">
                <Sparkles className="w-3 h-3 mr-1" />
                Hero Posts
              </TabsTrigger>
              <TabsTrigger value="docs" className="data-[state=active]:bg-pink-600 text-xs" data-testid="tab-docs">
                <File className="w-3 h-3 mr-1" />
                Documents
              </TabsTrigger>
            </TabsList>

            {/* Links Tab */}
            <TabsContent value="links" className="space-y-4 mt-4">
              <div>
                <Label className="text-zinc-300 mb-2 block">Source Type</Label>
                <Select value={selectedSourceType} onValueChange={(v) => setSelectedSourceType(v as SourceLabel)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Select a source type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {availableOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="text-white focus:bg-zinc-700 focus:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedSourceType && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {SOURCE_OPTIONS.find(o => o.value === selectedSourceType)?.description}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-zinc-300 mb-2 block">URL</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="input-source-url"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                onClick={handleAddSource}
                disabled={!selectedSourceType || !sourceUrl || addSourceMutation.isPending}
                data-testid="button-confirm-add-source"
              >
                {addSourceMutation.isPending ? "Adding..." : "Add Link"}
              </Button>
            </TabsContent>

            {/* Hero Posts Tab */}
            <TabsContent value="hero" className="space-y-4 mt-4">
              <p className="text-xs text-zinc-400">
                Add your best-performing social posts to analyze patterns and get content suggestions.
              </p>
              <div>
                <Label className="text-zinc-300 mb-2 block">Post URL</Label>
                <Input
                  value={heroPostUrl}
                  onChange={(e) => setHeroPostUrl(e.target.value)}
                  placeholder="https://linkedin.com/posts/... or https://x.com/..."
                  className="bg-zinc-800 border-zinc-700 text-white"
                  data-testid="input-hero-url"
                />
              </div>
              <div>
                <Label className="text-zinc-300 mb-2 block">Post Text (optional)</Label>
                <Textarea
                  value={heroPostText}
                  onChange={(e) => setHeroPostText(e.target.value)}
                  placeholder="Paste the post content here if the URL doesn't work..."
                  className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
                  data-testid="input-hero-text"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  If we can't fetch content from the URL, paste the text here
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={handleAddHeroPost}
                disabled={!heroPostUrl.trim() || addHeroPostMutation.isPending}
                data-testid="button-confirm-add-hero"
              >
                {addHeroPostMutation.isPending ? "Adding..." : "Add Hero Post"}
              </Button>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="docs" className="space-y-4 mt-4">
              <p className="text-xs text-zinc-400">
                Upload documents to enhance your Orbit's knowledge. Choose a category so the AI knows when to use it.
              </p>
              
              <div>
                <Label className="text-zinc-300 mb-2 block">Document Category</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" data-testid="select-doc-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem 
                        key={cat.value} 
                        value={cat.value}
                        className="text-white focus:bg-zinc-700 focus:text-white"
                      >
                        <div className="flex flex-col">
                          <span>{cat.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500 mt-1">
                  {DOCUMENT_CATEGORIES.find(c => c.value === docCategory)?.description}
                </p>
              </div>

              <div 
                className="p-6 rounded-lg bg-gradient-to-br from-pink-500/5 to-purple-500/5 border border-dashed border-white/20 text-center cursor-pointer hover:border-pink-500/50 transition-colors"
                onClick={handleModalFileUpload}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-pink-400" />
                </div>
                <p className="text-sm text-white/70 mb-1">Click to upload</p>
                <p className="text-xs text-white/40">PDF, PPT, PPTX, DOC, DOCX, TXT, MD (max 25MB)</p>
              </div>
              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-pink-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              )}
              {documents.length > 0 && (
                <div className="text-xs text-zinc-500">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </OrbitLayout>
  );
}
