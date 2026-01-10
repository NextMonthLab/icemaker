import { Link, useLocation } from "wouter";
import { 
  Orbit,
  Globe,
  Building2,
  LogIn
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalNav from "./GlobalNav";
import React from "react";
import { useQuery } from "@tanstack/react-query";

interface OrbitsResponse {
  orbits: Array<{ businessSlug: string }>;
}

export default function OrbitLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: userData, isLoading: userLoading } = useQuery<{ user: { id: number } } | null>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 60000,
  });

  const { data: orbitsData } = useQuery<OrbitsResponse>({
    queryKey: ["my-orbits"],
    queryFn: async () => {
      const response = await fetch("/api/me/orbits");
      if (!response.ok) return { orbits: [] };
      return response.json();
    },
    enabled: !!userData?.user,
    staleTime: 60000,
  });

  const isLoggedIn = !!userData?.user;
  const hasOrbits = orbitsData && orbitsData.orbits.length > 0;

  const ownerNavItems = [
    { href: "/orbit/my", icon: Building2, label: "My Orbits" },
    { href: "/orbit", icon: Globe, label: "Explore Orbits", exact: true },
  ];

  const nonOwnerNavItems = [
    { href: "/orbit", icon: Globe, label: "Explore Orbits", exact: true },
    { href: "/orbit/claim", icon: Building2, label: "Claim an Orbit" },
  ];

  const guestNavItems = [
    { href: "/orbit", icon: Globe, label: "Explore Orbits", exact: true },
    { href: "/orbit/claim", icon: Building2, label: "Claim an Orbit" },
    { href: `/login?return=${encodeURIComponent(location)}`, icon: LogIn, label: "Sign In" },
  ];

  const navItems = isLoggedIn 
    ? (hasOrbits ? ownerNavItems : nonOwnerNavItems)
    : guestNavItems;

  const isActive = (item: typeof navItems[0]) => {
    if ('exact' in item && item.exact) {
      return location === item.href;
    }
    return location.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GlobalNav context="orbit" />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        <aside className="hidden lg:flex w-56 flex-col border-r border-border p-4 shrink-0 bg-background/95">
          <div className="flex items-center gap-2 px-3 py-2 mb-4">
            <Orbit className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-foreground">Orbit</span>
          </div>
          
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm",
                    isActive(item)
                      ? "bg-blue-500/20 text-blue-500 font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid={`orbit-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            ))}
          </nav>

          {isLoggedIn && hasOrbits && (
            <div className="pt-4 border-t border-border mt-4">
              <p className="text-xs text-muted-foreground px-3 mb-2">Quick Access</p>
              {orbitsData.orbits.slice(0, 3).map((orbit) => (
                <Link key={orbit.businessSlug} href={`/orbit/${orbit.businessSlug}/hub`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded cursor-pointer truncate">
                    <Globe className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{orbit.businessSlug}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <nav className="lg:hidden bg-background/95 border-b border-border px-2 py-2 flex gap-1 overflow-x-auto">
          {navItems.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer text-xs whitespace-nowrap",
                  isActive(item)
                    ? "bg-blue-500/20 text-blue-500"
                    : "text-muted-foreground hover:bg-muted"
                )}
                data-testid={`orbit-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
