import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Download, Mail, Calendar, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlobalNav from "@/components/GlobalNav";
import { useAuth } from "@/lib/auth";

interface Lead {
  id: number;
  iceId: string;
  email: string;
  name: string | null;
  iceTitle: string;
  createdAt: string;
}

interface LeadsResponse {
  leads: Lead[];
  totalCount: number;
}

export default function LeadsPage() {
  const { user } = useAuth();
  
  const { data, isLoading, error } = useQuery<LeadsResponse>({
    queryKey: ["/api/ice/my-leads"],
    enabled: !!user,
  });

  const exportToCsv = () => {
    if (!data?.leads?.length) return;
    
    const headers = ["Email", "Name", "ICE Title", "Captured At"];
    const rows = data.leads.map(lead => [
      lead.email,
      lead.name || "",
      lead.iceTitle,
      new Date(lead.createdAt).toLocaleString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ice-leads-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <GlobalNav />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to view leads</h1>
          <Link href="/login">
            <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-login">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
                <Users className="w-6 h-6 text-cyan-400" />
                Lead Capture
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Emails captured from your published ICEs with lead gate enabled
              </p>
            </div>
          </div>
          
          {data?.leads && data.leads.length > 0 && (
            <Button 
              onClick={exportToCsv}
              variant="outline"
              className="gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="py-8 text-center">
              <p className="text-red-400">Failed to load leads. Please try again.</p>
            </CardContent>
          </Card>
        ) : !data?.leads?.length ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">No leads yet</h2>
              <p className="text-white/60 max-w-md mx-auto mb-6">
                Enable lead capture on your published ICEs to start collecting emails from viewers.
              </p>
              <Link href="/library">
                <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-go-to-library">
                  Go to Library
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/60 font-normal">Total Leads</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">{data.totalCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/60 font-normal">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-cyan-400">
                    {data.leads.filter(l => {
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return new Date(l.createdAt) > weekAgo;
                    }).length}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/60 font-normal">Unique ICEs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">
                    {new Set(data.leads.map(l => l.iceId)).size}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-cyan-400" />
                  Recent Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">ICE</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.map((lead) => (
                        <tr 
                          key={lead.id} 
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          data-testid={`row-lead-${lead.id}`}
                        >
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{lead.email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white/70">{lead.name || "—"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-cyan-400 text-sm">{lead.iceTitle}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white/50 text-sm flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
