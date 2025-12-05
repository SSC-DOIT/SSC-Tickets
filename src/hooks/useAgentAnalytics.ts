import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadBoardData, fetchTaskStories } from "@/services/asanaService";
import { EnhancedParsedTicket } from "@/utils/enhancedDataLoader";
import {
  analyzeAgentActivity,
  calculateAgentSummary,
  analyzeAgentTrends,
  mergeStoryDataIntoAgents,
  isAITeammate,
} from "@/utils/agentAnalytics";
import { UseAgentAnalyticsReturn } from "@/types/agentAnalytics";

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for AI Teammate analytics
 * Combines data from both TIE and SFDC boards
 */
export function useAgentAnalytics(daysBack: number = 90): UseAgentAnalyticsReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch TIE data
  const {
    data: tieTickets = [],
    isLoading: tieLoading,
    error: tieError,
    refetch: refetchTie,
    dataUpdatedAt: tieUpdatedAt,
  } = useQuery({
    queryKey: ["tickets", "TIE", true],
    queryFn: () => loadBoardData("TIE", true),
    staleTime: REFETCH_INTERVAL,
    gcTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Fetch SFDC data
  const {
    data: sfdcTickets = [],
    isLoading: sfdcLoading,
    error: sfdcError,
    refetch: refetchSfdc,
    dataUpdatedAt: sfdcUpdatedAt,
  } = useQuery({
    queryKey: ["tickets", "SFDC", true],
    queryFn: () => loadBoardData("SFDC", true),
    staleTime: REFETCH_INTERVAL,
    gcTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Combine tickets from both boards
  const allTickets = useMemo<EnhancedParsedTicket[]>(() => {
    const tieWithBoard = tieTickets.map((t) => ({ ...t, board: "TIE" as const }));
    const sfdcWithBoard = sfdcTickets.map((t) => ({ ...t, board: "SFDC" as const }));
    return [...tieWithBoard, ...sfdcWithBoard];
  }, [tieTickets, sfdcTickets]);

  // Get task GIDs for AI teammate tickets (for story fetching)
  const agentTaskGids = useMemo(() => {
    return allTickets
      .filter((t) => t.assignee && isAITeammate(t.assignee))
      .map((t) => t.id)
      .slice(0, 50); // Limit to avoid timeout
  }, [allTickets]);

  // Fetch stories for agent tickets
  const {
    data: storyData = [],
    isLoading: storiesLoading,
    refetch: refetchStories,
  } = useQuery({
    queryKey: ["agent-stories", agentTaskGids],
    queryFn: () => fetchTaskStories(agentTaskGids),
    enabled: agentTaskGids.length > 0,
    staleTime: REFETCH_INTERVAL,
    gcTime: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Analyze agent activity
  const agents = useMemo(() => {
    const baseAgents = analyzeAgentActivity(allTickets);
    // Merge in story data if available
    if (storyData.length > 0) {
      return mergeStoryDataIntoAgents(baseAgents, storyData);
    }
    return baseAgents;
  }, [allTickets, storyData]);

  // Calculate summary
  const summary = useMemo(() => {
    return calculateAgentSummary(agents);
  }, [agents]);

  // Calculate trends
  const trends = useMemo(() => {
    return analyzeAgentTrends(allTickets, daysBack);
  }, [allTickets, daysBack]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchTie(), refetchSfdc(), refetchStories()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchTie, refetchSfdc, refetchStories]);

  const loading = tieLoading || sfdcLoading || storiesLoading || isRefreshing;
  const error = tieError || sfdcError;
  const lastUpdated = Math.max(tieUpdatedAt || 0, sfdcUpdatedAt || 0);

  return {
    agents,
    summary,
    trends,
    loading,
    error: error instanceof Error ? error : null,
    lastUpdated: lastUpdated ? new Date(lastUpdated) : null,
    refresh,
  };
}
