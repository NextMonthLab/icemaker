import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Minimize2, Loader2 } from "lucide-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHubProps {
  brandName: string;
  accentColor?: string;
  onSendMessage: (message: string) => Promise<string>;
  onIntentChange?: (keywords: string[]) => void;
  initialMessage?: string;
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
}

export function ChatHub({
  brandName,
  accentColor = '#3b82f6',
  onSendMessage,
  onIntentChange,
  initialMessage,
  isMinimized,
  onMinimize,
  onExpand,
}: ChatHubProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialMessage || `Welcome! I'm here to help you explore ${brandName}. What would you like to know?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      
      const responseKeywords = extractKeywords(response);
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
      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[360px] max-w-[90vw]"
      data-testid="chat-hub"
    >
      <div 
        className="rounded-2xl overflow-hidden backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 0 60px ${accentColor}20, 0 25px 50px -12px rgba(0, 0, 0, 0.5)`,
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
            <span className="text-white font-medium text-sm">{brandName}</span>
          </div>
          <button
            onClick={onMinimize}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            data-testid="minimize-hub"
          >
            <Minimize2 className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-[280px] overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-white/10 text-white'
                    : 'text-white/90'
                }`}
                style={msg.role === 'assistant' ? { backgroundColor: `${accentColor}15` } : {}}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div 
                className="px-3 py-2 rounded-xl"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
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
              className="flex-1 bg-white/5 border-0 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
