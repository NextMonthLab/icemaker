import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, Crown, LogOut, Clock, MessageSquare, Shield, Edit, ExternalLink, Save, Loader2,
  Eye, Play, Plus, Sparkles, BarChart3, Users, ChevronRight
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppContext } from "@/lib/app-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface CreatorProfile {
  id: number;
  userId: number;
  slug: string | null;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  externalLink: string | null;
}

interface ActiveIceSummary {
  currentActive: number;
  limit: number;
  remaining: number;
  analyticsEnabled: boolean;
  chatEnabled: boolean;
}

interface CreatorStats {
  totalIces: number;
  totalViews: number;
  totalEngagements: number;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { universe } = useAppContext();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    headline: "",
    bio: "",
    externalLink: "",
    slug: "",
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", universe?.id],
    queryFn: () => api.getProgress(universe!.id),
    enabled: !!universe && !!user,
  });
  
  const { data: creatorProfile, isLoading: loadingProfile } = useQuery<CreatorProfile>({
    queryKey: ["creatorProfile"],
    queryFn: async () => {
      const res = await fetch("/api/me/creator-profile");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && (user.role === "creator" || user.isAdmin),
  });

  const { data: activeIces } = useQuery<ActiveIceSummary>({
    queryKey: ["/api/user/active-ices"],
    enabled: !!user,
  });

  const { data: creatorStats } = useQuery<CreatorStats>({
    queryKey: ["/api/me/creator-stats"],
    enabled: !!user,
  });
  
  useEffect(() => {
    if (creatorProfile) {
      setEditForm({
        displayName: creatorProfile.displayName || "",
        headline: creatorProfile.headline || "",
        bio: creatorProfile.bio || "",
        externalLink: creatorProfile.externalLink || "",
        slug: creatorProfile.slug || "",
      });
    }
  }, [creatorProfile]);
  
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch("/api/me/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatorProfile"] });
      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your creator profile has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
      setLocation("/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  const initials = user.username.slice(0, 2).toUpperCase();
  const isCreator = user.role === "creator" || user.isAdmin;

  return (
    <Layout>
      <div className="p-4 pt-8 md:p-8 max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
        
        <h1 className="text-3xl font-display font-bold">Your Profile</h1>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
            <Avatar className="h-16 w-16 border-2 border-cyan-500">
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold truncate" data-testid="text-username">{user.username}</h2>
                    <Badge variant="outline" className="border-cyan-500 text-cyan-500 text-[10px] uppercase shrink-0">
                      {user.isAdmin ? "Admin" : user.role === "creator" ? "Creator" : "Member"}
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{user.email || "No email"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
        </div>

        {user.isAdmin && (
          <Link href="/admin">
            <Button className="w-full" variant="outline" data-testid="button-admin">
              <Shield className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
          </Link>
        )}

        <Tabs defaultValue="creator" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="creator" className="gap-2" data-testid="tab-creator">
              <Sparkles className="w-4 h-4" />
              Creator
            </TabsTrigger>
            <TabsTrigger value="consumer" className="gap-2" data-testid="tab-consumer">
              <Play className="w-4 h-4" />
              Explorer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="creator" className="space-y-4 mt-4">
            <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-600/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-500" />
                  Your ICE Creations
                </CardTitle>
                <CardDescription>
                  Build interactive content experiences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <div className="text-2xl font-bold text-cyan-500" data-testid="text-ices-created">
                      {activeIces?.currentActive ?? creatorStats?.totalIces ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">ICEs Active</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <div className="text-2xl font-bold" data-testid="text-total-views">
                      {creatorStats?.totalViews ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Views</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <div className="text-2xl font-bold" data-testid="text-engagements">
                      {creatorStats?.totalEngagements ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Engagements</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link href="/create" className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700" data-testid="button-create-ice">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New ICE
                    </Button>
                  </Link>
                  <Link href="/launchpad">
                    <Button variant="outline" size="icon" data-testid="button-launchpad">
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {activeIces && activeIces.limit !== -1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active ICE Slots</span>
                  <span className="font-mono">{activeIces.currentActive} / {activeIces.limit}</span>
                </div>
                <Progress value={(activeIces.currentActive / activeIces.limit) * 100} className="h-2" />
              </div>
            )}

            {isCreator && creatorProfile && (
              <Card data-testid="card-creator-profile">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Public Profile
                    </CardTitle>
                    {!isEditing && (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    {creatorProfile.slug ? (
                      <Link href={`/creator/${creatorProfile.slug}`} className="text-cyan-500 hover:underline flex items-center gap-1">
                        /creator/{creatorProfile.slug}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span>Set a profile URL to share</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <form onSubmit={(e) => { e.preventDefault(); updateProfileMutation.mutate(editForm); }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                          placeholder="Your name"
                          data-testid="input-display-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Profile URL</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">/creator/</span>
                          <Input
                            id="slug"
                            value={editForm.slug}
                            onChange={(e) => setEditForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                            placeholder="your-name"
                            data-testid="input-slug"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="headline">Headline</Label>
                        <Input
                          id="headline"
                          value={editForm.headline}
                          onChange={(e) => setEditForm(f => ({ ...f, headline: e.target.value }))}
                          placeholder="e.g., L&D Specialist, Content Creator"
                          data-testid="input-headline"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                          id="bio"
                          value={editForm.bio}
                          onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))}
                          placeholder="Tell viewers about yourself..."
                          rows={3}
                          data-testid="input-bio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="externalLink">External Link</Label>
                        <Input
                          id="externalLink"
                          value={editForm.externalLink}
                          onChange={(e) => setEditForm(f => ({ ...f, externalLink: e.target.value }))}
                          placeholder="https://yourwebsite.com"
                          type="url"
                          data-testid="input-external-link"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                          {updateProfileMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium">{creatorProfile.displayName}</span>
                      </div>
                      {creatorProfile.headline && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Headline</span>
                          <span>{creatorProfile.headline}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="consumer" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="w-5 h-5 text-cyan-500" />
                  Your Learning Journey
                </CardTitle>
                <CardDescription>
                  Track your progress exploring ICE content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-card border">
                    <Clock className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
                    <span className="text-2xl font-bold block" data-testid="text-streak">{progress?.currentStreak || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase">Day Streak</span>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-card border">
                    <MessageSquare className="w-6 h-6 text-cyan-500 mx-auto mb-2" />
                    <span className="text-2xl font-bold block" data-testid="text-unlocked">{progress?.unlockedDayIndex || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase">Cards Viewed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  Daily Energy
                </h3>
                <span className="text-sm font-mono text-muted-foreground">∞ Unlimited</span>
              </div>
              <Progress value={100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Full access to explore and interact with all ICE content.
              </p>
            </div>

            <Link href="/explore">
              <Button variant="outline" className="w-full" data-testid="button-explore">
                <Eye className="w-4 h-4 mr-2" />
                Explore Public ICEs
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </TabsContent>
        </Tabs>

        <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-600/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Crown className="w-20 h-20 rotate-12" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-cyan-500">
              <Crown className="w-5 h-5" />
              Upgrade Your Plan
            </CardTitle>
            <CardDescription>
              Unlock advanced features for creators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-500" /> Unlimited Active ICEs
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-500" /> Advanced Analytics
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-500" /> Conversation Insights
              </li>
            </ul>
            <Link href="/pricing">
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600" data-testid="button-upgrade">
                View Plans
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
