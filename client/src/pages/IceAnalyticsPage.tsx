import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  BarChart3, Eye, Users, Share2, ArrowLeft, Loader2, 
  TrendingUp, Calendar, ExternalLink 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlobalNav from "@/components/GlobalNav";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalyticsSummary {
  totalViews: number;
  totalLeads: number;
  totalShares: number;
  viewsByDay: Array<{ date: string; views: number; leads: number }>;
}

interface IceAnalytics {
  iceId: string;
  title: string;
  views: number;
  leads: number;
  shares: number;
  publishedAt: string | null;
}

export default function IceAnalyticsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("30");

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/ice/analytics/summary", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/ice/analytics/summary?days=${timeRange}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: iceList, isLoading: iceListLoading } = useQuery<IceAnalytics[]>({
    queryKey: ["/api/ice/analytics/by-ice"],
    enabled: !!user,
  });

  const isLoading = summaryLoading || iceListLoading;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <GlobalNav />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to view analytics</h1>
          <Link href="/login">
            <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-login">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const maxViews = Math.max(...(summary?.viewsByDay?.map(d => d.views) || [1]), 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <GlobalNav />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/library">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white gap-1" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
                ICE Analytics
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Track views, leads, and engagement across your published ICEs
              </p>
            </div>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <CardTitle className="text-sm text-white/60 font-normal">Total Views</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white" data-testid="text-total-views">
                    {summary?.totalViews ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  <CardTitle className="text-sm text-white/60 font-normal">Leads Captured</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-400" data-testid="text-total-leads">
                    {summary?.totalLeads ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <CardTitle className="text-sm text-white/60 font-normal">Shares</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-400" data-testid="text-total-shares">
                    {summary?.totalShares ?? 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10 mb-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Views Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.viewsByDay && summary.viewsByDay.length > 0 ? (
                  <div className="h-48 flex items-end gap-1">
                    {summary.viewsByDay.map((day, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-cyan-500/80 rounded-t transition-all hover:bg-cyan-400"
                          style={{ height: `${(day.views / maxViews) * 100}%`, minHeight: day.views > 0 ? '4px' : '0' }}
                          title={`${day.date}: ${day.views} views, ${day.leads} leads`}
                          data-testid={`bar-day-${i}`}
                        />
                        {i % Math.ceil(summary.viewsByDay.length / 7) === 0 && (
                          <span className="text-[10px] text-white/40 truncate w-full text-center">
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-white/40">
                    <p>No data for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Performance by ICE
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!iceList || iceList.length === 0 ? (
                  <div className="py-12 text-center text-white/40">
                    <p>No published ICEs yet</p>
                    <Link href="/try">
                      <Button variant="outline" className="mt-4 border-cyan-500/30 text-cyan-400" data-testid="button-create-ice">
                        Create Your First ICE
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-sm font-medium text-white/60">ICE</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-white/60">Views</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-white/60">Leads</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-white/60">Shares</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-white/60">Published</th>
                        </tr>
                      </thead>
                      <tbody>
                        {iceList.map((ice) => (
                          <tr 
                            key={ice.iceId} 
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            data-testid={`row-ice-${ice.iceId}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium truncate max-w-[200px]">
                                  {ice.title}
                                </span>
                                <Link href={`/ice/preview/${ice.iceId}`}>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 hover:text-cyan-300" />
                                </Link>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-white">{ice.views}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-green-400">{ice.leads}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-blue-400">{ice.shares}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="text-white/50 text-sm">
                                {ice.publishedAt 
                                  ? new Date(ice.publishedAt).toLocaleDateString()
                                  : "Draft"
                                }
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
