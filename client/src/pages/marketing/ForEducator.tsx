import { GraduationCap } from "lucide-react";
import PersonaPage from "./PersonaPage";

const educatorPersona = {
  id: "educator",
  title: "Educators",
  heroTitle: "Make Learning Unforgettable With Story-Driven Lessons",
  heroSubtitle: "Transform educational content into immersive narratives that students can't wait to continue.",
  description: "Educators use NextMonth to create engaging learning experiences through serialized lessons, interactive characters, and visual storytelling.",
  icon: GraduationCap,
  color: "from-green-500/10 via-transparent to-emerald-500/10",
  useCases: [
    {
      title: "Curriculum Storytelling",
      description: "Turn lessons into narrative journeys where students discover concepts through unfolding stories."
    },
    {
      title: "Historical Characters",
      description: "Let students chat with AI versions of historical figures to explore different perspectives."
    },
    {
      title: "Course Companions",
      description: "Create AI tutors that guide students through material with personalized conversations."
    }
  ],
  benefits: [
    "Transform any educational content into stories",
    "AI-generated visuals bring concepts to life",
    "Interactive characters as learning companions",
    "Daily drops encourage consistent study habits",
    "Source guardrails ensure educational accuracy",
    "Track student engagement and progress",
    "Works with any LMS or course platform",
    "Accessibility features for inclusive learning"
  ],
  testimonial: {
    quote: "My students went from dreading history homework to asking when the next story chapter drops. Engagement increased 400%.",
    author: "Dr. Maria Santos",
    role: "History Professor, State University"
  }
};

export default function ForEducator() {
  return <PersonaPage persona={educatorPersona} />;
}
