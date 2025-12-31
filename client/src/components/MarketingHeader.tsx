import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Building2, 
  Film, 
  GraduationCap, 
  Radio, 
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GlobalNav from "./GlobalNav";
import { useAuth } from "@/lib/auth";

const useCaseLinks = [
  { href: "/for/brands", label: "For Brands & Business", icon: Building2 },
  { href: "/for/creators", label: "For Creators & Filmmakers", icon: Film },
  { href: "/for/knowledge", label: "For Knowledge & Learning", icon: GraduationCap },
];

const audienceLinks = [
  { href: "/for/business", label: "Businesses", icon: Building2 },
  { href: "/for/creators", label: "Creators", icon: Film },
  { href: "/for/educator", label: "Educators", icon: GraduationCap },
];

export default function MarketingHeader() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <GlobalNav context="marketing" />
      
      <nav className="hidden md:block bg-gradient-to-b from-black/80 to-black/60 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {audienceLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 ${location === link.href ? 'text-white bg-white/10' : ''}`}
                  data-testid={`nav-${link.href.split('/').pop()}`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Button>
              </Link>
            ))}
            
            <div className="w-px h-4 bg-white/20 mx-2" />
            
            <Link href="/ai-discovery-control">
              <Button 
                variant="ghost" 
                size="sm"
                className={`text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 ${location === '/ai-discovery-control' || location === '/ai-discovery' ? 'text-white bg-white/10' : ''}`}
                data-testid="nav-ai-discovery"
              >
                <Radio className="w-3.5 h-3.5" />
                AI Discovery
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!user && (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 h-8" data-testid="button-login">
                    Sign In
                  </Button>
                </Link>
                <Link href="/login?signup=true">
                  <Button size="sm" className="bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/20 gap-1.5 h-8" data-testid="button-signup">
                    <Sparkles className="w-3.5 h-3.5" />
                    Get Started
                  </Button>
                </Link>
              </>
            )}
            {user && (
              <Link href="/app">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white gap-1.5 h-8" data-testid="button-go-to-app">
                  Go to App
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
