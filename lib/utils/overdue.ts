/**
 * OVERDUE FUNCTION - Full Implementation
 * 
 * PURPOSE: Handle missed callbacks (SLA breach) with reminders and escalation
 * 
 * RULES:
 * - IF now < callbackAt → ORANGE (countdown)
 * - IF now >= callbackAt → RED (overdue, timer counts up)
 * - Reminders at +15m, +60m, +24h
 * - Max 3 attempts for no_answer
 * - Reset on new tag application
 */

export interface OverdueInput {
  leadId: string;
  callbackAt: string | null | undefined;
  now: Date;
  currentTagKey?: string | null;
  attemptCount?: number;
  maxAttempts?: number;
  userRole?: string;
  isAssignedToMe?: boolean;
  workingHours?: { start: string; end: string }; // e.g., "10:00", "19:00"
}

export interface OverdueResult {
  bucket: "orange" | "red";
  isOverdue: boolean;
  timeRemaining: number; // milliseconds (negative if overdue)
  overdueDuration: number; // milliseconds (0 if not overdue)
  shouldShowPopup: boolean;
  shouldShowReminder: boolean;
  reminderType?: "first" | "second" | "escalation" | null;
  canRetry: boolean;
  requiresEscalation: boolean;
}

export interface ReminderSchedule {
  firstReminder: Date | null; // callbackAt + 15 minutes
  secondReminder: Date | null; // callbackAt + 60 minutes
  escalation: Date | null; // callbackAt + 24 hours
}

/**
 * Calculate overdue status and reminders
 */
export function calculateOverdueStatus(input: OverdueInput): OverdueResult {
  const {
    callbackAt,
    now,
    currentTagKey,
    attemptCount = 0,
    maxAttempts = 3,
    userRole,
    isAssignedToMe = false,
  } = input;

  // Default result
  const result: OverdueResult = {
    bucket: "orange",
    isOverdue: false,
    timeRemaining: 0,
    overdueDuration: 0,
    shouldShowPopup: false,
    shouldShowReminder: false,
    canRetry: true,
    requiresEscalation: false,
  };

  // No callbackAt = not in callback flow
  if (!callbackAt) {
    return result;
  }

  const callbackTime = new Date(callbackAt);
  if (isNaN(callbackTime.getTime())) {
    return result; // Invalid date
  }

  const diff = callbackTime.getTime() - now.getTime();

  // FUTURE CALLBACK → ORANGE
  if (diff > 0) {
    result.bucket = "orange";
    result.isOverdue = false;
    result.timeRemaining = diff;
    result.overdueDuration = 0;
    
    // Show popup 30 seconds before callback
    const popupTriggerTime = diff - 30000; // 30 seconds before
    result.shouldShowPopup = popupTriggerTime <= 0 && popupTriggerTime >= -5000; // 5 second grace window
    
    // Check if user should see popup (RBAC)
    if (result.shouldShowPopup) {
      result.shouldShowPopup = shouldShowPopupToUser(userRole, isAssignedToMe);
    }
    
    return result;
  }

  // PAST/OVERDUE → RED
  result.bucket = "red";
  result.isOverdue = true;
  result.timeRemaining = diff; // Negative value
  result.overdueDuration = Math.abs(diff);

  // Check reminder schedule
  const reminders = calculateReminderSchedule(callbackTime, now);
  result.shouldShowReminder = checkReminderSchedule(reminders, now);
  result.reminderType = getReminderType(reminders, now);

  // Escalation check (24 hours overdue)
  result.requiresEscalation = reminders.escalation !== null && now >= reminders.escalation;

  // Retry logic for no_answer
  if (currentTagKey === "no_answer" || currentTagKey === "no_answer_retry") {
    result.canRetry = attemptCount < maxAttempts;
  }

  // Show popup for overdue (always show until action taken)
  result.shouldShowPopup = shouldShowPopupToUser(userRole, isAssignedToMe);

  return result;
}

/**
 * Calculate reminder schedule
 */
export function calculateReminderSchedule(
  callbackAt: Date,
  now: Date
): ReminderSchedule {
  const schedule: ReminderSchedule = {
    firstReminder: null,
    secondReminder: null,
    escalation: null,
  };

  // Only calculate if overdue
  if (now < callbackAt) {
    return schedule; // Not overdue yet
  }

  // First reminder: +15 minutes
  schedule.firstReminder = new Date(callbackAt.getTime() + 15 * 60 * 1000);

  // Second reminder: +60 minutes
  schedule.secondReminder = new Date(callbackAt.getTime() + 60 * 60 * 1000);

  // Escalation: +24 hours
  schedule.escalation = new Date(callbackAt.getTime() + 24 * 60 * 60 * 1000);

  return schedule;
}

/**
 * Check if reminder should be shown now
 */
