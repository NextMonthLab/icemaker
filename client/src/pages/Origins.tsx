import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/MarketingFooter";
import icemakerLogo from "@assets/icemaker-logo.png";

export default function Origins() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" data-testid="link-home">
            <div className="h-14 overflow-hidden flex items-center cursor-pointer">
              <img 
                src={icemakerLogo} 
                alt="IceMaker" 
                className="h-[150px] w-auto object-contain"
                style={{ marginTop: '-45px', marginBottom: '-45px' }}
              />
            </div>
          </Link>
          <Link href="/" className="text-white/60 hover:text-white transition-colors flex items-center gap-2" data-testid="link-back">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="pt-24 pb-16">
        <article className="max-w-2xl mx-auto px-6">
          <header className="mb-12">
            <h1 className="text-4xl font-light tracking-tight mb-3" data-testid="text-page-title">
              Origins
            </h1>
            <p className="text-white/50 text-lg" data-testid="text-page-subtitle">
              Why IceMaker exists
            </p>
          </header>

          <section className="mb-12" data-testid="section-story">
            <div className="prose prose-invert prose-lg max-w-none">
              <p className="text-white/80 leading-relaxed mb-6">
                Stories have always been how we make sense of the world. They shape how we learn, 
                how we connect, and how ideas travel between people. But somewhere along the way, 
                storytelling became separated from the tools we use to share it.
              </p>
              <p className="text-white/80 leading-relaxed mb-6">
                IceMaker was built to bring them back together. It sits at the intersection of 
                narrative craft, visual experience, and conversational interaction—not as a 
                novelty, but as a response to how people actually engage with content today.
              </p>
              <p className="text-white/80 leading-relaxed">
                Interactive cinematic experiences aren't about adding technology for its own sake. 
                They're about creating space for audiences to participate, to think, and to carry 
                something meaningful away. That's the kind of experience worth building.
              </p>
            </div>
          </section>

          <section className="mb-12" data-testid="section-founder">
            <h2 className="text-xl font-medium mb-4 text-white/90">
              About the Founder
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-white/70 leading-relaxed mb-6">
                IceMaker comes from a background that spans filmmaking, product development, and 
                building systems that work at scale. It's the natural result of years spent 
                thinking about how stories are told and how technology can serve that purpose 
                without getting in the way.
              </p>
              <p className="text-white/70 leading-relaxed">
                The goal has always been the same: make it easier for people with something 
                meaningful to say to say it in a way that lands.
              </p>
            </div>
          </section>

          <section className="pt-8 border-t border-white/10" data-testid="section-closing">
            <p className="text-white/40 text-sm italic">
              IceMaker is being built deliberately, with a focus on quality and long-term value. 
              Strategic conversations are welcome when the timing is right.
            </p>
          </section>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
