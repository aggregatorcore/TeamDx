/**
 * Baseline scheduler for TVF DX operations
 * Emits heartbeat logs and optionally broadcasts heartbeat events via WebSocket
 * Also checks for task reminders (dueSoon/overdue) and emits realtime events
 */

import { prisma } from "../lib/prisma";

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * In-memory deduplication map for task events
 * Key: `${taskId}:${eventType}` (e.g., "clxxx:task:dueSoon")
 * Value: { expiresAt: Date } - when this entry should expire
 */
const taskEventDedupeMap = new Map<string, { expiresAt: Date }>();

/**
 * Clean up expired entries from deduplication map
 * Called periodically to prevent memory leaks
 */
function cleanupDedupeMap() {
  const now = new Date();
  let cleaned = 0;
  for (const [key, value] of taskEventDedupeMap.entries()) {
    if (value.expiresAt < now) {
      taskEventDedupeMap.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[scheduler] Cleaned up ${cleaned} expired dedupe entries`);
  }
}

/**
 * Check if a task event has already been emitted
 * @param taskId - Task ID
 * @param eventType - Event type ("task:dueSoon" or "task:overdue")
 * @returns true if already emitted, false if not
 */
function hasEmittedTaskEvent(taskId: string, eventType: "task:dueSoon" | "task:overdue"): boolean {
  const key = `${taskId}:${eventType}`;
  const entry = taskEventDedupeMap.get(key);
  if (!entry) {
    return false;
  }
  // Check if entry is still valid
  if (entry.expiresAt < new Date()) {
    taskEventDedupeMap.delete(key);
    return false;
  }
  return true;
}

/**
 * Mark a task event as emitted
 * @param taskId - Task ID
 * @param eventType - Event type ("task:dueSoon" or "task:overdue")
 * @param dueAt - Task due date (used to calculate TTL for dueSoon)
 * @param taskStatus - Task status (used to calculate TTL for overdue)
 */
function markTaskEventEmitted(
  taskId: string,
  eventType: "task:dueSoon" | "task:overdue",
  dueAt: Date,
  taskStatus: string
): void {
  const key = `${taskId}:${eventType}`;
  let expiresAt: Date;

  if (eventType === "task:dueSoon") {
    // TTL until dueAt passes (or 24 hours, whichever is shorter)
    const dueAtTime = dueAt.getTime();
    const now = Date.now();
    const timeUntilDue = dueAtTime - now;
    const ttlMs = Math.min(timeUntilDue, 24 * 60 * 60 * 1000); // Max 24 hours
    expiresAt = new Date(now + ttlMs);
  } else {
    // overdue: TTL 24 hours OR until status changes from PENDING
    // Since we can't track status changes here, use 24 hours
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  taskEventDedupeMap.set(key, { expiresAt });
}

/**
 * Check for tasks due soon (within next 60 minutes)
 * Emits task:dueSoon events for tasks not yet emitted
 */
async function checkDueSoonTasks() {
  try {
    const now = new Date();
    const dueSoonWindow = 60 * 60 * 1000; // 60 minutes in milliseconds
    const dueSoonThreshold = new Date(now.getTime() + dueSoonWindow);

    const tasks = await prisma.task.findMany({
      where: {
        status: "PENDING",
        dueAt: {
          gte: now,
          lte: dueSoonThreshold,
        },
      },
      select: {
        id: true,
        dueAt: true,
        assignedToId: true,
      },
    });

    if (tasks.length === 0) {
      return;
    }

    console.log(`[scheduler] Found ${tasks.length} task(s) due soon`);

    const { broadcastDxEventToUser } = require("../lib/socket");

    for (const task of tasks) {
      // Check deduplication
      if (hasEmittedTaskEvent(task.id, "task:dueSoon")) {
        continue;
      }

      // Mark as emitted
      markTaskEventEmitted(task.id, "task:dueSoon", task.dueAt, "PENDING");

      // Emit event to user's room
      try {
        broadcastDxEventToUser(task.assignedToId, "task:dueSoon", {
          taskId: task.id,
          dueAt: task.dueAt.toISOString(),
          assignedToUserId: task.assignedToId,
        });
        console.log(`[scheduler] [ws] Emitted task:dueSoon for task ${task.id} to user ${task.assignedToId}`);
      } catch (error: any) {
        console.error(`[scheduler] Failed to emit task:dueSoon for task ${task.id}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error("[scheduler] Error checking due soon tasks:", error.message);
  }
}

/**
 * Check for overdue tasks (dueAt < now AND status == PENDING)
 * Emits task:overdue events for tasks not yet emitted
 */
async function checkOverdueTasks() {
  try {
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        status: "PENDING",
        dueAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        dueAt: true,
        assignedToId: true,
        status: true,
      },
    });

    if (tasks.length === 0) {
      return;
    }

    console.log(`[scheduler] Found ${tasks.length} overdue task(s)`);

    const { broadcastDxEventToUser } = require("../lib/socket");

    for (const task of tasks) {
      // Check deduplication
      if (hasEmittedTaskEvent(task.id, "task:overdue")) {
        continue;
      }

      // Mark as emitted
      markTaskEventEmitted(task.id, "task:overdue", task.dueAt, task.status);

      // Emit event to user's room
      try {
        broadcastDxEventToUser(task.assignedToId, "task:overdue", {
          taskId: task.id,
          dueAt: task.dueAt.toISOString(),
          assignedToUserId: task.assignedToId,
        });
        console.log(`[scheduler] [ws] Emitted task:overdue for task ${task.id} to user ${task.assignedToId}`);
      } catch (error: any) {
        console.error(`[scheduler] Failed to emit task:overdue for task ${task.id}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error("[scheduler] Error checking overdue tasks:", error.message);
  }
}

/**
 * Run heartbeat task
 * Logs heartbeat and optionally broadcasts via WebSocket
 * Also checks for task reminders
 */
export async function runHeartbeat() {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[scheduler] heartbeat ok - ${timestamp}`);

    // Optionally broadcast heartbeat event via WebSocket
    try {
      const { broadcastDxEvent } = require("../lib/socket");
      broadcastDxEvent("heartbeat", {
        timestamp,
        status: "ok",
      });
    } catch (error) {
      // WebSocket may not be initialized yet, that's okay
      // Don't fail the scheduler if WS is unavailable
    }

    // Check for task reminders
    await checkDueSoonTasks();
    await checkOverdueTasks();

    // Clean up expired dedupe entries (every 10th heartbeat = ~10 minutes)
    if (Math.random() < 0.1) {
      cleanupDedupeMap();
    }
  } catch (error: any) {
    console.error("[scheduler] heartbeat error:", error.message);
  }
}

/**
 * Start the baseline scheduler
 * Runs heartbeat every 60 seconds (or as configured)
 */
export function startDxScheduler() {
  const intervalSeconds = 60; // Default: 60 seconds
  const intervalMs = intervalSeconds * 1000;

  console.log(`[scheduler] Starting DX baseline scheduler (interval: ${intervalSeconds}s)`);

  // Run immediately on start
  runHeartbeat();

  // Then run every interval
  heartbeatInterval = setInterval(() => {
    runHeartbeat();
  }, intervalMs);
}

/**
 * Stop the baseline scheduler
 * Called during graceful shutdown
 */
export function stopDxScheduler() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log("[scheduler] DX baseline scheduler stopped");
  }
}

