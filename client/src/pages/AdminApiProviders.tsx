import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle, XCircle, AlertTriangle, RefreshCw, Key, DollarSign, Zap } from "lucide-react";
import GlobalNav from "@/components/GlobalNav";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

interface ApiProviderStatus {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  dashboardUrl: string;
  docsUrl: string;
  category: 'ai' | 'media' | 'payment' | 'email' | 'storage';
  usageInfo?: {
    credits?: number;
    limit?: number;
    plan?: string;
    costPerUnit?: string;
  };
  lastChecked?: string;
  error?: string;
}

interface ApiProvidersResponse {
  providers: ApiProviderStatus[];
  checkedAt: string;
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  ai: { label: 'AI', color: 'bg-purple-500/10 text-purple-500' },
  media: { label: 'Media', color: 'bg-blue-500/10 text-blue-500' },
  payment: { label: 'Payment', color: 'bg-green-500/10 text-green-500' },
  email: { label: 'Email', color: 'bg-orange-500/10 text-orange-500' },
  storage: { label: 'Storage', color: 'bg-cyan-500/10 text-cyan-500' },
};

function ProviderCard({ provider }: { provider: ApiProviderStatus }) {
  const category = categoryLabels[provider.category] || { label: 'Other', color: 'bg-gray-500/10 text-gray-500' };
  
  return (
    <Card className="bg-card border-border" data-testid={`card-provider-${provider.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <Badge variant="outline" className={category.color}>
                {category.label}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-sm">
              {provider.description}
            </CardDescription>
          </div>
          <div className="shrink-0">
            {provider.configured ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <XCircle className="w-3 h-3 mr-1" />
                Not Set
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider.usageInfo && (
          <div className="p-3 rounded-md bg-muted/50 space-y-2">
            {provider.usageInfo.plan && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{provider.usageInfo.plan}</span>
              </div>
            )}
            {provider.usageInfo.credits !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium">
                  {provider.usageInfo.credits.toLocaleString()}
                  {provider.usageInfo.limit && ` / ${provider.usageInfo.limit.toLocaleString()}`}
                </span>
              </div>
            )}
            {provider.usageInfo.costPerUnit && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium">{provider.usageInfo.costPerUnit}</span>
              </div>
            )}
          </div>
        )}
        
        {provider.error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{provider.error}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid={`button-dashboard-${provider.id}`}
          >
            <a href={provider.dashboardUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Dashboard
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            data-testid={`button-docs-${provider.id}`}
          >
            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
              Docs
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminApiProviders() {
  const { user } = useAuth();
  
  const { data, isLoading, refetch, isFetching } = useQuery<ApiProvidersResponse>({
    queryKey: ['/api/admin/api-providers'],
    enabled: user?.isAdmin === true,
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalNav />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You need admin access to view this page.</p>
          <Button asChild className="mt-4">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Key className="w-6 h-6 text-cyan-500" />
              API Providers
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and monitor external API integrations
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data?.checkedAt && (
              <span className="text-xs text-muted-foreground">
                Last checked: {new Date(data.checkedAt).toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-providers"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                AI & Generation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.providers
                  .filter(p => p.category === 'ai')
                  .map(provider => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                Media & Assets
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.providers
                  .filter(p => p.category === 'media')
                  .map(provider => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Payments & Email
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.providers
                  .filter(p => p.category === 'payment' || p.category === 'email')
                  .map(provider => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
