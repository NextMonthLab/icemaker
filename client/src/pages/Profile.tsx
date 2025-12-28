import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Crown, LogOut, Clock, MessageSquare, Shield, Edit, ExternalLink, Save, Loader2 } from "lucide-react";
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
      <div className="p-4 pt-8 md:p-8 max-w-md mx-auto space-y-8 animate-in fade-in duration-500">
        
        <h1 className="text-3xl font-display font-bold">Operative Profile</h1>

        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
            <Avatar className="h-16 w-16 border-2 border-primary">
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold" data-testid="text-username">{user.username}</h2>
                    <Badge variant="outline" className="border-primary text-primary text-[10px] uppercase">
                      {user.isAdmin ? "Admin" : "Free Tier"}
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email || "No email"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
        </div>

        {/* Admin Link */}
        {user.isAdmin && (
          <Link href="/admin">
            <Button className="w-full" variant="outline" data-testid="button-admin">
              <Shield className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
          </Link>
        )}

        {/* Creator Profile Section */}
        {isCreator && creatorProfile && (
          <Card data-testid="card-creator-profile">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  Creator Profile
                </CardTitle>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <CardDescription>
                Your public profile is visible at{" "}
                {creatorProfile.slug ? (
                  <Link href={`/creator/${creatorProfile.slug}`} className="text-primary hover:underline">
                    /creator/{creatorProfile.slug}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Set a profile URL to share</span>
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
                      placeholder="e.g., Tech Journalist, History Educator"
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
                      rows={4}
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
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase">Display Name</span>
                    <p className="font-medium">{creatorProfile.displayName}</p>
                  </div>
                  {creatorProfile.headline && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Headline</span>
                      <p>{creatorProfile.headline}</p>
                    </div>
                  )}
                  {creatorProfile.bio && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">Bio</span>
                      <p className="text-sm">{creatorProfile.bio}</p>
                    </div>
                  )}
                  {creatorProfile.externalLink && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase">External Link</span>
                      <a href={creatorProfile.externalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="w-4 h-4" />
                        {creatorProfile.externalLink}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
            <Card>
                <CardContent className="p-4 flex flex-col items-center text-center">
                    <Clock className="w-6 h-6 text-primary mb-2" />
                    <span className="text-2xl font-bold" data-testid="text-streak">{progress?.currentStreak || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase">Day Streak</span>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4 flex flex-col items-center text-center">
                    <MessageSquare className="w-6 h-6 text-primary mb-2" />
                    <span className="text-2xl font-bold" data-testid="text-unlocked">{progress?.unlockedDayIndex || 0}</span>
                    <span className="text-xs text-muted-foreground uppercase">Cards Unlocked</span>
                </CardContent>
            </Card>
        </div>

        {/* Usage Limits */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    Daily Energy
                </h3>
                <span className="text-sm font-mono text-muted-foreground">∞ Unlimited</span>
            </div>
            <Progress value={100} className="h-2" />
            <p className="text-xs text-muted-foreground">
                Full access to all features. Enjoy unlimited chat and story interactions!
            </p>
        </div>

        {/* Upgrade Call to Action */}
        <Card className="border-primary/50 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <Crown className="w-24 h-24 rotate-12" />
            </div>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <Crown className="w-5 h-5 fill-current" />
                    NextMonth PRO
                </CardTitle>
                <CardDescription>
                    Future premium features will be available here.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" /> Priority Story Access
                    </li>
                    <li className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" /> Exclusive Universes
                    </li>
                    <li className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" /> 4K Video Downloads
                    </li>
                </ul>
                <Button className="w-full font-bold" disabled>
                    Coming Soon
                </Button>
            </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
