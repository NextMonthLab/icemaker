import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LogOut, Clock, MessageSquare, Shield,
  Play, Plus, Sparkles, BarChart3, Zap,
  Eye, ChevronRight, Crown, ArrowLeft
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppContext } from "@/lib/app-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import CreatorProfileEditor from "@/components/CreatorProfileEditor";

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

  const { data: progress } = useQuery({
    queryKey: ["progress", universe?.id],
    queryFn: () => api.getProgress(universe!.id),
    enabled: !!universe && !!user,
  });
  
  const { data: creatorProfile } = useQuery<CreatorProfile>({
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="p-4 pt-8 md:p-8 max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
        
        <div className="flex items-center gap-3">
          <Link href="/library">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-white">Your Profile</h1>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10">
            <Avatar className="h-16 w-16 border-2 border-cyan-500 ring-2 ring-cyan-500/20">
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate" data-testid="text-username">{user.username}</h2>
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] uppercase shrink-0">
                      {user.isAdmin ? "Admin" : user.role === "creator" ? "Creator" : "Member"}
                    </Badge>
                </div>
                <p className="text-sm text-white/50 truncate">{user.email || "No email"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/40 hover:text-white hover:bg-white/10" data-testid="button-logout">
                <LogOut className="w-4 h-4" />
            </Button>
        </div>

        {user.isAdmin && (
          <Link href="/admin">
            <Button className="w-full bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06]" variant="outline" data-testid="button-admin">
              <Shield className="w-4 h-4 mr-2 text-cyan-400" />
              Admin Dashboard
            </Button>
          </Link>
        )}

        <Tabs defaultValue="creator" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/[0.03] border border-white/10 p-1">
            <TabsTrigger 
              value="creator" 
              className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-white/60" 
              data-testid="tab-creator"
            >
              <Sparkles className="w-4 h-4" />
              Creator
            </TabsTrigger>
            <TabsTrigger 
              value="consumer" 
              className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-white/60" 
              data-testid="tab-consumer"
            >
              <Play className="w-4 h-4" />
              Explorer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="creator" className="space-y-4 mt-4">
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Your ICE Creations
                </CardTitle>
                <CardDescription className="text-white/50">
                  Build interactive content experiences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-2xl font-bold text-cyan-400" data-testid="text-ices-created">
                      {activeIces?.currentActive ?? creatorStats?.totalIces ?? 0}
                    </div>
                    <div className="text-xs text-white/40">ICEs Active</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-2xl font-bold text-white" data-testid="text-total-views">
                      {creatorStats?.totalViews ?? 0}
                    </div>
                    <div className="text-xs text-white/40">Total Views</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/10">
                    <div className="text-2xl font-bold text-white" data-testid="text-engagements">
                      {creatorStats?.totalEngagements ?? 0}
                    </div>
                    <div className="text-xs text-white/40">Engagements</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Link href="/create" className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium" data-testid="button-create-ice">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New ICE
                    </Button>
                  </Link>
                  <Link href="/library">
                    <Button variant="outline" size="icon" className="border-white/20 text-white/60 hover:bg-white/10 hover:text-white" data-testid="button-library">
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {activeIces && activeIces.limit !== -1 && (
              <div className="space-y-2 p-4 rounded-lg bg-white/[0.03] border border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Active ICE Slots</span>
                  <span className="font-mono text-white">{activeIces.currentActive} / {activeIces.limit}</span>
                </div>
                <Progress value={(activeIces.currentActive / activeIces.limit) * 100} className="h-2 bg-white/10" />
              </div>
            )}

            {isCreator && creatorProfile && (
              <CreatorProfileEditor 
                profile={creatorProfile} 
                onUpdated={() => queryClient.invalidateQueries({ queryKey: ["creatorProfile"] })}
              />
            )}
          </TabsContent>

          <TabsContent value="consumer" className="space-y-4 mt-4">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Play className="w-5 h-5 text-cyan-400" />
                  Your Learning Journey
                </CardTitle>
                <CardDescription className="text-white/50">
                  Track your progress exploring ICE content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-white/[0.03] border border-white/10">
                    <Clock className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                    <span className="text-2xl font-bold block text-white" data-testid="text-streak">{progress?.currentStreak || 0}</span>
                    <span className="text-xs text-white/40 uppercase">Day Streak</span>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-white/[0.03] border border-white/10">
                    <MessageSquare className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                    <span className="text-2xl font-bold block text-white" data-testid="text-unlocked">{progress?.unlockedDayIndex || 0}</span>
                    <span className="text-xs text-white/40 uppercase">Cards Viewed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-white">
                  <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  Daily Energy
                </h3>
                <span className="text-sm font-mono text-white/50">∞ Unlimited</span>
              </div>
              <Progress value={100} className="h-2 bg-white/10" />
              <p className="text-xs text-white/40">
                Full access to explore and interact with all ICE content.
              </p>
            </div>

            <Link href="/explore">
              <Button variant="outline" className="w-full border-white/20 text-white/60 hover:bg-white/10 hover:text-white" data-testid="button-explore">
                <Eye className="w-4 h-4 mr-2" />
                Explore Public ICEs
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </TabsContent>
        </Tabs>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Crown className="w-20 h-20 rotate-12 text-cyan-400" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-cyan-400">
              <Crown className="w-5 h-5" />
              Upgrade Your Plan
            </CardTitle>
            <CardDescription className="text-white/50">
              Unlock advanced features for creators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> Unlimited Active ICEs
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> Advanced Analytics
              </li>
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> Conversation Insights
              </li>
            </ul>
            <Link href="/pricing">
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium" data-testid="button-upgrade">
                View Plans
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
