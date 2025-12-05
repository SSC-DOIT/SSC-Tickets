import { useState, useMemo } from "react";
import { subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import {
  Bot,
  RefreshCw,
  Clock,
  CheckCircle2,
  Zap,
  TrendingUp,
  MessageSquare,
  FileText,
} from "lucide-react";
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
import type { AgentActivityData, AgentSummary } from "@/types/agentAnalytics";

// Date range selector inline to avoid potential import issues
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date;
  to: Date;
}

const PRESET_RANGES = [
  { label: "Last 7 days", value: "7d", days: 7 },
  { label: "Last 14 days", value: "14d", days: 14 },
  { label: "Last 30 days", value: "30d", days: 30 },
  { label: "Last 90 days", value: "90d", days: 90 },
  { label: "Custom", value: "custom", days: 0 },
];

const DateRangeSelector = ({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}) => {
  const [selectedPreset, setSelectedPreset] = useState("90d");

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = PRESET_RANGES.find((p) => p.value === value);
    if (preset && preset.days > 0) {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(to, preset.days));
      onDateRangeChange({ from, to });
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      setSelectedPreset("custom");
      onDateRangeChange({
        from: startOfDay(range.from),
        to: endOfDay(range.to),
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_RANGES.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                </>
              ) : (
                format(dateRange.from, "MMM d, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

// Filter agents by date range
const filterAgentsByDateRange = (
  agents: AgentActivityData[],
  dateRange: DateRange
): AgentActivityData[] => {
  return agents.map((agent) => ({
    ...agent,
    recentActivity: agent.recentActivity.filter((activity) => {
      const activityDate = new Date(activity.timestamp);
      return isWithinInterval(activityDate, { start: dateRange.from, end: dateRange.to });
    }),
  }));
};

// Recalculate summary with filtered data
const calculateFilteredSummary = (agents: AgentActivityData[]): AgentSummary | null => {
  const activeAgents = agents.filter((a) => a.ticketsAssigned > 0);
  if (activeAgents.length === 0) return null;

  const totalTicketsAssigned = agents.reduce((sum, a) => sum + a.ticketsAssigned, 0);
  const totalTicketsCompleted = agents.reduce((sum, a) => sum + a.ticketsCompleted, 0);
  const totalTimeSavedMinutes = agents.reduce((sum, a) => sum + a.totalTimeSavedMinutes, 0);
  const avgCompletionRate =
    activeAgents.reduce((sum, a) => sum + a.completionRate, 0) / activeAgents.length;

  const mostActive = activeAgents.reduce((prev, curr) =>
    curr.ticketsAssigned > prev.ticketsAssigned ? curr : prev
  );

  const agentsWithCompletions = activeAgents.filter((a) => a.avgCompletionDays > 0);
  const fastest =
    agentsWithCompletions.length > 0
      ? agentsWithCompletions.reduce((prev, curr) =>
          curr.avgCompletionDays < prev.avgCompletionDays ? curr : prev
        )
      : mostActive;

  const totalCommentsWritten = agents.reduce((sum, a) => sum + a.commentsWritten, 0);
  const totalWordsWritten = agents.reduce((sum, a) => sum + a.wordsWritten, 0);

  return {
    totalTicketsAssigned,
    totalTicketsCompleted,
    totalTimeSavedHours: totalTimeSavedMinutes / 60,
    avgCompletionRate,
    mostActiveAgent: mostActive.name,
    fastestAgent: fastest.name,
    totalCommentsWritten,
    totalWordsWritten,
  };
};

const AITeammateDashboard = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 90)),
    to: endOfDay(new Date()),
  });

  const { agents, summary, trends, loading, lastUpdated, refresh } =
    useAgentAnalytics(90);

  const filteredAgents = useMemo(
    () => filterAgentsByDateRange(agents, dateRange),
    [agents, dateRange]
  );

  const filteredSummary = useMemo(
    () => (agents.length > 0 ? calculateFilteredSummary(filteredAgents) : summary),
    [filteredAgents, summary, agents.length]
  );

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

  const hasActivity = filteredAgents.some((a) => a.ticketsAssigned > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        <div className="flex flex-wrap items-center gap-4">
          <DateRangeSelector
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          <span className="text-sm text-muted-foreground">
            Updated: {formatLastUpdated()}
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
      {filteredSummary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="Total Tickets"
            value={filteredSummary.totalTicketsAssigned.toString()}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <MetricCard
            title="Completed"
            value={filteredSummary.totalTicketsCompleted.toString()}
            icon={<TrendingUp className="w-5 h-5" />}
            trend={filteredSummary.avgCompletionRate > 70 ? "up" : "neutral"}
          />
          <MetricCard
            title="Time Saved"
            value={`${filteredSummary.totalTimeSavedHours.toFixed(1)}h`}
            icon={<Zap className="w-5 h-5" />}
            trend="up"
          />
          <MetricCard
            title="Completion Rate"
            value={`${filteredSummary.avgCompletionRate.toFixed(0)}%`}
            icon={<Clock className="w-5 h-5" />}
            trend={filteredSummary.avgCompletionRate > 80 ? "up" : "neutral"}
          />
          <MetricCard
            title="Comments Written"
            value={filteredSummary.totalCommentsWritten.toString()}
            icon={<MessageSquare className="w-5 h-5" />}
          />
          <MetricCard
            title="Words Generated"
            value={filteredSummary.totalWordsWritten.toLocaleString()}
            icon={<FileText className="w-5 h-5" />}
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
            {filteredAgents.map((agent) => (
              <AgentActivityCard key={agent.name} agent={agent} />
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentComparisonChart agents={filteredAgents} />
            <AgentEfficiencyChart trends={trends} />
          </div>

          {/* Timeline and Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentActivityTimeline agents={filteredAgents} />
            <AgentLeaderboard agents={filteredAgents} />
          </div>
        </>
      )}
    </div>
  );
};

export default AITeammateDashboard;
