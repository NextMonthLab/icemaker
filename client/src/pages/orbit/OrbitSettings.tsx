import { useState, useRef, useEffect } from "react";
import { Settings, Building2, Globe, Bell, Shield, FileText, Zap, Check, ExternalLink, Plus, X, Link2, Instagram, Linkedin, Facebook, Twitter, Youtube, Upload, Trash2, Loader2, File, Sparkles, RefreshCw, Play, Video } from "lucide-react";
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
  customTitle?: string | null;
  sourceUrl?: string;
  aiIndexingEnabled?: boolean;
  autoUpdateKnowledge?: boolean;
  aiAccuracyAlertsEnabled?: boolean;
  weeklyReportsEnabled?: boolean;
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

interface HeroPost {
  id: number;
  url: string;
  platform: string;
  title?: string;
  postText?: string;
  status: 'pending' | 'enriching' | 'ready' | 'needs_text' | 'error';
  createdAt: string;
}

interface BrandVoiceData {
  brandVoiceSummary: string | null;
  voiceTraits: string[];
  audienceNotes: string | null;
  toneGuidance: {
    dosList?: string[];
    dontsList?: string[];
    keyPhrases?: string[];
  } | null;
  brandVoiceUpdatedAt: string | null;
  heroPosts: HeroPost[];
  readyPostCount: number;
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
  const [modalTab, setModalTab] = useState<'links' | 'hero' | 'docs' | 'videos'>('links');
  const [selectedSourceType, setSelectedSourceType] = useState<SourceLabel | ''>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [heroPostUrl, setHeroPostUrl] = useState('');
  
