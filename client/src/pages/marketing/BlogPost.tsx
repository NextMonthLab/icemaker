import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getBlogPost } from "@/lib/blogData";
import { ArrowLeft, ArrowRight, Calendar, Clock } from "lucide-react";

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const post = getBlogPost(params.slug || "");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MarketingHeader />
        <main className="pt-24 pb-16">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h1 className="text-3xl font-bold mb-4">Post not found</h1>
            <p className="text-white/60 mb-8">The blog post you're looking for doesn't exist.</p>
            <Link href="/blog">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to blog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main className="pt-24 pb-16">
        <article className="max-w-3xl mx-auto px-6">
          {/* Back link */}
          <Link href="/blog">
            <button className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-8 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to blog
            </button>
          </Link>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 mb-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-6 leading-tight" data-testid="text-post-title">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-white/50 mb-6">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(post.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readingTime}
              </span>
            </div>
            <p className="text-lg text-white/70 leading-relaxed">
              {post.heroSummary}
            </p>
          </motion.header>

          {/* Body */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="prose prose-invert prose-lg max-w-none"
          >
            {post.body.split("\n").map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              
              if (trimmed.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-2xl font-bold text-white mt-10 mb-4">
                    {trimmed.replace("## ", "")}
                  </h2>
                );
              }
              
              if (trimmed.startsWith("- **")) {
                const match = trimmed.match(/- \*\*(.+?)\*\* — (.+)/);
                if (match) {
                  return (
                    <div key={i} className="flex items-start gap-3 my-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                      <p className="text-white/70">
                        <strong className="text-white">{match[1]}</strong> — {match[2]}
                      </p>
                    </div>
                  );
                }
              }
              
              if (trimmed.startsWith("- ")) {
                return (
                  <div key={i} className="flex items-start gap-3 my-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2.5 shrink-0" />
                    <p className="text-white/70">{trimmed.replace("- ", "")}</p>
                  </div>
                );
              }
              
              if (trimmed.startsWith("1. ") || trimmed.startsWith("2. ") || trimmed.startsWith("3. ") || trimmed.startsWith("4. ")) {
                const num = trimmed.charAt(0);
                return (
                  <div key={i} className="flex items-start gap-3 my-3">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-sm flex items-center justify-center shrink-0">
                      {num}
                    </span>
                    <p className="text-white/70">{trimmed.substring(3)}</p>
                  </div>
                );
              }
              
              return (
                <p key={i} className="text-white/70 my-4 leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </motion.div>

          {/* CTA Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 p-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center"
          >
            <h3 className="text-xl font-bold mb-4">
              Want to see it on your own material?
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="gap-2 text-base px-8">
                  Book a demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/try">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Start building
                </Button>
              </Link>
            </div>
          </motion.div>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
