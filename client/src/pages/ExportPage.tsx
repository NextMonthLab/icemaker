import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Copy, Download, ExternalLink, Loader2, QrCode, Share2, Video } from "lucide-react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const universeId = parseInt(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [postingCopy, setPostingCopy] = useState("");

  const { data: universe, isLoading: universeLoading } = useQuery({
    queryKey: ["universe", universeId],
    queryFn: async () => {
      const universes = await api.getUniverses();
      return universes.find(u => u.id === universeId);
    },
    enabled: !!universeId,
  });

  const { data: characters } = useQuery({
    queryKey: ["characters", universeId],
    queryFn: () => api.getCharacters(universeId),
    enabled: !!universeId,
  });

  const canonicalUrl = universe?.slug 
    ? `${window.location.origin}/story/${universe.slug}`
    : "";

  const shortUrl = universe?.slug 
    ? `story.app/${universe.slug.substring(0, 8)}`
    : "";

  const primaryCharacter = characters?.[0];
  const ctaText = primaryCharacter 
    ? `Talk to ${primaryCharacter.name}` 
    : "Step inside the experience";

  useEffect(() => {
    if (canonicalUrl) {
      import('qrcode').then(QRCode => {
        QRCode.toDataURL(canonicalUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        }).then(url => {
          setQrCodeUrl(url);
        });
      });

      const defaultCopy = `A moment from a larger story.

Step inside and explore the full experience.

${canonicalUrl}

${ctaText}. Continue the journey.`;
      setPostingCopy(defaultCopy);
    }
  }, [canonicalUrl, ctaText]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(canonicalUrl);
    toast({
      title: "Link copied",
      description: "Canonical URL copied to clipboard",
    });
  };

  const handleCopyPostingCopy = () => {
    navigator.clipboard.writeText(postingCopy);
    toast({
      title: "Posting copy copied",
      description: "Ready to paste on social platforms",
    });
  };

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `${universe?.slug || 'story'}-qr.png`;
      link.click();
    }
  };

  const getEmbedCode = () => {
    return `<iframe 
  src="${canonicalUrl}?embed=true" 
  width="375" 
  height="667" 
  frameborder="0"
  allow="autoplay; fullscreen"
  title="${universe?.name || 'Story Experience'}"
></iframe>`;
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(getEmbedCode());
    toast({
      title: "Embed code copied",
      description: "Paste this into your website HTML",
    });
  };

  if (!user?.isAdmin) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Admin access required</p>
          <Link href="/login">
            <Button className="mt-4">Login</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (universeLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!universe) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Universe not found</p>
          <Link href="/admin">
            <Button className="mt-4">Back to Admin</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto" data-testid="export-page">
        <div className="flex items-center gap-4">
          <Link href={`/admin/universes/${universeId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Export & Share</h1>
            <p className="text-muted-foreground text-sm">{universe.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-primary" />
              <CardTitle>Canonical Experience URL</CardTitle>
            </div>
            <CardDescription>
              This is the permanent home of your story. All distribution links point here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
                {canonicalUrl}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="button-copy-link">
                <Copy className="w-4 h-4" />
              </Button>
              <Link href={`/story/${universe.slug}`}>
                <Button variant="outline" size="icon" data-testid="button-open-story">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                <CardTitle>QR Code</CardTitle>
              </div>
              <CardDescription>
                Links directly to the canonical experience. Must be included in all video exports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className="w-48 h-48 rounded-lg border border-border"
                    data-testid="img-qr-code"
                  />
                  <Button onClick={handleDownloadQR} className="gap-2" data-testid="button-download-qr">
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                <CardTitle>Standalone Video Export</CardTitle>
              </div>
              <CardDescription>
                Hook mode for social platforms. Creates curiosity, drives viewers back to the full experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <Video className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Video export will include the QR code permanently burned in.
                </p>
                <Button variant="outline" disabled className="gap-2">
                  <Download className="w-4 h-4" />
                  Export Video (Coming Soon)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Videos are deliberately incomplete - they create curiosity but all intelligence lives in the canonical experience.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <CardTitle>Posting Copy</CardTitle>
            </div>
            <CardDescription>
              Auto-generated caption for social platforms. Edit to match your voice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={postingCopy}
              onChange={(e) => setPostingCopy(e.target.value)}
              rows={6}
              className="font-mono text-sm"
              data-testid="textarea-posting-copy"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                CTA: "{ctaText}"
              </p>
              <Button onClick={handleCopyPostingCopy} className="gap-2" data-testid="button-copy-posting">
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-primary" />
              <CardTitle>Embeddable Experience</CardTitle>
            </div>
            <CardDescription>
              Embed the interactive experience on blogs, learning platforms, or partner websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-lg overflow-x-auto">
              <code className="text-xs whitespace-pre">{getEmbedCode()}</code>
            </div>
            <Button onClick={handleCopyEmbed} className="gap-2" data-testid="button-copy-embed">
              <Copy className="w-4 h-4" />
              Copy Embed Code
            </Button>
            <p className="text-xs text-muted-foreground">
              Embeds reference the canonical experience ID. Updates propagate automatically.
            </p>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <h3 className="font-medium text-yellow-600 mb-2">Distribution Guardrails</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>All exports drive users back to the canonical experience</li>
            <li>No export may contain more intelligence than the source</li>
            <li>QR codes cannot be removed from video exports</li>
            <li>The canonical experience is the single source of truth</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
