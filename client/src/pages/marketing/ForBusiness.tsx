import { Building2 } from "lucide-react";
import PersonaPage from "./PersonaPage";

const businessPersona = {
  id: "business",
  title: "Businesses",
  heroTitle: "Turn Your Brand Story Into An Experience",
  heroSubtitle: "Transform product launches, case studies, and company updates into engaging visual narratives your audience will remember.",
  description: "Businesses use NextScene to create compelling brand narratives that capture attention and drive engagement across channels.",
  icon: Building2,
  color: "from-blue-500/10 via-transparent to-cyan-500/10",
  useCases: [
    {
      title: "Product Launch Stories",
      description: "Build anticipation with serialized daily drops that reveal features, benefits, and customer stories."
    },
    {
      title: "Customer Success Series",
      description: "Turn case studies into visual journeys that showcase real results and transformation."
    },
    {
      title: "Company Culture Content",
      description: "Share your team's story through interactive employee spotlights and behind-the-scenes narratives."
    }
  ],
  benefits: [
    "Transform marketing content into story experiences",
    "AI-generated visuals maintain brand consistency",
    "Interactive character chat for product demos",
    "Daily drops create ongoing engagement",
    "Export video clips for ad campaigns",
    "Track engagement metrics and conversions",
    "Team collaboration with role-based access",
    "Embed stories on your website or share directly"
  ],
  testimonial: {
    quote: "Our product launch story series generated 5x more engagement than traditional marketing emails. Customers couldn't wait for the next chapter.",
    author: "Michael Torres",
    role: "VP of Marketing, TechFlow Inc"
  }
};

export default function ForBusiness() {
  return <PersonaPage persona={businessPersona} />;
}
