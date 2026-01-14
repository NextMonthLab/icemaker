import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  UserPlus, GraduationCap, Briefcase, Package, UtensilsCrossed, Home,
  ClipboardList, Magnet, Film, Sparkles, ArrowLeft, ArrowRight, Check,
  Wand2, FileInput, ChevronRight
} from "lucide-react";
import { 
  templateCategories, 
  templateFamilies, 
  lengthOptions, 
  styleOptions,
  generateBlueprintCards,
  type TemplateFamilyId,
  type LengthOption,
  type IceBlueprint,
} from "@shared/templateFamilies";
import { transformBlueprintToIceDraft } from "@shared/blueprintTransformer";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  UserPlus, GraduationCap, Briefcase, Package, UtensilsCrossed, Home,
  ClipboardList, Magnet, Film, Sparkles,
};

type WizardStep = "entry" | "category" | "length" | "structure" | "style" | "generating";

interface WizardState {
  templateFamily: TemplateFamilyId | null;
  length: LengthOption;
  structureId: string | null;
  style: {
    visualStyle: "clean" | "cinematic" | "playful" | "corporate";
    voiceMode: "none" | "narrator" | "character";
    interactionMode: "none" | "qna" | "choices";
    titlePackVibe: "modern" | "bold" | "minimal" | "retro";
  };
}

