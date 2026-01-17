import { useEffect } from "react";
import { useLocation } from "wouter";

// Legacy onboarding page - now redirects directly to launchpad
// The guided experience in the editor replaces this wizard
export default function Onboarding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Skip legacy onboarding, go directly to launchpad
    setLocation("/launchpad");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
