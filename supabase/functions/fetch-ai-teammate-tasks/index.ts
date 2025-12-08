import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI Teammate user GIDs
const AI_TEAMMATE_GIDS: Record<string, string> = {
  "Relay - Manager Agent": "1212322782186923",
  "Axis - Strategic Planner": "1212321048621068",
  "Scout - Launch Navigator": "1212321048621065",
  "Pulse - Insights & Analytics": "1212321048621057",
  "Sentry - IT Ticketing": "1212307310503059",
  "Scribe - Documentation": "1212336204907371",
};

interface AsanaTask {
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

interface AsanaStory {
  gid: string;
  created_at: string;
  created_by?: { name: string; gid: string } | null;
  resource_subtype: string;
  text?: string;
}

interface AgentTasksResult {
  agentName: string;
  agentGid: string;
  tasks: AsanaTask[];
  stories: AsanaStory[];
  subtasksCreated: number;
  subtasksCompleted: number;
  fieldsUpdated: number;
  projectsImpacted: string[];
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, { headers });
    if (response.ok) return response;
    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
      console.log(`Rate limited, waiting ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    if (i === retries - 1) return response;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceGid, agentNames, includeStories = true, completedSince } = await req.json();
    
    if (!workspaceGid) {
      return new Response(
        JSON.stringify({ error: 'workspaceGid is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ASANA_TOKEN = Deno.env.get('ASANA_ACCESS_TOKEN');
    if (!ASANA_TOKEN) {
      console.error('ASANA_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': `Bearer ${ASANA_TOKEN}`,
      'Accept': 'application/json',
    };

    // Filter to specific agents if provided, otherwise fetch all
    const agentsToFetch = agentNames?.length > 0 
      ? Object.entries(AI_TEAMMATE_GIDS).filter(([name]) => agentNames.includes(name))
      : Object.entries(AI_TEAMMATE_GIDS);

    console.log(`Fetching tasks for ${agentsToFetch.length} AI teammates`);

    const results: AgentTasksResult[] = [];

    for (const [agentName, agentGid] of agentsToFetch) {
      console.log(`Fetching tasks for ${agentName} (${agentGid})`);

      try {
        // Build query params
        let taskUrl = `https://app.asana.com/api/1.0/tasks?assignee=${agentGid}&workspace=${workspaceGid}&opt_fields=gid,name,created_at,modified_at,completed,completed_at,assignee,assignee.name,projects,projects.name,parent,parent.name,num_subtasks,custom_fields&limit=100`;
        
        if (completedSince) {
          taskUrl += `&completed_since=${completedSince}`;
        }

        // Fetch tasks assigned to this agent
        let allTasks: AsanaTask[] = [];
        let nextPage: string | null = null;

        do {
          const url = nextPage 
            ? `${taskUrl}&offset=${nextPage}`
            : taskUrl;
          
          const response = await fetchWithRetry(url, headers);
          
          if (!response.ok) {
            console.error(`Failed to fetch tasks for ${agentName}:`, await response.text());
            break;
          }

          const data = await response.json();
          allTasks = [...allTasks, ...(data.data || [])];
          nextPage = data.next_page?.offset || null;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } while (nextPage && allTasks.length < 500);

        console.log(`Found ${allTasks.length} tasks for ${agentName}`);

        // Fetch stories (comments) for tasks if requested
        let allStories: AsanaStory[] = [];
        let subtasksCreated = 0;
        let subtasksCompleted = 0;
        let fieldsUpdated = 0;

        if (includeStories && allTasks.length > 0) {
          // Limit story fetching to most recent 20 tasks to avoid timeout
          const recentTasks = allTasks
            .sort((a, b) => new Date(b.modified_at || b.created_at).getTime() - new Date(a.modified_at || a.created_at).getTime())
            .slice(0, 20);

          for (const task of recentTasks) {
            try {
              const storiesResponse = await fetchWithRetry(
                `https://app.asana.com/api/1.0/tasks/${task.gid}/stories?opt_fields=gid,created_at,created_by,created_by.name,resource_subtype,text`,
                headers
              );

              if (storiesResponse.ok) {
                const storiesData = await storiesResponse.json();
                const agentStories = (storiesData.data || []).filter(
                  (story: AsanaStory) => story.created_by?.gid === agentGid
                );
                allStories = [...allStories, ...agentStories];

                for (const story of storiesData.data || []) {
                  if (story.created_by?.gid === agentGid) {
                    if (story.resource_subtype === 'added_to_task') {
                      subtasksCreated++;
                    }
                    if (story.resource_subtype === 'marked_complete' && task.parent) {
                      subtasksCompleted++;
                    }
                    // Count field changes (enum_value_changed, custom_field_value_changed, etc.)
                    if (story.resource_subtype?.includes('field') || 
                        story.resource_subtype === 'enum_value_changed' ||
                        story.resource_subtype === 'name_changed' ||
                        story.resource_subtype === 'notes_changed' ||
                        story.resource_subtype === 'due_date_changed') {
                      fieldsUpdated++;
                    }
                  }
                }
              }

              // Delay between requests
              await new Promise(resolve => setTimeout(resolve, 150));
            } catch (err) {
              console.error(`Error fetching stories for task ${task.gid}:`, err);
            }
          }
        }

        // Count subtasks from task data
        for (const task of allTasks) {
          if (task.parent) {
            subtasksCreated++;
            if (task.completed) {
              subtasksCompleted++;
            }
          }
        }

        // Get unique projects impacted
        const projectsImpacted = [...new Set(
          allTasks
            .flatMap(t => t.projects || [])
            .map(p => p.name)
            .filter(Boolean)
        )];

        results.push({
          agentName,
          agentGid,
          tasks: allTasks,
          stories: allStories,
          subtasksCreated,
          subtasksCompleted,
          fieldsUpdated,
          projectsImpacted,
        });

      } catch (err) {
        console.error(`Error processing agent ${agentName}:`, err);
        results.push({
          agentName,
          agentGid,
          tasks: [],
          stories: [],
          subtasksCreated: 0,
          subtasksCompleted: 0,
          fieldsUpdated: 0,
          projectsImpacted: [],
        });
      }
    }

    console.log(`Completed fetching for all agents. Total tasks: ${results.reduce((sum, r) => sum + r.tasks.length, 0)}`);

    return new Response(
      JSON.stringify({ data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-ai-teammate-tasks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
