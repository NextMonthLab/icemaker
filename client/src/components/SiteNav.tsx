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
  Shield,
  Sun,
  Moon,
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

const LOGO_URL_LIGHT = "/logo.png";
const LOGO_URL_DARK = "https://res.cloudinary.com/drl0fxrkq/image/upload/h_250,fl_preserve_transparency/v1746537994/0A6752C9-3498-4269-9627-A1BE7A36A800_dgqotr.jpg";

type NavVariant = 'marketing' | 'app';

interface SiteNavProps {
  variant?: NavVariant;
  onStartTour?: () => void;
}

const marketingLinks = [
  { href: '/for/business', label: 'For Businesses', icon: Building2 },
  { href: '/for/creators', label: 'For Creators', icon: Film },
  { href: '/for/educator', label: 'For Educators', icon: GraduationCap },
];

const appLinks = [
  { href: '/launchpad', label: 'Launchpad', icon: Home },
  { href: '/orbit', label: 'Orbits', icon: Orbit },
  { href: '/library', label: 'Library', icon: Sparkles },
];

export default function SiteNav({ variant: explicitVariant, onStartTour }: SiteNavProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const variant: NavVariant = explicitVariant || (location.startsWith('/for') || location === '/' ? 'marketing' : 'app');
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  const logoHref = variant === 'marketing' ? '/' : '/launchpad';
  const centerLinks = variant === 'marketing' ? marketingLinks : appLinks;

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const isActiveLink = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <Link href={logoHref}>
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-site-logo">
            <img 
              src={theme === 'light' ? LOGO_URL_DARK : LOGO_URL_LIGHT} 
              alt="NextMonth" 
              className="h-24 w-auto"
              style={{ clipPath: 'inset(35% 0 35% 0)' }}
            />
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {centerLinks.map((link) => {
            const isActive = isActiveLink(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={cn(
                    "text-white/60 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-3 text-xs",
                    isActive && "text-white bg-white/10"
                  )}
                  data-testid={`nav-${link.href.split('/').pop()}`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right: Auth + CTAs */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {variant === 'app' && (
                <Link href="/try">
                  <Button 
                    size="sm"
                    className="hidden sm:flex bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600 text-white gap-1.5 h-8 px-3 text-xs"
                    data-testid="nav-cta-ice"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Try IceMaker
                  </Button>
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
                    data-testid="nav-user-menu"
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
                    <Link href="/profile" className="cursor-pointer text-white/80 hover:text-white" data-testid="nav-menu-profile">
                      <User className="w-4 h-4 mr-2" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/orbit/my" className="cursor-pointer text-white/80 hover:text-white" data-testid="nav-menu-orbits">
                      <Orbit className="w-4 h-4 mr-2" />
                      My Orbits
                    </Link>
                  </DropdownMenuItem>
                  {onStartTour && (
                    <DropdownMenuItem 
                      onClick={onStartTour} 
                      className="cursor-pointer text-white/80 hover:text-white" 
                      data-testid="nav-menu-tour"
                    >
                      <Compass className="w-4 h-4 mr-2" />
                      Take the Tour
                    </DropdownMenuItem>
                  )}
                  {user.isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer text-white/80 hover:text-white" data-testid="nav-menu-admin">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    onClick={toggleTheme} 
                    className="cursor-pointer text-white/80 hover:text-white"
                    data-testid="nav-menu-theme"
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
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:text-red-300" data-testid="nav-menu-logout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-3 text-xs" 
                  data-testid="nav-signin"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
              <Link href="/try">
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600 text-white gap-1.5 h-8 px-3 text-xs"
                  data-testid="nav-cta-ice"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Try IceMaker
                </Button>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button 
            className="md:hidden p-1.5 text-foreground/70 hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="nav-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-3 space-y-1">
          {centerLinks.map((link) => {
            const isActive = isActiveLink(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer",
                    isActive && "text-white bg-white/10"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`nav-mobile-${link.href.split('/').pop()}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </div>
              </Link>
            );
          })}
          
          {user?.isAdmin && (
            <>
              <div className="border-t border-white/10 my-2" />
              <Link href="/admin">
                <div 
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer",
                    isActiveLink('/admin') && "text-white bg-white/10"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="nav-mobile-admin"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </div>
              </Link>
            </>
          )}
          
          {!user && (
            <>
              <div className="border-t border-white/10 my-2" />
              <Link href="/try">
                <div 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-white/10 cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="nav-mobile-ice"
                >
                  <Sparkles className="w-4 h-4" />
                  Try IceMaker
                </div>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
