// AI Teammate definitions with Asana user GIDs
export const AI_TEAMMATES = [
  { name: "Relay - Manager Agent", role: "Manager", color: "hsl(var(--chart-1))", gid: "1212322782186923" },
  { name: "Axis - Strategic Planner", role: "Planner", color: "hsl(var(--chart-2))", gid: "1212321048621068" },
  { name: "Scout - Launch Navigator", role: "Navigator", color: "hsl(var(--chart-3))", gid: "1212321048621065" },
  { name: "Pulse - Insights & Analytics", role: "Analytics", color: "hsl(var(--chart-4))", gid: "1212321048621057" },
  { name: "Sentry - IT Ticketing", role: "IT Support", color: "hsl(var(--chart-5))", gid: "1212307310503059" },
  { name: "Scribe - Documentation", role: "Documentation", color: "hsl(220 70% 50%)", gid: "1212336204907371" },
] as const;

export type AITeammateName = typeof AI_TEAMMATES[number]["name"];

// Per-agent activity metrics
export interface AgentActivityData {
  name: string;
  role: string;
  color: string;
  gid?: string;
  // Task metrics
  ticketsAssigned: number;
  ticketsCompleted: number;
  ticketsOpen: number;
  completionRate: number;
  // Time metrics
  avgResponseTimeHours: number;
  avgCompletionDays: number;
  totalTimeSavedMinutes: number;
  automatedTickets: number;
  // Story-based metrics
  commentsWritten: number;
  wordsWritten: number;
  // Subtask metrics
  subtasksCreated: number;
  subtasksCompleted: number;
  // Impact metrics
  projectsImpacted: string[];
  portfoliosImpacted: string[];
  // Activity feed
  recentActivity: AgentActivityEvent[];
}

// Individual activity event
export interface AgentActivityEvent {
  ticketId: string;
  ticketName: string;
  action: "assigned" | "completed" | "created" | "commented" | "subtask_created" | "subtask_completed";
  timestamp: string;
  board?: "TIE" | "SFDC" | string;
  projectName?: string;
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
  totalCommentsWritten: number;
  totalWordsWritten: number;
  totalSubtasksCreated: number;
  totalSubtasksCompleted: number;
  totalProjectsImpacted: number;
}

// Raw data from edge function
export interface AgentTasksResult {
  agentName: string;
  agentGid: string;
  tasks: AsanaTask[];
  stories: AsanaStory[];
  subtasksCreated: number;
  subtasksCompleted: number;
  projectsImpacted: string[];
}

export interface AsanaTask {
  gid: string;
  name: string;
  created_at: string;
  modified_at?: string;
  completed?: boolean;
  completed_at?: string | null;
  assignee?: { name: string; gid: string } | null;
  projects?: { gid: string; name: string }[];
  parent?: { gid: string; name: string } | null;
  num_subtasks?: number;
  custom_fields?: any[];
}

export interface AsanaStory {
  gid: string;
  created_at: string;
  created_by?: { name: string; gid: string } | null;
  resource_subtype: string;
  text?: string;
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
