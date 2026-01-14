import { useEffect } from "react";

declare global {
  interface Window {
    Tally?: {
      loadEmbeds: () => void;
    };
  }
}

interface TallyContactFormProps {
  className?: string;
}

export function TallyContactForm({ className = "" }: TallyContactFormProps) {
  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://tally.so/widgets/embed.js"]');
    
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://tally.so/widgets/embed.js";
      script.async = true;
      script.onload = () => {
        window.Tally?.loadEmbeds();
      };
      document.head.appendChild(script);
    } else {
      window.Tally?.loadEmbeds();
    }
  }, []);

  return (
    <div className={className} data-testid="tally-contact-form">
      <iframe
        data-tally-src="https://tally.so/embed/XxoM9Y?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
        loading="lazy"
        width="100%"
        height="446"
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        title="Contact Form"
        className="rounded-lg"
      />
    </div>
  );
}
