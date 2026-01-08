import { Glasses, Sparkles, Users, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface HeroSectionProps {
  onStartAudit: () => void;
  onExploreQuestions: () => void;
}

export function HeroSection({ onStartAudit, onExploreQuestions }: HeroSectionProps) {
  const [, setLocation] = useLocation();

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />
      
      <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Glasses className="w-5 h-5 text-pink-400" />
            <span className="text-sm text-zinc-300">Category Discovery</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-pink-200 to-purple-200 bg-clip-text text-transparent" data-testid="text-smart-glasses-title">
            Smart Glasses
          </h1>
          
          <p className="text-xl md:text-2xl text-zinc-300 mb-10 max-w-2xl mx-auto">
            Understand the tech, compare options, and stay ahead of what's next.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              onClick={onStartAudit}
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-lg px-8"
              data-testid="button-start-audit"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start the Smart Glasses Audit
            </Button>
            <Button
              onClick={onExploreQuestions}
              size="lg"
              variant="outline"
              className="border-zinc-700 hover:bg-zinc-800 text-lg px-8"
              data-testid="button-explore-questions"
            >
              Explore popular questions
            </Button>
          </div>
          
          <p className="text-sm text-zinc-500 mb-12">
            Editorial guidance is neutral. Sponsored placements are clearly labelled.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => setLocation("/smartglasses/friend")}
              data-testid="button-become-friend"
            >
              <Users className="w-4 h-4 mr-2" />
              Become a Friend (free)
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => setLocation("/smartglasses/influencer")}
              data-testid="button-become-influencer"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Become an Influencer
            </Button>
            <Button
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setLocation("/smartglasses/partners")}
              data-testid="button-advertise"
            >
              <Megaphone className="w-4 h-4 mr-2" />
              Advertise here
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
