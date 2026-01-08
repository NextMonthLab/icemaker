import { useState } from "react";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function PartnersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    product: "",
    website: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/smartglasses/partner-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setIsSubmitted(true);
    } catch {
      toast({
        title: "Submission failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = form.name && form.company && form.product && form.website && form.email;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Thanks for your interest</h1>
          <p className="text-zinc-400 mb-8">
            We will be in touch within 2 working days to discuss your product placement.
          </p>
          <Button onClick={() => setLocation("/smartglasses")} variant="outline" className="border-zinc-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Smart Glasses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-4 py-16">
        <Button
          variant="ghost"
          onClick={() => setLocation("/smartglasses")}
          className="mb-8 text-zinc-400"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Smart Glasses
        </Button>

        <h1 className="text-3xl font-bold mb-2">Advertise on Smart Glasses</h1>
        <p className="text-zinc-400 mb-8">
          Interested in featuring your smart glasses product? Fill out the form below and we will be in touch.
        </p>

        <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">What you get</h2>
          <ul className="space-y-3 text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="text-amber-400">•</span>
              Display placement in the Sponsored Products section
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">•</span>
              Clear "Sponsored" labelling (transparency builds trust)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">•</span>
              No influence on editorial content or audit results
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400">•</span>
              Reach engaged shoppers actively researching smart glasses
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-zinc-300">Your name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              data-testid="input-partner-name"
            />
          </div>

          <div>
            <Label htmlFor="company" className="text-zinc-300">Company *</Label>
            <Input
              id="company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              required
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              data-testid="input-partner-company"
            />
          </div>

          <div>
            <Label htmlFor="product" className="text-zinc-300">Product name *</Label>
            <Input
              id="product"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              required
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              data-testid="input-partner-product"
            />
          </div>

          <div>
            <Label htmlFor="website" className="text-zinc-300">Website URL *</Label>
            <Input
              id="website"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              required
              placeholder="https://"
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              data-testid="input-partner-website"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-zinc-300">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              data-testid="input-partner-email"
            />
          </div>

          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-700 mt-6"
            data-testid="button-submit-inquiry"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit inquiry
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
