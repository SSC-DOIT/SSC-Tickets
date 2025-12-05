import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, UserPlus, FileText } from "lucide-react";
import { AgentActivityData, AgentActivityEvent } from "@/types/agentAnalytics";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface AgentActivityTimelineProps {
  agents: AgentActivityData[];
  maxItems?: number;
}

export const AgentActivityTimeline = ({
  agents,
  maxItems = 20,
}: AgentActivityTimelineProps) => {
  // Combine and sort all recent activities
  const allActivities: (AgentActivityEvent & { agentName: string; agentColor: string })[] = [];

  agents.forEach((agent) => {
    agent.recentActivity.forEach((activity) => {
      allActivities.push({
        ...activity,
        agentName: agent.name.split(" - ")[0],
        agentColor: agent.color,
      });
    });
  });

  // Sort by timestamp descending and limit
  const sortedActivities = allActivities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxItems);

  const getActionIcon = (action: AgentActivityEvent["action"]) => {
    switch (action) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-accent" />;
      case "assigned":
        return <UserPlus className="w-4 h-4 text-primary" />;
      case "created":
        return <FileText className="w-4 h-4 text-chart-3" />;
    }
  };

  const getActionLabel = (action: AgentActivityEvent["action"]) => {
    switch (action) {
      case "completed":
        return "Completed";
      case "assigned":
        return "Assigned";
      case "created":
        return "Created";
    }
  };

  if (sortedActivities.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No recent AI teammate activity found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          <div className="space-y-4 py-4">
            {sortedActivities.map((activity, index) => (
              <div
                key={`${activity.ticketId}-${activity.action}-${index}`}
                className="flex items-start gap-3"
              >
                <div className="mt-1">{getActionIcon(activity.action)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: activity.agentColor }}
                    >
                      {activity.agentName}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getActionLabel(activity.action)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {activity.board}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {activity.ticketName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
