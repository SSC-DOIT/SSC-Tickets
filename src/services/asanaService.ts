import { EnhancedParsedTicket, parseEnhancedAsanaJSON } from "@/utils/enhancedDataLoader";
import { ASANA_PROJECTS } from "@/config/asanaProjects";
import { getCachedData, setCachedData, filterLast12Months } from "@/utils/dataCache";
import { validateAsanaResponse, AsanaResponse } from "@/schemas/asanaSchemas";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Story types
export interface AsanaStory {
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

export interface TaskStoriesResponse {
  taskGid: string;
  stories: AsanaStory[];
}

export class AsanaServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "AsanaServiceError";
  }
}

/**
 * Fetches tickets from Asana via Supabase Edge Function
 * @param projectGid - Asana project GID
 * @param retryCount - Number of retry attempts (default: 3)
 * @returns Validated Asana response data
 */
async function fetchAsanaTicketsWithRetry(
  projectGid: string,
  retryCount: number = 3
): Promise<AsanaResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/fetch-asana-tickets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectGid }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AsanaServiceError(
          `Failed to fetch Asana data: ${errorData.error || response.statusText}`,
          response.status
        );
      }

      const data = await response.json();

      // Validate response with Zod schema
      const validatedData = validateAsanaResponse(data) as AsanaResponse;

      return validatedData;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors or 4xx errors
      if (
        error instanceof AsanaServiceError &&
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retryCount - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new AsanaServiceError(
    `Failed to fetch Asana data after ${retryCount} attempts`,
    undefined,
    lastError
  );
}

/**
 * Fetches and parses tickets from a single Asana project
 */
async function fetchProjectTickets(
  projectGid: string
): Promise<EnhancedParsedTicket[]> {
  const response = await fetchAsanaTicketsWithRetry(projectGid);
  // Type assertion safe after Zod validation
  return parseEnhancedAsanaJSON(response as any);
}

/**
 * Fetches tickets from main board and optionally archive
 * @param board - Board identifier (TIE or SFDC)
 * @param includeArchive - Whether to fetch archive data
 * @returns Array of enhanced parsed tickets
 */
export async function fetchBoardTickets(
  board: "TIE" | "SFDC",
  includeArchive: boolean = true
): Promise<EnhancedParsedTicket[]> {
  const projectGid = ASANA_PROJECTS[board];
  const archiveGid = ASANA_PROJECTS[`${board}_ARCHIVE` as keyof typeof ASANA_PROJECTS];

  if (!projectGid || projectGid.includes("YOUR_")) {
    throw new AsanaServiceError(
      `Please configure the ${board} project GID in src/config/asanaProjects.ts`
    );
  }

  // Fetch main board data
  let allTickets = await fetchProjectTickets(projectGid);

  // Fetch archive data if requested and configured
  if (includeArchive && archiveGid && !archiveGid.includes("YOUR_")) {
    try {
      const archiveTickets = await fetchProjectTickets(archiveGid);
      allTickets = [...allTickets, ...archiveTickets];
    } catch (error) {
      console.warn(`Could not fetch archive data for ${board}:`, error);
      // Continue with main board data only
    }
  }

  return allTickets;
}

/**
 * Fetches board tickets with 5-minute caching
 * @param board - Board identifier (TIE or SFDC)
 * @param includeArchive - Whether to fetch archive data
 * @returns Filtered array of tickets (last 12 months)
 */
export async function loadBoardData(
  board: "TIE" | "SFDC",
  includeArchive: boolean = true
): Promise<EnhancedParsedTicket[]> {
  const cacheKey = `asana-data-${board}-${includeArchive ? "with" : "without"}-archive`;

  // Try to get cached data first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log(`Using cached data for ${board}`);
    return filterLast12Months(cachedData);
  }

  // Fetch fresh data
  console.log(`Fetching fresh data for ${board}`);
  const freshData = await fetchBoardTickets(board, includeArchive);

  // Cache the fresh data
  setCachedData(cacheKey, freshData);

  // Return filtered data (last 12 months)
  return filterLast12Months(freshData);
}

/**
 * Clears cache for a specific board or all boards
 */
export function clearBoardCache(board?: "TIE" | "SFDC"): void {
  if (board) {
    localStorage.removeItem(`asana-data-${board}-with-archive`);
    localStorage.removeItem(`asana-data-${board}-without-archive`);
  } else {
    // Clear all asana data caches
    Object.keys(localStorage)
      .filter((key) => key.startsWith("asana-data-"))
      .forEach((key) => localStorage.removeItem(key));
  }
}

/**
 * Fetches stories (comments) for specified task GIDs
 * @param taskGids - Array of Asana task GIDs
 * @returns Array of task stories responses
 */
export async function fetchTaskStories(
  taskGids: string[]
): Promise<TaskStoriesResponse[]> {
  if (taskGids.length === 0) return [];

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/fetch-task-stories`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskGids }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AsanaServiceError(
        `Failed to fetch stories: ${errorData.error || response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching task stories:", error);
    return [];
  }
}
