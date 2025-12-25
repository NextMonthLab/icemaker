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
      if (universes.length > 0) {
        setUniverseState(universes[0]);
      }
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
