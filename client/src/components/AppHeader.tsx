import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home,
  Play,
  BookOpen,
  MessageSquare,
  Settings,
  User,
  LogIn,
  LogOut,
  ChevronDown,
  Globe,
  ArrowLeft
} from "lucide-react";
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

interface AppHeaderProps {
  showBackToMarketing?: boolean;
}

export default function AppHeader({ showBackToMarketing = true }: AppHeaderProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/app", icon: Home, label: "Home" },
    { href: "/today", icon: Play, label: "Today" },
    { href: "/journal", icon: BookOpen, label: "Journal" },
    { href: "/chat", icon: MessageSquare, label: "Chat" },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-b from-black/95 to-black/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackToMarketing && (
            <Link href="/">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5 hidden sm:flex"
                data-testid="link-back-home"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs">Home</span>
              </Button>
            </Link>
          )}
          <Link href="/app">
            <div className="h-12 flex items-center">
              <img 
                src={LOGO_URL} 
                alt="NextMonth" 
                className="h-16 w-auto cursor-pointer" 
                style={{ clipPath: 'inset(30% 0 30% 0)' }}
                data-testid="link-app-logo"
              />
            </div>
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button 
                variant="ghost" 
                size="sm"
                className={cn(
                  "text-white/70 hover:text-white hover:bg-white/10 gap-2",
                  (location === item.href || (item.href === "/app" && location === "/app")) && "text-white bg-white/10"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            </Link>
          ))}
          
          {user?.isAdmin && (
            <Link href="/admin">
              <Button 
                variant="ghost" 
                size="sm"
                className={cn(
                  "text-white/70 hover:text-white hover:bg-white/10 gap-2",
                  location.startsWith("/admin") && "text-white bg-white/10"
                )}
                data-testid="nav-admin"
              >
                <Settings className="w-4 h-4" />
                Admin
              </Button>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors"
                  data-testid="user-menu-trigger"
                >
                  <Avatar className="w-8 h-8 border border-white/20">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-white">{user.username}</span>
                    {user.isAdmin && (
                      <span className="text-[10px] text-white/50">Admin</span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/50 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-white/10">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer text-white/80 hover:text-white" data-testid="menu-profile">
                    <User className="w-4 h-4 mr-2" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild>
                  <Link href="/" className="cursor-pointer text-white/80 hover:text-white" data-testid="menu-marketing">
                    <Globe className="w-4 h-4 mr-2" />
                    Back to Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:text-red-300" data-testid="menu-logout">
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
                className="text-white/80 hover:text-white hover:bg-white/10 gap-2" 
                data-testid="button-signin"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