  // Settings form state
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [aiIndexingEnabled, setAiIndexingEnabled] = useState(true);
  const [autoUpdateKnowledge, setAutoUpdateKnowledge] = useState(true);
  const [aiAccuracyAlertsEnabled, setAiAccuracyAlertsEnabled] = useState(true);
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [heroPostText, setHeroPostText] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoTags, setVideoTags] = useState('');
  
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
  
  // Initialize settings from loaded data
  useEffect(() => {
    if (orbitData && !settingsInitialized) {
      setBusinessName(orbitData.customTitle || '');
      setWebsiteUrl(orbitData.sourceUrl || '');
      setAiIndexingEnabled(orbitData.aiIndexingEnabled ?? true);
      setAutoUpdateKnowledge(orbitData.autoUpdateKnowledge ?? true);
      setAiAccuracyAlertsEnabled(orbitData.aiAccuracyAlertsEnabled ?? true);
      setWeeklyReportsEnabled(orbitData.weeklyReportsEnabled ?? false);
      setSettingsInitialized(true);
    }
  }, [orbitData, settingsInitialized]);
  
  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: {
      customTitle?: string;
      sourceUrl?: string;
      aiIndexingEnabled?: boolean;
      autoUpdateKnowledge?: boolean;
      aiAccuracyAlertsEnabled?: boolean;
      weeklyReportsEnabled?: boolean;
    }) => {
      const response = await fetch(`/api/orbit/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save settings');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Your changes have been saved." });
      queryClient.invalidateQueries({ queryKey: ["orbit-meta", slug] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      customTitle: businessName || undefined,
      sourceUrl: websiteUrl || undefined,
      aiIndexingEnabled,
      autoUpdateKnowledge,
      aiAccuracyAlertsEnabled,
      weeklyReportsEnabled,
    });
  };
  
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
      queryClient.invalidateQueries({ queryKey: ["orbit-meta", slug] });
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
      queryClient.invalidateQueries({ queryKey: ["orbit-meta", slug] });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const recalculateStrengthMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/recalculate-strength`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to recalculate');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Strength updated", 
        description: `Score: ${data.strengthScore}/100 (${data.documentsWithText} docs, ${data.sourcesCount} sources)` 
      });
      queryClient.invalidateQueries({ queryKey: ["orbit-meta", slug] });
    },
    onError: () => {
      toast({ title: "Recalculation failed", variant: "destructive" });
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

  // Video Library
  interface OrbitVideo {
    id: number;
    title: string;
    youtubeUrl: string;
    thumbnailUrl?: string;
    tags: string[];
    enabled: boolean;
  }

  const { data: videosData, refetch: refetchVideos } = useQuery<{ videos: OrbitVideo[] }>({
    queryKey: ["orbit-videos", slug],
    queryFn: async () => {
      if (!slug) return { videos: [] };
      const response = await fetch(`/api/orbit/${slug}/videos`, { credentials: "include" });
      if (!response.ok) return { videos: [] };
      return response.json();
    },
    enabled: !!slug,
  });

  const videos = videosData?.videos || [];

  const addVideoMutation = useMutation({
    mutationFn: async (data: { youtubeUrl: string; title?: string; tags?: string[] }) => {
      const response = await fetch(`/api/orbit/${slug}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add video');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Video added", description: "Video is now available in chat" });
      setShowAddModal(false);
      setVideoUrl('');
      setVideoTitle('');
      setVideoTags('');
      refetchVideos();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: number) => {
      const response = await fetch(`/api/orbit/${slug}/videos/${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Video removed" });
      refetchVideos();
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handleAddVideo = () => {
    if (!videoUrl.trim()) return;
    const tags = videoTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    addVideoMutation.mutate({
      youtubeUrl: videoUrl.trim(),
      title: videoTitle.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleAddHeroPost = () => {
    if (!heroPostUrl.trim()) return;
    addHeroPostMutation.mutate({ 
      url: heroPostUrl.trim(), 
      text: heroPostText.trim() || undefined 
    });
  };

  const { data: brandVoiceData, refetch: refetchBrandVoice } = useQuery<BrandVoiceData>({
    queryKey: ["brand-voice", slug],
    queryFn: async () => {
      if (!slug) return { brandVoiceSummary: null, voiceTraits: [], audienceNotes: null, toneGuidance: null, brandVoiceUpdatedAt: null, heroPosts: [], readyPostCount: 0 };
      const response = await fetch(`/api/orbit/${slug}/brand-voice`, { credentials: "include" });
      if (!response.ok) return { brandVoiceSummary: null, voiceTraits: [], audienceNotes: null, toneGuidance: null, brandVoiceUpdatedAt: null, heroPosts: [], readyPostCount: 0 };
      return response.json();
    },
    enabled: !!slug,
  });

  const rebuildBrandVoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/brand-voice/rebuild`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze brand voice');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Brand voice analyzed", description: "Your tone of voice profile has been updated" });
      refetchBrandVoice();
    },
    onError: (error: Error) => {
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
    },
  });

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
          <h1 className="text-xl md:text-2xl font-bold text-foreground" data-testid="text-settings-title">
            Strengthen Your Orbit
          </h1>
          <p className="text-muted-foreground text-sm">
            Add sources to make your Orbit smarter and more helpful
          </p>
        </div>

        <div className="space-y-6">
          {/* Knowledge Sources Section */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-sources">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Knowledge Sources</h2>
                  <p className="text-xs text-muted-foreground">Pages and links that power your Orbit</p>
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
            <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Orbit Strength</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{strengthScore}/100</span>
                  <button
                    onClick={() => recalculateStrengthMutation.mutate()}
                    disabled={recalculateStrengthMutation.isPending}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Recalculate strength"
                    data-testid="button-recalculate-strength"
                  >
                    <RefreshCw className={`w-3 h-3 ${recalculateStrengthMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <Progress value={strengthScore} className="h-1.5" />
              <p className="text-xs text-muted-foreground/70 mt-2">
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
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <span className="text-sm text-foreground/80 block">{getSourceLabel(source.label)}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block">{source.value}</span>
                        </div>
                      </div>
                      {(source.sourceType === 'page_url' || source.sourceType === 'social_link') && (
                        <a
                          href={source.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-lg bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-dashed border-border text-center mb-4">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-sm text-foreground/70 mb-1">No sources added yet</p>
                <p className="text-xs text-muted-foreground">Add your website, social channels, and pages to power up your Orbit</p>
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

          {/* Hidden file input for document uploads */}
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

          {/* Document List - Only show if documents exist */}
          {documents.length > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-documents">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-foreground/80">Uploaded Documents</span>
                </div>
                <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                  {documents.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border"
                    data-testid={`document-${doc.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-foreground/70 truncate">{doc.title || doc.fileName}</span>
                      {doc.status === 'processing' && (
                        <Loader2 className="w-3 h-3 text-purple-400 animate-spin flex-shrink-0" />
                      )}
                      {doc.status === 'ready' && (
                        <span className="text-xs text-green-400 flex-shrink-0">✓</span>
                      )}
                      {doc.status === 'error' && (
                        <span className="text-xs text-red-400 flex-shrink-0">!</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/50 hover:text-red-400 flex-shrink-0"
                      onClick={() => {
                        if (confirm('Delete this document?')) {
                          deleteDocumentMutation.mutate(doc.id);
                        }
                      }}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Library - Only show if videos exist */}
          {videos.length > 0 && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-videos">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-foreground/80">Video Library</span>
                </div>
                <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                  {videos.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border"
                    data-testid={`video-${video.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {video.thumbnailUrl && (
                        <img 
                          src={video.thumbnailUrl} 
                          alt="" 
                          className="w-10 h-6 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <span className="text-sm text-foreground/70 truncate">{video.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/50 hover:text-red-400 flex-shrink-0"
                      onClick={() => {
                        if (confirm('Remove this video?')) {
                          deleteVideoMutation.mutate(video.id);
                        }
                      }}
                      data-testid={`button-delete-video-${video.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tone of Voice Section */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-tone-of-voice">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Tone of Voice</h2>
                  <p className="text-xs text-muted-foreground">How Orbit speaks for your brand</p>
                </div>
              </div>
              {(brandVoiceData?.heroPosts?.length ?? 0) > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => rebuildBrandVoiceMutation.mutate()}
                  disabled={rebuildBrandVoiceMutation.isPending || (brandVoiceData?.readyPostCount ?? 0) === 0}
                  className="text-purple-400 hover:text-purple-300"
                  data-testid="button-rebuild-voice"
                >
                  {rebuildBrandVoiceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Show hero posts */}
            {(brandVoiceData?.heroPosts?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Hero Posts</span>
                  <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                    {brandVoiceData?.heroPosts.length}
                  </Badge>
                </div>
                <div className="space-y-2 mb-4">
                  {brandVoiceData?.heroPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border"
                      data-testid={`hero-post-${post.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-purple-400 uppercase">{post.platform}</span>
                        <span className="text-sm text-foreground/70 truncate">{post.title || post.url}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {post.status === 'pending' || post.status === 'enriching' ? (
                          <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                        ) : post.status === 'ready' ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <span className="text-xs text-amber-400">needs text</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Brand Voice Analysis */}
                {brandVoiceData?.brandVoiceSummary ? (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {brandVoiceData.brandVoiceSummary}
                    </p>
                    
                    {brandVoiceData.voiceTraits && brandVoiceData.voiceTraits.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {brandVoiceData.voiceTraits.map((trait, i) => (
                          <Badge key={i} variant="outline" className="text-xs border-purple-500/30 text-purple-300 bg-purple-500/10">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {brandVoiceData.brandVoiceUpdatedAt && (
                      <p className="text-xs text-muted-foreground/50">
                        Last analyzed: {new Date(brandVoiceData.brandVoiceUpdatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (brandVoiceData?.readyPostCount ?? 0) > 0 ? (
                  <div className="pt-3 border-t border-border">
                    <Button
                      onClick={() => rebuildBrandVoiceMutation.mutate()}
                      disabled={rebuildBrandVoiceMutation.isPending}
                      className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                      data-testid="button-analyze-voice"
                    >
                      {rebuildBrandVoiceMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze Brand Voice
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/70 pt-3 border-t border-border">
                    Waiting for hero posts to be processed...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Add hero posts to train your brand voice
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAddModal(true); setModalTab('hero'); }}
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  data-testid="button-add-first-hero"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Hero Post
                </Button>
              </div>
            )}
          </div>

          {/* Value Proposition for Free Users */}
          {orbitData?.planTier === 'free' && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Why add sources?</h3>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Smarter AI responses about your business</li>
                    <li>• Visitors get accurate, helpful information</li>
                    <li>• Build trust with comprehensive knowledge</li>
                  </ul>
                  <p className="text-xs text-pink-400 mt-2">Upgrade to unlock automatic source updates and document uploads</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-business">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Business Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Business Name</label>
                <Input
                  placeholder="Your Business Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="bg-muted/50 border-border"
                  data-testid="input-business-name"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Website</label>
                <Input
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="bg-muted/50 border-border"
                  data-testid="input-website"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-ai">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">AI Discovery Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Allow AI Indexing</p>
                  <p className="text-xs text-muted-foreground">Let AI systems discover your business</p>
                </div>
                <Switch 
                  checked={aiIndexingEnabled} 
                  onCheckedChange={setAiIndexingEnabled}
                  data-testid="toggle-ai-indexing" 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Auto-Update Knowledge</p>
                  <p className="text-xs text-muted-foreground">Automatically sync changes to AI systems</p>
                </div>
                <Switch 
                  checked={autoUpdateKnowledge} 
                  onCheckedChange={setAutoUpdateKnowledge}
                  data-testid="toggle-auto-update" 
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-muted/50 border border-border" data-testid="section-notifications">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">AI Accuracy Alerts</span>
                <Switch 
                  checked={aiAccuracyAlertsEnabled} 
                  onCheckedChange={setAiAccuracyAlertsEnabled}
                  data-testid="toggle-accuracy-alerts" 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground/70">Weekly Reports</span>
                <Switch 
                  checked={weeklyReportsEnabled} 
                  onCheckedChange={setWeeklyReportsEnabled}
                  data-testid="toggle-weekly-reports" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600" 
            data-testid="button-save-settings"
          >
            {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
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
          setVideoUrl('');
          setVideoTitle('');
          setVideoTags('');
          setModalTab('links');
        }
      }}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Power Up Your Orbit</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add knowledge sources to make your Orbit smarter
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'links' | 'hero' | 'docs' | 'videos')} className="mt-2">
            <TabsList className="grid w-full grid-cols-4 bg-zinc-800">
              <TabsTrigger value="links" className="data-[state=active]:bg-blue-600 text-xs px-2" data-testid="tab-links">
                <Link2 className="w-3 h-3 mr-1" />
                Links
              </TabsTrigger>
              <TabsTrigger value="hero" className="data-[state=active]:bg-purple-600 text-xs px-2" data-testid="tab-hero">
                <Sparkles className="w-3 h-3 mr-1" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="docs" className="data-[state=active]:bg-pink-600 text-xs px-2" data-testid="tab-docs">
                <File className="w-3 h-3 mr-1" />
                Docs
              </TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-red-600 text-xs px-2" data-testid="tab-videos">
                <Play className="w-3 h-3 mr-1" />
                Videos
              </TabsTrigger>
            </TabsList>

            {/* Links Tab */}
            <TabsContent value="links" className="space-y-4 mt-4">
              <div>
                <Label className="text-muted-foreground mb-2 block">Source Type</Label>
                <Select value={selectedSourceType} onValueChange={(v) => setSelectedSourceType(v as SourceLabel)}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="Select a source type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {availableOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="focus:bg-muted"
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
                <Label className="text-muted-foreground mb-2 block">URL</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-muted/50 border-border"
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
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-xs text-purple-300 mb-1 font-medium">Brand Voice Training</p>
                <p className="text-xs text-muted-foreground">
                  Hero Posts teach Orbit your brand voice and content style. They don't add to your strength score - that comes from factual sources like documents and links.
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">Post URL</Label>
                <Input
                  value={heroPostUrl}
                  onChange={(e) => setHeroPostUrl(e.target.value)}
                  placeholder="https://linkedin.com/posts/... or https://x.com/..."
                  className="bg-muted/50 border-border"
                  data-testid="input-hero-url"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">Post Text (optional)</Label>
                <Textarea
                  value={heroPostText}
                  onChange={(e) => setHeroPostText(e.target.value)}
                  placeholder="Paste the post content here if the URL doesn't work..."
                  className="bg-muted/50 border-border min-h-[80px]"
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
              <p className="text-xs text-muted-foreground">
                Upload documents to enhance your Orbit's knowledge. Choose a category so the AI knows when to use it.
              </p>
              
              <div>
                <Label className="text-muted-foreground mb-2 block">Document Category</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger className="bg-muted/50 border-border" data-testid="select-doc-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem 
                        key={cat.value} 
                        value={cat.value}
                        className="focus:bg-muted"
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
                <p className="text-sm text-foreground/70 mb-1">Click to upload</p>
                <p className="text-xs text-muted-foreground/70">PDF, PPT, PPTX, DOC, DOCX, TXT, MD (max 25MB)</p>
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

            {/* Videos Tab */}
            <TabsContent value="videos" className="space-y-4 mt-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-300 mb-1 font-medium">Video Library</p>
                <p className="text-xs text-muted-foreground">
                  Add YouTube videos that your Orbit can suggest to visitors when relevant.
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">YouTube URL</Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="bg-muted/50 border-border"
                  data-testid="input-video-url"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">Title (optional)</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Leave blank to auto-detect from YouTube"
                  className="bg-muted/50 border-border"
                  data-testid="input-video-title"
                />
              </div>
              <div>
                <Label className="text-muted-foreground mb-2 block">Tags (optional)</Label>
                <Input
                  value={videoTags}
                  onChange={(e) => setVideoTags(e.target.value)}
                  placeholder="pricing, demo, tutorial (comma separated)"
                  className="bg-muted/50 border-border"
                  data-testid="input-video-tags"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Tags help Orbit know when to suggest this video
                </p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                onClick={handleAddVideo}
                disabled={!videoUrl.trim() || addVideoMutation.isPending}
                data-testid="button-confirm-add-video"
              >
                {addVideoMutation.isPending ? "Adding..." : "Add Video"}
              </Button>
              {videos.length > 0 && (
                <div className="text-xs text-zinc-500">
                  {videos.length} video{videos.length !== 1 ? 's' : ''} in library
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </OrbitLayout>
  );
}
