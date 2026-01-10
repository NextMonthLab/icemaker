import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Clock, Sparkles, Archive, MessageCircle, X, ExternalLink, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PreviewExperienceOrchestrator } from "@/components/preview/PreviewExperienceOrchestrator";
import { BrandCustomizationScreen, type BrandPreferences } from "@/components/preview/BrandCustomizationScreen";
import { SiteIngestionLoader } from "@/components/preview/SiteIngestionLoader";
import { PreviewShareBar } from "@/components/preview/PreviewShareBar";
import { SpatialSmartSite } from "@/components/spatial";
import { RadarGrid } from "@/components/radar";
import type { SiteKnowledge } from "@/lib/siteKnowledge";

interface ValidatedContent {
  overview: string;
  whatWeDo: string[];
  commonQuestions: { question: string; contextPrompt: string }[];
  brandName: string;
  passed: boolean;
  issues: string[];
}

interface Testimonial {
  quote: string;
  author: string | null;
  role: string | null;
  company: string | null;
  rating: number | null;
  imageUrl: string | null;
}

interface FaqPair {
  question: string;
  answer: string;
}

interface StructuredData {
  organization: {
    name: string | null;
    description: string | null;
    url: string | null;
    logo: string | null;
    sameAs: string[];
  } | null;
  products: Array<{
    name: string;
    description: string | null;
    price: string | null;
    imageUrl: string | null;
  }>;
  faqs: FaqPair[];
  events: Array<{
    name: string;
    description: string | null;
    startDate: string | null;
    location: string | null;
  }>;
  people: Array<{
    name: string;
    jobTitle: string | null;
    description: string | null;
    imageUrl: string | null;
  }>;
}

interface SiteIdentity {
  sourceDomain: string;
  title: string | null;
  heroHeadline: string | null;
  heroDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroImageUrl: string | null;
  primaryColour: string;
  serviceHeadings: string[];
  serviceBullets: string[];
  faqCandidates: string[];
  extractedAt: string;
  imagePool?: string[];
  validatedContent?: ValidatedContent;
  structuredData?: StructuredData | null;
  testimonials?: Testimonial[];
  enhancedFaqs?: FaqPair[];
}

interface PreviewInstance {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'active' | 'archived' | 'claimed';
  siteTitle: string | null;
  siteSummary: string | null;
  keyServices: string[] | null;
  siteIdentity: SiteIdentity | null;
  messageCount: number;
  maxMessages: number;
  expiresAt: string;
  createdAt: string;
  previewAccessToken?: string;
}

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

function BrandHeader({ 
  preview, 
  timeRemaining 
}: { 
  preview: PreviewInstance; 
  timeRemaining: string;
}) {
  const identity = preview.siteIdentity;
  const primaryColour = identity?.primaryColour || '#7c3aed';
  
  const logoSrc = identity?.logoUrl || identity?.faviconUrl;
  const showMonogram = !logoSrc;
  const monogramLetter = (preview.sourceDomain || 'S')[0].toUpperCase();
  
  return (
    <div className="p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {showMonogram ? (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: primaryColour }}
            >
              {monogramLetter}
            </div>
          ) : (
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 shadow-sm"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${primaryColour} 15%, #1a1a1a)`,
                border: `1px solid color-mix(in srgb, ${primaryColour} 30%, transparent)`
              }}
            >
              <img 
                src={logoSrc!} 
                alt={preview.sourceDomain}
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate" data-testid="text-site-title">
              {identity?.heroHeadline || preview.siteTitle || preview.sourceDomain}
            </h1>
            <p className="text-xs text-muted-foreground">{preview.sourceDomain}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Sparkles className="w-3 h-3" />
          <span className="text-xs font-medium" data-testid="text-orbit-preview-label">Orbit Preview</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Expires in {timeRemaining} unless claimed</span>
      </div>
    </div>
  );
}

