/**
 * Task Auto-Creation Configuration
 * 
 * Controls when and how tasks are automatically created from various events
 */
export const taskAutoCreationConfig = {
  /**
   * Missed call task creation
   * Always enabled - creates task when call is missed or not answered
   */
  missedCall: {
    enabled: true, // Always enabled
    defaultPriority: "HIGH" as const,
    defaultDueOffsetHours: 2, // Due in 2 hours
  },
  
  /**
   * Callback task creation
   * Always enabled - creates task when callback request is created
   */
  callback: {
    enabled: true, // Always enabled
    defaultPriority: "MEDIUM" as const,
  },
  
  /**
   * Lead status change task creation
   * Optional feature - disabled by default
   */
  leadStatusChange: {
    enabled: false, // Disabled by default (optional feature)
    triggerStatuses: ["interested", "not_interested", "callback", "follow_up"],
    priorityMap: {
      interested: "HIGH" as const,
      not_interested: "LOW" as const,
      callback: "MEDIUM" as const,
      follow_up: "MEDIUM" as const,
    },
    dueOffsetMap: {
      interested: 1, // hours
      not_interested: 24, // hours
      callback: 1, // hours
      follow_up: 4, // hours
    },
  },
  
  /**
   * Incoming call task creation
   * Optional feature - disabled by default
   */
  incomingCall: {
    enabled: false, // Disabled by default (optional feature)
    defaultPriority: "LOW" as const,
    defaultDueOffsetHours: 24, // Due in 24 hours
  },
};
