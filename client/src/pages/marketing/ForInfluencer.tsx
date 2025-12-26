import { Star } from "lucide-react";
import PersonaPage from "./PersonaPage";

const influencerPersona = {
  id: "influencer",
  title: "Creators & Influencers",
  heroTitle: "Build A Story Universe Your Fans Can't Stop Watching",
  heroSubtitle: "Transform your content into serialized story experiences with AI characters your audience can actually talk to.",
  description: "Creators use NextScene to build deeper connections through immersive narratives, daily content drops, and interactive AI characters.",
  icon: Star,
  color: "from-purple-500/10 via-transparent to-pink-500/10",
  useCases: [
    {
      title: "Serialized Content Series",
      description: "Turn your best content into daily story drops that build anticipation and keep fans engaged."
    },
    {
      title: "Interactive Fan Experiences",
      description: "Let fans chat with AI versions of your personas or story characters for deeper connection."
    },
    {
      title: "Behind-the-Scenes Journeys",
      description: "Share your creative process as an unfolding narrative with exclusive daily reveals."
    }
  ],
  benefits: [
    "Transform any content into visual story cards",
    "AI generates stunning imagery for your aesthetic",
    "Create AI character versions of your personas",
    "Daily drops keep fans coming back",
    "Export video clips for TikTok, Reels, and YouTube",
    "Voice narration brings stories to life",
    "Track fan engagement and growth",
    "Monetization options for premium content"
  ],
  testimonial: {
    quote: "My audience went from watching one video to checking in daily for the next story drop. NextScene helped me build a real community.",
    author: "Alex Rivera",
    role: "Content Creator, 2M Followers"
  }
};

export default function ForInfluencer() {
  return <PersonaPage persona={influencerPersona} />;
}
