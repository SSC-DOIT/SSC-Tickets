// Business hours calculator that excludes weekends and holidays
// Uses fixed Arizona time (MST, UTC-7) with no DST adjustments

export const US_HOLIDAYS_2025 = [
  new Date("2025-01-01"), // New Year's Day
  new Date("2025-01-20"), // MLK Day
  new Date("2025-02-17"), // Presidents Day
  new Date("2025-05-26"), // Memorial Day
  new Date("2025-07-04"), // Independence Day
  new Date("2025-09-01"), // Labor Day
  new Date("2025-10-13"), // Columbus Day
  new Date("2025-11-11"), // Veterans Day
  new Date("2025-11-27"), // Thanksgiving
  new Date("2025-12-25"), // Christmas
];

// Business hours in MST (Arizona time)
const BUSINESS_HOURS_START = 6.5; // 6:30am MST
const BUSINESS_HOURS_END = 15; // 3:00pm MST
const BUSINESS_MINUTES_PER_DAY = (BUSINESS_HOURS_END - BUSINESS_HOURS_START) * 60; // 510 minutes
const MST_OFFSET = -7; // UTC-7 (no DST in Arizona)

// Legacy constants for backward compatibility
const BUSINESS_HOURS_PER_DAY = BUSINESS_HOURS_END - BUSINESS_HOURS_START;

/**
 * Convert a UTC date to MST (Arizona time)
 */
const toMST = (date: Date): Date => {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + MST_OFFSET * 60 * 60 * 1000);
};

/**
 * Get decimal hours from a date (e.g., 6:30am = 6.5)
 */
const getDecimalHours = (date: Date): number => {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
};

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

export const isHoliday = (date: Date): boolean => {
  const dateStr = date.toISOString().split("T")[0];
  return US_HOLIDAYS_2025.some(
    (holiday) => holiday.toISOString().split("T")[0] === dateStr
  );
};

export const isBusinessDay = (date: Date): boolean => {
  return !isWeekend(date) && !isHoliday(date);
};

/**
 * Get the next business day start time from a given date
 */
const getNextBusinessDayStart = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(Math.floor(BUSINESS_HOURS_START), (BUSINESS_HOURS_START % 1) * 60, 0, 0);
  
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
};

/**
 * Calculate business minutes between two dates
 * Only counts 6:30am-3pm MST, Monday-Friday, excluding US holidays
 * Returns minutes (not hours)
 */
export const calculateBusinessMinutes = (
  startDate: string | Date,
  endDate: string | Date
): number | null => {
  const startUtc = typeof startDate === "string" ? new Date(startDate) : new Date(startDate);
  const endUtc = typeof endDate === "string" ? new Date(endDate) : new Date(endDate);

  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) return null;
  if (endUtc <= startUtc) return 0;

  // Convert to MST
  let start = toMST(startUtc);
  let end = toMST(endUtc);

  let totalMinutes = 0;

  // Process day by day
  while (start < end) {
    const startHours = getDecimalHours(start);
    
    // Get today's business window
    const dayStart = new Date(start);
    dayStart.setHours(Math.floor(BUSINESS_HOURS_START), (BUSINESS_HOURS_START % 1) * 60, 0, 0);
    
    const dayEnd = new Date(start);
    dayEnd.setHours(Math.floor(BUSINESS_HOURS_END), (BUSINESS_HOURS_END % 1) * 60, 0, 0);

    if (isBusinessDay(start)) {
      // Determine effective start time for this day
      let effectiveStart: Date;
      if (startHours < BUSINESS_HOURS_START) {
        // Before business hours - use business start
        effectiveStart = dayStart;
      } else if (startHours >= BUSINESS_HOURS_END) {
        // After business hours - no minutes this day, move to next
        start = getNextBusinessDayStart(start);
        continue;
      } else {
        // During business hours - use current time
        effectiveStart = start;
      }

      // Determine effective end time for this day
      let effectiveEnd: Date;
      if (end <= dayEnd) {
        // Response is today
        const endHours = getDecimalHours(end);
        if (endHours < BUSINESS_HOURS_START) {
          // Response before business hours - no minutes counted
          break;
        } else if (endHours >= BUSINESS_HOURS_END) {
          // Response after hours - cap at business end
          effectiveEnd = dayEnd;
        } else {
          // Response during business hours
          effectiveEnd = end;
        }
      } else {
        // Response is on a future day - use full remaining business hours
        effectiveEnd = dayEnd;
      }

      // Calculate minutes for this day
      if (effectiveStart < effectiveEnd) {
        const minutesThisDay = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
        totalMinutes += minutesThisDay;
      }
    }

    // Move to next day's business start
    start = getNextBusinessDayStart(start);
  }

  return totalMinutes >= 0 ? Math.round(totalMinutes) : null;
};

/**
 * Calculate business hours between two dates (legacy function)
 * Only counts 6:30am-3pm MST, Monday-Friday, excluding holidays
 * @deprecated Use calculateBusinessMinutes for more precision
 */
export const calculateBusinessHours = (
  startDate: string | Date,
  endDate: string | Date
): number | null => {
  const minutes = calculateBusinessMinutes(startDate, endDate);
  if (minutes === null) return null;
  return minutes / 60;
};
