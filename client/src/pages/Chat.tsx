import Layout from "@/components/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation, Link, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppContext } from "@/lib/app-context";

export default function Chat() {
  const [, setLocation] = useLocation();
  // Use window.location.search directly since wouter's useLocation only returns pathname
  const searchParams = new URLSearchParams(window.location.search);
  const characterId = searchParams.get('character');
  const cardId = searchParams.get('card');
  const { user } = useAuth();
  const { universe, setUniverse } = useAppContext();

  // Fetch universes directly if none is set (handles direct navigation to /chat)
  const { data: universes } = useQuery({
    queryKey: ["universes"],
    queryFn: () => api.getUniverses(),
    enabled: !universe && !characterId,
  });

  // Auto-set universe if we have exactly one
  useEffect(() => {
    if (!universe && universes && universes.length === 1) {
      setUniverse(universes[0]);
    }
  }, [universe, universes, setUniverse]);

  const activeUniverse = universe || (universes?.length === 1 ? universes[0] : null);

  const { data: character, isLoading } = useQuery({
    queryKey: ["character", characterId],
    queryFn: () => api.getCharacter(parseInt(characterId!)),
    enabled: !!characterId,
  });

  // Fetch all characters from the universe when no specific character is selected
  const { data: allCharacters, isLoading: charactersLoading } = useQuery({
    queryKey: ["characters", activeUniverse?.id],
    queryFn: () => api.getCharacters(activeUniverse!.id),
    enabled: !characterId && !!activeUniverse,
  });

  // Auto-redirect to chat if there's only one character (skip selection screen)
  useEffect(() => {
    if (!characterId && allCharacters && allCharacters.length === 1) {
      setLocation(`/chat?character=${allCharacters[0].id}`);
    }
  }, [characterId, allCharacters, setLocation]);

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ["chat-thread", character?.universeId, characterId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/threads?universeId=${character!.universeId}&characterId=${characterId}`);
      if (!response.ok) throw new Error("Failed to fetch thread");
      return response.json();
    },
    enabled: !!character?.universeId && !!characterId && !!user,
  });

  const { data: existingMessages } = useQuery({
    queryKey: ["chat-messages", thread?.id],
    queryFn: async () => {
      const response = await fetch(`/api/chat/threads/${thread!.id}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!thread?.id,
  });

  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingMessages && !hasInitialized) {
      if (existingMessages.length > 0) {
        setMessages(existingMessages.map((m: any) => ({ role: m.role, content: m.content })));
      } else if (character) {
        setMessages([{
          role: "assistant",
          content: character.description || `Hello, I'm ${character.name}. What would you like to know?`
        }]);
      }
      setHasInitialized(true);
    }
  }, [existingMessages, character, hasInitialized]);

  useEffect(() => {
    if (character && !existingMessages && !hasInitialized && !user) {
      setMessages([{
        role: "assistant",
        content: `I'd love to chat, but you'll need to sign in first to talk with ${character.name}.`
      }]);
      setHasInitialized(true);
    }
  }, [character, existingMessages, hasInitialized, user]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread!.id,
          message: userMessage,
          characterId: parseInt(characterId!),
          universeId: character!.universeId,
          cardId: cardId ? parseInt(cardId) : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.message.content 
      }]);
      if (data.disclaimer) {
        setDisclaimer(data.disclaimer);
      }
    },
    onError: (error: Error) => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `*connection lost* Something went wrong. Try again?` 
      }]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || !thread || isTyping) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsTyping(true);
    
    sendMutation.mutate(userMessage);
  };

  if (isLoading || threadLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!characterId || !character) {
    // Show character selection when no specific character is chosen
    if (charactersLoading) {
      return (
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </Layout>
      );
    }

    if (allCharacters && allCharacters.length > 1) {
      return (
        <Layout>
          <div className="p-4 pt-8 md:p-8 max-w-md mx-auto animate-in fade-in duration-500">
            <div className="mb-6 text-center">
              <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Chat</span>
              <h1 className="text-2xl font-display font-bold">Choose a Character</h1>
              <p className="text-sm text-muted-foreground mt-2">Who would you like to talk to?</p>
            </div>

            <div className="space-y-3">
              {allCharacters.map((char) => (
                <div 
                  key={char.id}
                  onClick={() => setLocation(`/chat?character=${char.id}`)}
                  className="group flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-primary/30 transition-all cursor-pointer"
                  data-testid={`character-chat-${char.id}`}
                >
                  <Avatar className="h-14 w-14 ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all">
                    <AvatarImage src={char.avatar || undefined} className="object-cover" />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {char.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                      {char.name}
                    </h3>
                    <p className="text-xs text-primary/70 uppercase tracking-wider font-medium">
                      {char.role || 'Character'}
                    </p>
                  </div>
                  <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </Layout>
      );
    }

    // Single character - show loading while redirect happens
    if (allCharacters && allCharacters.length === 1) {
      return (
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </Layout>
      );
    }

    // No characters available
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">No Characters Yet</h2>
          <p className="text-muted-foreground mb-6">Watch some story cards to unlock characters to chat with.</p>
          <Link href="/today">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go to Today's Story
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">You need to be signed in to chat with {character.name}.</p>
          <Link href="/login">
            <Button className="gap-2">
              Sign In to Chat
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-65px)] md:h-screen bg-background relative overflow-hidden">
        
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

        <div className="p-4 border-b border-white/10 bg-card/80 backdrop-blur-sm flex items-center gap-4 sticky top-0 z-10">
          <Link href="/today">
            <Button variant="ghost" size="icon" className="mr-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="relative">
            <Avatar className="h-12 w-12 ring-2 ring-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.3)]">
              <AvatarImage src={character.avatar || undefined} className="object-cover" />
              <AvatarFallback>{character.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></span>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg leading-none tracking-wide" data-testid="chat-character-name">
              {character.name}
            </h2>
            <span className="text-xs text-primary font-medium tracking-wider uppercase">
              {character.role || 'Character'}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 max-w-2xl mx-auto pb-4">
            {disclaimer && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-xs text-muted-foreground bg-secondary/30 rounded-lg px-4 py-2 mx-auto max-w-xs"
              >
                {disclaimer}
              </motion.div>
            )}
            
            {messages.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative
                  ${msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-[0_4px_20px_rgba(124,58,237,0.2)]' 
                    : 'bg-secondary/80 text-secondary-foreground rounded-tl-sm border border-white/5'}
                `}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-secondary/50 p-4 rounded-2xl rounded-tl-sm border border-white/5 flex gap-1 items-center h-[44px]">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-background/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="bg-secondary/50 border-white/10 focus-visible:ring-primary/50 h-12 rounded-full px-6 shadow-inner"
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isTyping}
              data-testid="input-chat-message"
            />
            <Button 
              onClick={handleSend} 
              size="icon" 
              className="shrink-0 h-12 w-12 rounded-full shadow-[0_0_15px_rgba(124,58,237,0.4)]"
              disabled={isTyping || !input.trim()}
              data-testid="button-send-message"
            >
              {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-3 font-mono tracking-widest opacity-50">
            ENCRYPTED CONNECTION // MESSAGES: {messages.length}
          </p>
        </div>

      </div>
    </Layout>
  );
}
