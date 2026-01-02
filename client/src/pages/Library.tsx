import { useState } from "react";
import { Link } from "wouter";
import { FolderOpen, Plus, Sparkles, FileText, Video, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GlobalNav from "@/components/GlobalNav";

type LibraryTab = "drafts" | "published" | "templates";

export default function Library() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("drafts");

  const tabs: { id: LibraryTab; label: string; count?: number }[] = [
    { id: "drafts", label: "Drafts", count: 0 },
    { id: "published", label: "Published", count: 0 },
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

        {activeTab === "drafts" && (
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

        {activeTab === "published" && (
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
