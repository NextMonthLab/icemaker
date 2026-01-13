import { Link } from "wouter";
import { 
  Sparkles, 
  FolderOpen, 
  Layout, 
  Upload,
  Wand2,
  Play,
  ArrowRight
} from "lucide-react";
import IceMakerLayout from "@/components/IceMakerLayout";

export default function IceMakerHome() {
  return (
    <IceMakerLayout>
      <div className="p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white" data-testid="text-icemaker-title">
            IceMaker
          </h1>
          <p className="text-white/60" data-testid="text-icemaker-subtitle">
            Transform content into interactive cinematic experiences
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/icemaker/create">
            <div className="group p-6 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer" data-testid="card-create-experience">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Create Experience</h3>
              <p className="text-sm text-white/60 mb-4">
                Start a new interactive experience from scratch or upload content
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-medium group-hover:gap-2 transition-all">
                Get Started <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>

          <Link href="/icemaker/projects">
            <div className="group p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer" data-testid="card-my-projects">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                <FolderOpen className="w-6 h-6 text-white/60" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">My Projects</h3>
              <p className="text-sm text-white/60 mb-4">
                View and manage your existing experiences
              </p>
              <div className="flex items-center text-white/60 text-sm font-medium group-hover:gap-2 transition-all">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>

          <Link href="/icemaker/templates">
            <div className="group p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer" data-testid="card-templates">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                <Layout className="w-6 h-6 text-white/60" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Templates</h3>
              <p className="text-sm text-white/60 mb-4">
                Start from pre-built templates for common use cases
              </p>
              <div className="flex items-center text-white/60 text-sm font-medium group-hover:gap-2 transition-all">
                Browse <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>
        </div>

        <div className="pt-8 border-t border-white/10">
          <h2 className="text-xl font-semibold text-white mb-6" data-testid="text-how-it-works">
            How It Works
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: Upload, title: "Upload", desc: "Add your content - script, PDF, or website" },
              { icon: Wand2, title: "Transform", desc: "AI extracts meaning and structure" },
              { icon: Sparkles, title: "Enhance", desc: "Generate visuals and interactions" },
              { icon: Play, title: "Publish", desc: "Share your interactive experience" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-white/5" data-testid={`step-${i + 1}`}>
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{step.title}</h4>
                  <p className="text-xs text-white/50">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </IceMakerLayout>
  );
}
