import { Link, useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Sparkles,
  Home,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Compass,
  Shield,
  Users,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import icemakerLogo from "@assets/icemaker-logo.png";

type NavContext = 'marketing' | 'app' | 'ice';

interface GlobalNavProps {
  context?: NavContext;
  transparent?: boolean;
  showBreadcrumb?: boolean;
  breadcrumbLabel?: string;
  breadcrumbHref?: string;
  minimal?: boolean;
  onStartTour?: () => void;
}

const contextLabels: Record<NavContext, { label: string; icon: React.ComponentType<any>; href: string }> = {
  marketing: { label: 'Home', icon: Home, href: '/' },
  app: { label: 'Stories', icon: Home, href: '/app' },
  ice: { label: 'IceMaker', icon: Sparkles, href: '/icemaker' },
};

export default function GlobalNav({ 
  context = 'marketing', 
  transparent = false,
  showBreadcrumb = false,
  breadcrumbLabel,
  breadcrumbHref,
  minimal = false,
  onStartTour
}: GlobalNavProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const quickLinks = [
    { href: '/discover', label: 'Discover', icon: Compass, context: 'marketing' as NavContext },
    { href: '/library', label: 'Library', icon: Sparkles, context: 'ice' as NavContext },
    ...(user ? [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, context: 'ice' as NavContext },
      { href: '/leads', label: 'Leads', icon: Users, context: 'ice' as NavContext },
    ] : []),
  ];

  const showCTAs = !user && context === 'marketing';

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 border-b",
        transparent 
          ? "bg-transparent border-transparent" 
          : "bg-background/95 dark:bg-gradient-to-r dark:from-black dark:via-neutral-950 dark:to-black border-border backdrop-blur-sm"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center cursor-pointer" data-testid="link-global-logo">
              <div className="h-14 overflow-hidden flex items-center">
                <img 
                  src={icemakerLogo} 
                  alt="IceMaker" 
                  className="h-[150px] w-auto object-contain"
                  style={{ marginTop: '-45px', marginBottom: '-45px' }}
                />
              </div>
            </div>
          </Link>

        </div>

        {!minimal && (
          <>
            <nav className="hidden md:flex items-center gap-1">
              {quickLinks.map((link) => {
                const isActive = context === link.context;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={cn(
                        "text-foreground/60 hover:text-foreground hover:bg-muted gap-1.5 h-8 px-3 text-xs",
                        isActive && "text-foreground bg-muted"
                      )}
                      data-testid={`global-nav-${link.context}`}
                    >
                      <link.icon className="w-3.5 h-3.5" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              
            </nav>

            <div className="flex items-center gap-2">
              {showCTAs && (
                <Link href="/try">
                  <Button 
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600 text-white gap-1.5 h-8 px-3 text-xs"
                    data-testid="global-cta-ice"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Try IceMaker
                  </Button>
                </Link>
              )}
              
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                      data-testid="global-user-menu"
                    >
                      <Avatar className="w-7 h-7 border border-white/20">
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                          {getInitials(user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-3.5 h-3.5 text-white/50 hidden sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                    <div className="px-2 py-1.5 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{user.username}</p>
                      {user.isAdmin && (
                        <p className="text-[10px] text-muted-foreground">Admin</p>
                      )}
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer" data-testid="global-menu-profile">
                        <User className="w-4 h-4 mr-2" />
                        My Account
                      </Link>
                    </DropdownMenuItem>
                    {onStartTour && (
                      <DropdownMenuItem 
                        onClick={onStartTour} 
                        className="cursor-pointer" 
                        data-testid="global-menu-tour"
                      >
                        <Compass className="w-4 h-4 mr-2" />
                        Take the Tour
                      </DropdownMenuItem>
                    )}
                    {user.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer" data-testid="global-menu-admin">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:text-red-300" data-testid="global-menu-logout">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-foreground/70 hover:text-foreground hover:bg-muted gap-1.5 h-8 px-3 text-xs" 
                    data-testid="global-signin"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Button>
                </Link>
              )}

              <button 
                className="md:hidden p-1.5 text-foreground/70 hover:text-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="global-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </>
        )}
      </div>

      {mobileMenuOpen && !minimal && (
        <div className="md:hidden bg-background/95 dark:bg-black/95 border-t border-border px-4 py-3 space-y-1">
          {quickLinks.map((link) => {
            const isActive = context === link.context;
            return (
              <Link key={link.href} href={link.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer",
                    isActive && "text-foreground bg-muted"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`global-mobile-${link.context}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </div>
              </Link>
            );
          })}
          
          
          {user?.isAdmin && (
            <>
              <div className="border-t border-border my-2" />
              <Link href="/admin">
                <div 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="global-mobile-admin"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </div>
              </Link>
            </>
          )}
          
          </div>
      )}
    </header>
  );
}
