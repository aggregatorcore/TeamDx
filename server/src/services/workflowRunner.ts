/**
 * Workflow Runner Service
 * 
 * Main execution engine for workflows.
 * Handles workflow execution from trigger to completion.
 */

import { prisma } from "../lib/prisma";
import { executeAction } from "./actionExecutor";
import { scheduleRetry } from "./retryScheduler";

export interface WorkflowTrigger {
  workflowId: string;
  leadId?: string;
  callId?: string;
  triggerNodeId: string; // The node ID that triggered the workflow
  tagId?: string; // Tag ID that triggered the workflow (for updating tag application)
  userId?: string; // User who triggered the workflow
}

export interface WorkflowNode {
  id: string;
  type: string; // "trigger", "action", "condition", "end"
  data?: any;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    savedAt?: string;
    version?: string;
  };
}

/**
 * Start workflow execution
 * 
 * @param trigger - Workflow trigger data
 * @returns WorkflowExecution record
 */
export async function startWorkflowExecution(trigger: WorkflowTrigger): Promise<any> {
  console.log(`[WORKFLOW RUNNER] 🚀 startWorkflowExecution called:`, {
    workflowId: trigger.workflowId,
    triggerNodeId: trigger.triggerNodeId,
    leadId: trigger.leadId,
    tagId: trigger.tagId,
  });
  
  try {
    // Get workflow
    console.log(`[WORKFLOW RUNNER] 📋 Fetching workflow ${trigger.workflowId}...`);
    const workflow = await prisma.workflow.findUnique({
      where: { id: trigger.workflowId },
    });

    if (!workflow) {
      console.error(`[WORKFLOW RUNNER] ❌ Workflow ${trigger.workflowId} not found`);
      throw new Error(`Workflow ${trigger.workflowId} not found`);
    }

    if (!workflow.isActive) {
      console.error(`[WORKFLOW RUNNER] ❌ Workflow ${trigger.workflowId} is not active`);
      throw new Error(`Workflow ${trigger.workflowId} is not active`);
    }

    console.log(`[WORKFLOW RUNNER] ✅ Workflow found: ${workflow.name} (active: ${workflow.isActive})`);

    // Parse workflow data
    console.log(`[WORKFLOW RUNNER] 📝 Parsing workflow data...`);
    const workflowData: WorkflowData = typeof workflow.workflowData === 'string'
      ? JSON.parse(workflow.workflowData)
      : workflow.workflowData;

    console.log(`[WORKFLOW RUNNER] 📊 Workflow has ${workflowData.nodes?.length || 0} nodes, ${workflowData.edges?.length || 0} edges`);

    // Find trigger node (can be tagButton, childButton, or trigger type)
    console.log(`[WORKFLOW RUNNER] 🔍 Looking for trigger node: ${trigger.triggerNodeId}`);
    const triggerNode = workflowData.nodes.find(
      (node) => node.id === trigger.triggerNodeId
    );

    if (!triggerNode) {
      console.error(`[WORKFLOW RUNNER] ❌ Trigger node ${trigger.triggerNodeId} not found in workflow`);
      console.error(`[WORKFLOW RUNNER] Available nodes:`, workflowData.nodes.map((n: any) => ({ id: n.id, type: n.type })));
      throw new Error(`Trigger node ${trigger.triggerNodeId} not found in workflow`);
    }

    console.log(`[WORKFLOW RUNNER] ✅ Trigger node found:`, {
      id: triggerNode.id,
      type: triggerNode.type,
      label: triggerNode.data?.label,
    });

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        leadId: trigger.leadId || null,
        callId: trigger.callId || null,
        currentNodeId: triggerNode.id,
        status: 'in_progress',
        executionData: JSON.stringify({
          currentNodeId: triggerNode.id,
          visitedNodes: [triggerNode.id],
          context: {
            leadId: trigger.leadId,
            callId: trigger.callId,
            userId: trigger.userId,
            tagId: trigger.tagId, // Include tagId in context for callback action
          },
        }),
        startedAt: new Date(),
      },
    });

    console.log(`[WORKFLOW RUNNER] Starting workflow execution:`, {
      executionId: execution.id,
      triggerNodeId: triggerNode.id,
      triggerNodeType: triggerNode.type,
      workflowId: workflow.id,
      leadId: trigger.leadId,
    });

    // Start processing from trigger node
    await processWorkflowNode(execution.id, triggerNode.id, workflowData);

    return execution;
  } catch (error: any) {
    console.error("[WORKFLOW RUNNER] Error starting workflow execution:", error);
    throw error;
  }
}

