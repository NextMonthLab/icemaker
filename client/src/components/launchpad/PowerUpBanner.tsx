import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, ArrowRight } from "lucide-react";

interface PowerUpBannerProps {
  orbitSlug: string;
  onUpgrade?: () => void;
}

export function PowerUpBanner({ orbitSlug, onUpgrade }: PowerUpBannerProps) {
  return (
    <div
      className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 border-y border-border"
      data-testid="powerup-banner"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5 animate-pulse" />
      
      <div className="relative px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
              <Badge 
                variant="outline" 
                className="border-amber-500/50 text-amber-500 text-xs px-2 py-0"
              >
                Starter insights (3)
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-foreground/80">
              <span className="font-medium text-foreground">Add sources</span> to unlock full insights
            </p>
          </div>
        </div>

        <Button
          onClick={onUpgrade}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 gap-2 text-sm w-full sm:w-auto"
          data-testid="button-powerup"
        >
          <Sparkles className="w-4 h-4" />
          Add Sources
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
