import { TallyContactForm } from "@/components/TallyContactForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  HelpCircle, 
  MessageSquare, 
  FileText, 
  CreditCard, 
  Video, 
  Image, 
  ArrowLeft,
  BookOpen,
  Sparkles
} from "lucide-react";

export default function Support() {
  const faqs = [
    {
      icon: Sparkles,
      question: "How do I create my first ICE?",
      answer: "Click 'Create' from the homepage, upload your content (document, script, or brief), and our AI will generate an interactive experience for you."
    },
    {
      icon: Image,
      question: "How do I generate images for my cards?",
      answer: "Open your ICE in the editor, select a card, and click the 'Generate Image' button. You can customise the visual prompt before generating."
    },
    {
      icon: Video,
      question: "Can I add videos to my ICE?",
      answer: "Yes! Video generation is available on Creator and Business plans. Select a card and click 'Generate Video' to create a short cinematic clip."
    },
    {
      icon: CreditCard,
      question: "How does billing work?",
      answer: "We offer monthly subscriptions with different feature tiers. You can upgrade, downgrade, or cancel anytime from your profile settings."
    },
    {
      icon: FileText,
      question: "What file formats can I upload?",
      answer: "We support PDF, TXT, DOCX, and Markdown files. For best results with Producer Briefs, use Markdown with our structured format."
    },
    {
      icon: MessageSquare,
      question: "How do AI characters work?",
      answer: "AI characters are interactive assistants that appear between cards. They can answer questions about your content within defined guardrails."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">Help & Support</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get help with IceMaker. Browse common questions or send us a message.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-faq-${index}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <faq.icon className="w-5 h-5 text-primary" />
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Contact Us
          </h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-6">
                Can't find what you're looking for? Send us a message and we'll get back to you as soon as possible.
              </p>
              <TallyContactForm />
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            You can also check our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>, and{" "}
            <Link href="/security" className="text-primary hover:underline">Security</Link> pages.
          </p>
        </div>
      </div>
    </div>
  );
}
