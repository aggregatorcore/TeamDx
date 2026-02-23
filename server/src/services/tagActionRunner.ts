/**
 * Tag Action Runner Service
 * 
 * Executes tag action instances based on scheduled attempts.
 * Polls for due instances and executes actions according to action rules.
 */

import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

// Action rule types (matching ActionRulesEditor.tsx)
interface ActionRule {
  attempts: Array<{
    attemptNumber: number;
    delayMinutes: number;
    actions: Array<{
      type: "createTask" | "sendEmail" | "sendWhatsApp" | "updateLeadStatus" | "assignToUser" | "createNotification";
      params: Record<string, any>;
    }>;
  }>;
  finalAttempt?: {
    delayMinutes: number;
    actions: Array<{
      type: "createTask" | "sendEmail" | "sendWhatsApp" | "updateLeadStatus" | "assignToUser" | "createNotification" | "escalate";
      params: Record<string, any>;
    }>;
  };
}

interface ActionExecutionResult {
  success: boolean;
  errorMessage?: string;
  executionTimeMs: number;
}

/**
 * Poll for due instances that need to be executed
 * Returns instances where status='pending' AND nextRunAt <= NOW()
 */
export async function pollDueInstances(limit: number = 50): Promise<any[]> {
  try {
    const now = new Date();
    
    const instances = await prisma.tagActionInstance.findMany({
      where: {
        status: "pending",
        nextRunAt: {
          lte: now,
        },
      },
      include: {
        tagApplication: true, // TagApplication has no lead/call relations; we attach entity in executeInstance
        tagFlow: true,
      },
      take: limit,
      orderBy: {
        nextRunAt: "asc", // Process oldest first
      },
    });

    return instances;
  } catch (error: any) {
    console.error("[TagActionRunner] Error polling due instances:", error);
    throw error;
  }
}

/**
 * Execute a single action instance
 */
