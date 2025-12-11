import { ParsedTicket } from "./asanaJsonParser";
import { calculateBusinessHours } from "./businessHours";

interface AsanaTask {
  gid: string;
  created_at: string;
  modified_at?: string;
  completed_at?: string | null;
  name?: string;
  notes?: string;
  assignee?: {
    name: string;
    gid: string;
  } | null;
  custom_fields?: any[];
  memberships?: Array<{
    project: {
      gid: string;
      name: string;
    };
    section?: {
      gid: string;
      name: string;
    };
  }>;
}

interface AsanaResponse {
  data: AsanaTask[];
}

export interface EnhancedParsedTicket extends ParsedTicket {
  automationStage: string | null;
  ticketAge: number;
  isOpen: boolean;
  summary?: string;
  customFields?: {
    Priority?: string;
    Status?: string;
    Effort?: number;
    Category?: string;
    "TIE Request Detail"?: string;
    "Work Type"?: string;
    Department?: string;
    Section?: string;
  };
  // Dual response time fields (populated from story data)
  firstAIResponseAt?: string | null;
  firstAIResponseMinutes?: number | null;
  firstHumanResponseAt?: string | null;
  firstHumanResponseMinutes?: number | null;
}

const calculateResponseTime = (createdAt: string, modifiedAt?: string): number | null => {
  if (!createdAt || !modifiedAt) return null;
  
  // Use business hours calculation
  return calculateBusinessHours(createdAt, modifiedAt);
};

const calculateTicketAge = (createdAt: string, completedAt?: string | null): number => {
  const created = new Date(createdAt);
  const reference = completedAt ? new Date(completedAt) : new Date();
  
  if (isNaN(created.getTime())) return 0;
  
  const diffMs = reference.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays >= 0 ? diffDays : 0;
};

export const parseEnhancedAsanaJSON = (jsonData: AsanaResponse): EnhancedParsedTicket[] => {
  const tickets: EnhancedParsedTicket[] = [];
  
  jsonData.data.forEach((task) => {
    if (!task.created_at) return;
    
    const responseTime = calculateResponseTime(task.created_at, task.modified_at);
    const ticketAge = calculateTicketAge(task.created_at, task.completed_at);
    const isOpen = !task.completed_at;
    
    // Extract fields from custom fields - optimized single-pass loop
    let automationStage: string | null = null;
    let priority: string | undefined;
    let status: string | undefined;
    let effort: number | undefined;
    let category: string | undefined;
    let tieRequestDetail: string | undefined;
    let workType: string | undefined;
    let department: string | undefined;
    let taskSummary: string | undefined;

    if (task.custom_fields) {
      // Single pass through custom fields (8x faster than multiple find() calls)
      task.custom_fields.forEach((field: any) => {
        switch (field.name) {
          case "Virtual Assistant":
            automationStage = field.enum_value?.name || null;
            break;
          case "TS Prioritization":
            priority = field.enum_value?.name;
            break;
          case "TS-Status":
            status = field.enum_value?.name;
            break;
          case "Effort":
            effort = field.number_value;
            break;
          case "Category":
            category = field.enum_value?.name;
            break;
          case "TIE Request Detail":
            tieRequestDetail = field.enum_value?.name;
            break;
          case "Work Type":
            workType = field.enum_value?.name;
            break;
          case "Department":
            department = field.enum_value?.name;
            break;
          case "Task summary":
            taskSummary = field.text_value;
            break;
        }
      });
    }
    
    // Extract section from memberships
    let section: string | undefined;
    if (task.memberships && task.memberships.length > 0) {
      // Use the first membership's section (usually the primary project)
      section = task.memberships[0].section?.name;
    }
    
    tickets.push({
      id: task.gid,
      name: task.name || "Untitled Task",
      createdAt: task.created_at,
      modifiedAt: task.modified_at || task.created_at,
      completedAt: task.completed_at || null,
      assignee: task.assignee?.name || "Unassigned",
      responseTimeHours: responseTime,
      automationStage,
      ticketAge,
      isOpen,
      summary: taskSummary,
      customFields: {
        Priority: priority,
        Status: status,
        Effort: effort,
        Category: category,
        "TIE Request Detail": tieRequestDetail,
        "Work Type": workType,
        Department: department,
        Section: section,
      },
    });
  });
  
  return tickets;
};

const loadTIEData = async () => {
  const [
    jan, feb, mar, apr, may, jun, jul, aug, sep, oct
  ] = await Promise.all([
    import("@/data/tie-2025-01.json"),
    import("@/data/tie-2025-02.json"),
    import("@/data/tie-2025-03.json"),
    import("@/data/tie-2025-04.json"),
    import("@/data/tie-2025-05.json"),
    import("@/data/tie-2025-06.json"),
    import("@/data/tie-2025-07.json"),
    import("@/data/tie-2025-08.json"),
    import("@/data/tie-2025-09.json"),
    import("@/data/tie-2025-10.json"),
  ]);
  
  return [jan, feb, mar, apr, may, jun, jul, aug, sep, oct];
};

const loadSFDCData = async () => {
  const [
    jan, feb, mar, apr, may, jun, jul, aug, sep, oct
  ] = await Promise.all([
    import("@/data/sfdc-2025-01.json"),
    import("@/data/sfdc-2025-02.json"),
    import("@/data/sfdc-2025-03.json"),
    import("@/data/sfdc-2025-04.json"),
    import("@/data/sfdc-2025-05.json"),
    import("@/data/sfdc-2025-06.json"),
    import("@/data/sfdc-2025-07.json"),
    import("@/data/sfdc-2025-08.json"),
    import("@/data/sfdc-2025-09.json"),
    import("@/data/sfdc-2025-10.json"),
  ]);
  
  return [jan, feb, mar, apr, may, jun, jul, aug, sep, oct];
};

export const loadEnhancedData = async (
  board: "TIE" | "SFDC",
  includeArchive: boolean = false
): Promise<EnhancedParsedTicket[]> => {
  const dataFiles = board === "TIE" ? await loadTIEData() : await loadSFDCData();
  
  const allTickets: EnhancedParsedTicket[] = [];
  
  dataFiles.forEach((file) => {
    const parsed = parseEnhancedAsanaJSON(file.default || file);
    allTickets.push(...parsed);
  });
  
  return allTickets;
};
