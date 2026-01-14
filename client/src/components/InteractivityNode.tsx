import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Loader2, X, Sparkles, Plus, ChevronDown, User, Wand2, PenLine, Check, Crown, Upload, Image as ImageIcon, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CustomFieldsEditor, CustomField } from "@/components/CustomFieldsEditor";
import { FieldCaptureForm, CaptureField } from "@/components/FieldCaptureForm";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

interface Entitlements {
  tier: string;
  canConfigureStructuredCapture: boolean;
  [key: string]: unknown;
}

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
  avatar?: string;
  avatarEnabled?: boolean;
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
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [captureSubmitted, setCaptureSubmitted] = useState(false);
  const [isSubmittingCapture, setIsSubmittingCapture] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: captureFields = [] } = useQuery<CaptureField[]>({
    queryKey: ["/api/characters", currentCharacter?.id, "custom-fields"],
    queryFn: async () => {
      if (!currentCharacter?.id) return [];
      const numericId = parseInt(currentCharacter.id.replace(/\D/g, "")) || 0;
      if (!numericId) return [];
      const res = await fetch(`/api/characters/${numericId}/custom-fields`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentCharacter?.id && isActive,
    staleTime: 60000,
  });

  useEffect(() => {
    if (captureFields.length > 0 && messages.length >= 3 && !captureSubmitted && !showCaptureForm) {
      setShowCaptureForm(true);
    }
  }, [captureFields, messages.length, captureSubmitted, showCaptureForm]);

  useEffect(() => {
    const char = characters.find(c => c.id === selectedCharacterId) || characters[0];
    if (char && (!currentCharacter || char.id !== currentCharacter.id)) {
      setCurrentCharacter(char);
      setMessages([{
        role: "assistant",
        content: char.openingMessage || `Hello, I'm ${char.name}. What would you like to know?`,
      }]);
      setShowCaptureForm(false);
      setCaptureSubmitted(false);
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

  const handleCaptureSubmit = async (values: Record<string, unknown>) => {
    setIsSubmittingCapture(true);
    try {
      const response = await fetch(`/api/ice/preview/${previewId}/field-responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: currentCharacter?.id,
          sessionId: `session-${Date.now()}`,
          responses: values,
        }),
      });

      if (response.ok) {
        setCaptureSubmitted(true);
        setShowCaptureForm(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Thanks for sharing that info! How else can I help you?",
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to submit capture:", error);
    } finally {
      setIsSubmittingCapture(false);
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
            {currentCharacter?.avatarEnabled && currentCharacter?.avatar ? (
              <Avatar className="w-7 h-7 border border-purple-500/30">
                <AvatarImage src={currentCharacter.avatar} alt={currentCharacter.name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500">
                  <User className="w-3.5 h-3.5 text-white" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            
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
          {showCaptureForm && captureFields.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FieldCaptureForm
                fields={captureFields}
                onSubmit={handleCaptureSubmit}
                onDismiss={() => {
                  setShowCaptureForm(false);
                  setCaptureSubmitted(true);
                }}
                isSubmitting={isSubmittingCapture}
              />
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
  const { user } = useAuth();
  const [showCharacterMenu, setShowCharacterMenu] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customGreeting, setCustomGreeting] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [customKnowledge, setCustomKnowledge] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: entitlements } = useQuery({
    queryKey: ["/api/me/entitlements"],
    queryFn: async () => {
      const res = await fetch("/api/me/entitlements", { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<Entitlements>;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const canConfigureStructuredCapture = entitlements?.canConfigureStructuredCapture ?? false;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Avatar image must be less than 2MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    setShowCharacterMenu(true);
  };

  const handleCharacterSelect = (charId: string) => {
    onCharacterSelect?.(charId);
    onAdd();
    setShowCharacterMenu(false);
  };

  const handleCreateCustom = () => {
    setEditingCharacterId(null);
    setCustomName("");
    setCustomRole("");
    setCustomGreeting("");
    setCustomPersona("");
    setCustomKnowledge("");
    setCustomFields([]);
    setAvatarPreview(null);
    setAvatarFile(null);
    setShowCharacterMenu(false);
    setShowCreateDialog(true);
  };

  const handleEditCharacter = (char: StoryCharacter) => {
    setEditingCharacterId(char.id);
    setCustomName(char.name || "");
    setCustomRole(char.role || "");
    setCustomGreeting(char.openingMessage || "");
    setCustomPersona(char.systemPrompt || "");
    setCustomKnowledge(char.knowledgeContext || "");
    setAvatarPreview(char.avatar || null);
    setAvatarEnabled(char.avatarEnabled !== false);
    setShowCharacterMenu(false);
    setShowCreateDialog(true);
  };

  const handleSaveCustomCharacter = async () => {
    if (!customName.trim()) return;
    
    setIsCreating(true);
    const isEditing = !!editingCharacterId;
    
    try {
      let uploadedAvatarUrl: string | undefined = avatarPreview || undefined;
      
      if (avatarFile && previewId) {
        setIsUploadingAvatar(true);
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        
        const uploadResponse = await fetch(`/api/ice/preview/${previewId}/character-avatar`, {
          method: "POST",
          body: formData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedAvatarUrl = uploadData.url;
        }
        setIsUploadingAvatar(false);
      }
      
      const characterData: StoryCharacter = {
        id: isEditing ? editingCharacterId : `custom-${Date.now()}`,
        name: customName.trim(),
        role: customRole.trim() || "AI Assistant",
        openingMessage: customGreeting.trim() || `Hello! I'm ${customName.trim()}. How can I help you today?`,
        systemPrompt: customPersona.trim() || undefined,
        knowledgeContext: customKnowledge.trim() || undefined,
        avatar: uploadedAvatarUrl,
        avatarEnabled: avatarEnabled && !!uploadedAvatarUrl,
      };

      if (previewId) {
        if (isEditing) {
          const response = await fetch(`/api/ice/preview/${previewId}/characters/${editingCharacterId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...characterData,
              customFields: customFields.length > 0 ? customFields : undefined,
            }),
          });
          
          if (response.ok) {
            onCharacterCreated?.(characterData);
          }
        } else {
          const response = await fetch(`/api/ice/preview/${previewId}/characters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...characterData,
              customFields: customFields.length > 0 ? customFields : undefined,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            characterData.id = data.id || characterData.id;
          }
          
          onCharacterCreated?.(characterData);
          onCharacterSelect?.(characterData.id);
          onAdd();
        }
      }
      
      setShowCreateDialog(false);
      setEditingCharacterId(null);
      setCustomName("");
      setCustomRole("");
      setCustomGreeting("");
      setCustomPersona("");
      setCustomKnowledge("");
      setCustomFields([]);
      setShowAdvancedOptions(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarEnabled(true);
    } catch (error) {
      console.error("Failed to save character:", error);
    } finally {
      setIsCreating(false);
      setIsUploadingAvatar(false);
    }
  };

  return (
    <>
      <div
        className="relative py-3 flex items-center justify-center"
        data-testid={`button-add-node-after-${afterCardIndex}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
        
        {showCharacterMenu ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-20 w-full max-w-sm bg-slate-900/95 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-4 shadow-xl shadow-cyan-500/10"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-cyan-400" />
                <p className="text-sm text-white font-medium">Choose a character</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCharacterMenu(false)}
                className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full"
                data-testid={`button-close-character-menu-${afterCardIndex}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {characters.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span className="text-xs text-slate-400">AI-Generated Characters</span>
                </div>
                <div className="space-y-2 mb-3">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCharacterSelect(char.id)}
                        className="flex-1 h-auto py-2.5 px-3 text-xs justify-start border-cyan-500/20 text-cyan-100 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-white"
                        data-testid={`button-select-char-${char.id}-after-${afterCardIndex}`}
                      >
                        <User className="w-3.5 h-3.5 mr-2 text-cyan-400" />
                        <span className="truncate">{char.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCharacter(char)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        data-testid={`button-edit-char-${char.id}-after-${afterCardIndex}`}
                        title="Edit character"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700/50 my-3" />
              </>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateCustom}
              className="w-full h-auto py-2.5 text-xs border-dashed border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 hover:text-white hover:border-cyan-500/50"
              data-testid={`button-create-custom-after-${afterCardIndex}`}
            >
              <PenLine className="w-3.5 h-3.5 mr-2" />
              Create Custom Character
            </Button>
          </motion.div>
        ) : (
          <motion.button
            initial={false}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClick}
            className="relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 hover:border-cyan-400/50 hover:from-cyan-600/30 hover:to-blue-600/30 transition-all duration-200 group shadow-lg shadow-cyan-500/5"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 animate-pulse opacity-50" />
            <MessageCircle className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            <span className="text-sm font-medium text-cyan-200 group-hover:text-white transition-colors">Add AI Chat</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400/60 group-hover:text-cyan-300 transition-colors" />
          </motion.button>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) setEditingCharacterId(null);
      }}>
        <DialogContent className="bg-slate-900 border-purple-500/30 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <PenLine className="w-5 h-5 text-purple-400" />
              {editingCharacterId ? "Edit Character" : "Create Custom Character"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingCharacterId 
                ? "Update the character details below."
                : "Define a custom AI character for your audience to chat with."}
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
            
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">Profile Image</Label>
              <div className="flex items-start gap-4">
                <div className="relative">
                  {avatarPreview ? (
                    <div className="relative">
                      <Avatar className="w-16 h-16 border-2 border-purple-500/30">
                        <AvatarImage src={avatarPreview} alt="Character avatar" />
                        <AvatarFallback className="bg-slate-800 text-slate-400">
                          <User className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white p-0"
                        data-testid="button-remove-avatar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => avatarInputRef.current?.click()}
                      className="w-16 h-16 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 hover:border-purple-500/50 flex items-center justify-center cursor-pointer transition-colors"
                      data-testid="button-upload-avatar"
                    >
                      <Upload className="w-5 h-5 text-slate-500" />
                    </div>
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                    data-testid="input-avatar-file"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-slate-400">
                    Upload an image for this character. Max 2MB.
                  </p>
                  {avatarPreview && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="avatar-enabled"
                        checked={avatarEnabled}
                        onCheckedChange={setAvatarEnabled}
                        data-testid="switch-avatar-enabled"
                      />
                      <Label htmlFor="avatar-enabled" className="text-xs text-slate-400">
                        Show avatar in chat
                      </Label>
                    </div>
                  )}
                </div>
              </div>
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

            <Collapsible open={showAdvancedOptions} onOpenChange={setShowAdvancedOptions}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center gap-1"
                  data-testid="button-toggle-advanced-options"
                >
                  <Crown className="w-3.5 h-3.5 text-cyan-400" />
                  {showAdvancedOptions ? "Hide" : "Show"} Data Capture Options
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 border-t border-slate-700 mt-3">
                <CustomFieldsEditor
                  fields={customFields}
                  onChange={setCustomFields}
                  canEdit={canConfigureStructuredCapture}
                  onUpgradeClick={() => {
                    window.open("/checkout", "_blank");
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
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