export async function executeInstance(instance: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Update status to "running"
    await prisma.tagActionInstance.update({
      where: { id: instance.id },
      data: { status: "running" },
    });

    // TagApplication has no lead/call relations in schema; fetch entity so action executors can use it
    if (!instance.tagApplication) instance.tagApplication = {};
    if (instance.entityType === "lead") {
      instance.tagApplication.lead = await prisma.lead.findUnique({ where: { id: instance.entityId } });
    } else if (instance.entityType === "call") {
      instance.tagApplication.call = await prisma.call.findUnique({ where: { id: instance.entityId } });
    }

    // Parse action rule JSON
    let actionRule: ActionRule;
    try {
      actionRule = instance.actionRuleJson 
        ? JSON.parse(instance.actionRuleJson)
        : instance.tagFlow?.actions 
          ? JSON.parse(instance.tagFlow.actions)
          : null;
    } catch (parseError: any) {
      throw new Error(`Invalid action rule JSON: ${parseError.message}`);
    }

    if (!actionRule || !actionRule.attempts || actionRule.attempts.length === 0) {
      throw new Error("No action rules found for this instance");
    }

    const currentAttempt = instance.currentAttempt;
    const maxAttempts = instance.maxAttempts;

    // Check if this is the final attempt
    const isFinalAttempt = currentAttempt >= maxAttempts;
    
    let attemptConfig: any;
    if (isFinalAttempt && actionRule.finalAttempt) {
      // Use final attempt configuration
      attemptConfig = actionRule.finalAttempt;
    } else {
      // Find matching attempt configuration
      attemptConfig = actionRule.attempts.find(
        (a) => a.attemptNumber === currentAttempt
      );
    }

    if (!attemptConfig) {
      throw new Error(`No action configuration found for attempt ${currentAttempt}`);
    }

    // Execute all actions for this attempt
    const actionResults: ActionExecutionResult[] = [];
    
    for (const action of attemptConfig.actions) {
      const actionStartTime = Date.now();
      
      try {
        let result: ActionExecutionResult;
        
        switch (action.type) {
          case "createTask":
            result = await executeCreateTask(instance, action.params);
            break;
          case "sendEmail":
            result = await executeSendEmail(instance, action.params);
            break;
          case "sendWhatsApp":
            result = await executeSendWhatsApp(instance, action.params);
            break;
          case "updateLeadStatus":
            result = await executeUpdateLeadStatus(instance, action.params);
            break;
          case "assignToUser":
            result = await executeAssignToUser(instance, action.params);
            break;
          case "createNotification":
            result = await executeCreateNotification(instance, action.params);
            break;
          case "escalate":
            result = await executeEscalate(instance, action.params);
            break;
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }

        const actionExecutionTime = Date.now() - actionStartTime;
        result.executionTimeMs = actionExecutionTime;
        actionResults.push(result);

        // Log execution
        await logActionExecution(
          instance.id,
          currentAttempt,
          action.type,
          action.params,
          result.success ? "success" : "failed",
          result.errorMessage,
          actionExecutionTime
        );

      } catch (actionError: any) {
        const actionExecutionTime = Date.now() - actionStartTime;
        const errorMessage = actionError.message || String(actionError);
        
        actionResults.push({
          success: false,
          errorMessage,
          executionTimeMs: actionExecutionTime,
        });

        // Log failed execution
        await logActionExecution(
          instance.id,
          currentAttempt,
          action.type,
          action.params,
          "failed",
          errorMessage,
          actionExecutionTime
        );
      }
    }

    // Check if all actions succeeded
    const allSucceeded = actionResults.every((r) => r.success);
    const hasFailures = actionResults.some((r) => !r.success);

    // Determine next status and schedule
    if (isFinalAttempt) {
      // Final attempt completed - mark as completed or failed
      const nextStatus = allSucceeded ? "completed" : "failed";
      const completedAt = new Date();

      await prisma.tagActionInstance.update({
        where: { id: instance.id },
        data: {
          status: nextStatus,
          completedAt,
          metaJson: JSON.stringify({
            finalAttempt: currentAttempt,
            results: actionResults,
            completedAt: completedAt.toISOString(),
          }),
        },
      });

      console.log(
        `[TagActionRunner] Instance ${instance.id} ${nextStatus} after ${currentAttempt} attempts`
      );
    } else {
      // Schedule next attempt
      const nextAttempt = currentAttempt + 1;
      const delayMinutes = attemptConfig.delayMinutes || 60; // Default 1 hour
      const nextRunAt = new Date();
      nextRunAt.setMinutes(nextRunAt.getMinutes() + delayMinutes);

      await prisma.tagActionInstance.update({
        where: { id: instance.id },
        data: {
          currentAttempt: nextAttempt,
          nextRunAt,
          status: "pending", // Reset to pending for next attempt
          metaJson: JSON.stringify({
            lastAttempt: currentAttempt,
            lastAttemptResults: actionResults,
            nextAttempt: nextAttempt,
            nextRunAt: nextRunAt.toISOString(),
          }),
        },
      });

      console.log(
        `[TagActionRunner] Instance ${instance.id} scheduled for attempt ${nextAttempt} at ${nextRunAt.toISOString()}`
      );
    }

    const totalExecutionTime = Date.now() - startTime;
    console.log(
      `[TagActionRunner] Instance ${instance.id} executed in ${totalExecutionTime}ms (attempt ${currentAttempt}/${maxAttempts})`
    );

  } catch (error: any) {
    const totalExecutionTime = Date.now() - startTime;
    const errorMessage = error.message || String(error);
    
    console.error(`[TagActionRunner] Error executing instance ${instance.id}:`, errorMessage);

    // Update instance status to failed
    try {
      await prisma.tagActionInstance.update({
        where: { id: instance.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          metaJson: JSON.stringify({
            error: errorMessage,
            failedAt: new Date().toISOString(),
            executionTimeMs: totalExecutionTime,
          }),
        },
      });
    } catch (updateError: any) {
      console.error(`[TagActionRunner] Failed to update instance status:`, updateError);
    }

    throw error;
  }
}

/**
 * Log action execution to TagActionExecutionLog
 */
async function logActionExecution(
  instanceId: string,
  attemptNumber: number,
  actionType: string,
  actionParams: Record<string, any>,
  status: "success" | "failed" | "skipped",
  errorMessage?: string,
  executionTimeMs?: number
): Promise<void> {
  try {
    await prisma.tagActionExecutionLog.create({
      data: {
        instanceId,
        attemptNumber,
        actionType,
        actionParams: JSON.stringify(actionParams),
        status,
        errorMessage: errorMessage || null,
        executionTimeMs: executionTimeMs || null,
      },
    });
  } catch (error: any) {
    console.error(`[TagActionRunner] Failed to log execution:`, error);
    // Don't throw - logging failure shouldn't stop execution
  }
}

// ==================== ACTION EXECUTORS ====================

/**
 * Execute createTask action
 */
