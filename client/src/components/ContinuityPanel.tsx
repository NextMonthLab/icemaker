import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  RefreshCw
} from "lucide-react";
import type { 
  ProjectBible, 
  CharacterBibleEntry, 
  WorldBible, 
  StyleBible 
} from "@shared/schema";

interface ContinuityPanelProps {
  previewId: string;
  bible: ProjectBible | null;
  onBibleChange: (bible: ProjectBible) => void;
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
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
  
  if (!bible) {
    return (
      <div className="p-6 text-center space-y-4" data-testid="continuity-empty">
        <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-purple-400" />
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
          className="bg-purple-600 hover:bg-purple-700"
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
        <TabsList className="grid grid-cols-3 mx-3 mt-3">
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
}

function CharacterCard({ 
  character, 
  isExpanded, 
  onToggleExpand, 
  onUpdate, 
  onDelete,
  onToggleLock 
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
              onChange={(e) => onUpdate({ aspectRatio: e.target.value })}
              className="w-full h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-white"
              data-testid="select-aspect-ratio"
            >
              <option value="9:16">9:16 (Vertical/Mobile)</option>
              <option value="16:9">16:9 (Horizontal)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5 (Portrait)</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-zinc-500">Realism Level</label>
            <select 
              value={style?.realismLevel || 'photorealistic'}
              onChange={(e) => onUpdate({ realismLevel: e.target.value })}
              className="w-full h-8 text-sm bg-zinc-800 border border-zinc-700 rounded-md px-2 text-white"
              data-testid="select-realism"
            >
              <option value="photorealistic">Photorealistic</option>
              <option value="cinematic">Cinematic</option>
              <option value="stylized">Stylized</option>
              <option value="animated">Animated</option>
              <option value="painterly">Painterly</option>
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
