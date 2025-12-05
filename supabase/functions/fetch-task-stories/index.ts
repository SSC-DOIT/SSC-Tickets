import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AsanaStory {
  gid: string;
  created_at: string;
  created_by: {
    gid: string;
    name: string;
  } | null;
  resource_subtype: string;
  text: string;
  type: string;
}

interface StoryResponse {
  taskGid: string;
  stories: AsanaStory[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskGids } = await req.json();
    
    if (!taskGids || !Array.isArray(taskGids) || taskGids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'taskGids array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ASANA_TOKEN = Deno.env.get('ASANA_ACCESS_TOKEN');
    if (!ASANA_TOKEN) {
      console.error('ASANA_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Limit to 50 tasks per request to avoid timeout
    const limitedTaskGids = taskGids.slice(0, 50);
    console.log(`Fetching stories for ${limitedTaskGids.length} tasks`);

    const results: StoryResponse[] = [];

    // Fetch stories for each task (with rate limiting)
    for (const taskGid of limitedTaskGids) {
      try {
        const response = await fetch(
          `https://app.asana.com/api/1.0/tasks/${taskGid}/stories?opt_fields=gid,created_at,created_by,created_by.name,resource_subtype,text,type`,
          {
            headers: {
              'Authorization': `Bearer ${ASANA_TOKEN}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch stories for task ${taskGid}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        // Filter to only include comments (not system stories)
        const comments = (data.data || []).filter(
          (story: AsanaStory) => story.resource_subtype === 'comment_added'
        );

        results.push({
          taskGid,
          stories: comments,
        });

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(`Error fetching stories for task ${taskGid}:`, error);
      }
    }

    console.log(`Successfully fetched stories for ${results.length} tasks`);

    return new Response(
      JSON.stringify({ data: results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in fetch-task-stories:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
