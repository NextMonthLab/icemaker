import { Eye, MessageCircle, Film, UserPlus } from "lucide-react";

interface SignalTilesProps {
  visits: number;
  conversations: number;
  iceViews: number;
  leads: number;
}

export function SignalTiles({
  visits,
  conversations,
  iceViews,
  leads,
}: SignalTilesProps) {
  const tiles = [
    {
      label: "Visits",
      value: visits,
      icon: Eye,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Conversations",
      value: conversations,
      icon: MessageCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Ice views",
      value: iceViews,
      icon: Film,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Leads",
      value: leads,
      icon: UserPlus,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="signal-tiles">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="bg-muted/50 border border-border rounded-lg p-3 md:p-4 transition-colors hover:border-border/80"
          data-testid={`tile-${tile.label.toLowerCase().replace(" ", "-")}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-xs md:text-sm">{tile.label}</span>
            <div className={`${tile.bgColor} p-1 md:p-1.5 rounded`}>
              <tile.icon className={`w-3 h-3 md:w-4 md:h-4 ${tile.color}`} />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-foreground">{tile.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
