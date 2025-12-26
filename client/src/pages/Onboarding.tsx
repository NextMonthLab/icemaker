import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: onboardingProfile, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/me/onboarding", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch onboarding");
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (onboardingProfile?.onboardingCompleted) {
      setLocation("/");
    }
  }, [onboardingProfile, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <OnboardingWizard 
      onComplete={() => {
        setLocation("/");
      }} 
    />
  );
}
