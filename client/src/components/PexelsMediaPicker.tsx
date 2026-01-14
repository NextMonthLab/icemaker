import { useState } from "react";
import { Search, Image, Video, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PexelsPhoto {
  id: number;
  src: {
    original: string;
    large: string;
    medium: string;
    small: string;
  };
  photographer: string;
  photographer_url: string;
  alt: string;
}

interface PexelsVideo {
  id: number;
  image: string;
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
  user: {
    name: string;
    url: string;
  };
}

interface PexelsMediaPickerProps {
  onSelectImage: (url: string, photographer?: string) => void;
  onSelectVideo?: (url: string, thumbnailUrl: string, photographer?: string) => void;
  showVideos?: boolean;
}

export function PexelsMediaPicker({ onSelectImage, onSelectVideo, showVideos = false }: PexelsMediaPickerProps) {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"photos" | "videos">("photos");
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/pexels/search?query=${encodeURIComponent(query)}&type=${mediaType}&per_page=15`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in to search stock media");
        }
        throw new Error("Search failed. Please try again.");
      }
      
      const data = await response.json();
      
      if (mediaType === "photos") {
        setPhotos(data.photos || []);
        setVideos([]);
      } else {
        setVideos(data.videos || []);
        setPhotos([]);
      }
    } catch (err) {
      console.error("Pexels search error:", err);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      search();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search free stock media..."
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            data-testid="input-pexels-search"
          />
        </div>
        <Button
          onClick={search}
          disabled={isLoading || !query.trim()}
          className="bg-cyan-600 hover:bg-cyan-700"
          data-testid="button-pexels-search"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {showVideos && (
        <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as "photos" | "videos")}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="photos" className="gap-1.5 data-[state=active]:bg-cyan-600" data-testid="tab-photos">
              <Image className="w-3.5 h-3.5" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 data-[state=active]:bg-cyan-600" data-testid="tab-videos">
              <Video className="w-3.5 h-3.5" />
              Videos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          <p className="mb-2">{error}</p>
          <Button
            onClick={() => { setError(null); search(); }}
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            data-testid="button-pexels-retry"
          >
            Try Again
          </Button>
        </div>
      ) : !hasSearched ? (
        <div className="text-center py-12 text-white/40">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Search for free stock {showVideos ? "photos and videos" : "photos"}</p>
          <p className="text-xs mt-1">Powered by Pexels</p>
        </div>
      ) : mediaType === "photos" && photos.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <p>No photos found for "{query}"</p>
        </div>
      ) : mediaType === "videos" && videos.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <p>No videos found for "{query}"</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
            {mediaType === "photos" && photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => onSelectImage(photo.src.large, photo.photographer)}
                className="relative aspect-video rounded-md overflow-hidden group hover:ring-2 hover:ring-cyan-500 transition-all"
                data-testid={`pexels-photo-${photo.id}`}
              >
                <img
                  src={photo.src.small}
                  alt={photo.alt || "Stock photo"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">Select</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/80 truncate">{photo.photographer}</p>
                </div>
              </button>
            ))}
            
            {mediaType === "videos" && videos.map((video) => {
              const hdFile = video.video_files.find(f => f.quality === "hd") || video.video_files[0];
              return (
                <button
                  key={video.id}
                  onClick={() => onSelectVideo?.(hdFile?.link || "", video.image, video.user.name)}
                  className="relative aspect-video rounded-md overflow-hidden group hover:ring-2 hover:ring-cyan-500 transition-all"
                  data-testid={`pexels-video-${video.id}`}
                >
                  <img
                    src={video.image}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white/80 truncate">{video.user.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/30">
            <span>Free media from</span>
            <a 
              href="https://www.pexels.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400/60 hover:text-cyan-400 inline-flex items-center gap-0.5"
            >
              Pexels
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
