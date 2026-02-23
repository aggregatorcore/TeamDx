/**
 * Countdown and Overdue Utilities
 * 
 * Single source of truth for:
 * - Countdown text formatting (e.g., "Due in 2h 30m", "Overdue by 1h 15m")
 * - Overdue age calculation (hours since callbackAt passed)
 */

/**
 * Get formatted countdown text for a callback time
 * @param callbackAt - ISO string or Date object for callback time
 * @param options.includeSeconds - If true, include seconds so the text ticks every second (useful for overdue)
 * @returns Formatted string like "Due in 2h 30m" or "Overdue by 1h 15m 30s"
 */
export function getCountdownText(
  callbackAt: string | Date | null | undefined,
  options?: { includeSeconds?: boolean }
): string {
  if (!callbackAt) return "";

  const callbackTime = new Date(callbackAt);
  const now = new Date();
  
  if (isNaN(callbackTime.getTime())) return "";

  const diff = callbackTime.getTime() - now.getTime();
  const includeSeconds = options?.includeSeconds ?? false;

  if (diff <= 0) {
    const overdueMs = Math.abs(diff);
    const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
    const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
    const overdueSeconds = Math.floor((overdueMs % (1000 * 60)) / 1000);
    
    if (overdueHours > 0) {
      return includeSeconds
        ? `Overdue by ${overdueHours}h ${overdueMinutes}m ${overdueSeconds}s`
        : `Overdue by ${overdueHours}h ${overdueMinutes}m`;
    }
    if (overdueMinutes > 0) {
      return includeSeconds
        ? `Overdue by ${overdueMinutes}m ${overdueSeconds}s`
        : `Overdue by ${overdueMinutes}m`;
    }
    return includeSeconds ? `Overdue by ${overdueSeconds}s` : `Overdue by ${overdueSeconds}s`;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return includeSeconds
      ? `Due in ${hours}h ${minutes}m ${seconds}s`
      : `Due in ${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return includeSeconds ? `Due in ${minutes}m ${seconds}s` : `Due in ${minutes}m`;
  }
  return includeSeconds ? `Due in ${seconds}s` : (diff >= 60000 ? "Due in 1m" : "Due in <1m");
}

/**
 * Get overdue age in hours
 * 
 * @param callbackAt - ISO string or Date object for callback time
 * @returns Number of hours overdue (0 if not overdue or invalid)
 */
export function getOverdueAge(callbackAt: string | Date | null | undefined): number {
  if (!callbackAt) return 0;

  const callbackTime = new Date(callbackAt);
  const now = new Date();
  
  // Validate date
  if (isNaN(callbackTime.getTime())) {
    return 0;
  }

  const diff = callbackTime.getTime() - now.getTime();
  
  // If not overdue, return 0
  if (diff > 0) {
    return 0;
  }

  // Calculate overdue hours
  const overdueMs = Math.abs(diff);
  const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
  
  return overdueHours;
}

/**
 * Get overdue age in minutes
 * 
 * @param callbackAt - ISO string or Date object for callback time
 * @returns Number of minutes overdue (0 if not overdue or invalid)
 */
export function getOverdueAgeMinutes(callbackAt: string | Date | null | undefined): number {
  if (!callbackAt) return 0;

  const callbackTime = new Date(callbackAt);
  const now = new Date();
  
  // Validate date
  if (isNaN(callbackTime.getTime())) {
    return 0;
  }

  const diff = callbackTime.getTime() - now.getTime();
  
  // If not overdue, return 0
  if (diff > 0) {
    return 0;
  }

  // Calculate overdue minutes
  const overdueMs = Math.abs(diff);
  const overdueMinutes = Math.floor(overdueMs / (1000 * 60));
  
  return overdueMinutes;
}

/**
 * Check if callback is overdue
 * 
 * @param callbackAt - ISO string or Date object for callback time
 * @returns true if callbackAt is in the past
 */
export function isOverdue(callbackAt: string | Date | null | undefined): boolean {
  if (!callbackAt) return false;

  const callbackTime = new Date(callbackAt);
  const now = new Date();
  
  // Validate date
  if (isNaN(callbackTime.getTime())) {
    return false;
  }

  return callbackTime.getTime() <= now.getTime();
}
