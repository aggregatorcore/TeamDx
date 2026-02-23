/**
 * Cron job for workflow retry actions
 * Runs every 30 seconds to process due workflow action retries
 */

import cron from "node-cron";
import { getPendingRetryActions } from "../services/retryScheduler";
import { executeAction } from "../services/actionExecutor";
import { prisma } from "../lib/prisma";

/**
 * Process pending workflow action retries
 */
async function processWorkflowRetries(): Promise<void> {
  try {
    // Get pending retry actions
    const pendingActions = await getPendingRetryActions(50);

    if (pendingActions.length === 0) {
      return; // No pending actions
    }

    console.log(`[WORKFLOW RETRY JOB] Processing ${pendingActions.length} pending retry actions`);

    // Process each action
    for (const action of pendingActions) {
      try {
        // Update status to running
        await prisma.workflowActionExecution.update({
          where: { id: action.id },
          data: { status: 'running' },
        });

        // Get execution context
        const execution = action.execution;
        const context = {
          leadId: execution.leadId,
          callId: execution.callId,
          userId: execution.workflow.createdById,
        };

        // Parse execution data for context
        let executionData = {};
        if (execution.executionData) {
          try {
            executionData = JSON.parse(execution.executionData);
          } catch (e) {
            console.warn(`[WORKFLOW RETRY JOB] Failed to parse execution data for ${execution.id}`);
          }
        }

        const fullContext = {
          ...context,
          ...(executionData.context || {}),
        };

        // Check if this is a final attempt
        let actionConfig = {};
        let isFinalAttempt = false;

        if (action.resultData) {
          try {
            const resultData = JSON.parse(action.resultData);
            if (resultData.isFinalAttempt) {
              isFinalAttempt = true;
              // Execute final attempt actions
              if (resultData.finalAttemptActions && resultData.finalAttemptActions.length > 0) {
                for (const finalAction of resultData.finalAttemptActions) {
                  await executeAction(finalAction.type, finalAction.params || {}, fullContext);
                }
              }
            }
          } catch (e) {
            console.warn(`[WORKFLOW RETRY JOB] Failed to parse result data for action ${action.id}`);
          }
        }

        // If not final attempt, retry the original action
        if (!isFinalAttempt) {
          // Get node data from workflow
          const workflowData = typeof execution.workflow.workflowData === 'string'
            ? JSON.parse(execution.workflow.workflowData)
            : execution.workflow.workflowData;

          const node = workflowData.nodes?.find((n: any) => n.id === action.actionNodeId);
          if (node) {
            const actionConfig = node.data?.config || node.data || {};
            const actionType = node.data?.actionType || node.data?.type || action.actionType;

            // Retry action
            const result = await executeAction(actionType, actionConfig, fullContext);

            // Update action execution
            await prisma.workflowActionExecution.update({
              where: { id: action.id },
              data: {
                status: result.success ? 'sent' : 'failed',
                executedAt: new Date(),
                resultData: JSON.stringify(result),
                errorMessage: result.error || null,
              },
            });

            // Schedule next retry if needed
            if (!result.success && actionConfig.retry && actionConfig.retry.enabled) {
              const { scheduleRetry } = require("../services/retryScheduler");
              await scheduleRetry(action.id, actionConfig.retry, fullContext);
            } else if (result.success) {
              // Action succeeded - no more retries needed
              console.log(`[WORKFLOW RETRY JOB] Action ${action.id} succeeded on retry`);
            }
          }
        } else {
          // Final attempt completed
          await prisma.workflowActionExecution.update({
            where: { id: action.id },
            data: {
              status: 'sent',
              executedAt: new Date(),
            },
          });
        }
      } catch (error: any) {
        console.error(`[WORKFLOW RETRY JOB] Error processing action ${action.id}:`, error);

        // Mark as failed
        await prisma.workflowActionExecution.update({
          where: { id: action.id },
          data: {
            status: 'failed',
            executedAt: new Date(),
            errorMessage: error.message || 'Unknown error',
          },
        });
      }
    }

    console.log(`[WORKFLOW RETRY JOB] Completed processing ${pendingActions.length} actions`);
  } catch (error: any) {
    console.error("[WORKFLOW RETRY JOB] Error processing retries:", error);
    // Don't throw - cron errors shouldn't crash the server
  }
}

// Run every 30 seconds: "*/30 * * * * *" (seconds, minutes, hours, day, month, weekday)
// For node-cron, we use the 6-field format with seconds
cron.schedule("*/30 * * * * *", async () => {
  console.log("[WORKFLOW RETRY JOB] Running workflow retry processor...");
  await processWorkflowRetries();
  console.log("[WORKFLOW RETRY JOB] Workflow retry processor completed");
});

console.log("[WORKFLOW RETRY JOB] Workflow retry cron job scheduled (runs every 30 seconds)");
