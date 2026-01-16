import { Clock, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useEffect, useState } from "react";

interface FreePassBannerProps {
  expiresAt: Date | string;
}

export function FreePassBanner({ expiresAt }: FreePassBannerProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ days, hours, minutes });
      setIsExpired(false);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4" data-testid="banner-free-pass-expired">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-foreground font-medium">Your free pass has expired</p>
              <p className="text-sm text-muted-foreground">Upgrade to continue using premium features</p>
            </div>
          </div>
          <Link href="/pricing">
            <Button size="sm" data-testid="button-upgrade-expired">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!timeLeft) return null;

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 12;

  return (
    <div 
      className={`border rounded-lg p-4 ${
        isUrgent 
          ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20' 
          : 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/20'
      }`}
      data-testid="banner-free-pass-active"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isUrgent ? 'bg-amber-500/20' : 'bg-cyan-500/20'
          }`}>
            <Gift className={`w-5 h-5 ${isUrgent ? 'text-amber-500' : 'text-cyan-500'}`} />
          </div>
          <div>
            <p className="text-foreground font-medium">
              {isUrgent ? 'Free pass expiring soon!' : 'Free pass active'}
            </p>
            <p className="text-sm text-muted-foreground">
              {timeLeft.days > 0 && `${timeLeft.days}d `}
              {timeLeft.hours}h {timeLeft.minutes}m remaining
            </p>
          </div>
        </div>
        <Link href="/pricing">
          <Button size="sm" variant={isUrgent ? "default" : "outline"} data-testid="button-upgrade-free-pass">
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade
          </Button>
        </Link>
      </div>
    </div>
  );
}
