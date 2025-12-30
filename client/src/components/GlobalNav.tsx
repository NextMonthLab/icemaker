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
  X
} from "lucide-react";
import { useState } from "react";
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
  minimal = false
}: GlobalNavProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const quickLinks = [
    { href: '/', label: 'Home', icon: Home, context: 'marketing' as NavContext },
    { href: '/icemaker', label: 'IceMaker', icon: Sparkles, context: 'ice' as NavContext },
    { href: '/orbit', label: 'Orbit', icon: Orbit, context: 'orbit' as NavContext },
  ];

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
                className="h-16 w-auto"
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
            </nav>

            <div className="flex items-center gap-2">
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
                    {user.isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer text-white/80 hover:text-white" data-testid="global-menu-admin">
                          <Sparkles className="w-4 h-4 mr-2" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
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
        </div>
      )}
    </header>
  );
}
