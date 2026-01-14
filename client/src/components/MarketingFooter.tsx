import { Link } from "wouter";

export function MarketingFooter() {
  return (
    <footer className="py-12 bg-black border-t border-white/5">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-white/40 text-sm">
            © {new Date().getFullYear()} IceMaker. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/origins" className="text-white/40 hover:text-white/60 transition-colors" data-testid="link-origins">Origins</Link>
            <Link href="/privacy" className="text-white/40 hover:text-white/60 transition-colors" data-testid="link-privacy">Privacy</Link>
            <Link href="/terms" className="text-white/40 hover:text-white/60 transition-colors" data-testid="link-terms">Terms</Link>
            <Link href="/cookies" className="text-white/40 hover:text-white/60 transition-colors" data-testid="link-cookies">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
