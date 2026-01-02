import { Badge } from "@/components/ui/badge";
import { FileText, Video, Link as LinkIcon } from "lucide-react";
import type { IceDraft } from "./IceBuilderPanel";

interface RecentStripProps {
  drafts: IceDraft[];
  onDraftClick?: (draft: IceDraft) => void;
}

export function RecentStrip({ drafts, onDraftClick }: RecentStripProps) {
  if (drafts.length === 0) {
    return (
      <div className="border-t border-white/10 py-4 px-6">
        <h3 className="text-sm font-medium text-white/60 mb-3">Recent</h3>
        <p className="text-sm text-white/40">
          Your recent drafts and published content will appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-t border-white/10 py-4 px-6"
      data-testid="recent-strip"
    >
      <h3 className="text-sm font-medium text-white/60 mb-3">Recent</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            onClick={() => onDraftClick?.(draft)}
            className="flex-shrink-0 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer transition-colors min-w-[240px]"
            data-testid={`recent-draft-${draft.id}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {draft.outputType === "video_card" ? (
                <Video className="w-4 h-4 text-purple-400" />
              ) : (
                <LinkIcon className="w-4 h-4 text-blue-400" />
              )}
              <span className="font-medium text-white truncate">
                {draft.headline}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  draft.status === "published"
                    ? "border-green-500/50 text-green-400"
                    : "border-amber-500/50 text-amber-400"
                }`}
              >
                {draft.status === "published" ? "Published" : "Draft"}
              </Badge>
              {draft.insightId && (
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Made from insight
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
