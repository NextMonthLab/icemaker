import { Newspaper } from "lucide-react";
import PersonaPage from "./PersonaPage";

const newsPersona = {
  id: "news_outlet",
  title: "News & Media",
  heroTitle: "Breaking News, Transformed Into Immersive Stories",
  heroSubtitle: "Turn your articles into daily visual story drops that keep readers engaged and coming back for more.",
  description: "News organizations use NextMonth to bring complex stories to life with AI-generated visuals, character perspectives, and serialized daily drops.",
  icon: Newspaper,
  color: "from-red-500/10 via-transparent to-orange-500/10",
  useCases: [
    {
      title: "Breaking News Series",
      description: "Transform developing stories into daily visual updates with AI-generated imagery and narrative summaries."
    },
    {
      title: "Investigative Deep Dives",
      description: "Turn long-form investigations into serialized story cards that reveal new insights each day."
    },
    {
      title: "Character Interviews",
      description: "Let readers engage with AI-powered versions of newsmakers to explore different perspectives."
    }
  ],
  benefits: [
    "Transform any article URL into story cards instantly",
    "AI generates consistent visual imagery for your stories",
    "Scheduled daily drops keep readers coming back",
    "Character chat lets audiences explore perspectives",
    "Export clips for social media distribution",
    "Analytics show engagement across your content",
    "Source guardrails ensure factual accuracy",
    "Works with any CMS or publishing system"
  ],
  testimonial: {
    quote: "NextMonth helped us increase daily reader retention by 3x. Our investigative series now feels like must-watch content.",
    author: "Sarah Chen",
    role: "Digital Innovation Director, Metro News"
  }
};

export default function ForNews() {
  return <PersonaPage persona={newsPersona} />;
}
