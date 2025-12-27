import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Clock, Sparkles, Archive, MessageCircle, X, ExternalLink, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PreviewExperienceOrchestrator } from "@/components/preview/PreviewExperienceOrchestrator";

interface SiteIdentity {
  sourceDomain: string;
  title: string | null;
  heroHeadline: string | null;
  heroDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  primaryColour: string;
  serviceHeadings: string[];
  serviceBullets: string[];
  faqCandidates: string[];
  extractedAt: string;
}

interface PreviewInstance {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'active' | 'archived' | 'claimed';
  siteTitle: string | null;
  siteSummary: string | null;
  keyServices: string[] | null;
  siteIdentity: SiteIdentity | null;
  messageCount: number;
  maxMessages: number;
  expiresAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

function BrandHeader({ 
  preview, 
  timeRemaining 
}: { 
  preview: PreviewInstance; 
  timeRemaining: string;
}) {
  const identity = preview.siteIdentity;
  const primaryColour = identity?.primaryColour || '#7c3aed';
  
  const logoSrc = identity?.logoUrl || identity?.faviconUrl;
  const showMonogram = !logoSrc;
  const monogramLetter = (preview.sourceDomain || 'S')[0].toUpperCase();
  
  return (
    <div className="p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {showMonogram ? (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: primaryColour }}
            >
              {monogramLetter}
            </div>
          ) : (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 shadow-sm"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${primaryColour} 15%, #1a1a1a)`,
                border: `1px solid color-mix(in srgb, ${primaryColour} 30%, transparent)`
              }}
            >
              <img 
                src={logoSrc!} 
                alt={preview.sourceDomain}
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate" data-testid="text-site-title">
              {identity?.heroHeadline || preview.siteTitle || preview.sourceDomain}
            </h1>
            <p className="text-xs text-muted-foreground">{preview.sourceDomain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Sparkles className="w-3 h-3" />
          <span className="text-xs font-medium">Preview</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Expires in {timeRemaining} unless claimed</span>
      </div>
    </div>
  );
}

