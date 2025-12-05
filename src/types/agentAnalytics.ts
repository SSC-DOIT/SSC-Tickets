// AI Teammate definitions
export const AI_TEAMMATES = [
  { name: "Relay - Manager Agent", role: "Manager", color: "hsl(var(--chart-1))" },
  { name: "Axis - Strategic Planner", role: "Planner", color: "hsl(var(--chart-2))" },
  { name: "Scout - Launch Navigator", role: "Navigator", color: "hsl(var(--chart-3))" },
  { name: "Pulse - Insights & Analytics", role: "Analytics", color: "hsl(var(--chart-4))" },
  { name: "Sentry - IT Ticketing", role: "IT Support", color: "hsl(var(--chart-5))" },
] as const;

export type AITeammateName = typeof AI_TEAMMATES[number]["name"];

// Per-agent activity metrics
export interface AgentActivityData {
  name: string;
  role: string;
  color: string;
  ticketsAssigned: number;
  ticketsCompleted: number;
  ticketsOpen: number;
  completionRate: number;
  avgResponseTimeHours: number;
  avgCompletionDays: number;
  totalTimeSavedMinutes: number;
  automatedTickets: number;
  recentActivity: AgentActivityEvent[];
}

// Individual activity event
export interface AgentActivityEvent {
  ticketId: string;
  ticketName: string;
  action: "assigned" | "completed" | "created";
  timestamp: string;
  board: "TIE" | "SFDC";
}

// Time-series trend data per agent
export interface AgentTrendData {
  date: string;
  [agentName: string]: number | string;
}

// Comparison data across agents
export interface AgentComparisonData {
  metric: string;
  [agentName: string]: number | string;
}

// Leaderboard entry
export interface AgentLeaderboardEntry {
  rank: number;
  name: string;
  role: string;
  value: number;
  formattedValue: string;
  color: string;
}

// Summary metrics for all agents
export interface AgentSummary {
  totalTicketsAssigned: number;
  totalTicketsCompleted: number;
  totalTimeSavedHours: number;
  avgCompletionRate: number;
  mostActiveAgent: string;
  fastestAgent: string;
}

// Hook return type
export interface UseAgentAnalyticsReturn {
  agents: AgentActivityData[];
  summary: AgentSummary | null;
  trends: AgentTrendData[];
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}
