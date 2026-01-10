import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BarChart3, Calendar, Plus, Users, Video, Upload, ChevronDown, PenSquare, Loader2, Eye, ImageIcon, CheckCircle, Trash2, Settings, Image as PhotoIcon, Clapperboard, ExternalLink, Music, Wand2, User, MoreHorizontal, Globe, MessageCircle, TrendingUp, Layers, ArrowLeft, Shield, Crown, Sparkles } from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Universe } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AdminTab = 'overview' | 'users' | 'industry-orbits' | 'all-orbits' | 'content';

function AdminOverview({ onNavigateToOrbits }: { onNavigateToOrbits?: () => void }) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.getAdminStats(),
  });

  console.log("[AdminOverview] Stats query:", { stats, isLoading, error });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="bg-card border-border cursor-pointer hover:border-purple-500/50 transition-colors"
          onClick={onNavigateToOrbits}
          data-testid="card-total-orbits"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalOrbits || 0}</p>
                <p className="text-xs text-muted-foreground">Total Orbits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalVisits30d || 0}</p>
                <p className="text-xs text-muted-foreground">Visits (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalConversations30d || 0}</p>
                <p className="text-xs text-muted-foreground">Conversations (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-sm font-medium">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.usersByRole?.map(({ role, count }) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">{role}</span>
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-sm font-medium">Orbit Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Industry Orbits</span>
                <span className="text-sm font-medium text-foreground">{stats?.industryOrbits || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Business Orbits</span>
                <span className="text-sm font-medium text-foreground">{stats?.standardOrbits || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminAllOrbits() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: orbits, isLoading } = useQuery({
    queryKey: ["admin-all-orbits"],
    queryFn: () => api.getAdminAllOrbits(),
  });

  const filteredOrbits = orbits?.filter(orbit => 
    orbit.businessSlug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    orbit.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search orbits..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-orbits"
        />
        <span className="text-sm text-muted-foreground">
          {filteredOrbits?.length || 0} orbits
        </span>
      </div>

      <div className="grid gap-3">
        {filteredOrbits?.map((orbit) => (
          <Card key={orbit.businessSlug} className="bg-card border-border hover:border-purple-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground">{orbit.businessName}</h3>
                    {orbit.orbitType === 'industry' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">Industry</span>
                    )}
                    {orbit.generationStatus === 'ready' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Ready</span>
                    )}
                    {orbit.generationStatus === 'generating' && (
                      <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">Generating</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{orbit.businessSlug}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {orbit.visits30d} visits
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {orbit.conversations30d} chats
                    </span>
                    {orbit.planTier && (
                      <span className="capitalize">{orbit.planTier}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <Link href={`/orbit/${orbit.businessSlug}`}>
                    <Button variant="outline" size="sm" className="gap-1" data-testid={`button-view-orbit-${orbit.businessSlug}`}>
                      <Globe className="w-3 h-3" />
                      View
                    </Button>
                  </Link>
                  {orbit.sourceUrl && (
                    <a href={orbit.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-source-${orbit.businessSlug}`}>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredOrbits?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No orbits found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}

function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.getAdminUsers(),
  });

  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">{users?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">{users?.filter(u => u.isAdmin).length || 0}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">{users?.filter(u => u.role === 'creator' || u.role === 'influencer').length || 0}</p>
                <p className="text-xs text-muted-foreground">Creators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">{users?.reduce((sum, u) => sum + u.iceCount, 0) || 0}</p>
                <p className="text-xs text-muted-foreground">Total ICEs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by username or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm bg-card border-border"
          data-testid="input-user-search"
        />
        <span className="text-sm text-muted-foreground">{filteredUsers?.length || 0} users</span>
      </div>
      
      {/* User Table - Desktop */}
      <Card className="bg-card border-border hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">User</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Role</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Orbits</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">ICEs</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers?.map(user => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-user-${user.id}`}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-foreground font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.email || 'No email'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.isAdmin ? 'bg-red-500/10 text-red-500' :
                        user.role === 'creator' ? 'bg-purple-500/10 text-purple-500' :
                        user.role === 'influencer' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {user.isAdmin ? 'Admin' : user.role || 'Viewer'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {user.orbitCount > 0 ? (
                        <span className="text-foreground font-medium">{user.orbitCount}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {user.iceCount > 0 ? (
                        <span className="text-foreground font-medium">{user.iceCount}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* User List - Mobile */}
      <div className="md:hidden space-y-2">
        {filteredUsers?.map(user => (
          <Card key={user.id} className="bg-card border-border" data-testid={`card-user-${user.id}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground font-medium truncate">{user.username}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      user.isAdmin ? 'bg-red-500/10 text-red-500' :
                      user.role === 'creator' ? 'bg-purple-500/10 text-purple-500' :
                      user.role === 'influencer' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {user.isAdmin ? 'Admin' : user.role || 'Viewer'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email || 'No email'}</p>
                </div>
                <div className="flex items-center gap-3 text-center shrink-0">
                  <div>
                    <p className="text-foreground text-sm font-medium">{user.orbitCount || '—'}</p>
                    <p className="text-[10px] text-muted-foreground/50">Orbits</p>
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{user.iceCount || '—'}</p>
                    <p className="text-[10px] text-muted-foreground/50">ICEs</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminIndustryOrbits() {
  const { data: orbits, isLoading } = useQuery({
    queryKey: ["admin-industry-orbits"],
    queryFn: () => api.getAdminIndustryOrbits(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orbits || orbits.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No industry orbits found</p>
          <Link href="/admin/cpac">
            <Button className="mt-4" variant="outline">
              Create Industry Orbit
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Industry Orbits</h3>
        <Link href="/admin/cpac">
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Manage CPAC
          </Button>
        </Link>
      </div>
      
      <div className="grid gap-4">
        {orbits.map(orbit => (
          <Card key={orbit.id} className="bg-card border-border">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{orbit.businessSlug}</h4>
                    <p className="text-xs text-muted-foreground">
                      {orbit.generationStatus === 'ready' ? 'Active' : orbit.generationStatus}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/orbit/${orbit.businessSlug}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                  <Link href="/admin/industry-assets">
                    <Button variant="outline" size="sm">
                      Assets
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  
  const [selectedUniverseId, setSelectedUniverseId] = useState<number | null>(null);
  const [showNewUniverseDialog, setShowNewUniverseDialog] = useState(false);
  const [newUniverseName, setNewUniverseName] = useState("");
  const [newUniverseDescription, setNewUniverseDescription] = useState("");
  const [previewCard, setPreviewCard] = useState<any>(null);
  const [generatingCardId, setGeneratingCardId] = useState<number | null>(null);
  const [generatingVideoCardId, setGeneratingVideoCardId] = useState<number | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeleteUniverseDialog, setShowDeleteUniverseDialog] = useState(false);
  const [showEditUniverseDialog, setShowEditUniverseDialog] = useState(false);
  const [editUniverseName, setEditUniverseName] = useState("");
  const [editUniverseDescription, setEditUniverseDescription] = useState("");
  const [editReleaseMode, setEditReleaseMode] = useState<string>("daily");
  const [editIntroCardsCount, setEditIntroCardsCount] = useState(3);
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [generatingAllVideos, setGeneratingAllVideos] = useState(false);
  const [showBulkImageConfirmDialog, setShowBulkImageConfirmDialog] = useState(false);
  const [showBulkVideoConfirmDialog, setShowBulkVideoConfirmDialog] = useState(false);
  const [editAudioMode, setEditAudioMode] = useState<string>("off");
  const [editDefaultTrackId, setEditDefaultTrackId] = useState<number | null>(null);
  const [editFadeInMs, setEditFadeInMs] = useState(500);
  const [editFadeOutMs, setEditFadeOutMs] = useState(500);

  const { data: universes, isLoading: universesLoading } = useQuery({
    queryKey: ["universes"],
    queryFn: () => api.getUniverses(),
  });

  const selectedUniverse = universes?.find(u => u.id === selectedUniverseId) || universes?.[0];

  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ["cards", selectedUniverse?.id],
    queryFn: () => api.getCards(selectedUniverse!.id),
    enabled: !!selectedUniverse,
  });

  const { data: audioTracks } = useQuery({
    queryKey: ["audioTracks"],
    queryFn: () => api.getAudioTracks(),
  });

  const createUniverseMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) => 
      api.createUniverse(data),
    onSuccess: (newUniverse) => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setSelectedUniverseId(newUniverse.id);
      setShowNewUniverseDialog(false);
      setNewUniverseName("");
      setNewUniverseDescription("");
      toast({
        title: "Universe created",
        description: `"${newUniverse.name}" is now ready for cards!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create universe",
        variant: "destructive",
      });
    },
  });

  const deleteAllCardsMutation = useMutation({
    mutationFn: (universeId: number) => api.deleteAllCards(universeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setShowDeleteAllDialog(false);
      toast({
        title: "Cards deleted",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete cards",
        variant: "destructive",
      });
    },
  });

  const deleteUniverseMutation = useMutation({
    mutationFn: (universeId: number) => api.deleteUniverse(universeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setSelectedUniverseId(null);
      setShowDeleteUniverseDialog(false);
      toast({
        title: "Universe deleted",
        description: "The universe and all its content have been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete universe",
        variant: "destructive",
      });
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: (cardId: number) => api.generateCardImage(cardId),
    onMutate: (cardId) => {
      setGeneratingCardId(cardId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setGeneratingCardId(null);
      toast({
        title: "Image Generated",
        description: `Image created for "${result.cardTitle}"`,
      });
    },
    onError: (error: any, cardId) => {
      setGeneratingCardId(null);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image",
        variant: "destructive",
      });
    },
  });

  const generateVideoMutation = useMutation({
    mutationFn: (cardId: number) => api.generateCardVideo(cardId),
    onMutate: (cardId) => {
      setGeneratingVideoCardId(cardId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse?.id] });
      setGeneratingVideoCardId(null);
      toast({
        title: "Video Generated",
        description: `Video created for "${result.cardTitle}"`,
      });
    },
    onError: (error: any, cardId) => {
      setGeneratingVideoCardId(null);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate video",
        variant: "destructive",
      });
    },
  });

  const updateUniverseMutation = useMutation({
    mutationFn: (data: { id: number } & Partial<Universe>) => 
      api.updateUniverse(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universes"] });
      setShowEditUniverseDialog(false);
      toast({
        title: "Universe updated",
        description: "Changes saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update universe",
        variant: "destructive",
      });
    },
  });

  // Get pending cards for image generation
  const pendingImageCards = cards?.filter(c => {
    const hasPrompt = !!(c.sceneDescription || c.imageGeneration?.prompt);
    return hasPrompt && !c.imageGenerated;
  }) || [];

  // Get pending cards for video generation
  const pendingVideoCards = cards?.filter(c => {
    const hasImage = !!(c.generatedImageUrl || c.imagePath);
    return hasImage && !c.videoGenerated;
  }) || [];

  const handleGenerateAllImages = () => {
    if (!cards || !selectedUniverse) return;
    
    if (pendingImageCards.length === 0) {
      toast({
        title: "No images to generate",
        description: "All cards with prompts already have images.",
      });
      return;
    }
    
    // Show confirmation dialog with prompts
    setShowBulkImageConfirmDialog(true);
  };

  const handleConfirmGenerateAllImages = async () => {
    if (!selectedUniverse) return;
    
    setShowBulkImageConfirmDialog(false);
    setGeneratingAllImages(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const card of pendingImageCards) {
      try {
        await api.generateCardImage(card.id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse.id] });
    setGeneratingAllImages(false);
    
    toast({
      title: "Bulk generation complete",
      description: `Generated ${successCount} images${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  const handleGenerateAllVideos = () => {
    if (!cards || !selectedUniverse) return;
    
    if (pendingVideoCards.length === 0) {
      toast({
        title: "No videos to generate",
        description: "All cards with images already have videos, or no images are available.",
      });
      return;
    }
    
    // Show confirmation dialog
    setShowBulkVideoConfirmDialog(true);
  };

  const handleConfirmGenerateAllVideos = async () => {
    if (!selectedUniverse) return;
    
    setShowBulkVideoConfirmDialog(false);
    setGeneratingAllVideos(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const card of pendingVideoCards) {
      try {
        await api.generateCardVideo(card.id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cards", selectedUniverse.id] });
    setGeneratingAllVideos(false);
    
    toast({
      title: "Video generation complete",
      description: `Generated ${successCount} videos${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
    });
  };

  const handleEditUniverse = async () => {
    if (selectedUniverse) {
      setEditUniverseName(selectedUniverse.name);
      setEditUniverseDescription(selectedUniverse.description || "");
      setEditReleaseMode(selectedUniverse.releaseMode || "daily");
      setEditIntroCardsCount(selectedUniverse.introCardsCount ?? 3);
      setEditTimezone(selectedUniverse.timezone || "UTC");
      
      try {
        const audioSettings = await api.getUniverseAudioSettings(selectedUniverse.id);
        setEditAudioMode(audioSettings.audioMode || "off");
        setEditDefaultTrackId(audioSettings.defaultTrackId);
        setEditFadeInMs(audioSettings.fadeInMs ?? 500);
        setEditFadeOutMs(audioSettings.fadeOutMs ?? 500);
      } catch {
        setEditAudioMode("off");
        setEditDefaultTrackId(null);
        setEditFadeInMs(500);
        setEditFadeOutMs(500);
      }
      
      setShowEditUniverseDialog(true);
    }
  };

  const handleSaveUniverse = async () => {
    if (!editUniverseName.trim() || !selectedUniverse) return;
    const dailyStartsAt = editIntroCardsCount + 1;
    updateUniverseMutation.mutate({
      id: selectedUniverse.id,
      name: editUniverseName,
      description: editUniverseDescription,
      releaseMode: editReleaseMode as any,
      introCardsCount: editIntroCardsCount,
      dailyReleaseStartsAtDayIndex: dailyStartsAt,
      timezone: editTimezone,
    });
    
    try {
      await api.updateUniverseAudioSettings(selectedUniverse.id, {
        audioMode: editAudioMode,
        defaultTrackId: editDefaultTrackId,
        fadeInMs: editFadeInMs,
        fadeOutMs: editFadeOutMs,
      });
    } catch (error: any) {
      toast({
        title: "Audio settings update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateUniverse = () => {
    if (!newUniverseName.trim()) {
      toast({
        title: "Error",
        description: "Universe name is required",
        variant: "destructive",
      });
      return;
    }
    createUniverseMutation.mutate({
      name: newUniverseName,
      description: newUniverseDescription,
    });
  };

  const isEngineGenerated = selectedUniverse?.visualMode === 'engine_generated';
  const isCreatorOrAdmin = user?.isAdmin || user?.role === 'admin' || user?.role === 'creator';

  if (!isCreatorOrAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalNav context="app" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Creator Access Required</h2>
          <p className="text-muted-foreground mb-6">
            Become a creator to start building your own stories and universes.
          </p>
          <Link href="/become-creator">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              Become a Creator
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (universesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalNav context="app" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalNav context="app" />
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in pb-24">
        
        {/* Admin Command Center Header */}
        <div className="flex items-center gap-4">
          <Link href="/launchpad">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">Admin Command Center</h1>
            <p className="text-sm text-muted-foreground">Platform management and oversight</p>
          </div>
        </div>
        
        {/* Tab Navigation - scrollable on mobile */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="bg-card border border-border p-1 inline-flex min-w-max">
              <TabsTrigger value="overview" className="data-[state=active]:bg-muted text-sm px-3" data-testid="tab-overview">
                <TrendingUp className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-muted text-sm px-3" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="all-orbits" className="data-[state=active]:bg-muted text-sm px-3" data-testid="tab-all-orbits">
                <Globe className="w-4 h-4 mr-2" />
                All Orbits
              </TabsTrigger>
              <TabsTrigger value="industry-orbits" className="data-[state=active]:bg-muted text-sm px-3" data-testid="tab-industry">
                <Sparkles className="w-4 h-4 mr-2" />
                Industry Orbits
              </TabsTrigger>
              <TabsTrigger value="content" className="data-[state=active]:bg-muted text-sm px-3" data-testid="tab-content">
                <Layers className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="overview">
            <AdminOverview onNavigateToOrbits={() => setActiveTab('all-orbits')} />
          </TabsContent>
          
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
          
          <TabsContent value="all-orbits">
            <AdminAllOrbits />
          </TabsContent>
          
          <TabsContent value="industry-orbits">
            <AdminIndustryOrbits />
          </TabsContent>
          
          <TabsContent value="content">
            {/* Original Showrunner Dashboard content */}
            
            {/* Universe Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="justify-between w-full sm:w-auto min-w-[200px]" data-testid="button-universe-dropdown">
                            <span className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs uppercase">Universe:</span>
                                <span className="font-semibold truncate max-w-[150px]">{selectedUniverse?.name || "Select..."}</span>
                            </span>
                            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[280px]">
                        <DropdownMenuLabel>Select Universe</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {universes?.map(u => (
                          <DropdownMenuItem 
                            key={u.id}
                            className={`cursor-pointer ${u.id === selectedUniverse?.id ? 'font-bold bg-accent/50' : ''}`}
                            onClick={() => setSelectedUniverseId(u.id)}
                            data-testid={`menu-universe-${u.id}`}
                          >
                            {u.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          onClick={() => setShowNewUniverseDialog(true)}
                          data-testid="menu-create-universe"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Universe...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <span className="hidden sm:inline text-muted-foreground/50">•</span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Season 1</span>
            </div>

            {/* Action Buttons - Mobile Grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Link href="/admin/transformations" className="contents">
                    <Button className="gap-2 h-12 sm:h-10 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white col-span-2 sm:col-span-1" data-testid="button-create-story">
                        <Wand2 className="w-4 h-4" /> 
                        <span>Create Story</span>
                    </Button>
                </Link>
                <Link href="/admin/characters/new" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="outline" data-testid="button-create-character">
                        <User className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Create Character</span>
                        <span className="sm:hidden">Character</span>
                    </Button>
                </Link>
                <Link href="/admin/create" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="outline" data-testid="button-create-card" disabled={!selectedUniverse}>
                        <Plus className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Add Card</span>
                        <span className="sm:hidden">Card</span>
                    </Button>
                </Link>
                <Link href="/admin/audio" className="contents">
                    <Button className="gap-2 h-12 sm:h-10" variant="secondary" data-testid="button-audio-library">
                        <Music className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Audio Library</span>
                        <span className="sm:hidden">Audio</span>
                    </Button>
                </Link>
            </div>
        
        {!selectedUniverse ? (
          <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-4">
                <Wand2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Welcome to NextMonth</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Transform your script, story, or ideas into an interactive narrative experience. 
                Upload any text and our AI will create characters, scenes, and daily story drops.
              </p>
              <Link href="/admin/transformations">
                <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" data-testid="button-get-started">
                  <Wand2 className="w-4 h-4" /> Create Your First Story
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Universe Actions Bar */}
            <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{selectedUniverse.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUniverse.description || 'No description'}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/universes/${selectedUniverse.id}/visual-bible`} className="contents">
                    <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-visual-bible">
                      <PhotoIcon className="w-3.5 h-3.5" /> Visual Bible
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEditUniverse} data-testid="button-edit-universe">
                    <Settings className="w-3.5 h-3.5" /> Edit Universe
                  </Button>
                </div>
              </div>
              
              {/* Generate AI Content - Prominent actions for engine-generated universes */}
              {isEngineGenerated && (
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-purple-500" />
                        Generate AI Content
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Generate missing images and videos for cards using AI.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="gap-1.5 border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
                        onClick={handleGenerateAllImages}
                        disabled={generatingAllImages || generatingAllVideos}
                        data-testid="button-generate-all-images"
                      >
                        {generatingAllImages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PhotoIcon className="w-3.5 h-3.5" />
                        )}
                        {generatingAllImages ? 'Generating...' : 'Generate Images'}
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm" 
                        className="gap-1.5 border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                        onClick={handleGenerateAllVideos}
                        disabled={generatingAllVideos || generatingAllImages}
                        data-testid="button-generate-all-videos"
                      >
                        {generatingAllVideos ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Video className="w-3.5 h-3.5" />
                        )}
                        {generatingAllVideos ? 'Generating...' : 'Generate Videos'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cards</CardTitle>
                        <Video className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-card-count">{cards?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">in this universe</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Published</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold" data-testid="text-published-count">
                          {cards?.filter(c => c.status === 'published').length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Content Calendar */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/20">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Scheduled Drops
                    </h3>
                </div>
                <div className="divide-y divide-border">
                    {cardsLoading ? (
                      <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : cards?.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No cards yet. Create your first card to get started!
                      </div>
                    ) : (
                      cards?.map((card) => {
                        const hasPrompt = !!(card.sceneDescription || card.imageGeneration?.prompt);
                        const displayImage = card.generatedImageUrl || card.imagePath;
                        const needsGeneration = isEngineGenerated && hasPrompt && !card.imageGenerated;
                        const isGenerating = generatingCardId === card.id;
                        
                        return (
                        <div key={card.id} className="p-3 sm:p-4 hover:bg-muted/10" data-testid={`card-row-${card.id}`}>
                            {/* Mobile-first layout */}
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded overflow-hidden relative flex-shrink-0">
                                    {displayImage ? (
                                      <img src={displayImage} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/50" />
                                      </div>
                                    )}
                                    {card.imageGenerated && (
                                      <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
                                        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                      </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm sm:text-base truncate">Day {card.dayIndex}: {card.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {card.publishAt ? new Date(card.publishAt).toLocaleDateString() : 'Not scheduled'}
                                      {isEngineGenerated && (
                                        <span className="ml-1.5">
                                          {card.imageGenerated ? (
                                            <span className="text-green-500">• Ready</span>
                                          ) : hasPrompt ? (
                                            <span className="text-yellow-500">• Needs image</span>
                                          ) : (
                                            <span className="text-muted-foreground/50">• No prompt</span>
                                          )}
                                        </span>
                                      )}
                                    </p>
                                    {/* Actions row - consolidated */}
                                    <div className="flex items-center gap-2 mt-2">
                                         {/* Status badges */}
                                         <span className={`px-1.5 py-0.5 text-xs rounded border ${
                                           card.status === 'published' 
                                             ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                             : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                         }`}>
                                           {card.status === 'published' ? 'Published' : 'Draft'}
                                         </span>
                                         
                                         {/* Media status icons */}
                                         <div className="flex items-center gap-1">
                                           <PhotoIcon className={`w-4 h-4 ${card.imageGenerated || card.generatedImageUrl || card.imagePath ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                                           <Video className={`w-4 h-4 ${card.videoGenerated ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                                         </div>
                                         
                                         {/* More actions dropdown */}
                                         <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                             <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-more-${card.id}`}>
                                               <MoreHorizontal className="w-4 h-4" />
                                             </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end" className="w-48">
                                             <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                             <DropdownMenuSeparator />
                                             <Link href={`/admin/cards/${card.id}/edit`}>
                                               <DropdownMenuItem data-testid={`menu-edit-${card.id}`}>
                                                 <PenSquare className="w-4 h-4 mr-2" /> Edit Card
                                               </DropdownMenuItem>
                                             </Link>
                                             <Link href={`/admin/cards/${card.id}`}>
                                               <DropdownMenuItem data-testid={`menu-admin-${card.id}`}>
                                                 <ExternalLink className="w-4 h-4 mr-2" /> Admin View
                                               </DropdownMenuItem>
                                             </Link>
                                             <Link href={`/card/${card.id}`}>
                                               <DropdownMenuItem data-testid={`menu-preview-${card.id}`}>
                                                 <Eye className="w-4 h-4 mr-2" /> Preview
                                               </DropdownMenuItem>
                                             </Link>
                                             {isEngineGenerated && hasPrompt && (
                                               <>
                                                 <DropdownMenuSeparator />
                                                 <DropdownMenuItem 
                                                   onClick={() => generateImageMutation.mutate(card.id)}
                                                   disabled={isGenerating}
                                                   data-testid={`menu-generate-image-${card.id}`}
                                                 >
                                                   {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhotoIcon className="w-4 h-4 mr-2" />}
                                                   {card.imageGenerated ? 'Regenerate Image' : 'Generate Image'}
                                                 </DropdownMenuItem>
                                               </>
                                             )}
                                             {isEngineGenerated && displayImage && (
                                               <DropdownMenuItem 
                                                 onClick={() => generateVideoMutation.mutate(card.id)}
                                                 disabled={generatingVideoCardId === card.id}
                                                 data-testid={`menu-generate-video-${card.id}`}
                                               >
                                                 {generatingVideoCardId === card.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                                                 {card.videoGenerated ? 'Regenerate Video' : 'Generate Video'}
                                               </DropdownMenuItem>
                                             )}
                                           </DropdownMenuContent>
                                         </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                      );})
                    )}
                </div>
            </div>

            {/* Danger Zone - At bottom for sensitive actions */}
            <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-destructive">Danger Zone</span>
                  <p className="text-muted-foreground text-xs mt-0.5">Destructive actions for "{selectedUniverse.name}"</p>
                </div>
                <div className="flex gap-2">
                  <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        variant="outline" 
                        className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground flex-1 sm:flex-initial"
                        data-testid="button-delete-all-cards" 
                        disabled={!cards?.length}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Cards
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Cards?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {cards?.length || 0} cards from "{selectedUniverse?.name}". 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => selectedUniverse && deleteAllCardsMutation.mutate(selectedUniverse.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteAllCardsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Delete All Cards
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog open={showDeleteUniverseDialog} onOpenChange={setShowDeleteUniverseDialog}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm"
                        variant="destructive" 
                        className="gap-1.5 flex-1 sm:flex-initial"
                        data-testid="button-delete-universe"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Universe
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Universe?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{selectedUniverse?.name}" and all its content including cards, characters, and locations. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => selectedUniverse && deleteUniverseMutation.mutate(selectedUniverse.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteUniverseMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Delete Universe
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Create Universe Dialog */}
        <Dialog open={showNewUniverseDialog} onOpenChange={setShowNewUniverseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Universe</DialogTitle>
              <DialogDescription>
                A universe is a story world that contains characters and cards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="universe-name">Universe Name</Label>
                <Input
                  id="universe-name"
                  placeholder="e.g., Neon Rain"
                  value={newUniverseName}
                  onChange={(e) => setNewUniverseName(e.target.value)}
                  data-testid="input-universe-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="universe-description">Description</Label>
                <Textarea
                  id="universe-description"
                  placeholder="A brief description of your story world..."
                  value={newUniverseDescription}
                  onChange={(e) => setNewUniverseDescription(e.target.value)}
                  data-testid="input-universe-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewUniverseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUniverse}
                disabled={createUniverseMutation.isPending}
                data-testid="button-submit-universe"
              >
                {createUniverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Create Universe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Universe Dialog */}
        <Dialog open={showEditUniverseDialog} onOpenChange={setShowEditUniverseDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Universe</DialogTitle>
              <DialogDescription>
                Update the details and release settings for this story world.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-universe-name">Universe Name</Label>
                <Input
                  id="edit-universe-name"
                  placeholder="e.g., Neon Rain"
                  value={editUniverseName}
                  onChange={(e) => setEditUniverseName(e.target.value)}
                  data-testid="input-edit-universe-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-universe-description">Description</Label>
                <Textarea
                  id="edit-universe-description"
                  placeholder="A brief description of your story world..."
                  value={editUniverseDescription}
                  onChange={(e) => setEditUniverseDescription(e.target.value)}
                  data-testid="input-edit-universe-description"
                />
              </div>
              
              {/* Release Settings Section */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3">Release Settings</h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-release-mode">Release Mode</Label>
                    <select
                      id="edit-release-mode"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editReleaseMode}
                      onChange={(e) => setEditReleaseMode(e.target.value)}
                      data-testid="select-release-mode"
                    >
                      <option value="daily">Daily - All cards follow publish date</option>
                      <option value="hybrid_intro_then_daily">Hybrid - First cards instant, then daily</option>
                      <option value="all_at_once">All at Once - Release everything immediately</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {editReleaseMode === 'hybrid_intro_then_daily' 
                        ? `First ${editIntroCardsCount} cards unlock instantly, then daily from Day ${editIntroCardsCount + 1}.`
                        : editReleaseMode === 'all_at_once'
                        ? 'All published cards are visible immediately.'
                        : 'All cards follow their scheduled publish dates.'}
                    </p>
                  </div>
                  
                  {editReleaseMode === 'hybrid_intro_then_daily' && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-intro-count">Intro Cards Count</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          id="edit-intro-count"
                          min={1}
                          max={5}
                          value={editIntroCardsCount}
                          onChange={(e) => setEditIntroCardsCount(parseInt(e.target.value))}
                          className="flex-1"
                          data-testid="slider-intro-count"
                        />
                        <span className="w-8 text-center font-mono font-bold">{editIntroCardsCount}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Number of cards to unlock immediately for new viewers.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-timezone">Timezone</Label>
                    <select
                      id="edit-timezone"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editTimezone}
                      onChange={(e) => setEditTimezone(e.target.value)}
                      data-testid="select-timezone"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (US)</option>
                      <option value="America/Los_Angeles">Pacific Time (US)</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Timezone used for publish date comparisons.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Soundtrack Settings Section */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4" /> Soundtrack Settings
                </h4>
                
                {/* Quick Auto-Select Option */}
                {editAudioMode === 'off' && audioTracks && audioTracks.length > 0 && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Add background music instantly</p>
                        <p className="text-xs text-muted-foreground">We'll pick a track for you - you can change it later</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditAudioMode('continuous');
                          if (audioTracks.length > 0) {
                            const randomTrack = audioTracks[Math.floor(Math.random() * audioTracks.length)];
                            setEditDefaultTrackId(randomTrack.id);
                          }
                        }}
                        data-testid="button-auto-select-music"
                      >
                        <Music className="w-4 h-4 mr-2" />
                        Auto-select
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-audio-mode">Audio Mode</Label>
                    <select
                      id="edit-audio-mode"
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                      value={editAudioMode}
                      onChange={(e) => setEditAudioMode(e.target.value)}
                      data-testid="select-audio-mode"
                    >
                      <option value="off">Off - No background music</option>
                      <option value="continuous">Continuous - Same track plays throughout</option>
                      <option value="per_card">Per Card - Each card can have its own track</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {editAudioMode === 'continuous' 
                        ? 'One track plays throughout the story viewing experience.'
                        : editAudioMode === 'per_card'
                        ? 'Different tracks can play for different story cards.'
                        : 'Background music is disabled for this universe.'}
                    </p>
                  </div>
                  
                  {editAudioMode !== 'off' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="edit-default-track">Default Track</Label>
                        <select
                          id="edit-default-track"
                          className="w-full p-2 border rounded-md bg-background text-foreground"
                          value={editDefaultTrackId ?? ""}
                          onChange={(e) => setEditDefaultTrackId(e.target.value ? parseInt(e.target.value) : null)}
                          data-testid="select-default-track"
                        >
                          <option value="">No default track</option>
                          {audioTracks?.map(track => (
                            <option key={track.id} value={track.id}>
                              {track.title}{track.artist ? ` - ${track.artist}` : ''}
                            </option>
                          ))}
                        </select>
                        {!audioTracks?.length && (
                          <p className="text-xs text-muted-foreground">
                            <Link href="/admin/audio" className="text-primary hover:underline">
                              Add tracks to your Audio Library
                            </Link> to enable background music.
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-fade-in">Fade In (ms)</Label>
                          <Input
                            id="edit-fade-in"
                            type="number"
                            min={0}
                            max={5000}
                            step={100}
                            value={editFadeInMs}
                            onChange={(e) => setEditFadeInMs(parseInt(e.target.value) || 500)}
                            data-testid="input-fade-in"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-fade-out">Fade Out (ms)</Label>
                          <Input
                            id="edit-fade-out"
                            type="number"
                            min={0}
                            max={5000}
                            step={100}
                            value={editFadeOutMs}
                            onChange={(e) => setEditFadeOutMs(parseInt(e.target.value) || 500)}
                            data-testid="input-fade-out"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditUniverseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveUniverse}
                disabled={updateUniverseMutation.isPending}
                data-testid="button-save-universe"
              >
                {updateUniverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Card Preview Dialog */}
        <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-primary">Day {previewCard?.dayIndex}:</span> {previewCard?.title}
              </DialogTitle>
              <DialogDescription>
                {previewCard?.status === 'published' ? 'Published' : 'Draft'} 
                {previewCard?.publishAt && ` • Scheduled: ${new Date(previewCard.publishAt).toLocaleDateString()}`}
              </DialogDescription>
            </DialogHeader>
            
            {previewCard && (
              <div className="space-y-6 py-4">
                {/* Card Image Preview */}
                {(previewCard.generatedImageUrl || previewCard.imagePath) && (
                  <div className="aspect-[9/16] max-h-[300px] w-auto mx-auto bg-muted rounded-lg overflow-hidden border">
                    <img 
                      src={previewCard.generatedImageUrl || previewCard.imagePath} 
                      alt={previewCard.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Captions */}
                {previewCard.captionsJson && previewCard.captionsJson.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Captions</h4>
                    <div className="bg-black/50 p-4 rounded-lg space-y-2">
                      {previewCard.captionsJson.map((caption: string, i: number) => (
                        <p key={i} className="text-white/90 italic text-center">"{caption}"</p>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Scene Text */}
                {previewCard.sceneText && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Scene Text</h4>
                    <p className="text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-lg">
                      {previewCard.sceneText}
                    </p>
                  </div>
                )}
                
                {/* Recap */}
                {previewCard.recapText && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Journal Recap</h4>
                    <p className="text-muted-foreground text-sm">{previewCard.recapText}</p>
                  </div>
                )}
                
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                  <div>
                    <span className="text-muted-foreground">Effect:</span>{' '}
                    <span className="font-medium">{previewCard.effectTemplate || 'ken-burns'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Season:</span>{' '}
                    <span className="font-medium">{previewCard.season || 1}</span>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewCard(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Image Generation Confirmation Dialog */}
        <Dialog open={showBulkImageConfirmDialog} onOpenChange={setShowBulkImageConfirmDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhotoIcon className="w-5 h-5 text-purple-500" />
                Confirm Bulk Image Generation
              </DialogTitle>
              <DialogDescription>
                Review the prompts for {pendingImageCards.length} cards before generating images.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {pendingImageCards.map((card, index) => (
                <div key={card.id} className="border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{card.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        {card.sceneDescription || card.imageGeneration?.prompt || 'No prompt set'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setShowBulkImageConfirmDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmGenerateAllImages}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-confirm-generate-images"
              >
                <PhotoIcon className="w-4 h-4 mr-2" />
                Generate {pendingImageCards.length} Images
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Video Generation Confirmation Dialog */}
        <Dialog open={showBulkVideoConfirmDialog} onOpenChange={setShowBulkVideoConfirmDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-500" />
                Confirm Bulk Video Generation
              </DialogTitle>
              <DialogDescription>
                Review the {pendingVideoCards.length} cards that will have videos generated from their images.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {pendingVideoCards.map((card, index) => (
                <div key={card.id} className="border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{card.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {card.sceneDescription || 'Cinematic motion from image'}
                      </p>
                      {(card.generatedImageUrl || card.imagePath) && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Has source image
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setShowBulkVideoConfirmDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmGenerateAllVideos}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-generate-videos"
              >
                <Video className="w-4 h-4 mr-2" />
                Generate {pendingVideoCards.length} Videos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
