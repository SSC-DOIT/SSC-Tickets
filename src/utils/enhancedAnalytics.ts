import { ParsedTicket } from "./asanaJsonParser";
import { EnhancedParsedTicket } from "./enhancedDataLoader";
import { AutomationSavingsData, AutomationAnalytics } from "@/types/analytics";

export interface TicketAgeData {
  date: string;
  openAvg: number;
  closedAvg: number;
}

export interface NetNewTicketData {
  date: string;
  created: number;
  closed: number;
  netChange: number;
}

export interface FirstResponseTrendData {
  date: string;
  avgResponseHours: number;
  count: number;
}

export interface DualResponseTrendData {
  date: string;
  week: string;
  avgAIResponseMinutes: number | null;
  avgHumanResponseMinutes: number | null;
  aiTicketCount: number;
  humanTicketCount: number;
}

export interface OpenTicketTrendData {
  date: string;
  openCount: number;
}

/**
 * Automation time estimates (in minutes) based on realistic manual effort
 * These represent the time saved PER TICKET when each automation rule runs
 */
const AUTOMATION_TIME_ESTIMATES = {
  "R1 - Triage +": 5, // Manual triage: reading, categorizing, initial assessment
  "R2 - Classification +": 3, // Manual classification: determining ticket type
  "R3 - Description +": 8, // Writing detailed descriptions: formatting, clarifying
  "R4 - Prioritization +": 4, // Manual priority assessment: evaluating urgency/impact
  "R5 - Validation +": 6, // Manual validation: checking requirements, verifying data
  "R6 - Communication +": 10, // Drafting and sending communication: writing, reviewing, sending
};

export const calculateTicketAge = (createdAt: string, referenceDate?: string): number => {
  const created = new Date(createdAt);
  const reference = referenceDate ? new Date(referenceDate) : new Date();
  
  if (isNaN(created.getTime()) || isNaN(reference.getTime())) return 0;
  
  const diffMs = reference.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays >= 0 ? diffDays : 0;
};

export const analyzeNetNewTickets = (tickets: ParsedTicket[], daysBack: number = 365): NetNewTicketData[] => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const dailyData: { [key: string]: { created: number; closed: number } } = {};
  
  // Count tickets created per day
  tickets.forEach((ticket) => {
    const created = new Date(ticket.createdAt);
    if (isNaN(created.getTime()) || created < startDate) return;
    
    const createdDateKey = created.toISOString().split("T")[0];
    if (!dailyData[createdDateKey]) {
      dailyData[createdDateKey] = { created: 0, closed: 0 };
    }
    dailyData[createdDateKey].created += 1;
    
    // Count tickets closed per day
    if (ticket.completedAt) {
      const completed = new Date(ticket.completedAt);
      if (!isNaN(completed.getTime()) && completed >= startDate) {
        const closedDateKey = completed.toISOString().split("T")[0];
        if (!dailyData[closedDateKey]) {
          dailyData[closedDateKey] = { created: 0, closed: 0 };
        }
        dailyData[closedDateKey].closed += 1;
      }
    }
  });
  
  // Fill in missing dates with zero values
  const dates: string[] = [];
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateKey = new Date(d).toISOString().split("T")[0];
    dates.push(dateKey);
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = { created: 0, closed: 0 };
    }
  }
  
  return dates
    .sort()
    .map((date) => {
      const data = dailyData[date];
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        created: data.created,
        closed: data.closed,
        netChange: data.created - data.closed,
      };
    });
};

export const analyzeTicketAgeTrends = (tickets: ParsedTicket[], daysBack: number = 365): TicketAgeData[] => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  // Group tickets by day
  const dailyData: { [key: string]: { openAges: number[]; closedAges: number[] } } = {};
  
  tickets.forEach((ticket) => {
    const created = new Date(ticket.createdAt);
    if (isNaN(created.getTime()) || created < startDate) return;
    
    const dateKey = created.toISOString().split("T")[0];
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = { openAges: [], closedAges: [] };
    }
    
    const isOpen = !ticket.completedAt;
    const age = calculateTicketAge(
      ticket.createdAt,
      isOpen ? undefined : ticket.completedAt || undefined
    );
    
    if (isOpen) {
      dailyData[dateKey].openAges.push(age);
    } else {
      dailyData[dateKey].closedAges.push(age);
    }
  });
  
  // Calculate averages
  return Object.keys(dailyData)
    .sort()
    .map((date) => {
      const data = dailyData[date];
      const openAvg = data.openAges.length > 0
        ? data.openAges.reduce((sum, age) => sum + age, 0) / data.openAges.length
        : 0;
      const closedAvg = data.closedAges.length > 0
        ? data.closedAges.reduce((sum, age) => sum + age, 0) / data.closedAges.length
        : 0;
      
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        openAvg: Number(openAvg.toFixed(2)),
        closedAvg: Number(closedAvg.toFixed(2)),
      };
    });
};

