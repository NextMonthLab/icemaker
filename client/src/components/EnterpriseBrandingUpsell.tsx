import { Link } from "wouter";
import { ArrowRight, Building2 } from "lucide-react";

interface EnterpriseBrandingUpsellProps {
  context?: "captions" | "titles" | "audio" | "assets" | "general";
  variant?: "inline" | "compact" | "card";
  className?: string;
}

const contextMessages: Record<string, string> = {
  captions: "Custom caption styles and motion aligned to your brand",
  titles: "Custom title packs with your fonts, colours, and layouts",
  audio: "Custom music beds and sonic identity for your brand",
  assets: "Build a brand asset library with governance controls",
  general: "Custom branding for titles, captions, music, and assets",
};

export function EnterpriseBrandingUpsell({ 
  context = "general", 
  variant = "inline",
  className = "" 
}: EnterpriseBrandingUpsellProps) {
  const message = contextMessages[context] || contextMessages.general;

  if (variant === "compact") {
    return (
      <Link 
        href="/enterprise/custom-branding" 
        className={`inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors ${className}`}
        data-testid="link-enterprise-branding-compact"
      >
        <Building2 className="w-3 h-3" />
        <span>Enterprise custom branding available</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    );
  }

  if (variant === "card") {
    return (
      <div className={`p-4 rounded-lg bg-cyan-950/20 border border-cyan-500/20 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-cyan-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 mb-1">
              Enterprise custom branding
            </p>
            <p className="text-xs text-white/50 mb-2">
              {message}
            </p>
            <Link 
              href="/enterprise/custom-branding" 
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              data-testid="link-enterprise-branding-card"
            >
              Find out more
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-md bg-cyan-950/10 border border-cyan-500/10 ${className}`}>
      <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
      <span className="text-xs text-white/60 flex-1">
        Enterprise custom branding available
      </span>
      <Link 
        href="/enterprise/custom-branding" 
        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap"
        data-testid="link-enterprise-branding-inline"
      >
        Find out more
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

export default EnterpriseBrandingUpsell;