function checkReminderSchedule(schedule: ReminderSchedule, now: Date): boolean {
  if (!schedule.firstReminder) return false;

  // Check if we're at first reminder time (±2 minute window)
  if (schedule.firstReminder && now >= schedule.firstReminder) {
    const firstDiff = Math.abs(now.getTime() - schedule.firstReminder.getTime());
    if (firstDiff <= 2 * 60 * 1000) {
      return true;
    }
  }

  // Check if we're at second reminder time (±2 minute window)
  if (schedule.secondReminder && now >= schedule.secondReminder) {
    const secondDiff = Math.abs(now.getTime() - schedule.secondReminder.getTime());
    if (secondDiff <= 2 * 60 * 1000) {
      return true;
    }
  }

  // Check if we're at escalation time (±5 minute window)
  if (schedule.escalation && now >= schedule.escalation) {
    const escalationDiff = Math.abs(now.getTime() - schedule.escalation.getTime());
    if (escalationDiff <= 5 * 60 * 1000) {
      return true;
    }
  }

  return false;
}

/**
 * Get reminder type
 */
function getReminderType(schedule: ReminderSchedule, now: Date): "first" | "second" | "escalation" | null {
  if (!schedule.firstReminder) return null;

  // Check escalation first (highest priority)
  if (schedule.escalation && now >= schedule.escalation) {
    const escalationDiff = Math.abs(now.getTime() - schedule.escalation.getTime());
    if (escalationDiff <= 5 * 60 * 1000) {
      return "escalation";
    }
  }

  // Check second reminder
  if (schedule.secondReminder && now >= schedule.secondReminder) {
    const secondDiff = Math.abs(now.getTime() - schedule.secondReminder.getTime());
    if (secondDiff <= 2 * 60 * 1000) {
      return "second";
    }
  }

  // Check first reminder
  if (schedule.firstReminder && now >= schedule.firstReminder) {
    const firstDiff = Math.abs(now.getTime() - schedule.firstReminder.getTime());
    if (firstDiff <= 2 * 60 * 1000) {
      return "first";
    }
  }

  return null;
}

/**
 * Check if popup should be shown to user (RBAC)
 */
function shouldShowPopupToUser(userRole?: string, isAssignedToMe?: boolean): boolean {
  // Telecaller: Only own leads
  if (userRole === "TELECALLER") {
    return isAssignedToMe === true;
  }

  // Managers/Admins: Can see all
  const allowedRoles = ["BRANCH_MANAGER", "TEAM_LEADER", "COUNSELOR", "ADMIN"];
  return allowedRoles.includes(userRole || "");
}

/**
 * Calculate next callback time for no_answer retry
 */
export function calculateNextCallbackTime(
  attemptCount: number,
  currentCallbackAt: Date,
  workingHours?: { start: string; end: string }
): Date {
  const now = new Date();

  // Attempt 1: +60 minutes
  if (attemptCount === 1) {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Attempt 2: Next day (same time)
  if (attemptCount === 2) {
    const nextDay = new Date(currentCallbackAt);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  }

  // Attempt 3: +48 hours or next next day
  if (attemptCount === 3) {
    const nextNextDay = new Date(currentCallbackAt);
    nextNextDay.setDate(nextNextDay.getDate() + 2);
    return nextNextDay;
  }

  // Default: +60 minutes
  return new Date(now.getTime() + 60 * 60 * 1000);
}

/**
 * Format overdue duration for display
 */
export function formatOverdueDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format time remaining for display (countdown)
 */
export function formatTimeRemaining(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate attempt count from tag history
 * Counts consecutive no_answer or no_answer_retry tags
 */
export function calculateAttemptCount(
  tagApplications: Array<{
    tagFlow?: { name?: string; key?: string } | null;
    tagFlowId?: string;
    createdAt: string;
  }>,
  currentTagKey?: string | null
): number {
  // Filter for no_answer related tags
  const noAnswerTags = tagApplications.filter((tag) => {
    const tagName = tag.tagFlow?.name?.toLowerCase() || "";
    const tagKey = tag.tagFlow?.key?.toLowerCase() || "";
    return (
      tagName.includes("no_answer") ||
      tagName.includes("no answer") ||
      tagKey === "no_answer" ||
      tagKey === "no_answer_retry"
    );
  });

  // If current tag is no_answer, count it
  const isCurrentNoAnswer =
    currentTagKey?.toLowerCase() === "no_answer" ||
    currentTagKey?.toLowerCase() === "no_answer_retry" ||
    tagApplications.some(
      (tag) =>
        tag.tagFlow?.key?.toLowerCase() === currentTagKey?.toLowerCase() &&
        (tag.tagFlow?.name?.toLowerCase().includes("no_answer") ||
          tag.tagFlow?.name?.toLowerCase().includes("no answer"))
    );

  // Count consecutive no_answer tags (sorted by createdAt desc)
  const sortedTags = [...noAnswerTags].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // If current tag is no_answer, ensure it's counted
  let count = sortedTags.length;
  if (isCurrentNoAnswer && count === 0) {
    count = 1; // At least 1 if current tag is no_answer
  }

  return Math.max(count, 0);
}
