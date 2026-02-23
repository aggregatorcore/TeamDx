/**
 * Task Auto-Creation Service
 * 
 * Automatically creates tasks from various events:
 * - Missed calls
 * - Callback requests
 * - Lead status changes (optional)
 * - Incoming calls (optional)
 */

import { Call, CallRequest, Lead, Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { taskAutoCreationConfig } from "../config/taskAutoCreationConfig";
import {
  checkDuplicateTask,
  mergeTasks,
  updateExistingTask,
} from "./taskDeduplicationService";
import { CreateTaskInput } from "../types/task";
import { sendTaskNotification } from "./notificationService";

/**
 * Auto-create task from missed call
 * Trigger: Call logged with status: "missed" (incoming) or "no_answer" (outgoing)
 */
export async function createTaskFromMissedCall(
  call: Call
): Promise<Task | null> {
  // Check if feature is enabled (always enabled for missed calls)
  if (!taskAutoCreationConfig.missedCall.enabled) {
    return null;
  }

  // Calculate due date (now + 2 hours)
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + taskAutoCreationConfig.missedCall.defaultDueOffsetHours);

  // Prepare task input
  const taskInput: CreateTaskInput = {
    title: `Follow up: Missed call from ${call.phoneNumber}`,
    description: `Missed ${call.callType} call from ${call.phoneNumber}`,
    type: "CALL",
    status: "PENDING",
    priority: taskAutoCreationConfig.missedCall.defaultPriority,
    dueAt,
    assignedToId: call.createdById,
    leadId: call.leadId || undefined,
    phoneNumber: call.phoneNumber,
    source: "auto_missed_call",
    tags: ["missed_call", "follow_up", "high"],
    relatedCallId: call.id,
  };

  // Check deduplication
  const duplicateCheck = await checkDuplicateTask(taskInput);
  if (duplicateCheck.isDuplicate) {
    if (duplicateCheck.action === "skip") {
      console.log(
        `[TASK AUTO-CREATE] Skipping duplicate missed call task: ${duplicateCheck.reason}`
      );
      return null;
    } else if (duplicateCheck.action === "merge") {
      return await mergeTasks(duplicateCheck.existingTask!, taskInput, call.createdById);
    } else if (duplicateCheck.action === "update") {
      return await updateExistingTask(duplicateCheck.existingTask!, taskInput, call.createdById);
    }
  }

  // Create task
  const tagsJson = JSON.stringify(taskInput.tags);
  const task = await prisma.task.create({
    data: {
      title: taskInput.title,
      description: taskInput.description || null,
      type: taskInput.type,
      status: taskInput.status,
      priority: taskInput.priority,
      dueAt: taskInput.dueAt,
      assignedToId: taskInput.assignedToId,
      leadId: taskInput.leadId || null,
      createdById: call.createdById,
      phoneNumber: taskInput.phoneNumber || null,
      source: taskInput.source || null,
      tags: tagsJson,
      relatedCallId: taskInput.relatedCallId || null,
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      action: "CREATED",
      note: `Auto-created from missed call: ${call.phoneNumber}`,
      createdById: call.createdById,
    },
  });

  // Send notification
  try {
    await sendTaskNotification(task, "task_assigned");
  } catch (notificationError) {
    console.error(
      `[TASK AUTO-CREATE] Failed to send notification for task ${task.id}:`,
      notificationError
    );
    // Don't fail task creation if notification fails
  }

  console.log(`[TASK AUTO-CREATE] Created task from missed call: ${task.id}`);
  return task;
}

/**
 * Auto-create task from callback request
 * Trigger: CallRequest created with status: "pending"
 */
