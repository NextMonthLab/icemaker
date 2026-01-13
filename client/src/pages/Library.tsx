import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Globe, Loader2, MoreHorizontal, Upload, PenLine, Sparkles, Copy, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import GlobalNav from "@/components/GlobalNav";
import { formatDistanceToNow } from "date-fns";

type LibraryTab = "drafts" | "published";

interface IcePreview {
  id: string;
  title: string;
  cards: { id: string; title: string; content: string; order: number }[];
  status: string;
  visibility?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function Library() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("drafts");
  const [showNewIceModal, setShowNewIceModal] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: previewsData, isLoading } = useQuery({
    queryKey: ["/api/ice/my-previews"],
    queryFn: async () => {
      const res = await fetch("/api/ice/my-previews", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch previews");
      return res.json() as Promise<{ previews: IcePreview[] }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ice/preview/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ice/my-previews"] });
      toast({ title: "Deleted", description: "The experience has been deleted." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleDuplicate = (preview: IcePreview) => {
    toast({ title: "Coming soon", description: "Duplicate functionality will be available soon." });
  };

  const previews = previewsData?.previews || [];
  const drafts = previews.filter(p => p.visibility !== "public");
  const published = previews.filter(p => p.visibility === "public");

  const tabs: { id: LibraryTab; label: string; count: number }[] = [
    { id: "drafts", label: "Drafts", count: drafts.length },
    { id: "published", label: "Published", count: published.length },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GlobalNav context="ice" />
      
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-library-title">
              Library
            </h1>
            <p className="text-white/60 text-sm">
              Your drafts and published experiences
            </p>
          </div>
          <Button 
            onClick={() => setShowNewIceModal(true)}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-2" 
            data-testid="button-new-ice"
          >
            <Plus className="w-4 h-4" />
            New ICE
          </Button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
              <Badge variant="outline" className="border-white/20 text-white/50 text-xs px-1.5 py-0">
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-white/50 mt-4">Loading your library...</p>
          </div>
        )}

        {!isLoading && activeTab === "drafts" && drafts.length === 0 && (
          <EmptyDraftsState onNewIce={() => setShowNewIceModal(true)} />
        )}

        {!isLoading && activeTab === "drafts" && drafts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drafts.map((preview) => (
              <IceCard 
                key={preview.id} 
                preview={preview} 
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}

        {!isLoading && activeTab === "published" && published.length === 0 && (
          <EmptyPublishedState onGoToDrafts={() => setActiveTab("drafts")} />
        )}

        {!isLoading && activeTab === "published" && published.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {published.map((preview) => (
              <IceCard 
                key={preview.id} 
                preview={preview} 
                isPublished 
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </main>

      <NewIceModal 
        open={showNewIceModal} 
        onClose={() => setShowNewIceModal(false)}
        onCreateFromSource={() => {
          setShowNewIceModal(false);
          setLocation("/try");
        }}
        onStartFromScratch={() => {
          setShowNewIceModal(false);
          setLocation("/try?blank=true");
        }}
      />
    </div>
  );
}

function EmptyDraftsState({ onNewIce }: { onNewIce: () => void }) {
  const [, setLocation] = useLocation();
  
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
        <div className="relative">
          <FileText className="w-8 h-8 text-white/40" />
          <Sparkles className="w-4 h-4 text-cyan-400 absolute -top-1 -right-1" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2" data-testid="text-empty-drafts">
        Create your first ICE
      </h3>
      <p className="text-sm text-white/50 max-w-md mb-6">
        Turn a document, deck, or web page into an interactive experience in minutes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Button 
          onClick={() => setLocation("/try")}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-2" 
          data-testid="button-create-from-source"
        >
          <Upload className="w-4 h-4" />
          Create from source
        </Button>
        <Button 
          variant="outline" 
          className="border-white/20 text-white/70 hover:bg-white/5 gap-2"
          onClick={() => setLocation("/try?blank=true")}
          data-testid="button-start-from-scratch"
        >
          <PenLine className="w-4 h-4" />
          Start from scratch
        </Button>
      </div>
      <p className="text-xs text-white/40">
        Popular sources: onboarding packs, SOPs, policy updates, training notes.
      </p>
    </div>
  );
}

function EmptyPublishedState({ onGoToDrafts }: { onGoToDrafts: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6">
        <Globe className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2" data-testid="text-empty-published">
        Nothing published yet
      </h3>
      <p className="text-sm text-white/50 max-w-md mb-6">
        Publish an ICE to share it with your audience.
      </p>
      <Button 
        variant="outline" 
        className="border-white/20 text-white/70 hover:bg-white/5"
        onClick={onGoToDrafts}
        data-testid="button-go-to-drafts"
      >
        Go to Drafts
      </Button>
    </div>
  );
}

function NewIceModal({ 
  open, 
  onClose, 
  onCreateFromSource, 
  onStartFromScratch 
}: { 
  open: boolean; 
  onClose: () => void;
  onCreateFromSource: () => void;
  onStartFromScratch: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-black/95 border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">New ICE</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <button
            onClick={onCreateFromSource}
            className="w-full p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-left group"
            data-testid="option-create-from-source"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white">Create from source</p>
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-[10px]">
                    Recommended
                  </Badge>
                </div>
                <p className="text-sm text-white/50">
                  Upload file or paste link
                </p>
                <p className="text-xs text-white/30 mt-1">
                  PDFs, slides, documents, or a web page.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onStartFromScratch}
            className="w-full p-4 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all text-left"
            data-testid="option-start-from-scratch"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <PenLine className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1">Start from scratch</p>
                <p className="text-sm text-white/50">
                  Start blank ICE
                </p>
                <p className="text-xs text-white/30 mt-1">
                  Build your own scenes and interactions.
                </p>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IceCard({ 
  preview, 
  isPublished, 
  onDelete,
  onDuplicate 
}: { 
  preview: IcePreview; 
  isPublished?: boolean; 
  onDelete: (id: string) => void;
  onDuplicate: (preview: IcePreview) => void;
}) {
  const cardCount = preview.cards?.length || 0;
  const lastEdited = preview.updatedAt || preview.createdAt;
  const timeAgo = lastEdited ? formatDistanceToNow(new Date(lastEdited), { addSuffix: true }) : "";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const handleCardClick = () => {
    setLocation(`/ice/preview/${preview.id}`);
  };

  return (
    <div 
      className="bg-black/50 border border-white/10 rounded-xl p-4 hover:border-cyan-500/30 transition-all cursor-pointer group"
      onClick={handleCardClick}
      data-testid={`card-preview-${preview.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate group-hover:text-cyan-300 transition-colors" data-testid={`text-preview-title-${preview.id}`}>
            {preview.title || "Untitled"}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge 
              className={`text-[10px] px-1.5 py-0 ${
                isPublished 
                  ? "bg-green-500/20 text-green-400 border-0" 
                  : "bg-white/10 text-white/50 border-0"
              }`}
            >
              {isPublished ? "Published" : "Draft"}
            </Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-menu-${preview.id}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/ice/preview/${preview.id}`);
              }}
              className="cursor-pointer text-white/70 hover:text-white focus:text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(preview);
              }}
              className="cursor-pointer text-white/70 hover:text-white focus:text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {!isPublished && (
              <>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                  className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-white/40">
        {cardCount > 0 && <span>{cardCount} scenes</span>}
        {cardCount > 0 && timeAgo && <span>·</span>}
        {timeAgo && <span>Last edited {timeAgo}</span>}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-black border-white/10" onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this experience?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              "{preview.title || "Untitled"}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white/70 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(preview.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
