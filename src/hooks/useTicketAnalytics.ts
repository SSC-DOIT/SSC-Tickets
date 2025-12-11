import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadBoardData } from "@/services/asanaService";
import { EnhancedParsedTicket } from "@/utils/enhancedDataLoader";
import { analyzeResponseTimes } from "@/utils/asanaJsonParser";
import {
  analyzeNetNewTickets,
  analyzeFirstResponseTrends,
  analyzeAutomationAnalytics,
  analyzeOpenTicketTrends,
  getLastThursday,
  getJulyFirst,
} from "@/utils/enhancedAnalytics";
import { analyzeCategoryCounts } from "@/utils/categoryAnalytics";
import {
  AnalyticsData,
  EnhancedAnalyticsData,
  UseTicketAnalyticsReturn,
} from "@/types/analytics";
import {
  fetchFirstResponseData,
  calculateDualResponseTrends,
} from "@/services/responseTimeService";

const ROLLOUT_DATE = new Date("2025-10-21");
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for loading and analyzing ticket data
 * Provides comprehensive analytics with automatic caching and refresh
 */
export function useTicketAnalytics(
  board: "TIE" | "SFDC",
  includeArchive: boolean = true,
  daysBack: number = 365
): UseTicketAnalyticsReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data with React Query
  const {
    data: tickets = [],
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["tickets", board, includeArchive],
    queryFn: () => loadBoardData(board, includeArchive),
    staleTime: REFETCH_INTERVAL, // Keep data fresh for 5 minutes
    gcTime: REFETCH_INTERVAL, // Cache in memory for 5 minutes
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    retry: 2,
  });

  // Memoize analytics calculations
  const analytics = useMemo<AnalyticsData | null>(() => {
    if (tickets.length === 0) return null;

    const lastThursday = getLastThursday();
    const julyFirst = getJulyFirst();

    return analyzeResponseTimes(tickets, ROLLOUT_DATE, lastThursday, julyFirst);
  }, [tickets]);

  // Get recent ticket GIDs for story fetching (last 90 days)
  const recentTicketData = useMemo(() => {
    if (tickets.length === 0) return { gids: [], createdAtMap: new Map<string, string>() };
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const recentTickets = tickets.filter(
      (t) => new Date(t.createdAt) >= ninetyDaysAgo
    );
    
    const gids = recentTickets.map((t) => t.id);
    const createdAtMap = new Map(recentTickets.map((t) => [t.id, t.createdAt]));
    
    return { gids, createdAtMap };
  }, [tickets]);

  // Fetch first response data (stories) for recent tickets
  const { data: responseData } = useQuery({
    queryKey: ["responseData", board, recentTicketData.gids.length],
    queryFn: () => fetchFirstResponseData(recentTicketData.gids, recentTicketData.createdAtMap),
    enabled: recentTicketData.gids.length > 0,
    staleTime: REFETCH_INTERVAL,
    gcTime: REFETCH_INTERVAL,
  });

  // Memoize enhanced analytics
  const enhancedData = useMemo<EnhancedAnalyticsData | null>(() => {
    if (tickets.length === 0) return null;

    const netNewTrends = analyzeNetNewTickets(tickets, daysBack);
    const responseTrends = analyzeFirstResponseTrends(tickets, daysBack);
    const openTrends = analyzeOpenTicketTrends(tickets, daysBack);

    // Calculate dual response trends from story data
    const dualResponseTrends = responseData
      ? calculateDualResponseTrends(responseData, daysBack)
      : [];

    // Comprehensive automation analytics (per-ticket savings and forecasting)
    const automationAnalytics = analyzeAutomationAnalytics(tickets);

    // Category analysis
    const categories = analyzeCategoryCounts(tickets);

    return {
      netNewTrends,
      responseTrends,
      dualResponseTrends,
      automationAnalytics,
      openTrends,
      categories,
    };
  }, [tickets, daysBack, responseData]);

  // Manual refresh with loading state
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Convert dataUpdatedAt to Date or null
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return {
    analytics,
    enhancedData,
    tickets,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    lastUpdated,
    isRefreshing,
    refresh,
  };
}
