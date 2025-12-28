import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, MessageSquare, TrendingUp, Lightbulb, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationPreferences {
  id: number;
  userId: number;
  emailEnabled: boolean;
  emailCadence: 'instant' | 'daily_digest' | 'weekly_digest';
  leadAlertsEnabled: boolean;
  conversationAlertsEnabled: boolean;
  intelligenceAlertsEnabled: boolean;
  iceAlertsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface HubNotificationsPanelProps {
  tier: string;
}

export function HubNotificationsPanel({ tier }: HubNotificationsPanelProps) {
  const queryClient = useQueryClient();
  const isInsight = tier === 'insight' || tier === 'intelligence';
  const isIntelligence = tier === 'intelligence';

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
    },
  });

  const updatePref = (key: keyof NotificationPreferences, value: boolean | string) => {
    updatePrefsMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how and when you receive updates about your Orbit activity
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Receive activity summaries in your inbox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-enabled">Enable email notifications</Label>
              <p className="text-xs text-muted-foreground">
                Receive updates about your Orbit via email
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={prefs?.emailEnabled ?? true}
              onCheckedChange={(checked) => updatePref("emailEnabled", checked)}
              disabled={!isInsight}
              data-testid="switch-email-enabled"
            />
          </div>

          {prefs?.emailEnabled && (
            <div className="flex items-center justify-between">
              <Label htmlFor="email-cadence">Email frequency</Label>
              <Select
                value={prefs?.emailCadence ?? "daily_digest"}
                onValueChange={(value) => updatePref("emailCadence", value)}
                disabled={!isInsight}
              >
                <SelectTrigger className="w-40" data-testid="select-email-cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="daily_digest">Daily digest</SelectItem>
                  <SelectItem value="weekly_digest">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Alert Types
          </CardTitle>
          <CardDescription>
            Choose which events trigger notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <Label htmlFor="lead-alerts">New leads</Label>
                <p className="text-xs text-muted-foreground">
                  When someone submits their contact info
                </p>
              </div>
            </div>
            <Switch
              id="lead-alerts"
              checked={prefs?.leadAlertsEnabled ?? true}
              onCheckedChange={(checked) => updatePref("leadAlertsEnabled", checked)}
              disabled={!isInsight}
              data-testid="switch-lead-alerts"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <Label htmlFor="conversation-alerts">Conversation spikes</Label>
                <p className="text-xs text-muted-foreground">
                  When daily conversations exceed 2x average
                </p>
              </div>
            </div>
            <Switch
              id="conversation-alerts"
              checked={prefs?.conversationAlertsEnabled ?? false}
              onCheckedChange={(checked) => updatePref("conversationAlertsEnabled", checked)}
              disabled={!isInsight}
              data-testid="switch-conversation-alerts"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <Label htmlFor="intelligence-alerts">Pattern intelligence</Label>
                <p className="text-xs text-muted-foreground">
                  Theme shifts and friction points detected
                </p>
              </div>
            </div>
            <Switch
              id="intelligence-alerts"
              checked={prefs?.intelligenceAlertsEnabled ?? false}
              onCheckedChange={(checked) => updatePref("intelligenceAlertsEnabled", checked)}
              disabled={!isIntelligence}
              data-testid="switch-intelligence-alerts"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <Label htmlFor="ice-alerts">ICE performance</Label>
                <p className="text-xs text-muted-foreground">
                  Top performing experiences each week
                </p>
              </div>
            </div>
            <Switch
              id="ice-alerts"
              checked={prefs?.iceAlertsEnabled ?? false}
              onCheckedChange={(checked) => updatePref("iceAlertsEnabled", checked)}
              disabled={!isIntelligence}
              data-testid="switch-ice-alerts"
            />
          </div>
        </CardContent>
      </Card>

      {!isInsight && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="py-6 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Upgrade to <span className="font-medium text-foreground">Orbit Insight</span> to unlock email notifications and lead alerts
            </p>
          </CardContent>
        </Card>
      )}

      {isInsight && !isIntelligence && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="py-6 text-center">
            <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Upgrade to <span className="font-medium text-foreground">Orbit Intelligence</span> to unlock pattern detection and strategic alerts
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
