import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Globe, 
  Palette, 
  Plus, 
  Lock, 
  Unlock, 
  Trash2, 
  Wand2, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Camera,
  Mic
} from "lucide-react";
import type { 
  ProjectBible, 
  CharacterBibleEntry, 
  WorldBible, 
  StyleBible,
  SceneBible,
  CameraAngle,
  SceneLockFlags
} from "@shared/schema";

interface ContinuityPanelProps {
  previewId: string;
  bible: ProjectBible | null;
  onBibleChange: (bible: ProjectBible) => void;
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
}

interface Voice {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
}

export function ContinuityPanel({ 
  previewId, 
  bible, 
  onBibleChange, 
  onGenerate,
  isGenerating = false 
}: ContinuityPanelProps) {
  const [activeTab, setActiveTab] = useState("characters");
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  
  // Fetch voices once at panel level and pass to character cards
  const { data: voicesData } = useQuery<{ voices: Voice[]; configured: boolean }>({
    queryKey: ["tts-voices"],
    queryFn: async () => {
      const res = await fetch("/api/tts/voices");
      if (!res.ok) return { voices: [], configured: false };
      return res.json();
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
  
  const handleCharacterUpdate = useCallback((characterId: string, updates: Partial<CharacterBibleEntry>) => {
    if (!bible) return;
    const updatedCharacters = bible.characters.map(c => 
      c.id === characterId ? { ...c, ...updates } : c
    );
    onBibleChange({ ...bible, characters: updatedCharacters });
  }, [bible, onBibleChange]);
  
  const handleAddCharacter = useCallback(() => {
    if (!bible) return;
    const newChar: CharacterBibleEntry = {
      id: crypto.randomUUID(),
      name: "New Character",
      physicalTraits: {},
      wardrobeRules: { signatureItems: [], colorPalette: [] },
      lockedTraits: [],
      deliveryStyleDefault: "neutral",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onBibleChange({ ...bible, characters: [...bible.characters, newChar] });
    setExpandedCharacter(newChar.id);
  }, [bible, onBibleChange]);
  
  const handleDeleteCharacter = useCallback((characterId: string) => {
    if (!bible) return;
    onBibleChange({ 
      ...bible, 
      characters: bible.characters.filter(c => c.id !== characterId) 
    });
    if (expandedCharacter === characterId) {
      setExpandedCharacter(null);
    }
  }, [bible, onBibleChange, expandedCharacter]);
  
  const handleToggleLock = useCallback((characterId: string, trait: string) => {
    if (!bible) return;
    const char = bible.characters.find(c => c.id === characterId);
    if (!char) return;
    
    const lockedTraits = char.lockedTraits || [];
    const newLocked = lockedTraits.includes(trait)
      ? lockedTraits.filter(t => t !== trait)
      : [...lockedTraits, trait];
    
    handleCharacterUpdate(characterId, { lockedTraits: newLocked });
  }, [bible, handleCharacterUpdate]);
  
  const handleWorldUpdate = useCallback((updates: Partial<WorldBible>) => {
    if (!bible) return;
    onBibleChange({ 
      ...bible, 
      world: { ...(bible.world || { lockedWorldTraits: [] }), ...updates } 
    });
  }, [bible, onBibleChange]);
  
  const handleStyleUpdate = useCallback((updates: Partial<StyleBible>) => {
    if (!bible) return;
    onBibleChange({ 
      ...bible, 
      style: { 
        ...(bible.style || { aspectRatio: "9:16", noOnScreenText: true, additionalNegativePrompts: [] }), 
        ...updates,
        noOnScreenText: true
      } 
    });
  }, [bible, onBibleChange]);
  
  const handleSceneUpdate = useCallback((updates: Partial<SceneBible>) => {
    if (!bible) return;
    onBibleChange({ 
      ...bible, 
      scene: { 
        ...(bible.scene || { enabled: false }), 
        ...updates,
        updatedAt: new Date().toISOString()
      } 
    });
  }, [bible, onBibleChange]);
  
  if (!bible) {
    return (
      <div className="p-6 text-center space-y-4" data-testid="continuity-empty">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">No Project Bible</h3>
          <p className="text-sm text-zinc-400">
            Generate a bible to maintain consistent characters and visuals across all cards.
          </p>
        </div>
        <Button 
          onClick={onGenerate} 
          disabled={isGenerating}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          data-testid="button-generate-bible"
        >
          {isGenerating ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><Wand2 className="w-4 h-4 mr-2" /> Generate Bible</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="continuity-panel">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white">Project Bible</h3>
          <Badge variant="outline" className="text-xs">v{bible.version}</Badge>
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onGenerate}
          disabled={isGenerating}
          className="text-xs"
          data-testid="button-regenerate-bible"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-4 mx-3 mt-3">
          <TabsTrigger value="characters" className="text-xs" data-testid="tab-characters">
            <Users className="w-3 h-3 mr-1" />
            Characters
          </TabsTrigger>
          <TabsTrigger value="world" className="text-xs" data-testid="tab-world">
            <Globe className="w-3 h-3 mr-1" />
            World
          </TabsTrigger>
          <TabsTrigger value="style" className="text-xs" data-testid="tab-style">
            <Palette className="w-3 h-3 mr-1" />
            Style
          </TabsTrigger>
          <TabsTrigger value="scene" className="text-xs" data-testid="tab-scene">
            <Camera className="w-3 h-3 mr-1" />
            Scene
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1 p-3">
          <TabsContent value="characters" className="mt-0 space-y-2">
            {bible.characters.map((char) => (
              <CharacterCard 
                key={char.id}
                character={char}
                isExpanded={expandedCharacter === char.id}
                onToggleExpand={() => setExpandedCharacter(expandedCharacter === char.id ? null : char.id)}
                onUpdate={(updates) => handleCharacterUpdate(char.id, updates)}
                onDelete={() => handleDeleteCharacter(char.id)}
                onToggleLock={(trait) => handleToggleLock(char.id, trait)}
                voices={voicesData?.voices || []}
              />
            ))}
            
            <Button 
              onClick={handleAddCharacter} 
              variant="ghost" 
              className="w-full border border-dashed border-zinc-700 hover:border-zinc-500"
              data-testid="button-add-character"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Character
            </Button>
          </TabsContent>
          
          <TabsContent value="world" className="mt-0">
            <WorldEditor 
              world={bible.world} 
              onUpdate={handleWorldUpdate} 
            />
          </TabsContent>
          
          <TabsContent value="style" className="mt-0">
            <StyleEditor 
              style={bible.style} 
              onUpdate={handleStyleUpdate} 
            />
          </TabsContent>
          
          <TabsContent value="scene" className="mt-0">
            <SceneEditor 
              scene={bible.scene} 
              onUpdate={handleSceneUpdate} 
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

interface CharacterCardProps {
  character: CharacterBibleEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CharacterBibleEntry>) => void;
  onDelete: () => void;
  onToggleLock: (trait: string) => void;
  voices: Voice[];
}

function CharacterCard({ 
  character, 
  isExpanded, 
  onToggleExpand, 
  onUpdate, 
  onDelete,
  onToggleLock,
  voices
}: CharacterCardProps) {
  const lockedTraits = character.lockedTraits || [];
  
  return (
    <Card className="bg-zinc-900/50 border-zinc-800" data-testid={`character-card-${character.id}`}>
      <CardHeader className="p-3 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{character.name}</CardTitle>
            {character.role && (
              <Badge variant="secondary" className="text-xs">{character.role}</Badge>
            )}
            {lockedTraits.length > 0 && (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-3 pt-0 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Name</label>
            <Input 
              value={character.name} 
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-character-name"
            />
          </div>
          
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Role</label>
            <Input 
              value={character.role || ''} 
              onChange={(e) => onUpdate({ role: e.target.value })}
              placeholder="e.g., Protagonist, Mentor, Villain"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-character-role"
            />
          </div>
          
          {/* Voice Settings for TTS Narration */}
          <div className="space-y-2 p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/20">
            <label className="text-xs text-cyan-400 mb-1 flex items-center gap-1">
              <Mic className="w-3 h-3" />
              Voice Settings
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500">Voice</label>
                <Select 
                  value={character.voiceId || "none"} 
                  onValueChange={(v) => onUpdate({ voiceId: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700" data-testid="select-character-voice">
                    <SelectValue placeholder="No voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No voice (use default)</SelectItem>
                    {voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Default Style</label>
                <Select 
                  value={character.deliveryStyleDefault || "neutral"} 
                  onValueChange={(v: any) => onUpdate({ deliveryStyleDefault: v })}
                >
                  <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700" data-testid="select-character-delivery-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="dramatic">Dramatic</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500">
              When this character speaks, cards will use their voice and style.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block">Physical Traits</label>
            
            <div className="grid grid-cols-2 gap-2">
              <TraitInput 
                label="Age Range"
                value={character.physicalTraits?.ageRange || ''}
                onChange={(v) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, ageRange: v }
                })}
                isLocked={lockedTraits.includes('ageRange')}
                onToggleLock={() => onToggleLock('ageRange')}
              />
              <TraitInput 
                label="Build"
                value={character.physicalTraits?.build || ''}
                onChange={(v) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, build: v }
                })}
                isLocked={lockedTraits.includes('build')}
                onToggleLock={() => onToggleLock('build')}
              />
              <TraitInput 
                label="Skin Tone"
                value={character.physicalTraits?.skinTone || ''}
                onChange={(v) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, skinTone: v }
                })}
                isLocked={lockedTraits.includes('skinTone')}
                onToggleLock={() => onToggleLock('skinTone')}
              />
              <TraitInput 
                label="Hair Color"
                value={character.physicalTraits?.hairColor || ''}
                onChange={(v) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, hairColor: v }
                })}
                isLocked={lockedTraits.includes('hairColor')}
                onToggleLock={() => onToggleLock('hairColor')}
              />
              <TraitInput 
                label="Hair Style"
                value={character.physicalTraits?.hairStyle || ''}
                onChange={(v) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, hairStyle: v }
                })}
                isLocked={lockedTraits.includes('hairStyle')}
                onToggleLock={() => onToggleLock('hairStyle')}
              />
            </div>
            
            <div>
              <label className="text-xs text-zinc-500">Facial Features</label>
              <Textarea 
                value={character.physicalTraits?.facialFeatures || ''}
                onChange={(e) => onUpdate({ 
                  physicalTraits: { ...character.physicalTraits, facialFeatures: e.target.value }
                })}
                placeholder="e.g., Sharp jawline, green eyes, small scar above left eyebrow"
                className="h-16 text-sm bg-zinc-800 border-zinc-700 resize-none"
                data-testid="input-facial-features"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block">Wardrobe</label>
            <TraitInput 
              label="Style"
              value={character.wardrobeRules?.style || ''}
              onChange={(v) => onUpdate({ 
                wardrobeRules: { ...character.wardrobeRules, style: v }
              })}
              isLocked={lockedTraits.includes('wardrobeStyle')}
              onToggleLock={() => onToggleLock('wardrobeStyle')}
            />
            <div>
              <label className="text-xs text-zinc-500">Signature Items (comma-separated)</label>
              <Input 
                value={(character.wardrobeRules?.signatureItems || []).join(', ')}
                onChange={(e) => onUpdate({ 
                  wardrobeRules: { 
                    ...character.wardrobeRules, 
                    signatureItems: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }
                })}
                placeholder="e.g., leather jacket, silver ring"
                className="h-8 text-sm bg-zinc-800 border-zinc-700"
                data-testid="input-signature-items"
              />
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              data-testid="button-delete-character"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface TraitInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isLocked: boolean;
  onToggleLock: () => void;
}