export const analyzeFirstResponseTrends = (tickets: ParsedTicket[], daysBack: number = 365): FirstResponseTrendData[] => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const weeklyData: { [key: string]: { total: number; count: number } } = {};
  
  tickets.forEach((ticket) => {
    const created = new Date(ticket.createdAt);
    if (isNaN(created.getTime()) || created < startDate) return;
    if (!ticket.responseTimeHours || ticket.responseTimeHours <= 0) return;
    
    // Group by week for smoother trends
    const weekStart = new Date(created);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { total: 0, count: 0 };
    }
    
    weeklyData[weekKey].total += ticket.responseTimeHours;
    weeklyData[weekKey].count += 1;
  });
  
  return Object.keys(weeklyData)
    .sort()
    .map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      avgResponseHours: Number((weeklyData[date].total / weeklyData[date].count).toFixed(2)),
      count: weeklyData[date].count,
    }));
};

export const analyzeOpenTicketTrends = (tickets: ParsedTicket[], daysBack: number = 365): OpenTicketTrendData[] => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const dailyOpenCounts: { [key: string]: number } = {};
  
  // For each day, count how many tickets were open on that day
  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    const dateKey = new Date(d).toISOString().split("T")[0];
    dailyOpenCounts[dateKey] = 0;
    
    tickets.forEach((ticket) => {
      const created = new Date(ticket.createdAt);
      const completed = ticket.completedAt ? new Date(ticket.completedAt) : null;
      
      // Ticket is open on this day if created before/on this day and not completed, or completed after this day
      if (created <= d && (!completed || completed > d)) {
        dailyOpenCounts[dateKey]++;
      }
    });
  }
  
  return Object.keys(dailyOpenCounts)
    .sort()
    .map((date) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      openCount: dailyOpenCounts[date],
    }));
};

export const getLastThursday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 4 = Thursday
  const daysToSubtract = dayOfWeek >= 4 ? dayOfWeek - 4 : dayOfWeek + 3;
  const lastThursday = new Date(today);
  lastThursday.setDate(today.getDate() - daysToSubtract);
  lastThursday.setHours(0, 0, 0, 0);
  return lastThursday;
};

export const getJulyFirst = (): Date => {
  return new Date("2025-07-01T00:00:00");
};

/**
 * Comprehensive automation analytics with per-ticket savings and forecasting
 * Calculates time saved per ticket based on automation rules that ran on it
 */