async function executeCreateTask(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { title, description, type, priority, dueAt, assignedToUserId, leadId } = params;

    if (!title) {
      throw new Error("Task title is required");
    }

    // Get entity (lead or call) for context
    const entity = instance.tagApplication?.lead || instance.tagApplication?.call;
    const entityId = instance.entityId;

    // Determine assigned user
    let assignedUserId = assignedToUserId;
    if (!assignedUserId && entity) {
      // Default to entity's assigned user or creator
      assignedUserId = entity.assignedToId || entity.createdById;
    }

    if (!assignedUserId) {
      throw new Error("No assigned user found for task");
    }

    // Create task (schema: assignedToId, createdById required)
    const task = await prisma.task.create({
      data: {
        title: title || `Task from tag: ${instance.tagFlow?.name || "Unknown"}`,
        description: description || `Auto-generated task from tag action (instance: ${instance.id})`,
        type: type || "FOLLOW_UP",
        status: "PENDING",
        priority: priority || "MEDIUM",
        dueAt: dueAt ? new Date(dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: 24 hours
        assignedToId: assignedUserId,
        createdById: assignedUserId, // Required by schema
        leadId: leadId || (instance.entityType === "lead" ? entityId : null),
        source: "tag_action",
        tags: JSON.stringify(["auto_generated", instance.tagFlow?.name || "tag_action"]),
      },
    });

    console.log(`[TagActionRunner] Created task ${task.id} for instance ${instance.id}`);
    
    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute sendEmail action
 */
async function executeSendEmail(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { to, subject, body, template } = params;

    // Get entity for context
    const entity = instance.tagApplication?.lead || instance.tagApplication?.call;
    
    // Determine recipient
    let recipientEmail = to;
    if (!recipientEmail && entity) {
      // Try to get email from lead/call
      if (instance.entityType === "lead" && entity.email) {
        recipientEmail = entity.email;
      }
    }

    if (!recipientEmail) {
      throw new Error("No recipient email found");
    }

    // TODO: Implement actual email sending
    // For now, create a notification instead
    console.log(
      `[TagActionRunner] Email would be sent to ${recipientEmail} (email service not yet implemented)`
    );

    // Create notification as fallback
    if (entity && entity.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: entity.assignedToId,
          title: subject || "Tag Action: Email Notification",
          message: body || `Action triggered from tag: ${instance.tagFlow?.name || "Unknown"}`,
          type: "INFO",
          isRead: false,
        },
      });
    }

    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute sendWhatsApp action
 */
async function executeSendWhatsApp(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { to, message, template } = params;

    // Get entity for context
    const entity = instance.tagApplication?.lead || instance.tagApplication?.call;
    
    // Determine recipient phone
    let recipientPhone = to;
    if (!recipientPhone && entity) {
      recipientPhone = entity.phoneNumber || entity.phone;
    }

    if (!recipientPhone) {
      throw new Error("No recipient phone number found");
    }

    // TODO: Implement actual WhatsApp sending
    // For now, log and create notification
    console.log(
      `[TagActionRunner] WhatsApp would be sent to ${recipientPhone} (WhatsApp service not yet implemented)`
    );

    // Create notification as fallback
    if (entity && entity.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: entity.assignedToId,
          title: "Tag Action: WhatsApp Notification",
          message: message || `Action triggered from tag: ${instance.tagFlow?.name || "Unknown"}`,
          type: "INFO",
          isRead: false,
        },
      });
    }

    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute updateLeadStatus action
 */
async function executeUpdateLeadStatus(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { status } = params;

    if (!status) {
      throw new Error("Lead status is required");
    }

    if (instance.entityType !== "lead") {
      throw new Error("updateLeadStatus action can only be used for leads");
    }

    const leadId = instance.entityId;
    
    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status },
    });

    console.log(`[TagActionRunner] Updated lead ${leadId} status to ${status}`);
    
    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute assignToUser action
 */
async function executeAssignToUser(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { userId } = params;

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.isActive) {
      throw new Error(`User ${userId} is not active`);
    }

    // Update entity assignment based on type
    if (instance.entityType === "lead") {
      await prisma.lead.update({
        where: { id: instance.entityId },
        data: { assignedToId: userId },
      });
      console.log(`[TagActionRunner] Assigned lead ${instance.entityId} to user ${userId}`);
    } else if (instance.entityType === "call") {
      // Calls don't have assignedToId, skip
      console.log(`[TagActionRunner] Call assignment not supported, skipping`);
    } else {
      throw new Error(`Assignment not supported for entity type: ${instance.entityType}`);
    }

    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute createNotification action
 */
