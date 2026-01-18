import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Volume2, VolumeX, Loader2, MessageCircle } from "lucide-react";
import type { InterludeGoal } from "@shared/schema";

interface InterludeCharacter {
  id: string;
  name: string;
  role?: string;
  description?: string;
  avatar?: string;
  avatarEnabled?: boolean;
  systemPrompt?: string;
  openingMessage?: string;
  isPrimary?: boolean;
}

interface InterludeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioBase64?: string;
}

interface InterludeModalProps {
  open: boolean;
  onClose: () => void;
  iceId: string;
  iceTitle: string;
  currentCardIndex: number;
  characters: InterludeCharacter[];
  defaultCharacterId?: string;
  goal?: InterludeGoal;
}

export function InterludeModal({
  open,
  onClose,
  iceId,
  iceTitle,
  currentCardIndex,
  characters,
  defaultCharacterId,
  goal = 'open_ended',
}: InterludeModalProps) {
  const [messages, setMessages] = useState<InterludeMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState(defaultCharacterId || characters[0]?.id);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId) || characters[0];

  // Reset state when modal opens or iceId/defaultCharacterId/characters changes
  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
      setSelectedCharacterId(defaultCharacterId || characters[0]?.id);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [open, iceId, defaultCharacterId, characters]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = (base64Audio: string) => {
    if (!audioEnabled) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioRef.current = audio;
    audio.play().catch(console.error);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: InterludeMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/ice/preview/${iceId}/interlude/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          characterId: selectedCharacterId,
          currentCardIndex,
          goal,
          contextWindowSize: 3,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        const assistantMessage: InterludeMessage = {
          id: `msg_${Date.now()}_response`,
          role: 'assistant',
          content: data.reply,
          audioBase64: data.audioBase64,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        if (data.audioBase64) {
          playAudio(data.audioBase64);
        }
      } else {
        const error = await res.json();
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: error.message || 'Sorry, I encountered an error. Please try again.',
        }]);
      }
    } catch (error) {
      console.error('Interlude chat error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Connection error. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goalLabels: Record<InterludeGoal, string> = {
    diagnose: 'Need help?',
    collect_preference: 'What interests you?',
    confirm_readiness: 'Ready to continue?',
    open_ended: 'Ask me anything',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-white p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            {selectedCharacter && (
              <Avatar className="h-10 w-10 border-2 border-cyan-500/50">
                {selectedCharacter.avatar && selectedCharacter.avatarEnabled ? (
                  <AvatarImage src={selectedCharacter.avatar} alt={selectedCharacter.name} />
                ) : null}
                <AvatarFallback className="bg-cyan-600 text-white">
                  {selectedCharacter.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-base font-medium truncate">
                {selectedCharacter?.name || 'Character'}
              </DialogTitle>
              <p className="text-xs text-slate-400 truncate">
                {goalLabels[goal]}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="text-slate-400 hover:text-white"
              data-testid="button-toggle-interlude-audio"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
          
          {characters.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {characters.map(char => (
                <Button
                  key={char.id}
                  size="sm"
                  variant={char.id === selectedCharacterId ? "default" : "ghost"}
                  onClick={() => setSelectedCharacterId(char.id)}
                  className={`shrink-0 text-xs ${
                    char.id === selectedCharacterId 
                      ? 'bg-cyan-600 hover:bg-cyan-700' 
                      : 'text-slate-300 hover:text-white'
                  }`}
                  data-testid={`button-select-character-${char.id}`}
                >
                  {char.name}
                </Button>
              ))}
            </div>
          )}
        </DialogHeader>
        
        <ScrollArea className="h-64 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
              <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {selectedCharacter?.openingMessage || `Hi! I'm ${selectedCharacter?.name}. Ask me anything about ${iceTitle}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && selectedCharacter && (
                    <Avatar className="h-6 w-6 shrink-0">
                      {selectedCharacter.avatar && selectedCharacter.avatarEnabled ? (
                        <AvatarImage src={selectedCharacter.avatar} />
                      ) : null}
                      <AvatarFallback className="bg-cyan-600 text-white text-xs">
                        {selectedCharacter.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    {msg.content}
                    {msg.audioBase64 && msg.role === 'assistant' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 ml-1 opacity-70 hover:opacity-100"
                        onClick={() => playAudio(msg.audioBase64!)}
                        data-testid={`button-replay-audio-${msg.id}`}
                      >
                        <Volume2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-cyan-600 text-white text-xs">
                      {selectedCharacter?.name.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-slate-700 rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              disabled={isLoading}
              data-testid="input-interlude-message"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="button-send-interlude-message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
