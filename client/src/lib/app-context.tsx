import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "./api";
import type { Universe } from "@shared/schema";

interface AppContextType {
  universe: Universe | null;
  setUniverse: (universe: Universe | null) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [universe, setUniverseState] = useState<Universe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDefaultUniverse();
  }, []);

  const loadDefaultUniverse = async () => {
    try {
      const universes = await api.getUniverses();
      
      // Check for universe query param in URL
      const urlParams = new URLSearchParams(window.location.search);
      const universeParam = urlParams.get("universe");
      
      if (universeParam) {
        // Try to match by ID or slug
        const matchedUniverse = universes.find(
          u => u.id.toString() === universeParam || u.slug === universeParam
        );
        if (matchedUniverse) {
          setUniverseState(matchedUniverse);
          setLoading(false);
          return;
        }
      }
      
      // Only auto-select if there's exactly one universe
      if (universes.length === 1) {
        setUniverseState(universes[0]);
      }
      // If multiple universes, let the Home page show the picker
    } catch (error) {
      console.error("Error loading universe:", error);
    } finally {
      setLoading(false);
    }
  };

  const setUniverse = (newUniverse: Universe | null) => {
    setUniverseState(newUniverse);
    // Update URL when universe changes
    if (newUniverse) {
      const url = new URL(window.location.href);
      url.searchParams.set("universe", newUniverse.slug || newUniverse.id.toString());
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <AppContext.Provider value={{ universe, setUniverse, loading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
