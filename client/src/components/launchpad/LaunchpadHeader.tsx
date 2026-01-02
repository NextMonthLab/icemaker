import { ChevronDown, Zap, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export interface OrbitSummary {
  id: string;
  slug: string;
  name: string;
  status: "basic" | "powered";
  strengthScore?: number;
}

interface LaunchpadHeaderProps {
  orbits: OrbitSummary[];
  selectedOrbit: OrbitSummary | null;
  onOrbitSelect: (orbit: OrbitSummary) => void;
  onCreateIce: () => void;
}

export function LaunchpadHeader({
  orbits,
  selectedOrbit,
  onOrbitSelect,
  onCreateIce,
}: LaunchpadHeaderProps) {
  const isPowered = selectedOrbit?.status === "powered";

  return (
    <div className="flex items-center justify-between py-4 px-6 border-b border-white/10">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-white hover:bg-white/10"
              data-testid="dropdown-orbit-selector"
            >
              <span className="text-yellow-400">★</span>
              <span className="font-medium">
                {selectedOrbit?.name || "Select Orbit"}
              </span>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-slate-900 border-white/10"
          >
            {orbits.map((orbit) => (
              <DropdownMenuItem
                key={orbit.slug}
                onClick={() => onOrbitSelect(orbit)}
                className="text-white hover:bg-white/10 cursor-pointer"
                data-testid={`orbit-option-${orbit.slug}`}
              >
                <span className="text-yellow-400 mr-2">★</span>
                {orbit.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Badge
          variant="outline"
          className={`${
            isPowered
              ? "border-green-500/50 text-green-400"
              : "border-amber-500/50 text-amber-400"
          }`}
          data-testid="badge-orbit-status"
        >
          {isPowered ? "Powered up" : "Basic scan"}
        </Badge>

        {!isPowered && (
          <Link href={`/orbit/${selectedOrbit?.slug}/settings`}>
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
              data-testid="button-power-up"
            >
              <Zap className="w-4 h-4 mr-1" />
              Power up Orbit
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/icemaker/projects">
          <Button
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
            data-testid="link-library"
          >
            <Library className="w-4 h-4 mr-2" />
            Library
          </Button>
        </Link>
        <Button
          onClick={onCreateIce}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          data-testid="button-create-ice"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Ice
        </Button>
      </div>
    </div>
  );
}
