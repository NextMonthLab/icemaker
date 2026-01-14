import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import MarketingHeader from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { blogPosts, categories, getBlogPostsByCategory } from "@/lib/blogData";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const filteredPosts = getBlogPostsByCategory(activeCategory);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketingHeader />

      <main className="pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-blog-title">
              Blog
            </h1>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Practical guides for turning static content into interactive experiences.
            </p>
          </motion.div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  activeCategory === category
                    ? "bg-cyan-500 text-white"
                    : "bg-neutral-900 text-white/60 hover:text-white hover:bg-neutral-800"
                )}
                data-testid={`filter-${category.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <article className="group h-full p-6 rounded-lg bg-neutral-900/50 border border-white/5 hover:border-cyan-500/30 transition-colors cursor-pointer hover-lift">
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300">
                      {post.category}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-3 group-hover:text-cyan-300 transition-colors" data-testid={`post-title-${post.slug}`}>
                    {post.title}
                  </h2>
                  <p className="text-white/50 text-sm mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readingTime}
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-white/50">No posts in this category yet.</p>
            </div>
          )}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
