import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Globe, MessageSquare, Shield, Activity, 
  Eye, TrendingUp, Search, ChevronLeft, ChevronRight,
  ExternalLink, Mail, Calendar, Loader2, RefreshCw,
  BarChart3, Sparkles, UserCheck, Crown, Rocket
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface DashboardStats {
  totals: {
    users: number;
    orbits: number;
    previews: number;
    leads: number;
    universes: number;
  };
  recent: {
    usersLast7Days: number;
    previewsLast7Days: number;
    activePreviews: number;
  };
  tierBreakdown: Record<string, number>;
}

interface User {
  id: number;
  username: string;
  email?: string;
  isAdmin: boolean;
  role: string;
  createdAt: string;
}

interface Orbit {
  id: number;
  businessSlug: string;
  sourceUrl: string;
  ownerId?: number;
  ownerEmail?: string;
  planTier: string;
  customTitle?: string;
  createdAt: string;
  lastUpdated: string;
}

interface Preview {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: string;
  messageCount: number;
  maxMessages: number;
  createdAt: string;
  expiresAt: string;
}

interface Lead {
  id: number;
  orbitSlug: string;
  name: string;
  email: string;
  message?: string;
  createdAt: string;
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [orbitTierFilter, setOrbitTierFilter] = useState("all");
  const [orbitPage, setOrbitPage] = useState(0);
  const [previewStatusFilter, setPreviewStatusFilter] = useState("all");
  const [previewPage, setPreviewPage] = useState(0);
  const [leadPage, setLeadPage] = useState(0);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingOrbit, setEditingOrbit] = useState<Orbit | null>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["super-admin-users", userSearch, userPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(userPage * 20),
        ...(userSearch && { search: userSearch }),
      });
      const res = await fetch(`/api/super-admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ users: User[]; total: number }>;
    },
  });

  const { data: orbitsData, isLoading: orbitsLoading } = useQuery({
    queryKey: ["super-admin-orbits", orbitTierFilter, orbitPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(orbitPage * 20),
        ...(orbitTierFilter !== "all" && { tier: orbitTierFilter }),
      });
      const res = await fetch(`/api/super-admin/orbits?${params}`);
      if (!res.ok) throw new Error("Failed to fetch orbits");
      return res.json() as Promise<{ orbits: Orbit[]; total: number }>;
    },
  });

  const { data: previewsData, isLoading: previewsLoading } = useQuery({
    queryKey: ["super-admin-previews", previewStatusFilter, previewPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(previewPage * 20),
        ...(previewStatusFilter !== "all" && { status: previewStatusFilter }),
      });
      const res = await fetch(`/api/super-admin/previews?${params}`);
      if (!res.ok) throw new Error("Failed to fetch previews");
      return res.json() as Promise<{ previews: Preview[]; total: number }>;
    },
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["super-admin-leads", leadPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(leadPage * 20),
      });
      const res = await fetch(`/api/super-admin/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json() as Promise<{ leads: Lead[]; total: number }>;
    },
  });

  const { data: featureFlags } = useQuery({
    queryKey: ["super-admin-feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/feature-flags");
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      return res.json();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; isAdmin?: boolean; role?: string }) => {
      const res = await fetch(`/api/super-admin/users/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      setEditingUser(null);
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateOrbitMutation = useMutation({
    mutationFn: async (data: { slug: string; planTier?: string }) => {
      const res = await fetch(`/api/super-admin/orbits/${data.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update orbit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-orbits"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      setEditingOrbit(null);
      toast({ title: "Orbit updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-display font-bold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You need administrator privileges to access this area.
          </p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const tierColors: Record<string, string> = {
    free: "bg-gray-500",
    grow: "bg-green-500",
    insight: "bg-purple-500",
    intelligence: "bg-amber-500",
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight flex items-center gap-3">
              <Crown className="w-8 h-8 text-amber-500" />
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Manage users, orbits, and system settings</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetchStats()}
            className="gap-2"
            data-testid="button-refresh-stats"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 hidden md:block" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="w-4 h-4 hidden md:block" />
              Users
            </TabsTrigger>
            <TabsTrigger value="orbits" className="gap-2" data-testid="tab-orbits">
              <Globe className="w-4 h-4 hidden md:block" />
              Orbits
            </TabsTrigger>
            <TabsTrigger value="previews" className="gap-2" data-testid="tab-previews">
              <Eye className="w-4 h-4 hidden md:block" />
              Previews
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2" data-testid="tab-leads">
              <MessageSquare className="w-4 h-4 hidden md:block" />
              Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        Users
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-users">{stats.totals.users}</div>
                      <p className="text-xs text-muted-foreground">
                        +{stats.recent.usersLast7Days} this week
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-500" />
                        Orbits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-orbits">{stats.totals.orbits}</div>
                      <p className="text-xs text-muted-foreground">
                        Smart Sites claimed
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Eye className="w-4 h-4 text-green-500" />
                        Previews
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-previews">{stats.totals.previews}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.recent.activePreviews} active
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-amber-500" />
                        Leads
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-leads">{stats.totals.leads}</div>
                      <p className="text-xs text-muted-foreground">
                        Total captured
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-500" />
                        Universes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-universes">{stats.totals.universes}</div>
                      <p className="text-xs text-muted-foreground">
                        ICE stories
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Orbit Tier Breakdown</CardTitle>
                      <CardDescription>Distribution of active orbit tiers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(stats.tierBreakdown).length > 0 ? (
                        Object.entries(stats.tierBreakdown).map(([tier, count]) => (
                          <div key={tier} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${tierColors[tier] || 'bg-gray-500'}`} />
                              <span className="capitalize font-medium">Orbit {tier}</span>
                            </div>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No orbit data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Feature Flags</CardTitle>
                      <CardDescription>Current system feature states</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {featureFlags ? (
                        Object.entries(featureFlags).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{key.replace(/_/g, ' ')}</span>
                            <Badge variant={value ? "default" : "secondary"}>
                              {value ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">Loading flags...</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-500" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-500 mb-2">
                          <UserCheck className="w-5 h-5" />
                          <span className="font-medium">New Users</span>
                        </div>
                        <div className="text-3xl font-bold">{stats.recent.usersLast7Days}</div>
                        <p className="text-sm text-muted-foreground">Last 7 days</p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-500 mb-2">
                          <Eye className="w-5 h-5" />
                          <span className="font-medium">New Previews</span>
                        </div>
                        <div className="text-3xl font-bold">{stats.recent.previewsLast7Days}</div>
                        <p className="text-sm text-muted-foreground">Last 7 days</p>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-500 mb-2">
                          <Rocket className="w-5 h-5" />
                          <span className="font-medium">Active Sessions</span>
                        </div>
                        <div className="text-3xl font-bold">{stats.recent.activePreviews}</div>
                        <p className="text-sm text-muted-foreground">Currently active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>View and manage all registered users</CardDescription>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                      className="pl-10"
                      data-testid="input-search-users"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-medium">User</th>
                            <th className="text-left py-3 px-2 text-sm font-medium">Role</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden md:table-cell">Created</th>
                            <th className="text-right py-3 px-2 text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersData?.users.map((u) => (
                            <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-user-${u.id}`}>
                              <td className="py-3 px-2">
                                <div>
                                  <div className="font-medium">{u.username}</div>
                                  <div className="text-sm text-muted-foreground">{u.email || 'No email'}</div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex gap-1 flex-wrap">
                                  <Badge variant="outline" className="capitalize">{u.role}</Badge>
                                  {u.isAdmin && <Badge variant="default" className="bg-amber-500">Admin</Badge>}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden md:table-cell">
                                {formatDate(u.createdAt)}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setEditingUser(u)}
                                  data-testid={`button-edit-user-${u.id}`}
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {userPage * 20 + 1}-{Math.min((userPage + 1) * 20, usersData?.total || 0)} of {usersData?.total || 0}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={userPage === 0}
                          onClick={() => setUserPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(userPage + 1) * 20 >= (usersData?.total || 0)}
                          onClick={() => setUserPage(p => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orbits" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Orbit Management</CardTitle>
                    <CardDescription>View and manage all business orbits</CardDescription>
                  </div>
                  <Select value={orbitTierFilter} onValueChange={(v) => { setOrbitTierFilter(v); setOrbitPage(0); }}>
                    <SelectTrigger className="w-full md:w-40" data-testid="select-orbit-tier">
                      <SelectValue placeholder="Filter by tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tiers</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="grow">Grow</SelectItem>
                      <SelectItem value="insight">Understand</SelectItem>
                      <SelectItem value="intelligence">Intelligence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {orbitsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-medium">Business</th>
                            <th className="text-left py-3 px-2 text-sm font-medium">Tier</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden md:table-cell">Owner</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden lg:table-cell">Created</th>
                            <th className="text-right py-3 px-2 text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orbitsData?.orbits.map((orbit) => (
                            <tr key={orbit.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-orbit-${orbit.id}`}>
                              <td className="py-3 px-2">
                                <div>
                                  <div className="font-medium">{orbit.customTitle || orbit.businessSlug}</div>
                                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">{orbit.sourceUrl}</div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <Badge className={`${tierColors[orbit.planTier]} text-white capitalize`}>
                                  {orbit.planTier === 'insight' ? 'Understand' : orbit.planTier}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-sm hidden md:table-cell">
                                {orbit.ownerEmail || <span className="text-muted-foreground">Unclaimed</span>}
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden lg:table-cell">
                                {formatDate(orbit.createdAt)}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex gap-1 justify-end">
                                  <Link href={`/orbit/${orbit.businessSlug}`}>
                                    <Button size="sm" variant="ghost">
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                  </Link>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => setEditingOrbit(orbit)}
                                    data-testid={`button-edit-orbit-${orbit.id}`}
                                  >
                                    Edit
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {orbitPage * 20 + 1}-{Math.min((orbitPage + 1) * 20, orbitsData?.total || 0)} of {orbitsData?.total || 0}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={orbitPage === 0}
                          onClick={() => setOrbitPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(orbitPage + 1) * 20 >= (orbitsData?.total || 0)}
                          onClick={() => setOrbitPage(p => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="previews" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Preview Instances</CardTitle>
                    <CardDescription>View all preview sessions and their status</CardDescription>
                  </div>
                  <Select value={previewStatusFilter} onValueChange={(v) => { setPreviewStatusFilter(v); setPreviewPage(0); }}>
                    <SelectTrigger className="w-full md:w-40" data-testid="select-preview-status">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                      <SelectItem value="claimed">Claimed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {previewsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-medium">Domain</th>
                            <th className="text-left py-3 px-2 text-sm font-medium">Status</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden md:table-cell">Messages</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden lg:table-cell">Created</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden lg:table-cell">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewsData?.previews.map((preview) => (
                            <tr key={preview.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-preview-${preview.id}`}>
                              <td className="py-3 px-2">
                                <div>
                                  <div className="font-medium">{preview.sourceDomain}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{preview.id}</div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <Badge variant={
                                  preview.status === 'active' ? 'default' :
                                  preview.status === 'claimed' ? 'secondary' : 'outline'
                                } className="capitalize">
                                  {preview.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-sm hidden md:table-cell">
                                {preview.messageCount}/{preview.maxMessages}
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden lg:table-cell">
                                {formatDate(preview.createdAt)}
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden lg:table-cell">
                                {formatDate(preview.expiresAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {previewPage * 20 + 1}-{Math.min((previewPage + 1) * 20, previewsData?.total || 0)} of {previewsData?.total || 0}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={previewPage === 0}
                          onClick={() => setPreviewPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(previewPage + 1) * 20 >= (previewsData?.total || 0)}
                          onClick={() => setPreviewPage(p => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lead Capture</CardTitle>
                <CardDescription>All leads captured through orbit conversations</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 text-sm font-medium">Contact</th>
                            <th className="text-left py-3 px-2 text-sm font-medium">Orbit</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden md:table-cell">Message</th>
                            <th className="text-left py-3 px-2 text-sm font-medium hidden lg:table-cell">Captured</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadsData?.leads.map((lead) => (
                            <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-lead-${lead.id}`}>
                              <td className="py-3 px-2">
                                <div>
                                  <div className="font-medium">{lead.name}</div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {lead.email}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <Link href={`/orbit/${lead.orbitSlug}`}>
                                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                                    {lead.orbitSlug}
                                  </Badge>
                                </Link>
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden md:table-cell">
                                <span className="truncate block max-w-[200px]">{lead.message || '-'}</span>
                              </td>
                              <td className="py-3 px-2 text-sm text-muted-foreground hidden lg:table-cell">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(lead.createdAt)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(!leadsData?.leads || leadsData.leads.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        No leads captured yet
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {leadPage * 20 + 1}-{Math.min((leadPage + 1) * 20, leadsData?.total || 0)} of {leadsData?.total || 0}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={leadPage === 0}
                          onClick={() => setLeadPage(p => p - 1)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={(leadPage + 1) * 20 >= (leadsData?.total || 0)}
                          onClick={() => setLeadPage(p => p + 1)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user role and permissions for {editingUser?.username}
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isAdmin">Administrator</Label>
                  <Switch
                    id="isAdmin"
                    checked={editingUser.isAdmin}
                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, isAdmin: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(role) => setEditingUser({ ...editingUser, role })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="creator">Creator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button 
                onClick={() => editingUser && updateUserMutation.mutate({
                  id: editingUser.id,
                  isAdmin: editingUser.isAdmin,
                  role: editingUser.role,
                })}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingOrbit} onOpenChange={(open) => !open && setEditingOrbit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Orbit</DialogTitle>
              <DialogDescription>
                Update tier for {editingOrbit?.businessSlug}
              </DialogDescription>
            </DialogHeader>
            {editingOrbit && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Plan Tier</Label>
                  <Select
                    value={editingOrbit.planTier}
                    onValueChange={(planTier) => setEditingOrbit({ ...editingOrbit, planTier })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="grow">Grow</SelectItem>
                      <SelectItem value="insight">Understand</SelectItem>
                      <SelectItem value="intelligence">Intelligence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingOrbit(null)}>Cancel</Button>
              <Button 
                onClick={() => editingOrbit && updateOrbitMutation.mutate({
                  slug: editingOrbit.businessSlug,
                  planTier: editingOrbit.planTier,
                })}
                disabled={updateOrbitMutation.isPending}
              >
                {updateOrbitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
