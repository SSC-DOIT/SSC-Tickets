import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, CheckCircle2, Clock, Zap, MessageSquare, FileText, ChevronRight } from "lucide-react";
import { AgentActivityData } from "@/types/agentAnalytics";
import { cn } from "@/lib/utils";

interface AgentActivityCardProps {
  agent: AgentActivityData;
  className?: string;
}

export const AgentActivityCard = ({ agent, className }: AgentActivityCardProps) => {
  const timeSavedHours = (agent.totalTimeSavedMinutes / 60).toFixed(1);
  const hasActivity = agent.ticketsAssigned > 0;

  // Create URL-safe agent ID from first part of name
  const agentUrlId = encodeURIComponent(agent.name.split(" - ")[0].toLowerCase().replace(/\s+/g, "-"));

  return (
    <Link to={`/ai-teammates/${agentUrlId}`}>
      <Card
        className={cn(
          "p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-border/50 relative overflow-hidden cursor-pointer group",
          className
        )}
      >
        {/* Accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: agent.color }}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              <Bot className="w-5 h-5" style={{ color: agent.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm leading-tight">
                {agent.name.split(" - ")[0]}
              </h3>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={hasActivity ? "default" : "secondary"}
              className="text-xs"
            >
              {hasActivity ? "Active" : "Idle"}
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-xs">Completed</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {agent.ticketsCompleted}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-xs">Open</span>
            </div>
            <p className="text-xl font-bold text-foreground">{agent.ticketsOpen}</p>
          </div>
        </div>

        {/* Comments & Words */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              <span className="text-xs">Comments</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {agent.commentsWritten}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileText className="w-3 h-3" />
              <span className="text-xs">Words</span>
            </div>
            <p className="text-lg font-semibold text-foreground">
              {agent.wordsWritten.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium text-foreground">
              {agent.completionRate.toFixed(0)}%
            </span>
          </div>
          <Progress value={agent.completionRate} className="h-2" />
        </div>

        {/* Time Saved */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-3 h-3" />
            <span className="text-xs">Time Saved</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: agent.color }}>
            {timeSavedHours}h
          </span>
        </div>
      </Card>
    </Link>
  );
};
