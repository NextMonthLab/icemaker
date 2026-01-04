import { ChevronDown, Zap, Library, Plus, ExternalLink } from "lucide-react";
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
    <div className="flex items-center justify-between py-3 md:py-4 px-4 md:px-6 border-b border-white/10" data-testid="launchpad-header">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-1 md:gap-2 text-white hover:bg-white/10 px-2 md:px-3"
              data-testid="dropdown-orbit-selector"
            >
              <span className="text-yellow-400">★</span>
              <span className="font-medium truncate max-w-[120px] md:max-w-none">
                {selectedOrbit?.name || "Select Orbit"}
              </span>
              <ChevronDown className="w-4 h-4 opacity-60 flex-shrink-0" />
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
          className={`hidden sm:flex items-center gap-1.5 ${
            isPowered
              ? "border-blue-500/50 text-blue-400"
              : "border-amber-500/50 text-amber-400"
          }`}
          data-testid="badge-orbit-status"
        >
          {isPowered ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Powered insights {selectedOrbit?.strengthScore ? `(${selectedOrbit.strengthScore}%)` : ''}
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Starter insights (3)
            </>
          )}
        </Badge>

        {!isPowered && (
          <Link href={`/orbit/${selectedOrbit?.slug}/settings`} className="hidden md:block">
            <Button
              variant="outline"
              size="sm"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              data-testid="button-power-up"
            >
              <Zap className="w-4 h-4 mr-1" />
              Add sources
            </Button>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {selectedOrbit && (
          <Link href={`/orbit/${selectedOrbit.slug}`}>
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10"
              data-testid="link-view-public"
            >
              <ExternalLink className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">View public</span>
            </Button>
          </Link>
        )}
        <Link href="/icemaker/projects" className="hidden md:block">
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
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-sm md:text-base px-3 md:px-4"
          data-testid="button-new-ice"
          aria-label="New Ice"
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">New Ice</span>
        </Button>
      </div>
    </div>
  );
}
