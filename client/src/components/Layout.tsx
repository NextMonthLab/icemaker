import { Link, useLocation } from "wouter";
import { Home, Play, MessageSquare, BookOpen, Settings, User, LogIn, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
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
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row max-w-md mx-auto md:max-w-2xl lg:max-w-5xl border-x border-border shadow-2xl relative">
      {/* Desktop Sidebar (Hidden on Mobile and Tablet) */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-border p-5 shrink-0 bg-background/95 backdrop-blur-sm">
        <img src="/nextscene-logo.png" alt="NextScene" className="h-6 mb-6" />
        <nav className="space-y-3 flex-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm",
                  location === item.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
          
          {user?.isAdmin && (
            <Link href="/admin">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm mt-6",
                  location.startsWith("/admin")
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid="nav-admin"
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </div>
            </Link>
          )}
        </nav>

        {/* User section at bottom of sidebar */}
        <div className="mt-auto pt-4 border-t border-border">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-muted transition-colors"
                  data-testid="user-menu-trigger"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{user.username}</p>
                    {user.isAdmin && (
                      <p className="text-xs text-muted-foreground">Admin</p>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer" data-testid="menu-profile">
                    <User className="w-4 h-4 mr-2" />
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive" data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="w-full" data-testid="button-signin">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 lg:pb-0 w-full">
        {children}
      </main>

      {/* Mobile & Tablet Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border z-50 px-4 py-3 flex justify-around max-w-2xl mx-auto md:rounded-t-xl">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex flex-col items-center gap-1 cursor-pointer",
                location === item.href ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
        
        {user?.isAdmin && (
          <Link href="/admin">
            <div
              className={cn(
                "flex flex-col items-center gap-1 cursor-pointer",
                location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"
              )}
              data-testid="mobile-nav-admin"
            >
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-medium">Admin</span>
            </div>
          </Link>
        )}
        
        <Link href={user ? "/profile" : "/login"}>
          <div
            className={cn(
              "flex flex-col items-center gap-1 cursor-pointer",
              location === "/profile" || location === "/login" ? "text-primary" : "text-muted-foreground"
            )}
            data-testid="mobile-nav-account"
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] font-medium">{user ? "Account" : "Sign In"}</span>
          </div>
        </Link>
      </nav>
    </div>
  );
}
