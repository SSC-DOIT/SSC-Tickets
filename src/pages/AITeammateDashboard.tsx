import { Bot, RefreshCw, Clock, CheckCircle2, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentAnalytics } from "@/hooks/useAgentAnalytics";
import { AgentActivityCard } from "@/components/AgentActivityCard";
import { AgentComparisonChart } from "@/components/AgentComparisonChart";
import { AgentActivityTimeline } from "@/components/AgentActivityTimeline";
import { AgentEfficiencyChart } from "@/components/AgentEfficiencyChart";
import { AgentLeaderboard } from "@/components/AgentLeaderboard";
import { MetricCard } from "@/components/MetricCard";

const AITeammateDashboard = () => {
  const { agents, summary, trends, loading, lastUpdated, refresh } =
    useAgentAnalytics(90);

  const formatLastUpdated = () => {
    if (!lastUpdated) return "Never";
    return lastUpdated.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading && agents.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const hasActivity = agents.some((a) => a.ticketsAssigned > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              AI Teammate Activity
            </h1>
            <p className="text-sm text-muted-foreground">
              Track performance across all AI agents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last updated: {formatLastUpdated()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Tickets Handled"
            value={summary.totalTicketsAssigned.toString()}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <MetricCard
            title="Tickets Completed"
            value={summary.totalTicketsCompleted.toString()}
            icon={<TrendingUp className="w-5 h-5" />}
            trend={summary.avgCompletionRate > 70 ? "up" : "neutral"}
          />
          <MetricCard
            title="Total Time Saved"
            value={`${summary.totalTimeSavedHours.toFixed(1)}h`}
            icon={<Zap className="w-5 h-5" />}
            trend="up"
          />
          <MetricCard
            title="Avg Completion Rate"
            value={`${summary.avgCompletionRate.toFixed(0)}%`}
            icon={<Clock className="w-5 h-5" />}
            trend={summary.avgCompletionRate > 80 ? "up" : "neutral"}
          />
        </div>
      )}

      {/* Empty State */}
      {!hasActivity && (
        <Card className="p-12 text-center">
          <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No AI Teammate Activity Found
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your AI Teammates (Relay, Axis, Scout, Pulse, Sentry) don't have any
            assigned tickets yet. Activity will appear here once they start
            working on tickets.
          </p>
        </Card>
      )}

      {/* Agent Cards */}
      {hasActivity && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {agents.map((agent) => (
              <AgentActivityCard key={agent.name} agent={agent} />
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentComparisonChart agents={agents} />
            <AgentEfficiencyChart trends={trends} />
          </div>

          {/* Timeline and Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentActivityTimeline agents={agents} />
            <AgentLeaderboard agents={agents} />
          </div>
        </>
      )}
    </div>
  );
};

export default AITeammateDashboard;
