import { useState, useEffect } from "react";
import { X, Info } from "lucide-react";
import { useLocation } from "wouter";

interface HealthData {
  status: string;
  version: string;
  nodeEnv: string;
  timestamp: string;
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+D or Cmd+Shift+D
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && !health) {
      fetch('/api/health')
        .then(res => res.json())
        .then(setHealth)
        .catch(console.error);
    }
  }, [isOpen, health]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Debug Panel</h2>
            <kbd className="px-2 py-0.5 text-xs bg-muted rounded">Ctrl+Shift+D</kbd>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Build Info */}
          <section>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Build Info</h3>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Git Commit:</span>
                <span className="font-semibold">{import.meta.env.VITE_GIT_COMMIT_HASH || 'unknown'}</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Build Time:</span>
                <span className="font-semibold">{import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown'}</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Mode:</span>
                <span className="font-semibold">{import.meta.env.MODE}</span>
              </div>
            </div>
          </section>

          {/* Server Health */}
          <section>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Server Health</h3>
            {health ? (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold text-green-500">{health.status}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-semibold">{health.version}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Node Env:</span>
                  <span className="font-semibold">{health.nodeEnv}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-muted-foreground">Server Time:</span>
                  <span className="font-semibold">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded text-center text-sm text-muted-foreground">
                Loading server health...
              </div>
            )}
          </section>

          {/* Current Route */}
          <section>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Current Route</h3>
            <div className="p-3 bg-muted/50 rounded font-mono text-sm">
              <span className="text-primary">{location}</span>
            </div>
          </section>

          {/* Environment Variables (safe ones) */}
          <section>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Client Environment</h3>
            <div className="space-y-1 font-mono text-xs max-h-48 overflow-auto">
              {Object.entries(import.meta.env)
                .filter(([key]) => key.startsWith('VITE_'))
                .map(([key, value]) => (
                  <div key={key} className="flex gap-2 p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="break-all">{String(value)}</span>
                  </div>
                ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Quick Actions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Hard Reload
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                Clear Cache & Reload
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
