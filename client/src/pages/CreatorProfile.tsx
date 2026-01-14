import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, BookOpen, Loader2, Users, Heart, Sparkles,
  Globe, Twitter, Linkedin, Instagram, Youtube, Github, Link as LinkIcon, UserPlus, UserMinus
} from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ProfileLink {
  id: number;
  label: string;
  url: string;
  sortOrder: number;
}

interface IcePreview {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  visibility: string;
  createdAt: string;
}

interface CreatorPublic {
  id: number;
  displayName: string;
  slug: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  externalLink: string | null;
  links: ProfileLink[];
  followerCount: number;
  followingCount: number;
  iceCount: number;
  universes: Array<{
    id: number;
    slug: string;
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    genre: string | null;
  }>;
  ices: IcePreview[];
}

const LINK_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  github: Github,
};

function getLinkIcon(label: string) {
  return LINK_ICONS[label.toLowerCase()] || LinkIcon;
}

export default function CreatorProfile() {
  const [match, params] = useRoute("/creator/:slug");
  const slug = params?.slug || "";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: creator, isLoading, error } = useQuery<CreatorPublic>({
    queryKey: ["creator", slug],
    queryFn: async () => {
      const res = await fetch(`/api/creators/${slug}`);
      if (!res.ok) throw new Error("Creator not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: followStatus } = useQuery<{ following: boolean }>({
    queryKey: ["follow-status", creator?.id],
    queryFn: async () => {
      const res = await fetch(`/api/creators/${creator!.id}/follow`, { credentials: "include" });
      if (!res.ok) return { following: false };
      return res.json();
    },
    enabled: !!creator && !!user,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creators/${creator!.id}/follow`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", creator?.id] });
      queryClient.invalidateQueries({ queryKey: ["creator", slug] });
      toast({ title: "Followed!", description: `You are now following ${creator?.displayName}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creators/${creator!.id}/follow`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unfollow");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-status", creator?.id] });
      queryClient.invalidateQueries({ queryKey: ["creator", slug] });
      toast({ title: "Unfollowed", description: `You unfollowed ${creator?.displayName}` });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <GlobalNav context="ice" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <GlobalNav context="ice" />
        <div className="p-8 max-w-md mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">Creator Not Found</h1>
          <p className="text-white/60">
            This creator profile doesn't exist or has been removed.
          </p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-cyan-600 to-blue-600" data-testid="button-go-home">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = creator.displayName?.slice(0, 2).toUpperCase() || "??";
  const isFollowing = followStatus?.following ?? false;
  const isPending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GlobalNav context="ice" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
          <Avatar className="h-28 w-28 border-2 border-cyan-500" data-testid="img-creator-avatar">
            <AvatarImage src={creator.avatarUrl || undefined} />
            <AvatarFallback className="text-3xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="text-center md:text-left flex-1 space-y-3">
            <h1 className="text-3xl font-bold" data-testid="text-creator-name">
              {creator.displayName}
            </h1>
            {creator.headline && (
              <p className="text-lg text-white/70" data-testid="text-creator-headline">
                {creator.headline}
              </p>
            )}
            
            <div className="flex items-center justify-center md:justify-start gap-6 text-sm">
              <div className="text-center">
                <span className="font-bold text-lg text-cyan-400">{creator.iceCount}</span>
                <span className="text-white/50 ml-1">ICEs</span>
              </div>
              <div className="text-center">
                <span className="font-bold text-lg">{creator.followerCount}</span>
                <span className="text-white/50 ml-1">followers</span>
              </div>
              <div className="text-center">
                <span className="font-bold text-lg">{creator.followingCount}</span>
                <span className="text-white/50 ml-1">following</span>
              </div>
            </div>

            {creator.links.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {creator.links.map((link, idx) => {
                  const Icon = getLinkIcon(link.label);
                  return (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-sm transition-colors"
                      data-testid={`link-social-${idx}`}
                    >
                      <Icon className="w-3.5 h-3.5 text-cyan-500" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            )}

            {user && (
              <div className="pt-2">
                {isFollowing ? (
                  <Button
                    variant="outline"
                    onClick={() => unfollowMutation.mutate()}
                    disabled={isPending}
                    className="border-cyan-500/30 hover:bg-cyan-500/10"
                    data-testid="button-unfollow"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserMinus className="w-4 h-4 mr-2" />}
                    Following
                  </Button>
                ) : (
                  <Button
                    onClick={() => followMutation.mutate()}
                    disabled={isPending}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                    data-testid="button-follow"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Follow
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {creator.bio && (
          <div className="mb-8 p-4 rounded-lg bg-white/5 text-white/80" data-testid="text-creator-bio">
            {creator.bio.split("\n").map((paragraph, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>{paragraph}</p>
            ))}
          </div>
        )}

        {creator.ices.length > 0 && (
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              Interactive Experiences
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {creator.ices.map((ice) => (
                <Link key={ice.id} href={`/ice/${ice.id}`}>
                  <Card className="overflow-hidden bg-white/5 border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer group">
                    <div className="aspect-[9/16] relative bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                      {ice.coverImageUrl && (
                        <img
                          src={ice.coverImageUrl}
                          alt={ice.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white line-clamp-2">{ice.title}</h3>
                        <p className="text-xs text-white/60 mt-1">
                          {formatDistanceToNow(new Date(ice.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {creator.universes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-500" />
              Story Universes
            </h2>
            <div className="grid gap-4">
              {creator.universes.map((universe) => (
                <Link key={universe.id} href={`/story/${universe.slug}`}>
                  <Card
                    className="bg-white/5 border-white/10 hover:border-cyan-500/50 transition-colors cursor-pointer"
                    data-testid={`card-universe-${universe.id}`}
                  >
                    <CardContent className="flex gap-4 p-4">
                      {universe.coverImageUrl && (
                        <img
                          src={universe.coverImageUrl}
                          alt={universe.title}
                          className="w-20 h-28 object-cover rounded-md"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate text-white">{universe.title}</h3>
                        {universe.genre && (
                          <Badge variant="outline" className="text-xs border-white/20 text-white/60 mt-1">
                            {universe.genre}
                          </Badge>
                        )}
                        {universe.description && (
                          <p className="text-sm text-white/60 line-clamp-2 mt-2">
                            {universe.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {creator.ices.length === 0 && creator.universes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">This creator hasn't published any content yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
