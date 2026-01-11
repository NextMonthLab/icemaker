import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Loader2, X, Sparkles, Plus, ChevronDown, User, Wand2, PenLine, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  description?: string;
  openingMessage?: string;
  systemPrompt?: string;
  knowledgeContext?: string;
}

interface InteractivityNodeProps {
  nodeId: string;
  afterCardIndex: number;
  previewId: string;
  previewAccessToken?: string;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
  characters?: StoryCharacter[];
  selectedCharacterId?: string;
  onCharacterSelect?: (characterId: string) => void;
}

export function InteractivityNode({
  nodeId,
  afterCardIndex,
  previewId,
  previewAccessToken,
  isActive,
  onActivate,
  onRemove,
  characters = [],
  selectedCharacterId,
  onCharacterSelect,
}: InteractivityNodeProps) {
  const [currentCharacter, setCurrentCharacter] = useState<StoryCharacter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const char = characters.find(c => c.id === selectedCharacterId) || characters[0];
    if (char && (!currentCharacter || char.id !== currentCharacter.id)) {
      setCurrentCharacter(char);
      setMessages([{
        role: "assistant",
        content: char.openingMessage || `Hello, I'm ${char.name}. What would you like to know?`,
      }]);
    }
  }, [selectedCharacterId, characters]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleCharacterChange = (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (char) {
      setCurrentCharacter(char);
      setMessages([{
        role: "assistant",
        content: char.openingMessage || `Hello, I'm ${char.name}. What would you like to know?`,
      }]);
      onCharacterSelect?.(charId);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/ice/preview/${previewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          characterId: currentCharacter?.id,
          previewAccessToken,
        }),
      });

      const data = await response.json();

      if (data.capped) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message || "This preview has reached its limit.",
          },
        ]);
      } else if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = currentCharacter?.name || "Story Character";
  const displayRole = currentCharacter?.role || "";

  if (!isActive) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center py-2"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 rounded-full">
          <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs text-purple-300">
            {displayName !== "Story Character" ? `Talk to ${displayName}` : "AI Interaction"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onActivate}
            className="h-6 px-2 text-xs text-purple-300 hover:text-white hover:bg-purple-500/20"
            data-testid={`button-activate-node-${nodeId}`}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Try it
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-5 w-5 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
            data-testid={`button-remove-node-${nodeId}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="my-3"
    >
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            
            {characters.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto py-0.5 px-2 text-left hover:bg-purple-500/20"
                    data-testid={`button-character-select-${nodeId}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-purple-200">{displayName}</span>
                      {displayRole && (
                        <span className="text-[10px] text-purple-400/70">{displayRole}</span>
                      )}
                    </div>
                    <ChevronDown className="w-3 h-3 ml-1 text-purple-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-900 border-purple-500/30">
                  {characters.map((char) => (
                    <DropdownMenuItem
                      key={char.id}
                      onClick={() => handleCharacterChange(char.id)}
                      className={`cursor-pointer ${char.id === currentCharacter?.id ? 'bg-purple-500/20' : ''}`}
                      data-testid={`menu-character-${char.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-white">{char.name}</span>
                        <span className="text-[10px] text-slate-400">{char.role}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex flex-col">
                <span className="text-sm font-medium text-purple-200">{displayName}</span>
                {displayRole && (
                  <span className="text-[10px] text-purple-400/70">{displayRole}</span>
                )}
              </div>
            )}
            
            <span className="text-[10px] text-slate-500 ml-2 hidden sm:inline">
              Live AI • Session only
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onActivate()}
            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
            data-testid={`button-minimize-node-${nodeId}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="h-48 overflow-y-auto p-3 space-y-3"
        >
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-800 text-slate-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {displayName} is thinking...
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-3 border-t border-purple-500/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${displayName} something...`}
              className="flex-1 bg-slate-800/50 border-slate-700 text-white text-sm h-9"
              disabled={isLoading}
              data-testid={`input-node-message-${nodeId}`}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="h-9 px-3 bg-purple-600 hover:bg-purple-700"
              data-testid={`button-send-node-message-${nodeId}`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

interface AddInteractivityButtonProps {
  afterCardIndex: number;
  onAdd: () => void;
  characters?: StoryCharacter[];
  onCharacterSelect?: (characterId: string) => void;
  previewId?: string;
  onCharacterCreated?: (character: StoryCharacter) => void;
}

export function AddInteractivityButton({
  afterCardIndex,
  onAdd,
  characters = [],
  onCharacterSelect,
  previewId,
  onCharacterCreated,
}: AddInteractivityButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customGreeting, setCustomGreeting] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [customKnowledge, setCustomKnowledge] = useState("");

  const handleClick = () => {
    setShowCharacterMenu(true);
  };

  const handleCharacterSelect = (charId: string) => {
    onCharacterSelect?.(charId);
    onAdd();
    setShowCharacterMenu(false);
  };

  const handleCreateCustom = () => {
    setShowCharacterMenu(false);
    setShowCreateDialog(true);
  };

  const handleSaveCustomCharacter = async () => {
    if (!customName.trim()) return;
    
    setIsCreating(true);
    
    try {
      const newCharacter: StoryCharacter = {
        id: `custom-${Date.now()}`,
        name: customName.trim(),
        role: customRole.trim() || "AI Assistant",
        openingMessage: customGreeting.trim() || `Hello! I'm ${customName.trim()}. How can I help you today?`,
        systemPrompt: customPersona.trim() || undefined,
        knowledgeContext: customKnowledge.trim() || undefined,
      };

      if (previewId) {
        const response = await fetch(`/api/ice/preview/${previewId}/characters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newCharacter),
        });
        
        if (response.ok) {
          const data = await response.json();
          newCharacter.id = data.id || newCharacter.id;
        }
      }

      onCharacterCreated?.(newCharacter);
      onCharacterSelect?.(newCharacter.id);
      onAdd();
      
      setShowCreateDialog(false);
      setCustomName("");
      setCustomRole("");
      setCustomGreeting("");
      setCustomPersona("");
      setCustomKnowledge("");
    } catch (error) {
      console.error("Failed to create character:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div
        className="relative h-8 flex items-center justify-center group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); if (!showCreateDialog) setShowCharacterMenu(false); }}
        data-testid={`button-add-node-after-${afterCardIndex}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        
        {showCharacterMenu ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-20 bg-slate-900 border border-purple-500/40 rounded-lg p-3 shadow-xl min-w-[200px]"
          >
            <p className="text-[10px] text-purple-300 mb-2 font-medium">Choose character type</p>
            
            {characters.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-slate-400">AI-Generated</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {characters.map((char) => (
                    <Button
                      key={char.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCharacterSelect(char.id)}
                      className="h-auto py-1.5 px-2 text-xs text-purple-200 hover:bg-purple-500/20 hover:text-white"
                      data-testid={`button-select-char-${char.id}-after-${afterCardIndex}`}
                    >
                      <User className="w-3 h-3 mr-1" />
                      {char.name}
                    </Button>
                  ))}
                </div>
                <div className="border-t border-slate-700 my-2" />
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateCustom}
              className="w-full h-auto py-2 text-xs border-dashed border-purple-500/40 text-purple-300 hover:bg-purple-500/10 hover:text-white"
              data-testid={`button-create-custom-after-${afterCardIndex}`}
            >
              <PenLine className="w-3 h-3 mr-2" />
              Create Custom Character
            </Button>
          </motion.div>
        ) : (
          <>
            <motion.button
              initial={false}
              animate={{
                scale: isHovered ? 1.1 : 1,
                backgroundColor: isHovered ? "rgb(147, 51, 234)" : "rgb(30, 41, 59)",
              }}
              onClick={handleClick}
              className="relative z-10 w-6 h-6 rounded-full border border-purple-500/50 flex items-center justify-center transition-colors"
            >
              <Plus className={`w-3 h-3 ${isHovered ? "text-white" : "text-purple-400"}`} />
            </motion.button>
            <AnimatePresence>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-1/2 translate-x-4 text-xs text-purple-300 whitespace-nowrap bg-slate-900/90 px-2 py-1 rounded"
                >
                  Add Character Chat
                </motion.span>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-purple-500/30 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <PenLine className="w-5 h-5 text-purple-400" />
              Create Custom Character
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Define a custom AI character for your audience to chat with.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="char-name" className="text-sm text-slate-300">Character Name *</Label>
              <Input
                id="char-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Alex, Product Expert, Chef Marco"
                className="bg-slate-800 border-slate-700 text-white"
                data-testid="input-custom-char-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="char-role" className="text-sm text-slate-300">Role / Title</Label>
              <Input
                id="char-role"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g., Customer Success Lead, Head Chef"
                className="bg-slate-800 border-slate-700 text-white"
                data-testid="input-custom-char-role"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="char-persona" className="text-sm text-slate-300">
                Persona & Instructions
                <span className="text-purple-400 ml-1">(Recommended)</span>
              </Label>
              <Textarea
                id="char-persona"
                value={customPersona}
                onChange={(e) => setCustomPersona(e.target.value)}
                placeholder="How should this character behave? What's their personality, expertise, and communication style?

Example: You are a friendly AI search expert who explains complex topics in simple terms. Be helpful, conversational, and provide actionable insights."
                className="bg-slate-800 border-slate-700 text-white min-h-[100px] text-sm"
                data-testid="input-custom-char-persona"
              />
              <p className="text-[10px] text-slate-500">This tells the AI how to act and respond</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="char-knowledge" className="text-sm text-slate-300">
                Knowledge Base
                <span className="text-purple-400 ml-1">(Recommended)</span>
              </Label>
              <Textarea
                id="char-knowledge"
                value={customKnowledge}
                onChange={(e) => setCustomKnowledge(e.target.value)}
                placeholder="What specific information should this character know about? Paste key facts, product details, FAQs, or expertise areas.

Example: Our company specializes in AI search optimization. Key services include website audits, citation analysis, and AI visibility strategies..."
                className="bg-slate-800 border-slate-700 text-white min-h-[120px] text-sm"
                data-testid="input-custom-char-knowledge"
              />
              <p className="text-[10px] text-slate-500">The AI will use this information to answer questions accurately</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="char-greeting" className="text-sm text-slate-300">Opening Message</Label>
              <Textarea
                id="char-greeting"
                value={customGreeting}
                onChange={(e) => setCustomGreeting(e.target.value)}
                placeholder="What should this character say when someone starts chatting?"
                className="bg-slate-800 border-slate-700 text-white min-h-[60px] text-sm"
                data-testid="input-custom-char-greeting"
              />
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-cancel-create-char"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCustomCharacter}
              disabled={!customName.trim() || isCreating}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              data-testid="button-save-custom-char"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Character
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
