/**
 * Retry Scheduler Service
 * 
 * Handles scheduling retry attempts for workflow actions.
 */

import { prisma } from "../lib/prisma";

export interface RetryConfig {
  enabled: boolean;
  maxAttempts?: number;
  delayMinutes?: number; // Delay before first retry
  retryDelays?: number[]; // Array of delays for each retry (in minutes)
  finalAttempt?: {
    delayMinutes: number;
    actions?: any[];
  };
}

/**
 * Schedule retry for a workflow action execution
 * 
 * @param actionExecutionId - WorkflowActionExecution ID
 * @param retryConfig - Retry configuration
 * @param context - Execution context
 */
export async function scheduleRetry(
  actionExecutionId: string,
  retryConfig: RetryConfig,
  context: any
): Promise<void> {
  try {
    if (!retryConfig.enabled) {
      return; // Retry not enabled
    }

    // Get current action execution
    const actionExecution = await prisma.workflowActionExecution.findUnique({
      where: { id: actionExecutionId },
      include: {
        execution: true,
      },
    });

    if (!actionExecution) {
      throw new Error(`Action execution ${actionExecutionId} not found`);
    }

    const currentAttempt = actionExecution.attemptNumber || 1;
    const maxAttempts = retryConfig.maxAttempts || 3;

    // Check if we've reached max attempts
    if (currentAttempt >= maxAttempts) {
      // Final attempt - execute final actions if configured
      if (retryConfig.finalAttempt) {
        await scheduleFinalAttempt(actionExecutionId, retryConfig.finalAttempt, context);
      } else {
        // Mark as failed
        await prisma.workflowActionExecution.update({
          where: { id: actionExecutionId },
          data: {
            status: 'failed',
            errorMessage: `Max attempts (${maxAttempts}) reached`,
          },
        });
      }
      return;
    }

    // Calculate delay for next attempt
    const delayMinutes = calculateRetryDelay(currentAttempt, retryConfig);
    const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Update action execution with next attempt
    await prisma.workflowActionExecution.update({
      where: { id: actionExecutionId },
      data: {
        attemptNumber: currentAttempt + 1,
        status: 'pending', // Reset to pending for retry
        scheduledAt: nextRunAt,
      },
    });

    console.log(
      `[RETRY SCHEDULER] Scheduled retry ${currentAttempt + 1}/${maxAttempts} for action ${actionExecutionId} at ${nextRunAt.toISOString()}`
    );
  } catch (error: any) {
    console.error(`[RETRY SCHEDULER] Error scheduling retry for ${actionExecutionId}:`, error);
    throw error;
  }
}

/**
 * Calculate delay for retry attempt
 * 
 * @param attemptNumber - Current attempt number (1-based)
 * @param retryConfig - Retry configuration
 * @returns Delay in minutes
 */
function calculateRetryDelay(attemptNumber: number, retryConfig: RetryConfig): number {
  // If retryDelays array is provided, use it
  if (retryConfig.retryDelays && retryConfig.retryDelays.length > 0) {
    const index = Math.min(attemptNumber - 1, retryConfig.retryDelays.length - 1);
    return retryConfig.retryDelays[index];
  }

  // Otherwise use delayMinutes or default
  return retryConfig.delayMinutes || 60; // Default: 1 hour
}

/**
 * Schedule final attempt with final actions
 * 
 * @param actionExecutionId - WorkflowActionExecution ID
 * @param finalAttemptConfig - Final attempt configuration
 * @param context - Execution context
 */
async function scheduleFinalAttempt(
  actionExecutionId: string,
  finalAttemptConfig: any,
  context: any
): Promise<void> {
  try {
    const delayMinutes = finalAttemptConfig.delayMinutes || 60;
    const nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Update action execution for final attempt
    await prisma.workflowActionExecution.update({
      where: { id: actionExecutionId },
      data: {
        status: 'pending',
        scheduledAt: nextRunAt,
        // Store final attempt config in resultData
        resultData: JSON.stringify({
          isFinalAttempt: true,
          finalAttemptActions: finalAttemptConfig.actions || [],
          scheduledAt: nextRunAt.toISOString(),
        }),
      },
    });

    console.log(
      `[RETRY SCHEDULER] Scheduled final attempt for action ${actionExecutionId} at ${nextRunAt.toISOString()}`
    );
  } catch (error: any) {
    console.error(`[RETRY SCHEDULER] Error scheduling final attempt:`, error);
    throw error;
  }
}

/**
 * Get pending retry actions that are due for execution
 * 
 * @param limit - Maximum number of actions to return
 * @returns Array of WorkflowActionExecution records
 */
export async function getPendingRetryActions(limit: number = 50): Promise<any[]> {
  try {
    const now = new Date();

    const pendingActions = await prisma.workflowActionExecution.findMany({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        execution: {
          include: {
            workflow: true,
            lead: true,
            call: true,
          },
        },
      },
      take: limit,
      orderBy: {
        scheduledAt: 'asc', // Process oldest first
      },
    });

    return pendingActions;
  } catch (error: any) {
    console.error('[RETRY SCHEDULER] Error getting pending retry actions:', error);
    throw error;
  }
}
