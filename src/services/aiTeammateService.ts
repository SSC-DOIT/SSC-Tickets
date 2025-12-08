import { supabase } from "@/integrations/supabase/client";
import { 
  AgentTasksResult, 
  AgentActivityData, 
  AgentActivityEvent,
  AI_TEAMMATES 
} from "@/types/agentAnalytics";

// Your Asana workspace GID - extracted from project URLs
const WORKSPACE_GID = "1178935369889839";

export interface FetchAITeammateTasksOptions {
  agentNames?: string[];
  includeStories?: boolean;
  completedSince?: string; // ISO date string
}

/**
 * Fetch tasks and stories for AI teammates from Asana
 */
export async function fetchAITeammateTasks(
  options: FetchAITeammateTasksOptions = {}
): Promise<AgentTasksResult[]> {
  const { agentNames, includeStories = true, completedSince } = options;

  console.log("Fetching AI teammate tasks...", { agentNames, includeStories, completedSince });

  const { data, error } = await supabase.functions.invoke("fetch-ai-teammate-tasks", {
    body: {
      workspaceGid: WORKSPACE_GID,
      agentNames,
      includeStories,
      completedSince,
    },
  });

  if (error) {
    console.error("Error fetching AI teammate tasks:", error);
    throw new Error(`Failed to fetch AI teammate tasks: ${error.message}`);
  }

  if (!data?.data) {
    console.warn("No data returned from AI teammate tasks fetch");
    return [];
  }

  return data.data as AgentTasksResult[];
}

/**
 * Transform raw Asana data into AgentActivityData
 */
export function transformToAgentActivityData(results: AgentTasksResult[]): AgentActivityData[] {
  return AI_TEAMMATES.map((teammate) => {
    const result = results.find(r => r.agentName === teammate.name);
    
    if (!result || result.tasks.length === 0) {
      return {
        name: teammate.name,
        role: teammate.role,
        color: teammate.color,
        gid: teammate.gid,
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
        subtasksCreated: result?.subtasksCreated || 0,
        subtasksCompleted: result?.subtasksCompleted || 0,
        projectsImpacted: result?.projectsImpacted || [],
        portfoliosImpacted: [],
        recentActivity: [],
      };
    }

    const { tasks, stories, subtasksCreated, subtasksCompleted, projectsImpacted } = result;
    
    // Count tasks
    const ticketsAssigned = tasks.length;
    const ticketsCompleted = tasks.filter(t => t.completed).length;
    const ticketsOpen = ticketsAssigned - ticketsCompleted;
    const completionRate = ticketsAssigned > 0 ? (ticketsCompleted / ticketsAssigned) * 100 : 0;

    // Calculate average completion time
    let totalCompletionDays = 0;
    let completionCount = 0;
    tasks.forEach(task => {
      if (task.completed && task.completed_at) {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0 && days < 365) { // Sanity check
          totalCompletionDays += days;
          completionCount++;
        }
      }
    });
    const avgCompletionDays = completionCount > 0 ? totalCompletionDays / completionCount : 0;

    // Count comments and words
    const commentStories = stories.filter(s => s.resource_subtype === 'comment_added');
    const commentsWritten = commentStories.length;
    const wordsWritten = commentStories.reduce((sum, s) => {
      return sum + (s.text?.split(/\s+/).filter(Boolean).length || 0);
    }, 0);

    // Build recent activity
    const recentActivity: AgentActivityEvent[] = [];
    
    // Add task events
    tasks.slice(0, 20).forEach(task => {
      if (task.completed && task.completed_at) {
        recentActivity.push({
          ticketId: task.gid,
          ticketName: task.name,
          action: "completed",
          timestamp: task.completed_at,
          projectName: task.projects?.[0]?.name,
        });
      }
      recentActivity.push({
        ticketId: task.gid,
        ticketName: task.name,
        action: "assigned",
        timestamp: task.created_at,
        projectName: task.projects?.[0]?.name,
      });
    });

    // Add comment events
    commentStories.slice(0, 10).forEach(story => {
      recentActivity.push({
        ticketId: story.gid,
        ticketName: "Comment",
        action: "commented",
        timestamp: story.created_at,
      });
    });

    // Sort by timestamp descending
    recentActivity.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Estimate time saved (5 min per task, 2 min per comment)
    const totalTimeSavedMinutes = (ticketsCompleted * 5) + (commentsWritten * 2) + (subtasksCompleted * 3);

    return {
      name: teammate.name,
      role: teammate.role,
      color: teammate.color,
      gid: teammate.gid,
      ticketsAssigned,
      ticketsCompleted,
      ticketsOpen,
      completionRate,
      avgResponseTimeHours: 0, // Would need first response data
      avgCompletionDays,
      totalTimeSavedMinutes,
      automatedTickets: ticketsCompleted,
      commentsWritten,
      wordsWritten,
      subtasksCreated,
      subtasksCompleted,
      projectsImpacted,
      portfoliosImpacted: [], // Would need portfolio API
      recentActivity: recentActivity.slice(0, 15),
    };
  });
}
