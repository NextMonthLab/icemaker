import { Glasses, Camera, Headphones, Shield, Battery, Wallet } from "lucide-react";

const explainers = [
  {
    id: "what-are",
    title: "What smart glasses are",
    description: "Wearable technology that adds digital features to traditional eyewear, from audio playback to augmented reality overlays.",
    icon: Glasses,
  },
  {
    id: "vs-ar",
    title: "Smart glasses vs AR glasses",
    description: "Smart glasses focus on audio and simple notifications. AR glasses add visual overlays and spatial computing capabilities.",
    icon: Camera,
  },
  {
    id: "creators",
    title: "Best for creators",
    description: "Look for high-quality cameras, seamless phone integration, and quick sharing features for capturing spontaneous content.",
    icon: Camera,
  },
  {
    id: "comfort",
    title: "Comfort, battery and fit",
    description: "Weight distribution, nose bridge design, and battery life (typically 4-6 hours) are critical for all-day wear.",
    icon: Battery,
  },
  {
    id: "privacy",
    title: "Privacy and recording etiquette",
    description: "Visible recording indicators, permission culture, and local laws vary. Know the etiquette before you capture.",
    icon: Shield,
  },
  {
    id: "budget",
    title: "What to expect at different budgets",
    description: "Under £300: audio-first. £300-600: premium audio + camera. £600+: true AR displays and enterprise features.",
    icon: Wallet,
  },
];

export function QuickExplainersGrid() {
  return (
    <section className="py-16 px-4 bg-zinc-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Quick explainers</h2>
        <p className="text-zinc-400 text-center mb-10">Get up to speed on smart glasses in minutes</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {explainers.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
              data-testid={`explainer-${item.id}`}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                <item.icon className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-zinc-400 text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