export async function createTaskFromCallback(
  callRequest: CallRequest
): Promise<Task | null> {
  // Check if feature is enabled (always enabled for callbacks)
  if (!taskAutoCreationConfig.callback.enabled) {
    return null;
  }

  // Calculate due date (use expiresAt or now + 1 hour)
  const dueAt = callRequest.expiresAt || new Date();
  if (!callRequest.expiresAt) {
    dueAt.setHours(dueAt.getHours() + 1);
  }

  // Prepare task input
  const taskInput: CreateTaskInput = {
    title: `Callback: ${callRequest.phoneNumber}`,
    description: `Callback requested for ${callRequest.phoneNumber}`,
    type: "CALL",
    status: "PENDING",
    priority: taskAutoCreationConfig.callback.defaultPriority,
    dueAt,
    assignedToId: callRequest.userId,
    leadId: callRequest.leadId || undefined,
    phoneNumber: callRequest.phoneNumber,
    source: "auto_callback",
    tags: ["callback", "call", "medium"],
    relatedCallRequestId: callRequest.id,
  };

  // Check deduplication
  const duplicateCheck = await checkDuplicateTask(taskInput);
  if (duplicateCheck.isDuplicate) {
    if (duplicateCheck.action === "skip") {
      console.log(
        `[TASK AUTO-CREATE] Skipping duplicate callback task: ${duplicateCheck.reason}`
      );
      return null;
    } else if (duplicateCheck.action === "merge") {
      return await mergeTasks(duplicateCheck.existingTask!, taskInput, callRequest.userId);
    } else if (duplicateCheck.action === "update") {
      return await updateExistingTask(duplicateCheck.existingTask!, taskInput, callRequest.userId);
    }
  }

  // Create task
  const tagsJson = JSON.stringify(taskInput.tags);
  const task = await prisma.task.create({
    data: {
      title: taskInput.title,
      description: taskInput.description || null,
      type: taskInput.type,
      status: taskInput.status,
      priority: taskInput.priority,
      dueAt: taskInput.dueAt,
      assignedToId: taskInput.assignedToId,
      leadId: taskInput.leadId || null,
      createdById: callRequest.userId,
      phoneNumber: taskInput.phoneNumber || null,
      source: taskInput.source || null,
      tags: tagsJson,
      relatedCallRequestId: taskInput.relatedCallRequestId || null,
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      action: "CREATED",
      note: `Auto-created from callback request: ${callRequest.phoneNumber}`,
      createdById: callRequest.userId,
    },
  });

  // Send notification
  try {
    await sendTaskNotification(task, "task_assigned");
  } catch (notificationError) {
    console.error(
      `[TASK AUTO-CREATE] Failed to send notification for task ${task.id}:`,
      notificationError
    );
    // Don't fail task creation if notification fails
  }

  console.log(`[TASK AUTO-CREATE] Created task from callback: ${task.id}`);
  return task;
}

/**
 * Auto-create task from lead status change (OPTIONAL - configurable)
 * Trigger: Lead status changed to "interested", "not_interested", "callback", "follow_up"
 */
export async function createTaskFromLeadStatusChange(
  lead: Lead,
  oldStatus: string,
  newStatus: string
): Promise<Task | null> {
  // Check if feature is enabled
  if (!taskAutoCreationConfig.leadStatusChange.enabled) {
    return null;
  }

  // Check if status change triggers task
  if (!taskAutoCreationConfig.leadStatusChange.triggerStatuses.includes(newStatus)) {
    return null;
  }

  // Skip if lead is not assigned
  if (!lead.assignedToId) {
    console.log(
      `[TASK AUTO-CREATE] Skipping lead status change task - lead not assigned: ${lead.id}`
    );
    return null;
  }

  // Get priority and due offset from config
  const priority =
    taskAutoCreationConfig.leadStatusChange.priorityMap[
      newStatus as keyof typeof taskAutoCreationConfig.leadStatusChange.priorityMap
    ] || "MEDIUM";
  const dueOffsetHours =
    taskAutoCreationConfig.leadStatusChange.dueOffsetMap[
      newStatus as keyof typeof taskAutoCreationConfig.leadStatusChange.dueOffsetMap
    ] || 4;

  // Calculate due date
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + dueOffsetHours);

  // Prepare task input
  const taskInput: CreateTaskInput = {
    title: `Follow up: ${lead.firstName} ${lead.lastName} - ${newStatus}`,
    description: `Lead status changed from "${oldStatus}" to "${newStatus}"`,
    type: "FOLLOW_UP",
    status: "PENDING",
    priority: priority as "LOW" | "MEDIUM" | "HIGH",
    dueAt,
    assignedToId: lead.assignedToId,
    leadId: lead.id,
    phoneNumber: lead.phone,
    source: "auto_lead_status_change",
    tags: ["lead_status_change", "follow_up", priority.toLowerCase()],
  };

  // Check deduplication
  const duplicateCheck = await checkDuplicateTask(taskInput);
  if (duplicateCheck.isDuplicate) {
    if (duplicateCheck.action === "skip") {
      console.log(
        `[TASK AUTO-CREATE] Skipping duplicate lead status change task: ${duplicateCheck.reason}`
      );
      return null;
    }
    // For lead status changes, we skip on duplicate (don't merge/update)
    return null;
  }

  // Create task
  const tagsJson = JSON.stringify(taskInput.tags);
  const task = await prisma.task.create({
    data: {
      title: taskInput.title,
      description: taskInput.description || null,
      type: taskInput.type,
      status: taskInput.status,
      priority: taskInput.priority,
      dueAt: taskInput.dueAt,
      assignedToId: taskInput.assignedToId,
      leadId: taskInput.leadId || null,
      createdById: lead.assignedToId, // Use assigned user as creator
      phoneNumber: taskInput.phoneNumber || null,
      source: taskInput.source || null,
      tags: tagsJson,
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      action: "CREATED",
      note: `Auto-created from lead status change: ${oldStatus} → ${newStatus}`,
      createdById: lead.assignedToId,
    },
  });

  // Send notification
  try {
    await sendTaskNotification(task, "task_assigned");
  } catch (notificationError) {
    console.error(
      `[TASK AUTO-CREATE] Failed to send notification for task ${task.id}:`,
      notificationError
    );
    // Don't fail task creation if notification fails
  }

  console.log(`[TASK AUTO-CREATE] Created task from lead status change: ${task.id}`);
  return task;
}

