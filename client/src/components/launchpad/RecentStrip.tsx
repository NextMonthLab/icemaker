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
      <div className="border-t border-border py-4 px-6" data-testid="recent-strip-empty">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 p-4 rounded-lg bg-muted/20 border border-dashed border-border min-w-[200px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded bg-muted" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-12 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t border-border py-4 px-6"
      data-testid="recent-strip"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            onClick={() => onDraftClick?.(draft)}
            className="flex-shrink-0 p-4 rounded-lg bg-muted/50 border border-border hover:border-border/80 cursor-pointer transition-colors min-w-[240px]"
            data-testid={`recent-draft-${draft.id}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {draft.outputType === "video_card" ? (
                <Video className="w-4 h-4 text-purple-500" />
              ) : (
                <LinkIcon className="w-4 h-4 text-blue-500" />
              )}
              <span className="font-medium text-foreground truncate">
                {draft.headline}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  draft.status === "published"
                    ? "border-green-500/50 text-green-500"
                    : "border-amber-500/50 text-amber-500"
                }`}
              >
                {draft.status === "published" ? "Published" : "Draft"}
              </Badge>
              {draft.insightId && (
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
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
