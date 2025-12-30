import { Link, useLocation } from "wouter";
import { Home, Play, MessageSquare, BookOpen, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import GlobalNav from "./GlobalNav";
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: "/app", icon: Home, label: "Home" },
    { href: "/today", icon: Play, label: "Today" },
    { href: "/journal", icon: BookOpen, label: "Journal" },
    { href: "/chat", icon: MessageSquare, label: "Chat" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GlobalNav context="app" />
      
      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full border-x border-border shadow-2xl">
        <aside className="hidden lg:flex w-48 flex-col border-r border-border p-4 shrink-0 bg-background/95 backdrop-blur-sm">
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm",
                    (location === item.href || (item.href === "/app" && location === "/app"))
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
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm mt-4",
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
        </aside>

        <main className="flex-1 pb-20 lg:pb-0 w-full">
          {children}
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 px-4 py-3 flex justify-around">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center gap-1 cursor-pointer",
                  (location === item.href || (item.href === "/app" && location === "/app"))
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
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
                <Settings className="w-5 h-5" />
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
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium">{user ? "Account" : "Sign In"}</span>
            </div>
          </Link>
        </nav>
      </div>
    </div>
  );
}
