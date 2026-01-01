import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ImageOff, Check, Clock, XCircle } from "lucide-react";

interface ProductTileProps {
  id: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  imageUrl?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'limited';
  tags?: string[];
}

const formatPrice = (price: number, currency: string = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
};

const availabilityConfig = {
  in_stock: { label: 'In Stock', icon: Check, className: 'text-green-400 bg-green-400/10' },
  out_of_stock: { label: 'Out of Stock', icon: XCircle, className: 'text-red-400 bg-red-400/10' },
  limited: { label: 'Limited', icon: Clock, className: 'text-amber-400 bg-amber-400/10' },
};

export function ProductTile({
  id,
  title,
  description,
  price,
  currency = 'USD',
  category,
  imageUrl,
  availability,
  tags = [],
}: ProductTileProps) {
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const truncatedDescription = description && description.length > 80 
    ? description.substring(0, 80) + "..." 
    : description;

  const availabilityInfo = availability ? availabilityConfig[availability] : null;
  const AvailabilityIcon = availabilityInfo?.icon;

  return (
    <Card
      className="group orbit-tile cursor-pointer border-zinc-800 bg-zinc-900/50 hover:border-pink-500/30 transition-colors overflow-hidden"
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid={`product-tile-${id}`}
    >
      {imageUrl && !imageError ? (
        <div className="aspect-[4/3] overflow-hidden bg-zinc-800">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-zinc-800/50 flex items-center justify-center">
          {imageError ? (
            <ImageOff className="w-8 h-8 text-zinc-600" />
          ) : (
            <Package className="w-8 h-8 text-zinc-600" />
          )}
        </div>
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-zinc-100 line-clamp-2 text-sm">
            {title}
          </h3>
          {price !== undefined && (
            <span className="text-pink-400 font-semibold text-sm whitespace-nowrap">
              {formatPrice(price, currency)}
            </span>
          )}
        </div>

        {(isExpanded ? description : truncatedDescription) && (
          <p className="text-xs text-zinc-400 leading-relaxed">
            {isExpanded ? description : truncatedDescription}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {availabilityInfo && AvailabilityIcon && (
            <Badge 
              variant="secondary" 
              className={`text-[10px] px-1.5 py-0 ${availabilityInfo.className}`}
            >
              <AvailabilityIcon className="w-2.5 h-2.5 mr-0.5" />
              {availabilityInfo.label}
            </Badge>
          )}

          {tags.slice(0, 3).map((tag, index) => (
            <Badge
              key={index}
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-500"
            >
              {tag}
            </Badge>
          ))}

          {tags.length > 3 && (
            <span className="text-[10px] text-zinc-600">
              +{tags.length - 3}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