/**
 * Process a workflow node
 * 
 * @param executionId - Workflow execution ID
 * @param nodeId - Node ID to process
 * @param workflowData - Parsed workflow data
 */
export async function processWorkflowNode(
  executionId: string,
  nodeId: string,
  workflowData: WorkflowData
): Promise<void> {
  try {
    // Get execution
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      console.log(`[WORKFLOW RUNNER] Execution ${executionId} already ${execution.status}`);
      return;
    }

    // Find node
    const node = workflowData.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Parse execution data
    const executionData = execution.executionData
      ? JSON.parse(execution.executionData)
      : { visitedNodes: [], context: {} };

    // Check if already visited (prevent infinite loops)
    // BUT: Allow re-processing if we're resuming from this node (it's the current node)
    if (executionData.visitedNodes?.includes(nodeId) && execution.currentNodeId !== nodeId) {
      console.log(`[WORKFLOW RUNNER] ⚠️ Node ${nodeId} already visited and not current node, skipping`);
      console.log(`[WORKFLOW RUNNER] Current node: ${execution.currentNodeId}, Processing: ${nodeId}`);
      return;
    }
    
    // If node is already visited but it's the current node, allow processing (for retries)
    if (executionData.visitedNodes?.includes(nodeId) && execution.currentNodeId === nodeId) {
      console.log(`[WORKFLOW RUNNER] ⚠️ Node ${nodeId} already visited but is current node, allowing re-processing for retry`);
    }

    // Mark node as visited
    executionData.visitedNodes = [...(executionData.visitedNodes || []), nodeId];
    executionData.currentNodeId = nodeId;

    // Process node based on type
    switch (node.type) {
      case 'trigger':
      case 'tagButton':
      case 'childButton':
      case 'navigation':
      case 'parentButtons':
      case 'subButtons':
        // These nodes just pass through to next node
        console.log(`[WORKFLOW RUNNER] 🔄 Processing ${node.type} node ${nodeId}, moving to next node`);
        await moveToNextNode(executionId, nodeId, workflowData, executionData);
        break;

      case 'action':
        // Execute action
        console.log(`[WORKFLOW RUNNER] Executing action node ${nodeId}`, {
          actionType: node.data?.actionType,
          label: node.data?.label,
        });
        await executeActionNode(executionId, node, executionData);
        // Move to next node after action
        await moveToNextNode(executionId, nodeId, workflowData, executionData);
        break;

      case 'condition':
        // Handle condition logic (if needed)
        await moveToNextNode(executionId, nodeId, workflowData, executionData);
        break;

      case 'end':
        // End node - complete execution
        await completeWorkflowExecution(executionId);
        break;

      default:
        console.warn(`[WORKFLOW RUNNER] Unknown node type: ${node.type}, treating as pass-through`);
        await moveToNextNode(executionId, nodeId, workflowData, executionData);
    }
  } catch (error: any) {
    console.error(`[WORKFLOW RUNNER] Error processing node ${nodeId}:`, error);
    await failWorkflowExecution(executionId, error.message);
    throw error;
  }
}

/**
 * Execute an action node
 * 
 * @param executionId - Workflow execution ID
 * @param node - Action node
 * @param executionData - Current execution data
 */
