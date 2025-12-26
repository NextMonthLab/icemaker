import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Calendar, Eye, ImageIcon, Loader2, Plus, Video, Shield, AlertTriangle, Share2 } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SourceGuardrails } from "@shared/schema";

export default function AdminUniverseDetail() {
  const { id } = useParams<{ id: string }>();
  const universeId = parseInt(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: universe, isLoading: universeLoading } = useQuery({
    queryKey: ["universe", universeId],
    queryFn: async () => {
      const universes = await api.getUniverses();
      return universes.find(u => u.id === universeId);
    },
    enabled: !!universeId,
  });

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", universeId],
    queryFn: () => api.getCards(universeId),
    enabled: !!universeId,
  });

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Admin access required</p>
          <Link href="/login">
            <Button className="mt-4">Login</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (universeLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!universe) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Universe not found</p>
          <Link href="/admin">
            <Button className="mt-4">Back to Admin</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const publishedCards = cards?.filter(c => c.status === "published") || [];
  const draftCards = cards?.filter(c => c.status === "draft") || [];

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-universe-detail">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" data-testid="text-universe-name">{universe.name}</h1>
            <p className="text-muted-foreground text-sm">{universe.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/universes/${universeId}/export`}>
              <Button variant="outline" className="gap-2" data-testid="button-export">
                <Share2 className="w-4 h-4" />
                Export
              </Button>
            </Link>
            <Link href={universe?.slug ? `/story/${universe.slug}` : "/"}>
              <Button variant="outline" className="gap-2">
                <Eye className="w-4 h-4" />
                View Story
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{cards?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Cards</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Calendar className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{publishedCards.length}</p>
                  <p className="text-xs text-muted-foreground">Published</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <ImageIcon className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{cards?.filter(c => c.imageGenerated).length || 0}</p>
                  <p className="text-xs text-muted-foreground">With Images</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Plus className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{draftCards.length}</p>
                  <p className="text-xs text-muted-foreground">Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Source Guardrails Section */}
        {universe.sourceGuardrails && (
          <Card data-testid="guardrails-section">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Source Guardrails</CardTitle>
              </div>
              <CardDescription>
                These grounding rules were extracted from the source material to prevent AI hallucination.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium text-primary mb-1">Grounding Statement</p>
                <p className="text-sm">{(universe.sourceGuardrails as SourceGuardrails).groundingStatement}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Creative Latitude</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm ${
                    (universe.sourceGuardrails as SourceGuardrails).creativeLatitude === "strict" 
                      ? "bg-red-500/10 text-red-500" 
                      : (universe.sourceGuardrails as SourceGuardrails).creativeLatitude === "moderate"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-green-500/10 text-green-500"
                  }`}>
                    {(universe.sourceGuardrails as SourceGuardrails).creativeLatitude === "strict" 
                      ? "Strict - Stay purely factual" 
                      : (universe.sourceGuardrails as SourceGuardrails).creativeLatitude === "moderate"
                      ? "Moderate - Interpret but don't invent"
                      : "Liberal - Allow creative interpretation"}
                  </span>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Core Themes</p>
                  <div className="flex flex-wrap gap-1">
                    {(universe.sourceGuardrails as SourceGuardrails).coreThemes?.map((theme, i) => (
                      <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{theme}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Tone Constraints</p>
                  <div className="flex flex-wrap gap-1">
                    {(universe.sourceGuardrails as SourceGuardrails).toneConstraints?.map((tone, i) => (
                      <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">{tone}</span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    Exclusions (AI Must NOT Introduce)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(universe.sourceGuardrails as SourceGuardrails).exclusions?.length > 0 ? (
                      (universe.sourceGuardrails as SourceGuardrails).exclusions.map((exc, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-xs">{exc}</span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No explicit exclusions</span>
                    )}
                  </div>
                </div>
              </div>
              
              {(universe.sourceGuardrails as SourceGuardrails).quotableElements?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Quotable Elements from Source</p>
                  <div className="space-y-1">
                    {(universe.sourceGuardrails as SourceGuardrails).quotableElements.slice(0, 5).map((quote, i) => (
                      <p key={i} className="text-xs italic text-muted-foreground pl-3 border-l-2 border-primary/30">"{quote}"</p>
                    ))}
                  </div>
                </div>
              )}
              
              {(universe.sourceGuardrails as SourceGuardrails).sensitiveTopics?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Sensitive Topics (Handle with Care)</p>
                  <div className="flex flex-wrap gap-1">
                    {(universe.sourceGuardrails as SourceGuardrails).sensitiveTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded text-xs">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Story Cards</CardTitle>
          </CardHeader>
          <CardContent>
            {cardsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : cards && cards.length > 0 ? (
              <div className="space-y-3">
                {cards.sort((a, b) => a.dayIndex - b.dayIndex).map(card => (
                  <Link key={card.id} href={`/admin/cards/${card.id}`}>
                    <div className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="w-16 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                        {card.generatedImageUrl || card.imagePath ? (
                          <img 
                            src={card.generatedImageUrl || card.imagePath || ""} 
                            alt={card.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">Day {card.dayIndex}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            card.status === "published" 
                              ? "bg-green-500/10 text-green-500" 
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}>
                            {card.status}
                          </span>
                        </div>
                        <p className="font-medium truncate">{card.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{card.sceneText}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No cards yet</p>
                <Link href="/admin/create">
                  <Button className="mt-4 gap-2">
                    <Plus className="w-4 h-4" />
                    Create First Card
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
