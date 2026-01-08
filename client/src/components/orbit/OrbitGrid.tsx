import { useState, useCallback, useEffect } from "react";
import { OrbitBox } from "./OrbitBox";
import { ProductTile } from "./ProductTile";
import { AmbientMotion } from "./AmbientMotion";
import { ChevronDown, ChevronUp, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIntentGravity } from "@/lib/useIntentGravity";
import { getOrbitConfig, OrbitTile } from "@/lib/orbitConfig";

interface OrbitBoxData {
  id: string;
  type: "page" | "service" | "faq" | "testimonial" | "blog" | "document" | "custom" | "product" | "menu_item";
  title: string;
  summary: string;
  themes: string[];
  price?: number;
  currency?: string;
  category?: string;
  imageUrl?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'limited';
  tags?: string[];
  intentTags?: string[];
}

interface OrbitGridProps {
  boxes: OrbitBoxData[];
  isUnclaimed?: boolean;
  enableCategoryClustering?: boolean;
  maxVisiblePerCategory?: number;
  orbitSlug?: string;
  onTileClick?: (tile: OrbitBoxData) => void;
  disableMotion?: boolean;
  disableIntentGravity?: boolean;
  activeIntent?: string[];
}

interface CategorySection {
  category: string;
  items: OrbitBoxData[];
  isExpanded: boolean;
}

const MAX_VISIBLE_DEFAULT = 8;
const MAX_TOTAL_VISIBLE = 60;