function MiniSiteScaffold({ 
  preview,
  onAskQuestion 
}: { 
  preview: PreviewInstance;
  onAskQuestion: (question: string) => void;
}) {
  const identity = preview.siteIdentity;
  const primaryColour = identity?.primaryColour || '#7c3aed';
  
  const heroImageUrl = identity?.heroImageUrl;
  const heroHeadline = identity?.heroHeadline || preview.siteTitle;
  const heroDescription = identity?.heroDescription || preview.siteSummary;
  const serviceHeadings = identity?.serviceHeadings || [];
  const serviceBullets = identity?.serviceBullets || preview.keyServices || [];
  const faqCandidates = identity?.faqCandidates || [];
  
  return (
    <div className="flex-1 overflow-y-auto">
      <div 
        className="relative w-full h-48 md:h-64 flex items-end"
        style={{
          background: heroImageUrl 
            ? `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%), url(${heroImageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${primaryColour}40 0%, ${primaryColour}20 50%, transparent 100%)`
        }}
      >
        <div className="p-6 w-full">
          <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg mb-2" data-testid="text-hero-headline">
            {heroHeadline}
          </h2>
          {heroDescription && (
            <p className="text-sm md:text-base text-white/90 drop-shadow max-w-2xl line-clamp-3" data-testid="text-hero-description">
              {heroDescription}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8">
        {(serviceHeadings.length > 0 || serviceBullets.length > 0) && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              What we do
            </h3>
            {serviceHeadings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {serviceHeadings.slice(0, 6).map((heading, i) => (
                  <div 
                    key={i} 
                    className="p-3 rounded-lg bg-secondary/30 border border-border"
                    data-testid={`text-service-heading-${i}`}
                  >
                    <p className="font-medium text-sm">{heading}</p>
                  </div>
                ))}
              </div>
            )}
            {serviceBullets.length > 0 && (
              <ul className="space-y-2">
                {serviceBullets.slice(0, 5).map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span data-testid={`text-service-bullet-${i}`}>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {faqCandidates.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Common questions
            </h3>
            <div className="space-y-2">
              {faqCandidates.slice(0, 5).map((question, i) => (
                <button
                  key={i}
                  onClick={() => onAskQuestion(question)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/10 hover:border-primary/30 transition-all text-sm group flex items-center justify-between"
                  data-testid={`button-faq-${i}`}
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {question}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="text-xs text-muted-foreground/60 pt-4 border-t border-border">
          Content pulled from: {preview.sourceDomain}
        </div>
      </div>
    </div>
  );
}

function ChatOverlay({
  isOpen,
  onClose,
  onToggle,
  messages,
  input,
  setInput,
  onSend,
  isTyping,
  suggestedPrompts,
  capReached,
  onCapClick,
  brandPreferences,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: (message?: string) => void;
  isTyping: boolean;
  suggestedPrompts: string[];
  capReached: boolean;
  onCapClick: () => void;
  brandPreferences?: BrandPreferences | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const theme = brandPreferences?.theme || 'dark';
  const accentColor = brandPreferences?.accentColor || '#ffffff';
  const bgColor = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const textColor = theme === 'dark' ? 'white' : 'black';
  const mutedColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
  const subtleBg = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const userMsgBg = theme === 'dark' ? 'white' : accentColor;
  const userMsgText = theme === 'dark' ? 'black' : (accentColor === '#ffffff' || accentColor === '#f5f5f5' ? 'black' : 'white');

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      setTimeout(() => {
        scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
      }, 50);
    }
  }, [messages, isTyping, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 md:right-6 md:left-auto md:bottom-6 md:w-96"
          >
            <div 
              className="rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[70vh] md:max-h-[600px] overflow-hidden"
              style={{ 
                background: bgColor, 
                border: `1px solid ${borderColor}`,
                boxShadow: `0 0 0 1px ${accentColor}20, 0 25px 50px -12px rgba(0,0,0,0.5)`
              }}
            >
              <div 
                className="flex items-center justify-between p-4 shrink-0"
                style={{ borderBottom: `1px solid ${borderColor}` }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" style={{ color: mutedColor }} />
                  <span className="font-semibold text-sm" style={{ color: textColor }}>Chat</span>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 rounded-full transition-colors"
                  style={{ color: mutedColor }}
                  data-testid="button-close-chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div 
                className="flex-1 min-h-0" 
                ref={scrollRef}
                style={{ height: 'calc(70vh - 130px)', maxHeight: '470px', overflow: 'auto' }}
              >
                  <div className="p-4">
                {messages.length === 0 && suggestedPrompts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs mb-3" style={{ color: mutedColor }}>Try asking:</p>
                    {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => onSend(prompt)}
                        disabled={isTyping || capReached}
                        className="w-full text-left p-2.5 rounded-lg transition-all text-xs disabled:opacity-50"
                        style={{ 
                          border: `1px solid ${borderColor}`,
                          background: subtleBg,
                          color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
                        }}
                        data-testid={`button-suggested-prompt-${i}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className="max-w-[85%] p-3 rounded-xl text-sm leading-relaxed"
                        style={msg.role === 'user' 
                          ? { background: userMsgBg, color: userMsgText, borderRadius: '12px 12px 4px 12px' }
                          : { background: subtleBg, color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)', border: `1px solid ${borderColor}`, borderRadius: '12px 12px 12px 4px' }
                        }
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div 
                        className="p-3 rounded-xl rounded-tl-sm flex gap-1 items-center"
                        style={{ background: subtleBg, border: `1px solid ${borderColor}` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: mutedColor }}></span>
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: mutedColor }}></span>
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: mutedColor }}></span>
                      </div>
                    </motion.div>
                  )}
                </div>
                  </div>
              </div>

              <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${borderColor}` }}>
                {capReached ? (
                  <button
                    onClick={onCapClick}
                    className="w-full p-3 rounded-lg font-medium text-sm"
                    style={{ background: accentColor, color: accentColor === '#ffffff' || accentColor === '#f5f5f5' ? 'black' : 'white' }}
                    data-testid="button-cap-reached-claim"
                  >
                    Continue conversation - Claim this Orbit Preview
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask a question..."
                      className="h-10 rounded-full px-4 text-sm"
                      style={{ 
                        background: subtleBg, 
                        border: `1px solid ${borderColor}`,
                        color: textColor
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && onSend()}
                      disabled={isTyping}
                      data-testid="input-chat-message"
                    />
                    <button
                      onClick={() => onSend()}
                      className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-50"
                      style={{ background: accentColor, color: accentColor === '#ffffff' || accentColor === '#f5f5f5' ? 'black' : 'white' }}
                      disabled={isTyping || !input.trim()}
                      data-testid="button-send-message"
                    >
                      {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function PreviewPage() {
  const [, params] = useRoute("/preview/:id");
  const previewId = params?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [experienceMode, setExperienceMode] = useState<'cinematic' | 'interactive'>('cinematic');
  const [showCustomization, setShowCustomization] = useState(true);
  const [brandPreferences, setBrandPreferences] = useState<BrandPreferences | null>(null);
  const [experienceType, setExperienceType] = useState<'radar' | 'spatial' | 'classic'>('radar');

  const handleCustomizationConfirm = (prefs: BrandPreferences, expType?: 'radar' | 'spatial' | 'classic') => {
    setBrandPreferences(prefs);
    if (expType) setExperienceType(expType);
    setShowCustomization(false);
  };

  const generateSiteKnowledge = (preview: PreviewInstance): SiteKnowledge => {
    const siteIdentity = preview.siteIdentity;
    const validatedContent = siteIdentity?.validatedContent;
    
    // Priority: AI-extracted brand name > last part of title (after | or -) > domain
    const extractBrandFromTitle = (title: string | null | undefined): string | undefined => {
      if (!title) return undefined;
      // Try last part after | or - (usually contains actual brand name)
      const parts = title.split(/\s*[|\-]\s*/);
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        // Only use if it looks like a brand (not too long, not generic)
        if (lastPart.length > 0 && lastPart.length < 40 && !lastPart.toLowerCase().includes('home')) {
          return lastPart;
        }
      }
      // Fall back to first part if last part isn't suitable
      return parts[0]?.trim();
    };
    
    const brandName = validatedContent?.brandName || 
                      extractBrandFromTitle(siteIdentity?.title) || 
                      preview.sourceDomain;
    const imagePool = siteIdentity?.imagePool || [];
    
    const topics = [
      ...(siteIdentity?.serviceBullets || []).slice(0, 12).map((bullet, i) => ({
        id: `t_${i}`,
        label: bullet.length > 40 ? bullet.slice(0, 40) + '...' : bullet,
        keywords: bullet.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'topic' as const,
        summary: bullet,
        imageUrl: imagePool[i % imagePool.length],
      })),
      ...(validatedContent?.whatWeDo || []).slice(0, 10).map((item, i) => ({
        id: `tw_${i}`,
        label: item.length > 40 ? item.slice(0, 40) + '...' : item,
        keywords: item.toLowerCase().split(/\s+/).filter(w => w.length > 3),
        type: 'topic' as const,
        summary: item,
        imageUrl: imagePool[(i + 2) % imagePool.length],
      })),
    ];

    const pages = [
      {
        id: 'p_home',
        title: brandName,
        url: preview.sourceUrl,
        summary: siteIdentity?.heroDescription || preview.siteSummary || `Explore everything about ${brandName}`,
        keywords: ['home', 'main', 'about', ...brandName.toLowerCase().split(/\s+/)],
        type: 'page' as const,
        imageUrl: siteIdentity?.heroImageUrl || imagePool[0],
      },
      ...(siteIdentity?.serviceHeadings || []).slice(0, 10).map((heading, i) => ({
        id: `p_${i + 1}`,
        title: heading,
        url: preview.sourceUrl,
        summary: `Learn more about ${heading}`,
        keywords: heading.toLowerCase().split(/\s+/),
        type: 'page' as const,
        imageUrl: imagePool[(i + 1) % imagePool.length],
      })),
    ];

    const proof: SiteKnowledge['proof'] = [];
    
    // Add testimonials as proof tiles (highest value)
    const testimonials = siteIdentity?.testimonials || [];
    testimonials.slice(0, 8).forEach((testimonial, i) => {
      const label = testimonial.author 
        ? `${testimonial.author}${testimonial.company ? ` - ${testimonial.company}` : ''}`
        : 'Customer Testimonial';
      proof.push({
        id: `pt_${i}`,
        label: label.length > 50 ? label.slice(0, 50) + '...' : label,
        summary: testimonial.quote.length > 200 ? testimonial.quote.slice(0, 200) + '...' : testimonial.quote,
        keywords: ['testimonial', 'review', 'customer', ...(testimonial.author?.toLowerCase().split(/\s+/) || [])],
        type: 'proof' as const,
        imageUrl: testimonial.imageUrl || imagePool[(i + 5) % imagePool.length],
      });
    });
    
    // Add enhanced FAQs as proof tiles
    const enhancedFaqs = siteIdentity?.enhancedFaqs || [];
    enhancedFaqs.slice(0, 8).forEach((faq, i) => {
      proof.push({
        id: `pf_${i}`,
        label: faq.question.length > 50 ? faq.question.slice(0, 50) + '...' : faq.question,
        summary: faq.answer.length > 200 ? faq.answer.slice(0, 200) + '...' : faq.answer,
        keywords: [...faq.question.toLowerCase().split(/\s+/).filter(w => w.length > 3), 'faq', 'question'],
        type: 'proof' as const,
        imageUrl: imagePool[(i + 3) % imagePool.length],
      });
    });
    
    // Fallback to old FAQ candidates if no enhanced data
    if (proof.length === 0) {
      (validatedContent?.commonQuestions || siteIdentity?.faqCandidates || []).slice(0, 8).forEach((faq, i) => {
        const question = typeof faq === 'string' ? faq : faq.question;
        proof.push({
          id: `pr_${i}`,
          label: question.length > 50 ? question.slice(0, 50) + '...' : question,
          summary: question,
          keywords: question.toLowerCase().split(/\s+/).filter(w => w.length > 3),
          type: 'proof' as const,
          imageUrl: imagePool[(i + 3) % imagePool.length],
        });
      });
    }

    // Extract people from structured data
    const people: SiteKnowledge['people'] = [];
    const structuredPeople = siteIdentity?.structuredData?.people || [];
    structuredPeople.slice(0, 10).forEach((person, i) => {
      people.push({
        id: `pe_${i}`,
        name: person.name,
        role: person.jobTitle || 'Team Member',
        email: '',
        phone: null,
        avatar: person.imageUrl || null,
        keywords: [person.name.toLowerCase(), ...(person.jobTitle?.toLowerCase().split(/\s+/) || []), 'team', 'person'],
        type: 'person' as const,
      });
    });

    // Add products as topics if available
    const structuredProducts = siteIdentity?.structuredData?.products || [];
    structuredProducts.slice(0, 10).forEach((product, i) => {
      topics.push({
        id: `tpr_${i}`,
        label: product.name.length > 40 ? product.name.slice(0, 40) + '...' : product.name,
        keywords: [...product.name.toLowerCase().split(/\s+/).filter(w => w.length > 3), 'product'],
        type: 'topic' as const,
        summary: product.description || `${product.name}${product.price ? ` - ${product.price}` : ''}`,
        imageUrl: product.imageUrl || imagePool[(i + 4) % imagePool.length],
      });
    });

    return {
      brand: {
        name: brandName,
        domain: preview.sourceDomain,
        tagline: siteIdentity?.heroHeadline || preview.siteSummary || '',
        primaryColor: brandPreferences?.accentColor || siteIdentity?.primaryColour || '#3b82f6',
      },
      topics,
      pages,
      people,
      proof,
      actions: [
        {
          id: 'a_video',
          label: 'Request Video Reply',
          summary: 'Get a personalised video response from our team',
          keywords: ['video', 'reply', 'personal', 'response'],
          type: 'action' as const,
          actionType: 'video_reply' as const,
        },
        {
          id: 'a_call',
          label: 'Schedule a Call',
          summary: 'Book a consultation call with our experts',
          keywords: ['call', 'phone', 'consultation', 'schedule', 'book'],
          type: 'action' as const,
          actionType: 'call' as const,
        },
        {
          id: 'a_email',
          label: 'Send Enquiry',
          summary: 'Email your questions to our team',
          keywords: ['email', 'enquiry', 'contact', 'message'],
          type: 'action' as const,
          actionType: 'email' as const,
        },
        {
          id: 'a_quote',
          label: 'Get a Quote',
          summary: 'Request pricing information',
          keywords: ['quote', 'price', 'cost', 'pricing'],
          type: 'action' as const,
          actionType: 'quote' as const,
        },
      ],
      blogs: [],
      socials: [],
    };
  };

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["preview", previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${previewId}`);
      if (!response.ok) throw new Error("Preview not found");
      return response.json() as Promise<PreviewInstance>;
    },
    enabled: !!previewId,
    refetchInterval: 30000,
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["preview-messages", previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json() as Promise<ChatMessage[]>;
    },
    enabled: !!previewId && !!preview,
  });

  useEffect(() => {
    if (chatMessages && !hasInitialized) {
      setMessages(chatMessages);
      setHasInitialized(true);
    }
  }, [chatMessages, hasInitialized]);

  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch(`/api/previews/${previewId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          previewAccessToken: preview?.previewAccessToken,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          throw new Error("MESSAGE_CAP_REACHED");
        }
        throw new Error(error.message || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      }]);
    },
    onError: (error: Error) => {
      setIsTyping(false);
      if (error.message === "MESSAGE_CAP_REACHED") {
        setShowPaywall(true);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          content: `Something went wrong. Please try again.`,
          createdAt: new Date().toISOString(),
        }]);
      }
    },
  });

  const handleSend = (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || isTyping) return;

    if (!chatOpen) {
      setChatOpen(true);
    }

    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      content: messageToSend,
      createdAt: new Date().toISOString(),
    }]);
    setInput("");
    setIsTyping(true);

    sendMutation.mutate(messageToSend);
  };

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/claim`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to initiate claim");
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/archive`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to archive");
      return response.json();
    },
    onSuccess: () => {
      setShowPaywall(false);
      window.location.href = "/";
    },
  });

  const getTimeRemaining = () => {
    if (!preview) return "";
    const now = new Date();
    const expires = new Date(preview.expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours <= 0 && diffMins <= 0) return "Expired";
    if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
    return `${diffMins}m`;
  };

  const generateContextualPrompts = () => {
    if (!preview?.siteIdentity) {
      return [
        "What services do you offer?",
        "How do I get started?",
        "What makes you different?",
      ];
    }

    const prompts: string[] = [];
    const identity = preview.siteIdentity;
    
    for (const heading of identity.serviceHeadings.slice(0, 2)) {
      prompts.push(`What does ${heading} include?`);
    }
    
    const siteName = identity.title?.split(' - ')[0] || identity.sourceDomain;
    prompts.push(`How do I get started with ${siteName}?`);
    prompts.push("What's the best next step for someone like me?");
    
    for (const faq of identity.faqCandidates.slice(0, 2)) {
      if (!prompts.includes(faq)) {
        prompts.push(faq);
      }
    }
    
    return prompts.slice(0, 5);
  };

  const capReached = preview ? preview.messageCount >= preview.maxMessages : false;

  if (previewLoading) {
    return <SiteIngestionLoader />;
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Orbit Preview Not Found</h2>
        <p className="text-muted-foreground mb-6">This Orbit Preview may have expired or been archived.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  if (preview.status === 'archived') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <Archive className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-4">Orbit Preview Archived</h2>
        <p className="text-muted-foreground mb-6">This Orbit Preview has been archived and is no longer available.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  if (preview.status === 'claimed') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <Sparkles className="w-16 h-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-4">Orbit Preview Claimed!</h2>
        <p className="text-muted-foreground mb-6">This Orbit Preview has been claimed and is now a full Orbit experience.</p>
        <Button onClick={() => window.location.href = "/"} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {preview.siteIdentity && showCustomization && (
        <BrandCustomizationScreen
          logoUrl={preview.siteIdentity.logoUrl}
          faviconUrl={preview.siteIdentity.faviconUrl}
          brandName={preview.siteIdentity.title?.split(' - ')[0]?.split(' | ')[0] || preview.sourceDomain}
          defaultAccentColor={preview.siteIdentity.primaryColour || '#ffffff'}
          imagePool={preview.siteIdentity.imagePool || []}
          previewId={previewId}
          onConfirm={handleCustomizationConfirm}
        />
      )}

      {!showCustomization && previewId && (
        <PreviewShareBar
          previewId={previewId}
          expiresAt={preview.expiresAt}
          brandName={preview.siteIdentity?.validatedContent?.brandName || preview.siteIdentity?.title?.split(' - ')[0]?.split(' | ')[0] || preview.sourceDomain}
        />
      )}

      {preview.siteIdentity && !showCustomization && experienceType === 'radar' && (
        <RadarGrid
          knowledge={generateSiteKnowledge(preview)}
          accentColor={brandPreferences?.accentColor || preview.siteIdentity.primaryColour || '#3b82f6'}
          onSendMessage={async (message) => {
            const response = await fetch(`/api/previews/${previewId}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message, previewAccessToken: preview.previewAccessToken }),
            });
            if (!response.ok) throw new Error("Failed");
            const data = await response.json();
            return data.reply;
          }}
        />
      )}

      {preview.siteIdentity && !showCustomization && experienceType === 'spatial' && (
        <SpatialSmartSite
          siteIdentity={{
            sourceDomain: preview.siteIdentity.sourceDomain,
            title: preview.siteIdentity.title,
            logoUrl: preview.siteIdentity.logoUrl,
            faviconUrl: preview.siteIdentity.faviconUrl,
            heroDescription: preview.siteIdentity.heroDescription,
            primaryColour: preview.siteIdentity.primaryColour,
            serviceBullets: preview.siteIdentity.serviceBullets,
            faqCandidates: preview.siteIdentity.faqCandidates,
          }}
          validatedContent={preview.siteIdentity.validatedContent ? {
            overview: preview.siteIdentity.validatedContent.overview,
            whatWeDo: preview.siteIdentity.validatedContent.whatWeDo,
            commonQuestions: preview.siteIdentity.validatedContent.commonQuestions,
            brandName: preview.siteIdentity.validatedContent.brandName,
          } : null}
          brandPreferences={brandPreferences}
          onSendMessage={async (message) => {
            const response = await fetch(`/api/previews/${previewId}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message, previewAccessToken: preview.previewAccessToken }),
            });
            if (!response.ok) throw new Error("Failed");
            const data = await response.json();
            return data.reply;
          }}
        />
      )}

      {preview.siteIdentity && !showCustomization && experienceType === 'classic' && (
        <PreviewExperienceOrchestrator
          siteIdentity={preview.siteIdentity}
          siteTitle={preview.siteTitle}
          siteSummary={preview.siteSummary}
          onAskAbout={(prompt) => handleSend(prompt)}
          onClaim={() => claimMutation.mutate()}
          onModeChange={setExperienceMode}
          brandPreferences={brandPreferences}
        />
      )}

      {experienceMode === 'interactive' && !showCustomization && experienceType === 'classic' && (
        <ChatOverlay
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          onToggle={() => setChatOpen(true)}
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isTyping={isTyping}
          suggestedPrompts={generateContextualPrompts()}
          capReached={capReached}
          onCapClick={() => setShowPaywall(true)}
          brandPreferences={brandPreferences}
        />
      )}

      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Your Orbit Preview is ready</DialogTitle>
            <DialogDescription className="text-base pt-2">
              To keep it live and claim the leads it is already uncovering, activate it.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Unlimited conversations with potential customers</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Full site content and intelligent responses</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-white/60"></div>
              <span>Lead capture and conversation history</span>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-claim-activate"
            >
              {claimMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Claim and activate
            </Button>
            <Button
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              variant="ghost"
              className="w-full"
              size="sm"
              data-testid="button-not-now"
            >
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
