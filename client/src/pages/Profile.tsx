import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Zap, Crown, LogOut, Clock, MessageSquare, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAppContext } from "@/lib/app-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { universe } = useAppContext();

  const { data: progress } = useQuery({
    queryKey: ["progress", universe?.id],
    queryFn: () => api.getProgress(universe!.id),
    enabled: !!universe && !!user,
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
                    StoryFlix PRO
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