/**
 * Auto-create task from incoming call (OPTIONAL - configurable, default disabled)
 * Trigger: Incoming call completed with duration > 0
 */
export async function createTaskFromIncomingCall(
  call: Call
): Promise<Task | null> {
  // Check if feature is enabled
  if (!taskAutoCreationConfig.incomingCall.enabled) {
    return null;
  }

  // Only for incoming calls that were completed
  if (call.callType !== "incoming" || call.status !== "completed") {
    return null;
  }

  // Only if call had duration > 0
  if (!call.duration || call.duration <= 0) {
    return null;
  }

  // Calculate due date (now + 24 hours)
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + taskAutoCreationConfig.incomingCall.defaultDueOffsetHours);

  // Prepare task input
  const taskInput: CreateTaskInput = {
    title: `Follow up: Incoming call from ${call.phoneNumber}`,
    description: `Incoming call completed (duration: ${call.duration}s)`,
    type: "FOLLOW_UP",
    status: "PENDING",
    priority: taskAutoCreationConfig.incomingCall.defaultPriority,
    dueAt,
    assignedToId: call.createdById,
    leadId: call.leadId || undefined,
    phoneNumber: call.phoneNumber,
    source: "auto_incoming_call",
    tags: ["incoming_call", "follow_up", "low"],
    relatedCallId: call.id,
  };

  // Check deduplication
  const duplicateCheck = await checkDuplicateTask(taskInput);
  if (duplicateCheck.isDuplicate) {
    if (duplicateCheck.action === "skip") {
      console.log(
        `[TASK AUTO-CREATE] Skipping duplicate incoming call task: ${duplicateCheck.reason}`
      );
      return null;
    }
    // For incoming calls, we skip on duplicate
    return null;
  }

  // Create task
  const tagsJson = JSON.stringify(taskInput.tags);
  const task = await prisma.task.create({
    data: {
      title: taskInput.title,
      description: taskInput.description || null,
      type: taskInput.type,
      status: taskInput.status,
      priority: taskInput.priority,
      dueAt: taskInput.dueAt,
      assignedToId: taskInput.assignedToId,
      leadId: taskInput.leadId || null,
      createdById: call.createdById,
      phoneNumber: taskInput.phoneNumber || null,
      source: taskInput.source || null,
      tags: tagsJson,
      relatedCallId: taskInput.relatedCallId || null,
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      action: "CREATED",
      note: `Auto-created from incoming call: ${call.phoneNumber} (${call.duration}s)`,
      createdById: call.createdById,
    },
  });

  // Send notification
  try {
    await sendTaskNotification(task, "task_assigned");
  } catch (notificationError) {
    console.error(
      `[TASK AUTO-CREATE] Failed to send notification for task ${task.id}:`,
      notificationError
    );
    // Don't fail task creation if notification fails
  }

  console.log(`[TASK AUTO-CREATE] Created task from incoming call: ${task.id}`);
  return task;
}
