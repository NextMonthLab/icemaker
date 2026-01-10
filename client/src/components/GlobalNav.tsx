import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Orbit,
  Sparkles,
  Home,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Building2,
  Film,
  GraduationCap,
  Compass,
  Sun,
  Moon,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
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

const LOGO_URL = "/logo.png";

type NavContext = 'marketing' | 'app' | 'orbit' | 'ice';

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
  orbit: { label: 'Orbit', icon: Orbit, href: '/orbit' },
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
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const quickLinks = [
    { href: '/launchpad', label: 'Launchpad', icon: Home, context: 'app' as NavContext },
    { href: '/orbit', label: 'Orbits', icon: Orbit, context: 'orbit' as NavContext },
    { href: '/library', label: 'Library', icon: Sparkles, context: 'ice' as NavContext },
  ];

  const audienceLinks = [
    { href: '/for/business', label: 'For Businesses', icon: Building2 },
    { href: '/for/creators', label: 'For Creators', icon: Film },
    { href: '/for/educator', label: 'For Educators', icon: GraduationCap },
  ];
  
  const showCTAs = !user && context === 'marketing';

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 border-b",
        transparent 
          ? "bg-transparent border-transparent" 
          : "bg-gradient-to-r from-black via-neutral-950 to-black border-white/5 backdrop-blur-md"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-global-logo">
              <img 
                src={LOGO_URL} 
                alt="NextMonth" 
                className="h-24 w-auto"
                style={{ clipPath: 'inset(35% 0 35% 0)' }}
              />
            </div>
          </Link>

          {showBreadcrumb && breadcrumbLabel && (
            <div className="hidden sm:flex items-center gap-2 text-white/40">
              <span>/</span>
              {breadcrumbHref ? (
                <Link href={breadcrumbHref}>
                  <span className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer">
                    {breadcrumbLabel}
                  </span>
                </Link>
              ) : (
                <span className="text-sm text-white/60">{breadcrumbLabel}</span>
              )}
            </div>
          )}
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
                        "text-white/60 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-3 text-xs",
                        isActive && "text-white bg-white/10"
                      )}
                      data-testid={`global-nav-${link.context}`}
                    >
                      <link.icon className="w-3.5 h-3.5" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              
              {context === 'marketing' && (
                <>
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  {audienceLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-white/50 hover:text-white hover:bg-white/10 gap-1 h-8 px-2 text-xs"
                        data-testid={`global-nav-${link.href.split('/').pop()}`}
                      >
                        <link.icon className="w-3 h-3" />
                        {link.label}
                      </Button>
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              {showCTAs && (
                <>
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
                  <Link href="/orbit/claim">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 gap-1.5 h-8 px-3 text-xs"
                      data-testid="global-cta-orbit"
                    >
                      <Orbit className="w-3.5 h-3.5" />
                      Claim Orbit
                    </Button>
                  </Link>
                </>
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
                  <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-white/10">
                    <div className="px-2 py-1.5 border-b border-white/10">
                      <p className="text-sm font-medium text-white">{user.username}</p>
                      {user.isAdmin && (
                        <p className="text-[10px] text-white/50">Admin</p>
                      )}
                    </div>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer text-white/80 hover:text-white" data-testid="global-menu-profile">
                        <User className="w-4 h-4 mr-2" />
                        My Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orbit/my" className="cursor-pointer text-white/80 hover:text-white" data-testid="global-menu-orbits">
                        <Orbit className="w-4 h-4 mr-2" />
                        My Orbits
                      </Link>
                    </DropdownMenuItem>
                    {onStartTour && (
                      <DropdownMenuItem 
                        onClick={onStartTour} 
                        className="cursor-pointer text-white/80 hover:text-white" 
                        data-testid="global-menu-tour"
                      >
                        <Compass className="w-4 h-4 mr-2" />
                        Take the Tour
                      </DropdownMenuItem>
                    )}
                    {user.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer text-white/80 hover:text-white" data-testid="global-menu-admin">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem 
                      onClick={toggleTheme} 
                      className="cursor-pointer text-white/80 hover:text-white"
                      data-testid="global-menu-theme"
                    >
                      {theme === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 mr-2" />
                          Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 mr-2" />
                          Dark Mode
                        </>
                      )}
                    </DropdownMenuItem>
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
                    className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-3 text-xs" 
                    data-testid="global-signin"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign In</span>
                  </Button>
                </Link>
              )}

              <button 
                className="md:hidden p-1.5 text-white/70 hover:text-white"
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
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-3 space-y-1">
          {quickLinks.map((link) => {
            const isActive = context === link.context;
            return (
              <Link key={link.href} href={link.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer",
                    isActive && "text-white bg-white/10"
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
          
          {context === 'marketing' && (
            <>
              <div className="border-t border-white/10 my-2" />
              {audienceLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`global-mobile-${link.href.split('/').pop()}`}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </div>
                </Link>
              ))}
            </>
          )}
          
          {user?.isAdmin && (
            <>
              <div className="border-t border-white/10 my-2" />
              <Link href="/admin">
                <div 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="global-mobile-admin"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </div>
              </Link>
            </>
          )}
          
          {user && (
            <div 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              onClick={toggleTheme}
              data-testid="global-mobile-theme"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
