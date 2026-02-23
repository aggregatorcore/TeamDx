/**
 * Action Executor Service
 * 
 * Executes individual workflow actions:
 * - callback: Schedule callback task
 * - whatsapp: Send WhatsApp message
 * - task: Create task in system
 * - notification: Send notification
 * - escalate: Escalate to team leader/admin
 */

import { prisma } from "../lib/prisma";
import { sendTaskNotification } from "./notificationService";

export interface ActionContext {
  leadId?: string;
  callId?: string;
  userId?: string;
  [key: string]: any; // Additional context data
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Execute a workflow action
 * 
 * @param actionType - Type of action (callback, whatsapp, task, notification, escalate)
 * @param actionConfig - Action configuration from node data
 * @param context - Execution context (leadId, callId, userId, etc.)
 * @returns Action result
 */
export async function executeAction(
  actionType: string,
  actionConfig: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    switch (actionType.toLowerCase()) {
      case 'callback':
        return await executeCallbackAction(actionConfig, context);
      
      case 'whatsapp':
        return await executeWhatsAppAction(actionConfig, context);
      
      case 'task':
        return await executeTaskAction(actionConfig, context);
      
      case 'notification':
        return await executeNotificationAction(actionConfig, context);
      
      case 'escalate':
        return await executeEscalateAction(actionConfig, context);
      
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  } catch (error: any) {
    console.error(`[ACTION EXECUTOR] Error executing action ${actionType}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Execute callback action - Schedule callback task
 */
async function executeCallbackAction(
  config: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    console.log("[ACTION EXECUTOR] Executing callback action", {
      config,
      context: { leadId: context.leadId, callId: context.callId, tagId: context.tagId },
    });
    const {
      assignedToUserId,
      dueInMinutes = 60,
      delayMinutes = 60, // Alternative name for dueInMinutes
      priority = 'MEDIUM',
      title,
      description,
    } = config;

    if (!assignedToUserId && !context.userId) {
      throw new Error('assignedToUserId or userId required for callback action');
    }

    const assigneeId = assignedToUserId || context.userId;
    const callbackDelay = dueInMinutes || delayMinutes || 60;
    const callbackAt = new Date(Date.now() + callbackDelay * 60 * 1000);

    // Update tag application with callbackAt if leadId and tagId are available
    if (context.leadId) {
      try {
        // Find the latest active tag application for this lead
        // If tagId is provided, use it; otherwise get the most recent tag application
        const whereClause: any = {
          entityType: 'lead',
          entityId: context.leadId,
          isActive: true,
        };
        
        if (context.tagId) {
          whereClause.tagFlowId = context.tagId;
        }

        const latestTagApplication = await prisma.tagApplication.findFirst({
          where: whereClause,
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (latestTagApplication) {
          // Update tag application with callback time
          await prisma.tagApplication.update({
            where: { id: latestTagApplication.id },
            data: {
              callbackAt: callbackAt,
            },
          });

          console.log(`[ACTION EXECUTOR] ✅ Updated tag application ${latestTagApplication.id} with callbackAt: ${callbackAt.toISOString()}`, {
            leadId: context.leadId,
            tagId: context.tagId,
            tagFlowId: latestTagApplication.tagFlowId,
            callbackAt: callbackAt.toISOString(),
          });
        } else {
          console.warn(`[ACTION EXECUTOR] ⚠️ No tag application found for lead ${context.leadId}`, {
            tagId: context.tagId,
            whereClause,
          });
        }
      } catch (tagUpdateError: any) {
        console.error(`[ACTION EXECUTOR] ❌ Error updating tag application with callbackAt:`, tagUpdateError);
        // Don't fail the action if tag update fails
      }
    } else {
      console.warn(`[ACTION EXECUTOR] ⚠️ No leadId in context, cannot update tag application`, {
        context,
      });
    }

    // Create callback task
    const task = await prisma.task.create({
      data: {
        title: title || `Callback for ${context.leadId ? 'Lead' : 'Call'}`,
        description: description || 'Scheduled callback from workflow',
        type: 'CALL',
        status: 'PENDING',
        priority: priority || 'MEDIUM',
        dueAt: callbackAt,
        assignedToId: assigneeId,
        leadId: context.leadId || null,
        source: 'workflow',
        phoneNumber: context.phoneNumber || null,
        relatedCallId: context.callId || null,
      },
    });

    // Send notification
    await sendTaskNotification(task, 'task_assigned', assigneeId);

    return {
      success: true,
      message: 'Callback task created successfully',
      data: { taskId: task.id, callbackAt: callbackAt.toISOString() },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute WhatsApp action - Send WhatsApp message
 * 
 * Note: This is a placeholder. Integrate with actual WhatsApp service when available.
 */
async function executeWhatsAppAction(
  config: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const {
      phoneNumber,
      message,
      templateId,
    } = config;

    const targetPhone = phoneNumber || context.phoneNumber;

    if (!targetPhone) {
      throw new Error('phoneNumber required for WhatsApp action');
    }

    if (!message && !templateId) {
      throw new Error('message or templateId required for WhatsApp action');
    }

    // TODO: Integrate with actual WhatsApp service
    // For now, just log the action
    console.log(`[ACTION EXECUTOR] WhatsApp action:`, {
      phoneNumber: targetPhone,
      message,
      templateId,
      leadId: context.leadId,
      callId: context.callId,
    });

    // In production, this would call the WhatsApp API
    // await sendWhatsAppMessage(targetPhone, message, templateId);

    return {
      success: true,
      message: 'WhatsApp message sent (simulated)',
      data: { phoneNumber: targetPhone },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute task action - Create task in system
 */
async function executeTaskAction(
  config: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const {
      assignedToUserId,
      title,
      description,
      type = 'FOLLOW_UP',
      priority = 'MEDIUM',
      dueInMinutes,
      dueAt,
    } = config;

    if (!assignedToUserId && !context.userId) {
      throw new Error('assignedToUserId or userId required for task action');
    }

    if (!title) {
      throw new Error('title required for task action');
    }

    const assigneeId = assignedToUserId || context.userId;
    let taskDueAt: Date;

    if (dueAt) {
      taskDueAt = new Date(dueAt);
    } else if (dueInMinutes) {
      taskDueAt = new Date(Date.now() + dueInMinutes * 60 * 1000);
    } else {
      taskDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        type: type || 'FOLLOW_UP',
        status: 'PENDING',
        priority: priority || 'MEDIUM',
        dueAt: taskDueAt,
        assignedToId: assigneeId,
        leadId: context.leadId || null,
        source: 'workflow',
        phoneNumber: context.phoneNumber || null,
        relatedCallId: context.callId || null,
      },
    });

    // Send notification
    await sendTaskNotification(task, 'task_assigned', assigneeId);

    return {
      success: true,
      message: 'Task created successfully',
      data: { taskId: task.id },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute notification action - Send notification
 */
async function executeNotificationAction(
  config: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const {
      userId,
      title,
      message,
      type = 'info',
    } = config;

    const targetUserId = userId || context.userId;

    if (!targetUserId) {
      throw new Error('userId required for notification action');
    }

    if (!title || !message) {
      throw new Error('title and message required for notification action');
    }

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: type || 'info',
        title,
        message,
        isRead: false,
      },
    });

    // Send web notification via Socket.IO
    try {
      const { getIO } = require("../lib/socket");
      const io = getIO();
      if (io) {
        io.to(`user_${targetUserId}`).emit('notification', notification);
      }
    } catch (socketError: any) {
      console.error('[ACTION EXECUTOR] Error sending web notification:', socketError);
      // Don't fail - notification is saved in DB
    }

    return {
      success: true,
      message: 'Notification sent successfully',
      data: { notificationId: notification.id },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute escalate action - Escalate to team leader/admin
 */
async function executeEscalateAction(
  config: any,
  context: ActionContext
): Promise<ActionResult> {
  try {
    const {
      escalateTo = 'team_leader', // 'team_leader' or 'admin'
      message,
      priority = 'HIGH',
    } = config;

    // Get lead or call to escalate
    let lead = null;
    let call = null;

    if (context.leadId) {
      lead = await prisma.lead.findUnique({
        where: { id: context.leadId },
        include: {
          assignedTo: {
            include: {
              teamLeader: true,
            },
          },
        },
      });
    }

    if (context.callId) {
      call = await prisma.call.findUnique({
        where: { id: context.callId },
        include: {
          createdBy: {
            include: {
              teamLeader: true,
            },
          },
        },
      });
    }

    let targetUserId: string | null = null;

    if (escalateTo === 'team_leader') {
      // Escalate to team leader
      if (lead?.assignedTo?.teamLeaderId) {
        targetUserId = lead.assignedTo.teamLeaderId;
      } else if (call?.createdBy?.teamLeaderId) {
        targetUserId = call.createdBy.teamLeaderId;
      }
    } else if (escalateTo === 'admin') {
      // Escalate to admin - find first admin user
      const admin = await prisma.user.findFirst({
        where: {
          role: {
            name: 'ADMIN',
          },
          isActive: true,
        },
      });
      if (admin) {
        targetUserId = admin.id;
      }
    }

    if (!targetUserId) {
      throw new Error(`Cannot find ${escalateTo} to escalate to`);
    }

    // Create escalation task
    const escalationTitle = `Escalation: ${lead ? `Lead ${lead.id}` : call ? `Call ${call.id}` : 'Workflow'}`;
    const escalationDescription = message || `Escalated from workflow execution`;

    const task = await prisma.task.create({
      data: {
        title: escalationTitle,
        description: escalationDescription,
        type: 'INTERNAL',
        status: 'PENDING',
        priority: priority || 'HIGH',
        dueAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        assignedToId: targetUserId,
        leadId: context.leadId || null,
        source: 'workflow_escalation',
        relatedCallId: context.callId || null,
      },
    });

    // Send notification
    await sendTaskNotification(task, 'task_assigned', targetUserId);

    return {
      success: true,
      message: `Escalated to ${escalateTo}`,
      data: { taskId: task.id, escalatedTo: targetUserId },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
