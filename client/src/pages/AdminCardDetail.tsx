import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Image as ImageIcon, Video, Loader2, CheckCircle, Clock, MapPin, Users } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

export default function AdminCardDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cardId = parseInt(id || "0");

  const { data: card, isLoading: cardLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => api.getCard(cardId),
    enabled: cardId > 0,
  });

  const { data: universe } = useQuery({
    queryKey: ["universe", card?.universeId],
    queryFn: () => api.getUniverse(card!.universeId),
    enabled: !!card?.universeId,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", card?.universeId],
    queryFn: () => api.getCharacters(card!.universeId),
    enabled: !!card?.universeId,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations", card?.universeId],
    queryFn: () => api.getLocations(card!.universeId),
    enabled: !!card?.universeId,
  });

  const generateImageMutation = useMutation({
    mutationFn: () => api.generateCardImage(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Image generated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: () => api.generateCardVideo(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast({ title: "Video generated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Video generation failed", description: error.message, variant: "destructive" });
    },
  });

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You need admin privileges to access this page.</p>
          <Link href="/"><Button>Go Home</Button></Link>
        </div>
      </Layout>
    );
  }

  if (cardLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!card) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-display font-bold mb-4">Card Not Found</h2>
          <Link href="/admin"><Button>Back to Admin</Button></Link>
        </div>
      </Layout>
    );
  }

  const displayImage = card.generatedImageUrl || card.imagePath;
  const hasPrompt = !!(card.sceneDescription || card.imageGeneration?.prompt);
  const primaryChars = characters?.filter(c => card.primaryCharacterIds?.includes(c.id)) || [];
  const location = locations?.find(l => l.id === card.locationId);

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-display font-bold">Day {card.dayIndex}: {card.title}</h1>
            <p className="text-sm text-muted-foreground">{universe?.name} &bull; Season 1</p>
          </div>
          <Link href={`/admin/cards/${cardId}/edit`}>
            <Button className="gap-2" data-testid="button-edit-card">
              <Edit className="w-4 h-4" /> Edit Card
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Card Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden relative">
                {displayImage ? (
                  <img src={displayImage} className="w-full h-full object-cover" alt={card.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                  </div>
                )}
                {card.imageGenerated && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Image ready
                  </div>
                )}
              </div>
              <Button 
                className="w-full gap-2" 
                onClick={() => generateImageMutation.mutate()}
                disabled={generateImageMutation.isPending || !hasPrompt}
                data-testid="button-generate-image"
              >
                {generateImageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                Generate AI Image
              </Button>
              {!hasPrompt && (
                <p className="text-xs text-muted-foreground text-center">No prompt available. Add scene_description or image_generation.prompt to generate.</p>
              )}
              <Button 
                className="w-full gap-2" 
                variant="outline"
                onClick={() => generateVideoMutation.mutate()}
                disabled={generateVideoMutation.isPending || !displayImage}
                data-testid="button-generate-video"
              >
                {generateVideoMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Generate AI Video
              </Button>
              {card.videoGenerated && (
                <p className="text-xs text-green-500 text-center flex items-center justify-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Video ready
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Card Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={card.status === 'published' ? 'default' : 'secondary'}>
                    {card.status}
                  </Badge>
                  {card.publishAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(card.publishAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Scene Text</p>
                  <p className="text-sm">{card.sceneText || <span className="text-muted-foreground italic">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Recap Text</p>
                  <p className="text-sm">{card.recapText || <span className="text-muted-foreground italic">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Captions</p>
                  {card.captionsJson?.length ? (
                    <ul className="list-disc list-inside text-sm">
                      {(card.captionsJson as string[]).map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No captions</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">References</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3 h-3" /> Characters
                  </p>
                  {primaryChars.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {primaryChars.map(c => (
                        <Badge key={c.id} variant="outline">{c.name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No characters assigned</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location
                  </p>
                  {location ? (
                    <Badge variant="outline">{location.name}</Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No location assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Image Generation Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Scene Description</p>
                  <p className="text-sm">{card.sceneDescription || <span className="text-muted-foreground italic">Not set</span>}</p>
                </div>
                {card.imageGeneration && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Prompt</p>
                      <p className="text-sm">{card.imageGeneration.prompt || <span className="text-muted-foreground italic">Not set</span>}</p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Shot Type</p>
                        <p className="text-sm">{card.imageGeneration.shotType || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Lighting</p>
                        <p className="text-sm">{card.imageGeneration.lighting || '-'}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
