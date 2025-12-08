import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  fetchAITeammateTasks, 
  transformToAgentActivityData 
} from "@/services/aiTeammateService";
import { 
  AgentActivityData, 
  AgentSummary, 
  AgentTrendData,
  AI_TEAMMATES,
  UseAgentAnalyticsReturn 
} from "@/types/agentAnalytics";
import { subDays } from "date-fns";

const REFETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes

/**
 * Custom hook for AI Teammate analytics
 * Fetches data directly from Asana via edge function
 */
export function useAITeammateAnalytics(daysBack: number = 90): UseAgentAnalyticsReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate date filter
  const completedSince = useMemo(() => {
    return subDays(new Date(), daysBack).toISOString();
  }, [daysBack]);

  // Fetch AI teammate data from edge function
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["ai-teammate-tasks", completedSince],
    queryFn: () => fetchAITeammateTasks({ 
      includeStories: true,
      completedSince,
    }),
    staleTime: REFETCH_INTERVAL,
    gcTime: REFETCH_INTERVAL * 2,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Transform raw data to agent activity data
  const agents = useMemo<AgentActivityData[]>(() => {
    if (!rawData || rawData.length === 0) {
      return AI_TEAMMATES.map(t => ({
        name: t.name,
        role: t.role,
        color: t.color,
        gid: t.gid,
        ticketsAssigned: 0,
        ticketsCompleted: 0,
        ticketsOpen: 0,
        completionRate: 0,
        avgResponseTimeHours: 0,
        avgCompletionDays: 0,
        totalTimeSavedMinutes: 0,
        automatedTickets: 0,
        commentsWritten: 0,
        wordsWritten: 0,
        subtasksCreated: 0,
        subtasksCompleted: 0,
        projectsImpacted: [],
        portfoliosImpacted: [],
        recentActivity: [],
      }));
    }
    return transformToAgentActivityData(rawData);
  }, [rawData]);

  // Calculate summary
  const summary = useMemo<AgentSummary | null>(() => {
    const activeAgents = agents.filter(a => a.ticketsAssigned > 0);
    if (activeAgents.length === 0) return null;

    const totalTicketsAssigned = agents.reduce((sum, a) => sum + a.ticketsAssigned, 0);
    const totalTicketsCompleted = agents.reduce((sum, a) => sum + a.ticketsCompleted, 0);
    const totalTimeSavedMinutes = agents.reduce((sum, a) => sum + a.totalTimeSavedMinutes, 0);
    const totalCommentsWritten = agents.reduce((sum, a) => sum + a.commentsWritten, 0);
    const totalWordsWritten = agents.reduce((sum, a) => sum + a.wordsWritten, 0);
    const totalSubtasksCreated = agents.reduce((sum, a) => sum + a.subtasksCreated, 0);
    const totalSubtasksCompleted = agents.reduce((sum, a) => sum + a.subtasksCompleted, 0);

    const avgCompletionRate = activeAgents.reduce((sum, a) => sum + a.completionRate, 0) / activeAgents.length;

    // Find most active
    const mostActive = activeAgents.reduce((prev, curr) => 
      curr.ticketsAssigned > prev.ticketsAssigned ? curr : prev
    );

    // Find fastest
    const agentsWithCompletions = activeAgents.filter(a => a.avgCompletionDays > 0);
    const fastest = agentsWithCompletions.length > 0
      ? agentsWithCompletions.reduce((prev, curr) => 
          curr.avgCompletionDays < prev.avgCompletionDays ? curr : prev
        )
      : mostActive;

    // Count unique projects
    const allProjects = new Set(agents.flatMap(a => a.projectsImpacted));

    return {
      totalTicketsAssigned,
      totalTicketsCompleted,
      totalTimeSavedHours: totalTimeSavedMinutes / 60,
      avgCompletionRate,
      mostActiveAgent: mostActive.name,
      fastestAgent: fastest.name,
      totalCommentsWritten,
      totalWordsWritten,
      totalSubtasksCreated,
      totalSubtasksCompleted,
      totalProjectsImpacted: allProjects.size,
    };
  }, [agents]);

  // Generate trend data (simplified - would need historical data for real trends)
  const trends = useMemo<AgentTrendData[]>(() => {
    // For now, return empty - real trends would need time-series data
    return [];
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return {
    agents,
    summary,
    trends,
    loading: isLoading || isRefreshing,
    error: error instanceof Error ? error : null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh,
  };
}
