import { useParams, Link } from "react-router-dom";
import { useMemo } from "react";
import {
  Bot,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  MessageSquare,
  FileText,
  Calendar,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentAnalytics } from "@/hooks/useAgentAnalytics";
import { AI_TEAMMATES } from "@/types/agentAnalytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AgentProfilePage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { agents, trends, loading } = useAgentAnalytics(90);

  // Find agent by URL-safe name
  const agent = useMemo(() => {
    if (!agentId) return null;
    const decodedName = decodeURIComponent(agentId).replace(/-/g, " ");
    return agents.find(
      (a) =>
        a.name.toLowerCase() === decodedName.toLowerCase() ||
        a.name.split(" - ")[0].toLowerCase() === decodedName.toLowerCase()
    );
  }, [agents, agentId]);

  const agentInfo = useMemo(() => {
    if (!agent) return null;
    return AI_TEAMMATES.find((t) => t.name === agent.name);
  }, [agent]);

  // Filter trends for this agent
  const agentTrends = useMemo(() => {
    if (!agent || trends.length === 0) return [];
    return trends.map((t) => ({
      date: t.date,
      completions: (t[agent.name] as number) || 0,
    }));
  }, [agent, trends]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!agent || !agentInfo) {
    return (
      <div className="p-6">
        <Link to="/ai-teammates">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <Card className="p-12 text-center">
          <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Agent Not Found
          </h3>
          <p className="text-muted-foreground">
            The requested AI Teammate could not be found.
          </p>
        </Card>
      </div>
    );
  }

  const timeSavedHours = (agent.totalTimeSavedMinutes / 60).toFixed(1);
  const hasActivity = agent.ticketsAssigned > 0;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button */}
      <Link to="/ai-teammates">
        <Button variant="ghost" className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Agent Header */}
      <div className="flex items-start gap-6">
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: `${agentInfo.color}20` }}
        >
          <Bot className="w-12 h-12" style={{ color: agentInfo.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{agent.name}</h1>
            <Badge
              variant={hasActivity ? "default" : "secondary"}
              className="text-sm"
            >
              {hasActivity ? "Active" : "Idle"}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground mb-2">{agentInfo.role}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Last 90 days activity
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              {agent.ticketsAssigned} total tickets
            </span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">Completed</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: agentInfo.color }}>
            {agent.ticketsCompleted}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Open</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{agent.ticketsOpen}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Completion Rate</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {agent.completionRate.toFixed(0)}%
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs">Time Saved</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: agentInfo.color }}>
            {timeSavedHours}h
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">Comments</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {agent.commentsWritten}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs">Words Written</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {agent.wordsWritten.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Performance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completion Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {agentTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={agentTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completions"
                    stroke={agentInfo.color}
                    strokeWidth={2}
                    dot={false}
                    name="Completions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Completion Rate</span>
                <span className="font-medium">{agent.completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={agent.completionRate} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Avg Response Time</span>
                <span className="font-medium">
                  {agent.avgResponseTimeHours.toFixed(1)}h
                </span>
              </div>
              <Progress
                value={Math.min(100, (24 - agent.avgResponseTimeHours) / 24 * 100)}
                className="h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Avg Completion Time</span>
                <span className="font-medium">
                  {agent.avgCompletionDays.toFixed(1)} days
                </span>
              </div>
              <Progress
                value={Math.min(100, (7 - agent.avgCompletionDays) / 7 * 100)}
                className="h-2"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Automated Tickets</span>
                <span className="font-medium">{agent.automatedTickets}</span>
              </div>
              <Progress
                value={
                  agent.ticketsAssigned > 0
                    ? (agent.automatedTickets / agent.ticketsAssigned) * 100
                    : 0
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.recentActivity.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {agent.recentActivity.map((activity, idx) => (
                  <div
                    key={`${activity.ticketId}-${idx}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div
                      className="p-1.5 rounded-full mt-0.5"
                      style={{ backgroundColor: `${agentInfo.color}20` }}
                    >
                      {activity.action === "completed" ? (
                        <CheckCircle2
                          className="w-3 h-3"
                          style={{ color: agentInfo.color }}
                        />
                      ) : (
                        <Activity
                          className="w-3 h-3"
                          style={{ color: agentInfo.color }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium capitalize">
                          {activity.action}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {activity.board}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground truncate">
                        {activity.ticketName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No recent activity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentProfilePage;
