/**
 * Task Auto-Complete Service
 * 
 * Automatically completes tasks when related calls or callbacks are completed
 */

import { Call, CallRequest, Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendTaskNotification } from "./notificationService";

/**
 * Auto-complete task when related call is completed
 * Trigger: Call logged with status: "completed" AND duration > 0
 */
export async function autoCompleteTaskFromCall(call: Call): Promise<void> {
  // Only process if call is completed with duration > 0
  if (call.status !== "completed" || !call.duration || call.duration <= 0) {
    return;
  }

  // Find tasks with relatedCallId = call.id
  const tasks = await prisma.task.findMany({
    where: {
      relatedCallId: call.id,
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    },
  });

  // Filter: type = "CALL" OR tags contains "call" or "callback"
  const matchingTasks = tasks.filter((task) => {
    // Check if type is CALL
    if (task.type === "CALL") {
      return true;
    }

    // Check if tags contain "call" or "callback"
    if (task.tags) {
      try {
        const tags = JSON.parse(task.tags) as string[];
        if (Array.isArray(tags)) {
          return (
            tags.includes("call") ||
            tags.includes("callback") ||
            tags.includes("missed_call") ||
            tags.includes("incoming_call")
          );
        }
      } catch (error) {
        // Invalid JSON in tags - skip this task
        console.warn(
          `[TASK AUTO-COMPLETE] Invalid JSON in tags for task ${task.id}:`,
          error
        );
        return false;
      }
    }

    return false;
  });

  // Auto-complete each matching task
  for (const task of matchingTasks) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          autoCompletedAt: new Date(),
        },
      });

      // Log TaskActivity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          action: "AUTO_COMPLETED",
          note: `Auto-completed: Related call completed (${call.phoneNumber}, duration: ${call.duration}s)`,
          createdById: call.createdById,
        },
      });

      console.log(
        `[TASK AUTO-COMPLETE] Auto-completed task ${task.id} from call ${call.id}`
      );

      // Send notification
      try {
        await sendTaskNotification(task, "task_completed");
      } catch (notificationError) {
        console.error(
          `[TASK AUTO-COMPLETE] Failed to send notification for task ${task.id}:`,
          notificationError
        );
        // Don't fail completion if notification fails
      }
    } catch (error) {
      console.error(
        `[TASK AUTO-COMPLETE] Error auto-completing task ${task.id}:`,
        error
      );
      // Continue with next task even if one fails
    }
  }
}

/**
 * Auto-complete task when callback is completed
 * Trigger: CallRequest status = "completed"
 */
export async function autoCompleteTaskFromCallback(
  callRequest: CallRequest
): Promise<void> {
  // Only process if callRequest is completed
  if (callRequest.status !== "completed") {
    return;
  }

  // Find tasks with relatedCallRequestId = callRequest.id
  const tasks = await prisma.task.findMany({
    where: {
      relatedCallRequestId: callRequest.id,
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
    },
  });

  // Auto-complete each matching task
  for (const task of tasks) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          autoCompletedAt: new Date(),
        },
      });

      // Log TaskActivity
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          action: "AUTO_COMPLETED",
          note: `Auto-completed: Callback completed (${callRequest.phoneNumber})`,
          createdById: callRequest.userId,
        },
      });

      console.log(
        `[TASK AUTO-COMPLETE] Auto-completed task ${task.id} from callback ${callRequest.id}`
      );

      // Send notification
      try {
        await sendTaskNotification(task, "task_completed");
      } catch (notificationError) {
        console.error(
          `[TASK AUTO-COMPLETE] Failed to send notification for task ${task.id}:`,
          notificationError
        );
        // Don't fail completion if notification fails
      }
    } catch (error) {
      console.error(
        `[TASK AUTO-COMPLETE] Error auto-completing task ${task.id}:`,
        error
      );
      // Continue with next task even if one fails
    }
  }
}