function MiniSiteScaffold({ 
  preview,
  onAskQuestion 
}: { 
  preview: PreviewInstance;
  onAskQuestion: (question: string) => void;
}) {
  const identity = preview.siteIdentity;
  const primaryColour = identity?.primaryColour || '#7c3aed';
  
  const heroImageUrl = identity?.heroImageUrl;
  const heroHeadline = identity?.heroHeadline || preview.siteTitle;
  const heroDescription = identity?.heroDescription || preview.siteSummary;
  const serviceHeadings = identity?.serviceHeadings || [];
  const serviceBullets = identity?.serviceBullets || preview.keyServices || [];
  const faqCandidates = identity?.faqCandidates || [];
  
  return (
    <div className="flex-1 overflow-y-auto">
      <div 
        className="relative w-full h-48 md:h-64 flex items-end"
        style={{
          background: heroImageUrl 
            ? `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%), url(${heroImageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${primaryColour}40 0%, ${primaryColour}20 50%, transparent 100%)`
        }}
      >
        <div className="p-6 w-full">
          <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg mb-2" data-testid="text-hero-headline">
            {heroHeadline}
          </h2>
          {heroDescription && (
            <p className="text-sm md:text-base text-white/90 drop-shadow max-w-2xl line-clamp-3" data-testid="text-hero-description">
              {heroDescription}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8">
        {(serviceHeadings.length > 0 || serviceBullets.length > 0) && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              What we do
            </h3>
            {serviceHeadings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {serviceHeadings.slice(0, 6).map((heading, i) => (
                  <div 
                    key={i} 
                    className="p-3 rounded-lg bg-secondary/30 border border-border"
                    data-testid={`text-service-heading-${i}`}
                  >
                    <p className="font-medium text-sm">{heading}</p>
                  </div>
                ))}
              </div>
            )}
            {serviceBullets.length > 0 && (
              <ul className="space-y-2">
                {serviceBullets.slice(0, 5).map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span data-testid={`text-service-bullet-${i}`}>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {faqCandidates.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Common questions
            </h3>
            <div className="space-y-2">
              {faqCandidates.slice(0, 5).map((question, i) => (
                <button
                  key={i}
                  onClick={() => onAskQuestion(question)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-all text-sm group flex items-center justify-between"
                  data-testid={`button-faq-${i}`}
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {question}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="text-xs text-muted-foreground/60 pt-4 border-t border-border">
          Content pulled from: {preview.sourceDomain}
        </div>
      </div>
    </div>
  );
}

function ChatOverlay({
  isOpen,
  onClose,
  onToggle,
  messages,
  input,
  setInput,
  onSend,
  isTyping,
  suggestedPrompts,
  capReached,
  onCapClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: (message?: string) => void;
  isTyping: boolean;
  suggestedPrompts: string[];
  capReached: boolean;
  onCapClick: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isTyping, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 md:right-6 md:left-auto md:bottom-6 md:w-96"
          >
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[70vh] md:max-h-[600px] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-white/50" />
                  <span className="font-semibold text-sm text-white">Chat</span>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-white/[0.06] transition-colors"
                  data-testid="button-close-chat"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
                <ScrollArea className="h-full max-h-[calc(70vh-130px)] md:max-h-[470px]">
                  <div className="p-4">
                {messages.length === 0 && suggestedPrompts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs text-white/40 mb-3">Try asking:</p>
                    {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(prompt)}
                        disabled={isTyping || capReached}
                        className="w-full text-left p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-xs text-white/70 disabled:opacity-50"
                        data-testid={`button-suggested-prompt-${i}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[85%] p-3 rounded-xl text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-white text-black rounded-tr-sm'
                          : 'bg-white/[0.06] text-white/80 rounded-tl-sm border border-white/[0.08]'}
                      `}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white/[0.04] p-3 rounded-xl rounded-tl-sm border border-white/[0.08] flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></span>
                      </div>
                    </motion.div>
                  )}
                </div>
                  </div>
                </ScrollArea>
              </div>

              <div className="p-3 border-t border-white/[0.08] shrink-0">
                {capReached ? (
                  <button
                    onClick={onCapClick}
                    className="w-full p-3 rounded-lg bg-white text-black font-medium text-sm"
                    data-testid="button-cap-reached-claim"
                  >
                    Continue conversation - Claim this Smart Site
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question..."
                      className="bg-white/[0.04] border-white/[0.08] h-10 rounded-full px-4 text-sm text-white placeholder:text-white/40"
                      onKeyDown={(e) => e.key === 'Enter' && onSend()}
                      disabled={isTyping}
                      data-testid="input-chat-message"
                    />
                    <button
                      onClick={() => onSend()}
                      className="shrink-0 h-10 w-10 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-50"
                      disabled={isTyping || !input.trim()}
                      data-testid="button-send-message"
                    >
                      {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function PreviewPage() {
  const [, params] = useRoute("/preview/:id");
  const previewId = params?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [experienceMode, setExperienceMode] = useState<'cinematic' | 'interactive'>('cinematic');

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["preview", previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${previewId}`);
      if (!response.ok) throw new Error("Preview not found");
      return response.json() as Promise<PreviewInstance>;
    },
    enabled: !!previewId,
    refetchInterval: 30000,
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["preview-messages", previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json() as Promise<ChatMessage[]>;
    },
    enabled: !!previewId && !!preview,
  });

  useEffect(() => {
    if (chatMessages && !hasInitialized) {
      setMessages(chatMessages);
      setHasInitialized(true);
    }
  }, [chatMessages, hasInitialized]);

  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch(`/api/previews/${previewId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          throw new Error("MESSAGE_CAP_REACHED");
        }
        throw new Error(error.message || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      }]);
    },
    onError: (error: Error) => {
      setIsTyping(false);
      if (error.message === "MESSAGE_CAP_REACHED") {
        setShowPaywall(true);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          content: `Something went wrong. Please try again.`,
          createdAt: new Date().toISOString(),
        }]);
      }
    },
  });

  const handleSend = (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || isTyping) return;

    if (!chatOpen) {
      setChatOpen(true);
    }

    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      content: messageToSend,
      createdAt: new Date().toISOString(),
    }]);
    setInput("");
    setIsTyping(true);

    sendMutation.mutate(messageToSend);
  };

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/claim`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to initiate claim");
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/archive`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to archive");
      return response.json();
    },
    onSuccess: () => {
      setShowPaywall(false);
      window.location.href = "/";
    },
  });

  const getTimeRemaining = () => {
    if (!preview) return "";
    const now = new Date();
    const expires = new Date(preview.expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours <= 0 && diffMins <= 0) return "Expired";
    if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
    return `${diffMins}m`;
  };

  const generateContextualPrompts = () => {
    if (!preview?.siteIdentity) {
      return [
        "What services do you offer?",
        "How do I get started?",
        "What makes you different?",
      ];
    }

    const prompts: string[] = [];
    const identity = preview.siteIdentity;
    
    for (const heading of identity.serviceHeadings.slice(0, 2)) {
      prompts.push(`What does ${heading} include?`);
    }
    
    const siteName = identity.title?.split(' - ')[0] || identity.sourceDomain;
    prompts.push(`How do I get started with ${siteName}?`);
    prompts.push("What's the best next step for someone like me?");
    
    for (const faq of identity.faqCandidates.slice(0, 2)) {
      if (!prompts.includes(faq)) {
        prompts.push(faq);
      }
    }
    
    return prompts.slice(0, 5);
  };

  const capReached = preview ? preview.messageCount >= preview.maxMessages : false;

  if (previewLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Preview Not Found</h2>
        <p className="text-muted-foreground mb-6">This preview may have expired or been archived.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  if (preview.status === 'archived') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <Archive className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-4">Preview Archived</h2>
        <p className="text-muted-foreground mb-6">This preview has been archived and is no longer available.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  if (preview.status === 'claimed') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <Sparkles className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-4">Preview Claimed!</h2>
        <p className="text-muted-foreground mb-6">This preview has been claimed and is now a full Smart Site.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {preview.siteIdentity && (
        <PreviewExperienceOrchestrator
          siteIdentity={preview.siteIdentity}
          siteTitle={preview.siteTitle}
          siteSummary={preview.siteSummary}
          onAskAbout={(prompt) => handleSend(prompt)}
          onClaim={() => claimMutation.mutate()}
          onModeChange={setExperienceMode}
        />
      )}

      {experienceMode === 'interactive' && (
        <ChatOverlay
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          onToggle={() => setChatOpen(true)}
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isTyping={isTyping}
          suggestedPrompts={generateContextualPrompts()}
          capReached={capReached}
          onCapClick={() => setShowPaywall(true)}
        />
      )}

      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Your Smart Site is ready</DialogTitle>
            <DialogDescription className="text-base pt-2">
              To keep it live and claim the leads it is already uncovering, activate it.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Unlimited conversations with potential customers</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Full site content and intelligent responses</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Lead capture and conversation history</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-claim-activate"
            >
              {claimMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Claim and activate
            </Button>
            <Button
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              variant="ghost"
              className="w-full"
              size="sm"
              data-testid="button-not-now"
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
