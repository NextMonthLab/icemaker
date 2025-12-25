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
