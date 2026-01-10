import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Minimize2, Loader2, Play } from "lucide-react";

export interface SuggestedVideo {
  id: number;
  title: string;
  youtubeVideoId: string;
  thumbnailUrl: string | null;
  description: string | null;
}

export interface ChatResponse {
  text: string;
  video?: SuggestedVideo | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  video?: SuggestedVideo | null;
}

function renderMessageContent(
  content: string, 
  accentColor: string, 
  onChipClick?: (text: string) => void,
  lightMode: boolean = false
) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phonePattern = /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  
  const lines = content.split('\n');
  
  // Detect if this message has bullet point options (• or - at start of line)
  const bulletLines = lines.filter(line => /^[•\-]\s/.test(line.trim()));
  const hasBulletOptions = bulletLines.length >= 2;
  
  // Separate content into regular text and bullet options
  const regularLines: string[] = [];
  const optionLines: string[] = [];
  
  lines.forEach(line => {
    if (hasBulletOptions && /^[•\-]\s/.test(line.trim())) {
      optionLines.push(line.trim().replace(/^[•\-]\s*/, ''));
    } else {
      regularLines.push(line);
    }
  });
  
  // Render regular content
  const regularContent = regularLines.map((line, lineIdx) => {
    const elements = lineIdx > 0 
      ? [<br key={`br-${lineIdx}`} />, ...renderLine(line, lineIdx, accentColor)]
      : renderLine(line, lineIdx, accentColor);
    return <React.Fragment key={`line-${lineIdx}`}>{elements}</React.Fragment>;
  });
  
  // Render quick-select chips for bullet options
  const chipContent = hasBulletOptions && optionLines.length > 0 ? (
    <div key="chips" className="flex flex-wrap gap-2 mt-3">
      {optionLines.map((option, idx) => (
        <button
          key={`chip-${idx}`}
          onClick={(e) => {
            e.stopPropagation();
            onChipClick?.(option);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
            lightMode 
              ? 'bg-white text-gray-800 hover:bg-gray-50 shadow-sm border border-gray-200' 
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
          }`}
          style={{ 
            borderColor: `${accentColor}40`,
          }}
          data-testid={`quick-select-${idx}`}
        >
          {option}
        </button>
      ))}
    </div>
  ) : null;
  
  return (
    <>
      {regularContent}
      {chipContent}
    </>
  );
  
  function isUrl(str: string): boolean {
    return str.startsWith('http://') || str.startsWith('https://');
  }
  
  function isEmail(str: string): boolean {
    return emailPattern.test(str);
  }
  
  function isPhone(str: string): boolean {
    return phonePattern.test(str);
  }
  
  function renderLine(line: string, lineIdx: number, color: string): React.ReactNode[] {
    const urlParts = line.split(urlPattern);
    const result: React.ReactNode[] = [];
    
    urlParts.forEach((segment, segIdx) => {
      if (isUrl(segment)) {
        try {
          const url = new URL(segment);
          const displayText = url.hostname.replace('www.', '') + (url.pathname !== '/' ? url.pathname : '');
          result.push(
            <a 
              key={`${lineIdx}-url-${segIdx}`}
              href={segment}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline font-medium hover:opacity-80 px-1 py-0.5 rounded"
              style={{ color, backgroundColor: `${color}15` }}
              onClick={(e) => e.stopPropagation()}
            >
              {displayText.length > 30 ? displayText.slice(0, 30) + '...' : displayText}
            </a>
          );
        } catch {
          result.push(<span key={`${lineIdx}-url-${segIdx}`}>{segment}</span>);
        }
      } else {
        result.push(...renderEmailsAndPhones(segment, lineIdx, segIdx, color));
      }
    });
    
    return result;
  }
  
  function renderEmailsAndPhones(text: string, lineIdx: number, segIdx: number, color: string): React.ReactNode[] {
    const combinedPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
    const parts = text.split(combinedPattern);
    const result: React.ReactNode[] = [];
    
    parts.forEach((part, partIdx) => {
      if (!part) return;
      
      if (isEmail(part)) {
        result.push(
          <a 
            key={`${lineIdx}-${segIdx}-email-${partIdx}`}
            href={`mailto:${part}`}
            className="underline font-medium hover:opacity-80"
            style={{ color }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      } else if (isPhone(part)) {
        const cleanPhone = part.replace(/[^\d+]/g, '');
        result.push(
          <a 
            key={`${lineIdx}-${segIdx}-phone-${partIdx}`}
            href={`tel:${cleanPhone}`}
            className="underline font-medium hover:opacity-80"
            style={{ color }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      } else {
        result.push(<span key={`${lineIdx}-${segIdx}-text-${partIdx}`}>{part}</span>);
      }
    });
    
    return result;
  }
}

interface ChatHubProps {
  brandName: string;
  accentColor?: string;
  onSendMessage: (message: string) => Promise<string | ChatResponse>;
  onVideoEvent?: (videoId: number, event: 'play' | 'pause' | 'complete', msWatched?: number) => void;
  orbitSlug?: string;
  onIntentChange?: (keywords: string[]) => void;
  initialMessage?: string;
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  nearbyTiles?: string[];
  lightMode?: boolean;
}

export function ChatHub({
  brandName,
  accentColor = '#3b82f6',
  onSendMessage,
  onVideoEvent,
  orbitSlug,
  onIntentChange,
  initialMessage,
  isMinimized,
  onMinimize,
  onExpand,
  nearbyTiles = [],
  lightMode = false,
}: ChatHubProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const videoStartTimeRef = useRef<number>(0);
  const getProactiveWelcome = () => {
    return `${brandName}\n\nTap any tile to learn more, or ask me a question.`;
  };

  const [messages, setMessages] = useState<Message[]>(() => [
    { role: 'assistant', content: initialMessage || getProactiveWelcome() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialMessage) {
      setMessages([{ role: 'assistant', content: initialMessage }]);
    }
  }, [initialMessage]);

  const extractKeywords = (text: string): string[] => {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am']);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    const keywords = extractKeywords(userMessage);
    onIntentChange?.(keywords);
    
    setIsTyping(true);
    try {
      const response = await onSendMessage(userMessage);
      
      // Handle both string and ChatResponse formats
      const text = typeof response === 'string' ? response : response.text;
      const video = typeof response === 'string' ? null : response.video;
      
      setMessages(prev => [...prev, { role: 'assistant', content: text, video }]);
      
      const responseKeywords = extractKeywords(text);
      onIntentChange?.([...keywords, ...responseKeywords]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble responding right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = async (text: string) => {
    if (isTyping) return;
    
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    
    const keywords = extractKeywords(text);
    onIntentChange?.(keywords);
    
    setIsTyping(true);
    try {
      const response = await onSendMessage(text);
      const responseText = typeof response === 'string' ? response : response.text;
      const video = typeof response === 'string' ? null : response.video;
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText, video }]);
      
      const responseKeywords = extractKeywords(responseText);
      onIntentChange?.([...keywords, ...responseKeywords]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble responding right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        onClick={onExpand}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
        style={{ 
          backgroundColor: accentColor,
          boxShadow: `0 0 40px ${accentColor}40, 0 0 80px ${accentColor}20`,
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="chat-hub-orb"
        data-chat-hub
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 z-[60] w-[360px] max-w-[90vw] mb-16"
      data-testid="chat-hub"
      data-chat-hub
    >
      <div 
        className="rounded-2xl overflow-hidden backdrop-blur-xl"
        style={{
          backgroundColor: lightMode ? 'rgba(255, 255, 255, 0.98)' : 'rgba(10, 10, 10, 0.95)',
          border: `1px solid ${accentColor}40`,
          boxShadow: lightMode 
            ? `0 0 60px ${accentColor}15, 0 25px 50px -12px rgba(0, 0, 0, 0.15)`
            : `0 0 60px ${accentColor}20, 0 25px 50px -12px rgba(0, 0, 0, 0.5)`,
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${accentColor}20` }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <MessageCircle className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <span className={`font-medium text-sm ${lightMode ? 'text-gray-900' : 'text-white'}`}>{brandName}</span>
          </div>
          <button
            onClick={onMinimize}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lightMode ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
            data-testid="minimize-hub"
          >
            <Minimize2 className={`w-4 h-4 ${lightMode ? 'text-gray-500' : 'text-white/60'}`} />
          </button>
        </div>

        {/* Messages */}
        <div className="h-[280px] overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? lightMode ? 'bg-gray-100 text-gray-900' : 'bg-white/10 text-white'
                    : lightMode ? 'text-gray-800' : 'text-white/90'
                }`}
                style={msg.role === 'assistant' ? { backgroundColor: `${accentColor}15` } : {}}
              >
                {msg.role === 'assistant' 
                  ? renderMessageContent(msg.content, accentColor, handleChipClick, lightMode)
                  : msg.content}
              </div>
              
              {/* Video Card */}
              {msg.video && (
                <div className="mt-2 max-w-[85%]">
                  {playingVideoId === msg.video.youtubeVideoId ? (
                    <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${msg.video.youtubeVideoId}?autoplay=1&rel=0`}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <button
                        onClick={() => {
                          const msWatched = Date.now() - videoStartTimeRef.current;
                          onVideoEvent?.(msg.video!.id, 'pause', msWatched);
                          setPlayingVideoId(null);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
                        data-testid={`close-video-${msg.video.id}`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPlayingVideoId(msg.video!.youtubeVideoId);
                        videoStartTimeRef.current = Date.now();
                        onVideoEvent?.(msg.video!.id, 'play');
                      }}
                      className="group relative w-full rounded-lg overflow-hidden"
                      style={{ aspectRatio: '16/9' }}
                      data-testid={`play-video-${msg.video.id}`}
                    >
                      <img 
                        src={msg.video.thumbnailUrl || `https://img.youtube.com/vi/${msg.video.youtubeVideoId}/mqdefault.jpg`}
                        alt={msg.video.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-xs text-white font-medium truncate">{msg.video.title}</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div 
                className="px-3 py-2 rounded-xl"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Loader2 className={`w-4 h-4 animate-spin ${lightMode ? 'text-gray-500' : 'text-white/60'}`} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3" style={{ borderTop: `1px solid ${accentColor}20` }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className={`flex-1 border-0 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                lightMode 
                  ? 'bg-gray-100 text-gray-900 placeholder:text-gray-400' 
                  : 'bg-white/5 text-white placeholder:text-white/40'
              }`}
              disabled={isTyping}
              data-testid="chat-input"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ backgroundColor: accentColor }}
              data-testid="send-button"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
