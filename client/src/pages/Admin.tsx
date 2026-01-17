import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BarChart3, Calendar, Plus, Users, Video, Upload, ChevronDown, PenSquare, Loader2, Eye, ImageIcon, CheckCircle, Trash2, Settings, Image as PhotoIcon, Clapperboard, ExternalLink, Music, Wand2, User, MoreHorizontal, Globe, MessageCircle, TrendingUp, Layers, ArrowLeft, Shield, Crown, Sparkles, Gift, Clock, X } from "lucide-react";
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

type AdminTab = 'overview' | 'users';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function AdminOverview() {
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
        
        <Card className="bg-card border-border" data-testid="card-total-ices">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalIces || 0}</p>
                <p className="text-xs text-muted-foreground">Total ICEs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.publishedIces || 0}</p>
                <p className="text-xs text-muted-foreground">Published ICEs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <PhotoIcon className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalMediaAssets || 0}</p>
                <p className="text-xs text-muted-foreground">Media Assets</p>
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
              {stats?.usersByRole?.map(({ role, count }: { role: string; count: number }) => (
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
            <CardTitle className="text-foreground text-sm font-medium">Platform Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Storage Used</span>
                <span className="text-sm font-medium text-foreground">{formatBytes(stats?.totalStorageBytes || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Media Files</span>
                <span className="text-sm font-medium text-foreground">{stats?.totalMediaAssets || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.getAdminUsers(),
  });
  
  const grantFreePassMutation = useMutation({
    mutationFn: ({ userId, days }: { userId: number; days: number | null }) => 
      api.grantFreePass(userId, days),
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update free pass",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );
  
  const usersWithFreePass = users?.filter(u => u.hasFreePass)?.length || 0;

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
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-cyan-500" />
              <div>
                <p className="text-lg font-semibold text-foreground">{usersWithFreePass}</p>
                <p className="text-xs text-muted-foreground">Free Passes</p>
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
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Free Pass</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">ICEs</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Actions</th>
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
                      {user.hasFreePass ? (
                        <div className="flex items-center justify-center gap-1">
                          <Gift className="w-3 h-3 text-cyan-500" />
                          <span className="text-xs text-cyan-500 font-medium">
                            {(() => {
                              const daysLeft = Math.ceil((new Date(user.freePassExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              return `${daysLeft}d`;
                            })()}
                          </span>
                        </div>
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
                    <td className="py-3 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Free Pass</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 1 })}
                            data-testid={`button-grant-1day-${user.id}`}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Grant 1 Day
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 3 })}
                            data-testid={`button-grant-3day-${user.id}`}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Grant 3 Days
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 5 })}
                            data-testid={`button-grant-5day-${user.id}`}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Grant 5 Days
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 7 })}
                            data-testid={`button-grant-7day-${user.id}`}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Grant 7 Days
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 14 })}
                            data-testid={`button-grant-14day-${user.id}`}
                          >
                            <Gift className="w-4 h-4 mr-2" />
                            Grant 14 Days
                          </DropdownMenuItem>
                          {user.hasFreePass && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: null })}
                                className="text-red-500"
                                data-testid={`button-revoke-pass-${user.id}`}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Revoke Pass
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                    {user.hasFreePass && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-500">
                        <Gift className="w-3 h-3" />
                        {Math.ceil((new Date(user.freePassExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email || 'No email'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-center">
                    <p className="text-foreground text-sm font-medium">{user.iceCount || '—'}</p>
                    <p className="text-[10px] text-muted-foreground/50">ICEs</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-user-actions-mobile-${user.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Free Pass</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 1 })}
                        data-testid={`button-grant-1day-mobile-${user.id}`}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Grant 1 Day
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 3 })}
                        data-testid={`button-grant-3day-mobile-${user.id}`}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Grant 3 Days
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 5 })}
                        data-testid={`button-grant-5day-mobile-${user.id}`}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Grant 5 Days
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 7 })}
                        data-testid={`button-grant-7day-mobile-${user.id}`}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Grant 7 Days
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: 14 })}
                        data-testid={`button-grant-14day-mobile-${user.id}`}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Grant 14 Days
                      </DropdownMenuItem>
                      {user.hasFreePass && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => grantFreePassMutation.mutate({ userId: user.id, days: null })}
                            className="text-red-500"
                            data-testid={`button-revoke-pass-mobile-${user.id}`}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Revoke Pass
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            </TabsList>
          </div>
          
          <TabsContent value="overview">
            <AdminOverview />
          </TabsContent>
          
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
