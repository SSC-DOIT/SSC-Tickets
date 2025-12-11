import { AI_TEAMMATES } from "@/types/agentAnalytics";
import { fetchTaskStories } from "./asanaService";
import { calculateBusinessMinutes } from "@/utils/businessHours";

// Set of AI teammate GIDs for quick lookup
const AI_TEAMMATE_GIDS = new Set<string>(AI_TEAMMATES.map((t) => t.gid));

export interface FirstResponseData {
  ticketGid: string;
  ticketCreatedAt: string;

  // AI Teammate response
  firstAIResponseAt: string | null;
  firstAIResponderName: string | null;
  firstAIResponderGid: string | null;
  aiResponseMinutes: number | null;

  // Human response
  firstHumanResponseAt: string | null;
  firstHumanResponderName: string | null;
  firstHumanResponderGid: string | null;
  humanResponseMinutes: number | null;
}

interface StoryData {
  gid: string;
  created_at: string;
  resource_subtype: string;
  text?: string;
  created_by?: {
    gid: string;
    name: string;
  };
}

/**
 * Fetch first response data for a batch of tickets
 * Identifies first AI teammate response and first human response separately
 */
export async function fetchFirstResponseData(
  ticketGids: string[],
  ticketCreatedAtMap: Map<string, string>
): Promise<Map<string, FirstResponseData>> {
  const results = new Map<string, FirstResponseData>();

  if (ticketGids.length === 0) return results;

  try {
    // Fetch stories for all tickets
    const storiesResponse = await fetchTaskStories(ticketGids);

    // Process each ticket's stories
    for (const taskStories of storiesResponse) {
      const ticketGid = taskStories.taskGid;
      const ticketCreatedAt = ticketCreatedAtMap.get(ticketGid);

      if (!ticketCreatedAt) continue;

      // Initialize response data
      const responseData: FirstResponseData = {
        ticketGid,
        ticketCreatedAt,
        firstAIResponseAt: null,
        firstAIResponderName: null,
        firstAIResponderGid: null,
        aiResponseMinutes: null,
        firstHumanResponseAt: null,
        firstHumanResponderName: null,
        firstHumanResponderGid: null,
        humanResponseMinutes: null,
      };

      // Sort stories by created_at
      const sortedStories = [...taskStories.stories].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Find first AI and human comments
      for (const story of sortedStories) {
        // Only count comment_added stories
        if (story.resource_subtype !== "comment_added") continue;
        if (!story.created_by?.gid) continue;

        const isAITeammate = AI_TEAMMATE_GIDS.has(story.created_by.gid);

        if (isAITeammate && !responseData.firstAIResponseAt) {
          // First AI teammate response
          responseData.firstAIResponseAt = story.created_at;
          responseData.firstAIResponderName = story.created_by.name;
          responseData.firstAIResponderGid = story.created_by.gid;
          responseData.aiResponseMinutes = calculateBusinessMinutes(
            ticketCreatedAt,
            story.created_at
          );
        } else if (!isAITeammate && !responseData.firstHumanResponseAt) {
          // First human response
          responseData.firstHumanResponseAt = story.created_at;
          responseData.firstHumanResponderName = story.created_by.name;
          responseData.firstHumanResponderGid = story.created_by.gid;
          responseData.humanResponseMinutes = calculateBusinessMinutes(
            ticketCreatedAt,
            story.created_at
          );
        }

        // Stop if we have both
        if (responseData.firstAIResponseAt && responseData.firstHumanResponseAt) {
          break;
        }
      }

      results.set(ticketGid, responseData);
    }
  } catch (error) {
    console.error("Error fetching first response data:", error);
  }

  return results;
}

/**
 * Calculate dual response trends from response data
 */
export function calculateDualResponseTrends(
  responseDataMap: Map<string, FirstResponseData>,
  daysBack: number = 365
): DualResponseTrendData[] {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const weeklyData: {
    [key: string]: {
      aiTotal: number;
      aiCount: number;
      humanTotal: number;
      humanCount: number;
    };
  } = {};

  responseDataMap.forEach((data) => {
    const created = new Date(data.ticketCreatedAt);
    if (isNaN(created.getTime()) || created < startDate) return;

    // Group by week for smoother trends
    const weekStart = new Date(created);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { aiTotal: 0, aiCount: 0, humanTotal: 0, humanCount: 0 };
    }

    // Add AI response time if available
    if (data.aiResponseMinutes !== null && data.aiResponseMinutes >= 0) {
      weeklyData[weekKey].aiTotal += data.aiResponseMinutes;
      weeklyData[weekKey].aiCount += 1;
    }

    // Add human response time if available
    if (data.humanResponseMinutes !== null && data.humanResponseMinutes >= 0) {
      weeklyData[weekKey].humanTotal += data.humanResponseMinutes;
      weeklyData[weekKey].humanCount += 1;
    }
  });

  return Object.keys(weeklyData)
    .sort()
    .map((date) => {
      const data = weeklyData[date];
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        week: date,
        avgAIResponseMinutes:
          data.aiCount > 0 ? Math.round(data.aiTotal / data.aiCount) : null,
        avgHumanResponseMinutes:
          data.humanCount > 0 ? Math.round(data.humanTotal / data.humanCount) : null,
        aiTicketCount: data.aiCount,
        humanTicketCount: data.humanCount,
      };
    });
}

export interface DualResponseTrendData {
  date: string;
  week: string;
  avgAIResponseMinutes: number | null;
  avgHumanResponseMinutes: number | null;
  aiTicketCount: number;
  humanTicketCount: number;
}
