/**
 * Notification Service
 * 
 * Handles task notifications via web (Socket.IO) and email
 */

import { Task, Notification } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIO } from "../lib/socket";

/**
 * Send notification for task event
 * 
 * @param task - Task record
 * @param event - "task_assigned", "task_due_soon", "task_overdue", "task_completed"
 * @param userId - Optional user ID (defaults to task.assignedToId)
 */
export async function sendTaskNotification(
  task: Task,
  event: string,
  userId?: string
): Promise<Notification | null> {
  const recipientId = userId || task.assignedToId;

  try {
    // Create notification record in DB
    const notification = await prisma.notification.create({
      data: {
        userId: recipientId,
        type: event,
        title: getNotificationTitle(event, task),
        message: getNotificationMessage(event, task),
        taskId: task.id,
        isRead: false,
      },
    });

    // Send web notification via Socket.IO
    await sendWebNotification(notification);

    // Email notification (if high priority)
    if (isHighPriorityNotification(event)) {
      await sendEmailNotification(notification).catch((error) => {
        // Don't fail if email sending fails
        console.error(
          `[NOTIFICATION] Failed to send email notification ${notification.id}:`,
          error
        );
      });
    }

    console.log(
      `[NOTIFICATION] Sent ${event} notification to user ${recipientId} for task ${task.id}`
    );

    return notification;
  } catch (error) {
    console.error(
      `[NOTIFICATION] Error sending notification for task ${task.id}:`,
      error
    );
    return null;
  }
}

/**
 * Send web notification via Socket.IO
 */
export async function sendWebNotification(
  notification: Notification
): Promise<void> {
  try {
    const io = getIO();

    // Emit to user's room: `user:${userId}`
    io.to(`user:${notification.userId}`).emit("notification:new", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      taskId: notification.taskId,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    });

    console.log(
      `[NOTIFICATION] Web notification sent to user:${notification.userId}`
    );
  } catch (error) {
    console.error(
      `[NOTIFICATION] Error sending web notification ${notification.id}:`,
      error
    );
    // Don't throw - web notification failure shouldn't break the flow
  }
}

/**
 * Send email notification (if email service configured)
 * 
 * NOTE: Email service implementation is optional and can be configured later
 * This is a placeholder that can be extended with SMTP/SendGrid/etc.
 */
export async function sendEmailNotification(
  notification: Notification
): Promise<void> {
  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error(`User ${notification.userId} not found`);
  }

  // Check if email service is configured
  const emailEnabled = process.env.EMAIL_ENABLED === "true";
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASS;

  if (!emailEnabled || !smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    // Email service not configured - skip silently
    console.log(
      `[NOTIFICATION] Email service not configured, skipping email for notification ${notification.id}`
    );
    return;
  }

  // TODO: Implement email sending via SMTP/SendGrid/etc.
  // This is a placeholder for future email service integration
  // Example implementation:
  // const emailBody = `
  //   ${notification.message}
  //   
  //   View task: ${process.env.FRONTEND_URL}/tasks/${notification.taskId}
  // `;
  // await sendEmail({
  //   to: user.email,
  //   subject: notification.title,
  //   body: emailBody,
  // });

  console.log(
    `[NOTIFICATION] Email notification would be sent to ${user.email} for notification ${notification.id} (email service not yet implemented)`
  );
}

/**
 * Get notification title based on event type
 */
function getNotificationTitle(event: string, task: Task): string {
  switch (event) {
    case "task_assigned":
      return `New Task Assigned: ${task.title}`;
    case "task_due_soon":
      return `Task Due Soon: ${task.title}`;
    case "task_overdue":
      return `⚠️ Task Overdue: ${task.title}`;
    case "task_completed":
      return `Task Completed: ${task.title}`;
    default:
      return `Task Update: ${task.title}`;
  }
}

/**
 * Get notification message based on event type and task details
 */
function getNotificationMessage(event: string, task: Task): string {
  const dueDate = task.dueAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  switch (event) {
    case "task_assigned":
      return `You have been assigned a new task: "${task.title}". Due: ${dueDate}. Priority: ${task.priority}.`;
    case "task_due_soon":
      return `Task "${task.title}" is due soon (${dueDate}). Please complete it before the deadline.`;
    case "task_overdue":
      const overdueDays = Math.floor(
        (new Date().getTime() - task.dueAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return `Task "${task.title}" is overdue by ${overdueDays} day(s). Please complete it as soon as possible.`;
    case "task_completed":
      return `Task "${task.title}" has been completed.`;
    default:
      return `Task "${task.title}" has been updated.`;
  }
}

/**
 * Check if notification is high priority (should trigger email)
 */
function isHighPriorityNotification(event: string): boolean {
  return ["task_assigned", "task_overdue"].includes(event);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  try {
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId: userId, // Ensure user can only mark their own notifications as read
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  } catch (error) {
    console.error(
      `[NOTIFICATION] Error marking notification ${notificationId} as read:`,
      error
    );
    throw error;
  }
}

/**
 * Get unread notifications count for a user
 */
export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return count;
  } catch (error) {
    console.error(
      `[NOTIFICATION] Error getting unread count for user ${userId}:`,
      error
    );
    return 0;
  }
}
