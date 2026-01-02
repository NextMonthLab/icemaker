import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Plus, Sparkles, FileText, Video, Globe, Eye, Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GlobalNav from "@/components/GlobalNav";
import { format } from "date-fns";

type LibraryTab = "drafts" | "published" | "templates";

interface IcePreview {
  id: string;
  title: string;
  cards: { id: string; title: string; content: string; order: number }[];
  status: string;
  visibility?: string;
  createdAt: string;
}

export default function Library() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("drafts");

  const { data: previewsData, isLoading } = useQuery({
    queryKey: ["/api/ice/my-previews"],
    queryFn: async () => {
      const res = await fetch("/api/ice/my-previews", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch previews");
      return res.json() as Promise<{ previews: IcePreview[] }>;
    },
  });

  const previews = previewsData?.previews || [];
  const drafts = previews.filter(p => p.visibility !== "public");
  const published = previews.filter(p => p.visibility === "public");

  const tabs: { id: LibraryTab; label: string; count?: number }[] = [
    { id: "drafts", label: "Drafts", count: drafts.length },
    { id: "published", label: "Published", count: published.length },
    { id: "templates", label: "Templates" },
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
              Your drafts, published experiences, and templates
            </p>
          </div>
          <Link href="/launchpad">
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2" 
              data-testid="button-new-ice"
            >
              <Plus className="w-4 h-4" />
              New Ice
            </Button>
          </Link>
        </div>

        <div className="flex gap-2 mb-6 border-b border-white/10 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <Badge variant="outline" className="border-white/20 text-white/50 text-xs px-1.5 py-0">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-white/50 mt-4">Loading your library...</p>
          </div>
        )}

        {!isLoading && activeTab === "drafts" && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2" data-testid="text-empty-drafts">
              Your Library is empty
            </h3>
            <p className="text-sm text-white/50 max-w-sm mb-6">
              Drafts and published experiences will appear here. Start by making an Ice from an insight.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/launchpad">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2" 
                  data-testid="button-make-ice-from-insight"
                >
                  <Sparkles className="w-4 h-4" />
                  Make Ice from Insight
                </Button>
              </Link>
              <Link href="/try">
                <Button 
                  variant="outline" 
                  className="border-white/20 text-white/70 hover:bg-white/5 gap-2"
                  data-testid="button-create-from-scratch"
                >
                  <Plus className="w-4 h-4" />
                  Create from scratch
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!isLoading && activeTab === "drafts" && drafts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drafts.map((preview) => (
              <PreviewCard key={preview.id} preview={preview} />
            ))}
          </div>
        )}

        {!isLoading && activeTab === "published" && published.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2" data-testid="text-empty-published">
              No published experiences yet
            </h3>
            <p className="text-sm text-white/50 max-w-sm mb-6">
              When you publish an Ice, it will appear here for easy management.
            </p>
          </div>
        )}

        {!isLoading && activeTab === "published" && published.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {published.map((preview) => (
              <PreviewCard key={preview.id} preview={preview} isPublished />
            ))}
          </div>
        )}

        {activeTab === "templates" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4">
              <Video className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2" data-testid="text-empty-templates">
              Templates coming soon
            </h3>
            <p className="text-sm text-white/50 max-w-sm">
              Pre-built templates will be available here to help you create faster.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function PreviewCard({ preview, isPublished }: { preview: IcePreview; isPublished?: boolean }) {
  const cardCount = preview.cards?.length || 0;
  const createdDate = preview.createdAt ? format(new Date(preview.createdAt), "MMM d, yyyy") : "";
  
  return (
    <div 
      className="bg-black border border-blue-500/30 rounded-xl p-4 hover:border-blue-500/50 transition-all group"
      data-testid={`card-preview-${preview.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate" data-testid={`text-preview-title-${preview.id}`}>
            {preview.title || "Untitled"}
          </h3>
          <p className="text-white/50 text-xs mt-1">
            {cardCount} cards · {createdDate}
          </p>
        </div>
        {isPublished && (
          <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
            Live
          </Badge>
        )}
      </div>
      
      <div className="flex gap-2 mt-4">
        <Link href={`/ice/preview/${preview.id}`} className="flex-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full border-white/20 text-white/70 hover:bg-white/5 gap-1.5"
            data-testid={`button-edit-${preview.id}`}
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </Button>
        </Link>
        <Link href={`/ice/live/${preview.id}`}>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10 gap-1.5"
            data-testid={`button-view-${preview.id}`}
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Button>
        </Link>
      </div>
    </div>
  );
}
