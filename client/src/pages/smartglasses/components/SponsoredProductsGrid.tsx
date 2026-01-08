import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import type { SurfacedProduct } from "@/lib/types/smartglasses";

export function SponsoredProductsGrid() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["smartglasses-products"],
    queryFn: async () => {
      const res = await fetch("/api/smartglasses/surfaced-products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json() as Promise<{ products: SurfacedProduct[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = data?.products || [];

  return (
    <section className="py-16 px-4 bg-amber-950/10 border-t border-b border-amber-500/20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white mb-2">Sponsored products</h2>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto">
            Paid placements from selected providers. These do not affect editorial guidance.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors"
                data-testid={`sponsored-product-${product.id}`}
              >
                {product.imageUrl && (
                  <div className="aspect-video rounded-lg bg-zinc-800 mb-4 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {product.sponsored && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Sponsored
                    </Badge>
                  )}
                  {product.tags.map((tag, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={
                        tag.type === "new"
                          ? "border-emerald-500/30 text-emerald-400"
                          : tag.type === "best_for_creators"
                          ? "border-pink-500/30 text-pink-400"
                          : tag.type === "best_for_comfort"
                          ? "border-blue-500/30 text-blue-400"
                          : tag.type === "premium"
                          ? "border-purple-500/30 text-purple-400"
                          : "border-zinc-600 text-zinc-400"
                      }
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
                <p className="text-sm text-zinc-400 mb-2">{product.pitch}</p>
                <p className="text-sm font-medium text-pink-400 mb-4">{product.priceRange}</p>

                <div className="flex gap-2">
                  {product.detailsUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-zinc-700"
                      asChild
                    >
                      <a href={product.detailsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View details
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-zinc-700"
                      disabled
                    >
                      View details
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700"
                    data-testid={`button-compare-${product.id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <button
            onClick={() => setLocation("/smartglasses/partners")}
            className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-4"
            data-testid="link-partner-inquiry"
          >
            Want your product featured here?
          </button>
        </div>
      </div>
    </section>
  );
}
