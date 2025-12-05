import { EnhancedParsedTicket } from "./enhancedDataLoader";
import {
  AI_TEAMMATES,
  AgentActivityData,
  AgentActivityEvent,
  AgentTrendData,
  AgentSummary,
  AgentLeaderboardEntry,
} from "@/types/agentAnalytics";

// Automation time estimates (minutes saved per ticket)
const AUTOMATION_TIME_ESTIMATES: { [key: string]: number } = {
  "R1 - Triage +": 5,
  "R2 - Classification +": 3,
  "R3 - Description +": 8,
  "R4 - Prioritization +": 4,
  "R5 - Validation +": 6,
  "R6 - Communication +": 10,
};

/**
 * Check if a ticket is assigned to an AI Teammate
 */
export const isAITeammate = (assignee: string): boolean => {
  return AI_TEAMMATES.some((agent) => agent.name === assignee);
};

/**
 * Get AI Teammate info by name
 */
export const getAgentInfo = (name: string) => {
  return AI_TEAMMATES.find((agent) => agent.name === name);
};

/**
 * Analyze activity for all AI Teammates
 */
export const analyzeAgentActivity = (
  tickets: EnhancedParsedTicket[]
): AgentActivityData[] => {
  const agentData: Map<string, AgentActivityData> = new Map();

  // Initialize all agents
  AI_TEAMMATES.forEach((agent) => {
    agentData.set(agent.name, {
      name: agent.name,
      role: agent.role,
      color: agent.color,
      ticketsAssigned: 0,
      ticketsCompleted: 0,
      ticketsOpen: 0,
      completionRate: 0,
      avgResponseTimeHours: 0,
      avgCompletionDays: 0,
      totalTimeSavedMinutes: 0,
      automatedTickets: 0,
      recentActivity: [],
    });
  });

  // Analyze each ticket
  tickets.forEach((ticket) => {
    const assignee = ticket.assignee;
    if (!assignee || !isAITeammate(assignee)) return;

    const agent = agentData.get(assignee);
    if (!agent) return;

    // Count assignments
    agent.ticketsAssigned++;

    // Track completion
    if (ticket.completedAt) {
      agent.ticketsCompleted++;

      // Calculate completion time in days
      const created = new Date(ticket.createdAt);
      const completed = new Date(ticket.completedAt);
      const completionDays =
        (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      agent.avgCompletionDays =
        (agent.avgCompletionDays * (agent.ticketsCompleted - 1) + completionDays) /
        agent.ticketsCompleted;

      // Add to recent activity
      agent.recentActivity.push({
        ticketId: ticket.id,
        ticketName: ticket.name,
        action: "completed",
        timestamp: ticket.completedAt,
        board: (ticket as any).board || "TIE",
      });
    } else {
      agent.ticketsOpen++;
    }

    // Track response time
    if (ticket.responseTimeHours && ticket.responseTimeHours > 0) {
      const prevTotal =
        agent.avgResponseTimeHours *
        (agent.ticketsAssigned - 1 > 0 ? agent.ticketsAssigned - 1 : 0);
      agent.avgResponseTimeHours =
        (prevTotal + ticket.responseTimeHours) / agent.ticketsAssigned;
    }

    // Track automation savings
    if (ticket.automationStage) {
      agent.automatedTickets++;
      const minutesSaved =
        AUTOMATION_TIME_ESTIMATES[ticket.automationStage] || 0;
      agent.totalTimeSavedMinutes += minutesSaved;
    }

    // Add creation event to recent activity
    agent.recentActivity.push({
      ticketId: ticket.id,
      ticketName: ticket.name,
      action: "assigned",
      timestamp: ticket.createdAt,
      board: (ticket as any).board || "TIE",
    });
  });

  // Calculate completion rates and sort recent activity
  agentData.forEach((agent) => {
    agent.completionRate =
      agent.ticketsAssigned > 0
        ? (agent.ticketsCompleted / agent.ticketsAssigned) * 100
        : 0;

    // Sort recent activity by timestamp descending and limit to 10
    agent.recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    agent.recentActivity = agent.recentActivity.slice(0, 10);
  });

  return Array.from(agentData.values());
};

/**
 * Calculate summary metrics across all agents
 */
export const calculateAgentSummary = (
  agents: AgentActivityData[]
): AgentSummary | null => {
  const activeAgents = agents.filter((a) => a.ticketsAssigned > 0);
  if (activeAgents.length === 0) return null;

  const totalTicketsAssigned = agents.reduce(
    (sum, a) => sum + a.ticketsAssigned,
    0
  );
  const totalTicketsCompleted = agents.reduce(
    (sum, a) => sum + a.ticketsCompleted,
    0
  );
  const totalTimeSavedMinutes = agents.reduce(
    (sum, a) => sum + a.totalTimeSavedMinutes,
    0
  );

  const avgCompletionRate =
    activeAgents.reduce((sum, a) => sum + a.completionRate, 0) /
    activeAgents.length;

  // Find most active (by tickets assigned)
  const mostActive = activeAgents.reduce((prev, curr) =>
    curr.ticketsAssigned > prev.ticketsAssigned ? curr : prev
  );

  // Find fastest (by avg completion days, lower is better)
  const agentsWithCompletions = activeAgents.filter(
    (a) => a.avgCompletionDays > 0
  );
  const fastest =
    agentsWithCompletions.length > 0
      ? agentsWithCompletions.reduce((prev, curr) =>
          curr.avgCompletionDays < prev.avgCompletionDays ? curr : prev
        )
      : mostActive;

  return {
    totalTicketsAssigned,
    totalTicketsCompleted,
    totalTimeSavedHours: totalTimeSavedMinutes / 60,
    avgCompletionRate,
    mostActiveAgent: mostActive.name,
    fastestAgent: fastest.name,
  };
};

/**
 * Analyze trends over time for each agent
 */
export const analyzeAgentTrends = (
  tickets: EnhancedParsedTicket[],
  daysBack: number = 90
): AgentTrendData[] => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // Initialize daily data
  const dailyData: Map<string, { [agentName: string]: number }> = new Map();

  // Fill in all dates
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateKey = new Date(d).toISOString().split("T")[0];
    const dayData: { [key: string]: number } = {};
    AI_TEAMMATES.forEach((agent) => {
      dayData[agent.name] = 0;
    });
    dailyData.set(dateKey, dayData);
  }

  // Count completions per day per agent
  tickets.forEach((ticket) => {
    if (!ticket.completedAt) return;
    const assignee = ticket.assignee;
    if (!assignee || !isAITeammate(assignee)) return;

    const completed = new Date(ticket.completedAt);
    if (completed < startDate) return;

    const dateKey = completed.toISOString().split("T")[0];
    const dayData = dailyData.get(dateKey);
    if (dayData && dayData[assignee] !== undefined) {
      dayData[assignee]++;
    }
  });

  // Convert to array format
  return Array.from(dailyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agents]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      ...agents,
    }));
};