export const analyzeAutomationAnalytics = (
  tickets: EnhancedParsedTicket[]
): AutomationAnalytics => {
  // Separate automated vs manual tickets
  const automatedTickets = tickets.filter((t) => t.automationStage);
  const manualTickets = tickets.filter((t) => !t.automationStage);

  // Count tickets by automation stage
  const stageCounts: { [stage: string]: number } = {};
  let totalMinutesSaved = 0;

  automatedTickets.forEach((ticket) => {
    const stage = ticket.automationStage!;
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    // Add time saved for this ticket based on its automation stage
    const minutesPerTicket =
      AUTOMATION_TIME_ESTIMATES[stage as keyof typeof AUTOMATION_TIME_ESTIMATES] || 0;
    totalMinutesSaved += minutesPerTicket;
  });

  // Build breakdown by stage
  const byStage: AutomationSavingsData[] = Object.entries(stageCounts).map(
    ([stage, count]) => {
      const minutesPerTicket =
        AUTOMATION_TIME_ESTIMATES[stage as keyof typeof AUTOMATION_TIME_ESTIMATES] || 0;
      const totalMinutes = count * minutesPerTicket;

      return {
        stage,
        count,
        minutesPerTicket,
        totalMinutesSaved: totalMinutes,
        totalHoursSaved: Number((totalMinutes / 60).toFixed(2)),
      };
    }
  );

  byStage.sort((a, b) => b.totalMinutesSaved - a.totalMinutesSaved);

  // Calculate per-ticket averages
  const averageTimeSavedPerTicket =
    automatedTickets.length > 0
      ? Number((totalMinutesSaved / automatedTickets.length).toFixed(2))
      : 0;

  const averageAutomationRulesPerTicket =
    automatedTickets.length > 0 ? Number((automatedTickets.length / automatedTickets.length).toFixed(2)) : 0;

  // Response time comparison (business hours)
  const automatedWithResponse = automatedTickets.filter((t) => t.responseTimeHours && t.responseTimeHours > 0);
  const manualWithResponse = manualTickets.filter((t) => t.responseTimeHours && t.responseTimeHours > 0);

  const automatedTicketsAvgResponse =
    automatedWithResponse.length > 0
      ? Number(
          (
            automatedWithResponse.reduce((sum, t) => sum + t.responseTimeHours!, 0) /
            automatedWithResponse.length
          ).toFixed(2)
        )
      : 0;

  const manualTicketsAvgResponse =
    manualWithResponse.length > 0
      ? Number(
          (
            manualWithResponse.reduce((sum, t) => sum + t.responseTimeHours!, 0) /
            manualWithResponse.length
          ).toFixed(2)
        )
      : 0;

  const responseTimeImprovement =
    manualTicketsAvgResponse > 0
      ? Number(
          (((manualTicketsAvgResponse - automatedTicketsAvgResponse) / manualTicketsAvgResponse) * 100).toFixed(1)
        )
      : 0;

  // Calculate ticket rate (using last 90 days, business days only)
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentTickets = tickets.filter((t) => new Date(t.createdAt) >= ninetyDaysAgo);

  // Count business days in the period (exclude weekends)
  let businessDays = 0;
  for (let d = new Date(ninetyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      businessDays++;
    }
  }
  
  const ticketsPerBusinessDay = recentTickets.length / businessDays;
  const ticketsPerWeek = ticketsPerBusinessDay * 5; // 5 business days per week
  const ticketsPerMonth = ticketsPerBusinessDay * 22; // ~22 business days per month
  const ticketsPerYear = ticketsPerBusinessDay * 260; // ~260 business days per year

  // Forecast savings assuming all tickets are automated going forward
  const minutesSavedPerDay = ticketsPerBusinessDay * averageTimeSavedPerTicket;
  const monthlyForecastMinutes = ticketsPerMonth * averageTimeSavedPerTicket;
  const yearlyForecastMinutes = ticketsPerYear * averageTimeSavedPerTicket;

  // Current month savings (from start of month to now)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthTickets = automatedTickets.filter((t) => new Date(t.createdAt) >= startOfMonth);
  const currentMonthMinutes = currentMonthTickets.reduce((sum, ticket) => {
    const stage = ticket.automationStage!;
    const minutes = AUTOMATION_TIME_ESTIMATES[stage as keyof typeof AUTOMATION_TIME_ESTIMATES] || 0;
    return sum + minutes;
  }, 0);

  const projections = {
    currentMonthSavings: Number((currentMonthMinutes / 60).toFixed(2)),
    monthlyForecast: Number((monthlyForecastMinutes / 60).toFixed(2)),
    yearlyForecast: Number((yearlyForecastMinutes / 60).toFixed(2)),
    monthlyForecastDays: Number((monthlyForecastMinutes / 60 / 8).toFixed(2)),
    yearlyForecastDays: Number((yearlyForecastMinutes / 60 / 8).toFixed(2)),
  };

  const totalTimeSavedHours = Number((totalMinutesSaved / 60).toFixed(2));
  const totalTimeSavedDays = Number((totalTimeSavedHours / 8).toFixed(2));

  return {
    averageTimeSavedPerTicket,
    averageAutomationRulesPerTicket,
    automatedTicketsAvgResponse,
    manualTicketsAvgResponse,
    responseTimeImprovement,
    ticketRate: {
      perDay: Number(ticketsPerBusinessDay.toFixed(2)),
      perWeek: Number(ticketsPerWeek.toFixed(2)),
      perMonth: Number(ticketsPerMonth.toFixed(2)),
    },
    projections,
    byStage,
    totalAutomatedTickets: automatedTickets.length,
    totalManualTickets: manualTickets.length,
    totalTimeSavedHours,
    totalTimeSavedDays,
  };
};

// Legacy function for backward compatibility
export const analyzeAutomationSavings = (
  automationStages: { [ticketId: string]: string }
): AutomationSavingsData[] => {
  const stageCounts: { [stage: string]: number } = {};

  Object.values(automationStages).forEach((stage) => {
    if (stage && stage.startsWith("R")) {
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }
  });

  const results: AutomationSavingsData[] = [];

  Object.entries(stageCounts).forEach(([stage, count]) => {
    const minutesPerTicket =
      AUTOMATION_TIME_ESTIMATES[stage as keyof typeof AUTOMATION_TIME_ESTIMATES] || 0;
    const totalMinutes = count * minutesPerTicket;

    results.push({
      stage,
      count,
      minutesPerTicket,
      totalMinutesSaved: totalMinutes,
      totalHoursSaved: Number((totalMinutes / 60).toFixed(2)),
    });
  });

  return results.sort((a, b) => b.totalMinutesSaved - a.totalMinutesSaved);
};
