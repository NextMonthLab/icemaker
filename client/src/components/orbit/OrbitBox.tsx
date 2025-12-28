import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileText, Briefcase, HelpCircle, MessageSquare, BookOpen, File, Sparkles } from "lucide-react";

interface OrbitBoxProps {
  id: string;
  type: "page" | "service" | "faq" | "testimonial" | "blog" | "document" | "custom";
  title: string;
  summary: string;
  themes: string[];
  isUnclaimed?: boolean;
}

const typeIcons = {
  page: FileText,
  service: Briefcase,
  faq: HelpCircle,
  testimonial: MessageSquare,
  blog: BookOpen,
  document: File,
  custom: Sparkles,
};

const typeLabels = {
  page: "Page",
  service: "Service",
  faq: "FAQ",
  testimonial: "Testimonial",
  blog: "Blog",
  document: "Document",
  custom: "Custom",
};

export function OrbitBox({ id, type, title, summary, themes, isUnclaimed = false }: OrbitBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = typeIcons[type] || FileText;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedSummary = summary.length > 120 ? summary.substring(0, 120) + "..." : summary;

  return (
    <Card 
      className={`group orbit-tile cursor-pointer border-zinc-800 bg-zinc-900/50 ${isUnclaimed ? 'opacity-90' : ''}`}
      onClick={toggleExpand}
      data-testid={`orbit-box-${id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-pink-500/10">
              <Icon className="h-4 w-4 text-pink-400" />
            </div>
            <CardTitle className="text-base font-medium text-zinc-100 line-clamp-2">
              {title}
            </CardTitle>
          </div>
          <button 
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            )}
          </button>
        </div>
        <Badge variant="secondary" className="w-fit text-xs bg-zinc-800 text-zinc-400 mt-1">
          {typeLabels[type]}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-zinc-400 leading-relaxed">
          {isExpanded ? summary : truncatedSummary}
        </p>
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {themes.slice(0, 3).map((theme, index) => (
              <span 
                key={index}
                className="text-xs px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-500"
              >
                {theme}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