export function OrbitGrid({ 
  boxes, 
  isUnclaimed = false, 
  enableCategoryClustering = true,
  maxVisiblePerCategory = MAX_VISIBLE_DEFAULT,
  orbitSlug,
  onTileClick,
  disableMotion = false,
  disableIntentGravity = false,
  activeIntent = [],
}: OrbitGridProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  const orbitConfig = orbitSlug ? getOrbitConfig(orbitSlug) : null;
  const motionDisabled = disableMotion || orbitConfig?.uiOverrides?.disableMotion;
  const gravityDisabled = disableIntentGravity || orbitConfig?.uiOverrides?.disableIntentGravity;
  
  const boxesWithIntent = boxes.map(box => ({
    ...box,
    intentTags: box.intentTags || box.themes || [],
  }));
  
  const { 
    orderedTiles, 
    relevanceScores, 
    isAnimating,
    getGravityOffset 
  } = useIntentGravity({
    tiles: boxesWithIntent,
    disabled: gravityDisabled,
  });
  
  const effectiveBoxes = gravityDisabled || activeIntent.length === 0 
    ? boxesWithIntent 
    : orderedTiles as OrbitBoxData[];

  if (boxes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">No content boxes available yet.</p>
      </div>
    );
  }

  const productTypes = ['product', 'menu_item'];
  const products = boxes.filter(b => productTypes.includes(b.type));
  const otherBoxes = boxes.filter(b => !productTypes.includes(b.type));

  const hasProducts = products.length > 0;
  const shouldCluster = enableCategoryClustering && hasProducts && products.some(p => p.category);

  if (!shouldCluster) {
    const visibleBoxes = effectiveBoxes.slice(0, MAX_TOTAL_VISIBLE);
    return (
      <div 
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${isAnimating ? 'orbit-grid-animating' : ''}`}
        data-testid="orbit-grid"
      >
        {visibleBoxes.map((box, index) => {
          const relevanceScore = relevanceScores.get(box.id) || 0;
          const gravityOffset = getGravityOffset(box.id);
          const isHighRelevance = relevanceScore > 0.5;
          
          return (
            <AmbientMotion 
              key={box.id} 
              index={index}
              disabled={motionDisabled}
              className={`transition-transform duration-500 ease-out ${isHighRelevance ? 'ring-2 ring-pink-500/30 rounded-lg' : ''}`}
            >
              <div 
                style={{
                  transform: `translate3d(${gravityOffset.x}px, ${gravityOffset.y}px, 0)`,
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onClick={() => onTileClick?.(box)}
              >
                {productTypes.includes(box.type) ? (
                  <ProductTile
                    id={box.id}
                    title={box.title}
                    description={box.summary}
                    price={box.price}
                    currency={box.currency}
                    category={box.category}
                    imageUrl={box.imageUrl}
                    availability={box.availability}
                    tags={box.tags}
                  />
                ) : (
                  <OrbitBox
                    id={box.id}
                    type={box.type as any}
                    title={box.title}
                    summary={box.summary}
                    themes={box.themes}
                    isUnclaimed={isUnclaimed}
                  />
                )}
              </div>
            </AmbientMotion>
          );
        })}
        {boxes.length > MAX_TOTAL_VISIBLE && (
          <div className="col-span-full text-center py-4">
            <p className="text-sm text-zinc-500">
              Showing {MAX_TOTAL_VISIBLE} of {boxes.length} items
            </p>
          </div>
        )}
      </div>
    );
  }

  const categoryMap = new Map<string, OrbitBoxData[]>();
  const uncategorized: OrbitBoxData[] = [];

  products.forEach(item => {
    const cat = item.category || 'Other';
    if (cat === 'Other' || !item.category) {
      uncategorized.push(item);
    } else {
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item);
    }
  });

  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => {
    return b[1].length - a[1].length;
  });

  if (uncategorized.length > 0) {
    sortedCategories.push(['Other', uncategorized]);
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  let totalVisible = 0;

  return (
    <div className={`space-y-8 ${isAnimating ? 'orbit-grid-animating' : ''}`} data-testid="orbit-grid-categorized">
      {otherBoxes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Content
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {otherBoxes.slice(0, 8).map((box, index) => (
              <AmbientMotion 
                key={box.id} 
                index={index}
                disabled={motionDisabled}
              >
                <div onClick={() => onTileClick?.(box)}>
                  <OrbitBox
                    id={box.id}
                    type={box.type as any}
                    title={box.title}
                    summary={box.summary}
                    themes={box.themes}
                    isUnclaimed={isUnclaimed}
                  />
                </div>
              </AmbientMotion>
            ))}
          </div>
        </div>
      )}

      {sortedCategories.map(([category, items]) => {
        if (totalVisible >= MAX_TOTAL_VISIBLE) return null;
        
        const isExpanded = expandedCategories.has(category);
        const remainingSlots = MAX_TOTAL_VISIBLE - totalVisible;
        const maxForThisCategory = Math.min(items.length, isExpanded ? remainingSlots : Math.min(maxVisiblePerCategory, remainingSlots));
        const visibleItems = items.slice(0, maxForThisCategory);
        const hiddenCount = items.length - visibleItems.length;
        
        totalVisible += visibleItems.length;

        return (
          <div key={category} className="space-y-4" data-testid={`category-section-${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                {category}
                <span className="text-xs font-normal text-zinc-600">
                  ({items.length} {items.length === 1 ? 'item' : 'items'})
                </span>
              </h3>
              {items.length > maxVisiblePerCategory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategory(category)}
                  className="text-pink-400 hover:text-pink-300 text-xs"
                  data-testid={`toggle-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      Show all ({hiddenCount} more)
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleItems.map((item, index) => (
                <AmbientMotion 
                  key={item.id} 
                  index={totalVisible + index}
                  disabled={motionDisabled}
                >
                  <div onClick={() => onTileClick?.(item)}>
                    <ProductTile
                      id={item.id}
                      title={item.title}
                      description={item.summary}
                      price={item.price}
                      currency={item.currency}
                      category={item.category}
                      imageUrl={item.imageUrl}
                      availability={item.availability}
                      tags={item.tags}
                    />
                  </div>
                </AmbientMotion>
              ))}
            </div>
          </div>
        );
      })}

      {totalVisible >= MAX_TOTAL_VISIBLE && products.length > MAX_TOTAL_VISIBLE && (
        <div className="text-center py-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-500">
            Showing {totalVisible} of {products.length} products. Use search or filters to find more.
          </p>
        </div>
      )}
    </div>
  );
}