async function executeCreateNotification(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { userId, title, message, type } = params;

    // Get entity for context
    const entity = instance.tagApplication?.lead || instance.tagApplication?.call;
    
    // Determine recipient user (params > entity assigned/created > user who applied tag)
    let recipientUserId = userId;
    if (!recipientUserId && entity) {
      recipientUserId = entity.assignedToId || entity.createdById;
    }
    if (!recipientUserId && instance.tagApplication?.appliedById) {
      recipientUserId = instance.tagApplication.appliedById;
    }
    // Last resort: use first ADMIN user (e.g. when lead has no assignee and tag applied by system)
    if (!recipientUserId) {
      const admin = await prisma.user.findFirst({
        where: { role: { name: "ADMIN" }, isActive: true },
        select: { id: true },
      });
      if (admin) recipientUserId = admin.id;
    }

    if (!recipientUserId) {
      throw new Error("No recipient user found for notification");
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        title: title || `Tag Action: ${instance.tagFlow?.name || "Unknown"}`,
        message: message || `Action triggered from tag: ${instance.tagFlow?.name || "Unknown"}`,
        type: type || "INFO",
        isRead: false,
      },
    });

    console.log(`[TagActionRunner] Created notification for user ${recipientUserId}`);
    
    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Execute escalate action (final attempt only)
 */
async function executeEscalate(
  instance: any,
  params: Record<string, any>
): Promise<ActionExecutionResult> {
  try {
    const { escalateToUserId, message } = params;

    // Get entity for context
    const entity = instance.tagApplication?.lead || instance.tagApplication?.call;
    
    // Determine escalation target
    let targetUserId = escalateToUserId;
    if (!targetUserId && entity) {
      // Try to escalate to team leader or branch manager
      // This is a simplified escalation - can be enhanced
      if (entity.assignedToId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: entity.assignedToId },
          select: { teamLeaderId: true },
        });
        if (assignedUser?.teamLeaderId) {
          targetUserId = assignedUser.teamLeaderId;
        }
      }
    }

    if (!targetUserId && instance.tagApplication?.appliedById) {
      targetUserId = instance.tagApplication.appliedById;
    }
    if (!targetUserId) {
      const admin = await prisma.user.findFirst({
        where: { role: { name: "ADMIN" }, isActive: true },
        select: { id: true },
      });
      if (admin) targetUserId = admin.id;
    }
    if (!targetUserId) {
      throw new Error("No escalation target user found");
    }

    // Create notification for escalation
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: `Escalation: ${instance.tagFlow?.name || "Tag Action"}`,
        message: message || `Action failed after ${instance.maxAttempts} attempts. Requires attention.`,
        type: "URGENT",
        isRead: false,
      },
    });

    // Optionally reassign entity
    if (instance.entityType === "lead" && params.reassign) {
      await prisma.lead.update({
        where: { id: instance.entityId },
        data: { assignedToId: targetUserId },
      });
    }

    console.log(`[TagActionRunner] Escalated instance ${instance.id} to user ${targetUserId}`);
    
    return { success: true, executionTimeMs: 0 };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || String(error),
      executionTimeMs: 0,
    };
  }
}

/**
 * Run the tag action runner (processes all due instances)
 */
export async function runTagActionRunner(): Promise<void> {
  const startTime = Date.now();
  console.log("[TagActionRunner] Starting runner...");

  try {
    // Poll for due instances
    const dueInstances = await pollDueInstances(50);

    if (dueInstances.length === 0) {
      console.log("[TagActionRunner] No due instances found");
      return;
    }

    console.log(`[TagActionRunner] Found ${dueInstances.length} due instances`);

    // Process each instance
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };

    for (const instance of dueInstances) {
      try {
        await executeInstance(instance);
        results.processed++;
        results.succeeded++;
      } catch (error: any) {
        results.processed++;
        results.failed++;
        console.error(
          `[TagActionRunner] Failed to process instance ${instance.id}:`,
          error.message || String(error)
        );
        // Continue processing other instances
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[TagActionRunner] Completed: ${results.processed} processed (${results.succeeded} succeeded, ${results.failed} failed) in ${totalTime}ms`
    );
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[TagActionRunner] Runner error:`, error);
    throw error;
  }
}
