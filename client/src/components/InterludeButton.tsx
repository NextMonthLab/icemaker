import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface InterludeButtonProps {
  characterName?: string;
  onClick: () => void;
  className?: string;
}

export function InterludeButton({ characterName, onClick, className = '' }: InterludeButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 ${className}`}
      data-testid="button-ask-character"
    >
      <MessageCircle className="w-4 h-4" />
      <span className="text-sm">Ask {characterName || 'Character'}</span>
    </Button>
  );
}
