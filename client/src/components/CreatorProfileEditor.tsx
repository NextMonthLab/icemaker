import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { 
  Save, Loader2, Edit, ExternalLink, Users, Plus, Trash2, GripVertical, 
  Camera, Globe, Twitter, Linkedin, Instagram, Youtube, Github, Link as LinkIcon
} from "lucide-react";
import { Link } from "wouter";

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

interface ProfileLink {
  id?: number;
  label: string;
  url: string;
  sortOrder: number;
}

const LINK_PRESETS = [
  { label: "Website", icon: Globe },
  { label: "Twitter", icon: Twitter },
  { label: "LinkedIn", icon: Linkedin },
  { label: "Instagram", icon: Instagram },
  { label: "YouTube", icon: Youtube },
  { label: "GitHub", icon: Github },
];

function getLinkIcon(label: string) {
  const preset = LINK_PRESETS.find(p => p.label.toLowerCase() === label.toLowerCase());
  return preset?.icon || LinkIcon;
}

interface CreatorProfileEditorProps {
  profile: CreatorProfile;
  onUpdated?: () => void;
}

export default function CreatorProfileEditor({ profile, onUpdated }: CreatorProfileEditorProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: profile.displayName || "",
    headline: profile.headline || "",
    bio: profile.bio || "",
    externalLink: profile.externalLink || "",
    slug: profile.slug || "",
  });
  const [editLinks, setEditLinks] = useState<ProfileLink[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const { data: profileLinks = [] } = useQuery<ProfileLink[]>({
    queryKey: ["/api/me/creator-profile/links"],
    enabled: isEditing,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await fetch("/api/me/creator-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/creator-profile"] });
      toast({ title: "Profile updated", description: "Your creator profile has been saved." });
      onUpdated?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLinksMutation = useMutation({
    mutationFn: async (links: Omit<ProfileLink, "id">[]) => {
      const res = await fetch("/api/me/creator-profile/links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update links");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/creator-profile/links"] });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 2MB", variant: "destructive" });
      return;
    }
    
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);
    
    try {
      const res = await fetch("/api/me/creator-profile/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upload avatar");
      }
      
      queryClient.invalidateQueries({ queryKey: ["creatorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/creator-profile"] });
      toast({ title: "Avatar updated", description: "Your profile picture has been updated." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const startEditing = () => {
    setEditForm({
      displayName: profile.displayName || "",
      headline: profile.headline || "",
      bio: profile.bio || "",
      externalLink: profile.externalLink || "",
      slug: profile.slug || "",
    });
    setEditLinks(profileLinks.map((l, i) => ({ ...l, sortOrder: i })));
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateProfileMutation.mutateAsync(editForm);
    await updateLinksMutation.mutateAsync(editLinks.map((l, i) => ({ label: l.label, url: l.url, sortOrder: i })));
    setIsEditing(false);
  };

  const addLink = () => {
    setEditLinks([...editLinks, { label: "Website", url: "", sortOrder: editLinks.length }]);
  };

  const removeLink = (index: number) => {
    setEditLinks(editLinks.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, field: "label" | "url", value: string) => {
    const newLinks = [...editLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setEditLinks(newLinks);
  };

  const initials = profile.displayName?.slice(0, 2).toUpperCase() || "??";
  const isPending = updateProfileMutation.isPending || updateLinksMutation.isPending;

  return (
    <Card data-testid="card-creator-profile">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Public Profile
          </CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={startEditing} data-testid="button-edit-profile">
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          {profile.slug ? (
            <Link href={`/creator/${profile.slug}`} className="text-cyan-500 hover:underline flex items-center gap-1">
              /creator/{profile.slug}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <span>Set a profile URL to share your work</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16 border-2 border-cyan-500">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-600 transition-colors disabled:opacity-50"
              data-testid="button-upload-avatar"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Camera className="w-3 h-3 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{profile.displayName}</h3>
            {profile.headline && (
              <p className="text-sm text-muted-foreground truncate">{profile.headline}</p>
            )}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
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
                <span className="text-sm text-muted-foreground whitespace-nowrap">/creator/</span>
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
              <div className="flex items-center justify-between">
                <Label>Social Links</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addLink} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add Link
                </Button>
              </div>
              <div className="space-y-2">
                {editLinks.map((link, index) => {
                  const LinkIcon = getLinkIcon(link.label);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                        <LinkIcon className="w-4 h-4 text-cyan-500" />
                      </div>
                      <select
                        value={link.label}
                        onChange={(e) => updateLink(index, "label", e.target.value)}
                        className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                        data-testid={`select-link-label-${index}`}
                      >
                        {LINK_PRESETS.map(preset => (
                          <option key={preset.label} value={preset.label}>{preset.label}</option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                      <Input
                        value={link.url}
                        onChange={(e) => updateLink(index, "url", e.target.value)}
                        placeholder="https://..."
                        className="flex-1"
                        data-testid={`input-link-url-${index}`}
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeLink(index)}
                        className="shrink-0 text-red-400 hover:text-red-500"
                        data-testid={`button-remove-link-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                {editLinks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No links yet. Add your social profiles!
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending} data-testid="button-save-profile">
                {isPending ? (
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
            {profile.bio && (
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            )}
            {profileLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profileLinks.map((link, idx) => {
                  const LinkIcon = getLinkIcon(link.label);
                  return (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-sm transition-colors"
                      data-testid={`link-social-${idx}`}
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-cyan-500" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
