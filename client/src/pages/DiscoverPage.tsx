import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Sparkles, Play, Globe, ArrowRight, Loader2, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import SiteNav from "@/components/SiteNav";
import { BrandImage } from "@/components/brand/BrandImage";
import { ICE_CATEGORIES, type IceCategory } from "@shared/schema";
import { ICE_CATEGORY_LABELS } from "@/lib/categoryLabels";

interface PublicIce {
  id: string;
  title: string;
  description?: string | null;
  shareSlug: string;
  thumbnailUrl: string | null;
  category?: IceCategory | null;
  cardCount: number;
  publishedAt: string;
}

interface DiscoverResponse {
  ices: PublicIce[];
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export default function DiscoverPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const categoryParam = params.get('category');
  
  const [selectedCategory, setSelectedCategory] = useState<IceCategory | null>(
    categoryParam && ICE_CATEGORIES.includes(categoryParam as IceCategory) 
      ? categoryParam as IceCategory 
      : null
  );
  const [allIces, setAllIces] = useState<PublicIce[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const queryUrl = selectedCategory 
    ? `/api/ice/discover?limit=${PAGE_SIZE}&offset=0&category=${selectedCategory}`
    : `/api/ice/discover?limit=${PAGE_SIZE}&offset=0`;

  const { isLoading, refetch } = useQuery<DiscoverResponse>({
    queryKey: ["/api/ice/discover", { limit: PAGE_SIZE, offset: 0, category: selectedCategory }],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAllIces(data.ices);
      setHasMore(data.hasMore);
      setOffset(PAGE_SIZE);
      return data;
    },
  });

  useEffect(() => {
    if (selectedCategory) {
      setLocation(`/discover?category=${selectedCategory}`, { replace: true });
    } else {
      setLocation('/discover', { replace: true });
    }
    setOffset(0);
    refetch();
  }, [selectedCategory]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const url = selectedCategory 
        ? `/api/ice/discover?limit=${PAGE_SIZE}&offset=${offset}&category=${selectedCategory}`
        : `/api/ice/discover?limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: DiscoverResponse = await res.json();
      setAllIces(prev => [...prev, ...data.ices]);
      setHasMore(data.hasMore);
      setOffset(prev => prev + PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCategoryClick = (cat: IceCategory) => {
    setSelectedCategory(selectedCategory === cat ? null : cat);
  };

  const clearFilter = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SiteNav variant="marketing" />
      
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-4">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300">Public Gallery</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Discover ICE Experiences
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Explore interactive content experiences created by our community.
            Each ICE transforms content into engaging story cards.
          </p>
        </div>
        
        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">Filter by category</span>
            {selectedCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilter}
                className="text-xs text-cyan-400 hover:text-cyan-300 h-auto py-0.5 px-2"
                data-testid="button-clear-filter"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <div className="flex gap-2">
              {ICE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <Button
                    key={cat}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategoryClick(cat)}
                    className={`shrink-0 transition-all ${
                      isSelected
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600"
                        : "border-white/20 text-white/70 hover:bg-white/5 hover:text-white hover:border-white/30"
                    }`}
                    data-testid={`button-category-${cat}`}
                  >
                    {ICE_CATEGORY_LABELS[cat]}
                  </Button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 overflow-hidden animate-pulse">
                <div className="aspect-video bg-white/10" />
                <CardContent className="p-4">
                  <div className="h-5 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/5 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : allIces.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {selectedCategory ? `No ICEs in ${ICE_CATEGORY_LABELS[selectedCategory]}` : "No Public ICEs Yet"}
            </h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              {selectedCategory 
                ? "Try a different category or browse all ICEs."
                : "Be the first to publish an ICE experience! Create interactive story cards from any content and share them with the world."}
            </p>
            {selectedCategory ? (
              <Button 
                variant="outline"
                onClick={clearFilter}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                data-testid="button-browse-all"
              >
                Browse All ICEs
              </Button>
            ) : (
              <Link href="/icemaker">
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2" data-testid="button-create-ice">
                  <Sparkles className="w-4 h-4" />
                  Create Your First ICE
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allIces.map((ice) => (
              <Link key={ice.id} href={`/ice/${ice.shareSlug}`} data-testid={`link-ice-${ice.id}`}>
                <Card 
                  className="group bg-white/5 border-white/10 overflow-hidden hover-elevate cursor-pointer transition-all h-full"
                  data-testid={`card-ice-${ice.id}`}
                >
                  <div className="aspect-video relative overflow-hidden">
                    {ice.thumbnailUrl ? (
                      <img 
                        src={ice.thumbnailUrl} 
                        alt={ice.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <BrandImage 
                        fallbackPurpose="library-card-fallback"
                        stableKey={ice.id}
                        alt={ice.title}
                        className="w-full h-full"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    {ice.category && (
                      <div className="absolute top-2 left-2">
                        <Badge 
                          variant="secondary" 
                          className="bg-black/60 backdrop-blur-sm text-white/90 border-none text-xs"
                        >
                          {ICE_CATEGORY_LABELS[ice.category]}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-white truncate group-hover:text-cyan-300 transition-colors">
                      {ice.title}
                    </h3>
                    {ice.description && (
                      <p className="text-sm text-white/50 mt-1 line-clamp-2">
                        {ice.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-white/40">
                        {ice.cardCount} cards
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(ice.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        
        {hasMore && allIces.length > 0 && (
          <div className="text-center mt-8">
            <Button 
              variant="outline" 
              onClick={loadMore}
              disabled={isLoadingMore}
              className="border-white/20 text-white/70 hover:bg-white/5 gap-2"
              data-testid="button-load-more"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        )}
        
        <div className="mt-16 text-center">
          <p className="text-white/40 mb-4">Want to share your own ICE?</p>
          <Link href="/icemaker" data-testid="link-create-your-own">
            <Button 
              variant="outline" 
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 gap-2"
              data-testid="button-create-your-own"
            >
              <Sparkles className="w-4 h-4" />
              Create Your Own ICE
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
