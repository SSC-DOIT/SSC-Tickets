import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal, Award } from "lucide-react";
import { AgentActivityData } from "@/types/agentAnalytics";
import { createAgentLeaderboard } from "@/utils/agentAnalytics";

interface AgentLeaderboardProps {
  agents: AgentActivityData[];
}

type MetricType =
  | "ticketsCompleted"
  | "completionRate"
  | "avgResponseTimeHours"
  | "totalTimeSavedMinutes";

const METRIC_LABELS: Record<MetricType, string> = {
  ticketsCompleted: "Tickets Completed",
  completionRate: "Completion Rate",
  avgResponseTimeHours: "Response Time (lower = better)",
  totalTimeSavedMinutes: "Time Saved",
};

export const AgentLeaderboard = ({ agents }: AgentLeaderboardProps) => {
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("ticketsCompleted");

  const leaderboard = createAgentLeaderboard(agents, selectedMetric);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">
            {rank}
          </span>
        );
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Leaderboard</CardTitle>
          <Select
            value={selectedMetric}
            onValueChange={(value) => setSelectedMetric(value as MetricType)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No data available for ranking
          </p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>
                <div
                  className="w-1 h-8 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {entry.name.split(" - ")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.role}</p>
                </div>
                <div className="text-right">
                  <p
                    className="text-lg font-bold"
                    style={{ color: entry.color }}
                  >
                    {entry.formattedValue}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
