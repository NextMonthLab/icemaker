import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ThumbsUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: number;
  displayName: string;
  body: string;
  createdAt: string;
  reactions: Record<string, number>;
  reactionCount: number;
}

interface MessageBoardProps {
  cardId: number | string;
  compact?: boolean;
}

export default function MessageBoard({ cardId, compact = true }: MessageBoardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [displayName, setDisplayName] = useState(() => 
    localStorage.getItem("storyflix_display_name") || ""
  );
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["card-messages", cardId],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json() as Promise<Message[]>;
    },
  });

  const postMutation = useMutation({
    mutationFn: async ({ body, displayName }: { body: string; displayName: string }) => {
      localStorage.setItem("storyflix_display_name", displayName);
      const response = await fetch(`/api/cards/${cardId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, displayName }),
      });
      if (!response.ok) throw new Error("Failed to post message");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-messages", cardId] });
      setNewMessage("");
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const response = await fetch(`/api/cards/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: "like" }),
      });
      if (!response.ok) throw new Error("Failed to add reaction");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-messages", cardId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !displayName.trim()) return;
    postMutation.mutate({ body: newMessage.trim(), displayName: displayName.trim() });
  };

  const displayedMessages = compact && !isExpanded ? messages.slice(0, 3) : messages;

  if (compact && !isExpanded) {
    return (
      <div className="mt-4">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
          data-testid="button-expand-messages"
        >
          <div className="flex items-center gap-2 text-white/70">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">
              {messages.length > 0 
                ? `${messages.length} message${messages.length !== 1 ? 's' : ''} from viewers`
                : "Be the first to comment"}
            </span>
          </div>
          {messages.length > 0 && (
            <span className="text-xs text-primary bg-primary/20 px-2 py-0.5 rounded-full">
              Join
            </span>
          )}
        </button>
        
        {messages.length > 0 && (
          <div className="mt-2 space-y-1">
            {messages.slice(0, 2).map((msg) => (
              <div key={msg.id} className="text-xs text-white/50 truncate px-1">
                <span className="text-white/70">{msg.displayName}:</span> {msg.body}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-4 bg-white/5 rounded-xl border border-white/10 overflow-hidden"
    >
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Viewer Messages</span>
          <span className="text-xs text-white/50">({messages.length})</span>
        </div>
        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-white/50 hover:text-white"
          >
            Close
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : displayedMessages.length > 0 ? (
          <AnimatePresence>
            {displayedMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-white/80">{msg.displayName}</span>
                    <span className="text-[10px] text-white/30">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-white/60 break-words">{msg.body}</p>
                </div>
                <button
                  onClick={() => reactionMutation.mutate(msg.id)}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-primary transition-colors p-1"
                  data-testid={`button-like-${msg.id}`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  {msg.reactions?.like || 0}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <p className="text-sm text-white/40 text-center py-2">No messages yet. Be the first!</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 space-y-2">
        <div className="flex gap-2">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            className="h-9 text-sm bg-white/5 border-white/10 w-24 shrink-0"
            data-testid="input-display-name"
          />
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Share your thoughts..."
            maxLength={280}
            className="h-9 text-sm bg-white/5 border-white/10 flex-1"
            data-testid="input-message"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newMessage.trim() || !displayName.trim() || postMutation.isPending}
            className="h-9 px-3"
            data-testid="button-send-message"
          >
            {postMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-white/30 text-right">{newMessage.length}/280</p>
      </form>
    </motion.div>
  );
}
