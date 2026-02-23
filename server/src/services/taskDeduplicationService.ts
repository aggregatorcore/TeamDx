/**
 * Task Deduplication Service
 * 
 * Implements 3-level deduplication strategy:
 * 1. Exact match (same phoneNumber, assignedToId, type, status, dueAt within 24h)
 * 2. Similar task detection (fuzzy match >80% similarity)
 * 3. Tag-based deduplication (same source tag within 24h)
 */

import { Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { taskDeduplicationConfig } from "../config/taskDeduplicationConfig";
import { CreateTaskInput, DuplicateCheckResult } from "../types/task";

/**
 * Main function: Check if task is duplicate using 3-level strategy
 */
export async function checkDuplicateTask(
  newTask: CreateTaskInput
): Promise<DuplicateCheckResult> {
  // Level 1: Exact match
  const exactMatch = await checkExactMatch(newTask);
  if (exactMatch) {
    return {
      isDuplicate: true,
      existingTask: exactMatch,
      action: "skip",
      reason: "exact_match",
    };
  }

  // Level 2: Similar task detection
  const similarTask = await checkSimilarTask(newTask);
  if (similarTask) {
    return {
      isDuplicate: true,
      existingTask: similarTask,
      action: taskDeduplicationConfig.mode === "merge" ? "merge" : "skip",
      reason: "similar_task",
    };
  }

  // Level 3: Tag-based deduplication
  const tagBasedTask = await checkTagBasedDuplicate(newTask);
  if (tagBasedTask) {
    return {
      isDuplicate: true,
      existingTask: tagBasedTask,
      action: taskDeduplicationConfig.mode === "update" ? "update" : "skip",
      reason: "tag_based",
    };
  }

  return { isDuplicate: false, action: "create" };
}

/**
 * Level 1: Exact match check
 * Same phoneNumber + assignedToId + type + status (PENDING/IN_PROGRESS) + dueAt within 24h
 */
async function checkExactMatch(
  newTask: CreateTaskInput
): Promise<Task | null> {
  // Skip if phoneNumber not provided (can't do exact match)
  if (!newTask.phoneNumber) {
    return null;
  }

  const windowStart = new Date(newTask.dueAt);
  windowStart.setHours(
    windowStart.getHours() - taskDeduplicationConfig.exactMatchWindowHours
  );
  const windowEnd = new Date(newTask.dueAt);
  windowEnd.setHours(
    windowEnd.getHours() + taskDeduplicationConfig.exactMatchWindowHours
  );

  const existingTask = await prisma.task.findFirst({
    where: {
      phoneNumber: newTask.phoneNumber,
      assignedToId: newTask.assignedToId,
      type: newTask.type,
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
      dueAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return existingTask || null;
}

/**
 * Level 2: Similar task detection (fuzzy match >80%)
 * Same phoneNumber + assignedToId + similar title + status (PENDING/IN_PROGRESS) + created within 48h
 */
async function checkSimilarTask(
  newTask: CreateTaskInput
): Promise<Task | null> {
  // Skip if phoneNumber not provided
  if (!newTask.phoneNumber) {
    return null;
  }

  const windowStart = new Date();
  windowStart.setHours(
    windowStart.getHours() - taskDeduplicationConfig.similarTaskWindowHours
  );

  const existingTasks = await prisma.task.findMany({
    where: {
      phoneNumber: newTask.phoneNumber,
      assignedToId: newTask.assignedToId,
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate similarity for each task
  for (const task of existingTasks) {
    const similarity = calculateTitleSimilarity(newTask.title, task.title);
    if (similarity >= taskDeduplicationConfig.similarityThreshold) {
      return task;
    }
  }

  return null;
}

/**
 * Calculate similarity between two titles (0-1)
 * Uses word overlap percentage
 */
export function calculateTitleSimilarity(
  title1: string,
  title2: string
): number {
  if (!title1 || !title2) {
    return 0;
  }

  if (title1 === title2) {
    return 1.0;
  }

  // Normalize: lowercase, remove extra spaces
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const normalized1 = normalize(title1);
  const normalized2 = normalize(title2);

  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Split into words
  const words1 = new Set(normalized1.split(" "));
  const words2 = new Set(normalized2.split(" "));

  // Calculate intersection and union
  const intersection = new Set(
    [...words1].filter((word) => words2.has(word))
  );
  const union = new Set([...words1, ...words2]);

  // Jaccard similarity: intersection / union
  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Level 3: Tag-based deduplication
 * Same phoneNumber + assignedToId + same source tag + status (PENDING/IN_PROGRESS) + created within 24h
 */
async function checkTagBasedDuplicate(
  newTask: CreateTaskInput
): Promise<Task | null> {
  // Skip if phoneNumber or source not provided
  if (!newTask.phoneNumber || !newTask.source) {
    return null;
  }

  const windowStart = new Date();
  windowStart.setHours(
    windowStart.getHours() - taskDeduplicationConfig.tagBasedWindowHours
  );

  // Find tasks with same phoneNumber, assignedToId, and status
  const existingTasks = await prisma.task.findMany({
    where: {
      phoneNumber: newTask.phoneNumber,
      assignedToId: newTask.assignedToId,
      status: {
        in: ["PENDING", "IN_PROGRESS"],
      },
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Check if any task has the same source tag
  for (const task of existingTasks) {
    if (task.tags) {
      try {
        const tags = JSON.parse(task.tags) as string[];
        if (Array.isArray(tags) && tags.includes(newTask.source)) {
          return task;
        }
      } catch (error) {
        // Invalid JSON in tags field - skip this task
        console.warn(
          `Invalid JSON in tags field for task ${task.id}:`,
          error
        );
        continue;
      }
    }
  }

  return null;
}

/**
 * Merge similar tasks (if merge mode enabled)
 * Combine notes, update dueAt if earlier, add activity log
 */
export async function mergeTasks(
  existingTask: Task,
  newTask: CreateTaskInput,
  createdById: string
): Promise<Task> {
  // Combine descriptions
  let combinedDescription = existingTask.description || "";
  if (newTask.description) {
    if (combinedDescription) {
      combinedDescription += `\n\n[Merged] ${newTask.description}`;
    } else {
      combinedDescription = newTask.description;
    }
  }

  // Update dueAt if new task's dueAt is earlier
  const dueAt =
    newTask.dueAt < existingTask.dueAt ? newTask.dueAt : existingTask.dueAt;

  // Merge tags
  const existingTags = existingTask.tags
    ? (JSON.parse(existingTask.tags) as string[])
    : [];
  const newTags = newTask.tags || [];
  const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
  const tagsJson = JSON.stringify(mergedTags);

  // Update existing task
  const updatedTask = await prisma.task.update({
    where: { id: existingTask.id },
    data: {
      description: combinedDescription || null,
      dueAt,
      tags: tagsJson,
      // Update related fields if provided
      relatedCallId: newTask.relatedCallId || existingTask.relatedCallId,
      relatedCallRequestId:
        newTask.relatedCallRequestId || existingTask.relatedCallRequestId,
      updatedAt: new Date(),
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: updatedTask.id,
      action: "MERGED",
      note: `Task merged with new task: ${newTask.title}`,
      createdById,
    },
  });

  return updatedTask;
}

/**
 * Update existing task (if update mode enabled)
 * Add note, update dueAt if earlier
 */
export async function updateExistingTask(
  existingTask: Task,
  newTask: CreateTaskInput,
  createdById: string
): Promise<Task> {
  // Add note about new event
  let updatedDescription = existingTask.description || "";
  if (newTask.description) {
    if (updatedDescription) {
      updatedDescription += `\n\n[Updated] ${newTask.description}`;
    } else {
      updatedDescription = newTask.description;
    }
  } else {
    updatedDescription += `\n\n[Updated] New event: ${newTask.title}`;
  }

  // Update dueAt if new task's dueAt is earlier
  const dueAt =
    newTask.dueAt < existingTask.dueAt ? newTask.dueAt : existingTask.dueAt;

  // Merge tags
  const existingTags = existingTask.tags
    ? (JSON.parse(existingTask.tags) as string[])
    : [];
  const newTags = newTask.tags || [];
  const updatedTags = Array.from(new Set([...existingTags, ...newTags]));
  const tagsJson = JSON.stringify(updatedTags);

  // Update existing task
  const updatedTask = await prisma.task.update({
    where: { id: existingTask.id },
    data: {
      description: updatedDescription || null,
      dueAt,
      tags: tagsJson,
      // Update related fields if provided
      relatedCallId: newTask.relatedCallId || existingTask.relatedCallId,
      relatedCallRequestId:
        newTask.relatedCallRequestId || existingTask.relatedCallRequestId,
      updatedAt: new Date(),
    },
  });

  // Log TaskActivity
  await prisma.taskActivity.create({
    data: {
      taskId: updatedTask.id,
      action: "UPDATED",
      note: `Task updated with new event: ${newTask.title}`,
      createdById,
    },
  });

  return updatedTask;
}
