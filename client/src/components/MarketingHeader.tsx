import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Building2, 
  Film, 
  GraduationCap, 
  Radio, 
  Menu,
  X,
  ChevronDown
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOGO_URL = "/logo.png";

const useCaseLinks = [
  { href: "/for/brands", label: "For Brands & Business", icon: Building2 },
  { href: "/for/creators", label: "For Creators & Filmmakers", icon: Film },
  { href: "/for/knowledge", label: "For Knowledge & Learning", icon: GraduationCap },
];

export default function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 to-black/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between">
        <Link href="/">
          <div className="h-16 md:h-20 flex items-center">
            <img 
              src={LOGO_URL} 
              alt="NextMonth" 
              className="h-24 md:h-28 w-auto cursor-pointer" 
              style={{ clipPath: 'inset(30% 0 30% 0)' }}
              data-testid="link-logo"
            />
          </div>
        </Link>
        
        <nav className="hidden md:flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="text-white/80 hover:text-white hover:bg-white/10 gap-1"
                data-testid="nav-use-cases"
              >
                Use Cases
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-neutral-900 border-white/10">
              {useCaseLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>
                    <div className="flex items-center gap-2 cursor-pointer w-full text-white/80 hover:text-white" data-testid={`nav-${link.href.split('/').pop()}`}>
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Link href="/ai-discovery-control">
            <Button 
              variant="ghost" 
              className={`text-white/80 hover:text-white hover:bg-white/10 gap-2 ${location === '/ai-discovery-control' ? 'text-white bg-white/10' : ''}`}
              data-testid="nav-ai-discovery"
            >
              <Radio className="w-4 h-4" />
              AI Discovery
            </Button>
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" data-testid="button-login">
              Sign In
            </Button>
          </Link>
          <Link href="/login?signup=true">
            <Button className="bg-pink-500 hover:bg-pink-400 text-white border-0 shadow-lg shadow-pink-500/20 gap-2" data-testid="button-signup">
              <Sparkles className="w-4 h-4" />
              Get Started
            </Button>
          </Link>
        </div>

        <button 
          className="md:hidden p-2 text-white/80 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 px-4 py-4 space-y-2">
          <p className="text-xs uppercase text-white/40 px-3 mb-2">Use Cases</p>
          {useCaseLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
                data-testid={`mobile-nav-${link.href.split('/').pop()}`}
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </div>
            </Link>
          ))}
          
          <div className="border-t border-white/10 pt-2 mt-2">
            <Link href="/ai-discovery-control">
              <div 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-nav-ai-discovery"
              >
                <Radio className="w-5 h-5" />
                AI Discovery
              </div>
            </Link>
          </div>
          
          <div className="border-t border-white/10 pt-4 mt-2 space-y-2">
            <Link href="/login">
              <Button 
                variant="outline" 
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-button-login"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/login?signup=true">
              <Button 
                className="w-full bg-pink-500 hover:bg-pink-400 text-white gap-2"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="mobile-button-signup"
              >
                <Sparkles className="w-4 h-4" />
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