async function executeActionNode(
  executionId: string,
  node: WorkflowNode,
  executionData: any
): Promise<void> {
  try {
    console.log(`[WORKFLOW RUNNER] Executing action node:`, {
      nodeId: node.id,
      nodeType: node.type,
      nodeData: node.data,
      hasActions: !!node.data?.actions,
      hasActionType: !!node.data?.actionType,
    });

    // Support both old format (single actionType) and new format (actions array)
    let actionsToExecute: any[] = [];

    if (node.data?.actions && Array.isArray(node.data.actions)) {
      // New format: multiple actions
      actionsToExecute = node.data.actions;
      console.log(`[WORKFLOW RUNNER] Found ${actionsToExecute.length} actions to execute`);
    } else if (node.data?.actionType) {
      // Old format: single action - extract config properly
      let actionConfig: any = {};
      
      // Extract callback-specific config
      if (node.data.actionType === "callback") {
        actionConfig.dueInMinutes = node.data.dueInMinutes || node.data.delayMinutes || 60;
        actionConfig.assignedToUserId = node.data.assignedToUserId;
        actionConfig.priority = node.data.priority || 'MEDIUM';
        actionConfig.title = node.data.title;
        actionConfig.description = node.data.description;
      } else {
        // For other action types, include all data as config (except actionType)
        actionConfig = { ...node.data };
        delete actionConfig.actionType; // Remove actionType from config
      }
      
      actionsToExecute = [{
        actionType: node.data.actionType,
        config: actionConfig,
      }];
      console.log(`[WORKFLOW RUNNER] Using legacy single action format`, {
        actionType: node.data.actionType,
        config: actionConfig,
      });
    } else {
      console.warn(`[WORKFLOW RUNNER] ❌ Action node ${node.id} has no actions or actionType`, {
        nodeData: node.data,
        availableKeys: node.data ? Object.keys(node.data) : [],
      });
      return;
    }

    // Execute all actions sequentially
    for (let i = 0; i < actionsToExecute.length; i++) {
      const action = actionsToExecute[i];
      const actionType = action.actionType;
      const actionConfig = action.config || {};

      if (!actionType) {
        console.warn(`[WORKFLOW RUNNER] ⚠️ Action ${i + 1} in node ${node.id} has no actionType, skipping`);
        continue;
      }

      console.log(`[WORKFLOW RUNNER] Executing action ${i + 1}/${actionsToExecute.length}:`, {
        actionType,
        actionConfig: JSON.stringify(actionConfig, null, 2),
        context: executionData.context,
      });

      // Create action execution record
      const actionExecution = await prisma.workflowActionExecution.create({
        data: {
          executionId,
          actionNodeId: node.id,
          actionType,
          attemptNumber: 1,
          status: 'pending',
          scheduledAt: new Date(), // Execute immediately
        },
      });

      // Execute action
      try {
        const result = await executeAction(actionType, actionConfig, executionData.context);

        // Update action execution
        await prisma.workflowActionExecution.update({
          where: { id: actionExecution.id },
          data: {
            status: 'sent',
            executedAt: new Date(),
            resultData: JSON.stringify(result),
          },
        });

        console.log(`[WORKFLOW RUNNER] ✅ Action ${i + 1}/${actionsToExecute.length} (${actionType}) executed successfully`);

        // Check if retry is needed
        if (actionConfig.retry && actionConfig.retry.enabled) {
          await scheduleRetry(actionExecution.id, actionConfig.retry, executionData.context);
        }
      } catch (error: any) {
        // Mark action as failed
        await prisma.workflowActionExecution.update({
          where: { id: actionExecution.id },
          data: {
            status: 'failed',
            executedAt: new Date(),
            errorMessage: error.message,
          },
        });

        console.error(`[WORKFLOW RUNNER] ❌ Action ${i + 1}/${actionsToExecute.length} (${actionType}) failed:`, error.message);

        // If retry enabled, schedule retry
        if (actionConfig.retry && actionConfig.retry.enabled) {
          await scheduleRetry(actionExecution.id, actionConfig.retry, executionData.context);
        } else {
          // Continue with next action even if this one failed
          // (Don't throw error to allow other actions to execute)
          console.warn(`[WORKFLOW RUNNER] Continuing with next action despite failure`);
        }
      }
    }

    console.log(`[WORKFLOW RUNNER] ✅ Completed executing all ${actionsToExecute.length} actions in node ${node.id}`);
  } catch (error: any) {
    console.error(`[WORKFLOW RUNNER] Error executing action node ${node.id}:`, error);
    throw error;
  }
}

