import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function PreviewRedirect() {
  const [, params] = useRoute("/preview/:id");
  const [, setLocation] = useLocation();
  const previewId = params?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["preview-to-orbit", previewId],
    queryFn: async () => {
      const response = await fetch(`/api/previews/${previewId}/orbit-slug`);
      if (!response.ok) {
        throw new Error("Could not find orbit for this preview");
      }
      return response.json();
    },
    enabled: !!previewId,
    retry: false,
  });

  useEffect(() => {
    if (data?.businessSlug) {
      setLocation(`/orbit/${data.businessSlug}`, { replace: true });
    }
  }, [data, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
      </div>
    );
  }

  if (error || !data?.businessSlug) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">This preview link is no longer available.</p>
          <a href="/" className="text-pink-400 hover:underline">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
    </div>
  );
}
