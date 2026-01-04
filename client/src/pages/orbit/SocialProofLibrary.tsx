import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { 
  ArrowLeft,
  Quote,
  Check,
  X,
  AlertCircle,
  Clock,
  Star,
  Copy,
  Download,
  Trash2,
  Filter,
  Settings,
  MessageCircle,
  Archive,
  ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import GlobalNav from "@/components/GlobalNav";
import { useToast } from "@/hooks/use-toast";

interface SocialProofItem {
  id: number;
  businessSlug: string;
  conversationId: number | null;
  rawQuoteText: string;
  cleanQuoteText: string | null;
  topic: string;
  sentimentScore: number;
  specificityScore: number;
  consentStatus: 'pending' | 'granted' | 'declined';
  consentType: 'name_town' | 'anonymous' | null;
  attributionName: string | null;
  attributionTown: string | null;
  status: 'draft' | 'approved' | 'exported' | 'archived';
  generatedVariants: { short: string; medium: string; long: string } | null;
  recommendedPlacements: string[] | null;
  createdAt: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'exported': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'archived': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

function getConsentColor(status: string) {
  switch (status) {
    case 'granted': return 'bg-green-500/20 text-green-400';
    case 'pending': return 'bg-yellow-500/20 text-yellow-400';
    case 'declined': return 'bg-red-500/20 text-red-400';
    default: return 'bg-zinc-500/20 text-zinc-400';
  }
}

function getTopicLabel(topic: string) {
  const labels: Record<string, string> = {
    service: 'Service',
    delivery: 'Delivery',
    quality: 'Quality',
    value: 'Value',
    staff: 'Staff',
    product: 'Product',
    other: 'Other'
  };
  return labels[topic] || topic;
}

function ProofCard({ 
  item, 
  onEdit, 
  onApprove, 
  onArchive, 
  onExport, 
  onDelete 
}: { 
  item: SocialProofItem;
  onEdit: (item: SocialProofItem) => void;
  onApprove: (id: number) => void;
  onArchive: (id: number) => void;
  onExport: (id: number, format: string) => void;
  onDelete: (id: number) => void;
}) {
  const displayQuote = item.cleanQuoteText || item.rawQuoteText;
  const variants = item.generatedVariants;
  
  return (
    <div 
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
      data-testid={`proof-card-${item.id}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-pink-400" />
          <Badge className={`${getStatusColor(item.status)} border text-xs`}>
            {item.status}
          </Badge>
          <Badge className={`${getConsentColor(item.consentStatus)} text-xs`}>
            {item.consentStatus === 'granted' ? (
              <><Check className="w-3 h-3 mr-1" />Consent</>
            ) : item.consentStatus === 'pending' ? (
              <><Clock className="w-3 h-3 mr-1" />Pending</>
            ) : (
              <><X className="w-3 h-3 mr-1" />Declined</>
            )}
          </Badge>
          <Badge variant="outline" className="text-xs text-zinc-400">
            {getTopicLabel(item.topic)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {item.consentStatus === 'granted' && item.status !== 'archived' && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onExport(item.id, 'website')}
              data-testid={`button-export-${item.id}`}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onEdit(item)}
            data-testid={`button-edit-${item.id}`}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => onDelete(item.id)}
            data-testid={`button-delete-${item.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <blockquote className="text-white text-sm leading-relaxed mb-4 italic">
        "{displayQuote}"
      </blockquote>
      
      {item.consentType === 'name_town' && item.attributionName && (
        <p className="text-zinc-400 text-xs mb-3">
          — {item.attributionName}{item.attributionTown ? `, ${item.attributionTown}` : ''}
        </p>
      )}
      
      {variants && (
        <div className="border-t border-zinc-800 pt-4 mt-4">
          <p className="text-xs text-zinc-500 mb-2">Generated variants:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-14">Short:</span>
              <span className="text-xs text-zinc-400 truncate">{variants.short}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-14">Medium:</span>
              <span className="text-xs text-zinc-400 truncate">{variants.medium}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Star className="w-3 h-3" />
          <span>Specificity: {Math.round((item.specificityScore || 0) * 100)}%</span>
          <span className="text-zinc-700">|</span>
          <ThumbsUp className="w-3 h-3" />
          <span>Sentiment: {Math.round((item.sentimentScore || 0) * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          {item.status === 'draft' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onApprove(item.id)}
              data-testid={`button-approve-${item.id}`}
            >
              <Check className="w-3 h-3 mr-1" /> Approve
            </Button>
          )}
          {item.status !== 'archived' && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => onArchive(item.id)}
              data-testid={`button-archive-${item.id}`}
            >
              <Archive className="w-3 h-3 mr-1" /> Archive
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditDialog({ 
  item, 
  open, 
  onClose, 
  onSave 
}: { 
  item: SocialProofItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, data: any) => void;
}) {
  const [cleanQuote, setCleanQuote] = useState('');
  const [consentStatus, setConsentStatus] = useState<string>('pending');
  const [consentType, setConsentType] = useState<string>('');
  const [attrName, setAttrName] = useState('');
  const [attrTown, setAttrTown] = useState('');
  const [topic, setTopic] = useState('other');
  
  useEffect(() => {
    if (item) {
      setCleanQuote(item.cleanQuoteText || item.rawQuoteText || '');
      setConsentStatus(item.consentStatus || 'pending');
      setConsentType(item.consentType || '');
      setAttrName(item.attributionName || '');
      setAttrTown(item.attributionTown || '');
      setTopic(item.topic || 'other');
    }
  }, [item?.id]);
  
  if (!item) return null;
  
  const handleSave = () => {
    onSave(item.id, {
      cleanQuoteText: cleanQuote,
      consentStatus,
      consentType: consentType || null,
      attributionName: attrName || null,
      attributionTown: attrTown || null,
      topic
    });
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Testimonial</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Refine the quote and manage consent
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Clean Quote</label>
            <Textarea 
              value={cleanQuote}
              onChange={(e) => setCleanQuote(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
              placeholder="Edit the testimonial text..."
              data-testid="input-clean-quote"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Consent Status</label>
              <Select value={consentStatus} onValueChange={setConsentStatus}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" data-testid="select-consent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="granted">Granted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Topic</label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" data-testid="select-topic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {consentStatus === 'granted' && (
            <>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Attribution Type</label>
                <Select value={consentType} onValueChange={setConsentType}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" data-testid="select-consent-type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_town">Name + Town</SelectItem>
                    <SelectItem value="anonymous">Anonymous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {consentType === 'name_town' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Name</label>
                    <Input 
                      value={attrName}
                      onChange={(e) => setAttrName(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      placeholder="John"
                      data-testid="input-attr-name"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Town</label>
                    <Input 
                      value={attrTown}
                      onChange={(e) => setAttrTown(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      placeholder="Manchester"
                      data-testid="input-attr-town"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-edit">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SocialProofLibrary() {
  const [, params] = useRoute("/orbit/:slug/proof");
  const slug = params?.slug;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'pending' | 'archived'>('all');
  const [editItem, setEditItem] = useState<SocialProofItem | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>('');
  
  const { data, isLoading, error } = useQuery<{ items: SocialProofItem[]; total: number }>({
    queryKey: ["social-proof", slug, activeTab, filterTopic],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab === 'approved') params.set('status', 'approved');
      if (activeTab === 'pending') params.set('consentStatus', 'pending');
      if (activeTab === 'archived') params.set('status', 'archived');
      if (filterTopic) params.set('topic', filterTopic);
      
      const response = await fetch(`/api/orbit/${slug}/social-proof?${params}`);
      if (!response.ok) throw new Error("Failed to load social proof");
      return response.json();
    },
    enabled: !!slug,
  });
  
  const { data: settings } = useQuery<{ proofCaptureEnabled: boolean }>({
    queryKey: ["social-proof-settings", slug],
    queryFn: async () => {
      const response = await fetch(`/api/orbit/${slug}/social-proof/settings`);
      if (!response.ok) throw new Error("Failed to load settings");
      return response.json();
    },
    enabled: !!slug,
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/orbit/${slug}/social-proof/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-proof", slug] });
      toast({ title: "Updated successfully" });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/orbit/${slug}/social-proof/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-proof", slug] });
      toast({ title: "Deleted successfully" });
    }
  });
  
  const exportMutation = useMutation({
    mutationFn: async ({ id, format }: { id: number; format: string }) => {
      const response = await fetch(`/api/orbit/${slug}/social-proof/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
        credentials: 'include'
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to export");
      }
      return response.json();
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(JSON.stringify(data.export, null, 2));
      toast({ title: "Copied to clipboard", description: "Export data copied to clipboard" });
    },
    onError: (err: any) => {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  });
  
  const settingsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch(`/api/orbit/${slug}/social-proof/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofCaptureEnabled: enabled }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-proof-settings", slug] });
      toast({ title: "Settings updated" });
    }
  });
  
  const handleApprove = (id: number) => {
    updateMutation.mutate({ id, data: { status: 'approved' } });
  };
  
  const handleArchive = (id: number) => {
    updateMutation.mutate({ id, data: { status: 'archived' } });
  };
  
  const handleEdit = (item: SocialProofItem) => {
    setEditItem(item);
  };
  
  const handleSaveEdit = (id: number, data: any) => {
    updateMutation.mutate({ id, data });
  };
  
  const handleExport = (id: number, format: string) => {
    exportMutation.mutate({ id, format });
  };
  
  const handleDelete = (id: number) => {
    if (confirm("Delete this testimonial?")) {
      deleteMutation.mutate(id);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm mt-4">Loading testimonials...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-400 mb-4">Unable to load social proof library</p>
          <Button variant="outline" onClick={() => setLocation(`/orbit/${slug}`)}>
            Return to Orbit
          </Button>
        </div>
      </div>
    );
  }
  
  const items = data?.items || [];
  
  return (
    <div className="min-h-screen bg-black">
      <GlobalNav />
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation(`/orbit/${slug}/hub`)}
              data-testid="button-back-to-hub"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Hub
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
                <Quote className="w-6 h-6 text-pink-400" />
                Social Proof Library
              </h1>
              <p className="text-zinc-400 text-sm">Manage customer testimonials captured from conversations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Auto-capture</span>
              <Switch 
                checked={settings?.proofCaptureEnabled ?? true}
                onCheckedChange={(checked) => settingsMutation.mutate(checked)}
                data-testid="switch-auto-capture"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending Consent</TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Select value={filterTopic} onValueChange={setFilterTopic}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white" data-testid="filter-topic">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All topics</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="value">Value</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
            <h3 className="text-lg font-medium text-white mb-2">No testimonials yet</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              When customers share positive feedback in chat conversations, testimonials will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map(item => (
              <ProofCard 
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onApprove={handleApprove}
                onArchive={handleArchive}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        
        <EditDialog 
          item={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      </main>
    </div>
  );
}