/**
 * Move to next node in workflow
 * 
 * @param executionId - Workflow execution ID
 * @param currentNodeId - Current node ID
 * @param workflowData - Parsed workflow data
 * @param executionData - Current execution data
 */
async function moveToNextNode(
  executionId: string,
  currentNodeId: string,
  workflowData: WorkflowData,
  executionData: any
): Promise<void> {
  try {
    console.log(`[WORKFLOW RUNNER] 🔀 moveToNextNode called for node ${currentNodeId}`);
    
    // Find edges from current node
    const outgoingEdges = workflowData.edges.filter(
      (edge) => edge.source === currentNodeId
    );

    console.log(`[WORKFLOW RUNNER] 📊 Found ${outgoingEdges.length} outgoing edges from ${currentNodeId}:`, {
      edges: outgoingEdges.map(e => ({ 
        id: e.id, 
        source: e.source, 
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
      allEdgesCount: workflowData.edges?.length || 0,
    });

    if (outgoingEdges.length === 0) {
      // No next node - complete execution
      console.log(`[WORKFLOW RUNNER] ⚠️ No outgoing edges from ${currentNodeId}, completing execution`);
      await completeWorkflowExecution(executionId);
      return;
    }

    // For now, take the first edge (can be enhanced for conditions)
    const nextEdge = outgoingEdges[0];
    const nextNodeId = nextEdge.target;
    
    // Find the target node to log its type
    const nextNode = workflowData.nodes.find(n => n.id === nextNodeId);
    console.log(`[WORKFLOW RUNNER] ➡️ Moving to next node:`, {
      from: currentNodeId,
      to: nextNodeId,
      nextNodeType: nextNode?.type || 'unknown',
      edgeId: nextEdge.id,
    });

    // Update execution
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        currentNodeId: nextNodeId,
        executionData: JSON.stringify(executionData),
      },
    });

    console.log(`[WORKFLOW RUNNER] ✅ Updated execution ${executionId} to currentNodeId: ${nextNodeId}`);

    // Process next node
    console.log(`[WORKFLOW RUNNER] 🚀 Calling processWorkflowNode for ${nextNodeId}`);
    await processWorkflowNode(executionId, nextNodeId, workflowData);
  } catch (error: any) {
    console.error(`[WORKFLOW RUNNER] ❌ Error moving to next node:`, error);
    throw error;
  }
}

/**
 * Complete workflow execution
 * 
 * @param executionId - Workflow execution ID
 */
async function completeWorkflowExecution(executionId: string): Promise<void> {
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });

  console.log(`[WORKFLOW RUNNER] Execution ${executionId} completed`);
}

/**
 * Fail workflow execution
 * 
 * @param executionId - Workflow execution ID
 * @param errorMessage - Error message
 */
async function failWorkflowExecution(executionId: string, errorMessage: string): Promise<void> {
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      status: 'failed',
      completedAt: new Date(),
      errorMessage,
    },
  });

  console.error(`[WORKFLOW RUNNER] Execution ${executionId} failed: ${errorMessage}`);
}

/**
 * Resume workflow execution (for retries)
 * 
 * @param executionId - Workflow execution ID
 */
export async function resumeWorkflowExecution(executionId: string): Promise<void> {
  try {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: { workflow: true },
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      console.log(`[WORKFLOW RUNNER] Execution ${executionId} already ${execution.status}`);
      return;
    }

    // Parse workflow data
    const workflowData: WorkflowData = typeof execution.workflow.workflowData === 'string'
      ? JSON.parse(execution.workflow.workflowData)
      : execution.workflow.workflowData;

    // Parse execution data
    const executionData = execution.executionData
      ? JSON.parse(execution.executionData)
      : { visitedNodes: [], context: {} };

    // Resume from current node
    if (execution.currentNodeId) {
      await processWorkflowNode(executionId, execution.currentNodeId, workflowData);
    } else {
      await completeWorkflowExecution(executionId);
    }
  } catch (error: any) {
    console.error(`[WORKFLOW RUNNER] Error resuming execution ${executionId}:`, error);
    throw error;
  }
}