function TraitInput({ label, value, onChange, isLocked, onToggleLock }: TraitInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-500">{label}</label>
        <button 
          onClick={onToggleLock}
          className={`p-0.5 rounded ${isLocked ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
          title={isLocked ? "Unlock trait (can change)" : "Lock trait (never change)"}
          data-testid={`button-lock-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>
      </div>
      <Input 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs bg-zinc-800 border-zinc-700"
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </div>
  );
}

interface WorldEditorProps {
  world: WorldBible | undefined;
  onUpdate: (updates: Partial<WorldBible>) => void;
}

function WorldEditor({ world, onUpdate }: WorldEditorProps) {
  const lockedTraits = world?.lockedWorldTraits || [];
  
  const toggleWorldLock = (trait: string) => {
    const newLocked = lockedTraits.includes(trait)
      ? lockedTraits.filter(t => t !== trait)
      : [...lockedTraits, trait];
    onUpdate({ lockedWorldTraits: newLocked });
  };

  return (
    <div className="space-y-4" data-testid="world-editor">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Setting
            {(lockedTraits.some(t => t.startsWith('setting:'))) && (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <TraitInput 
            label="Place"
            value={world?.setting?.place || ''}
            onChange={(v) => onUpdate({ setting: { ...world?.setting, place: v }})}
            isLocked={lockedTraits.includes('setting:place')}
            onToggleLock={() => toggleWorldLock('setting:place')}
          />
          <TraitInput 
            label="Era/Time Period"
            value={world?.setting?.era || ''}
            onChange={(v) => onUpdate({ setting: { ...world?.setting, era: v }})}
            isLocked={lockedTraits.includes('setting:era')}
            onToggleLock={() => toggleWorldLock('setting:era')}
          />
          <TraitInput 
            label="Culture"
            value={world?.setting?.culture || ''}
            onChange={(v) => onUpdate({ setting: { ...world?.setting, culture: v }})}
            isLocked={lockedTraits.includes('setting:culture')}
            onToggleLock={() => toggleWorldLock('setting:culture')}
          />
        </CardContent>
      </Card>
      
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium">Visual Language</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <div>
            <label className="text-xs text-zinc-500">Cinematic Style</label>
            <Input 
              value={world?.visualLanguage?.cinematicStyle || ''}
              onChange={(e) => onUpdate({ 
                visualLanguage: { ...world?.visualLanguage, cinematicStyle: e.target.value }
              })}
              placeholder="e.g., Film noir, Wes Anderson, Blade Runner"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-cinematic-style"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Lighting</label>
            <Input 
              value={world?.visualLanguage?.lighting || ''}
              onChange={(e) => onUpdate({ 
                visualLanguage: { ...world?.visualLanguage, lighting: e.target.value }
              })}
              placeholder="e.g., Natural daylight, neon-lit, golden hour"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-lighting"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Lens/Camera Vibe</label>
            <Input 
              value={world?.visualLanguage?.lensVibe || ''}
              onChange={(e) => onUpdate({ 
                visualLanguage: { ...world?.visualLanguage, lensVibe: e.target.value }
              })}
              placeholder="e.g., Anamorphic, Vintage 35mm, ARRI Alexa"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-lens-vibe"
            />
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium">Tone</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          <div>
            <label className="text-xs text-zinc-500">Mood</label>
            <Input 
              value={world?.toneRules?.mood || ''}
              onChange={(e) => onUpdate({ 
                toneRules: { ...world?.toneRules, mood: e.target.value }
              })}
              placeholder="e.g., Tense, hopeful, melancholic"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-mood"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Genre</label>
            <Input 
              value={world?.toneRules?.genre || ''}
              onChange={(e) => onUpdate({ 
                toneRules: { ...world?.toneRules, genre: e.target.value }
              })}
              placeholder="e.g., Sci-fi thriller, romantic comedy, fantasy epic"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-genre"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StyleEditorProps {
  style: StyleBible | undefined;
  onUpdate: (updates: Partial<StyleBible>) => void;
}

function StyleEditor({ style, onUpdate }: StyleEditorProps) {
  return (
    <div className="space-y-4" data-testid="style-editor">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium">Visual Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div>
            <label className="text-xs text-zinc-500">Aspect Ratio</label>
            <select 
              value={style?.aspectRatio || '9:16'}
              onChange={(e) => onUpdate({ aspectRatio: e.target.value as "9:16" | "16:9" | "1:1" | "4:3" | "3:4" })}
              className="w-full h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-white"
              data-testid="select-aspect-ratio"
            >
              <option value="9:16">9:16 (Vertical/Mobile)</option>
              <option value="16:9">16:9 (Horizontal)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:3">4:3 (Landscape)</option>
              <option value="3:4">3:4 (Portrait)</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-zinc-500">Realism Level</label>
            <select 
              value={style?.realismLevel || 'photorealistic'}
              onChange={(e) => onUpdate({ realismLevel: e.target.value as "photorealistic" | "stylized" | "illustrated" | "animated" })}
              className="w-full h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-white"
              data-testid="select-realism"
            >
              <option value="photorealistic">Photorealistic</option>
              <option value="stylized">Stylized</option>
              <option value="illustrated">Illustrated</option>
              <option value="animated">Animated</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-zinc-500">Color Grading</label>
            <Input 
              value={style?.colorGrading || ''}
              onChange={(e) => onUpdate({ colorGrading: e.target.value })}
              placeholder="e.g., Teal and orange, desaturated, vibrant"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-color-grading"
            />
          </div>
          
          <div>
            <label className="text-xs text-zinc-500">Camera Movement (for video)</label>
            <Input 
              value={style?.cameraMovement || ''}
              onChange={(e) => onUpdate({ cameraMovement: e.target.value })}
              placeholder="e.g., Static, slow dolly, handheld"
              className="h-8 text-sm bg-zinc-800 border-zinc-700"
              data-testid="input-camera-movement"
            />
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Never Generate
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-white">No On-Screen Text</label>
              <p className="text-xs text-zinc-500">Never include text, words, or letters in generated media</p>
            </div>
            <Switch 
              checked={style?.noOnScreenText !== false}
              disabled
              data-testid="switch-no-text"
            />
          </div>
          
          <div>
            <label className="text-xs text-zinc-500">Additional Negative Prompts</label>
            <Textarea 
              value={(style?.additionalNegativePrompts || []).join(', ')}
              onChange={(e) => onUpdate({ 
                additionalNegativePrompts: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="e.g., watermark, logo, signature, blurry"
              className="h-16 text-sm bg-zinc-800 border-zinc-700 resize-none"
              data-testid="input-negative-prompts"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SceneEditorProps {
  scene: SceneBible | undefined;
  onUpdate: (updates: Partial<SceneBible>) => void;
}

function SceneEditor({ scene, onUpdate }: SceneEditorProps) {
  const lockFlags = scene?.lockFlags || {
    lockEnvironment: true,
    lockCamera: true,
    lockLighting: true,
    lockBackgroundElements: true,
  };
  
  const handleLockFlagChange = (key: keyof SceneLockFlags, value: boolean) => {
    onUpdate({ lockFlags: { ...lockFlags, [key]: value } });
  };
  
  return (
    <div className="space-y-4" data-testid="scene-editor">
      {/* Enable/Disable Scene Lock */}
      <Card className="bg-cyan-900/20 border-cyan-800/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                Scene Lock
                <Badge variant="outline" className="text-[10px] border-cyan-700 text-cyan-400">Optional</Badge>
              </label>
              <p className="text-xs text-zinc-400 mt-0.5">
                Lock a physical setup for visual continuity across cards. AI will not deviate unless overridden per card.
              </p>
            </div>
            <Switch 
              checked={scene?.enabled || false}
              onCheckedChange={(checked) => onUpdate({ enabled: checked })}
              data-testid="switch-scene-enabled"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Scene Definition - only show when enabled */}
      {scene?.enabled && (
        <>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium">Scene Definition</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div>
                <label className="text-xs text-zinc-500">Scene Name</label>
                <Input 
                  value={scene?.sceneName || ''}
                  onChange={(e) => onUpdate({ sceneName: e.target.value })}
                  placeholder="e.g., Rustic Pizza Prep Table"
                  className="h-8 text-sm bg-zinc-800 border-zinc-700"
                  data-testid="input-scene-name"
                />
              </div>
              
              <div>
                <label className="text-xs text-zinc-500">Set Description (Physical Environment)</label>
                <Textarea 
                  value={scene?.setDescription || ''}
                  onChange={(e) => onUpdate({ setDescription: e.target.value })}
                  placeholder="Describe the physical environment in detail: e.g., Rustic wooden table with flour-dusted surface, ceramic bowls, warm ambient lighting from left window..."
                  className="h-20 text-sm bg-zinc-800 border-zinc-700 resize-none"
                  data-testid="input-set-description"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium">Camera Setup</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div>
                <label className="text-xs text-zinc-500">Camera Angle</label>
                <select 
                  value={scene?.cameraAngle || ''}
                  onChange={(e) => onUpdate({ cameraAngle: e.target.value as CameraAngle })}
                  className="w-full h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-white"
                  data-testid="select-camera-angle"
                >
                  <option value="">Select angle...</option>
                  <option value="TOP_DOWN">Top Down (Bird's Eye)</option>
                  <option value="FORTY_FIVE_DEGREE">45° Angle (Three-Quarter View)</option>
                  <option value="EYE_LEVEL">Eye Level (Natural)</option>
                  <option value="CUSTOM">Custom (specify below)</option>
                </select>
              </div>
              
              {scene?.cameraAngle === "CUSTOM" && (
                <div>
                  <label className="text-xs text-zinc-500">Custom Camera Description</label>
                  <Input 
                    value={scene?.cameraAngleCustom || ''}
                    onChange={(e) => onUpdate({ cameraAngleCustom: e.target.value })}
                    placeholder="e.g., Low angle looking up at the chef"
                    className="h-8 text-sm bg-zinc-800 border-zinc-700"
                    data-testid="input-camera-custom"
                  />
                </div>
              )}
              
              <div>
                <label className="text-xs text-zinc-500">Framing Notes</label>
                <Input 
                  value={scene?.framingNotes || ''}
                  onChange={(e) => onUpdate({ framingNotes: e.target.value })}
                  placeholder="e.g., Table fills frame, hands visible, no faces"
                  className="h-8 text-sm bg-zinc-800 border-zinc-700"
                  data-testid="input-framing-notes"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium">Lighting</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <div>
                <label className="text-xs text-zinc-500">Lighting Notes</label>
                <Textarea 
                  value={scene?.lightingNotes || ''}
                  onChange={(e) => onUpdate({ lightingNotes: e.target.value })}
                  placeholder="e.g., Natural daylight from left window, soft shadows, warm golden tones"
                  className="h-16 text-sm bg-zinc-800 border-zinc-700 resize-none"
                  data-testid="input-lighting-notes"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Lock Controls
              </CardTitle>
              <p className="text-xs text-zinc-500 mt-1">
                Toggle which elements AI must preserve across all cards
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="flex items-center justify-between py-1">
                <div>
                  <label className="text-sm text-white">Lock Environment</label>
                  <p className="text-xs text-zinc-500">Same set/props in every shot</p>
                </div>
                <Switch 
                  checked={lockFlags.lockEnvironment}
                  onCheckedChange={(v) => handleLockFlagChange('lockEnvironment', v)}
                  data-testid="switch-lock-environment"
                />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <div>
                  <label className="text-sm text-white">Lock Camera</label>
                  <p className="text-xs text-zinc-500">Same angle and framing</p>
                </div>
                <Switch 
                  checked={lockFlags.lockCamera}
                  onCheckedChange={(v) => handleLockFlagChange('lockCamera', v)}
                  data-testid="switch-lock-camera"
                />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <div>
                  <label className="text-sm text-white">Lock Lighting</label>
                  <p className="text-xs text-zinc-500">Same lighting direction and quality</p>
                </div>
                <Switch 
                  checked={lockFlags.lockLighting}
                  onCheckedChange={(v) => handleLockFlagChange('lockLighting', v)}
                  data-testid="switch-lock-lighting"
                />
              </div>
              
              <div className="flex items-center justify-between py-1">
                <div>
                  <label className="text-sm text-white">Lock Background</label>
                  <p className="text-xs text-zinc-500">Same background elements</p>
                </div>
                <Switch 
                  checked={lockFlags.lockBackgroundElements}
                  onCheckedChange={(v) => handleLockFlagChange('lockBackgroundElements', v)}
                  data-testid="switch-lock-background"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export function ContinuityWarningBanner({ 
  warnings,
  onDismiss,
  onGenerateBible
}: { 
  warnings: { type: string; message: string; severity: string }[];
  onDismiss?: () => void;
  onGenerateBible?: () => void;
}) {
  if (warnings.length === 0) return null;
  
  const severeWarnings = warnings.filter(w => w.severity === 'error' || w.severity === 'warning');
  if (severeWarnings.length === 0) return null;
  
  return (
    <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 mb-4" data-testid="continuity-warning-banner">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm">
          <p className="text-amber-200 font-medium">Continuity Issues Detected</p>
          <ul className="text-amber-300/80 text-xs mt-1 space-y-0.5">
            {severeWarnings.slice(0, 3).map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
          {warnings.find(w => w.type === 'missing_bible') && onGenerateBible && (
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={onGenerateBible}
              className="mt-2 text-amber-400 hover:text-amber-300 p-0 h-auto"
              data-testid="button-generate-bible-banner"
            >
              <Wand2 className="w-3 h-3 mr-1" />
              Generate Project Bible
            </Button>
          )}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-400">
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
