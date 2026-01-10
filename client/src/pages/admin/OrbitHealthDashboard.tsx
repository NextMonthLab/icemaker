import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  RefreshCw,
  Download,
  Search,
  Shield,
  Activity,
  Layers
} from "lucide-react";

interface CheckResult {
  itemId: string;
  status: 'pass' | 'fail' | 'warn' | 'pending';
  message: string;
  evidence?: Record<string, any>;
  checkedAt: string;
}

interface HealthReport {
  orbitSlug: string;
  contractVersion: string;
  generatedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    pending: number;
  };
  results: CheckResult[];
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface ContractItem {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidenceType: string;
  evidenceKey: string;
  endpoint: string | null;
  component: string | null;
}

interface Contract {
  version: string;
  items: ContractItem[];
  categories: Record<string, string>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };
  
  return (
    <Badge className={colors[severity] || colors.low} data-testid={`badge-severity-${severity}`}>
      {severity}
    </Badge>
  );
}

function OverallStatusBanner({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: React.ReactNode; text: string }> = {
    healthy: {
      bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
      icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
      text: 'All systems operational',
    },
    degraded: {
      bg: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
      icon: <AlertTriangle className="h-8 w-8 text-amber-500" />,
      text: 'Some issues detected',
    },
    unhealthy: {
      bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
      icon: <XCircle className="h-8 w-8 text-red-500" />,
      text: 'Critical issues require attention',
    },
  };
  
  const { bg, icon, text } = config[status] || config.degraded;
  
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${bg}`} data-testid="banner-overall-status">
      {icon}
      <div>
        <h3 className="font-semibold capitalize">{status}</h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export default function OrbitHealthDashboard() {
  const [searchSlug, setSearchSlug] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | undefined>();
  
  const { data: report, isLoading, refetch } = useQuery<HealthReport>({
    queryKey: ['/api/admin/orbits/health', activeSlug],
    queryFn: async () => {
      const url = activeSlug 
        ? `/api/admin/orbits/health/${activeSlug}`
        : '/api/admin/orbits/health';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch health report');
      return res.json();
    },
  });
  
  const { data: contract } = useQuery<Contract>({
    queryKey: ['/api/admin/orbits/health/contract'],
  });
  
  const handleSearch = () => {
    setActiveSlug(searchSlug.trim() || undefined);
  };
  
  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit-health-${report.orbitSlug}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const getContractItem = (itemId: string): ContractItem | undefined => {
    return contract?.items.find(i => i.id === itemId);
  };
  
  const groupedResults = report?.results.reduce((acc, result) => {
    const item = getContractItem(result.itemId);
    const category = item?.category || 'unknown';
    if (!acc[category]) acc[category] = [];
    acc[category].push({ result, item });
    return acc;
  }, {} as Record<string, { result: CheckResult; item?: ContractItem }[]>) || {};

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-orbit-health">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Orbit Health Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Contract version {contract?.version || '...'} • {report?.results.length || 0} checks
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExport}
            disabled={!report}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter orbit slug to check specific orbit..."
            value={searchSlug}
            onChange={(e) => setSearchSlug(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
            data-testid="input-orbit-slug"
          />
        </div>
        <Button onClick={handleSearch} data-testid="button-search">
          Check Orbit
        </Button>
        {activeSlug && (
          <Button 
            variant="ghost" 
            onClick={() => { setActiveSlug(undefined); setSearchSlug(''); }}
            data-testid="button-clear-filter"
          >
            Clear
          </Button>
        )}
      </div>
      
      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OverallStatusBanner status={report.overallStatus} />
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Pass Rate</span>
                    <span className="font-medium">
                      {Math.round((report.summary.passed / report.summary.total) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(report.summary.passed / report.summary.total) * 100} 
                    className="h-2"
                  />
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="p-2 rounded bg-green-50 dark:bg-green-950">
                      <div className="font-bold text-green-600" data-testid="stat-passed">{report.summary.passed}</div>
                      <div className="text-xs text-muted-foreground">Passed</div>
                    </div>
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950">
                      <div className="font-bold text-red-600" data-testid="stat-failed">{report.summary.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-950">
                      <div className="font-bold text-amber-600" data-testid="stat-warnings">{report.summary.warnings}</div>
                      <div className="text-xs text-muted-foreground">Warnings</div>
                    </div>
                    <div className="p-2 rounded bg-gray-50 dark:bg-gray-900">
                      <div className="font-bold text-gray-600" data-testid="stat-pending">{report.summary.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                All ({report.results.length})
              </TabsTrigger>
              <TabsTrigger value="issues" data-testid="tab-issues">
                Issues ({report.summary.failed + report.summary.warnings})
              </TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories">
                By Category
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    All Contract Checks
                  </CardTitle>
                  <CardDescription>
                    Complete list of all {report.results.length} contract items
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {report.results.map((result) => {
                        const item = getContractItem(result.itemId);
                        return (
                          <div 
                            key={result.itemId}
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            data-testid={`check-item-${result.itemId}`}
                          >
                            <StatusIcon status={result.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{item?.title || result.itemId}</span>
                                {item && <SeverityBadge severity={item.severity} />}
                                <Badge variant="outline" className="text-xs">
                                  {item?.category || 'unknown'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {result.message}
                              </p>
                              {result.evidence && (
                                <details className="mt-2">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                    View evidence
                                  </summary>
                                  <pre className="text-xs mt-1 p-2 rounded bg-muted overflow-auto">
                                    {JSON.stringify(result.evidence, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="issues">
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    Issues Requiring Attention
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {report.results
                        .filter(r => r.status === 'fail' || r.status === 'warn')
                        .map((result) => {
                          const item = getContractItem(result.itemId);
                          return (
                            <div 
                              key={result.itemId}
                              className="flex items-start gap-3 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50"
                              data-testid={`issue-item-${result.itemId}`}
                            >
                              <StatusIcon status={result.status} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{item?.title || result.itemId}</span>
                                  {item && <SeverityBadge severity={item.severity} />}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {result.message}
                                </p>
                                {item?.description && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    Expected: {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {report.summary.failed + report.summary.warnings === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                          <p>No issues detected</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="categories">
              <div className="grid gap-4">
                {Object.entries(groupedResults).map(([category, items]) => (
                  <Card key={category}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-lg capitalize">
                        {contract?.categories[category] || category.replace(/_/g, ' ')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {items.map(({ result, item }) => (
                          <div 
                            key={result.itemId}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <StatusIcon status={result.status} />
                            <span className="flex-1">{item?.title || result.itemId}</span>
                            {item && <SeverityBadge severity={item.severity} />}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
      
      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Running contract checks...</p>
        </div>
      )}
    </div>
  );
}