export default function CreateIcePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("entry");
  const [state, setState] = useState<WizardState>({
    templateFamily: null,
    length: "standard",
    structureId: null,
    style: {
      visualStyle: "cinematic",
      voiceMode: "none",
      interactionMode: "none",
      titlePackVibe: "modern",
    },
  });

  const createIceMutation = useMutation({
    mutationFn: async (blueprint: IceBlueprint) => {
      const draft = transformBlueprintToIceDraft(blueprint);
      const response = await apiRequest("POST", "/api/ice/preview/wizard", {
        blueprint,
        draft,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "ICE created!", description: "Opening in editor..." });
      navigate(`/ice/edit/${data.previewId}`);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create ICE", 
        description: error.message,
        variant: "destructive" 
      });
      setStep("style");
    },
  });

  const handleGenerateBlueprint = useCallback(() => {
    if (!state.templateFamily || !state.structureId) return;
    
    const family = templateFamilies[state.templateFamily];
    const cards = generateBlueprintCards(family, state.structureId, state.length);
    
    const blueprint: IceBlueprint = {
      templateFamily: state.templateFamily,
      length: state.length,
      structureId: state.structureId,
      style: state.style,
      cards,
    };
    
    setStep("generating");
    createIceMutation.mutate(blueprint);
  }, [state, createIceMutation]);

  const stepProgress = {
    entry: 0,
    category: 25,
    length: 50,
    structure: 75,
    style: 90,
    generating: 100,
  };

  const goBack = () => {
    const steps: WizardStep[] = ["entry", "category", "length", "structure", "style"];
    const currentIdx = steps.indexOf(step);
    if (currentIdx > 0) setStep(steps[currentIdx - 1]);
  };

  if (step === "entry") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Create Your ICE</h1>
            <p className="text-muted-foreground text-lg">
              Choose how you want to build your Interactive Content Experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-cyan-500"
              onClick={() => setStep("category")}
              data-testid="card-wizard-start"
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl">Start from Scratch</CardTitle>
                <CardDescription>
                  Use the wizard to design your ICE step by step
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-cyan-500" />
                    Choose from 10 template families
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-cyan-500" />
                    Select length and structure
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-cyan-500" />
                    Customize style and interactions
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600">
                  Start Wizard
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer hover-elevate transition-all border-2 hover:border-cyan-500"
              onClick={() => navigate("/guest-ice")}
              data-testid="card-injection-start"
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4">
                  <FileInput className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl">Ingest Content</CardTitle>
                <CardDescription>
                  Transform existing content into an ICE
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-purple-500" />
                    Upload documents, PDFs, scripts
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-purple-500" />
                    Import from URLs
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-purple-500" />
                    AI-powered structuring
                  </li>
                </ul>
                <Button variant="outline" className="w-full">
                  Ingest Content
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={goBack}
              disabled={step === "generating"}
              data-testid="button-wizard-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Badge variant="outline" className="text-cyan-500 border-cyan-500">
              ICE Wizard
            </Badge>
          </div>
          <Progress value={stepProgress[step]} className="h-2" />
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-6">
        {step === "category" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">What are you creating?</h2>
              <p className="text-muted-foreground">Choose a template family that fits your goal</p>
            </div>
            
            <div className="space-y-8">
              {templateCategories.map((category) => (
                <div key={category.id}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    {category.label}
                    <span className="text-sm font-normal text-muted-foreground">
                      {category.description}
                    </span>
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {category.families.map((familyId) => {
                      const family = templateFamilies[familyId as TemplateFamilyId];
                      if (!family) return null;
                      const IconComponent = iconMap[family.icon] || Sparkles;
                      const isSelected = state.templateFamily === familyId;
                      
                      return (
                        <Card
                          key={familyId}
                          className={`cursor-pointer hover-elevate transition-all ${
                            isSelected ? "border-cyan-500 bg-cyan-500/5" : ""
                          }`}
                          onClick={() => {
                            setState(s => ({ 
                              ...s, 
                              templateFamily: familyId as TemplateFamilyId,
                              structureId: family.structures[0]?.id || null,
                            }));
                            setStep("length");
                          }}
                          data-testid={`card-template-${familyId}`}
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected 
                                ? "bg-cyan-500 text-white" 
                                : "bg-muted"
                            }`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{family.label}</h4>
                              <p className="text-sm text-muted-foreground">
                                {family.description}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {step === "length" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">How long should it be?</h2>
              <p className="text-muted-foreground">Choose the depth of your experience</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {lengthOptions.map((option) => {
                const isSelected = state.length === option.id;
                
                return (
                  <Card
                    key={option.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isSelected ? "border-cyan-500 bg-cyan-500/5" : ""
                    }`}
                    onClick={() => {
                      setState(s => ({ ...s, length: option.id }));
                      setStep("structure");
                    }}
                    data-testid={`card-length-${option.id}`}
                  >
                    <CardContent className="p-6 text-center">
                      <div className={`text-4xl font-bold mb-2 ${
                        isSelected ? "text-cyan-500" : ""
                      }`}>
                        {option.cardCount}
                      </div>
                      <div className="font-medium mb-1">{option.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {option.cardCount} cards
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        
        {step === "structure" && state.templateFamily && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Choose your structure</h2>
              <p className="text-muted-foreground">
                Select the narrative arc for your {templateFamilies[state.templateFamily].label}
              </p>
            </div>
            
            <div className="space-y-4 max-w-2xl mx-auto">
              {templateFamilies[state.templateFamily].structures.map((structure) => {
                const isSelected = state.structureId === structure.id;
                
                return (
                  <Card
                    key={structure.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isSelected ? "border-cyan-500 bg-cyan-500/5" : ""
                    }`}
                    onClick={() => {
                      setState(s => ({ ...s, structureId: structure.id }));
                      setStep("style");
                    }}
                    data-testid={`card-structure-${structure.id}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium mb-1">{structure.label}</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            {structure.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {structure.cardArc.slice(0, 5).map((arc, i) => (
                              <Badge 
                                key={i} 
                                variant="outline" 
                                className="text-xs"
                              >
                                {arc.title}
                              </Badge>
                            ))}
                            {structure.cardArc.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{structure.cardArc.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ArrowRight className={`w-5 h-5 shrink-0 ${
                          isSelected ? "text-cyan-500" : "text-muted-foreground"
                        }`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        
        {step === "style" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Style your experience</h2>
              <p className="text-muted-foreground">Fine-tune the look and feel</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div>
                <h4 className="font-medium mb-3">Visual Style</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {styleOptions.visualStyle.map((option) => (
                    <Button
                      key={option.id}
                      variant={state.style.visualStyle === option.id ? "default" : "outline"}
                      className={state.style.visualStyle === option.id ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                      onClick={() => setState(s => ({ 
                        ...s, 
                        style: { ...s.style, visualStyle: option.id as any } 
                      }))}
                      data-testid={`button-style-visual-${option.id}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Voice</h4>
                <div className="grid grid-cols-3 gap-3">
                  {styleOptions.voiceMode.map((option) => (
                    <Button
                      key={option.id}
                      variant={state.style.voiceMode === option.id ? "default" : "outline"}
                      className={state.style.voiceMode === option.id ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                      onClick={() => setState(s => ({ 
                        ...s, 
                        style: { ...s.style, voiceMode: option.id as any } 
                      }))}
                      data-testid={`button-style-voice-${option.id}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Interaction</h4>
                <div className="grid grid-cols-3 gap-3">
                  {styleOptions.interactionMode.map((option) => (
                    <Button
                      key={option.id}
                      variant={state.style.interactionMode === option.id ? "default" : "outline"}
                      className={state.style.interactionMode === option.id ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                      onClick={() => setState(s => ({ 
                        ...s, 
                        style: { ...s.style, interactionMode: option.id as any } 
                      }))}
                      data-testid={`button-style-interaction-${option.id}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Title Style</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {styleOptions.titlePackVibe.map((option) => (
                    <Button
                      key={option.id}
                      variant={state.style.titlePackVibe === option.id ? "default" : "outline"}
                      className={state.style.titlePackVibe === option.id ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                      onClick={() => setState(s => ({ 
                        ...s, 
                        style: { ...s.style, titlePackVibe: option.id as any } 
                      }))}
                      data-testid={`button-style-title-${option.id}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="pt-6">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  onClick={handleGenerateBlueprint}
                  disabled={!state.templateFamily || !state.structureId || createIceMutation.isPending}
                  data-testid="button-generate-ice"
                >
                  {createIceMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Wand2 className="w-5 h-5 mr-2" />
                  )}
                  {createIceMutation.isPending ? "Creating..." : "Generate ICE Blueprint"}
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {step === "generating" && (
          <div className="animate-in fade-in duration-500 text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center animate-pulse">
              <Wand2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Creating your ICE...</h2>
            <p className="text-muted-foreground">
              Building your {state.length} {state.templateFamily} experience
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
