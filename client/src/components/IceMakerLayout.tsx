import { Link, useLocation } from "wouter";
import { 
  Sparkles,
  LayoutDashboard,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import GlobalNav from "./GlobalNav";
import React from "react";

const iceMakerNavItems = [
  { href: "/icemaker", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/icemaker/create", icon: Plus, label: "Create Experience" },
];

export default function IceMakerLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isActive = (item: typeof iceMakerNavItems[0]) => {
    if (item.exact) {
      return location === item.href;
    }
    return location.startsWith(item.href);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <GlobalNav context="ice" />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        <aside className="hidden lg:flex w-56 flex-col border-r border-white/10 p-4 shrink-0 bg-black/95">
          <div className="flex items-center gap-2 px-3 py-2 mb-4">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <span className="font-semibold text-white">IceMaker</span>
          </div>
          
          <nav className="space-y-1 flex-1">
            {iceMakerNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm",
                    isActive(item)
                      ? "bg-pink-500/20 text-pink-400 font-medium"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                  data-testid={`icemaker-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            ))}
          </nav>
        </aside>

        <nav className="lg:hidden bg-black/95 border-b border-white/10 px-2 py-2 flex gap-1 overflow-x-auto">
          {iceMakerNavItems.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer text-xs whitespace-nowrap",
                  isActive(item)
                    ? "bg-pink-500/20 text-pink-400"
                    : "text-white/60 hover:bg-white/5"
                )}
                data-testid={`icemaker-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
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