/**
 * Create leaderboard for a specific metric
 */
export const createAgentLeaderboard = (
  agents: AgentActivityData[],
  metric: "ticketsCompleted" | "completionRate" | "avgResponseTimeHours" | "totalTimeSavedMinutes"
): AgentLeaderboardEntry[] => {
  const activeAgents = agents.filter((a) => a.ticketsAssigned > 0);

  const sorted = [...activeAgents].sort((a, b) => {
    // For response time, lower is better
    if (metric === "avgResponseTimeHours") {
      return a[metric] - b[metric];
    }
    return b[metric] - a[metric];
  });

  return sorted.map((agent, index) => {
    let formattedValue: string;
    switch (metric) {
      case "ticketsCompleted":
        formattedValue = String(agent.ticketsCompleted);
        break;
      case "completionRate":
        formattedValue = `${agent.completionRate.toFixed(1)}%`;
        break;
      case "avgResponseTimeHours":
        formattedValue = `${agent.avgResponseTimeHours.toFixed(1)}h`;
        break;
      case "totalTimeSavedMinutes":
        formattedValue = `${(agent.totalTimeSavedMinutes / 60).toFixed(1)}h`;
        break;
    }

    return {
      rank: index + 1,
      name: agent.name,
      role: agent.role,
      value: agent[metric],
      formattedValue,
      color: agent.color,
    };
  });
};
