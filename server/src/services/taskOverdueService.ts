/**
 * Task Overdue Logic Service
 * 
 * Handles overdue task detection, tagging, and priority escalation
 */

import { Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendTaskNotification } from "./notificationService";

/**
 * Calculate how many days a task is overdue
 * 
 * @param task - Task record
 * @returns Number of days overdue (0 if not overdue)
 */
export function calculateOverdueDays(task: Task): number {
  // If status is "COMPLETED" or "CANCELLED", return 0
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    return 0;
  }

  const now = new Date();
  const dueAt = task.dueAt;

  // If dueAt >= now(), return 0 (not overdue)
  if (dueAt >= now) {
    return 0;
  }

  // Calculate: (now() - dueAt) in days
  const diffMs = now.getTime() - dueAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if task has a specific tag
 */
function hasTag(task: Task, tag: string): boolean {
  if (!task.tags) {
    return false;
  }

  try {
    const tags = JSON.parse(task.tags) as string[];
    if (Array.isArray(tags)) {
      return tags.includes(tag);
    }
  } catch (error) {
    // Invalid JSON in tags
    return false;
  }

  return false;
}

/**
 * Add tag to task's tags array
 */
async function addTag(task: Task, tag: string): Promise<void> {
  let tags: string[] = [];

  if (task.tags) {
    try {
      tags = JSON.parse(task.tags) as string[];
      if (!Array.isArray(tags)) {
        tags = [];
      }
    } catch (error) {
      // Invalid JSON, start fresh
      tags = [];
    }
  }

  // Add tag if not already present
  if (!tags.includes(tag)) {
    tags.push(tag);
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      tags: JSON.stringify(tags),
    },
  });
}

/**
 * Remove tag from task's tags array
 */
async function removeTag(task: Task, tag: string): Promise<void> {
  if (!task.tags) {
    return;
  }

  try {
    const tags = JSON.parse(task.tags) as string[];
    if (!Array.isArray(tags)) {
      return;
    }

    const filteredTags = tags.filter((t) => t !== tag);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        tags: JSON.stringify(filteredTags),
      },
    });
  } catch (error) {
    // Invalid JSON, skip
    console.warn(
      `[TASK OVERDUE] Invalid JSON in tags for task ${task.id}:`,
      error
    );
  }
}

/**
 * Tag all overdue tasks with "overdue" tag
 * Run as cron job (every hour)
 */
export async function tagOverdueTasks(): Promise<void> {
  const now = new Date();

  // Find all tasks where:
  // - dueAt < now()
  // - status IN ["PENDING", "IN_PROGRESS"]
  // - tags does NOT contain "overdue"
  const tasks = await prisma.task.findMany({
    where: {
      dueAt: {
        lt: now,
      },
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    },
  });

  let taggedCount = 0;

  for (const task of tasks) {
    // Check if already has "overdue" tag
    if (hasTag(task, "overdue")) {
      continue;
    }

    try {
      // Add "overdue" tag
      await addTag(task, "overdue");

      // Log TaskActivity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          action: "TAG_ADDED",
          note: "Tagged as overdue",
          createdById: task.assignedToId, // Use assigned user as creator for system actions
        },
      });

      taggedCount++;

      // Send notification when task becomes overdue
      try {
        await sendTaskNotification(task, "task_overdue");
      } catch (notificationError) {
        console.error(
          `[TASK OVERDUE] Failed to send notification for task ${task.id}:`,
          notificationError
        );
        // Don't fail tagging if notification fails
      }

      console.log(
        `[TASK OVERDUE] Tagged task ${task.id} as overdue (${calculateOverdueDays(task)} days)`
      );
    } catch (error) {
      console.error(
        `[TASK OVERDUE] Error tagging task ${task.id} as overdue:`,
        error
      );
      // Continue with next task
    }
  }

  if (taggedCount > 0) {
    console.log(
      `[TASK OVERDUE] Tagged ${taggedCount} task(s) as overdue`
    );
  }
}

/**
 * Escalate priority for overdue tasks
 * Run as cron job (every hour)
 */
export async function escalateOverdueTasks(): Promise<void> {
  const now = new Date();

  // Find all overdue tasks
  const tasks = await prisma.task.findMany({
    where: {
      dueAt: {
        lt: now,
      },
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    },
  });

  let escalatedCount = 0;

  for (const task of tasks) {
    const overdueDays = calculateOverdueDays(task);

    if (overdueDays <= 0) {
      continue;
    }

    let shouldEscalate = false;
    let newPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = task.priority as any;

    // If overdue > 24 hours AND priority is "LOW" or "MEDIUM"
    if (overdueDays > 1 && (task.priority === "LOW" || task.priority === "MEDIUM")) {
      newPriority = "HIGH";
      shouldEscalate = true;
    }

    // If overdue > 3 days AND priority is not "URGENT"
    if (overdueDays > 3 && task.priority !== "URGENT") {
      // Check if URGENT priority exists in schema, otherwise use HIGH
      // For now, we'll use HIGH as max (URGENT may not be in schema)
      if (task.priority !== "HIGH") {
        newPriority = "HIGH";
      }
      shouldEscalate = true;
    }

    if (!shouldEscalate) {
      continue;
    }

    try {
      // Update priority
      await prisma.task.update({
        where: { id: task.id },
        data: {
          priority: newPriority,
        },
      });

      // Add "escalated" tag
      await addTag(task, "escalated");

      // Log TaskActivity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          action: "PRIORITY_ESCALATED",
          note: `Priority escalated from ${task.priority} to ${newPriority} (overdue ${overdueDays} days)`,
          createdById: task.assignedToId,
        },
      });

      escalatedCount++;
      console.log(
        `[TASK OVERDUE] Escalated task ${task.id} priority from ${task.priority} to ${newPriority} (overdue ${overdueDays} days)`
      );
    } catch (error) {
      console.error(
        `[TASK OVERDUE] Error escalating task ${task.id}:`,
        error
      );
      // Continue with next task
    }
  }

  if (escalatedCount > 0) {
    console.log(
      `[TASK OVERDUE] Escalated ${escalatedCount} task(s) priority`
    );
  }
}

/**
 * Remove "overdue" tag when task is completed or due date updated
 */
export async function removeOverdueTag(task: Task): Promise<void> {
  // Check if task has "overdue" tag
  if (!hasTag(task, "overdue")) {
    return;
  }

  try {
    // Remove "overdue" from tags array
    await removeTag(task, "overdue");

    // Log TaskActivity
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        action: "TAG_REMOVED",
        note: "Removed overdue tag",
        createdById: task.assignedToId,
      },
    });

    console.log(`[TASK OVERDUE] Removed overdue tag from task ${task.id}`);
  } catch (error) {
    console.error(
      `[TASK OVERDUE] Error removing overdue tag from task ${task.id}:`,
      error
    );
  }
}
