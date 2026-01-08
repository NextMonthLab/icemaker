import { Mail, Sparkles, Megaphone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function CTASections() {
  const [, setLocation] = useLocation();

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-900/20 to-zinc-900 border border-emerald-500/20">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Friend of Smart Glasses</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Get the latest Smart Glasses insights and news in a simple newsletter. Free forever.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Weekly category updates
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-emerald-400" />
                New product alerts
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Community picks
              </li>
            </ul>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setLocation("/smartglasses/friend")}
              data-testid="button-cta-friend"
            >
              Become a Friend (free)
            </Button>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-purple-900/30 to-zinc-900 border border-purple-500/30 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="px-2 py-1 text-xs font-medium bg-purple-500 text-white rounded-full">Popular</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Influencer Mode</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Unlimited deep chat, saved briefs, and create Smart Glasses content with ICE Maker.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-purple-400" />
                Unlimited category chat
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-purple-400" />
                Save briefs and talking points
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-purple-400" />
                ICE packs: hooks, scripts, captions
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-purple-400" />
                Comparison templates
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-purple-400" />
                Posting plans
              </li>
            </ul>
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => setLocation("/smartglasses/influencer")}
              data-testid="button-cta-influencer"
            >
              Become an Influencer
            </Button>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-amber-900/20 to-zinc-900 border border-amber-500/20">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <Megaphone className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Advertise here</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Display-only sponsored placements. Clearly labelled. Does not affect editorial guidance.
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-amber-400" />
                Reach engaged shoppers
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-amber-400" />
                Clear sponsorship labels
              </li>
              <li className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="w-4 h-4 text-amber-400" />
                No editorial influence
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setLocation("/smartglasses/partners")}
              data-testid="button-cta-advertise"
            >
              Advertise here
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
