/**
 * Task-related TypeScript types
 */

import { Task } from "@prisma/client";

/**
 * Input type for creating a new task
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  type: "FOLLOW_UP" | "INTERNAL" | "CALL" | "MEETING";
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: Date;
  assignedToId: string;
  leadId?: string;
  phoneNumber?: string;
  source?: string;
  tags?: string[]; // Will be stored as JSON array string
  relatedCallId?: string;
  relatedCallRequestId?: string;
}

/**
 * Result of duplicate check
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTask?: Task;
  action: "skip" | "merge" | "update" | "create";
  reason?: string;
}
